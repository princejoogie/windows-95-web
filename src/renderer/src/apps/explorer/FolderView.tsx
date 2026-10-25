import { useEffect, useMemo, useRef, useState } from 'react'
import { isInside, isProtected, pathOf, uniqueName, validateName } from '../../fs/fs'
import { createNode, fs, useFs } from '../../fs/store'
import { type FsNode, type NodeId, RECYCLED_DIR } from '../../fs/types'
import { createStore, useStore } from '../../lib/store'
import { useKeyDown } from '../../shell/context'
import { nodeIcon } from '../../shell/nodeIcon'
import { openNode } from '../../shell/system'
import type { WindowApi } from '../../shell/types'
import { Button, Dialog, MenuBar, MessageBox, StatusBar, StatusPane } from '../../ui'
import type { MenuEntry } from '../../ui/Menu'
import {
  cellValue,
  columns,
  emptySelection,
  formatDate,
  type Location,
  type Selection,
  type Sort,
  selectNode,
  sizeOf,
  typeOf,
  type View,
  visibleNodes,
} from './model'
import './explorer.css'

const clipboard = createStore<readonly NodeId[], readonly NodeId[]>((_state, ids) => ids, [])
const views: readonly { id: View; label: string }[] = [
  { id: 'large', label: '&Large Icons' },
  { id: 'small', label: '&Small Icons' },
  { id: 'list', label: '&List' },
  { id: 'details', label: '&Details' },
]
type Prompt =
  | { kind: 'error'; message: string }
  | { kind: 'confirm'; action: 'recycle' | 'purge' | 'empty'; ids: readonly NodeId[] }
  | { kind: 'properties'; node: FsNode }
  | { kind: 'help' }

function Rename({ node, finish }: { node: FsNode; finish: (name: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])
  const commit = (name: string | null) => {
    if (done.current) return
    done.current = true
    finish(name)
  }
  return (
    <input
      ref={input}
      aria-label="Rename"
      defaultValue={node.name}
      className="explorer-rename"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter' || event.key === 'Escape') event.preventDefault()
        if (event.key === 'Enter') commit(event.currentTarget.value)
        if (event.key === 'Escape') commit(null)
      }}
      onBlur={(event) => commit(event.currentTarget.value)}
    />
  )
}

export function FolderView({ initial, window }: { initial: Location; window: WindowApi }) {
  const state = useFs((s) => s)
  const cut = useStore(clipboard, (s) => s)
  const list = useRef<HTMLDivElement>(null)
  const [location, setLocation] = useState(initial)
  const [view, setView] = useState<View>(initial.kind === 'recycle' ? 'details' : 'large')
  const [sort, setSort] = useState<Sort>({ column: 'name', direction: 'ascending' })
  const [selection, setSelection] = useState<Selection>(emptySelection)
  const [renaming, setRenaming] = useState<NodeId | null>(null)
  const [status, setStatus] = useState(true)
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const nodes = useMemo(() => visibleNodes(state, location, sort), [state, location, sort])
  const selected = nodes.filter((node) => selection.ids.has(node.id))
  const single = selected.length === 1 ? selected[0] : undefined
  const folder = location.kind === 'folder' ? state.nodes[location.id] : undefined
  const writable =
    folder &&
    (folder.kind === 'drive' || folder.kind === 'folder') &&
    !isInside(state, folder.id, RECYCLED_DIR)
  const recycled = location.kind === 'recycle'
  const title =
    location.kind === 'computer' ? 'My Computer' : recycled ? 'Recycle Bin' : (folder?.name ?? 'Folder')
  const setTitle = window.setTitle
  useEffect(() => setTitle(title), [setTitle, title])
  const detailColumns = columns.filter(
    (column) => recycled || (column.id !== 'original' && column.id !== 'deleted'),
  )
  const mutable = selected.length > 0 && selected.every((node) => !isProtected(node.id))

  const selectAll = () =>
    setSelection({
      ids: new Set(nodes.map((node) => node.id)),
      anchor: nodes[0]?.id ?? null,
      focus: nodes[0]?.id ?? null,
    })
  const rename = () => {
    if (writable && single && !isProtected(single.id)) setRenaming(single.id)
  }
  const finishRename = (node: FsNode, name: string | null) => {
    setRenaming(null)
    if (name === null) return
    const error = fs.rename(node.id, name)
    if (error) setPrompt({ kind: 'error', message: error })
  }
  const open = (node: FsNode) => {
    if (recycled) {
      setPrompt({ kind: 'properties', node })
      return
    }
    if (!openNode(node.id))
      setPrompt({ kind: 'error', message: `There is no program associated with '${node.name}'.` })
  }
  const up = () => {
    if (location.kind !== 'folder') return
    const parent = folder?.parent
    setLocation(parent ? { kind: 'folder', id: parent } : { kind: 'computer' })
    setSelection(emptySelection)
    setRenaming(null)
  }
  const create = (kind: 'folder' | 'file') => {
    if (!writable) return
    const result = createNode(
      folder.id,
      uniqueName(fs.get(), folder.id, kind === 'folder' ? 'New Folder' : 'New Text Document.txt'),
      kind === 'folder' ? { kind } : { kind, content: '' },
    )
    if ('error' in result) {
      setPrompt({ kind: 'error', message: result.error })
      return
    }
    setSelection({ ids: new Set([result.id]), anchor: result.id, focus: result.id })
    setRenaming(result.id)
  }
  const deleteSelected = () => {
    if (!mutable || (!recycled && !writable)) return
    setPrompt({
      kind: 'confirm',
      action: recycled ? 'purge' : 'recycle',
      ids: selected.map((node) => node.id),
    })
  }
  const cutSelected = () => {
    if (writable && mutable) clipboard.dispatch(selected.map((node) => node.id))
  }
  const paste = () => {
    if (!writable) return
    const remaining: NodeId[] = []
    const errors: string[] = []
    for (const id of cut) {
      const current = fs.get()
      const node = current.nodes[id]
      if (!node || isInside(current, id, RECYCLED_DIR)) continue
      const error = isInside(current, folder.id, id)
        ? 'You cannot move a folder into itself or one of its subfolders.'
        : validateName(current, folder.id, node.name, node.id)
      if (error) {
        remaining.push(id)
        errors.push(error)
        continue
      }
      fs.move(id, folder.id)
    }
    clipboard.dispatch(remaining)
    if (errors.length) setPrompt({ kind: 'error', message: errors.join('\n') })
  }
  const restore = () => {
    for (const node of selected) fs.restore(node.id)
    setSelection(emptySelection)
  }

  useKeyDown((event) => {
    if (
      prompt ||
      renaming ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    )
      return
    if (
      event.target instanceof Element &&
      event.target.closest('[role="menubar"], [role="menu"], [role="dialog"]')
    )
      return
    const key = event.key.toLowerCase()
    if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const current = nodes.findIndex((node) => node.id === selection.focus)
      const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight'
      const index =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? nodes.length - 1
            : Math.max(0, Math.min(nodes.length - 1, current + (forward ? 1 : -1)))
      const node = nodes[index]
      if (node) {
        setSelection(
          selectNode({
            selection,
            order: nodes.map((n) => n.id),
            id: node.id,
            ctrl: false,
            shift: event.shiftKey,
          }),
        )
        list.current?.children[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    }
    if (event.key === 'Backspace') {
      event.preventDefault()
      up()
    }
    if (event.key === 'F2') {
      event.preventDefault()
      rename()
    }
    if (event.key === 'Delete') {
      event.preventDefault()
      deleteSelected()
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      for (const node of selected) open(node)
    }
    if (event.ctrlKey && key === 'a') {
      event.preventDefault()
      selectAll()
    }
    if (event.ctrlKey && key === 'x') {
      event.preventDefault()
      cutSelected()
    }
    if (event.ctrlKey && key === 'v') {
      event.preventDefault()
      paste()
    }
  })

  const fileItems: MenuEntry[] = recycled
    ? [
        { label: '&Restore', disabled: !selected.length, onSelect: restore },
        {
          label: '&Empty Recycle Bin',
          disabled: !nodes.length,
          onSelect: () => setPrompt({ kind: 'confirm', action: 'empty', ids: [] }),
        },
        { label: '&Delete', disabled: !mutable, shortcut: 'Del', onSelect: deleteSelected },
      ]
    : [
        {
          label: '&Open',
          disabled: !selected.length,
          onSelect: () => {
            for (const node of selected) open(node)
          },
        },
        {
          label: '&New',
          disabled: !writable,
          items: [
            { label: '&Folder', onSelect: () => create('folder') },
            { label: '&Text Document', onSelect: () => create('file') },
          ],
        },
        'separator',
        { label: '&Delete', disabled: !writable || !mutable, shortcut: 'Del', onSelect: deleteSelected },
        { label: 'Rena&me', disabled: !writable || !single || !mutable, shortcut: 'F2', onSelect: rename },
      ]
  fileItems.push(
    'separator',
    {
      label: 'P&roperties',
      disabled: !single,
      onSelect: () => single && setPrompt({ kind: 'properties', node: single }),
    },
    'separator',
    { label: '&Close', onSelect: window.close },
  )

  const renderName = (node: FsNode) => {
    const icon = nodeIcon(node)
    return (
      <>
        <span className="explorer-icon">
          <img src={icon.icon} alt="" draggable={false} />
          {icon.overlay && <img className="explorer-overlay" src={icon.overlay} alt="" draggable={false} />}
        </span>
        {renaming === node.id ? (
          <Rename node={node} finish={(name) => finishRename(node, name)} />
        ) : (
          <span className="explorer-name">{node.name}</span>
        )}
      </>
    )
  }

  return (
    <div className="explorer h-full w-full flex flex-col" data-location={title}>
      <MenuBar
        menus={[
          { label: '&File', items: fileItems },
          {
            label: '&Edit',
            items: [
              { label: 'Cu&t', shortcut: 'Ctrl+X', disabled: !writable || !mutable, onSelect: cutSelected },
              { label: '&Paste', shortcut: 'Ctrl+V', disabled: !writable || !cut.length, onSelect: paste },
              'separator',
              { label: 'Select &All', shortcut: 'Ctrl+A', onSelect: selectAll },
            ],
          },
          {
            label: '&View',
            items: [
              ...views.map((item) => ({
                label: item.label,
                checked: view === item.id,
                onSelect: () => setView(item.id),
              })),
              'separator',
              { label: 'Status &Bar', checked: status, onSelect: () => setStatus(!status) },
            ],
          },
          {
            label: '&Help',
            items: [{ label: '&About Windows 95', onSelect: () => setPrompt({ kind: 'help' }) }],
          },
        ]}
      />
      <div className={`explorer-files explorer-${view} bevel-sunken`}>
        {view === 'details' && (
          <div
            className="explorer-head"
            style={{ minWidth: detailColumns.reduce((sum, c) => sum + c.width, 0) }}
          >
            {detailColumns.map((column) => (
              <button
                type="button"
                key={column.id}
                className="bevel-raised"
                style={{ width: column.width }}
                aria-label={`Sort by ${column.label}`}
                onClick={() =>
                  setSort({
                    column: column.id,
                    direction:
                      sort.column === column.id && sort.direction === 'ascending'
                        ? 'descending'
                        : 'ascending',
                  })
                }
              >
                {column.label}
              </button>
            ))}
          </div>
        )}
        <div
          ref={list}
          role="listbox"
          aria-label={`${title} contents`}
          aria-multiselectable="true"
          tabIndex={0}
          className="explorer-items"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelection(emptySelection)
          }}
        >
          {nodes.map((node) => (
            <div
              role="option"
              tabIndex={-1}
              key={node.id}
              aria-label={node.name}
              aria-selected={selection.ids.has(node.id)}
              data-node-id={node.id}
              className={`explorer-item ${selection.ids.has(node.id) ? 'selected' : ''} ${cut.includes(node.id) ? 'cut' : ''}`}
              onClick={(event) =>
                setSelection(
                  selectNode({
                    selection,
                    order: nodes.map((n) => n.id),
                    id: node.id,
                    ctrl: event.ctrlKey,
                    shift: event.shiftKey,
                  }),
                )
              }
              onDoubleClick={() => open(node)}
              onKeyDown={(event) => {
                if (event.key !== ' ') return
                event.preventDefault()
                setSelection(
                  selectNode({
                    selection,
                    order: nodes.map((n) => n.id),
                    id: node.id,
                    ctrl: event.ctrlKey,
                    shift: event.shiftKey,
                  }),
                )
              }}
            >
              {view === 'details'
                ? detailColumns.map((column) => (
                    <span
                      key={column.id}
                      className={`explorer-cell ${column.id === 'name' ? 'explorer-label' : ''}`}
                      style={{ width: column.width }}
                    >
                      {column.id === 'name' ? renderName(node) : cellValue(state, node, column.id)}
                    </span>
                  ))
                : renderName(node)}
            </div>
          ))}
        </div>
      </div>
      {status && (
        <StatusBar className="shrink-0">
          <StatusPane className="flex-1">{nodes.length} object(s)</StatusPane>
        </StatusBar>
      )}
      {prompt?.kind === 'error' && (
        <MessageBox
          title="Windows Explorer"
          message={prompt.message}
          icon="error"
          buttons={['OK']}
          onClose={() => setPrompt(null)}
        />
      )}
      {prompt?.kind === 'confirm' && (
        <MessageBox
          title="Confirm File Delete"
          icon="question"
          message={
            prompt.action === 'recycle'
              ? `Are you sure you want to send ${prompt.ids.length === 1 && prompt.ids[0] ? `'${state.nodes[prompt.ids[0]]?.name ?? 'this item'}'` : `these ${prompt.ids.length} items`} to the Recycle Bin?`
              : prompt.action === 'empty'
                ? 'Are you sure you want to permanently delete all items in the Recycle Bin?'
                : `Are you sure you want to permanently delete ${prompt.ids.length} item(s)?`
          }
          buttons={['Yes', 'No']}
          onClose={(answer) => {
            if (answer === 'Yes') {
              if (prompt.action === 'empty') fs.emptyRecycleBin()
              else
                for (const id of prompt.ids) {
                  if (prompt.action === 'recycle') fs.recycle(id)
                  else fs.purge(id)
                }
              setSelection(emptySelection)
            }
            setPrompt(null)
          }}
        />
      )}
      {prompt?.kind === 'properties' && (
        <Dialog title={`${prompt.node.name} Properties`} onClose={() => setPrompt(null)}>
          <dl className="explorer-properties">
            <dt>Name</dt>
            <dd>{prompt.node.name}</dd>
            <dt>Type</dt>
            <dd>{typeOf(prompt.node)}</dd>
            <dt>Location</dt>
            <dd>{prompt.node.parent ? pathOf(state, prompt.node.parent) : 'My Computer'}</dd>
            <dt>Size</dt>
            <dd>{sizeOf(prompt.node)} bytes</dd>
            <dt>Modified</dt>
            <dd>{formatDate(prompt.node.modified)}</dd>
          </dl>
          <div className="p-2 text-right">
            <Button onClick={() => setPrompt(null)}>OK</Button>
          </div>
        </Dialog>
      )}
      {prompt?.kind === 'help' && (
        <MessageBox
          title="About Windows 95"
          icon="info"
          message={
            'Microsoft Windows 95\nWindows Explorer\n\nSelect an item to work with it. Double-click to open it. Press Backspace to go up one level.'
          }
          buttons={['OK']}
          onClose={() => setPrompt(null)}
        />
      )}
    </div>
  )
}
