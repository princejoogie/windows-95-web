import { useState } from 'react'
import type { FsNode } from '../../fs/types'
import { icons } from '../../icons'
import { Button, Checkbox, Dialog, GroupBox, Radio } from '../../ui'
import { type Options, options } from './preferences'

export function FolderOptions({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('General')
  const [draft, setDraft] = useState<Options>(options.get())
  const changed = JSON.stringify(draft) !== JSON.stringify(options.get())
  const apply = () => options.dispatch(draft)
  return (
    <Dialog title="Options" onClose={onClose} className="w-[370px]">
      <form
        className="p-[6px]"
        onSubmit={(event) => {
          event.preventDefault()
          apply()
          onClose()
        }}
      >
        <div role="tablist" className="explorer-tabs">
          {['General', 'View'].map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="bevel-window p-4 min-h-[210px]">
          {tab === 'General' ? (
            <GroupBox label="Browse folders as follows" className="flex flex-col gap-3">
              <Radio
                name="browse"
                label="Open a new window for each folder"
                checked={!draft.sameWindow}
                onChange={() => setDraft({ ...draft, sameWindow: false })}
              />
              <Radio
                name="browse"
                label="Browse folders by using a single window"
                checked={draft.sameWindow}
                onChange={() => setDraft({ ...draft, sameWindow: true })}
              />
            </GroupBox>
          ) : (
            <div className="flex flex-col gap-4">
              <GroupBox label="Hidden files" className="flex flex-col gap-2">
                <Radio
                  name="hidden"
                  label="Do not show hidden or system files"
                  checked={!draft.showHidden}
                  onChange={() => setDraft({ ...draft, showHidden: false })}
                />
                <Radio
                  name="hidden"
                  label="Show all files"
                  checked={draft.showHidden}
                  onChange={() => setDraft({ ...draft, showHidden: true })}
                />
              </GroupBox>
              <Checkbox
                label="Hide MS-DOS file extensions for file types that are registered"
                checked={draft.hideExtensions}
                onChange={(event) => setDraft({ ...draft, hideExtensions: event.target.checked })}
              />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-[6px] pt-2">
          <Button type="submit" isDefault>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button disabled={!changed} onClick={apply}>
            Apply
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export function RecycleProperties({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('Global')
  const [draft, setDraft] = useState(options.get())
  return (
    <Dialog title="Recycle Bin Properties" onClose={onClose} className="w-[350px]">
      <form
        className="p-[6px]"
        onSubmit={(event) => {
          event.preventDefault()
          options.dispatch(draft)
          onClose()
        }}
      >
        <div role="tablist" className="explorer-tabs">
          {['Global', '(C:)'].map((name) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === name}
              key={name}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="bevel-window p-4 flex flex-col gap-5 min-h-[180px]">
          <div className="flex items-center gap-4">
            <img src={icons.binEmpty} className="size-8" alt="" />
            <span>
              {tab === 'Global' ? 'Settings for the Recycle Bin' : 'Local Disk (C:)'}
              <br />
              {tab === '(C:)' && 'Capacity: 512 MB'}
            </span>
          </div>
          <Checkbox
            label="Display delete confirmation dialog"
            checked={draft.confirmDelete}
            onChange={(event) => setDraft({ ...draft, confirmDelete: event.target.checked })}
          />
        </div>
        <div className="flex justify-end gap-[6px] pt-2">
          <Button type="submit" isDefault>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            disabled={draft.confirmDelete === options.get().confirmDelete}
            onClick={() => options.dispatch(draft)}
          >
            Apply
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export function DeleteConfirmation({
  nodes,
  permanent,
  onAnswer,
}: {
  nodes: readonly FsNode[]
  permanent: boolean
  onAnswer: (yes: boolean) => void
}) {
  const first = nodes[0]
  if (!first) return null
  const many = nodes.length > 1
  const message = permanent
    ? many
      ? `Are you sure you want to delete these ${nodes.length} items?`
      : `Are you sure you want to delete '${first.name}'?`
    : `Are you sure you want to send ${many ? `these ${nodes.length} items` : `'${first.name}'`} to the Recycle Bin?`
  const title = many
    ? 'Confirm Multiple File Delete'
    : first.kind === 'folder'
      ? 'Confirm Folder Delete'
      : 'Confirm File Delete'
  return (
    <Dialog title={title}>
      <form
        className="p-3 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          onAnswer(true)
        }}
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey) return
          if (event.key.toLowerCase() === 'y' || event.key.toLowerCase() === 'n') {
            event.preventDefault()
            onAnswer(event.key.toLowerCase() === 'y')
          }
        }}
      >
        <div className="flex items-center gap-4">
          <div
            role="img"
            className="relative size-8 shrink-0"
            aria-label={permanent ? 'Delete file' : 'Send file to Recycle Bin'}
          >
            <img src={icons.document} alt="" className="absolute left-0 top-0 size-4" />
            <svg
              aria-hidden="true"
              className="absolute left-[13px] top-[1px]"
              width="8"
              height="8"
              shapeRendering="crispEdges"
            >
              <path d="M0 1h2v2h2V1h2v5H1V4h2L0 1z" />
            </svg>
            <img
              src={permanent ? icons.binFull : icons.binEmpty}
              alt=""
              className="absolute right-0 bottom-0 size-6"
            />
          </div>
          <p className="max-w-[400px]">{message}</p>
        </div>
        <div className="flex justify-center gap-[6px]">
          <Button type="submit" isDefault>
            <u>Y</u>es
          </Button>
          <Button onClick={() => onAnswer(false)}>
            <u>N</u>o
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
