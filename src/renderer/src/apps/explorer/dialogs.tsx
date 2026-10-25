import { useState } from 'react'
import { icons } from '../../icons'
import { type FolderOptions as Options, folderOptions as options } from '../../shell/folderOptions'
import { Button, Checkbox, Dialog, GroupBox, Radio, Tabs } from '../../ui'

export function FolderOptions({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'General' | 'View'>('General')
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
        <Tabs tabs={['General', 'View']} active={tab} onChange={setTab} pageClassName="p-4 min-h-[210px]">
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
        </Tabs>
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
  const [tab, setTab] = useState<'Global' | '(C:)'>('Global')
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
        <Tabs
          tabs={['Global', '(C:)']}
          active={tab}
          onChange={setTab}
          pageClassName="p-4 flex flex-col gap-5 min-h-[180px]"
        >
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
        </Tabs>
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
