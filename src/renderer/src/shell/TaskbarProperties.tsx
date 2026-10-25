import { useState } from 'react'
import { children } from '../fs/fs'
import { createNode, fs, useFs } from '../fs/store'
import { Button, Checkbox, Dialog, GroupBox, MessageBox, TextBox } from '../ui'
import { clearDocuments } from './recent'
import { findAppByExe } from './registry'
import { startMenuFolder } from './startup'
import { launch } from './system'
import { setTaskbarSettings, useTaskbarSettings } from './taskbarSettings'

export function TaskbarProperties({ onClose }: { onClose: () => void }) {
  const settings = useTaskbarSettings()
  const [draft, setDraft] = useState(settings)
  const [tab, setTab] = useState<'options' | 'programs'>('options')
  const [manage, setManage] = useState<'add' | 'remove' | null>(null)
  const [command, setCommand] = useState('')
  const [error, setError] = useState<string | null>(null)
  const state = useFs((state) => state)
  const folder = startMenuFolder()
  const items = folder ? children(state, folder) : []
  const apply = () => setTaskbarSettings(draft)
  return (
    <Dialog title="Taskbar Properties" onClose={onClose} className="w-[390px]">
      <div className="p-[8px]">
        <div role="tablist" className="flex pl-[2px]">
          {(['options', 'programs'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`px-[8px] h-[22px] bevel-raised ${tab === id ? 'relative top-px bg-face' : ''}`}
              onClick={() => setTab(id)}
            >
              {id === 'options' ? 'Taskbar Options' : 'Start Menu Programs'}
            </button>
          ))}
        </div>
        <div className="bevel-raised p-[12px] min-h-[250px]">
          {tab === 'options' ? (
            <>
              <div
                aria-label="Taskbar preview"
                role="img"
                className="bevel-sunken h-[100px] bg-desktop relative mb-[16px]"
              >
                <div className="absolute inset-x-0 bottom-0 h-[20px] bg-face flex justify-between p-[3px]">
                  <span className="bevel-raised font-bold px-[3px]">Start</span>
                  {draft.showClock && <span className="bevel-sunken px-[5px]">12:00 PM</span>}
                </div>
              </div>
              <div className="flex flex-col gap-[10px]">
                {(
                  [
                    ['alwaysOnTop', 'Always on top'],
                    ['autoHide', 'Auto hide'],
                    ['smallIcons', 'Show small icons in Start menu'],
                    ['showClock', 'Show Clock'],
                  ] as const
                ).map(([key, label]) => (
                  <Checkbox
                    key={key}
                    label={label}
                    checked={draft[key]}
                    onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-[16px]">
              <p>You can customize your Start menu by adding and removing items.</p>
              <div className="flex gap-[8px]">
                <Button onClick={() => setManage('add')}>Add...</Button>
                <Button onClick={() => setManage('remove')}>Remove...</Button>
                <Button onClick={() => folder && launch('explorer', { folder })}>Advanced...</Button>
              </div>
              <GroupBox label="Documents menu">
                <p className="mb-[12px]">Click Clear to remove the contents of the Documents menu.</p>
                <Button onClick={clearDocuments}>Clear</Button>
              </GroupBox>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-[6px] pt-[10px]">
          <Button
            isDefault
            onClick={() => {
              apply()
              onClose()
            }}
          >
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button disabled={JSON.stringify(settings) === JSON.stringify(draft)} onClick={apply}>
            Apply
          </Button>
        </div>
      </div>
      {manage && (
        <Dialog
          title={manage === 'add' ? 'Create Shortcut' : 'Remove Shortcuts/Folders'}
          onClose={() => setManage(null)}
          className="w-[330px]"
        >
          <div className="p-[12px] flex flex-col gap-[10px]">
            {manage === 'add' ? (
              <>
                <p>Type the program to add to Programs\StartUp.</p>
                <TextBox
                  aria-label="Command line"
                  autoFocus
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                />
                <div className="flex justify-end gap-[6px]">
                  <Button
                    onClick={() => {
                      const app = findAppByExe(command)
                      if (!app || !folder) {
                        setError(`Cannot find the file '${command}'.`)
                        return
                      }
                      const created = createNode(folder, app.title, { kind: 'shortcut', app: app.id })
                      if ('error' in created) setError(created.error)
                      else setManage(null)
                    }}
                  >
                    Finish
                  </Button>
                  <Button onClick={() => setManage(null)}>Cancel</Button>
                </div>
              </>
            ) : (
              <>
                <p>Select a shortcut to remove.</p>
                <div className="bg-white bevel-sunken p-[3px] min-h-[80px]">
                  {items.length
                    ? items.map((node) => (
                        <button
                          key={node.id}
                          type="button"
                          className="block w-full text-left px-[3px] focus:bg-select focus:text-white"
                          onClick={() => fs.purge(node.id)}
                        >
                          {node.name}
                        </button>
                      ))
                    : '(Empty)'}
                </div>
                <Button onClick={() => setManage(null)}>Close</Button>
              </>
            )}
          </div>
        </Dialog>
      )}
      {error && (
        <MessageBox
          title="Windows"
          buttons={['OK']}
          message={error}
          icon="error"
          onClose={() => setError(null)}
        />
      )}
    </Dialog>
  )
}
