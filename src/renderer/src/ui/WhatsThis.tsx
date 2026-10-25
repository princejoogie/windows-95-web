import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Popup {
  readonly text: string
  readonly x: number
  readonly y: number
}

/**
 * The caption `?` of a Windows 95 dialog. `arm` turns the pointer into the arrow with a question mark. The next
 * click on a control shows its `data-help` text in a popup instead of using the control. Esc or a click on
 * anything without help cancels.
 */
export function useWhatsThis(): { arm: () => void; layer: ReactNode } {
  const [armed, setArmed] = useState(false)
  const [popup, setPopup] = useState<Popup | null>(null)
  const overlay = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!armed && !popup) return
    const key = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopImmediatePropagation()
      setArmed(false)
      setPopup(null)
    }
    const dismiss = (event: PointerEvent) => {
      if (!popup || event.target === overlay.current) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setPopup(null)
    }
    addEventListener('keydown', key, true)
    addEventListener('pointerdown', dismiss, true)
    return () => {
      removeEventListener('keydown', key, true)
      removeEventListener('pointerdown', dismiss, true)
    }
  }, [armed, popup])

  const pick = (x: number, y: number) => {
    const target = document
      .elementsFromPoint(x, y)
      .find((element) => element !== overlay.current)
      ?.closest<HTMLElement>('[data-help]')
    setArmed(false)
    setPopup(target?.dataset.help ? { text: target.dataset.help, x, y } : null)
  }

  return {
    arm: () => {
      setPopup(null)
      setArmed(true)
    },
    layer: (
      <>
        {armed && (
          <div
            ref={overlay}
            data-whats-this
            className="absolute inset-0 z-30 cursor-help"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              pick(event.clientX, event.clientY)
            }}
          />
        )}
        {popup && <HelpPopup popup={popup} />}
      </>
    ),
  }
}

function HelpPopup({ popup }: { popup: Popup }) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    setPosition({
      left: Math.round(Math.max(0, Math.min(popup.x, innerWidth - box.width))),
      top: Math.round(Math.max(0, Math.min(popup.y + 2, innerHeight - box.height))),
    })
  }, [popup])
  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="tooltip max-w-[240px] whitespace-normal px-[6px] py-[4px] shadow-[2px_2px_0_#000]"
      style={position ?? { left: popup.x, top: popup.y, visibility: 'hidden' }}
    >
      {popup.text}
    </div>,
    document.body,
  )
}
