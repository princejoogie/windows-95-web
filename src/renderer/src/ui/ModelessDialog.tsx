import { type ReactNode, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { WindowContext } from '../shell/context'
import { Outline, type Rect } from '../shell/Outline'
import { TitleBar, TitleButton } from './TitleBar'

export function ModelessDialog({
  title,
  children,
  onClose,
  blocked = false,
  className = '',
}: {
  title: string
  children: ReactNode
  onClose: () => void
  blocked?: boolean
  className?: string
}) {
  const owner = useContext(WindowContext)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [focused, setFocused] = useState(true)
  const dialog = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; rect: Rect } | null>(null)
  const [outline, setOutline] = useState<Rect | null>(null)
  const [alignment, setAlignment] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const start = drag.current
      if (start)
        setOutline({
          ...start.rect,
          x: start.rect.x + event.clientX - start.x,
          y: start.rect.y + event.clientY - start.y,
        })
    }
    const finish = (event: PointerEvent) => {
      const start = drag.current
      if (start && event.type === 'pointerup')
        setOffset((offset) => ({
          x: offset.x + event.clientX - start.x,
          y: offset.y + event.clientY - start.y,
        }))
      drag.current = null
      setOutline(null)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', finish)
    document.addEventListener('pointercancel', finish)
    return () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', finish)
      document.removeEventListener('pointercancel', finish)
    }
  }, [])
  useLayoutEffect(() => {
    const box = dialog.current?.getBoundingClientRect()
    if (box) setAlignment({ x: Math.round(box.x) - box.x, y: Math.round(box.y) - box.y })
  }, [])
  const signal = owner?.setDialogFocused
  // While focus is in here, the owner's caption goes inactive, as Windows 95 draws a focused modeless dialog.
  useEffect(() => {
    signal?.(focused)
    return () => signal?.(false)
  }, [signal, focused])
  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>('input,select,button:not([aria-label="Close"])')?.focus()
  }, [])
  if (!owner?.dialogHost) return null
  return createPortal(
    <>
      <div
        ref={dialog}
        role="dialog"
        aria-label={title}
        aria-modal="false"
        inert={blocked}
        className={`absolute left-1/2 top-[32px] z-30 pointer-events-auto p-[3px] bg-face bevel-window ${className}`}
        style={{
          transform: `translate(calc(-50% + ${offset.x + alignment.x}px), ${offset.y + alignment.y}px)`,
        }}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
        }}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Tab') {
            const controls = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                'input:not([disabled]), select:not([disabled]), button:not([disabled])',
              ),
            )
            const first = controls[0]
            const last = controls.at(-1)
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last?.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first?.focus()
            }
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          }
        }}
      >
        <TitleBar
          title={title}
          active={owner.api.focused && focused && !blocked}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            const box = dialog.current?.getBoundingClientRect()
            if (box)
              drag.current = {
                x: event.clientX,
                y: event.clientY,
                rect: { x: box.x, y: box.y, width: box.width, height: box.height },
              }
          }}
        >
          <TitleButton glyph="close" label="Close" onClick={onClose} />
        </TitleBar>
        {children}
      </div>
      {outline && <Outline rect={outline} />}
    </>,
    owner.dialogHost,
  )
}
