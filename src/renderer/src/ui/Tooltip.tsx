import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const SHOW_DELAY_MS = 500
const HIDE_AFTER_MS = 5000
/** The tip sits below the pointer, clear of the 32px arrow cursor's tail. */
const BELOW_POINTER = 20

interface Tip {
  readonly text: string
  readonly x: number
  readonly y: number
}

/** An "in-place" tip only repeats a label, so it shows only while that label is cut off. */
function isRedundant(element: HTMLElement, text: string): boolean {
  if (element.textContent?.trim() !== text.trim()) return false
  const clipped = [element, ...element.querySelectorAll<HTMLElement>('*')].some(
    (node) => node.scrollWidth > node.clientWidth,
  )
  return !clipped
}

/** Takes the text from `title`, which it removes so Chromium's own tooltip never appears. */
function tipText(element: HTMLElement): string {
  const title = element.getAttribute('title')
  if (title !== null) {
    element.dataset.tooltip = title
    element.removeAttribute('title')
  }
  return element.dataset.tooltip ?? ''
}

/**
 * Draws a Windows 95 tooltip for every element with a `title`: #ffffe1 with a 1px black border, shown after
 * the pointer rests for half a second, hidden on any click or key. Mount it once.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    let target: HTMLElement | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let visible = false
    let spent = false
    let pointer = { x: 0, y: 0 }

    const hide = () => {
      clearTimeout(timer)
      visible = false
      setTip(null)
    }
    const show = () => {
      if (!target?.isConnected || spent) return
      const text = tipText(target)
      if (!text || isRedundant(target, text)) return
      visible = true
      setTip({ text, x: pointer.x, y: pointer.y })
      clearTimeout(timer)
      timer = setTimeout(() => {
        spent = true
        hide()
      }, HIDE_AFTER_MS)
    }
    const over = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY }
      const next =
        event.target instanceof Element ? event.target.closest<HTMLElement>('[title], [data-tooltip]') : null
      if (next === target) return
      if (next) tipText(next)
      const wasVisible = visible
      hide()
      target = next
      spent = false
      if (!target) return
      if (wasVisible) show()
      else timer = setTimeout(show, SHOW_DELAY_MS)
    }
    const move = (event: PointerEvent) => {
      if (!visible) pointer = { x: event.clientX, y: event.clientY }
    }
    const dismiss = () => {
      if (target) spent = true
      hide()
    }
    document.addEventListener('pointerover', over, true)
    document.addEventListener('pointermove', move, true)
    document.addEventListener('pointerdown', dismiss, true)
    document.addEventListener('keydown', dismiss, true)
    document.addEventListener('wheel', dismiss, true)
    addEventListener('blur', dismiss)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerover', over, true)
      document.removeEventListener('pointermove', move, true)
      document.removeEventListener('pointerdown', dismiss, true)
      document.removeEventListener('keydown', dismiss, true)
      document.removeEventListener('wheel', dismiss, true)
      removeEventListener('blur', dismiss)
    }
  }, [])

  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect()
    if (!tip || !box) {
      setPosition(null)
      return
    }
    const below = tip.y + BELOW_POINTER
    setPosition({
      left: Math.max(0, Math.min(tip.x, innerWidth - box.width)),
      top: below + box.height <= innerHeight ? below : Math.max(0, tip.y - box.height - 2),
    })
  }, [tip])

  if (!tip) return null
  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="tooltip"
      style={position ?? { left: tip.x, top: tip.y + BELOW_POINTER, visibility: 'hidden' }}
    >
      {tip.text}
    </div>,
    document.body,
  )
}
