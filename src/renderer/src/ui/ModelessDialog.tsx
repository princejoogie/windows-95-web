import { type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { WindowContext } from '../shell/context'
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
  const drag = useRef<{ x: number; y: number; from: { x: number; y: number } } | null>(null)
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
    <div
      ref={dialog}
      role="dialog"
      aria-label={title}
      aria-modal="false"
      inert={blocked}
      className={`absolute left-1/2 top-[32px] z-30 pointer-events-auto p-[3px] bg-face bevel-window ${className}`}
      style={{ transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)` }}
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
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { x: event.clientX, y: event.clientY, from: offset }
        }}
        onPointerMove={(event) => {
          const start = drag.current
          if (start)
            setOffset({
              x: start.from.x + event.clientX - start.x,
              y: start.from.y + event.clientY - start.y,
            })
        }}
        onPointerUp={() => {
          drag.current = null
        }}
      >
        <TitleButton glyph="close" label="Close" onClick={onClose} />
      </TitleBar>
      {children}
    </div>,
    owner.dialogHost,
  )
}
