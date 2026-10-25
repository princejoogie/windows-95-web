import type { Win95Host } from '../shared/ipc'

declare global {
  interface Window {
    win95?: Win95Host
  }
}
