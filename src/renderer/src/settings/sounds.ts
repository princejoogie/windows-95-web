import { fsStore } from '../fs/store'
import { type ShellEvent, shellEvents } from '../shell/events'
import { playSound, type SoundPlayback } from '../system/sound'
import type { SoundEvent, SoundName } from './model'
import { settingsStore } from './store'

export async function previewSound(sound: SoundName): Promise<SoundPlayback | null> {
  return sound === '(None)' ? null : playSound(sound)
}

export async function playSystemSound(event: SoundEvent): Promise<SoundPlayback | null> {
  return previewSound(settingsStore.get().soundScheme[event])
}

const shellSounds = {
  startup: 'Start Windows',
  shutdown: 'Exit Windows',
  error: 'Critical Stop',
  warning: 'Exclamation',
  info: 'Asterisk',
  question: 'Question',
  'default-beep': 'Default Sound',
  minimize: 'Minimize',
  maximize: 'Maximize',
  'menu-command': 'Menu Command',
  open: null,
  close: null,
} satisfies Record<Exclude<ShellEvent['type'], 'restore'>, SoundEvent | null>

const soundFor = (event: ShellEvent): SoundEvent | null =>
  event.type === 'restore'
    ? event.direction === 'up'
      ? 'Restore Up'
      : 'Restore Down'
    : shellSounds[event.type]

export function connectSystemSounds(): () => void {
  const unsubscribeShell = shellEvents.subscribe((event) => {
    const sound = soundFor(event)
    if (sound) void playSystemSound(sound)
  })
  let previous = fsStore.get()
  const unsubscribeFs = fsStore.subscribe(() => {
    const next = fsStore.get()
    const removed = Object.values(previous.nodes).filter((node) => node.id in previous.recycled)
    if (
      removed.length > 0 &&
      Object.keys(next.recycled).length === 0 &&
      removed.every((node) => !next.nodes[node.id])
    )
      void playSystemSound('Empty Recycle Bin')
    previous = next
  })
  return () => {
    unsubscribeShell()
    unsubscribeFs()
  }
}
