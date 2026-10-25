import { useSyncExternalStore } from 'react'
import type { SoundName } from './model'
import { settingsStore } from './store'

type SoundPlayer = (sound: Exclude<SoundName, '(None)'>) => void | Promise<void>
let player: SoundPlayer | null = null
const listeners = new Set<() => void>()

export function registerSoundPlayer(play: SoundPlayer): () => void {
  player = play
  for (const listener of listeners) listener()
  return () => {
    if (player !== play) return
    player = null
    for (const listener of listeners) listener()
  }
}

export function useSoundPlayerAvailable(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => player !== null,
  )
}

export async function previewSound(sound: SoundName): Promise<void> {
  if (sound !== '(None)' && player) await player(sound)
}

export async function playSystemSound(
  event: keyof ReturnType<typeof settingsStore.get>['soundScheme'],
): Promise<void> {
  await previewSound(settingsStore.get().soundScheme[event])
}
