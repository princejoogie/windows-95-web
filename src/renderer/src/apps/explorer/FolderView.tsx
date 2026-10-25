import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  children,
  DRIVE_CAPACITY,
  driveUsed,
  fileSize,
  isInside,
  isProtected,
  pathOf,
  resolvePath,
  uniqueName,
} from '../../fs/fs'
import { createNode, fs, fsStore, newNodeId, useFs } from '../../fs/store'
import { DESKTOP_DIR, DOCUMENTS_DIR, type FsNode, type NodeId, RECYCLED_DIR } from '../../fs/types'
import { icons } from '../../icons'
import { useStore } from '../../lib/store'
import { CreateShortcut } from '../../shell/CreateShortcut'
import { type Clip, clipboard, type Plan, planPaste, planShortcuts } from '../../shell/clipboard'
import { useKeyDown } from '../../shell/context'
import { DeleteConfirmation } from '../../shell/DeleteConfirmation'
import { backgroundMenu, type DesktopActions, type MenuFacts, nodeMenu } from '../../shell/desktopMenus'
import { deletesForGood, folderOptions, useNaming } from '../../shell/folderOptions'
import { getApp } from '../../shell/registry'
import { launch, openNode, useWindows, windowsStore } from '../../shell/system'
import type { WindowApi } from '../../shell/types'
import { history, remember, undoLabel, undoLast } from '../../shell/undo'
import {
  AboutDialog,
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
import { formatSize, isHidden } from '../../ui/properties'
import { RecycleBinProperties } from '../recyclebin/Properties'
import { fileIcon, floppyIcon, printerIcon, radioDot } from './art'
import { FolderOptions } from './dialogs'
import { FolderTree, treeIcon } from './FolderTree'
import { DragGhost, useFileDrag } from './fileDrag'
import {
  cellValue,
  columns,
  emptySelection,
  type Location,
  recycleColumns,
  type Selection,
  type Sort,
  selectNode,
  type View,
  visibleNodes,
} from './model'
import { folderPreferences, saveFolderPreferences } from './preferences'
import { useRubberBand } from './rubberBand'
import { Splitter } from './Splitter'
import { toolbarIcons } from './toolbar'
import { folderTree, TREE_DESKTOP, treeRows } from './tree'
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
  | { kind: 'options' }
  | { kind: 'bin-properties' }
  | { kind: 'floppy' }
  | { kind: 'shortcut' }

function Rename({ name, finish }: { name: string; finish: (name: string | null) => void }) {
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
      defaultValue={name}
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
  select,
}: {
  initial: Location
  window: WindowApi
  exploring?: boolean
  /** Selected and scrolled into view when the window opens. */
  select?: NodeId | undefined
}) {
  const state = useFs((s) => s)
  const clip = useStore(clipboard, (s) => s)
  const undoStack = useStore(history, (s) => s)
  const settings = useStore(folderOptions, (s) => s)
  const naming = useNaming()
  const labelOf = naming.label
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const [location, setLocation] = useState(initial)
  const keyOf = (place: Location) =>
    `${exploring ? 'explore' : 'folder'}.${place.kind === 'folder' ? place.id : place.kind}`
  const [initialPrefs] = useState(() =>
    folderPreferences(keyOf(initial), exploring, initial.kind === 'recycle'),
  )
  const [view, setView] = useState<View>(initialPrefs.view)
  const [sort, setSort] = useState<Sort>(initialPrefs.sort)
  const [selection, setSelection] = useState<Selection>(() =>
    select ? { ids: new Set([select]), anchor: select, focus: select } : emptySelection,
  )
  useEffect(() => {
    if (select)
      list.current
        ?.querySelector(`[data-node-id="${CSS.escape(select)}"]`)
        ?.scrollIntoView({ block: 'nearest' })
  }, [select])
  const [renaming, setRenaming] = useState<NodeId | null>(null)
  const [status, setStatus] = useState(initialPrefs.status)
  const [toolbar, setToolbar] = useState(initialPrefs.toolbar)
  const [autoArrange, setAutoArrange] = useState(initialPrefs.autoArrange)
  const [positions, setPositions] = useState(initialPrefs.positions)
  const [loadedKey, setLoadedKey] = useState(keyOf(initial))
  const geometryRestored = useRef('')
  const windowState = useWindows((s) => s.windows.find((item) => item.id === window.id))
  const [treeWidth, setTreeWidth] = useState(190)
  const [context, setContext] = useState<{ x: number; y: number; id: NodeId | null } | null>(null)
  const [goPath, setGoPath] = useState('')
  const [shellMenu, setShellMenu] = useState<{ x: number; y: number; key: string } | null>(null)
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const allNodes = useMemo(() => visibleNodes(state, location, sort, true), [state, location, sort])
  const nodes = useMemo(
    () => allNodes.filter((node) => settings.showHidden || !isHidden(node)),
    [allNodes, settings.showHidden],
  )
  const selected = nodes.filter((node) => selection.ids.has(node.id))
  const single = selected.length === 1 ? selected[0] : undefined
  const folder = location.kind === 'folder' ? state.nodes[location.id] : undefined
  const writable =
    folder &&
    (folder.kind === 'drive' || folder.kind === 'folder') &&
    !isInside(state, folder.id, RECYCLED_DIR)
  const recycled = location.kind === 'recycle'
  const title =
    location.kind === 'computer'
      ? 'My Computer'
      : recycled
        ? 'Recycle Bin'
        : folder
          ? labelOf(folder)
          : 'Folder'
  const setTitle = window.setTitle
  const path = folder ? pathOf(state, folder.id) : title
  useEffect(
    () => setTitle(exploring ? `Exploring - ${folder?.kind === 'drive' ? path : title}` : title),
    [setTitle, title, path, exploring, folder?.kind],
  )
  const detailColumns = recycled ? recycleColumns : columns.slice(0, 4)
  const mutable = selected.length > 0 && selected.every((node) => !isProtected(node.id))
  const shellItems =
    location.kind === 'computer'
      ? [
          {
            key: 'shell:floppy',
            label: '3½ Floppy (A:)',
            icon: floppyIcon,
            open: () => setPrompt({ kind: 'floppy' }),
          },
          {
            key: 'shell:controlpanel',
            label: 'Control Panel',
            icon: getApp('controlpanel')?.icon ?? printerIcon,
            open: () => launch('controlpanel'),
          },
          {
            key: 'shell:printers',
            label: 'Printers',
            icon: printerIcon,
            open: () => launch('controlpanel'),
          },
        ]
      : []
  const order =
    location.kind === 'computer'
      ? ['shell:floppy', ...nodes.map((node) => node.id), 'shell:controlpanel', 'shell:printers']
      : nodes.map((node) => node.id)
  const selectedShell = shellItems.filter((item) => selection.ids.has(item.key))
  const selectedCount = selected.length + selectedShell.length
  const preferenceKey = keyOf(location)
  useLayoutEffect(() => {
    if (geometryRestored.current === preferenceKey) return
    const saved = folderPreferences(preferenceKey, exploring, recycled)
    setView(saved.view)
    setSort(saved.sort)
    setToolbar(saved.toolbar)
    setStatus(saved.status)
    setAutoArrange(saved.autoArrange)
    setPositions(saved.positions)
    setLoadedKey(preferenceKey)
    if (saved.geometry && !geometryRestored.current)
      windowsStore.dispatch({ type: 'resize', id: window.id, ...saved.geometry })
    geometryRestored.current = preferenceKey
  }, [preferenceKey, exploring, recycled, window.id])
  useEffect(() => {
    if (loadedKey !== preferenceKey || !windowState) return
    const current = windowsStore.get().windows.find((item) => item.id === window.id)
    saveFolderPreferences(preferenceKey, {
      view,
      sort,
      toolbar,
      status,
      autoArrange,
      positions,
      ...(current?.size ? { geometry: { position: current.position, size: current.size } } : {}),
    })
  }, [view, sort, toolbar, status, autoArrange, positions, preferenceKey, loadedKey, window.id, windowState])

  const selectAll = () =>
    setSelection({
      ids: new Set(order),
      anchor: order[0] ?? null,
      focus: order[0] ?? null,
    })
  const rename = () => {
    if (writable && single && !isProtected(single.id)) setRenaming(single.id)
  }
  const finishRename = (node: FsNode, name: string | null) => {
    setRenaming(null)
    if (name === null) return
    const before = fs.get()
    const error = fs.rename(node.id, naming.rename(node, name))
    if (error)
      setPrompt({
        kind: 'error',
        title: 'Error Renaming File',
        message: `Cannot rename ${node.name}: ${error.replace(/^Cannot rename [^:]+: /, '')}`,
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
    if (node.id === RECYCLED_DIR) {
      launch('recyclebin')
      return
    }
    if (node.kind === 'folder' || node.kind === 'drive') {
      if (exploring || settings.sameWindow) navigate({ kind: 'folder', id: node.id })
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
  const askDelete = (ids: readonly NodeId[]) => {
    if (!ids.length) return
    const permanent = recycled || deletesForGood(settings)
    if (!permanent && !settings.confirmDelete) removeNodes(ids, false)
    else setPrompt({ kind: 'confirm', action: permanent ? 'purge' : 'recycle', ids })
  }
  const deleteSelected = () => {
    if (mutable && (recycled || writable)) askDelete(selected.map((node) => node.id))
  }
  const cutSelected = () => {
    if ((writable || recycled) && mutable)
      clipboard.dispatch({ op: 'cut', ids: selected.map((node) => node.id) })
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
      source?.op === 'cut' ? 'Move' : 'Copy',
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
    const problem = undoLast(fs.get(), fsStore.dispatch)
    if (problem) setPrompt({ kind: 'error', title: 'Undo', message: problem })
  }
  const restore = () => {
    for (const node of selected) fs.restore(node.id)
    setSelection(emptySelection)
  }

  useKeyDown((event) => {
    if ((event.key === 'Tab' || event.key === 'F6') && !prompt && !context && !shellMenu && !renaming) {
      if (event.target instanceof Element && event.target.closest('[role="menubar"], [role="menu"]')) return
      const panes = [
        root.current?.querySelector<HTMLElement>('.explorer-toolbar [role="combobox"]'),
        root.current?.querySelector<HTMLElement>('[role="tree"]'),
        list.current,
      ].flatMap((pane) => (pane ? [pane] : []))
      if (!panes.length) return
      event.preventDefault()
      const at = panes.findIndex((pane) => event.target instanceof Node && pane.contains(event.target))
      const next =
        at < 0
          ? panes[event.shiftKey ? panes.length - 1 : 0]
          : panes[(at + (event.shiftKey ? -1 : 1) + panes.length) % panes.length]
      if (next?.role === 'tree')
        (
          next.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]') ??
          next.querySelector<HTMLElement>('[role="treeitem"]')
        )?.focus()
      else next?.focus()
      return
    }
    if (
      prompt ||
      context ||
      shellMenu ||
      renaming ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    )
      return
    if (
      event.target instanceof Element &&
      event.target.closest(
        '[role="menubar"], [role="menu"], [role="dialog"], [role="tree"], [role="combobox"]',
      )
    )
      return
    const key = event.key.toLowerCase()
    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      event.preventDefault()
      const rect = list.current?.getBoundingClientRect()
      if (rect) setContext({ x: rect.left + 20, y: rect.top + 20, id: single?.id ?? null })
      return
    }
    if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const current = order.indexOf(selection.focus ?? '')
      const across = Math.max(
        1,
        Math.floor((list.current?.clientWidth ?? 75) / (view === 'large' ? 75 : 160)),
      )
      const rows = Math.max(1, Math.floor((list.current?.clientHeight ?? 22) / 22))
      const steps: Readonly<Record<string, number>> =
        view === 'large' || view === 'small'
          ? { ArrowDown: across, ArrowUp: -across, ArrowLeft: -1, ArrowRight: 1 }
          : view === 'list'
            ? { ArrowDown: 1, ArrowUp: -1, ArrowLeft: -rows, ArrowRight: rows }
            : { ArrowDown: 1, ArrowUp: -1, ArrowLeft: -1, ArrowRight: 1 }
      const step = current + (steps[event.key] ?? 0)
      const index =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? order.length - 1
            : current < 0
              ? 0
              : step < 0 || step >= order.length
                ? current
                : step
      const id = order[index]
      if (id) {
        setSelection(
          selectNode({
            selection,
            order,
            id,
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
      for (const item of selectedShell) item.open()
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
    if (event.key === 'F5') {
      event.preventDefault()
      setSort({ ...sort })
    }
    if (event.key === 'F1') {
      event.preventDefault()
      launch('help', { book: 'explorer' })
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey && event.key !== ' ') {
      const now = Date.now()
      const text = now - typed.current.at > 1000 ? key : typed.current.text + key
      typed.current = { text, at: now }
      const match =
        nodes.find((node) => labelOf(node).toLowerCase().startsWith(text)) ??
        nodes.find((node) => labelOf(node).toLowerCase().startsWith(key))
      const shell = shellItems.find((item) => item.label.toLowerCase().startsWith(text))
      const id = match?.id ?? shell?.key
      if (id) setSelection({ ids: new Set([id]), anchor: id, focus: id })
    }
  })

  const actionsFor = (id: NodeId | null): DesktopActions => {
    const node = id ? state.nodes[id] : undefined
    const scope = node ? (selection.ids.has(node.id) ? selected : [node]) : selected
    const ids = scope.map((item) => item.id)
    const destination = node && (node.kind === 'folder' || node.kind === 'drive') ? node.id : folder?.id
    return {
      undo,
      open: () => scope.forEach(open),
      explore: () => destination && launch('explorer', { folder: destination }),
      find: () => launch('find', destination ? { folder: destination } : {}),
      cut: () => clipboard.dispatch({ op: 'cut', ids }),
      copy: () => clipboard.dispatch({ op: 'copy', ids }),
      paste: () => paste(destination),
      pasteShortcut: () => shortcuts(clip?.ids ?? []),
      createShortcut: () => shortcuts(ids, folder?.id ?? DESKTOP_DIR),
      remove: () => askDelete(ids),
      rename: () => node && setRenaming(node.id),
      properties: () => {
        const target = node ?? folder
        if (target) setPrompt({ kind: 'properties', node: target })
      },
      sendToDocuments: () => paste(DOCUMENTS_DIR, { op: 'copy', ids }),
      sendToDesktop: () => shortcuts(ids, DESKTOP_DIR),
      emptyRecycleBin: () =>
        setPrompt({ kind: 'confirm', action: 'empty', ids: nodes.map((item) => item.id) }),
      arrange: (by) => {
        setPositions({})
        setSort({ column: by === 'date' ? 'modified' : by, direction: 'ascending' })
      },
      toggleAutoArrange: () => {
        setAutoArrange(!autoArrange)
        setPositions({})
      },
      lineUp: () => {
        const cell = view === 'large' ? { width: 75, height: 75 } : { width: 160, height: 22 }
        setPositions(
          Object.fromEntries(
            Object.entries(positions).map(([id, point]) => [
              id,
              {
                x: Math.round(point.x / cell.width) * cell.width,
                y: Math.round(point.y / cell.height) * cell.height,
              },
            ]),
          ),
        )
      },
      newFolder: () => create('folder'),
      newShortcut: () => setPrompt({ kind: 'shortcut' }),
      newTextDocument: () => create('file'),
      desktopProperties: () => {
        if (recycled) setPrompt({ kind: 'bin-properties' })
        else if (folder) setPrompt({ kind: 'properties', node: folder })
      },
    }
  }
  const menuFor = (id: NodeId | null): MenuEntry[] => {
    const node = id ? state.nodes[id] : undefined
    const act = actionsFor(id)
    const facts: MenuFacts = {
      canPaste: Boolean(clip?.ids.length && (writable || node?.kind === 'drive')),
      autoArrange,
      binEmpty: !nodes.length,
      canFind: Boolean(getApp('find')),
      single: !node || !selection.ids.has(node.id) || selected.length === 1,
      mutable: Boolean(node && !isProtected(node.id)),
      hasProperties: Boolean(node),
      undo: undoStack.length ? undoLabel(undoStack) : null,
    }
    if (recycled && node)
      return [
        { label: 'R&estore', bold: true, onSelect: restore },
        'separator',
        { label: 'Cu&t', onSelect: act.cut },
        'separator',
        { label: '&Delete', onSelect: act.remove },
        'separator',
        { label: 'P&roperties', disabled: !facts.single, onSelect: act.properties },
      ]
    if (node?.kind === 'drive')
      return [
        { label: '&Open', bold: true, onSelect: act.open },
        { label: '&Explore', onSelect: act.explore },
        { label: '&Find...', disabled: !getApp('find'), onSelect: act.find },
        'separator',
        { label: 'F&ormat...', disabled: true },
        { label: 'Create &Shortcut', onSelect: act.createShortcut },
        'separator',
        { label: 'P&roperties', onSelect: act.properties },
      ]
    if (node) return nodeMenu(node, facts, act)
    const background = backgroundMenu(facts, act)
      .filter((entry) => writable || entry === 'separator' || entry.label !== 'Ne&w')
      .map((entry) =>
        entry !== 'separator' && entry.label === 'P&roperties' && !folder && !recycled
          ? { ...entry, disabled: true }
          : entry,
      )
    return [
      {
        label: '&View',
        items: views.map((item) => ({
          label: item.label,
          icon: view === item.id ? radioDot : '',
          onSelect: () => setView(item.id),
        })),
      },
      ...background,
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
          disabled: !selectedCount,
          onSelect: () => {
            for (const node of selected) open(node)
            for (const item of selectedShell) item.open()
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
            { label: '&Shortcut', onSelect: () => setPrompt({ kind: 'shortcut' }) },
            { label: '&Text Document', onSelect: () => create('file') },
          ],
        },
        'separator',
        {
          label: 'Se&nd To',
          disabled: !selected.length,
          items: [
            {
              label: 'Desktop as Shortcut',
              onSelect: () =>
                shortcuts(
                  selected.map((node) => node.id),
                  DESKTOP_DIR,
                ),
            },
            {
              label: 'My Documents',
              onSelect: () => paste(DOCUMENTS_DIR, { op: 'copy', ids: selected.map((node) => node.id) }),
            },
          ],
        },
        'separator',
        {
          label: 'Create &Shortcut',
          disabled: !selected.length || !writable,
          onSelect: () => shortcuts(selected.map((node) => node.id)),
        },
        { label: '&Delete', disabled: !writable || !mutable, shortcut: 'Del', onSelect: deleteSelected },
        { label: 'Rena&me', disabled: !writable || !single || !mutable, shortcut: 'F2', onSelect: rename },
      ]
  fileItems.push(
    'separator',
    {
      label: 'P&roperties',
      disabled: !single && !recycled,
      onSelect: () => {
        if (single) setPrompt({ kind: 'properties', node: single })
        else if (recycled) setPrompt({ kind: 'bin-properties' })
      },
    },
    'separator',
    { label: '&Close', onSelect: window.close },
  )

  const renderName = (node: FsNode) => {
    const icon = fileIcon(node, view !== 'large')
    return (
      <>
        <span className="explorer-icon">
          <img src={icon.icon} alt="" draggable={false} />
          {selection.ids.has(node.id) && (
            <span
              className="explorer-icon-dither"
              style={{
                maskImage: `url("${icon.icon}"), repeating-conic-gradient(#000 0 25%, transparent 0 50%)`,
                maskSize: '100% 100%, 2px 2px',
                maskComposite: 'intersect',
              }}
            />
          )}
          {icon.overlay && <img className="explorer-overlay" src={icon.overlay} alt="" draggable={false} />}
        </span>
        {renaming === node.id ? (
          <Rename name={labelOf(node)} finish={(name) => finishRename(node, name)} />
        ) : (
          <span className="explorer-name">{labelOf(node)}</span>
        )}
      </>
    )
  }

  const renderShell = (item: (typeof shellItems)[number]) => (
    <div
      key={item.key}
      role="option"
      tabIndex={-1}
      aria-label={item.label}
      aria-selected={selection.ids.has(item.key)}
      className={`explorer-item ${selection.ids.has(item.key) ? 'selected' : ''}`}
      data-shell-item={item.key}
      onClick={(event) =>
        setSelection(
          selectNode({ selection, order, id: item.key, ctrl: event.ctrlKey, shift: event.shiftKey }),
        )
      }
      onDoubleClick={item.open}
      onKeyDown={(event) => {
        if (event.key === ' ') {
          event.preventDefault()
          setSelection(
            selectNode({ selection, order, id: item.key, ctrl: event.ctrlKey, shift: event.shiftKey }),
          )
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setSelection({ ids: new Set([item.key]), focus: item.key, anchor: item.key })
        setShellMenu({ x: event.clientX, y: event.clientY, key: item.key })
      }}
    >
      <span
        className="explorer-label"
        style={view === 'details' ? { width: detailColumns[0]?.width } : undefined}
      >
        <span className="explorer-icon">
          <img src={item.icon} alt="" draggable={false} />
        </span>
        <span className="explorer-name">{item.label}</span>
      </span>
    </div>
  )
  const confirmNodes =
    prompt?.kind === 'confirm'
      ? prompt.action === 'empty'
        ? nodes
        : prompt.ids.flatMap((id) => state.nodes[id] ?? [])
      : []
  const removeNodes = (ids: readonly NodeId[], permanent: boolean) => {
    const before = fs.get()
    for (const id of ids) {
      if (permanent) fs.purge(id)
      else fs.recycle(id)
    }
    if (!permanent) remember(before, fs.get(), 'Delete')
    else history.dispatch([])
    setSelection(emptySelection)
  }
  const drag = useFileDrag(list, {
    error: (title, message) => setPrompt({ kind: 'error', title, message }),
    select: (ids) => setSelection({ ids: new Set(ids), anchor: ids[0] ?? null, focus: ids[0] ?? null }),
    recycle: askDelete,
    place: (ids, offset) => {
      if (autoArrange || (view !== 'large' && view !== 'small')) return
      setPositions((old) => ({
        ...old,
        ...Object.fromEntries(
          ids.map((id) => [id, { x: (old[id]?.x ?? 0) + offset.x, y: (old[id]?.y ?? 0) + offset.y }]),
        ),
      }))
    },
  })
  const band = useRubberBand(selection, setSelection)
  return (
    <div ref={root} className="explorer h-full w-full flex flex-col" data-location={title}>
      <MenuBar
        menus={[
          { label: '&File', items: fileItems },
          {
            label: '&Edit',
            items: [
              {
                label: undoLabel(undoStack),
                shortcut: 'Ctrl+Z',
                disabled: !undoStack.length,
                onSelect: undo,
              },
              'separator',
              {
                label: 'Cu&t',
                shortcut: 'Ctrl+X',
                disabled: !(writable || recycled) || !mutable,
                onSelect: cutSelected,
              },
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
              {
                label: '&Invert Selection',
                onSelect: () =>
                  setSelection({
                    ids: new Set(order.filter((id) => !selection.ids.has(id))),
                    anchor: null,
                    focus: selection.focus,
                  }),
              },
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
                icon: view === item.id ? radioDot : '',
                onSelect: () => setView(item.id),
              })),
              'separator',
              ...backgroundMenu(
                {
                  canPaste: false,
                  autoArrange,
                  binEmpty: !nodes.length,
                  canFind: false,
                  single: false,
                  mutable: false,
                  hasProperties: false,
                  undo: null,
                },
                actionsFor(null),
              ).slice(0, 2),
              'separator',
              { label: '&Refresh', shortcut: 'F5', onSelect: () => setSort({ ...sort }) },
              { label: '&Options...', onSelect: () => setPrompt({ kind: 'options' }) },
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
            items: [
              { label: '&Help Topics', onSelect: () => launch('help', { book: 'explorer' }) },
              'separator',
              { label: '&About Windows 95', onSelect: () => setPrompt({ kind: 'help' }) },
            ],
          },
        ]}
      />
      {toolbar && (
        <div className="explorer-toolbar">
          <ComboBox
            aria-label="Folder"
            className="w-[150px] shrink-0"
            value={
              location.kind === 'folder'
                ? location.id === DESKTOP_DIR
                  ? TREE_DESKTOP
                  : location.id
                : location.kind
            }
            options={treeRows(folderTree(state), new Set([TREE_DESKTOP, 'computer', 'c'])).map((row) => ({
              key: row.key,
              label: row.label,
              icon: treeIcon(row),
              indent: row.depth,
            }))}
            onChange={(key) => {
              const row = treeRows(
                folderTree(state),
                new Set(Object.keys(state.nodes).concat([TREE_DESKTOP, 'computer'])),
              ).find((item) => item.key === key)
              if (row?.location) navigate(row.location)
            }}
          />
          {[
            { label: 'Up One Level', disabled: location.kind !== 'folder', run: up },
            { label: 'Cut', disabled: !mutable || !(writable || recycled), run: cutSelected },
            { label: 'Copy', disabled: !selected.length || recycled, run: copySelected },
            { label: 'Paste', disabled: !writable || !clip, run: () => paste() },
            { label: 'Undo', disabled: !undoStack.length, run: undo },
            { label: 'Delete', disabled: !mutable, run: deleteSelected },
            {
              label: 'Properties',
              disabled: !single,
              run: () => single && setPrompt({ kind: 'properties', node: single }),
            },
            ...views.map((item) => ({
              label: item.label.replace('&', ''),
              disabled: false,
              run: () => setView(item.id),
            })),
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              tabIndex={-1}
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
                onContext={(entry, at) => {
                  if (entry.location?.kind === 'folder') setContext({ ...at, id: entry.location.id })
                  else setShellMenu({ ...at, key: `tree:${entry.key}` })
                }}
                onChoose={(entry) => {
                  if (entry.location) navigate(entry.location)
                  else if (entry.key === 'floppy') setPrompt({ kind: 'floppy' })
                  else launch(entry.key === 'printers' ? 'controlpanel' : entry.key)
                }}
              />
            </div>
            <Splitter width={treeWidth} onResize={setTreeWidth} />
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
                    tabIndex={-1}
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
              data-drop-folder={recycled ? 'recycle' : writable ? folder.id : undefined}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setContext({ x: event.clientX, y: event.clientY, id: null })
              }}
              onPointerDown={band.start}
            >
              {shellItems.slice(0, 1).map(renderShell)}
              {nodes.map((node) => (
                <div
                  role="option"
                  tabIndex={-1}
                  key={node.id}
                  aria-label={node.name}
                  aria-selected={selection.ids.has(node.id)}
                  data-node-id={node.id}
                  style={
                    !autoArrange && (view === 'large' || view === 'small') && positions[node.id]
                      ? { transform: `translate(${positions[node.id]?.x}px, ${positions[node.id]?.y}px)` }
                      : undefined
                  }
                  className={`explorer-item ${selection.ids.has(node.id) ? 'selected' : ''} ${clip?.op === 'cut' && clip.ids.includes(node.id) ? 'cut' : ''} ${drag?.target?.owner === list.current && drag?.target?.id === node.id ? 'drop-target' : ''}`}
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
                        order,
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
                        order,
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
                          className={`explorer-cell ${column.id === 'name' ? 'explorer-label' : ''} ${column.id === 'size' ? 'explorer-size' : ''}`}
                          style={{ width: column.width }}
                        >
                          {column.id === 'name' ? renderName(node) : cellValue(state, node, column.id)}
                        </span>
                      ))
                    : renderName(node)}
                </div>
              ))}
              {shellItems.slice(1).map(renderShell)}
            </div>
          </div>
        </div>
      </div>
      {context && <ContextMenu at={context} items={menuFor(context.id)} onClose={() => setContext(null)} />}
      {band.rectangle}
      {drag && drag.source === list.current && <DragGhost drag={drag} />}
      {shellMenu && (
        <ContextMenu
          at={shellMenu}
          items={
            shellMenu.key === 'tree:recycle'
              ? [
                  { label: '&Open', bold: true, onSelect: () => launch('recyclebin') },
                  { label: '&Explore', onSelect: () => launch('explorer', { folder: RECYCLED_DIR }) },
                  {
                    label: 'Empty Recycle &Bin',
                    disabled: !children(state, RECYCLED_DIR).length,
                    onSelect: () =>
                      setPrompt({
                        kind: 'confirm',
                        action: 'purge',
                        ids: children(state, RECYCLED_DIR).map((node) => node.id),
                      }),
                  },
                  'separator',
                  { label: 'P&roperties', onSelect: () => setPrompt({ kind: 'bin-properties' }) },
                ]
              : [
                  {
                    label: '&Open',
                    bold: true,
                    onSelect: () => {
                      const item = shellItems.find((item) => item.key === shellMenu.key)
                      if (item) item.open()
                      else
                        launch(shellMenu.key.slice(5) === 'computer' ? 'mycomputer' : shellMenu.key.slice(5))
                    },
                  },
                ]
          }
          onClose={() => setShellMenu(null)}
        />
      )}
      {status && (
        <StatusBar className="shrink-0">
          <StatusPane className="w-[150px] shrink-0">
            {selectedCount
              ? `${selectedCount} object(s) selected`
              : `${order.length} object(s)${allNodes.length > nodes.length ? ` (plus ${allNodes.length - nodes.length} hidden)` : ''}`}
          </StatusPane>
          <StatusPane className="flex-1">
            {single?.kind === 'drive'
              ? `Free Space: ${formatSize(DRIVE_CAPACITY - driveUsed(state)).split(' (')[0]}, Capacity: ${formatSize(DRIVE_CAPACITY).split(' (')[0]}`
              : location.kind === 'computer'
                ? ''
                : formatSize(
                    (selectedCount ? selected : nodes).reduce((sum, node) => sum + fileSize(node), 0),
                  ).split(' (')[0]}
          </StatusPane>
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
                autoFocus
                onFocus={(event) => event.currentTarget.select()}
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
        <DeleteConfirmation
          nodes={confirmNodes}
          permanent={prompt.action !== 'recycle'}
          onAnswer={(yes) => {
            if (yes)
              removeNodes(
                confirmNodes.map((node) => node.id),
                prompt.action !== 'recycle',
              )
            setPrompt(null)
          }}
        />
      )}
      {prompt?.kind === 'properties' && (
        <PropertiesSheet
          id={prompt.node.id}
          onClose={() => {
            const after = fs.get().nodes[prompt.node.id]
            if (after && after.name !== prompt.node.name)
              history.dispatch([
                ...history.get(),
                { label: 'Rename', changes: [{ before: prompt.node, after }] },
              ])
            setPrompt(null)
          }}
        />
      )}
      {prompt?.kind === 'shortcut' && (
        <CreateShortcut
          onClose={() => setPrompt(null)}
          onFinish={(target, name) => {
            if (!writable) return 'This folder cannot contain a shortcut.'
            const spec =
              target.kind === 'app'
                ? { kind: 'shortcut' as const, app: target.app }
                : { kind: 'shortcut' as const, target: target.id }
            const result = createNode(folder.id, name, spec)
            if ('error' in result) return result.error
            setSelection({ ids: new Set([result.id]), focus: result.id, anchor: result.id })
            return null
          }}
        />
      )}
      {prompt?.kind === 'help' && (
        <AboutDialog app="Windows 95" icon={icons.windowsLogo} onClose={() => setPrompt(null)} />
      )}
      {prompt?.kind === 'options' && <FolderOptions onClose={() => setPrompt(null)} />}
      {prompt?.kind === 'bin-properties' && <RecycleBinProperties onClose={() => setPrompt(null)} />}
      {prompt?.kind === 'floppy' && (
        <MessageBox
          title={'A:\\'}
          message={'A:\\ is not accessible.\n\nThe device is not ready.'}
          icon="error"
          buttons={['Retry', 'Cancel']}
          onClose={(answer) => {
            if (answer !== 'Retry') setPrompt(null)
          }}
        />
      )}
    </div>
  )
}
