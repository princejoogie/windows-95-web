import { useState } from 'react'
import { DRIVE_CAPACITY } from '../../fs/fs'
import { useStore } from '../../lib/store'
import { type BinSetting, type FolderOptions, folderOptions } from '../../shell/folderOptions'
import { Button, Checkbox, Dialog, Radio, Tabs } from '../../ui'
import { formatSize } from '../../ui/properties'
import { Accel } from '../../ui/text'

const TICKS = 11

/**
 * The Windows 95 trackbar: a sunken channel, a raised pointer that points down at the tick marks, arrows and
 * Page Up/Down to step it, and a drag that snaps to whole percents.
 */
function Trackbar({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: number
  disabled: boolean
  onChange: (value: number) => void
}) {
  const WIDTH = 200
  const THUMB = 11
  const at = (value / 100) * (WIDTH - THUMB)
  const set = (next: number) => onChange(Math.max(0, Math.min(100, Math.round(next))))
  return (
    <div
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      className="relative h-[30px] outline-none focus-visible:outline-dotted focus-visible:outline-1"
      style={{ width: WIDTH }}
      onKeyDown={(event) => {
        if (disabled) return
        const steps: Readonly<Record<string, number>> = {
          ArrowLeft: -1,
          ArrowDown: -1,
          ArrowRight: 1,
          ArrowUp: 1,
          PageDown: -10,
          PageUp: 10,
        }
        if (event.key === 'Home') set(0)
        else if (event.key === 'End') set(100)
        else if (steps[event.key] !== undefined) set(value + (steps[event.key] ?? 0))
        else return
        event.preventDefault()
      }}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) return
        event.preventDefault()
        event.currentTarget.focus()
        const left = event.currentTarget.getBoundingClientRect().left
        const offset = event.clientX - left - at
        if (offset < 0 || offset >= THUMB) {
          set(value + (offset < 0 ? -10 : 10))
          return
        }
        const move = (e: PointerEvent) => set(((e.clientX - left - offset) / (WIDTH - THUMB)) * 100)
        const end = () => {
          globalThis.removeEventListener('pointermove', move)
          globalThis.removeEventListener('pointerup', end)
        }
        globalThis.addEventListener('pointermove', move)
        globalThis.addEventListener('pointerup', end)
      }}
    >
      <div className="absolute left-[4px] right-[4px] top-[8px] h-[4px] bevel-sunken bg-white" />
      <svg
        aria-hidden="true"
        className="absolute top-0"
        style={{ left: at }}
        width={THUMB}
        height="21"
        shapeRendering="crispEdges"
      >
        <path d="M0 0h11v16l-5 5h-1l-5-5z" fill="#c0c0c0" />
        <path d="M0 0h10v1H1v15H0zM1 16h1v1h1v1h1v1h1v1H4v-1H3v-1H2v-1H1z" fill="#fff" />
        <path d="M9 1h1v15H9zM9 16h1v1H9v1H8v1H7v1H6v-1h1v-1h1v-1h1z" fill="#808080" />
        <path d="M10 0h1v16h-1zM10 16h1v1h-1v1H9v1H8v1H7v1H5v-1h2v-1h1v-1h1v-1h1z" fill="#000" />
      </svg>
      {Array.from({ length: TICKS }, (_, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: ticks are fixed positions with no state
          key={index}
          className="absolute top-[24px] w-px h-[4px] bg-black"
          style={{ left: THUMB / 2 + (index / (TICKS - 1)) * (WIDTH - THUMB) }}
        />
      ))}
    </div>
  )
}

function BinControls({
  setting,
  disabled,
  each,
  onChange,
}: {
  setting: BinSetting
  disabled: boolean
  each: boolean
  onChange: (setting: BinSetting) => void
}) {
  return (
    <>
      <Checkbox
        label={
          <>
            <Accel label="&Do not move files to the Recycle Bin." />
            <br />
            Remove files immediately when deleted.
          </>
        }
        className="items-start"
        checked={setting.nuke}
        disabled={disabled}
        onChange={(event) => onChange({ ...setting, nuke: event.target.checked })}
      />
      <div className="flex flex-col gap-[4px]">
        <span className={disabled || setting.nuke ? 'text-embossed' : ''}>
          <Accel label={`&Maximum size of Recycle Bin (percent of ${each ? 'each ' : ''}drive)`} />
        </span>
        <div className="flex items-center gap-[10px]">
          <Trackbar
            label="Maximum size of Recycle Bin"
            value={setting.percent}
            disabled={disabled || setting.nuke}
            onChange={(percent) => onChange({ ...setting, percent })}
          />
          <span className={disabled || setting.nuke ? 'text-embossed' : ''}>{setting.percent}%</span>
        </div>
      </div>
    </>
  )
}

/**
 * Recycle Bin Properties: a Global page that either configures each drive on its own page or sets one
 * setting for every drive, the delete confirmation switch, and one page per drive.
 */
export function RecycleBinProperties({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'Global' | '(C:)'>('Global')
  const [draft, setDraft] = useState<FolderOptions>(folderOptions.get())
  const current = useStore(folderOptions, (options) => options)
  const changed = JSON.stringify(draft) !== JSON.stringify(current)
  const apply = () => folderOptions.dispatch(draft)
  const reserved = (DRIVE_CAPACITY * draft.binDrive.percent) / 100
  return (
    <Dialog title="Recycle Bin Properties" onClose={onClose} className="w-[362px]">
      <form
        className="p-[6px]"
        onSubmit={(event) => {
          event.preventDefault()
          apply()
          onClose()
        }}
      >
        <Tabs tabs={['Global', '(C:)']} active={tab} onChange={setTab}>
          {tab === 'Global' ? (
            <div className="flex flex-col gap-[10px] min-h-[220px]">
              <Radio
                name="bin-scope"
                label={<Accel label="Configure drives &independently" />}
                checked={draft.binIndependent}
                onChange={() => setDraft({ ...draft, binIndependent: true })}
              />
              <Radio
                name="bin-scope"
                label={<Accel label="&Use one setting for all drives:" />}
                checked={!draft.binIndependent}
                onChange={() => setDraft({ ...draft, binIndependent: false })}
              />
              <div className="flex flex-col gap-[10px] pl-[2px]">
                <BinControls
                  setting={draft.binGlobal}
                  disabled={draft.binIndependent}
                  each
                  onChange={(binGlobal) => setDraft({ ...draft, binGlobal })}
                />
              </div>
              <Checkbox
                label={<Accel label="Display &delete confirmation dialog" />}
                checked={draft.confirmDelete}
                onChange={(event) => setDraft({ ...draft, confirmDelete: event.target.checked })}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-[10px] min-h-[220px]">
              <div className="grid grid-cols-[110px_1fr] gap-y-[6px]">
                <span>Size of drive:</span>
                <span>{formatSize(DRIVE_CAPACITY).split(' (')[0]}</span>
                <span>Space reserved:</span>
                <span>{formatSize(reserved).split(' (')[0]}</span>
              </div>
              <BinControls
                setting={draft.binDrive}
                disabled={!draft.binIndependent}
                each={false}
                onChange={(binDrive) => setDraft({ ...draft, binDrive })}
              />
            </div>
          )}
        </Tabs>
        <div className="flex justify-end gap-[6px] pt-[6px]">
          <Button type="submit" isDefault>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button disabled={!changed} onClick={apply}>
            <Accel label="&Apply" />
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
