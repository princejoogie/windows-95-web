import { useEffect, useMemo, useState } from 'react'
import { icons } from '../icons'
import { getApp, smallIcon } from './registry'
import { useWindows, windowsStore } from './system'

function useClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(new Date())
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000))
    }
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000))
    return () => clearTimeout(timer)
  }, [])
  return now
}

const time = (date: Date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const day = (date: Date) =>
  date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

interface TaskbarProps {
  startOpen: boolean
  onStart: () => void
}

export function Taskbar({ startOpen, onStart }: TaskbarProps) {
  const windows = useWindows((s) => s.windows)
  const focused = useWindows((s) => s.focused)
  const tasks = useMemo(() => [...windows].sort((a, b) => a.id - b.id), [windows])
  const now = useClock()

  return (
    <div
      className="relative z-[8000] flex items-center gap-[3px] h-[28px] px-[2px] pt-[2px] bg-face shadow-[inset_0_1px_#dfdfdf,inset_0_2px_#fff] shrink-0"
      onPointerDown={(event) =>
        event.target === event.currentTarget && windowsStore.dispatch({ type: 'blur' })
      }
    >
      <button
        type="button"
        data-start-button
        aria-pressed={startOpen}
        aria-expanded={startOpen}
        className={`flex items-center gap-[3px] h-[22px] pl-[4px] pr-[5px] font-bold outline-none shrink-0
          ${startOpen ? 'bevel-pressed' : 'bevel-raised'}`}
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
        onClick={onStart}
      >
        <img
          src={icons.windowsLogo}
          alt=""
          className={`size-4 ${startOpen ? 'translate-x-px translate-y-px' : ''}`}
        />
        <span className={startOpen ? 'translate-x-px translate-y-px' : ''}>Start</span>
      </button>
      <div className="flex flex-1 min-w-0 gap-[3px] pl-[2px]">
        {tasks.map((window) => {
          const app = getApp(window.appId)
          const active = focused === window.id
          return (
            <button
              key={window.id}
              type="button"
              title={window.title}
              data-task={window.id}
              className={`flex items-center gap-[3px] h-[22px] min-w-0 flex-1 max-w-[160px] px-[3px] outline-none
                ${active ? 'bevel-pressed dither font-bold' : 'bevel-raised'}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => windowsStore.dispatch({ type: 'taskbarClick', id: window.id })}
            >
              {app && (
                <img
                  src={smallIcon(app)}
                  alt=""
                  className={`size-4 shrink-0 ${active ? 'translate-y-px' : ''}`}
                />
              )}
              <span className={`truncate ${active ? 'translate-y-px' : ''}`}>{window.title}</span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center h-[22px] px-[8px] bevel-shallow shrink-0" title={day(now)}>
        {time(now)}
      </div>
    </div>
  )
}
