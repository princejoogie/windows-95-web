import { type ReactNode, useId, useMemo, useState } from 'react'
import { resolvePath, type ShortcutTarget } from '../fs/fs'
import { shortcutKey } from '../fs/shortcutKey'
import { fs } from '../fs/store'
import type { FsNode, FsState, RunAs } from '../fs/types'
import { iconChoice, nodeIcon } from '../shell/nodeIcon'
import { apps } from '../shell/registry'
import { openNode } from '../shell/system'
import { Button } from './Button'
import { ComboBox } from './ComboBox'
import { Dialog } from './Dialog'
import { TextBox } from './fields'
import { shortcutInfo } from './properties'
import { Accel } from './text'

/** What the Shortcut tab is editing, before OK or Apply writes it. */
export interface ShortcutDraft {
  readonly target: string
  readonly startIn: string
  readonly run: RunAs
  readonly icon: string | null
  readonly shortcutKey: string
}

export function shortcutDraft(state: FsState, node: FsNode): ShortcutDraft | null {
  const info = shortcutInfo(state, node)
  if (!info || node.kind !== 'shortcut') return null
  return {
    target: info.target,
    startIn: info.startIn,
    run: node.run ?? 'normal',
    icon: node.icon ?? null,
    shortcutKey: node.shortcutKey ?? '',
  }
}

/**
 * Writes the Shortcut tab. A changed Target must name an existing file, folder, or program; a program becomes
 * a link to its app. Returns the message Windows shows when the target is not valid, or null.
 */
export function applyShortcut(state: FsState, node: FsNode, draft: ShortcutDraft): string | null {
  if (node.kind !== 'shortcut') return null
  const before = shortcutDraft(state, node)
  let target: ShortcutTarget = node.target === undefined ? { app: node.app } : { node: node.target }
  if (draft.target.trim() !== before?.target) {
    const found = resolvePath(state, draft.target.trim().replace(/^"(.*)"$/, '$1'))
    if (!found || found.id === node.id)
      return `The name '${draft.target}' specified in the Target box is not valid. Make sure the path and file name are correct.`
    target = found.kind === 'program' ? { app: found.app } : { node: found.id }
  }
  const startIn = draft.startIn.trim() === before?.startIn ? node.startIn : draft.startIn.trim()
  fs.setShortcut(node.id, target, {
    ...(startIn ? { startIn } : {}),
    run: draft.run,
    ...(draft.icon ? { icon: draft.icon } : {}),
    ...(draft.shortcutKey ? { shortcutKey: draft.shortcutKey } : {}),
  })
  return null
}

const RUN: readonly { key: RunAs; label: string }[] = [
  { key: 'normal', label: 'Normal window' },
  { key: 'minimized', label: 'Minimized' },
  { key: 'maximized', label: 'Maximized' },
]

/** Every picture Change Icon offers: the shell's own, then each installed program's. */
const iconChoices = (): readonly string[] => [
  ...[
    'program',
    'document',
    'textDocument',
    'folderClosed',
    'folderOpened',
    'myComputer',
    'drive',
    'binEmpty',
    'binFull',
    'windowsLogo',
    'games',
  ].filter((key) => iconChoice(key)),
  ...apps.map((app) => `app:${app.id}`),
]

function ChangeIcon({
  current,
  onClose,
  onPick,
}: {
  current: string
  onClose: () => void
  onPick: (icon: string) => void
}) {
  const [chosen, setChosen] = useState(current)
  const choices = useMemo(iconChoices, [])
  const fileId = useId()
  return (
    <Dialog title="Change Icon" onClose={onClose} className="w-[330px]">
      <form
        className="flex flex-col gap-[8px] p-[8px]"
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onPick(chosen)
        }}
      >
        <div className="flex flex-col gap-[2px]">
          <label htmlFor={fileId}>
            <Accel label="&File name:" />
          </label>
          <TextBox id={fileId} value="C:\WINDOWS\SYSTEM\SHELL32.DLL" readOnly />
        </div>
        <span>
          <Accel label="&Current icon:" />
        </span>
        <div
          role="listbox"
          aria-label="Current icon"
          tabIndex={0}
          className="grid grid-flow-col grid-rows-3 auto-cols-[40px] gap-[2px] overflow-x-auto h-[136px] bg-white bevel-sunken p-[2px]"
          onKeyDown={(event) => {
            const index = choices.indexOf(chosen)
            const step = { ArrowDown: 1, ArrowUp: -1, ArrowRight: 3, ArrowLeft: -3 }[event.key]
            const next = step === undefined ? undefined : choices[index + step]
            if (!next) return
            event.preventDefault()
            setChosen(next)
          }}
        >
          {choices.map((key) => (
            <button
              key={key}
              type="button"
              role="option"
              tabIndex={-1}
              aria-label={key}
              aria-selected={key === chosen}
              className={`size-[40px] grid place-items-center outline-none ${key === chosen ? 'bg-select' : ''}`}
              onClick={() => setChosen(key)}
              onDoubleClick={() => onPick(key)}
            >
              <img src={iconChoice(key)} alt="" className="size-8" />
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-[6px]">
          <Button type="submit" isDefault>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}

/** The Shortcut tab: what the link opens, where it starts, how its window opens, and its icon. */
export function ShortcutPage({
  state,
  node,
  heading,
  draft,
  onChange,
}: {
  state: FsState
  node: FsNode
  heading: (icon: string) => ReactNode
  draft: ShortcutDraft
  onChange: (draft: ShortcutDraft) => void
}) {
  const [choosing, setChoosing] = useState(false)
  const info = shortcutInfo(state, node)
  if (!info) return null
  const field = (label: string, children: ReactNode) => (
    <div className="flex items-center">
      <span className="w-[86px] shrink-0">
        <Accel label={label} />
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
  const row = (label: string, value: string) => (
    <div className="flex min-h-[16px] items-start">
      <span className="w-[86px] shrink-0">{label}</span>
      <span className="min-w-0 break-words">{value}</span>
    </div>
  )
  const icon = (draft.icon && iconChoice(draft.icon)) || nodeIcon(node).icon
  return (
    <>
      {heading(icon)}
      <div className="my-[8px] h-[2px] border-t border-shadow border-b border-b-white" />
      <div className="flex flex-col gap-[6px]">
        {row('Target type:', info.type)}
        {row('Target location:', info.location)}
        {field(
          '&Target:',
          <TextBox
            aria-label="Target"
            readOnly={node.kind === 'shortcut' && node.app?.startsWith('shell:')}
            className="w-full"
            value={draft.target}
            onChange={(event) => onChange({ ...draft, target: event.target.value })}
          />,
        )}
      </div>
      <div className="my-[8px] h-[2px] border-t border-shadow border-b border-b-white" />
      <div className="flex flex-col gap-[6px]">
        {field(
          '&Start in:',
          <TextBox
            aria-label="Start in"
            readOnly={node.kind === 'shortcut' && node.app?.startsWith('shell:')}
            className="w-full"
            value={draft.startIn}
            onChange={(event) => onChange({ ...draft, startIn: event.target.value })}
          />,
        )}
        {field(
          'Shortcut &key:',
          <TextBox
            aria-label="Shortcut key"
            data-shortcut-key
            className="w-full"
            value={draft.shortcutKey ? `Ctrl + Alt + ${draft.shortcutKey}` : 'None'}
            readOnly
            onKeyDown={(event) => {
              const letter = shortcutKey(event.key)
              if (letter || event.key === 'Backspace' || event.key === 'Delete') {
                event.preventDefault()
                event.stopPropagation()
                onChange({ ...draft, shortcutKey: letter ?? '' })
              }
            }}
          />,
        )}
        {field(
          '&Run:',
          <ComboBox
            aria-label="Run"
            className="w-full"
            options={RUN}
            value={draft.run}
            onChange={(run) =>
              onChange({ ...draft, run: RUN.find((entry) => entry.key === run)?.key ?? 'normal' })
            }
          />,
        )}
      </div>
      <div className="flex justify-end gap-[6px] mt-[12px]">
        <Button
          className="w-[90px]"
          disabled={!info.folder}
          onClick={() => info.folder && openNode(info.folder)}
        >
          <Accel label="&Find Target..." />
        </Button>
        <Button className="w-[90px]" onClick={() => setChoosing(true)}>
          <Accel label="&Change Icon..." />
        </Button>
      </div>
      {choosing && (
        <ChangeIcon
          current={draft.icon ?? iconChoices().find((key) => iconChoice(key) === icon) ?? 'program'}
          onClose={() => setChoosing(false)}
          onPick={(picked) => {
            onChange({ ...draft, icon: picked })
            setChoosing(false)
          }}
        />
      )}
    </>
  )
}
