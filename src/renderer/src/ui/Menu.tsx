import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Point } from '../shell/types'
import { Accel } from './text'

export type MenuEntry =
  | {
      readonly label: string
      readonly onSelect?: () => void
      readonly checked?: boolean
      readonly disabled?: boolean
      readonly shortcut?: string
      readonly icon?: string
      readonly bold?: boolean
      readonly items?: readonly MenuEntry[]
    }
  | 'separator'

const SUBMENU_DELAY_MS = 300

function Arrow() {
  return (
    <svg width="4" height="7" viewBox="0 0 4 7" shapeRendering="crispEdges" className="fill-current">
      <path d="M0 0h1v1h1v1h1v1h1v1H3v1H2v1H1v1H0z" />
    </svg>
  )
}

function Check({ on }: { on: boolean }) {
  if (!on) return null
  return (
    <svg width="7" height="7" viewBox="0 0 7 7" shapeRendering="crispEdges" className="fill-current">
      <path d="M6 0h1v3H6v1H5v1H4v1H3v1H2V6H1V5H0V2h1v1h1v1h1V3h1V2h1V1h1z" />
    </svg>
  )
}

interface MenuListProps {
  items: readonly MenuEntry[]
  onClose: () => void
  style?: CSSProperties
  className?: string
}

/** A popup menu. Submenus open on hover after a short delay, the way Windows does it. */
export function MenuList({ items, onClose, style, className = '' }: MenuListProps) {
  const [hot, setHot] = useState<number | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [lift, setLift] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  // A submenu that would run off the bottom of the screen moves up until it fits.
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect()
    if (box) setLift(Math.max(0, Math.min(box.bottom - innerHeight, box.top)))
  }, [])

  const hover = (index: number, hasSubmenu: boolean) => {
    setHot(index)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(hasSubmenu ? index : null), SUBMENU_DELAY_MS)
  }

  return (
    <div
      ref={ref}
      role="menu"
      className={`absolute z-50 min-w-[120px] p-[3px] bg-face bevel-window ${className}`}
      style={{ ...style, marginTop: -lift }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {items.map((item, index) => {
        if (item === 'separator') {
          // biome-ignore lint/suspicious/noArrayIndexKey: separators have no identity
          return <div key={`sep-${index}`} className="my-[3px] mx-[1px] h-[2px] border-t border-shadow border-b border-b-white" />
        }
        const submenu = item.items
        const lit = hot === index
        return (
          <div key={item.label} className="relative">
            <div
              role="menuitem"
              aria-disabled={item.disabled}
              aria-haspopup={submenu ? 'menu' : undefined}
              className={`flex items-center h-[18px] pr-[6px] whitespace-nowrap ${lit ? 'bg-select text-white' : ''}
                ${item.disabled ? (lit ? 'text-shadow' : 'text-embossed') : ''} ${item.bold ? 'font-bold' : ''}`}
              onPointerEnter={() => hover(index, Boolean(submenu))}
              onPointerLeave={() => setHot((current) => (current === index && open !== index ? null : current))}
              onClick={() => {
                if (item.disabled) return
                if (submenu) {
                  clearTimeout(timer.current)
                  setOpen(index)
                  return
                }
                onClose()
                item.onSelect?.()
              }}
            >
              <span className="w-[20px] flex justify-center shrink-0">
                {item.icon ? <img src={item.icon} alt="" className="size-4" /> : <Check on={Boolean(item.checked)} />}
              </span>
              <span className="flex-1 pr-[16px]">
                <Accel label={item.label} />
              </span>
              {item.shortcut && <span className="pl-[12px]">{item.shortcut}</span>}
              {submenu && <Arrow />}
            </div>
            {submenu && open === index && (
              <MenuList items={submenu} onClose={onClose} style={{ left: '100%', top: -3 }} className="ml-[-3px]" />
            )}
          </div>
        )
      })}
    </div>
  )
}

export interface MenuBarMenu {
  readonly label: string
  readonly items: readonly MenuEntry[]
}

/** The File, Edit, Help strip under a title bar. */
export function MenuBar({ menus }: { menus: readonly MenuBarMenu[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open === null) return
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null)
    }
    document.addEventListener('pointerdown', close, true)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close, true)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div ref={root} role="menubar" className="relative flex h-[19px] shrink-0 bg-face">
      {menus.map((menu, index) => (
        <div key={menu.label} className="relative">
          <button
            type="button"
            className={`h-[19px] px-[6px] outline-none ${open === index ? 'bevel-shallow' : ''}`}
            onPointerDown={(event) => {
              event.stopPropagation()
              setOpen(open === index ? null : index)
            }}
            onPointerEnter={() => open !== null && setOpen(index)}
          >
            <span className={open === index ? 'relative left-px top-px' : ''}>
              <Accel label={menu.label} />
            </span>
          </button>
          {open === index && <MenuList items={menu.items} onClose={() => setOpen(null)} style={{ left: 0, top: '100%' }} />}
        </div>
      ))}
    </div>
  )
}

/** A right-click menu at a viewport point. It flips to stay on screen. */
export function ContextMenu({ at, items, onClose }: { at: Point; items: readonly MenuEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(at)

  useLayoutEffect(() => {
    const box = ref.current?.firstElementChild?.getBoundingClientRect()
    if (!box) return
    setPosition({
      x: at.x + box.width > innerWidth ? Math.max(0, at.x - box.width) : at.x,
      y: at.y + box.height > innerHeight ? Math.max(0, at.y - box.height) : at.y,
    })
  }, [at])

  useEffect(() => {
    const close = () => onClose()
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    addEventListener('blur', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
      removeEventListener('blur', close)
    }
  }, [onClose])

  return createPortal(
    <div ref={ref} className="fixed z-[10000]" style={{ left: position.x, top: position.y }}>
      <MenuList items={items} onClose={onClose} style={{ position: 'relative' }} />
    </div>,
    document.body,
  )
}

