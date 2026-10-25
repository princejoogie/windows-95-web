import { useEffect, useMemo, useRef, useState } from 'react'
import { icons } from '../icons'
import { formatClock } from '../settings/clock'
import { useSettings } from '../settings/store'
import { cursors } from '../system/cursors'
import { beginMenuTracking, ContextMenu, type MenuEntry } from '../ui/Menu'
import { Outline, type Rect } from './Outline'
import { getApp, smallIcon } from './registry'
import { openSystemMenu } from './SystemMenu'
import { startMenuFolder } from './startup'
import { launch, useWindows, windowsStore } from './system'
import { type Edge, setTaskbarSettings, taskbarRows, useTaskbarSettings } from './taskbarSettings'
import { animateWindow } from './transitions'

export function Taskbar({
  startOpen,
  onStart,
  onProperties,
  onDateTime,
  onApp,
  desktop,
}: {
  startOpen: boolean
  onStart: () => void
  onProperties: () => void
  onDateTime: () => void
  onApp: (id: string) => void
  desktop: { width: number; height: number }
}) {
  const state = useWindows((state) => state)
  const settings = useTaskbarSettings()
  const systemSettings = useSettings((state) => state)
  const tasks = useMemo(() => [...state.windows].sort((a, b) => a.id - b.id), [state.windows])
  const [now, setNow] = useState(() => new Date())
  const clock = formatClock(systemSettings, now.getTime())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; kind: 'bar' | 'clock' | 'start' } | null>(
    null,
  )
  const [shown, setShown] = useState(false)
  const [outline, setOutline] = useState<Rect | null>(null)
  const drag = useRef<{ kind: 'move' | 'resize'; edge: Edge; rows: number } | null>(null)
  const hide = useRef<ReturnType<typeof setTimeout>>(undefined)
  const startWasOpen = useRef(false)
  useEffect(() => () => clearTimeout(hide.current), [])
  const vertical = settings.edge === 'left' || settings.edge === 'right'
  const thickness = settings.rows * 28
  const hidden = settings.autoHide && !shown && !startOpen
  const transform = hidden
    ? `translate${vertical ? 'X' : 'Y'}(${settings.edge === 'left' || settings.edge === 'top' ? '-' : ''}${thickness - 2}px)`
    : undefined
  const area = (edge: Edge, rows: number): Rect => {
    const thickness = taskbarRows(edge, rows) * 28
    return {
      x: edge === 'right' ? innerWidth - thickness : 0,
      y: edge === 'bottom' ? innerHeight - thickness : 0,
      width: edge === 'left' || edge === 'right' ? thickness : innerWidth,
      height: edge === 'top' || edge === 'bottom' ? thickness : innerHeight,
    }
  }
  const rect = area(settings.edge, settings.rows)
  const openStartFolder = () => {
    const folder = startMenuFolder(['Start Menu'])
    if (folder) launch('explorer', { folder })
  }
  const items: MenuEntry[] =
    menu?.kind === 'start'
      ? [
          { label: '&Open', bold: true, onSelect: openStartFolder },
          { label: '&Explore', onSelect: openStartFolder },
          { label: '&Find...', onSelect: () => onApp('find') },
        ]
      : [
          ...(menu?.kind === 'clock'
            ? [{ label: '&Adjust Date/Time', onSelect: onDateTime }, 'separator' as const]
            : []),
          {
            label: '&Cascade',
            onSelect: () => windowsStore.dispatch({ type: 'arrange', layout: 'cascade', desktop }),
          },
          {
            label: 'Tile &Horizontally',
            onSelect: () => windowsStore.dispatch({ type: 'arrange', layout: 'horizontal', desktop }),
          },
          {
            label: 'Tile &Vertically',
            onSelect: () => windowsStore.dispatch({ type: 'arrange', layout: 'vertical', desktop }),
          },
          'separator',
          { label: '&Minimize All Windows', onSelect: () => windowsStore.dispatch({ type: 'minimizeAll' }) },
          ...(state.minimizedAll.length
            ? [
                {
                  label: '&Undo Minimize All',
                  onSelect: () => windowsStore.dispatch({ type: 'undoMinimizeAll' }),
                },
              ]
            : []),
          'separator',
          { label: '&Properties', onSelect: onProperties },
        ]
  return (
    <>
      <div
        data-taskbar
        role="toolbar"
        aria-label="Taskbar"
        data-edge={settings.edge}
        className={`absolute flex ${vertical ? 'flex-col' : ''} items-center gap-[3px] p-[2px] pt-[4px] bg-face shadow-[inset_0_1px_#dfdfdf,inset_0_2px_#fff]`}
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          zIndex: settings.alwaysOnTop || startOpen || shown ? 8000 : 0,
          transform,
          transition: settings.autoHide ? 'transform 120ms steps(6)' : 'none',
        }}
        onPointerEnter={() => {
          clearTimeout(hide.current)
          setShown(true)
        }}
        onPointerLeave={() => {
          hide.current = setTimeout(() => setShown(false), 400)
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          setMenu({ at: { x: event.clientX, y: event.clientY }, kind: 'bar' })
        }}
        onPointerDown={(event) => {
          if (
            event.button !== 0 ||
            (event.target !== event.currentTarget &&
              !(event.target instanceof Element && event.target.hasAttribute('data-task-list')))
          )
            return
          windowsStore.dispatch({ type: 'blur' })
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { kind: 'move', edge: settings.edge, rows: settings.rows }
        }}
        onPointerMove={(event) => {
          const current = drag.current
          if (!current) return
          if (current.kind === 'move') {
            const distances: [Edge, number][] = [
              ['left', event.clientX],
              ['right', innerWidth - event.clientX],
              ['top', event.clientY],
              ['bottom', innerHeight - event.clientY],
            ]
            current.edge = distances.sort((a, b) => a[1] - b[1])[0]?.[0] ?? 'bottom'
          } else {
            const distance =
              current.edge === 'left'
                ? event.clientX
                : current.edge === 'right'
                  ? innerWidth - event.clientX
                  : current.edge === 'top'
                    ? event.clientY
                    : innerHeight - event.clientY
            current.rows = taskbarRows(current.edge, distance / 28)
          }
          setOutline(area(current.edge, current.rows))
        }}
        onPointerUp={() => {
          if (drag.current)
            setTaskbarSettings({ ...settings, edge: drag.current.edge, rows: drag.current.rows })
          drag.current = null
          setOutline(null)
        }}
        onPointerCancel={() => {
          drag.current = null
          setOutline(null)
        }}
      >
        <div
          data-taskbar-resize
          className="absolute z-10"
          style={
            vertical
              ? {
                  top: 0,
                  bottom: 0,
                  width: 3,
                  [settings.edge === 'left' ? 'right' : 'left']: 0,
                  cursor: cursors.ew,
                }
              : {
                  left: 0,
                  right: 0,
                  height: 3,
                  [settings.edge === 'top' ? 'bottom' : 'top']: 0,
                  cursor: cursors.ns,
                }
          }
          onPointerDown={(event) => {
            event.stopPropagation()
            event.currentTarget.parentElement?.setPointerCapture(event.pointerId)
            drag.current = { kind: 'resize', edge: settings.edge, rows: settings.rows }
          }}
        />
        <button
          type="button"
          data-start-button
          title="Click here to begin."
          aria-pressed={startOpen}
          aria-expanded={startOpen}
          className={`group flex items-center w-[54px] h-[22px] px-[3px] font-bold outline-none shrink-0 ${startOpen ? 'bevel-pressed' : 'bevel-raised'}`}
          onPointerDown={(event) => {
            event.stopPropagation()
            startWasOpen.current = startOpen
            beginMenuTracking()
            if (!startOpen) onStart()
          }}
          onClick={(event) => {
            if (startWasOpen.current || event.detail === 0) onStart()
          }}
          onContextMenu={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setMenu({ at: { x: event.clientX, y: event.clientY }, kind: 'start' })
          }}
        >
          <span
            className={`flex items-center gap-[3px] p-px group-focus-visible:outline-dotted group-focus-visible:outline-1 ${startOpen ? 'outline-dotted outline-1 translate-x-px translate-y-px' : ''}`}
          >
            <img src={icons.small.windowsLogo} alt="" draggable={false} className="size-4" />
            <span>Start</span>
          </span>
        </button>
        <div
          data-task-list
          className={`flex flex-1 min-w-0 gap-[3px] ${vertical ? 'flex-col w-full' : 'flex-wrap h-full content-start pl-[2px]'}`}
        >
          {tasks.map((window) => {
            const app = getApp(window.appId),
              active = state.focused === window.id
            return (
              <button
                key={window.id}
                type="button"
                data-task={window.id}
                title={window.title}
                className={`flex items-center gap-[3px] h-[22px] min-w-0 px-[3px] outline-none ${vertical ? 'w-full shrink-0' : 'flex-1 max-w-[160px]'} ${active ? 'bevel-pressed dither font-bold' : 'bevel-raised'}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  void animateWindow({ type: 'taskbarClick', id: window.id })
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  openSystemMenu(window.id, { x: event.clientX, y: event.clientY })
                }}
              >
                {app && (
                  <img
                    src={smallIcon(app)}
                    alt=""
                    className={`size-4 shrink-0 ${active ? 'translate-y-px' : ''}`}
                  />
                )}
                <span className="truncate">{window.title}</span>
              </button>
            )
          })}
        </div>
        {settings.showClock && (
          <button
            type="button"
            data-clock
            tabIndex={0}
            aria-label="Date and time"
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onDateTime()
            }}
            className="flex items-center justify-center h-[22px] px-[8px] bevel-shallow shrink-0"
            title={clock.longDate}
            onDoubleClick={onDateTime}
            onContextMenu={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setMenu({ at: { x: event.clientX, y: event.clientY }, kind: 'clock' })
            }}
          >
            {clock.time}
          </button>
        )}
      </div>
      {menu && <ContextMenu at={menu.at} items={items} onClose={() => setMenu(null)} />}
      {outline && <Outline rect={outline} />}
    </>
  )
}
