import { type RefObject, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { isProtected } from '../../fs/fs'
import { fs, fsStore, fsTimestamp, newNodeId } from '../../fs/store'
import { DESKTOP_DIR, type NodeId } from '../../fs/types'
import { createStore, useStore } from '../../lib/store'
import { planPaste } from '../../shell/clipboard'
import type { Point } from '../../shell/types'
import { remember } from '../../shell/undo'
import { fileIcon } from './art'

interface DropTarget {
  readonly id: NodeId | 'recycle'
  readonly owner: HTMLElement | null
}
interface Drag {
  readonly source: HTMLElement | null
  readonly ids: readonly NodeId[]
  readonly icon: string
  readonly pointer: Point
  readonly target: DropTarget | null
  readonly copy: boolean
  readonly offset: Point
}
interface Pending {
  readonly pointerId: number
  readonly start: Point
  readonly source: HTMLElement | null
  readonly ids: readonly NodeId[]
  readonly icon: string
}
interface Callbacks {
  readonly error: (title: string, message: string) => void
  readonly select: (ids: readonly NodeId[]) => void
  readonly recycle: (ids: readonly NodeId[]) => void
  readonly place: (ids: readonly NodeId[], offset: Point) => void
}
const targets = new Map<HTMLElement, Callbacks>()
const dragging = createStore<Drag | null, Drag | null>((_old, next) => next, null)
let pending: Pending | null = null

function targetAt(pointer: Point): DropTarget | null {
  const top = document.elementFromPoint(pointer.x, pointer.y)
  const desktopItem = top?.closest<HTMLElement>('[data-desktop-item]')?.dataset.desktopItem
  if (desktopItem === 'app:recyclebin') return { id: 'recycle', owner: null }
  const owner = top?.closest<HTMLElement>('[data-drop-folder]') ?? null
  const folderId = top?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId
  const folder = Object.values(fs.get().nodes).find((node) => node.id === (folderId ?? desktopItem))
  if (folder && (folder.kind === 'folder' || folder.kind === 'drive')) return { id: folder.id, owner }
  if (owner?.dataset.dropFolder === 'recycle') return { id: 'recycle', owner }
  const destination = Object.values(fs.get().nodes).find((node) => node.id === owner?.dataset.dropFolder)
  if (destination) return { id: destination.id, owner }
  if (top?.closest('[role="listbox"][aria-label="Desktop"]')) return { id: DESKTOP_DIR, owner: null }
  return null
}

function start(event: PointerEvent): void {
  if (event.button !== 0 || !(event.target instanceof Element) || event.target.closest('input')) return
  const item = event.target.closest<HTMLElement>('[data-node-id], [data-desktop-item]')
  const rawId = item?.dataset.nodeId ?? item?.dataset.desktopItem
  const node = Object.values(fs.get().nodes).find((entry) => entry.id === rawId)
  if (!node || !item) return
  const source = item.closest<HTMLElement>('.explorer-items')
  if (source && !targets.has(source)) return
  const container = source ?? item.parentElement
  const selected = item.getAttribute('aria-selected') === 'true'
  const ids = selected
    ? Array.from(container?.querySelectorAll<HTMLElement>('[aria-selected="true"]') ?? []).flatMap(
        (element) => {
          const id = element.dataset.nodeId ?? element.dataset.desktopItem
          const selectedNode = Object.values(fs.get().nodes).find((entry) => entry.id === id)
          return selectedNode ? [selectedNode.id] : []
        },
      )
    : [node.id]
  pending = {
    pointerId: event.pointerId,
    start: { x: event.clientX, y: event.clientY },
    source,
    ids,
    icon: fileIcon(node).icon,
  }
}

function move(event: PointerEvent): void {
  if (!pending || event.pointerId !== pending.pointerId) return
  const pointer = { x: event.clientX, y: event.clientY }
  if (!dragging.get() && Math.abs(pointer.x - pending.start.x) + Math.abs(pointer.y - pending.start.y) < 4)
    return
  if (!dragging.get() && pending.source) targets.get(pending.source)?.select(pending.ids)
  dragging.dispatch({
    source: pending.source,
    ids: pending.ids,
    icon: pending.icon,
    pointer,
    target: targetAt(pointer),
    copy: event.ctrlKey,
    offset: { x: pointer.x - pending.start.x, y: pointer.y - pending.start.y },
  })
}

function finish(event: PointerEvent): void {
  if (!pending || event.pointerId !== pending.pointerId) return
  const drag = dragging.get()
  pending = null
  dragging.dispatch(null)
  if (!drag || event.type === 'pointercancel') return
  const destination = targetAt({ x: event.clientX, y: event.clientY })
  if (!destination || (!drag.source && !destination.owner)) return
  const callbacks =
    (drag.source ? targets.get(drag.source) : null) ??
    (destination.owner ? targets.get(destination.owner) : null)
  const blockClick = (click: MouseEvent) => {
    click.preventDefault()
    click.stopImmediatePropagation()
  }
  document.addEventListener('click', blockClick, { once: true, capture: true })
  setTimeout(() => document.removeEventListener('click', blockClick, true), 0)
  if (destination.id === 'recycle') {
    callbacks?.recycle(drag.ids)
    return
  }
  if (
    !event.ctrlKey &&
    destination.owner === drag.source &&
    drag.ids.every((id) => fs.get().nodes[id]?.parent === destination.id)
  ) {
    callbacks?.place(drag.ids, drag.offset)
    return
  }
  if (!event.ctrlKey && drag.ids.some(isProtected)) {
    callbacks?.error('Error Moving File', 'This folder is required to run Windows and cannot be moved.')
    return
  }
  const before = fs.get()
  const plan = planPaste(
    before,
    { op: event.ctrlKey ? 'copy' : 'cut', ids: drag.ids },
    destination.id,
    fsTimestamp(),
    newNodeId,
  )
  if (!plan.ok) {
    callbacks?.error(plan.title, plan.message)
    return
  }
  for (const action of plan.actions) fsStore.dispatch(action)
  if (!event.ctrlKey) remember(before, fs.get(), 'Move')
  if (destination.owner) targets.get(destination.owner)?.select(plan.created)
}

export function useFileDrag(root: RefObject<HTMLDivElement | null>, callbacks: Callbacks): Drag | null {
  const latest = useRef(callbacks)
  latest.current = callbacks
  useEffect(() => {
    const element = root.current
    if (!element) return
    if (!targets.size) {
      document.addEventListener('pointerdown', start, true)
      document.addEventListener('pointermove', move, true)
      document.addEventListener('pointerup', finish, true)
      document.addEventListener('pointercancel', finish, true)
    }
    targets.set(element, {
      error: (title, message) => latest.current.error(title, message),
      select: (ids) => latest.current.select(ids),
      recycle: (ids) => latest.current.recycle(ids),
      place: (ids, offset) => latest.current.place(ids, offset),
    })
    return () => {
      targets.delete(element)
      if (!targets.size) {
        document.removeEventListener('pointerdown', start, true)
        document.removeEventListener('pointermove', move, true)
        document.removeEventListener('pointerup', finish, true)
        document.removeEventListener('pointercancel', finish, true)
        pending = null
        dragging.dispatch(null)
      }
    }
  }, [root])
  return useStore(dragging, (value) => value)
}

export function DragGhost({ drag }: { drag: Drag }) {
  return createPortal(
    <div className="explorer-drag-ghost" style={{ left: drag.pointer.x + 10, top: drag.pointer.y + 10 }}>
      <img src={drag.icon} alt="" draggable={false} />
      {drag.copy && <span>+</span>}
    </div>,
    document.body,
  )
}
