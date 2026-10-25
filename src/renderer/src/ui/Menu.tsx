import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { WindowContext } from '../shell/context'
import { shellEvents } from '../shell/events'
import { type MenuState, menuKey } from '../shell/menuMachine'
import type { Point } from '../shell/types'
import { highlightedHelp } from './menuHelp'
import { Accel, accelKey } from './text'

export type MenuEntry =
  | {
      readonly label: string
      readonly onSelect?: () => void
      readonly checked?: boolean
      readonly disabled?: boolean
      readonly shortcut?: string
      readonly icon?: string
      readonly bold?: boolean
      /** What the app's status bar says while this item is highlighted. */
      readonly help?: string
      readonly items?: readonly MenuEntry[]
    }
  | 'separator'

let activeMenu: symbol | null = null
let tracking = false
export const menuIsActive = () => activeMenu !== null
export function beginMenuTracking() {
  tracking = true
}

function useMenu(
  roots: readonly (readonly MenuEntry[])[],
  initial: MenuState,
  bar: boolean,
  onClose?: () => void,
  titles: readonly string[] = [],
) {
  const [state, setState] = useState<MenuState>(initial)
  const token = useRef(Symbol())
  const previousFocus = useRef<HTMLElement | null>(null)
  const restoreFocus = useCallback(() => {
    const previous = previousFocus.current
    previousFocus.current = null
    if (previous?.isConnected) previous.focus({ preventScroll: true })
  }, [])
  const latest = useRef({ roots, state, onClose, titles })
  latest.current = { roots, state, onClose, titles }
  const active = state.kind !== 'closed'
  useEffect(() => {
    if (!active) return
    activeMenu = token.current
    const previous = document.activeElement
    previousFocus.current = previous instanceof HTMLElement ? previous : null
    if (previous instanceof HTMLElement) previous.blur()
    const key = (event: KeyboardEvent) => {
      if (activeMenu !== token.current) return
      event.preventDefault()
      event.stopImmediatePropagation()
      const title = event.altKey
        ? latest.current.titles.findIndex((label) => accelKey(label) === event.key.toLowerCase())
        : -1
      const next: ReturnType<typeof menuKey> =
        title >= 0
          ? { state: { kind: 'open', title, path: [0] } }
          : menuKey(latest.current.state, event.key, latest.current.roots, bar, latest.current.titles)
      if (next.command) restoreFocus()
      setState(next.state)
      if (next.state.kind === 'closed') latest.current.onClose?.()
      if (next.command) {
        shellEvents.emit('menu-command')
        next.command.onSelect?.()
      }
    }
    const swallow = (event: KeyboardEvent) => {
      if (activeMenu === token.current) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }
    document.addEventListener('keydown', key, true)
    document.addEventListener('keypress', swallow, true)
    return () => {
      if (activeMenu === token.current) activeMenu = null
      tracking = false
      document.removeEventListener('keydown', key, true)
      document.removeEventListener('keypress', swallow, true)
      restoreFocus()
    }
  }, [active, bar, restoreFocus])
  const close = () => {
    setState({ kind: 'closed' })
    onClose?.()
  }
  const pick = (item: Exclude<MenuEntry, 'separator'>, path: readonly number[]) => {
    if (item.disabled) return
    if (item.items)
      setState({
        kind: tracking ? 'tracking' : 'open',
        title: state.kind === 'closed' ? 0 : state.title,
        path: [...path, -1],
      })
    else {
      restoreFocus()
      close()
      shellEvents.emit('menu-command')
      item.onSelect?.()
    }
  }
  return { state, setState, close, pick }
}
type Controller = ReturnType<typeof useMenu>

function Arrow() {
  return (
    <svg
      aria-hidden="true"
      width="4"
      height="7"
      viewBox="0 0 4 7"
      shapeRendering="crispEdges"
      className="fill-current"
    >
      <path d="M0 0h1v1h1v1h1v1h1v1H3v1H2v1H1v1H0z" />
    </svg>
  )
}

function MenuTree({
  items,
  controller,
  prefix = [],
  density = 'menu',
  style,
  className = '',
  label,
  dropsBelow = false,
}: {
  items: readonly MenuEntry[]
  controller: Controller
  prefix?: readonly number[]
  density?: 'menu' | 'start' | 'start-root'
  style?: CSSProperties | undefined
  className?: string | undefined
  label?: string | undefined
  /** Hangs below its parent, like a menu bar title, so it opens upward when the screen runs out. */
  dropsBelow?: boolean
}) {
  const { state, setState, pick } = controller
  const path = state.kind === 'open' || state.kind === 'tracking' ? state.path : []
  const hot = path[prefix.length]
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [shift, setShift] = useState({ x: 0, y: 0 })
  useEffect(() => () => clearTimeout(timer.current), [])
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const parent = ref.current?.parentElement?.getBoundingClientRect()
    const parentWidth = parent?.width ?? 0
    const above = box.top - (parent?.height ?? 0) - box.height
    setShift({
      x:
        box.right > innerWidth && prefix.length > 0
          ? Math.max(-box.left, -box.width - parentWidth + 3)
          : Math.min(0, innerWidth - box.right),
      y:
        dropsBelow && box.bottom > innerHeight && above >= 0
          ? above - box.top
          : Math.min(0, innerHeight - box.bottom),
    })
  }, [prefix.length, dropsBelow])
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className={`absolute z-50 min-w-[120px] p-[3px] bg-face bevel-window ${className}`}
      style={{ ...style, marginLeft: shift.x, marginTop: shift.y }}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        tracking = true
      }}
    >
      {items.map((item, index) => {
        if (item === 'separator')
          return (
            <hr
              key={`separator-${items.slice(index + 1).find((next) => next !== 'separator')?.label ?? 'last'}`}
              className="my-[3px] mx-px h-[2px] border-t border-shadow border-b border-b-white"
            />
          )
        const selected = hot === index
        const itemPath = [...prefix, index]
        const expanded = selected && path.length > itemPath.length && Boolean(item.items)
        return (
          <div key={item.label} className="relative">
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={item.disabled}
              aria-haspopup={item.items ? 'menu' : undefined}
              aria-expanded={item.items ? expanded : undefined}
              className={`flex w-full text-left outline-none items-center pr-[6px] whitespace-nowrap ${density === 'start-root' ? 'h-[32px] gap-[8px] pl-[4px]' : density === 'start' ? 'h-[20px]' : 'h-[17px]'} ${selected ? 'bg-select text-white' : ''} ${item.disabled ? (selected ? 'text-shadow' : 'text-embossed') : ''} ${item.bold ? 'font-bold' : ''}`}
              onPointerEnter={() => {
                clearTimeout(timer.current)
                if (state.kind === 'closed' || state.kind === 'bar-armed') return
                if (!selected) setState({ ...state, path: itemPath })
                timer.current = setTimeout(() => {
                  if (item.items && !item.disabled)
                    setState({
                      kind: tracking ? 'tracking' : 'open',
                      title: state.title,
                      path: [...itemPath, -1],
                    })
                }, 300)
              }}
              onPointerUp={() => {
                if (tracking || state.kind === 'tracking') {
                  tracking = false
                  clearTimeout(timer.current)
                  pick(item, itemPath)
                }
              }}
              onClick={(event) => {
                if (event.detail === 0) pick(item, itemPath)
              }}
            >
              <span
                className={`${density === 'start-root' ? 'size-8' : 'w-[20px]'} flex justify-center shrink-0`}
              >
                {item.icon ? (
                  <img
                    src={item.icon}
                    alt=""
                    draggable={false}
                    className={density === 'start-root' ? 'size-8' : 'size-4'}
                  />
                ) : item.checked ? (
                  <svg width="7" height="7" viewBox="0 0 7 7" className="fill-current">
                    <title>Checked</title>
                    <path d="M6 0h1v3H6v1H5v1H4v1H3v1H2V6H1V5H0V2h1v1h1v1h1V3h1V2h1V1h1z" />
                  </svg>
                ) : null}
              </span>
              <span className="flex-1 pr-[16px]">
                <Accel label={item.label} />
              </span>
              {item.shortcut && <span className="pl-[12px]">{item.shortcut}</span>}
              {item.items && <Arrow />}
            </button>
            {item.items && expanded && (
              <MenuTree
                items={item.items}
                controller={controller}
                prefix={itemPath}
                density={density === 'menu' ? 'menu' : 'start'}
                style={{ left: '100%', top: -3 }}
                className="ml-[-3px]"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function MenuList({
  items,
  onClose,
  style,
  className,
  density = 'menu',
  label,
}: {
  items: readonly MenuEntry[]
  onClose: () => void
  style?: CSSProperties
  className?: string
  density?: 'menu' | 'start' | 'start-root'
  label?: string
}) {
  const controller = useMenu(
    [items],
    { kind: tracking ? 'tracking' : 'open', title: 0, path: [-1] },
    false,
    onClose,
  )
  return (
    <MenuTree
      items={items}
      controller={controller}
      style={style}
      className={className}
      density={density}
      label={label}
    />
  )
}

/**
 * Lifts a menu bar's drop-down out of the window, as Windows 95 menus are popups of their own: a window's client
 * area clips its content, so a tall menu or one that opens upward would otherwise be cut off.
 */
function BarPopup({
  anchor,
  popup,
  children,
}: {
  anchor: HTMLElement | null
  popup: RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  useLayoutEffect(() => setRect(anchor?.getBoundingClientRect() ?? null), [anchor])
  if (!rect) return null
  return createPortal(
    <div
      ref={popup}
      className="fixed z-[10050] pointer-events-none"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    >
      {children}
    </div>,
    document.body,
  )
}

export interface MenuBarMenu {
  readonly label: string
  readonly items: readonly MenuEntry[]
}
export function MenuBar({
  menus,
  onHelp,
}: {
  menus: readonly MenuBarMenu[]
  /** Receives the highlighted item's help while a menu is open, and `null` when the menus close. */
  onHelp?: (help: string | null) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const titleRefs = useRef<(HTMLDivElement | null)[]>([])
  const owner = useContext(WindowContext)
  const focused = owner?.api.focused ?? true
  const controller = useMenu(
    menus.map((menu) => menu.items),
    { kind: 'closed' },
    true,
    undefined,
    menus.map((menu) => menu.label),
  )
  const { state, setState, close } = controller
  const latest = useRef(menus)
  latest.current = menus
  const help = highlightedHelp(
    menus.map((menu) => menu.items),
    state,
  )
  const reportHelp = useRef(onHelp)
  reportHelp.current = onHelp
  useEffect(() => reportHelp.current?.(help), [help])
  useEffect(() => {
    if (!focused) {
      setState({ kind: 'closed' })
      return
    }
    let alt = false
    const keyDown = (event: KeyboardEvent) => {
      // Alt arms the bar only as a tap. Any other key in between, such as Space for the system menu, cancels it.
      if (event.key !== 'Alt') alt = false
      if (menuIsActive() || (event.target instanceof Element && event.target.closest('[role="dialog"]')))
        return
      if (event.key === 'Alt') {
        alt = true
        return
      }
      if (event.altKey) {
        const title = latest.current.findIndex((menu) => accelKey(menu.label) === event.key.toLowerCase())
        if (title >= 0) {
          event.preventDefault()
          event.stopImmediatePropagation()
          setState({ kind: 'open', title, path: [0] })
        }
      }
      if (event.key === 'F10' && !event.shiftKey) {
        event.preventDefault()
        setState({ kind: 'bar-armed', title: 0 })
      }
    }
    const keyUp = (event: KeyboardEvent) => {
      if (event.key === 'Alt' && alt && !menuIsActive()) {
        alt = false
        event.preventDefault()
        setState({ kind: 'bar-armed', title: 0 })
      }
    }
    document.addEventListener('keydown', keyDown, true)
    document.addEventListener('keyup', keyUp, true)
    return () => {
      document.removeEventListener('keydown', keyDown, true)
      document.removeEventListener('keyup', keyUp, true)
    }
  }, [focused, setState])
  useEffect(() => {
    if (state.kind === 'closed') return
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target) &&
        !popup.current?.contains(event.target)
      )
        close()
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  })
  return (
    <div ref={root} role="menubar" className="relative flex h-[19px] shrink-0 bg-face">
      {menus.map((menu, title) => (
        <div
          key={menu.label}
          ref={(element) => {
            titleRefs.current[title] = element
          }}
          className="relative"
        >
          <button
            type="button"
            tabIndex={-1}
            className={`h-[19px] px-[6px] outline-none ${state.kind !== 'closed' && state.title === title ? (state.kind === 'bar-armed' ? 'bg-select text-white' : 'bevel-shallow') : ''}`}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              beginMenuTracking()
              setState(
                state.kind !== 'closed' && state.title === title
                  ? { kind: 'closed' }
                  : { kind: 'tracking', title, path: [-1] },
              )
            }}
            onPointerEnter={() => {
              if (state.kind === 'open' || state.kind === 'tracking')
                setState({ ...state, title, path: [-1] })
            }}
          >
            <Accel label={menu.label} />
          </button>
          {(state.kind === 'open' || state.kind === 'tracking') && state.title === title && (
            <BarPopup anchor={titleRefs.current[title] ?? null} popup={popup}>
              <MenuTree
                items={menu.items}
                controller={controller}
                style={{ left: 0, top: '100%' }}
                className="pointer-events-auto"
                dropsBelow
              />
            </BarPopup>
          )}
        </div>
      ))}
    </div>
  )
}

export function ContextMenu({
  at,
  items,
  onClose,
}: {
  at: Point
  items: readonly MenuEntry[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(at)
  useLayoutEffect(() => {
    const box = ref.current?.firstElementChild?.getBoundingClientRect()
    if (box)
      setPosition({
        x: Math.max(0, Math.min(at.x, innerWidth - box.width)),
        y: Math.max(0, Math.min(at.y, innerHeight - box.height)),
      })
  }, [at])
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) onClose()
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [onClose])
  return createPortal(
    <div ref={ref} className="fixed z-[10050]" style={{ left: position.x, top: position.y }}>
      <MenuList items={items} onClose={onClose} style={{ position: 'relative' }} />
    </div>,
    document.body,
  )
}
