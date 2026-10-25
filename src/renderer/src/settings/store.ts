import { useEffect, useState } from 'react'
import { createStore, useStore } from '../lib/store'
import { parseSettings, type Settings, settingsReducer } from './model'

export const SETTINGS_KEY = 'win95.settings.v1'

function loadSettings(): Settings {
  try {
    return parseSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null'))
  } catch {
    return parseSettings(null)
  }
}

export const settingsStore = createStore(settingsReducer, loadSettings())
settingsStore.subscribe(() => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsStore.get()))
  } catch {
    // Session settings still apply when persistent storage is unavailable.
  }
})

export function useSettings(): Settings
export function useSettings<T>(select: (settings: Settings) => T): T
export function useSettings<T>(select?: (settings: Settings) => T): Settings | T {
  return useStore(settingsStore, (settings): Settings | T => (select ? select(settings) : settings))
}

export function getClockDate(now = Date.now()): Date {
  return new Date(now + settingsStore.get().clockOffset)
}

export function useClock(): Date {
  const offset = useSettings((settings) => settings.clockOffset)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return new Date(now + offset)
}

export function getDoubleClickSpeed(): number {
  return settingsStore.get().mouse.doubleClickMs
}
