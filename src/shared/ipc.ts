export const CHANNELS = {
  shutdown: 'system:shutdown',
  restart: 'system:restart',
  toggleFullScreen: 'system:toggle-full-screen',
} as const

/** What the preload exposes as `window.win95`. Absent in the plain web build. */
export interface Win95Host {
  shutdown(): void
  restart(): void
  toggleFullScreen(): void
}
