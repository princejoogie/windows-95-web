import { useState } from 'react'
import { children, isInside, pathOf, resolvePath } from '../fs/fs'
import { useFs } from '../fs/store'
import { type NodeId, RECYCLED_DIR, WINDOWS_DIR } from '../fs/types'
import { icons } from '../icons'
import { Button, Dialog, TextBox } from '../ui'
import { MenuList } from '../ui/Menu'
import { isHidden } from '../ui/properties'
import { launch } from './system'

export function RunBrowse({ onSelect, onClose }: { onSelect: (path: string) => void; onClose: () => void }) {
  const state = useFs((state) => state)
  const [folder, setFolder] = useState(WINDOWS_DIR)
  const [name, setName] = useState('')
  const [all, setAll] = useState(false)
  const [drop, setDrop] = useState<'folder' | 'type' | null>(null)
  const [hot, setHot] = useState<NodeId | null>(null)
  const entries = children(state, folder).filter(
    (node) =>
      !isHidden(node) &&
      (node.kind === 'folder' ||
        node.kind === 'program' ||
        (node.kind === 'file' && (all || /\.(exe|com|pif|bat)$/i.test(node.name)))),
  )
  const open = (id: NodeId) => {
    const node = state.nodes[id]
    if (!node) return
    if (node.kind === 'folder' || node.kind === 'drive') {
      setFolder(id)
      setName('')
    } else onSelect(pathOf(state, id))
  }
  const submit = () => {
    const node = resolvePath(state, /^[a-z]:/i.test(name) ? name : `${pathOf(state, folder)}\\${name}`)
    if (node) open(node.id)
  }
  return (
    <Dialog title="Browse" onClose={onClose} onHelp={() => launch('help')} className="w-[450px]">
      <form
        className="p-[10px] flex flex-col gap-[8px]"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div className="flex items-center gap-[8px]">
          <span className="w-[65px]">Look in:</span>
          <div className="relative flex-1">
            <button
              type="button"
              aria-label="Look in"
              className="w-full h-[22px] bg-white bevel-sunken text-left px-[4px]"
              onClick={() => setDrop(drop === 'folder' ? null : 'folder')}
            >
              {pathOf(state, folder)}
              <span className="float-right">▼</span>
            </button>
            {drop === 'folder' && (
              <MenuList
                items={Object.values(state.nodes)
                  .filter(
                    (node) =>
                      (node.kind === 'drive' || node.kind === 'folder') &&
                      !isHidden(node) &&
                      !isInside(state, node.id, RECYCLED_DIR),
                  )
                  .map((node) => ({
                    label: pathOf(state, node.id),
                    icon: icons.small.folderClosed,
                    onSelect: () => {
                      setFolder(node.id)
                      setName('')
                    },
                  }))}
                onClose={() => setDrop(null)}
                style={{ top: '100%', left: 0 }}
              />
            )}
          </div>
          <Button
            className="min-w-0! w-[23px]! p-0!"
            aria-label="Up one level"
            disabled={!state.nodes[folder]?.parent}
            onClick={() => {
              const parent = state.nodes[folder]?.parent
              if (parent) setFolder(parent)
            }}
          >
            ↑
          </Button>
        </div>
        <div
          role="listbox"
          aria-label="Programs"
          tabIndex={0}
          className="bg-white bevel-sunken h-[180px] overflow-auto p-[3px]"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && hot) {
              event.preventDefault()
              open(hot)
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              const index = entries.findIndex((node) => node.id === hot)
              const node =
                entries[(index + (event.key === 'ArrowDown' ? 1 : entries.length - 1)) % entries.length]
              if (node) {
                setHot(node.id)
                setName(node.name)
              }
            }
            if (event.key === 'Backspace') {
              event.preventDefault()
              const parent = state.nodes[folder]?.parent
              if (parent) setFolder(parent)
            }
          }}
        >
          {entries.map((node) => (
            <button
              type="button"
              role="option"
              aria-selected={hot === node.id}
              key={node.id}
              className="flex gap-[4px] items-center h-[20px]"
              onClick={() => {
                setHot(node.id)
                setName(node.name)
              }}
              onDoubleClick={() => open(node.id)}
            >
              <img
                src={node.kind === 'folder' ? icons.small.folderClosed : icons.small.document}
                alt=""
                className="size-4"
              />
              <span className={hot === node.id ? 'bg-select text-white outline-dotted outline-1' : ''}>
                {node.name}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-[10px]">
          <div className="flex-1 flex flex-col gap-[8px]">
            <label htmlFor="browse-name" className="flex gap-[8px] items-center">
              <span className="w-[65px]">File name:</span>
              <TextBox
                aria-label="File name"
                id="browse-name"
                className="flex-1 min-w-0"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <div className="flex gap-[8px] items-center">
              <span className="w-[65px]">Files of type:</span>
              <div className="relative flex-1">
                <button
                  type="button"
                  aria-label="Files of type"
                  className="bg-white bevel-sunken h-[22px] w-full text-left px-[4px]"
                  onClick={() => setDrop('type')}
                >
                  {all ? 'All Files (*.*)' : 'Programs'}
                  <span className="float-right">▼</span>
                </button>
                {drop === 'type' && (
                  <MenuList
                    items={[
                      { label: 'Programs', onSelect: () => setAll(false) },
                      { label: 'All Files (*.*)', onSelect: () => setAll(true) },
                    ]}
                    onClose={() => setDrop(null)}
                    style={{ left: 0, top: '100%' }}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-[6px]">
            <Button type="submit" isDefault disabled={!name}>
              Open
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
