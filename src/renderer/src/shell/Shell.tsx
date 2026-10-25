import { useEffect, useMemo, useRef, useState } from 'react'
import { installPrograms } from '../fs/store'
import { closeInOrder, requestWindowClose } from './closeRequests'
import { ShellDialogHost } from './context'
import { Desktop } from './Desktop'
import { shellEvents } from './events'
import { RunDialog } from './RunDialog'
import { getApp, programSpecs } from './registry'
import { type ShutDownChoice, ShutDownDialog } from './ShutDownDialog'
import { StartMenu } from './StartMenu'
import { useWindows, windowsStore } from './system'
import { Taskbar } from './Taskbar'
import type { Size } from './types'
import { Window } from './Window'

type Power = 'booting' | 'running' | 'shutting-down' | 'restarting' | 'off'
type ShellDialog = 'run' | 'shutdown' | null

export function Shell() {
  const [power, setPower] = useState<Power>('booting')
  const [startOpen, setStartOpen] = useState(false)
  const [dialog, setDialog] = useState<ShellDialog>(null)
  const [dialogHost, setDialogHost] = useState<HTMLDivElement | null>(null)
  const desktopRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const installed = useRef(false)
  const closing = useRef(false)
  const [size, setSize] = useState<Size>({ width: innerWidth, height: innerHeight - 28 })
  const state = useWindows((s) => s)
  const ordered = useMemo(() => [...state.windows].sort((a, b) => a.id - b.id), [state.windows])
  const stacking = new Map(state.windows.map((window, index) => [window.id, index + 1]))

  useEffect(() => {
    return window.win95?.onEvent((event) => {
      if (event.type === 'host-close') setDialog('shutdown')
      if (event.type === 'start') setStartOpen((open) => !open)
      if (event.type === 'alt-f4') {
        const id = windowsStore.get().focused
        if (id !== null) void requestWindowClose(id)
        else setDialog('shutdown')
      }
    })
  }, [])

  useEffect(() => {
    if (!installed.current) {
      installPrograms(programSpecs)
      installed.current = true
    }
  }, [])

  useEffect(() => {
    if (power === 'running') return
    const timer = setTimeout(
      () => {
        switch (power) {
          case 'booting':
            setPower('running')
            break
          case 'shutting-down':
            setPower('off')
            break
          case 'restarting':
            setPower('booting')
            break
          case 'off':
            window.win95?.shutdown()
            break
        }
      },
      power === 'off' ? 2000 : 1200,
    )
    return () => clearTimeout(timer)
  }, [power])

  useEffect(() => {
    const desktop = desktopRef.current
    if (!desktop || power !== 'running') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(desktop)
    return () => observer.disconnect()
  }, [power])

  useEffect(() => {
    if (power !== 'running') return
    const pointer = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-start-button]')) return
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      setStartOpen(false)
    }
    const key = (event: KeyboardEvent) => {
      if (event.altKey && event.key === 'F4') {
        event.preventDefault()
        const id = windowsStore.get().focused
        if (id !== null) void requestWindowClose(id)
        else setDialog('shutdown')
      } else if (event.ctrlKey && event.key === 'Escape') {
        event.preventDefault()
        setStartOpen((open) => !open)
      } else if (event.key === 'Escape') setStartOpen(false)
    }
    document.addEventListener('pointerdown', pointer, true)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', pointer, true)
      document.removeEventListener('keydown', key)
    }
  }, [power])

  const shutDown = async (choice: ShutDownChoice) => {
    if (closing.current) return
    closing.current = true
    setDialog(null)
    setStartOpen(false)
    try {
      const closed = await closeInOrder([...windowsStore.get().windows].reverse(), async (owner) => {
        windowsStore.dispatch({ type: 'focus', id: owner.id })
        return requestWindowClose(owner.id)
      })
      if (!closed) return
      shellEvents.emit('shutdown')
      setPower(choice === 'restart' ? 'restarting' : 'shutting-down')
    } finally {
      closing.current = false
    }
  }

  if (power !== 'running') {
    if (power === 'off') {
      return (
        <button
          type="button"
          className="h-full w-full bg-black text-[#ff8000] text-[20px] font-bold outline-none"
          onClick={() => !window.win95 && setPower('booting')}
        >
          It's now safe to turn off your computer.
        </button>
      )
    }
    return (
      <div className="h-full w-full bg-black text-white p-[8px] font-mono text-[16px]" role="status">
        {power === 'booting' ? 'Starting Windows 95...' : 'Please wait while your computer shuts down.'}
      </div>
    )
  }

  return (
    <ShellDialogHost.Provider value={dialogHost}>
      <div className="relative flex h-full w-full flex-col bg-desktop overflow-hidden">
        <div ref={desktopRef} className="relative flex-1 min-h-0 overflow-hidden" data-desktop>
          <Desktop size={size} />
          {ordered.map((window) => {
            const app = getApp(window.appId)
            return app ? (
              <Window
                key={window.id}
                state={window}
                app={app}
                focused={state.focused === window.id}
                zIndex={stacking.get(window.id) ?? 1}
                desktop={size}
              />
            ) : null
          })}
        </div>
        <Taskbar startOpen={startOpen} onStart={() => setStartOpen((open) => !open)} />
        {startOpen && (
          <div ref={menuRef}>
            <StartMenu
              onClose={() => setStartOpen(false)}
              onRun={() => setDialog('run')}
              onShutDown={() => setDialog('shutdown')}
            />
          </div>
        )}
        <div ref={setDialogHost} className="absolute inset-0 z-[10000] pointer-events-none" />
        {dialog === 'run' && <RunDialog onClose={() => setDialog(null)} />}
        {dialog === 'shutdown' && <ShutDownDialog onChoose={shutDown} onClose={() => setDialog(null)} />}
      </div>
    </ShellDialogHost.Provider>
  )
}
