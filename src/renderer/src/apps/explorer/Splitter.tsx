import { useState } from 'react'
import { createPortal } from 'react-dom'

const MIN_TREE = 100
const MIN_CONTENTS = 120

/**
 * The sash between Explorer's panes. Dragging it tracks a dithered bar, and the tree pane takes the new width
 * when the button is released, as Windows 95 does.
 */
export function Splitter({ width, onResize }: { width: number; onResize: (width: number) => void }) {
  const [bar, setBar] = useState<{ left: number; top: number; height: number } | null>(null)
  return (
    <>
      <hr
        aria-label="Folder pane width"
        aria-orientation="vertical"
        className="explorer-splitter"
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          const body = event.currentTarget.parentElement
          if (!body) return
          const box = body.getBoundingClientRect()
          const widthAt = (x: number) =>
            Math.round(Math.max(MIN_TREE, Math.min(width + x - event.clientX, box.width - MIN_CONTENTS)))
          const track = (x: number) =>
            setBar({ left: box.left + widthAt(x), top: box.top, height: box.height })
          track(event.clientX)
          const move = (e: PointerEvent) => track(e.clientX)
          const end = (e: PointerEvent) => {
            globalThis.removeEventListener('pointermove', move)
            globalThis.removeEventListener('pointerup', end)
            globalThis.removeEventListener('pointercancel', end)
            setBar(null)
            if (e.type === 'pointerup') onResize(widthAt(e.clientX))
          }
          globalThis.addEventListener('pointermove', move)
          globalThis.addEventListener('pointerup', end)
          globalThis.addEventListener('pointercancel', end)
        }}
      />
      {bar && createPortal(<div className="explorer-splitter-bar" style={bar} />, document.body)}
    </>
  )
}
