import { useEffect, useMemo, useRef, useState } from 'react'
import type { HostEvent } from '../../../shared/ipc'
import { DateTimeProperties } from '../apps/controlpanel/DateTimeProperties'
import { DesktopDisplayProperties } from '../apps/controlpanel/DisplayProperties'
import { children } from '../fs/fs'
import { fs, installPrograms } from '../fs/store'
import { ROOT } from '../fs/types'
import { ScreenSaverHost } from '../settings/ScreenSaverHost'
import { connectSystemSounds } from '../settings/sounds'
import { beginSystemCursor } from '../system/cursors'
import { Button, Dialog, MessageBox, TextBox } from '../ui'
import { requestActiveDialogClose } from '../ui/Dialog'
import { cancelMenuAltTap, menuIsActive } from '../ui/Menu'
import { TooltipLayer } from '../ui/Tooltip'
import { closeSession, requestWindowClose } from './closeRequests'
import { ShellDialogHost } from './context'
import { Desktop } from './Desktop'
import { DosSession } from './DosSession'
import { shellEvents } from './events'
import { PowerScreens } from './PowerScreens'
import { RunDialog } from './RunDialog'
import { connectRecycleLimit } from './recycleLimit'
import { apps, findAppByExe, getApp, helpBookForApp, programSpecs } from './registry'
import { type ShutDownChoice, ShutDownDialog } from './ShutDownDialog'
import { StartMenu } from './StartMenu'
import { openSystemMenu, SystemMenu } from './SystemMenu'
import { shortcutForKey } from './shortcutKeys'
import { installStartMenu, startMenuFolder } from './startup'
import { launch, openNode, useWindows, windowsStore } from './system'
import { Taskbar } from './Taskbar'
import { TaskbarProperties } from './TaskbarProperties'
import { TaskSwitcher } from './TaskSwitcher'
import { useTaskbarSettings, workArea } from './taskbarSettings'
import { cycleTask, switcherOrder } from './taskOrder'
import { animateWindow, CaptionZoom } from './transitions'
import type { Size, WindowId } from './types'
import { Window } from './Window'

type Power = 'booting' | 'running' | 'dos' | 'shutting-down' | 'restarting' | 'off'
type ShellDialog = 'run' | 'shutdown' | 'taskbar' | 'datetime' | 'logon' | 'msn' | null
type Switch = { order: readonly WindowId[]; selected: WindowId }

export function Shell() {
  useEffect(connectSystemSounds, [])
  useEffect(connectRecycleLimit, [])
  const [power, setPower] = useState<Power>('booting')
  useEffect(() => (power === 'running' || power === 'dos' ? undefined : beginSystemCursor('wait')), [power])
  const [startOpen, setStartOpen] = useState(false)
  const [dialog, setDialog] = useState<ShellDialog>(null)
  const [missing, setMissing] = useState<string | null>(null)
  const [user, setUser] = useState(() => localStorage.getItem('w95.user.v1') ?? '')
  const [switcher, setSwitcher] = useState<Switch | null>(null)
  const switching = useRef<Switch | null>(null)
  const [dialogHost, setDialogHost] = useState<HTMLDivElement | null>(null)
  const desktopRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const closing = useRef(false)
  const windowsTap = useRef(false)
  const [size, setSize] = useState<Size>({ width: innerWidth, height: innerHeight - 28 })
  const state = useWindows((state) => state)
  const settings = useTaskbarSettings()
  const ordered = useMemo(() => [...state.windows].sort((a, b) => a.id - b.id), [state.windows])
  const stacking = new Map(state.windows.map((window, index) => [window.id, index + 1]))
  const openApp = (id: string) => {
    if (id === 'msn') {
      setDialog('msn')
      return
    }
    if (!launch(id)) {
      setMissing(id)
    }
  }
  const start = () => {
    document.querySelector<HTMLButtonElement>('[data-start-button]')?.focus()
    windowsStore.dispatch({ type: 'blur' })
    setStartOpen((open) => !open)
  }
  const cycle = (reverse: boolean) => {
    const windows = windowsStore.get().windows
    const order = switching.current?.order ?? switcherOrder(windows)
    const selected = cycleTask(order, switching.current?.selected, reverse)
    if (selected === undefined) return
    switching.current = { order, selected }
    setSwitcher(switching.current)
    setStartOpen(false)
  }
  const release = () => {
    const current = switching.current
    switching.current = null
    setSwitcher(null)
    if (current) void animateWindow({ type: 'focus', id: current.selected })
  }
  const hostAction = useRef<(event: HostEvent) => void>(() => {})
  const windowsKey = (key: string, down: boolean, shift: boolean, repeat: boolean) => {
    if (key === 'Meta' || key === 'OS') {
      if (down) {
        if (!repeat) windowsTap.current = true
      } else {
        if (windowsTap.current) start()
        windowsTap.current = false
      }
      return
    }
    windowsTap.current = false
    if (!down || repeat) return
    setStartOpen(false)
    switch (key.toLowerCase()) {
      case 'r':
        setDialog('run')
        break
      case 'e':
        launch('explorer', { folder: ROOT })
        break
      case 'f':
        launch('find')
        break
      case 'm':
        windowsStore.dispatch({ type: shift ? 'undoMinimizeAll' : 'minimizeAll' })
        break
    }
  }
  hostAction.current = (event) => {
    if (power !== 'running') return
    if (event.type !== 'alt-release') cancelMenuAltTap()
    switch (event.type) {
      case 'host-close':
        setDialog('shutdown')
        break
      case 'windows-key':
        windowsKey(event.key, event.down, event.shift, event.repeat)
        break
      case 'start':
        start()
        break
      case 'alt-tab':
        cycle(event.reverse)
        break
      case 'alt-release':
        release()
        break
      case 'alt-f4': {
        if (requestActiveDialogClose()) break
        const id = windowsStore.get().focused
        if (id !== null) void requestWindowClose(id)
        else setDialog('shutdown')
        break
      }
    }
  }
  useEffect(() => window.win95?.onEvent((event) => hostAction.current(event)), [])
  useEffect(() => {
    installPrograms(programSpecs)
    installStartMenu(apps)
  }, [])
  useEffect(() => {
    if (power === 'dos') return
    if (power === 'running') {
      shellEvents.emit({ type: 'startup' })
      const folder = startMenuFolder()
      if (folder) for (const node of children(fs.get(), folder)) openNode(node.id)
      return
    }
    const timer = setTimeout(
      () => {
        if (power === 'booting') setPower('running')
        else if (power === 'shutting-down') setPower('off')
        else if (power === 'restarting') setPower('booting')
        else window.win95?.shutdown()
      },
      power === 'off' ? 2000 : 1600,
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
      if (event.metaKey || event.key === 'Meta' || event.key === 'OS') {
        event.preventDefault()
        event.stopImmediatePropagation()
        windowsKey(event.key, true, event.shiftKey, event.repeat)
        return
      }
      if (event.ctrlKey && event.altKey && !event.shiftKey && !event.metaKey && !event.repeat) {
        if (event.target instanceof Element && event.target.closest('[data-shortcut-key]')) return
        const shortcut = shortcutForKey(fs.get(), event.key)
        if (shortcut) {
          event.preventDefault()
          event.stopImmediatePropagation()
          openNode(shortcut)
          return
        }
      }
      if (event.altKey && (event.key === 'Tab' || event.key === '`')) {
        event.preventDefault()
        event.stopImmediatePropagation()
        cycle(event.shiftKey)
        return
      }
      if (event.altKey && event.key === 'F4') {
        event.preventDefault()
        event.stopImmediatePropagation()
        hostAction.current({ type: 'alt-f4' })
        return
      }
      if (event.ctrlKey && event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        hostAction.current({ type: 'start' })
        return
      }
      if (menuIsActive()) return
      if (event.altKey && event.key === 'Escape') {
        event.preventDefault()
        windowsStore.dispatch({ type: 'cycleBack' })
      }
      if (event.altKey && event.key === ' ') {
        const id = windowsStore.get().focused
        const box = document.querySelector(`[data-window="${id}"]`)?.getBoundingClientRect()
        if (id !== null && box) {
          event.preventDefault()
          openSystemMenu(id, { x: box.x, y: box.y + 22 })
        }
      }
      if (windowsStore.get().focused === null && !dialog && (event.key === 'F1' || event.key === 'F3')) {
        event.preventDefault()
        openApp(event.key === 'F1' ? 'help' : 'find')
      }
    }
    const keyUp = (event: KeyboardEvent) => {
      if (event.key === 'Meta' || event.key === 'OS') windowsKey(event.key, false, event.shiftKey, false)
      if (event.key === 'Alt') release()
    }
    const help = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.key !== 'F1' ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        menuIsActive()
      )
        return
      if (event.target instanceof Element && event.target.closest('[role="dialog"]')) return
      const focused = windowsStore.get()
      const app = focused.windows.find((window) => window.id === focused.focused)
      const book = app && helpBookForApp(app.appId)
      if (book) {
        event.preventDefault()
        launch('help', { book })
      }
    }
    const blur = () => {
      windowsTap.current = false
    }
    document.addEventListener('pointerdown', pointer, true)
    window.addEventListener('keydown', key, true)
    window.addEventListener('keyup', keyUp, true)
    document.addEventListener('keydown', help)
    window.addEventListener('blur', blur)
    return () => {
      document.removeEventListener('pointerdown', pointer, true)
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('keyup', keyUp, true)
      document.removeEventListener('keydown', help)
      window.removeEventListener('blur', blur)
    }
  })

  const shutDown = async (choice: ShutDownChoice) => {
    if (closing.current) return
    if (choice === 'dos' && !findAppByExe('command.com')) {
      setMissing('command.com')
      return
    }
    closing.current = true
    setDialog(null)
    setStartOpen(false)
    try {
      const closed = await closeSession(
        () => [...windowsStore.get().windows].reverse(),
        async (owner) => {
          if (!windowsStore.get().windows.some((window) => window.id === owner.id)) return true
          windowsStore.dispatch({ type: 'focus', id: owner.id })
          return requestWindowClose(owner.id)
        },
      )
      if (!closed) return
      shellEvents.emit({ type: 'shutdown' })
      if (choice === 'logoff') setDialog('logon')
      else if (choice === 'dos') {
        setPower('dos')
      } else setPower(choice === 'restart' ? 'restarting' : 'shutting-down')
    } finally {
      closing.current = false
    }
  }
  if (power === 'dos') return <DosSession onWindows={() => setPower('booting')} />
  if (power !== 'running')
    return (
      <PowerScreens
        power={power}
        onBoot={() => {
          if (power === 'off' && !window.win95) setPower('booting')
        }}
      />
    )
  const startPosition =
    settings.edge === 'top'
      ? { top: settings.rows * 28, bottom: 'auto' }
      : settings.edge === 'left'
        ? { left: settings.rows * 28, top: 0, bottom: 'auto' }
        : settings.edge === 'right'
          ? { right: settings.rows * 28, left: 'auto', top: 0, bottom: 'auto' }
          : { bottom: settings.rows * 28 - 2 }
  return (
    <ShellDialogHost.Provider value={dialogHost}>
      <div className="relative h-full w-full bg-desktop overflow-hidden">
        <div ref={desktopRef} className="absolute overflow-hidden" style={workArea(settings)} data-desktop>
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
        <Taskbar
          startOpen={startOpen}
          onStart={start}
          onProperties={() => setDialog('taskbar')}
          onDateTime={() => setDialog('datetime')}
          onApp={openApp}
          desktop={size}
        />
        {startOpen && (
          <div ref={menuRef}>
            <StartMenu
              onClose={() => setStartOpen(false)}
              onRun={() => setDialog('run')}
              onShutDown={() => setDialog('shutdown')}
              onApp={openApp}
              onProperties={() => setDialog('taskbar')}
              small={settings.smallIcons}
              style={startPosition}
            />
          </div>
        )}
        <div ref={setDialogHost} className="absolute inset-0 z-[10000] pointer-events-none" />
        {dialog === 'run' && <RunDialog onClose={() => setDialog(null)} />}
        {dialog === 'shutdown' && (
          <ShutDownDialog
            onChoose={(choice) => {
              void shutDown(choice)
            }}
            onClose={() => setDialog(null)}
            onHelp={() => {
              setDialog(null)
              openApp('help')
            }}
          />
        )}
        {dialog === 'taskbar' && <TaskbarProperties onClose={() => setDialog(null)} />}
        {dialog === 'datetime' && <DateTimeProperties onClose={() => setDialog(null)} />}
        {dialog === 'msn' && (
          <MessageBox
            title="The Microsoft Network"
            icon="info"
            message="The Microsoft Network is not installed. No online service provider is available."
            buttons={['OK']}
            onClose={() => setDialog(null)}
          />
        )}
        {dialog === 'logon' && (
          <Dialog title="Welcome to Windows" onClose={() => setDialog(null)} className="w-[340px]">
            <form
              className="p-[12px] flex flex-col gap-[12px]"
              onSubmit={(event) => {
                event.preventDefault()
                localStorage.setItem('w95.user.v1', user)
                setDialog(null)
              }}
            >
              <p>Type a user name to log on to Windows.</p>
              <label htmlFor="logon-user" className="flex gap-[8px] items-center">
                User name:
                <TextBox
                  id="logon-user"
                  autoFocus
                  value={user}
                  onChange={(event) => setUser(event.target.value)}
                />
              </label>
              <div className="flex justify-end gap-[6px]">
                <Button isDefault type="submit">
                  OK
                </Button>
                <Button onClick={() => setDialog(null)}>Cancel</Button>
              </div>
            </form>
          </Dialog>
        )}
        {missing && (
          <MessageBox
            title={missing === 'help' ? 'Windows Help' : 'Windows'}
            buttons={['OK']}
            icon="error"
            message={`Cannot find the file '${missing}' (or one of its components). Make sure the path and filename are correct and that all required libraries are available.`}
            onClose={() => setMissing(null)}
          />
        )}
        <SystemMenu />
        <DesktopDisplayProperties />
        <ScreenSaverHost />
        <TooltipLayer />
        <CaptionZoom />
        {switcher && (
          <TaskSwitcher windows={state.windows} order={switcher.order} selected={switcher.selected} />
        )}
      </div>
    </ShellDialogHost.Provider>
  )
}
