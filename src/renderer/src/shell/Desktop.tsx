import { type PointerEvent as ReactPointerEvent, useCallback, useMemo, useRef, useState } from 'react'
import { children, isInside, isProtected, uniqueName } from '../fs/fs'
import { createNode, fs, fsStore, newNodeId, useFs } from '../fs/store'
import { DESKTOP_DIR, DOCUMENTS_DIR, type FsNode, type NodeId, RECYCLED_DIR, ROOT } from '../fs/types'
import { useStore } from '../lib/store'
import { ContextMenu } from '../ui/Menu'
import { MessageBox } from '../ui/MessageBox'
import { PropertiesSheet } from '../ui/PropertiesSheet'
import { bytesOf, isHidden, typeName } from '../ui/properties'
import { TooltipLayer } from '../ui/Tooltip'
import { CreateShortcut } from './CreateShortcut'
import {
  type Clip,
  clipboard,
  type Plan,
  planPaste,
  planShortcuts,
  resolveShortcut,
  type ShortcutTarget,
} from './clipboard'
import { useKeyDown } from './context'
import {
  type ArrangeBy,
  backgroundMenu,
  type DesktopActions,
  type MenuFacts,
  nodeMenu,
  shellMenu,
} from './desktopMenus'
import {
  arranged,
  CELL,
  type Direction,
  gridOrder,
  layout,
  neighbor,
  ORIGIN,
  type Positions,
  type Rect,
  snap,
  spanned,
  touched,
  typeAhead,
} from './desktopModel'
import { nodeIcon } from './nodeIcon'
import { apps, getApp } from './registry'
import { launch, openNode, useWindows, windowsStore } from './system'
import type { AppManifest, Point, Size } from './types'

const POSITIONS_KEY = 'w95.desktop.v1'
const LABELS_KEY = 'w95.desktop.labels.v1'
const ARRANGE_KEY = 'w95.desktop.arrange.v1'
const DRAG_THRESHOLD = 3
/** The double-click time: a second click on a selected label within it opens; after it, renames. */
const SLOW_CLICK_MS = 500
const TYPE_AHEAD_MS = 1000

type Item =
  | {
      readonly kind: 'shell'
      readonly key: string
      readonly app: AppManifest
      readonly label: string
      readonly icon: string
    }
  | {
      readonly kind: 'node'
      readonly key: NodeId
      readonly node: FsNode
      readonly label: string
      readonly icon: string
      readonly overlay?: string | undefined
    }

interface Arrangement {
  readonly auto: boolean
  readonly by: ArrangeBy
}

type Prompt =
  | { kind: 'recycle'; nodes: readonly FsNode[] }
  | { kind: 'purge'; nodes: readonly FsNode[] }
  | { kind: 'empty' }
  | { kind: 'error'; title: string; message: string }
  | { kind: 'properties'; id: NodeId }
  | { kind: 'shortcut'; at: Point | null }

interface Drag {
  key: string
  pointer: Point
  offset: Point
  started: boolean
}

interface Band {
  from: Point
  to: Point
  base: ReadonlySet<string>
  rects: Map<string, Rect[]>
}

function load<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T | null) ?? fallback
  } catch {
    return fallback
  }
}

let desktopProperties: (() => void) | null = null

/**
 * Desktop > Properties opens Display Properties, which another unit provides. It registers its opener here
 * and gets back an unregister function. Until then the item does nothing.
 */
export function registerDesktopProperties(open: () => void): () => void {
  desktopProperties = open
  return () => {
    if (desktopProperties === open) desktopProperties = null
  }
}

function useItems(labels: Readonly<Record<string, string>>): Item[] {
  const state = useFs((s) => s)
  return useMemo(() => {
    const shell: Item[] = apps
      .filter((app) => app.desktop)
      .sort((a, b) => (a.desktop?.order ?? 0) - (b.desktop?.order ?? 0))
      .map((app) => {
        const key = `app:${app.id}`
        return {
          kind: 'shell',
          key,
          app,
          label: labels[key] ?? app.desktop?.label ?? app.title,
          icon: app.desktop?.icon?.(state) ?? app.icon,
        }
      })
    const files: Item[] = children(state, DESKTOP_DIR)
      .filter((node) => !isHidden(node))
      .map((node) => {
        const { icon, overlay } = nodeIcon(node)
        return { kind: 'node', key: node.id, node, label: node.name, icon, overlay }
      })
    return [...shell, ...files]
  }, [state, labels])
}

/** Items in the order Arrange Icons puts them: shell icons first, then folders, then files. */
function arrangeOrder(items: readonly Item[], by: ArrangeBy): string[] {
  const shell = items.filter((item) => item.kind === 'shell').map((item) => item.key)
  const nodes = items.flatMap((item) => (item.kind === 'node' ? [item.node] : []))
  const state = fs.get()
  const rank = (node: FsNode) => (node.kind === 'folder' ? 0 : 1)
  const byName = (a: FsNode, b: FsNode) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  const compare: Record<ArrangeBy, (a: FsNode, b: FsNode) => number> = {
    name: byName,
    type: (a, b) => typeName(a).localeCompare(typeName(b)) || byName(a, b),
    size: (a, b) => bytesOf(state, a) - bytesOf(state, b) || byName(a, b),
    date: (a, b) => b.modified - a.modified || byName(a, b),
  }
  const sorted = [...nodes].sort((a, b) => rank(a) - rank(b) || compare[by](a, b))
  return [...shell, ...sorted.map((node) => node.id)]
}

function DesktopIcon({
  item,
  at,
  selected,
  focused,
  renaming,
  ghosted,
  onPointerDown,
  onOpen,
  onRename,
}: {
  item: Item
  at: Point
  selected: boolean
  focused: boolean
  renaming: boolean
  ghosted: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onOpen: () => void
  onRename: (name: string | null) => void
}) {
  return (
    <div
      role="option"
      tabIndex={-1}
      aria-label={item.label}
      aria-selected={selected}
      data-desktop-item={item.key}
      className="absolute flex flex-col items-center w-[75px] outline-none"
      style={{ left: at.x, top: at.y }}
      onPointerDown={onPointerDown}
      onDoubleClick={onOpen}
    >
      <div className="relative size-8 mt-[2px]" data-icon>
        <img
          src={item.icon}
          alt=""
          className="size-8"
          draggable={false}
          style={
            ghosted
              ? {
                  maskImage: 'repeating-conic-gradient(#000 0 25%, transparent 0 50%)',
                  maskSize: '2px 2px',
                  maskPosition: '1px 0',
                }
              : undefined
          }
        />
        {item.kind === 'node' && item.overlay && (
          <img src={item.overlay} alt="" className="absolute left-0 bottom-0" draggable={false} />
        )}
        {selected && (
          <div
            className="absolute inset-0 bg-select"
            style={{
              maskImage: `url("${item.icon}"), repeating-conic-gradient(#000 0 25%, transparent 0 50%)`,
              maskSize: '100% 100%, 2px 2px',
              maskComposite: 'intersect',
            }}
          />
        )}
      </div>
      {renaming ? (
        <input
          // biome-ignore lint/a11y/noAutofocus: rename starts editing at once, as Explorer does
          autoFocus
          defaultValue={item.label}
          className="mt-[4px] w-[72px] px-[1px] text-center bg-white text-black border border-black outline-none select-text"
          onFocus={(event) => {
            const dot =
              item.kind === 'node' && item.node.kind === 'file' ? event.target.value.lastIndexOf('.') : -1
            event.target.setSelectionRange(0, dot > 0 ? dot : event.target.value.length)
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter') onRename(event.currentTarget.value)
            if (event.key === 'Escape') onRename(null)
          }}
          onBlur={(event) => onRename(event.currentTarget.value)}
        />
      ) : (
        <span
          data-label
          className={`mt-[4px] px-[1px] max-w-[72px] text-center leading-[13px] break-words text-white
            ${selected ? 'bg-select' : 'line-clamp-2'} ${focused ? 'outline outline-1 outline-dotted outline-white -outline-offset-1' : ''}`}
        >
          {item.label}
        </span>
      )}
    </div>
  )
}

export function Desktop({ size }: { size: Size }) {
  const [labels, setLabels] = useState<Readonly<Record<string, string>>>(() => load(LABELS_KEY, {}))
  const items = useItems(labels)
  const desktopFocused = useWindows((s) => s.focused === null)
  const clip = useStore(clipboard, (s) => s)
  const fsState = useFs((s) => s)
  const binItems = useMemo(() => children(fsState, RECYCLED_DIR), [fsState])
  const [saved, setSaved] = useState<Positions>(() => load(POSITIONS_KEY, {}))
  const [arrangement, setArrangement] = useState<Arrangement>(() =>
    load(ARRANGE_KEY, { auto: false, by: 'name' }),
  )
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ at: Point; key: string | null } | null>(null)
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [band, setBand] = useState<Band | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const slowClick = useRef<ReturnType<typeof setTimeout>>(undefined)
  const typed = useRef({ text: '', at: 0 })

  const keys = useMemo(() => items.map((item) => item.key), [items])
  const positions = useMemo(
    () =>
      arrangement.auto
        ? new Map(Object.entries(arranged(arrangeOrder(items, arrangement.by), size)))
        : layout(keys, saved, size),
    [items, keys, saved, size, arrangement],
  )
  const byKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items])
  const ordered = useMemo(
    () => gridOrder(positions).flatMap((key) => byKey.get(key) ?? []),
    [positions, byKey],
  )

  const savePositions = useCallback((next: Positions) => {
    setSaved(next)
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(next))
  }, [])
  const saveArrangement = (next: Arrangement) => {
    setArrangement(next)
    localStorage.setItem(ARRANGE_KEY, JSON.stringify(next))
  }

  const select = (next: Iterable<string>, focus?: string | null) => {
    setSelected(new Set(next))
    if (focus !== undefined) setFocusKey(focus)
  }
  const itemsOf = (keyList: Iterable<string>) => [...keyList].flatMap((key) => byKey.get(key) ?? [])
  const nodesOf = (keyList: Iterable<string>) =>
    itemsOf(keyList).flatMap((item) => (item.kind === 'node' ? [item.node] : []))
  const showError = (title: string, message: string) => setPrompt({ kind: 'error', title, message })

  /** Runs a clipboard or shortcut plan, then selects and places what it made. */
  const carry = (plan: Plan, at: Point | null) => {
    if (!plan.ok) {
      showError(plan.title, plan.message)
      return []
    }
    for (const action of plan.actions) fsStore.dispatch(action)
    if (at && plan.created[0]) savePositions({ ...saved, [plan.created[0]]: snap(at) })
    if (plan.created.length) select(plan.created, plan.created[0] ?? null)
    return plan.created
  }

  const openItem = (item: Item) => {
    if (item.kind === 'shell') {
      launch(item.app.id)
      return
    }
    if (openNode(item.node.id)) return
    if (item.node.kind === 'shortcut' && !resolveShortcut(fs.get(), item.node)) {
      showError(
        'Problem with Shortcut',
        `The item '${item.node.name}' that this shortcut refers to has been changed or moved, so this shortcut will no longer work properly.`,
      )
    }
  }

  const startRename = (key: string) => {
    const item = byKey.get(key)
    if (!item || (item.kind === 'node' && isProtected(item.node.id))) return
    select([key], key)
    setRenaming(key)
  }

  const finishRename = (item: Item, name: string | null) => {
    setRenaming(null)
    if (name === null || name === item.label) return
    if (item.kind === 'shell') {
      if (!name.trim()) {
        showError('Rename', 'You must type a filename.')
        return
      }
      const next = { ...labels, [item.key]: name.trim() }
      setLabels(next)
      localStorage.setItem(LABELS_KEY, JSON.stringify(next))
      return
    }
    const error = fs.rename(item.node.id, name)
    if (error) showError('Error Renaming File', error)
  }

  const createOnDesktop = (kind: 'folder' | 'file', at: Point | null) => {
    const name = uniqueName(fs.get(), DESKTOP_DIR, kind === 'folder' ? 'New Folder' : 'New Text Document.txt')
    const result = createNode(DESKTOP_DIR, name, kind === 'folder' ? { kind } : { kind, content: '' })
    if (!('id' in result)) return
    if (at) savePositions({ ...saved, [result.id]: snap(at) })
    select([result.id], result.id)
    setRenaming(result.id)
  }

  const targetsOf = (keyList: Iterable<string>): ShortcutTarget[] =>
    itemsOf(keyList).map((item) =>
      item.kind === 'shell'
        ? { kind: 'app', app: item.app.id, label: item.label }
        : { kind: 'node', id: item.node.id },
    )

  const askDelete = (keyList: Iterable<string>, permanent: boolean) => {
    const nodes = nodesOf(keyList).filter((node) => !isProtected(node.id))
    if (nodes.length) setPrompt({ kind: permanent ? 'purge' : 'recycle', nodes })
  }

  const openProperties = (key: string | null) => {
    const item = key ? byKey.get(key) : undefined
    if (!item) desktopProperties?.()
    else if (item.kind === 'node') setPrompt({ kind: 'properties', id: item.node.id })
  }

  const putOnClipboard = (op: 'cut' | 'copy', keyList: Iterable<string>) => {
    const nodes = nodesOf(keyList).filter((node) => op === 'copy' || !isProtected(node.id))
    if (nodes.length) clipboard.dispatch({ op, ids: nodes.map((node) => node.id) })
  }

  const paste = (clipNow: Clip, dest: NodeId, at: Point | null) => {
    const created = carry(
      planPaste(fs.get(), clipNow, dest, Date.now(), newNodeId),
      dest === DESKTOP_DIR ? at : null,
    )
    if (clipNow?.op === 'cut' && created.length) clipboard.dispatch(null)
  }

  const actionsFor = (key: string | null, at: Point | null): DesktopActions => {
    const scope = key ? (selected.has(key) ? [...selected] : [key]) : []
    const item = key ? byKey.get(key) : undefined
    const folder =
      item?.kind === 'node' && (item.node.kind === 'folder' || item.node.kind === 'drive') ? item.node : null
    return {
      open: () => {
        for (const each of itemsOf(scope)) openItem(each)
      },
      explore: () => {
        if (folder) launch('explorer', { folder: folder.id })
        else if (item?.kind === 'shell' && item.app.id === 'mycomputer') launch('explorer', { folder: ROOT })
        else if (item) openItem(item)
      },
      find: () => launch('find', folder ? { folder: folder.id } : {}),
      cut: () => putOnClipboard('cut', scope),
      copy: () => putOnClipboard('copy', scope),
      paste: () => paste(clipboard.get(), folder?.id ?? DESKTOP_DIR, folder ? null : at),
      pasteShortcut: () => {
        const ids = clipboard.get()?.ids ?? []
        carry(
          planShortcuts(
            fs.get(),
            ids.map((id) => ({ kind: 'node', id })),
            DESKTOP_DIR,
            Date.now(),
            newNodeId,
          ),
          at,
        )
      },
      createShortcut: () =>
        carry(planShortcuts(fs.get(), targetsOf(scope), DESKTOP_DIR, Date.now(), newNodeId), null),
      remove: () => askDelete(scope, false),
      rename: () => key && startRename(key),
      properties: () => openProperties(key),
      sendToDocuments: () =>
        paste({ op: 'copy', ids: nodesOf(scope).map((node) => node.id) }, DOCUMENTS_DIR, null),
      sendToDesktop: () =>
        carry(planShortcuts(fs.get(), targetsOf(scope), DESKTOP_DIR, Date.now(), newNodeId), null),
      emptyRecycleBin: () => setPrompt({ kind: 'empty' }),
      arrange: (by) => {
        saveArrangement({ ...arrangement, by })
        savePositions(arranged(arrangeOrder(items, by), size))
      },
      toggleAutoArrange: () => {
        const next = { ...arrangement, auto: !arrangement.auto }
        saveArrangement(next)
        if (!next.auto) savePositions(Object.fromEntries(positions))
      },
      lineUp: () => savePositions(Object.fromEntries([...positions].map(([k, p]) => [k, snap(p)]))),
      newFolder: () => createOnDesktop('folder', at),
      newShortcut: () => setPrompt({ kind: 'shortcut', at }),
      newTextDocument: () => createOnDesktop('file', at),
      desktopProperties: () => desktopProperties?.(),
    }
  }

  const factsFor = (key: string | null): MenuFacts => {
    const scope = key ? (selected.has(key) ? [...selected] : [key]) : []
    const item = key ? byKey.get(key) : undefined
    return {
      canPaste: Boolean(clip?.ids.some((id) => fs.get().nodes[id])),
      autoArrange: arrangement.auto,
      binEmpty: binItems.length === 0,
      canFind: Boolean(getApp('find')),
      single: scope.length <= 1,
      mutable: item?.kind === 'node' && !isProtected(item.node.id),
      hasProperties: item?.kind === 'node',
    }
  }

  const menuItems = (key: string | null, at: Point) => {
    const item = key ? byKey.get(key) : undefined
    const facts = factsFor(key)
    const act = actionsFor(key, at)
    if (!item) return backgroundMenu(facts, act)
    return item.kind === 'shell' ? shellMenu(item.app.id, facts, act) : nodeMenu(item.node, facts, act)
  }

  const dropOn = (target: Item | undefined, dragged: Item): boolean => {
    if (!target || target.key === dragged.key || dragged.kind !== 'node') return false
    const ids = nodesOf(selected.has(dragged.key) ? selected : [dragged.key]).map((node) => node.id)
    const onDrop = target.kind === 'shell' ? target.app.desktop?.onDrop : undefined
    if (onDrop) {
      onDrop(ids)
      return true
    }
    if (target.kind !== 'node' || target.node.kind !== 'folder') return false
    const into = target.node.id
    for (const id of ids) {
      if (!isInside(fs.get(), into, id)) fs.move(id, into)
    }
    return true
  }

  const onIconPointerDown = (item: Item) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    windowsStore.dispatch({ type: 'blur' })
    setMenu(null)
    clearTimeout(slowClick.current)
    if (event.button === 2) {
      if (!selected.has(item.key)) select([item.key], item.key)
      else setFocusKey(item.key)
      return
    }
    if (event.button !== 0) return
    if (event.ctrlKey) {
      const next = new Set(selected)
      if (next.has(item.key)) next.delete(item.key)
      else next.add(item.key)
      select(next, item.key)
      return
    }
    const onLabel = event.target instanceof Element && event.target.closest('[data-label]') !== null
    const armed = onLabel && selected.size === 1 && selected.has(item.key)
    if (!selected.has(item.key)) select([item.key], item.key)
    else setFocusKey(item.key)
    event.currentTarget.setPointerCapture(event.pointerId)
    const target = event.currentTarget
    dragRef.current = {
      key: item.key,
      pointer: { x: event.clientX, y: event.clientY },
      offset: { x: 0, y: 0 },
      started: false,
    }
    const move = (e: PointerEvent) => {
      const current = dragRef.current
      if (!current) return
      const offset = { x: e.clientX - current.pointer.x, y: e.clientY - current.pointer.y }
      if (!current.started && Math.abs(offset.x) + Math.abs(offset.y) < DRAG_THRESHOLD) return
      dragRef.current = { ...current, offset, started: true }
      setDrag(dragRef.current)
    }
    const up = (e: PointerEvent) => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
      const current = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (!current?.started) {
        if (armed) slowClick.current = setTimeout(() => startRename(item.key), SLOW_CLICK_MS)
        return
      }
      const under = document
        .elementsFromPoint(e.clientX, e.clientY)
        .map((el) => el.closest<HTMLElement>('[data-desktop-item]')?.dataset.desktopItem)
        .find((key) => key && key !== current.key)
      if (dropOn(under ? byKey.get(under) : undefined, item)) return
      if (arrangement.auto) return
      const moved = [...(selected.has(item.key) ? selected : [item.key])]
      const next: Record<string, Point> = Object.fromEntries(positions)
      for (const key of moved) {
        const origin = positions.get(key)
        if (!origin) continue
        next[key] = {
          x: Math.max(0, Math.min(origin.x + current.offset.x, size.width - CELL.width)),
          y: Math.max(0, Math.min(origin.y + current.offset.y, size.height - CELL.height)),
        }
      }
      savePositions(next)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  /** Rubber-band selection: drag on empty desktop to select every icon the dotted box touches. */
  const onBackgroundPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    windowsStore.dispatch({ type: 'blur' })
    setMenu(null)
    clearTimeout(slowClick.current)
    if (event.button !== 0) return
    const root = event.currentTarget
    const origin = root.getBoundingClientRect()
    const local = (e: { clientX: number; clientY: number }): Point => ({
      x: e.clientX - origin.left,
      y: e.clientY - origin.top,
    })
    const rects = new Map<string, Rect[]>()
    for (const element of root.querySelectorAll<HTMLElement>('[data-desktop-item]')) {
      const key = element.dataset.desktopItem
      if (!key) continue
      rects.set(
        key,
        [...element.querySelectorAll('[data-icon], [data-label]')].map((part) => {
          const box = part.getBoundingClientRect()
          return { x: box.left - origin.left, y: box.top - origin.top, width: box.width, height: box.height }
        }),
      )
    }
    const base = event.ctrlKey ? new Set(selected) : new Set<string>()
    if (!event.ctrlKey) select([], null)
    root.setPointerCapture(event.pointerId)
    const from = local(event)
    let current: Band | null = null
    const move = (e: PointerEvent) => {
      const to = local(e)
      if (!current && Math.abs(to.x - from.x) + Math.abs(to.y - from.y) < DRAG_THRESHOLD) return
      current = { from, to, base, rects }
      setBand(current)
      setSelected(new Set([...base, ...touched(spanned(from, to), rects)]))
    }
    const up = () => {
      root.removeEventListener('pointermove', move)
      root.removeEventListener('pointerup', up)
      root.removeEventListener('pointercancel', up)
      setBand(null)
    }
    root.addEventListener('pointermove', move)
    root.addEventListener('pointerup', up)
    root.addEventListener('pointercancel', up)
  }

  const menuAt = (key: string | null): Point => {
    const root = rootRef.current?.getBoundingClientRect()
    const point = key ? positions.get(key) : undefined
    if (!root) return { x: 0, y: 0 }
    return point
      ? { x: root.left + point.x + 37, y: root.top + point.y + 24 }
      : { x: root.left + 4, y: root.top + 4 }
  }

  useKeyDown((event) => {
    const active = document.activeElement
    const ours = active === document.body || (active instanceof Node && rootRef.current?.contains(active))
    if (!desktopFocused || !ours || renaming || prompt || menu || event.target instanceof HTMLInputElement)
      return
    const arrows: Record<string, Direction> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    }
    const direction = arrows[event.key]
    const focus = focusKey && byKey.has(focusKey) ? focusKey : null
    const scope = selected.size ? [...selected] : focus ? [focus] : []
    const handled = () => event.preventDefault()
    if (direction) {
      handled()
      const next = neighbor(positions, focus, direction)
      if (!next) return
      if (event.ctrlKey) setFocusKey(next)
      else select([next], next)
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      handled()
      const next = event.key === 'Home' ? ordered[0] : ordered.at(-1)
      if (next) select([next.key], next.key)
      return
    }
    if (event.key === ' ' && event.ctrlKey && focus) {
      handled()
      const next = new Set(selected)
      if (next.has(focus)) next.delete(focus)
      else next.add(focus)
      setSelected(next)
      return
    }
    if (event.key === 'Enter' && event.altKey) {
      handled()
      openProperties(scope.length === 1 ? (scope[0] ?? null) : null)
      return
    }
    if (event.key === 'Enter') {
      handled()
      for (const item of itemsOf(scope)) openItem(item)
      return
    }
    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      handled()
      const key = scope[0] ?? null
      setMenu({ at: menuAt(key), key })
      return
    }
    if (event.key === 'F2' && scope.length === 1 && scope[0]) {
      handled()
      startRename(scope[0])
      return
    }
    if (event.key === 'Delete') {
      handled()
      askDelete(scope, event.shiftKey)
      return
    }
    if (event.ctrlKey && !event.altKey) {
      const key = event.key.toLowerCase()
      if (key === 'a') {
        handled()
        select(keys, focus)
      } else if (key === 'c' || key === 'x') {
        handled()
        putOnClipboard(key === 'c' ? 'copy' : 'cut', scope)
      } else if (key === 'v') {
        handled()
        paste(clipboard.get(), DESKTOP_DIR, null)
      }
      return
    }
    if (event.key.length === 1 && !event.altKey && !event.metaKey && event.key !== ' ') {
      const now = Date.now()
      const text = now - typed.current.at > TYPE_AHEAD_MS ? event.key : typed.current.text + event.key
      typed.current = { text, at: now }
      const next = typeAhead(
        ordered.map((item) => ({ key: item.key, label: item.label })),
        focus,
        text,
      )
      if (next) select([next], next)
    }
  })

  const answerDelete = (nodes: readonly FsNode[], permanent: boolean) => {
    for (const node of nodes) {
      if (permanent) fs.purge(node.id)
      else fs.recycle(node.id)
    }
    select([], null)
  }

  const deletePrompt = (nodes: readonly FsNode[], permanent: boolean) => {
    const [first] = nodes
    if (!first) return null
    const many = nodes.length > 1
    const folder = !many && first.kind === 'folder'
    const title = many
      ? 'Confirm Multiple File Delete'
      : folder
        ? 'Confirm Folder Delete'
        : 'Confirm File Delete'
    const message = permanent
      ? many
        ? `Are you sure you want to delete these ${nodes.length} items?`
        : `Are you sure you want to delete '${first.name}'?`
      : many
        ? `Are you sure you want to send these ${nodes.length} items to the Recycle Bin?`
        : folder
          ? `Are you sure you want to remove the folder '${first.name}' and move all its contents to the Recycle Bin?`
          : `Are you sure you want to send '${first.name}' to the Recycle Bin?`
    return { title, message, icon: folder ? ('warning' as const) : ('question' as const) }
  }

  const confirm =
    prompt?.kind === 'recycle' || prompt?.kind === 'purge'
      ? deletePrompt(prompt.nodes, prompt.kind === 'purge')
      : prompt?.kind === 'empty'
        ? deletePrompt(binItems, true)
        : null

  return (
    <div
      ref={rootRef}
      role="listbox"
      aria-label="Desktop"
      aria-multiselectable="true"
      tabIndex={0}
      className="absolute inset-0 bg-desktop outline-none"
      onPointerDown={onBackgroundPointerDown}
      onContextMenu={(event) => {
        event.preventDefault()
        const key =
          (event.target as HTMLElement).closest<HTMLElement>('[data-desktop-item]')?.dataset.desktopItem ??
          null
        setMenu({ at: { x: event.clientX, y: event.clientY }, key })
      }}
    >
      {items.map((item) => {
        const at = positions.get(item.key) ?? ORIGIN
        const moving =
          drag?.started && (drag.key === item.key || (selected.has(drag.key) && selected.has(item.key)))
        return (
          <DesktopIcon
            key={item.key}
            item={item}
            at={moving && drag ? { x: at.x + drag.offset.x, y: at.y + drag.offset.y } : at}
            selected={selected.has(item.key)}
            focused={focusKey === item.key && desktopFocused}
            renaming={renaming === item.key}
            ghosted={clip?.op === 'cut' && item.kind === 'node' && clip.ids.includes(item.node.id)}
            onPointerDown={onIconPointerDown(item)}
            onOpen={() => {
              clearTimeout(slowClick.current)
              openItem(item)
            }}
            onRename={(name) => finishRename(item, name)}
          />
        )
      })}
      {band && (
        <div
          className="absolute pointer-events-none border border-dotted border-white mix-blend-difference"
          style={(() => {
            const rect = spanned(band.from, band.to)
            return { left: rect.x, top: rect.y, width: rect.width, height: rect.height }
          })()}
        />
      )}
      {menu && (
        <ContextMenu at={menu.at} items={menuItems(menu.key, menu.at)} onClose={() => setMenu(null)} />
      )}
      {confirm && (prompt?.kind === 'recycle' || prompt?.kind === 'purge' || prompt?.kind === 'empty') && (
        <MessageBox
          title={confirm.title}
          icon={confirm.icon}
          message={confirm.message}
          buttons={['Yes', 'No']}
          onClose={(answer) => {
            setPrompt(null)
            if (answer !== 'Yes') return
            if (prompt.kind === 'empty') fs.emptyRecycleBin()
            else answerDelete(prompt.nodes, prompt.kind === 'purge')
          }}
        />
      )}
      {prompt?.kind === 'error' && (
        <MessageBox
          title={prompt.title}
          icon="error"
          message={prompt.message}
          buttons={['OK']}
          onClose={() => setPrompt(null)}
        />
      )}
      {prompt?.kind === 'properties' && <PropertiesSheet id={prompt.id} onClose={() => setPrompt(null)} />}
      {prompt?.kind === 'shortcut' && (
        <CreateShortcut
          onClose={() => setPrompt(null)}
          onFinish={(target, name) => {
            const spec =
              target.kind === 'app'
                ? { kind: 'shortcut' as const, app: target.app }
                : { kind: 'shortcut' as const, target: target.id }
            const result = createNode(DESKTOP_DIR, name, spec)
            if ('error' in result) return result.error
            if (prompt.at) savePositions({ ...saved, [result.id]: snap(prompt.at) })
            select([result.id], result.id)
            return null
          }}
        />
      )}
      <TooltipLayer />
    </div>
  )
}
