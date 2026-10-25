import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'
import { ShellDialogHost, WindowContext } from '../shell/context'
import { shellEvents } from '../shell/events'
import { Outline, type Rect } from '../shell/Outline'
import { useWindows, windowsStore } from '../shell/system'
import { menuIsActive } from './Menu'
import { TitleBar, TitleButton } from './TitleBar'

interface DialogProps {
  title: string
  children: ReactNode
  onClose?: (() => void) | undefined
  icon?: string | undefined
  dim?: boolean
  className?: string
  initialPosition?: { left: number; bottom: number }
  onHelp?: () => void
  closeDisabled?: boolean
}
const modalStacks = new WeakMap<HTMLElement, symbol[]>()
const activeDialogs = new Map<symbol, () => void>()
export function requestActiveDialogClose(): boolean {
  const close = [...activeDialogs.values()].at(-1)
  if (!close) return false
  close()
  return true
}
const DialogParent = createContext<{ host: HTMLElement | null } | null>(null)
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const notify = () => {
  for (const listener of listeners) listener()
}
export function useModalCount(host: HTMLElement | null) {
  return useSyncExternalStore(subscribe, () => (host ? (modalStacks.get(host)?.length ?? 0) : 0))
}

export function Dialog({
  title,
  children,
  onClose,
  icon,
  dim,
  className = '',
  initialPosition,
  onHelp,
  closeDisabled = onClose === undefined,
}: DialogProps) {
  const owner = useContext(WindowContext)
  const parent = useContext(DialogParent)
  const owned = owner !== null || parent !== null
  const shellHost = useContext(ShellDialogHost)
  const host = parent ? parent.host : owner ? owner.dialogHost : shellHost
  const [nestedHost, setNestedHost] = useState<HTMLDivElement | null>(null)
  const nestedCount = useModalCount(nestedHost)
  const token = useRef(Symbol())
  const count = useModalCount(host)
  const focused = useWindows((state) => state.focused)
  const active =
    (owner ? owner.api.focused : focused === null) &&
    Boolean(count) &&
    nestedCount === 0 &&
    modalStacks.get(host ?? document.body)?.at(-1) === token.current
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [outline, setOutline] = useState<Rect | null>(null)
  const drag = useRef<{ pointer: { x: number; y: number }; rect: Rect } | null>(null)
  const [flash, setFlash] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setInterval>>(undefined)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [alignment, setAlignment] = useState({ x: 0, y: 0 })
  const aligned = useRef(alignment)
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!host || !dialog) return
    const round = () => {
      const box = dialog.getBoundingClientRect()
      const x = box.x - aligned.current.x,
        y = box.y - aligned.current.y
      const next = {
        x: Math.max(4, Math.min(Math.round(x), innerWidth - box.width - 4)) - x,
        y: Math.max(4, Math.min(Math.round(y), innerHeight - box.height - 32)) - y,
      }
      if (next.x !== aligned.current.x || next.y !== aligned.current.y) {
        aligned.current = next
        setAlignment(next)
      }
    }
    round()
    const observer = new ResizeObserver(round)
    observer.observe(host)
    observer.observe(dialog)
    return () => observer.disconnect()
  }, [host])
  const latestClose = useRef(onClose)
  latestClose.current = onClose

  useEffect(() => {
    if (!host) return
    const stack = modalStacks.get(host) ?? []
    modalStacks.set(host, stack)
    stack.push(token.current)
    notify()
    if (!owned) windowsStore.dispatch({ type: 'blur' })
    const previous = document.activeElement
    const currentToken = token.current
    return () => {
      const index = stack.indexOf(currentToken)
      if (index >= 0) stack.splice(index, 1)
      notify()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [host, owned])
  useEffect(() => () => clearInterval(flashTimer.current), [])
  useEffect(() => {
    if (!active) return
    const activeToken = token.current
    activeDialogs.set(activeToken, () => latestClose.current?.())
    const dialog = dialogRef.current
    const focusable = () =>
      [
        ...(dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ) ?? []),
      ].filter(
        (element) =>
          element.getClientRects().length &&
          element.tabIndex !== -1 &&
          !element.closest('[data-dialog-caption]') &&
          element.closest('[role="dialog"]') === dialog,
      )
    if (
      dialog &&
      (!dialog.contains(document.activeElement) ||
        (document.activeElement instanceof Element &&
          document.activeElement.closest('[data-dialog-caption]')))
    )
      (
        dialog.querySelector<HTMLElement>('[autofocus]') ??
        focusable().find((element) => !element.closest('[data-dialog-caption]')) ??
        focusable()[0]
      )?.focus()
    const key = (event: KeyboardEvent) => {
      if (menuIsActive()) return
      if (event.target instanceof Element && event.target.closest('[role="combobox"][aria-expanded="true"]'))
        return
      if (event.key === 'Tab') {
        const elements = focusable(),
          first = elements[0],
          last = elements.at(-1)
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
      if ((event.key === 'Escape' || (event.key === 'F4' && event.altKey)) && latestClose.current) {
        event.preventDefault()
        event.stopImmediatePropagation()
        latestClose.current()
      }
    }
    document.addEventListener('keydown', key, true)
    return () => {
      activeDialogs.delete(activeToken)
      document.removeEventListener('keydown', key, true)
    }
  }, [active])
  if (!host) return null
  const feedback = () => {
    shellEvents.emit('question')
    clearInterval(flashTimer.current)
    let ticks = 0
    flashTimer.current = setInterval(() => {
      setFlash(++ticks % 2 === 1)
      if (ticks === 6) clearInterval(flashTimer.current)
    }, 60)
    const dialog = dialogRef.current
    ;[
      ...(dialog?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex="0"]',
      ) ?? []),
    ]
      .find(
        (element) =>
          !element.closest('[data-dialog-caption]') && element.closest('[role="dialog"]') === dialog,
      )
      ?.focus()
  }
  return createPortal(
    <div
      className={`absolute inset-0 z-40 flex items-center justify-center ${owner || dim ? 'pointer-events-auto' : 'pointer-events-none'}`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) feedback()
      }}
    >
      {dim && (
        <div
          className="absolute inset-0 bg-[repeating-conic-gradient(#000_0_25%,transparent_0_50%)] bg-size-[2px_2px]"
          onPointerDown={feedback}
        />
      )}
      <div
        ref={dialogRef}
        role="dialog"
        aria-label={title}
        aria-modal={owner || dim ? true : undefined}
        onPointerDownCapture={() => {
          if (!owner) windowsStore.dispatch({ type: 'blur' })
        }}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (
            event.defaultPrevented ||
            event.key !== 'Enter' ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.target instanceof HTMLTextAreaElement ||
            (event.target instanceof HTMLButtonElement && event.target.getAttribute('role') !== 'tab') ||
            (event.target instanceof HTMLElement && event.target.isContentEditable)
          )
            return
          const button = [
            ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
              'button[data-default="true"]:not([disabled]), button[type="submit"]:not([disabled])',
            ),
          ].find((button) => button.closest('[role="dialog"]') === event.currentTarget)
          if (button) {
            event.preventDefault()
            button.click()
          }
        }}
        className={`flex flex-col shrink-0 p-[3px] bg-face bevel-window pointer-events-auto ${initialPosition ? 'absolute' : 'relative'} ${className}`}
        style={{
          position: initialPosition ? 'absolute' : 'relative',
          left: initialPosition?.left ?? 'auto',
          bottom: initialPosition ? initialPosition.bottom + 28 : 'auto',
          top: 'auto',
          right: 'auto',
          transform: `translate(${offset.x + alignment.x}px, ${offset.y + alignment.y}px)`,
        }}
      >
        <TitleBar
          title={title}
          active={active && !flash}
          icon={icon}
          data-dialog-caption
          onPointerDown={(event) => {
            if (event.button !== 0) return
            event.currentTarget.setPointerCapture(event.pointerId)
            const box = dialogRef.current?.getBoundingClientRect()
            if (box)
              drag.current = {
                pointer: { x: event.clientX, y: event.clientY },
                rect: { x: box.x, y: box.y, width: box.width, height: box.height },
              }
          }}
          onPointerMove={(event) => {
            const start = drag.current
            if (start)
              setOutline({
                ...start.rect,
                x: start.rect.x + event.clientX - start.pointer.x,
                y: start.rect.y + event.clientY - start.pointer.y,
              })
          }}
          onPointerUp={(event) => {
            const start = drag.current
            if (start)
              setOffset((current) => ({
                x: current.x + event.clientX - start.pointer.x,
                y: current.y + event.clientY - start.pointer.y,
              }))
            drag.current = null
            setOutline(null)
          }}
          onPointerCancel={() => {
            drag.current = null
            setOutline(null)
          }}
        >
          {onHelp && (
            <>
              <TitleButton glyph="help" label="Help" onClick={onHelp} />
              <span className="w-[2px]" />
            </>
          )}
          {(onClose || closeDisabled) && (
            <TitleButton
              glyph="close"
              label="Close"
              disabled={closeDisabled}
              onClick={onClose ?? (() => {})}
            />
          )}
        </TitleBar>
        <DialogParent.Provider value={{ host: nestedHost }}>{children}</DialogParent.Provider>
        <div ref={setNestedHost} className="absolute inset-0 pointer-events-none" />
      </div>
      {outline && <Outline rect={outline} />}
    </div>,
    host,
  )
}
