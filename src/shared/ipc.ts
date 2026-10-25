export const CHANNELS = {
  shutdown: 'system:shutdown',
  restart: 'system:restart',
  toggleFullScreen: 'system:toggle-full-screen',
  hostEvent: 'system:host-event',
} as const

export type HostEvent =
  | { type: 'alt-f4' }
  | { type: 'alt-tab'; reverse: boolean }
  | { type: 'alt-release' }
  | { type: 'start' }
  | { type: 'host-close' }
  | { type: 'windows-key'; key: string; down: boolean; shift: boolean; repeat: boolean }

/** What the preload exposes as `window.win95`. Absent in the plain web build. */
export interface Win95Host {
  shutdown(): void
  restart(): void
  toggleFullScreen(): void
  onEvent(handler: (event: HostEvent) => void): () => void
}
