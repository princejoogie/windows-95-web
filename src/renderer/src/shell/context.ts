import { createContext, useContext, useEffect, useRef } from 'react'
import { menuIsActive } from '../ui/Menu'
import type { WindowApi } from './types'

export interface WindowContextValue {
  readonly api: WindowApi
  /** Where this window's dialogs render, so they stack and minimize with it. */
  readonly dialogHost: HTMLElement | null
  /** A modeless dialog reports holding focus, which turns the owner's caption inactive. */
  readonly setDialogFocused: (focused: boolean) => void
}

export const WindowContext = createContext<WindowContextValue | null>(null)

/** Where dialogs that belong to no window render, such as Run and Shut Down. */
export const ShellDialogHost = createContext<HTMLElement | null>(null)

export function useWindow(): WindowApi {
  const value = useContext(WindowContext)
  if (!value) throw new Error('useWindow is only available inside an app window')
  return value.api
}

/** Listens for keys while this window has focus. Outside a window it always listens. */
export function useKeyDown(handler: (event: KeyboardEvent) => void): void {
  const value = useContext(WindowContext)
  const active = value ? value.api.focused : true
  const latest = useRef(handler)
  latest.current = handler
  useEffect(() => {
    if (!active) return
    const listener = (event: KeyboardEvent) => {
      if (!menuIsActive() && !event.defaultPrevented) latest.current(event)
    }
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [active])
}
