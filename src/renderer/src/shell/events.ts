/**
 * What the shell announces. A message box announces its icon (`error`, `warning`, `info`, `question`), and
 * `default-beep` is the plain beep, such as a click on a window whose modal dialog is open. Restore says which
 * way the window went: `up` from the taskbar, `down` from maximized.
 */
export type ShellEvent =
  | {
      readonly type:
        | 'startup'
        | 'shutdown'
        | 'open'
        | 'close'
        | 'minimize'
        | 'maximize'
        | 'error'
        | 'warning'
        | 'info'
        | 'question'
        | 'default-beep'
        | 'menu-command'
    }
  | { readonly type: 'restore'; readonly direction: 'up' | 'down' }

const listeners = new Set<(event: ShellEvent) => void>()
export const shellEvents = {
  emit(event: ShellEvent) {
    for (const listener of listeners) listener(event)
  },
  subscribe(listener: (event: ShellEvent) => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
