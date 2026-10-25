import { type PointerEvent as ReactPointerEvent, useCallback, useMemo, useRef, useState } from 'react'
import { children, isInside, uniqueName } from '../fs/fs'
import { createNode, fs, useFs } from '../fs/store'
import { DESKTOP_DIR, type FsNode, type NodeId } from '../fs/types'
import { ContextMenu, type MenuEntry } from '../ui/Menu'
import { MessageBox } from '../ui/MessageBox'
import { useKeyDown } from './context'
import { nodeIcon } from './nodeIcon'
import { apps } from './registry'
import { launch, openNode, useWindows, windowsStore } from './system'
import type { Point, Size } from './types'

const POSITIONS_KEY = 'w95.desktop.v1'
const CELL = { width: 75, height: 75 }
const ORIGIN = { x: 2, y: 4 }
const DRAG_THRESHOLD = 3

interface Item {
  readonly key: string
  readonly label: string
  readonly icon: string
  readonly overlay?: string | undefined
  /** Present for items that are files in the Desktop folder, which can be renamed and deleted. */
  readonly node?: FsNode
  readonly onDrop?: ((ids: readonly NodeId[]) => void) | undefined
  readonly open: () => void
}

type Positions = Readonly<Record<string, Point>>

function loadPositions(): Positions {
  try {
    return JSON.parse(localStorage.getItem(POSITIONS_KEY) ?? '{}') as Positions
  } catch {
    return {}
  }
}

const cellAt = (point: Point) => ({
  column: Math.round((point.x - ORIGIN.x) / CELL.width),
  row: Math.round((point.y - ORIGIN.y) / CELL.height),
})
const pointOf = (column: number, row: number): Point => ({
  x: ORIGIN.x + column * CELL.width,
  y: ORIGIN.y + row * CELL.height,
})

/** Saved spots first; everything else fills free cells top to bottom, then left to right. */
function layout(items: readonly Item[], saved: Positions, desktop: Size): Map<string, Point> {
  const rows = Math.max(1, Math.floor((desktop.height - ORIGIN.y) / CELL.height))
  const placed = new Map<string, Point>()
  const taken = new Set<string>()
  for (const item of items) {
    const point = saved[item.key]
    if (!point) continue
    placed.set(item.key, point)
    const cell = cellAt(point)
    taken.add(`${cell.column}:${cell.row}`)
  }
  let slot = 0
  for (const item of items) {
    if (placed.has(item.key)) continue
    while (taken.has(`${Math.floor(slot / rows)}:${slot % rows}`)) slot++
    placed.set(item.key, pointOf(Math.floor(slot / rows), slot % rows))
    slot++
  }
  return placed
}

function useItems(): Item[] {
  const state = useFs((s) => s)
  return useMemo(() => {
    const shell: Item[] = apps
      .filter((app) => app.desktop)
      .sort((a, b) => (a.desktop?.order ?? 0) - (b.desktop?.order ?? 0))
      .map((app) => ({
        key: `app:${app.id}`,
        label: app.desktop?.label ?? app.title,
        icon: app.desktop?.icon?.(state) ?? app.icon,
        onDrop: app.desktop?.onDrop,
        open: () => launch(app.id),
      }))
    const files: Item[] = children(state, DESKTOP_DIR).map((node) => {
      const { icon, overlay } = nodeIcon(node)
      return { key: node.id, label: node.name, icon, overlay, node, open: () => openNode(node.id) }
    })
    return [...shell, ...files]
  }, [state])
}

interface Drag {
  key: string
  pointer: Point
  from: Point
  offset: Point
  started: boolean
}

type Prompt = { kind: 'delete'; node: FsNode } | { kind: 'error'; title: string; message: string }

function DesktopIcon({
  item,
  at,
  selected,
  renaming,
  onPointerDown,
  onRename,
}: {
  item: Item
  at: Point
  selected: boolean
  renaming: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
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
      onDoubleClick={item.open}
    >
      <div className="relative size-8 mt-[2px]">
        <img src={item.icon} alt="" className="size-8" draggable={false} />
        {item.overlay && (
          <img src={item.overlay} alt="" className="absolute left-0 bottom-0" draggable={false} />
        )}
        {selected && (
          <div
            className="absolute inset-0 bg-select opacity-50"
            style={{ maskImage: `url("${item.icon}")`, maskSize: '100% 100%' }}
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
            const dot = item.node?.kind === 'file' ? event.target.value.lastIndexOf('.') : -1
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
          className={`mt-[4px] px-[1px] max-w-[72px] text-center leading-[13px] break-words text-white
            ${selected ? 'bg-select outline outline-1 outline-dotted outline-white' : 'line-clamp-2'}`}
        >
          {item.label}
        </span>
      )}
    </div>
  )
}

export function Desktop({ size }: { size: Size }) {
  const items = useItems()
  const desktopFocused = useWindows((s) => s.focused === null)
  const [saved, setSaved] = useState<Positions>(loadPositions)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ at: Point; key: string | null } | null>(null)
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)

  const positions = useMemo(() => layout(items, saved, size), [items, saved, size])
  const byKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items])

  const savePositions = useCallback((next: Positions) => {
    setSaved(next)
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(next))
  }, [])

  const selectedNodes = () => [...selected].flatMap((key) => byKey.get(key)?.node ?? [])

  const finishRename = (item: Item, name: string | null) => {
    setRenaming(null)
    if (name === null || !item.node || name === item.label) return
    const error = fs.rename(item.node.id, name)
    if (error) setPrompt({ kind: 'error', title: 'Error Renaming File', message: error })
  }

  const createOnDesktop = (kind: 'folder' | 'file') => {
    const state = fs.get()
    const name = uniqueName(state, DESKTOP_DIR, kind === 'folder' ? 'New Folder' : 'New Text Document.txt')
    const result = createNode(DESKTOP_DIR, name, kind === 'folder' ? { kind } : { kind, content: '' })
    if ('id' in result) {
      if (menu) savePositions({ ...saved, [result.id]: snap(menu.at) })
      setSelected(new Set([result.id]))
      setRenaming(result.id)
    }
  }

  const snap = (point: Point) => {
    const cell = cellAt(point)
    return pointOf(Math.max(0, cell.column), Math.max(0, cell.row))
  }

  const dropOn = (target: Item | undefined, dragged: Item): boolean => {
    if (!target || target.key === dragged.key || !dragged.node) return false
    const ids = selected.has(dragged.key) ? selectedNodes().map((n) => n.id) : [dragged.node.id]
    if (target.onDrop) {
      target.onDrop(ids)
      return true
    }
    const folder = target.node
    if (folder?.kind !== 'folder') return false
    for (const id of ids) {
      if (!isInside(fs.get(), folder.id, id)) fs.move(id, folder.id)
    }
    return true
  }

  const onIconPointerDown = (item: Item) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    windowsStore.dispatch({ type: 'blur' })
    setMenu(null)
    if (event.button === 2) {
      if (!selected.has(item.key)) setSelected(new Set([item.key]))
      return
    }
    if (event.button !== 0) return
    if (event.ctrlKey) {
      const next = new Set(selected)
      if (next.has(item.key)) next.delete(item.key)
      else next.add(item.key)
      setSelected(next)
      return
    }
    if (!selected.has(item.key)) setSelected(new Set([item.key]))
    const from = positions.get(item.key) ?? ORIGIN
    event.currentTarget.setPointerCapture(event.pointerId)
    const target = event.currentTarget
    const start: Drag = {
      key: item.key,
      pointer: { x: event.clientX, y: event.clientY },
      from,
      offset: { x: 0, y: 0 },
      started: false,
    }
    dragRef.current = start
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
      if (!current?.started) return
      const under = document
        .elementsFromPoint(e.clientX, e.clientY)
        .map((el) => el.closest<HTMLElement>('[data-desktop-item]')?.dataset.desktopItem)
        .find((key) => key && key !== current.key)
      if (dropOn(under ? byKey.get(under) : undefined, item)) return
      const moved = [...(selected.has(item.key) ? selected : [item.key])]
      const next = { ...saved }
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

  useKeyDown((event) => {
    if (!desktopFocused || renaming || prompt || event.target instanceof HTMLInputElement) return
    const nodes = selectedNodes()
    if (event.key === 'Enter') for (const key of selected) byKey.get(key)?.open()
    if (event.key === 'Delete' && nodes[0]) setPrompt({ kind: 'delete', node: nodes[0] })
    if (event.key === 'F2' && nodes.length === 1 && nodes[0]) setRenaming(nodes[0].id)
    if (event.key === 'a' && event.ctrlKey) {
      event.preventDefault()
      setSelected(new Set(items.map((item) => item.key)))
    }
  })

  const menuItems = (key: string | null): MenuEntry[] => {
    const item = key ? byKey.get(key) : undefined
    if (item) {
      const node = item.node
      return [
        { label: '&Open', bold: true, onSelect: item.open },
        'separator',
        { label: '&Delete', disabled: !node, onSelect: () => node && setPrompt({ kind: 'delete', node }) },
        { label: 'Rena&me', disabled: !node, onSelect: () => setRenaming(item.key) },
        'separator',
        { label: 'P&roperties', disabled: true },
      ]
    }
    return [
      {
        label: 'Arrange &Icons',
        items: [{ label: 'by &Name', onSelect: () => savePositions({}) }],
      },
      {
        label: 'Line &up Icons',
        onSelect: () => savePositions(Object.fromEntries([...positions].map(([k, p]) => [k, snap(p)]))),
      },
      'separator',
      { label: '&Paste', disabled: true },
      { label: 'Paste &Shortcut', disabled: true },
      'separator',
      {
        label: 'Ne&w',
        items: [
          { label: '&Folder', onSelect: () => createOnDesktop('folder') },
          'separator',
          { label: 'Text Document', onSelect: () => createOnDesktop('file') },
        ],
      },
      'separator',
      { label: 'P&roperties', disabled: true },
    ]
  }

  return (
    <div
      role="listbox"
      aria-label="Desktop"
      aria-multiselectable="true"
      tabIndex={0}
      className="absolute inset-0 bg-desktop outline-none"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return
        windowsStore.dispatch({ type: 'blur' })
        setSelected(new Set())
        setMenu(null)
      }}
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
            renaming={renaming === item.key}
            onPointerDown={onIconPointerDown(item)}
            onRename={(name) => finishRename(item, name)}
          />
        )
      })}
      {menu && <ContextMenu at={menu.at} items={menuItems(menu.key)} onClose={() => setMenu(null)} />}
      {prompt?.kind === 'delete' && (
        <MessageBox
          title="Confirm File Delete"
          icon="question"
          message={`Are you sure you want to send '${prompt.node.name}' to the Recycle Bin?`}
          buttons={['Yes', 'No']}
          onClose={(answer) => {
            setPrompt(null)
            if (answer !== 'Yes') return
            const nodes = selected.has(prompt.node.id) ? selectedNodes() : [prompt.node]
            for (const node of nodes) fs.recycle(node.id)
            setSelected(new Set())
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
    </div>
  )
}
