import { memo, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TitleBar, TitleButton } from '../ui/TitleBar'
import { WindowContext } from './context'
import { smallIcon } from './registry'
import { windowsStore } from './system'
import type { AppManifest, LaunchArgs, Size, WindowApi } from './types'
import type { WindowState } from './windows'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

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
  started: boolean
}

/** Like Math.min(Math.max()), but `min` wins when the range is empty. */
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

const DRAG_THRESHOLD = 3
const MIN_CLIENT = { width: 120, height: 40 }
/** How much of a title bar must stay on screen so the window can be dragged back. */
const KEEP_VISIBLE = 40

const HANDLES: { edges: Edges; className: string; cursor: string }[] = [
  { edges: { n: true }, className: 'left-[4px] right-[4px] top-0 h-[4px]', cursor: 'ns-resize' },
  { edges: { s: true }, className: 'left-[4px] right-[4px] bottom-0 h-[4px]', cursor: 'ns-resize' },
  { edges: { w: true }, className: 'top-[4px] bottom-[4px] left-0 w-[4px]', cursor: 'ew-resize' },
  { edges: { e: true }, className: 'top-[4px] bottom-[4px] right-0 w-[4px]', cursor: 'ew-resize' },
  { edges: { n: true, w: true }, className: 'left-0 top-0 size-[6px]', cursor: 'nwse-resize' },
  { edges: { n: true, e: true }, className: 'right-0 top-0 size-[6px]', cursor: 'nesw-resize' },
  { edges: { s: true, w: true }, className: 'left-0 bottom-0 size-[6px]', cursor: 'nesw-resize' },
  { edges: { s: true, e: true }, className: 'right-0 bottom-0 size-[12px]', cursor: 'nwse-resize' },
]

/** The dithered, color-inverting frame Windows 95 drags instead of the window itself. */
function Outline({ rect }: { rect: Rect }) {
  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none mix-blend-difference bg-[repeating-conic-gradient(#fff_0_25%,transparent_0_50%)] bg-size-[2px_2px]"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        clipPath:
          'polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, 4px 4px, 4px calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 4px, 4px 4px)',
      }}
    />,
    document.body,
  )
}

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
  const resizable = app.window.kind === 'resizable'

  const api = useMemo<WindowApi>(
    () => ({
      id,
      focused,
      minimized,
      setTitle: (title) => windowsStore.dispatch({ type: 'setTitle', id, title }),
      close: () => windowsStore.dispatch({ type: 'close', id }),
    }),
    [id, focused, minimized],
  )
  const context = useMemo(() => ({ api, dialogHost }), [api, dialogHost])

  useEffect(() => {
    const frame = frameRef.current
    if (focused && frame && !frame.contains(document.activeElement)) frame.focus({ preventScroll: true })
  }, [focused])

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
    const frame = frameRef.current?.getBoundingClientRect()
    const client = clientRef.current?.getBoundingClientRect()
    if (!frame || !client) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      gesture,
      pointer: { x: event.clientX, y: event.clientY },
      frame: { x: state.position.x, y: state.position.y, width: frame.width, height: frame.height },
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
        x: clamp(frame.x + dx, KEEP_VISIBLE - frame.width, desktop.width - KEEP_VISIBLE),
        y: clamp(frame.y + dy, 0, desktop.height - 20),
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
      windowsStore.dispatch({ type: 'move', id, position: { x: rect.x, y: rect.y } })
      return
    }
    const size = {
      width: current.client.width + rect.width - current.frame.width,
      height: current.client.height + rect.height - current.frame.height,
    }
    windowsStore.dispatch({ type: 'resize', id, position: { x: rect.x, y: rect.y }, size })
  }

  const gestureHandlers = { onPointerMove, onPointerUp, onPointerCancel: onPointerUp }
  const toggleMaximize = () => resizable && windowsStore.dispatch({ type: 'toggleMaximize', id })

  const frameStyle = maximized
    ? { left: 0, top: 0, width: desktop.width, height: desktop.height, zIndex }
    : { left: state.position.x, top: state.position.y, zIndex }

  return (
    <div
      ref={frameRef}
      role="application"
      aria-label={state.title}
      data-window={id}
      tabIndex={-1}
      className={`absolute flex-col p-[3px] bg-face bevel-window outline-none ${minimized ? 'hidden' : 'flex'}`}
      style={frameStyle}
      onPointerDownCapture={() => {
        if (!focused) windowsStore.dispatch({ type: 'focus', id })
      }}
    >
      <TitleBar
        title={state.title}
        active={focused}
        icon={smallIcon(app)}
        onPointerDown={begin({ kind: 'move' })}
        onDoubleClick={toggleMaximize}
        {...gestureHandlers}
      >
        <TitleButton
          glyph="minimize"
          label="Minimize"
          onClick={() => windowsStore.dispatch({ type: 'minimize', id })}
        />
        <TitleButton
          glyph={maximized ? 'restore' : 'maximize'}
          label={maximized ? 'Restore' : 'Maximize'}
          disabled={!resizable}
          onClick={toggleMaximize}
        />
        <span className="w-[2px]" />
        <TitleButton
          glyph="close"
          label="Close"
          onClick={() => windowsStore.dispatch({ type: 'close', id })}
        />
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
