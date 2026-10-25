import { desktopBackground } from './backgrounds'
import type { Settings } from './model'
import { schemeProperties } from './schemes'
import { settingsStore } from './store'
import './desktop.css'

export function settingsProperties(settings: Settings): Record<string, string> {
  return {
    ...schemeProperties(
      settings.accessibility.highContrast
        ? { scheme: 'High Contrast Black and White', colors: {} }
        : settings.appearance,
      settings.desktopColor,
    ),
    ...desktopBackground(settings),
    '--cursor-blink': `${settings.keyboard.cursorBlink}ms`,
  }
}

export function applySettings(settings: Settings, target: Pick<CSSStyleDeclaration, 'setProperty'>): void {
  for (const [name, value] of Object.entries(settingsProperties(settings))) target.setProperty(name, value)
}

if (typeof document !== 'undefined') {
  const update = () => applySettings(settingsStore.get(), document.documentElement.style)
  update()
  settingsStore.subscribe(update)
}
