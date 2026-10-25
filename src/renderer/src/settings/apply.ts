import type { FsNode } from '../fs/types'
import { desktopBackground } from './backgrounds'
import type { Settings } from './model'
import { schemeProperties } from './schemes'
import './desktop.css'

export function settingsProperties(
  settings: Settings,
  nodes: readonly FsNode[] = [],
): Record<string, string> {
  return {
    ...schemeProperties(
      settings.accessibility.highContrast
        ? { scheme: 'High Contrast Black and White', colors: {} }
        : settings.appearance,
      settings.desktopColor,
    ),
    ...desktopBackground(settings, nodes),
    '--cursor-blink': `${settings.keyboard.cursorBlink}ms`,
  }
}

export function applySettings(
  settings: Settings,
  target: Pick<CSSStyleDeclaration, 'setProperty'>,
  nodes: readonly FsNode[] = [],
): void {
  for (const [name, value] of Object.entries(settingsProperties(settings, nodes)))
    target.setProperty(name, value)
}

if (typeof document !== 'undefined') void import('./runtime')
