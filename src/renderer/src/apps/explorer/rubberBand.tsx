import { type PointerEvent as ReactPointerEvent, useState } from 'react'
import { createPortal } from 'react-dom'
import { type Rect, spanned, touched } from '../../shell/desktopModel'
import type { Selection } from './model'

export function useRubberBand(selection: Selection, select: (value: Selection) => void) {
  const [band, setBand] = useState<Rect | null>(null)
  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !(event.target instanceof Element) || event.target.closest('.explorer-item'))
      return
    const root = event.currentTarget
    const from = { x: event.clientX, y: event.clientY }
    const rects = new Map<string, Rect[]>()
    for (const item of root.querySelectorAll<HTMLElement>('[data-node-id], [data-shell-item]')) {
      const id = item.dataset.nodeId ?? item.dataset.shellItem
      if (!id) continue
      rects.set(
        id,
        Array.from(item.querySelectorAll('.explorer-icon, .explorer-name')).map((part) => {
          const rect = part.getBoundingClientRect()
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        }),
      )
    }
    const base = event.ctrlKey ? selection.ids : new Set<string>()
    if (!event.ctrlKey) select({ ids: base, focus: null, anchor: null })
    root.setPointerCapture(event.pointerId)
    const move = (next: PointerEvent) => {
      const rect = spanned(from, { x: next.clientX, y: next.clientY })
      if (rect.width + rect.height < 4) return
      setBand(rect)
      select({
        ids: new Set([...base, ...touched(rect, rects)]),
        focus: selection.focus,
        anchor: selection.anchor,
      })
    }
    const finish = () => {
      root.removeEventListener('pointermove', move)
      root.removeEventListener('pointerup', finish)
      root.removeEventListener('pointercancel', finish)
      setBand(null)
    }
    root.addEventListener('pointermove', move)
    root.addEventListener('pointerup', finish)
    root.addEventListener('pointercancel', finish)
  }
  const rectangle = band
    ? createPortal(
        <div
          data-rubber-band
          className="explorer-rubber-band"
          style={{ left: band.x, top: band.y, width: band.width, height: band.height }}
        />,
        document.body,
      )
    : null
  return { start, rectangle }
}
