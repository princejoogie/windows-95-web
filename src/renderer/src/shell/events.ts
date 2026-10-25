export type ShellEvent =
  | 'startup'
  | 'shutdown'
  | 'open'
  | 'close'
  | 'minimize'
  | 'maximize'
  | 'restore'
  | 'error'
  | 'question'
  | 'menu-command'

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
