import { useMemo, useState } from 'react'
import { children, isInside, pathOf, resolvePath } from '../fs/fs'
import { createNode, fs, useFs } from '../fs/store'
import type { NodeId } from '../fs/types'
import { Button, Checkbox, ComboBox, Dialog, GroupBox, MessageBox, Tabs, TextBox } from '../ui'
import { clearDocuments } from './recent'
import { findAppByExe, getApp } from './registry'
import { startMenuFolder } from './startup'
import { launch } from './system'
import { setTaskbarSettings, useTaskbarSettings } from './taskbarSettings'

export function TaskbarProperties({ onClose }: { onClose: () => void }) {
  const settings = useTaskbarSettings()
  const [draft, setDraft] = useState(settings)
  const [tab, setTab] = useState<'Taskbar Options' | 'Start Menu Programs'>('Taskbar Options')
  const [manage, setManage] = useState<'add' | 'remove' | null>(null)
  const [command, setCommand] = useState('')
  const [error, setError] = useState<string | null>(null)
  const state = useFs((state) => state)
  const programs = useMemo(() => startMenuFolder(['Start Menu', 'Programs']), [])
  const [folder, setFolder] = useState(startMenuFolder)
  const [selected, setSelected] = useState<NodeId | null>(null)
  const folders = programs
    ? Object.values(state.nodes)
        .filter((node) => node.kind === 'folder' && isInside(state, node.id, programs))
        .map((node) => ({ key: node.id, label: pathOf(state, node.id) }))
    : []
  const items = folder ? children(state, folder) : []
  const apply = () => setTaskbarSettings(draft)
  return (
    <Dialog title="Taskbar Properties" onClose={onClose} className="w-[390px]">
      <div className="p-[8px]">
        <Tabs
          tabs={['Taskbar Options', 'Start Menu Programs']}
          active={tab}
          onChange={setTab}
          pageClassName="p-[12px] min-h-[250px]"
        >
          {tab === 'Taskbar Options' ? (
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
                <Button onClick={() => programs && launch('explorer', { folder: programs })}>
                  Advanced...
                </Button>
              </div>
              <GroupBox label="Documents menu">
                <p className="mb-[12px]">Click Clear to remove the contents of the Documents menu.</p>
                <Button onClick={clearDocuments}>Clear</Button>
              </GroupBox>
            </div>
          )}
        </Tabs>
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
            <label htmlFor="start-menu-folder">Select a folder:</label>
            <ComboBox
              id="start-menu-folder"
              aria-label="Start menu folder"
              options={folders}
              value={folder ?? ''}
              onChange={(id) => {
                const node = Object.values(state.nodes).find(
                  (node) => node.id === id && node.kind === 'folder',
                )
                if (node) {
                  setFolder(node.id)
                  setSelected(null)
                }
              }}
            />
            {manage === 'add' ? (
              <>
                <p>Type the program to add to the Start menu.</p>
                <TextBox
                  aria-label="Command line"
                  autoFocus
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                />
                <div className="flex justify-end gap-[6px]">
                  <Button
                    isDefault
                    onClick={() => {
                      const app = findAppByExe(command)
                      const node = resolvePath(state, command)
                      if ((!app && !node) || !folder) {
                        setError(`Cannot find the file '${command}'.`)
                        return
                      }
                      const created = node
                        ? createNode(
                            folder,
                            node.kind === 'program' ? (getApp(node.app)?.title ?? node.name) : node.name,
                            { kind: 'shortcut', target: node.id },
                          )
                        : app
                          ? createNode(folder, app.title, { kind: 'shortcut', app: app.id })
                          : null
                      if (!created) return
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
                <div
                  role="listbox"
                  aria-label="Start menu shortcuts"
                  tabIndex={0}
                  className="bg-white bevel-sunken p-[3px] h-[120px] overflow-auto"
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                    event.preventDefault()
                    const current = items.findIndex((node) => node.id === selected)
                    const next =
                      items[(current + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]
                    if (next) setSelected(next.id)
                  }}
                >
                  {items.length
                    ? items.map((node) => (
                        <button
                          key={node.id}
                          type="button"
                          role="option"
                          tabIndex={-1}
                          aria-selected={selected === node.id}
                          className={`block w-full text-left px-[3px] ${selected === node.id ? 'bg-select text-white' : ''}`}
                          onClick={() => setSelected(node.id)}
                        >
                          {node.name}
                        </button>
                      ))
                    : '(Empty)'}
                </div>
                <div className="flex justify-end gap-[6px]">
                  <Button
                    isDefault
                    disabled={selected === null}
                    onClick={() => {
                      if (selected) fs.purge(selected)
                      setSelected(null)
                    }}
                  >
                    Remove
                  </Button>
                  <Button onClick={() => setManage(null)}>Close</Button>
                </div>
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
