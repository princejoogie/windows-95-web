import { playSound, type SoundPlayback } from '../system/sound'
import type { SoundEvent, SoundName } from './model'
import { settingsStore } from './store'

export async function previewSound(sound: SoundName): Promise<SoundPlayback | null> {
  return sound === '(None)' ? null : playSound(sound)
}

export async function playSystemSound(event: SoundEvent): Promise<SoundPlayback | null> {
  return previewSound(settingsStore.get().soundScheme[event])
}
