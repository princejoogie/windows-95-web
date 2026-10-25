import { type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ShellDialogHost, WindowContext } from '../shell/context'
import { TitleBar, TitleButton } from './TitleBar'

interface DialogProps {
  title: string
  children: ReactNode
  onClose?: () => void
  icon?: string
  /** Shell-level only: dithers the whole screen behind the dialog, as Shut Down does. */
  dim?: boolean
  className?: string
}

/**
 * A modal dialog. Inside an app it covers and blocks its own window only, and stays above it. Outside
 * an app it renders in the shell's dialog layer. Escape closes it; drag the title bar to move it.
 */
export function Dialog({ title, children, onClose, icon, dim, className = '' }: DialogProps) {
  const owner = useContext(WindowContext)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; from: { x: number; y: number } } | null>(null)
  const shellHost = useContext(ShellDialogHost)
  const host = owner ? owner.dialogHost : shellHost
  const active = owner ? owner.api.focused : true

  const latestClose = useRef(onClose)
  latestClose.current = onClose
  useEffect(() => {
    if (!active) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !latestClose.current) return
      event.stopImmediatePropagation()
      latestClose.current()
    }
    document.addEventListener('keydown', onEscape, true)
    return () => document.removeEventListener('keydown', onEscape, true)
  }, [active])

  if (!host) return null

  return createPortal(
    <div className="absolute inset-0 z-40 pointer-events-auto">
      {dim && (
        <div className="absolute inset-0 bg-[repeating-conic-gradient(#000_0_25%,transparent_0_50%)] bg-size-[2px_2px]" />
      )}
      <div
        role="dialog"
        aria-label={title}
        className={`absolute left-1/2 top-1/2 flex flex-col p-[3px] bg-face bevel-window ${className}`}
        style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}
      >
        <TitleBar
          title={title}
          active={active}
          icon={icon}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = { x: event.clientX, y: event.clientY, from: offset }
          }}
          onPointerMove={(event) => {
            const start = drag.current
            if (!start) return
            setOffset({
              x: start.from.x + event.clientX - start.x,
              y: start.from.y + event.clientY - start.y,
            })
          }}
          onPointerUp={() => {
            drag.current = null
          }}
        >
          {onClose && <TitleButton glyph="close" label="Close" onClick={onClose} />}
        </TitleBar>
        {children}
      </div>
    </div>,
    host,
  )
}
