import { useEffect, useMemo, useRef, useState } from 'react'
import { isInside, isProtected, pathOf, resolvePath, uniqueName } from '../../fs/fs'
import { createNode, fs, fsStore, newNodeId, useFs } from '../../fs/store'
import { DESKTOP_DIR, DOCUMENTS_DIR, type FsNode, type NodeId, RECYCLED_DIR } from '../../fs/types'
import { useStore } from '../../lib/store'
import { type Clip, clipboard, type Plan, planPaste, planShortcuts } from '../../shell/clipboard'
import { useKeyDown } from '../../shell/context'
import { backgroundMenu, type DesktopActions, type MenuFacts, nodeMenu } from '../../shell/desktopMenus'
import { nodeIcon } from '../../shell/nodeIcon'
import { getApp } from '../../shell/registry'
import { launch, openNode } from '../../shell/system'
import type { WindowApi } from '../../shell/types'
import {
  Button,
  ComboBox,
  ContextMenu,
  Dialog,
  MenuBar,
  MessageBox,
  PropertiesSheet,
  StatusBar,
  StatusPane,
  TextBox,
} from '../../ui'
import type { MenuEntry } from '../../ui/Menu'
import { FolderTree, treeIcon } from './FolderTree'
import { history, planUndo, remember } from './history'
import {
  cellValue,
  columns,
  emptySelection,
  type Location,
  type Selection,
  type Sort,
  selectNode,
  type View,
  visibleNodes,
} from './model'
import { toolbarIcons } from './toolbar'
import { folderTree, treeRows } from './tree'
import './explorer.css'

const views: readonly { id: View; label: string }[] = [
  { id: 'large', label: '&Large Icons' },
  { id: 'small', label: '&Small Icons' },
  { id: 'list', label: '&List' },
  { id: 'details', label: '&Details' },
]
type Prompt =
  | { kind: 'error'; title?: string; message: string }
  | { kind: 'confirm'; action: 'recycle' | 'purge' | 'empty'; ids: readonly NodeId[] }
  | { kind: 'properties'; node: FsNode }
  | { kind: 'help' }
  | { kind: 'goto' }

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

export function FolderView({
  initial,
  window,
  exploring = false,
}: {
  initial: Location
  window: WindowApi
  exploring?: boolean
}) {
  const state = useFs((s) => s)
  const clip = useStore(clipboard, (s) => s)
  const undoStack = useStore(history, (s) => s)
  const list = useRef<HTMLDivElement>(null)
  const [location, setLocation] = useState(initial)
  const [view, setView] = useState<View>(initial.kind === 'recycle' ? 'details' : 'large')
  const [sort, setSort] = useState<Sort>({ column: 'name', direction: 'ascending' })
  const [selection, setSelection] = useState<Selection>(emptySelection)
  const [renaming, setRenaming] = useState<NodeId | null>(null)
  const [status, setStatus] = useState(true)
  const [toolbar, setToolbar] = useState(exploring)
  const [treeWidth, setTreeWidth] = useState(190)
  const [context, setContext] = useState<{ x: number; y: number; id: NodeId | null } | null>(null)
  const [goPath, setGoPath] = useState('')
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
  const path = folder ? pathOf(state, folder.id) : title
  useEffect(() => setTitle(exploring ? `Exploring - ${path}` : title), [setTitle, title, path, exploring])
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
    const before = fs.get()
    const error = fs.rename(node.id, name)
    if (error)
      setPrompt({
        kind: 'error',
        title: 'Error Renaming File',
        message: error.startsWith('Cannot rename') ? error : `Cannot rename ${node.name}: ${error}`,
      })
    else remember(before, fs.get(), 'Rename')
  }
  const navigate = (next: Location) => {
    setLocation(next)
    setSelection(emptySelection)
    setRenaming(null)
  }
  const open = (node: FsNode) => {
    if (recycled) {
      setPrompt({ kind: 'properties', node })
      return
    }
    if (node.kind === 'folder' || node.kind === 'drive') {
      if (exploring) navigate({ kind: 'folder', id: node.id })
      else launch('mycomputer', { folder: node.id })
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
    if (writable && mutable) clipboard.dispatch({ op: 'cut', ids: selected.map((node) => node.id) })
  }
  const copySelected = () => {
    if (!recycled && selected.length) clipboard.dispatch({ op: 'copy', ids: selected.map((node) => node.id) })
  }
  const carry = (plan: Plan, label?: string) => {
    if (!plan.ok) {
      setPrompt({ kind: 'error', title: plan.title, message: plan.message })
      return false
    }
    const before = fs.get()
    for (const action of plan.actions) fsStore.dispatch(action)
    if (label) remember(before, fs.get(), label)
    if (plan.created.length)
      setSelection({
        ids: new Set(plan.created),
        anchor: plan.created[0] ?? null,
        focus: plan.created[0] ?? null,
      })
    return plan.actions.length > 0
  }
  const paste = (destination = folder?.id, source: Clip = clipboard.get()) => {
    if (!destination || recycled) return
    const done = carry(
      planPaste(fs.get(), source, destination, Date.now(), newNodeId),
      source?.op === 'cut' ? 'Move' : undefined,
    )
    if (done && source?.op === 'cut') clipboard.dispatch(null)
  }
  const shortcuts = (ids: readonly NodeId[], destination = folder?.id) => {
    if (destination)
      carry(
        planShortcuts(
          fs.get(),
          ids.map((id) => ({ kind: 'node', id })),
          destination,
          Date.now(),
          newNodeId,
        ),
      )
  }
  const undo = () => {
    const entry = history.get().at(-1)
    if (!entry) return
    const plan = planUndo(fs.get(), entry, Date.now())
    if (!plan.ok) setPrompt({ kind: 'error', title: 'Undo', message: plan.message })
    else {
      for (const action of plan.actions) fsStore.dispatch(action)
      history.dispatch(history.get().slice(0, -1))
    }
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
    if (event.key === 'Enter' && event.altKey) {
      event.preventDefault()
      if (single) setPrompt({ kind: 'properties', node: single })
      return
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
    if (event.ctrlKey && key === 'c') {
      event.preventDefault()
      copySelected()
    }
    if (event.ctrlKey && key === 'z') {
      event.preventDefault()
      undo()
    }
    if (event.ctrlKey && key === 'v') {
      event.preventDefault()
      paste()
    }
  })

  const actionsFor = (id: NodeId | null): DesktopActions => {
    const node = id ? state.nodes[id] : undefined
    const scope = node ? (selection.ids.has(node.id) ? selected : [node]) : selected
    const ids = scope.map((item) => item.id)
    const destination = node && (node.kind === 'folder' || node.kind === 'drive') ? node.id : folder?.id
    return {
      open: () => scope.forEach(open),
      explore: () => destination && launch('explorer', { folder: destination }),
      find: () => launch('find', destination ? { folder: destination } : {}),
      cut: () => clipboard.dispatch({ op: 'cut', ids }),
      copy: () => clipboard.dispatch({ op: 'copy', ids }),
      paste: () => paste(destination),
      pasteShortcut: () => shortcuts(clip?.ids ?? []),
      createShortcut: () => shortcuts(ids),
      remove: () => setPrompt({ kind: 'confirm', action: recycled ? 'purge' : 'recycle', ids }),
      rename: () => node && setRenaming(node.id),
      properties: () => {
        const target = node ?? folder
        if (target) setPrompt({ kind: 'properties', node: target })
      },
      sendToDocuments: () => paste(DOCUMENTS_DIR, { op: 'copy', ids }),
      sendToDesktop: () => shortcuts(ids, DESKTOP_DIR),
      emptyRecycleBin: () =>
        setPrompt({ kind: 'confirm', action: 'empty', ids: nodes.map((item) => item.id) }),
      arrange: (by) => setSort({ column: by === 'date' ? 'modified' : by, direction: 'ascending' }),
      toggleAutoArrange: () => {},
      lineUp: () => {},
      newFolder: () => create('folder'),
      newShortcut: () => shortcuts(clip?.ids ?? []),
      newTextDocument: () => create('file'),
      desktopProperties: () => folder && setPrompt({ kind: 'properties', node: folder }),
    }
  }
  const menuFor = (id: NodeId | null): MenuEntry[] => {
    const node = id ? state.nodes[id] : undefined
    const act = actionsFor(id)
    const facts: MenuFacts = {
      canPaste: Boolean(clip?.ids.length && (writable || node?.kind === 'drive')),
      autoArrange: true,
      binEmpty: !nodes.length,
      canFind: Boolean(getApp('find')),
      single: !node || !selection.ids.has(node.id) || selected.length === 1,
      mutable: Boolean(node && !isProtected(node.id)),
      hasProperties: Boolean(node),
    }
    if (recycled && node)
      return [
        { label: '&Restore', bold: true, onSelect: restore },
        { label: '&Delete', onSelect: act.remove },
        'separator',
        { label: 'P&roperties', onSelect: act.properties },
      ]
    if (node) return nodeMenu(node, facts, act)
    return [
      {
        label: '&View',
        items: views.map((item) => ({
          label: item.label,
          checked: view === item.id,
          onSelect: () => setView(item.id),
        })),
      },
      ...backgroundMenu(facts, act).slice(0, 6),
      {
        label: `&Undo${undoStack.at(-1) ? ` ${undoStack.at(-1)?.label}` : ''}`,
        disabled: !undoStack.length,
        onSelect: undo,
      },
      ...backgroundMenu(facts, act).slice(6),
    ]
  }
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
          bold: true,
          disabled: !selected.length,
          onSelect: () => {
            for (const node of selected) open(node)
          },
        },
        {
          label: '&Explore',
          disabled: !single || (single.kind !== 'folder' && single.kind !== 'drive'),
          onSelect: () => single && launch('explorer', { folder: single.id }),
        },
        {
          label: '&Find...',
          disabled: !getApp('find') || !single,
          onSelect: () => single && launch('find', { folder: single.id }),
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
              {
                label: `&Undo${undoStack.at(-1) ? ` ${undoStack.at(-1)?.label}` : ''}`,
                shortcut: 'Ctrl+Z',
                disabled: !undoStack.length,
                onSelect: undo,
              },
              'separator',
              { label: 'Cu&t', shortcut: 'Ctrl+X', disabled: !writable || !mutable, onSelect: cutSelected },
              {
                label: '&Copy',
                shortcut: 'Ctrl+C',
                disabled: !selected.length || recycled,
                onSelect: copySelected,
              },
              {
                label: '&Paste',
                shortcut: 'Ctrl+V',
                disabled: !writable || !clip?.ids.length,
                onSelect: () => paste(),
              },
              {
                label: 'Paste &Shortcut',
                disabled: !writable || !clip?.ids.length,
                onSelect: () => shortcuts(clip?.ids ?? []),
              },
              'separator',
              { label: 'Select &All', shortcut: 'Ctrl+A', onSelect: selectAll },
            ],
          },
          {
            label: '&View',
            items: [
              { label: '&Toolbar', checked: toolbar, onSelect: () => setToolbar(!toolbar) },
              { label: 'Status &Bar', checked: status, onSelect: () => setStatus(!status) },
              'separator',
              ...views.map((item) => ({
                label: item.label,
                checked: view === item.id,
                onSelect: () => setView(item.id),
              })),
              'separator',
            ],
          },
          ...(exploring
            ? [
                {
                  label: '&Tools',
                  items: [
                    {
                      label: '&Find',
                      items: [
                        {
                          label: '&Files or Folders...',
                          disabled: !getApp('find'),
                          onSelect: () => launch('find', folder ? { folder: folder.id } : {}),
                        },
                      ],
                    },
                    {
                      label: '&Go to...',
                      onSelect: () => {
                        setGoPath(path)
                        setPrompt({ kind: 'goto' })
                      },
                    },
                  ],
                },
              ]
            : []),
          {
            label: '&Help',
            items: [{ label: '&About Windows 95', onSelect: () => setPrompt({ kind: 'help' }) }],
          },
        ]}
      />
      {toolbar && (
        <div className="explorer-toolbar">
          <ComboBox
            aria-label="Folder"
            className="w-[150px] shrink-0"
            value={location.kind === 'folder' ? location.id : location.kind}
            options={treeRows(folderTree(state), new Set(['desktop', 'computer', 'c'])).map((row) => ({
              key: row.key,
              label: row.label,
              icon: treeIcon(row),
              indent: row.depth,
            }))}
            onChange={(key) => {
              const row = treeRows(
                folderTree(state),
                new Set(Object.keys(state.nodes).concat(['desktop', 'computer'])),
              ).find((item) => item.key === key)
              if (row?.location) navigate(row.location)
            }}
          />
          {[
            { label: 'Up One Level', text: '↰', disabled: location.kind !== 'folder', run: up },
            { label: 'Cut', text: '✂', disabled: !mutable || !writable, run: cutSelected },
            { label: 'Copy', text: '▤', disabled: !selected.length || recycled, run: copySelected },
            { label: 'Paste', text: '▣', disabled: !writable || !clip, run: () => paste() },
            { label: 'Undo', text: '↶', disabled: !undoStack.length, run: undo },
            { label: 'Delete', text: '×', disabled: !mutable, run: deleteSelected },
            {
              label: 'Properties',
              text: '☷',
              disabled: !single,
              run: () => single && setPrompt({ kind: 'properties', node: single }),
            },
            ...views.map((item) => ({
              label: item.label.replace('&', ''),
              text: { large: '▦', small: '▦', list: '☰', details: '▤' }[item.id],
              disabled: false,
              run: () => setView(item.id),
            })),
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              aria-label={item.label}
              title={item.label}
              className="bevel-raised"
              disabled={item.disabled}
              onClick={item.run}
            >
              <img src={toolbarIcons[item.label]} alt="" draggable={false} />
            </button>
          ))}
        </div>
      )}
      <div className="explorer-body">
        {exploring && (
          <>
            <div className="explorer-tree-pane" style={{ width: treeWidth }}>
              <div className="explorer-pane-heading">All Folders</div>
              <FolderTree
                state={state}
                location={location}
                onChoose={(entry) => {
                  if (entry.location) navigate(entry.location)
                  else launch(entry.key)
                }}
              />
            </div>
            <hr
              aria-label="Folder pane width"
              aria-orientation="vertical"
              aria-valuenow={treeWidth}
              tabIndex={0}
              className="explorer-splitter"
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') setTreeWidth(Math.max(100, treeWidth - 10))
                if (event.key === 'ArrowRight') setTreeWidth(treeWidth + 10)
              }}
              onPointerDown={(event) => {
                const start = event.clientX
                const width = treeWidth
                const target = event.currentTarget
                target.setPointerCapture(event.pointerId)
                const move = (e: PointerEvent) =>
                  setTreeWidth(
                    Math.max(
                      100,
                      Math.min(width + e.clientX - start, (target.parentElement?.clientWidth ?? 600) - 120),
                    ),
                  )
                const end = () => {
                  target.removeEventListener('pointermove', move)
                  target.removeEventListener('pointerup', end)
                }
                target.addEventListener('pointermove', move)
                target.addEventListener('pointerup', end)
              }}
            />
          </>
        )}
        <div className="explorer-content-pane">
          {exploring && <div className="explorer-pane-heading">Contents of '{path}'</div>}
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
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setContext({ x: event.clientX, y: event.clientY, id: null })
              }}
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
                  className={`explorer-item ${selection.ids.has(node.id) ? 'selected' : ''} ${clip?.op === 'cut' && clip.ids.includes(node.id) ? 'cut' : ''}`}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (!selection.ids.has(node.id))
                      setSelection({ ids: new Set([node.id]), anchor: node.id, focus: node.id })
                    setContext({ x: event.clientX, y: event.clientY, id: node.id })
                  }}
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
        </div>
      </div>
      {context && <ContextMenu at={context} items={menuFor(context.id)} onClose={() => setContext(null)} />}
      {status && (
        <StatusBar className="shrink-0">
          <StatusPane className="flex-1">{nodes.length} object(s)</StatusPane>
        </StatusBar>
      )}
      {prompt?.kind === 'error' && (
        <MessageBox
          title={prompt.title ?? 'Windows Explorer'}
          message={prompt.message}
          icon="error"
          buttons={['OK']}
          onClose={() => setPrompt(null)}
        />
      )}
      {prompt?.kind === 'goto' && (
        <Dialog title="Go to Folder" onClose={() => setPrompt(null)}>
          <form
            className="p-3 flex flex-col gap-3 w-[320px]"
            onSubmit={(event) => {
              event.preventDefault()
              const target = resolvePath(fs.get(), goPath)
              if (target && (target.kind === 'folder' || target.kind === 'drive')) {
                navigate({ kind: 'folder', id: target.id })
                setPrompt(null)
              } else
                setPrompt({
                  kind: 'error',
                  title: 'Go to Folder',
                  message: `Cannot find '${goPath}'. Make sure the path is correct.`,
                })
            }}
          >
            <label htmlFor={`goto-${window.id}`} className="flex gap-2 items-center">
              Open:{' '}
              <TextBox
                id={`goto-${window.id}`}
                aria-label="Go to folder"
                value={goPath}
                onChange={(event) => setGoPath(event.target.value)}
                className="flex-1"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="submit" isDefault>
                OK
              </Button>
              <Button onClick={() => setPrompt(null)}>Cancel</Button>
            </div>
          </form>
        </Dialog>
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
              else {
                const before = fs.get()
                for (const id of prompt.ids) {
                  if (prompt.action === 'recycle') fs.recycle(id)
                  else fs.purge(id)
                }
                if (prompt.action === 'recycle') remember(before, fs.get(), 'Delete')
              }
              setSelection(emptySelection)
            }
            setPrompt(null)
          }}
        />
      )}
      {prompt?.kind === 'properties' && (
        <PropertiesSheet id={prompt.node.id} onClose={() => setPrompt(null)} />
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
