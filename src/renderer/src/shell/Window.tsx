import {
  memo,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { cursors } from '../system/cursors'
import { useModalCount } from '../ui/Dialog'
import { TitleBar, TitleButton } from '../ui/TitleBar'
import { registerCloseRequest } from './closeRequests'
import { WindowContext } from './context'
import { Outline, type Rect } from './Outline'
import { smallIcon } from './registry'
import { openSystemMenu, registerWindowControls } from './SystemMenu'
import { windowsStore } from './system'
import { animateWindow } from './transitions'
import type { AppManifest, LaunchArgs, Size, WindowApi } from './types'
import type { WindowState } from './windows'

export { Outline } from './Outline'

interface Edges {
  n?: boolean
  s?: boolean
  e?: boolean
  w?: boolean
}

type Gesture = { kind: 'move' } | { kind: 'resize'; edges: Edges }

interface Drag {
  gesture: Gesture
  pointer: { x: number; y: number }
  frame: Rect
  client: Size
  origin: { x: number; y: number }
  started: boolean
}

/** Like Math.min(Math.max()), but `min` wins when the range is empty. */
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

const DRAG_THRESHOLD = 3
const MIN_CLIENT = { width: 120, height: 40 }
/** How much of a title bar must stay on screen so the window can be dragged back. */
const KEEP_VISIBLE = 40

const HANDLES: { edges: Edges; className: string; cursor: string }[] = [
  { edges: { n: true }, className: 'left-[4px] right-[4px] top-0 h-[4px]', cursor: cursors.ns },
  { edges: { s: true }, className: 'left-[4px] right-[4px] bottom-0 h-[4px]', cursor: cursors.ns },
  { edges: { w: true }, className: 'top-[4px] bottom-[4px] left-0 w-[4px]', cursor: cursors.ew },
  { edges: { e: true }, className: 'top-[4px] bottom-[4px] right-0 w-[4px]', cursor: cursors.ew },
  ...(['top', 'bottom'] as const).flatMap((vertical) =>
    (['left', 'right'] as const).flatMap((horizontal) => {
      const edges = {
        n: vertical === 'top',
        s: vertical === 'bottom',
        w: horizontal === 'left',
        e: horizontal === 'right',
      }
      const cursor = edges.n === edges.w ? cursors.nwse : cursors.nesw
      return [
        { edges, className: `${vertical}-0 ${horizontal}-0 w-[20px] h-[4px]`, cursor },
        { edges, className: `${vertical}-0 ${horizontal}-0 w-[4px] h-[20px]`, cursor },
      ]
    }),
  ),
]

/** The dithered, color-inverting frame Windows 95 drags instead of the window itself. */
/** Keeps app content from re-rendering when only the frame moves. */
const AppHost = memo(function AppHost({
  app,
  api,
  args,
}: {
  app: AppManifest
  api: WindowApi
  args: LaunchArgs
}) {
  const Component = app.component
  return <Component window={api} args={args} />
})

interface WindowProps {
  state: WindowState
  app: AppManifest
  focused: boolean
  zIndex: number
  desktop: Size
}

export function Window({ state, app, focused, zIndex, desktop }: WindowProps) {
  const { id, minimized, maximized } = state
  const frameRef = useRef<HTMLDivElement>(null)
  const clientRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const [outline, setOutline] = useState<Rect | null>(null)
  const [dialogHost, setDialogHost] = useState<HTMLDivElement | null>(null)
  const modalCount = useModalCount(dialogHost)
  const lastControl = useRef<HTMLElement | null>(null)
  const keyboard = useRef<{ mode: 'move' | 'size'; frame: Rect; client: Size } | null>(null)
  const resizable = app.window.kind === 'resizable'
  const closeHandler = useRef<(() => Promise<boolean>) | null>(null)
  const requestClose = useCallback(async () => {
    if (closeHandler.current) return closeHandler.current()
    windowsStore.dispatch({ type: 'close', id })
    return true
  }, [id])
  useEffect(() => registerCloseRequest(id, requestClose), [id, requestClose])

  const api = useMemo<WindowApi>(
    () => ({
      id,
      focused,
      minimized,
      setTitle: (title) => windowsStore.dispatch({ type: 'setTitle', id, title }),
      onCloseRequest: (handler) => {
        closeHandler.current = handler
        return () => {
          if (closeHandler.current === handler) closeHandler.current = null
        }
      },
      close: () => {
        windowsStore.dispatch({ type: 'close', id })
      },
    }),
    [id, focused, minimized],
  )
  const context = useMemo(() => ({ api, dialogHost }), [api, dialogHost])

  useEffect(() => {
    const frame = frameRef.current
    if (focused && frame && !modalCount && !frame.contains(document.activeElement)) {
      const control = lastControl.current?.isConnected
        ? lastControl.current
        : clientRef.current?.querySelector<HTMLElement>(
            'textarea, input, button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]',
          )
      ;(control ?? frame).focus({ preventScroll: true })
    }
  }, [focused, modalCount])

  useEffect(
    () =>
      registerWindowControls(id, (mode) => {
        const frame = frameRef.current?.getBoundingClientRect(),
          client = clientRef.current?.getBoundingClientRect()
        if (!frame || !client) return
        windowsStore.dispatch({ type: 'focus', id })
        keyboard.current = {
          mode,
          frame: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
          client: { width: client.width, height: client.height },
        }
        setOutline(keyboard.current.frame)
      }),
    [id],
  )
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const current = keyboard.current
      if (!current) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.key === 'Enter' || event.key === 'Escape') {
        if (event.key === 'Enter') {
          const parent = frameRef.current?.parentElement?.getBoundingClientRect()
          const position = { x: current.frame.x - (parent?.x ?? 0), y: current.frame.y - (parent?.y ?? 0) }
          if (current.mode === 'move') windowsStore.dispatch({ type: 'move', id, position })
          else windowsStore.dispatch({ type: 'resize', id, position, size: current.client })
        }
        keyboard.current = null
        setOutline(null)
        return
      }
      const amount = event.ctrlKey ? 1 : 8
      const dx = event.key === 'ArrowRight' ? amount : event.key === 'ArrowLeft' ? -amount : 0
      const dy = event.key === 'ArrowDown' ? amount : event.key === 'ArrowUp' ? -amount : 0
      if (current.mode === 'move') {
        current.frame.x += dx
        current.frame.y += dy
      } else {
        const spec = app.window.kind === 'resizable' ? app.window : null
        const width = Math.max(spec?.minWidth ?? 120, current.client.width + dx),
          height = Math.max(spec?.minHeight ?? 40, current.client.height + dy)
        current.frame.width += width - current.client.width
        current.frame.height += height - current.client.height
        current.client = { width, height }
      }
      setOutline({ ...current.frame })
    }
    document.addEventListener('keydown', key, true)
    return () => document.removeEventListener('keydown', key, true)
  }, [id, app.window])

  // A new window opens fully on screen. After that, a shrinking desktop only keeps its title bar reachable.
  const position = useRef(state.position)
  position.current = state.position
  const placed = useRef(false)
  useEffect(() => {
    const frame = frameRef.current
    if (!frame || maximized || minimized) return
    const { width, height } = frame.getBoundingClientRect()
    const { x, y } = position.current
    const next = placed.current
      ? {
          x: clamp(x, KEEP_VISIBLE - width, desktop.width - KEEP_VISIBLE),
          y: clamp(y, 0, desktop.height - 20),
        }
      : { x: clamp(x, 0, desktop.width - width), y: clamp(y, 0, desktop.height - height) }
    placed.current = true
    if (next.x !== x || next.y !== y) windowsStore.dispatch({ type: 'move', id, position: next })
  }, [id, desktop.width, desktop.height, maximized, minimized])

  const begin = (gesture: Gesture) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || maximized) return
    event.preventDefault()
    const frame = frameRef.current?.getBoundingClientRect()
    const origin = frameRef.current?.parentElement?.getBoundingClientRect()
    const client = clientRef.current?.getBoundingClientRect()
    if (!frame || !client) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      gesture,
      pointer: { x: event.clientX, y: event.clientY },
      frame: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
      origin: { x: origin?.x ?? 0, y: origin?.y ?? 0 },
      client: { width: client.width, height: client.height },
      started: false,
    }
  }

  const target = (current: Drag, event: ReactPointerEvent): Rect => {
    const dx = event.clientX - current.pointer.x
    const dy = event.clientY - current.pointer.y
    const { frame, gesture } = current
    if (gesture.kind === 'move') {
      return {
        ...frame,
        x: clamp(
          frame.x + dx,
          current.origin.x + KEEP_VISIBLE - frame.width,
          current.origin.x + desktop.width - KEEP_VISIBLE,
        ),
        y: clamp(frame.y + dy, current.origin.y, current.origin.y + desktop.height - 20),
      }
    }
    const spec = app.window.kind === 'resizable' ? app.window : null
    const minWidth = frame.width - current.client.width + (spec?.minWidth ?? MIN_CLIENT.width)
    const minHeight = frame.height - current.client.height + (spec?.minHeight ?? MIN_CLIENT.height)
    const { edges } = gesture
    const width = Math.max(minWidth, frame.width + (edges.e ? dx : edges.w ? -dx : 0))
    const height = Math.max(minHeight, frame.height + (edges.s ? dy : edges.n ? -dy : 0))
    return {
      x: edges.w ? frame.x + frame.width - width : frame.x,
      y: edges.n ? frame.y + frame.height - height : frame.y,
      width,
      height,
    }
  }

  const onPointerMove = (event: ReactPointerEvent) => {
    const current = drag.current
    if (!current) return
    const far = Math.abs(event.clientX - current.pointer.x) + Math.abs(event.clientY - current.pointer.y)
    if (!current.started && far < DRAG_THRESHOLD) return
    current.started = true
    setOutline(target(current, event))
  }

  const onPointerUp = (event: ReactPointerEvent) => {
    const current = drag.current
    drag.current = null
    setOutline(null)
    if (!current?.started) return
    const rect = target(current, event)
    if (current.gesture.kind === 'move') {
      windowsStore.dispatch({
        type: 'move',
        id,
        position: { x: rect.x - current.origin.x, y: rect.y - current.origin.y },
      })
      return
    }
    const size = {
      width: current.client.width + rect.width - current.frame.width,
      height: current.client.height + rect.height - current.frame.height,
    }
    windowsStore.dispatch({
      type: 'resize',
      id,
      position: { x: rect.x - current.origin.x, y: rect.y - current.origin.y },
      size,
    })
  }

  const gestureHandlers = { onPointerMove, onPointerUp, onPointerCancel: onPointerUp }
  const toggleMaximize = () => resizable && animateWindow({ type: 'toggleMaximize', id })

  const frameStyle = maximized
    ? { left: -4, top: -4, width: desktop.width + 8, height: desktop.height + 8, zIndex }
    : { left: state.position.x, top: state.position.y, zIndex }

  return (
    <div
      ref={frameRef}
      role="application"
      aria-label={state.title}
      data-window={id}
      tabIndex={-1}
      className={`absolute flex-col ${resizable ? 'p-[4px]' : 'p-[3px]'} bg-face bevel-window outline-none ${minimized ? 'hidden' : 'flex'}`}
      style={frameStyle}
      onPointerDownCapture={() => {
        if (!focused) windowsStore.dispatch({ type: 'focus', id })
      }}
      onFocusCapture={(event) => {
        if (
          event.target instanceof HTMLElement &&
          event.target !== frameRef.current &&
          !event.target.closest('[role="dialog"]') &&
          clientRef.current?.contains(event.target)
        )
          lastControl.current = event.target
      }}
    >
      <TitleBar
        title={state.title}
        active={focused && modalCount === 0}
        icon={smallIcon(app)}
        onPointerDown={(event) => {
          if (event.target instanceof HTMLImageElement) {
            event.preventDefault()
            event.stopPropagation()
            const box = frameRef.current?.getBoundingClientRect()
            if (box && event.button === 0) openSystemMenu(id, { x: box.x, y: box.y + 22 })
          } else begin({ kind: 'move' })(event)
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          openSystemMenu(id, { x: event.clientX, y: event.clientY })
        }}
        onDoubleClick={(event) => {
          if (event.target instanceof HTMLImageElement) {
            event.stopPropagation()
            void requestClose()
          } else void toggleMaximize()
        }}
        {...gestureHandlers}
      >
        <TitleButton
          glyph="minimize"
          label="Minimize"
          onClick={() => {
            void animateWindow({ type: 'minimize', id })
          }}
        />
        <TitleButton
          glyph={maximized ? 'restore' : 'maximize'}
          label={maximized ? 'Restore' : 'Maximize'}
          disabled={!resizable}
          onClick={toggleMaximize}
        />
        <span className="w-[2px]" />
        <TitleButton glyph="close" label="Close" onClick={requestClose} />
      </TitleBar>
      <div
        ref={clientRef}
        className={`relative flex flex-col mt-[1px] overflow-hidden ${maximized ? 'flex-1 min-h-0' : ''}`}
        style={!maximized && state.size ? { width: state.size.width, height: state.size.height } : undefined}
      >
        <WindowContext.Provider value={context}>
          <AppHost app={app} api={api} args={state.args} />
        </WindowContext.Provider>
      </div>
      {resizable &&
        !maximized &&
        HANDLES.map((handle) => (
          <div
            key={handle.className}
            className={`absolute ${handle.className}`}
            style={{ cursor: handle.cursor }}
            onPointerDown={begin({ kind: 'resize', edges: handle.edges })}
            {...gestureHandlers}
          />
        ))}
      <div ref={setDialogHost} className="absolute inset-0 pointer-events-none" />
      {outline && <Outline rect={outline} />}
    </div>
  )
}
