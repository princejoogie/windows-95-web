import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Accel } from '../../ui/text'

export interface ConsoleMenuItem {
  readonly label: string
  readonly select: () => void
  readonly disabled?: boolean
  readonly checked?: boolean
  readonly shortcut?: string
}

export function ConsoleMenu({
  at,
  items,
  onClose,
}: {
  at: { x: number; y: number }
  items: readonly ConsoleMenuItem[]
  onClose: () => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const [hot, setHot] = useState(0)
  const latest = useRef({ items, onClose, hot })
  latest.current = { items, onClose, hot }
  useEffect(() => {
    const previous = document.activeElement
    root.current?.querySelector('button')?.focus()
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) latest.current.onClose()
    }
    const key = (event: KeyboardEvent) => {
      const { items, onClose, hot } = latest.current
      event.stopImmediatePropagation()
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault()
        const direction = event.key === 'ArrowUp' ? -1 : 1
        let index = event.key === 'Home' ? -1 : event.key === 'End' ? 0 : hot
        const step = event.key === 'End' ? -1 : direction
        do {
          index = (index + step + items.length) % items.length
        } while (items[index]?.disabled)
        setHot(index)
        root.current?.querySelectorAll('button')[index]?.focus()
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        const item = items[hot]
        if (item && !item.disabled) {
          onClose()
          item.select()
        }
      } else if (event.key.length === 1) {
        const item = items.find(
          (item) => item.label.match(/&(.)/)?.[1]?.toLowerCase() === event.key.toLowerCase(),
        )
        if (item && !item.disabled) {
          event.preventDefault()
          onClose()
          item.select()
        }
      }
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', key, true)
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])
  return createPortal(
    <div
      ref={root}
      role="menu"
      aria-label="MS-DOS Prompt menu"
      className="dos-menu bevel-window bg-face p-[3px]"
      style={{
        left: Math.max(0, Math.min(at.x, innerWidth - 204)),
        top: Math.max(0, Math.min(at.y, innerHeight - items.length * 19 - 6)),
      }}
    >
      {items.map((item, index) => (
        <button
          type="button"
          {...(item.checked === undefined
            ? { role: 'menuitem' }
            : { role: 'menuitemcheckbox', 'aria-checked': item.checked })}
          aria-disabled={item.disabled}
          key={item.label}
          className={`flex h-[19px] w-full items-center text-left outline-none ${hot === index ? 'bg-select text-white' : ''} ${item.disabled ? 'text-embossed' : ''}`}
          onPointerEnter={() => setHot(index)}
          onClick={() => {
            if (!item.disabled) {
              onClose()
              item.select()
            }
          }}
        >
          <span className="w-[20px] text-center">{item.checked ? '✓' : ''}</span>
          <span className="flex-1">
            <Accel label={item.label} />
          </span>
          <span className="px-[8px]">{item.shortcut}</span>
        </button>
      ))}
    </div>,
    document.body,
  )
}
