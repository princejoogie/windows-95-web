import { describe, expect, it } from 'vitest'
import { DOCUMENTS_DIR, type FsNode, WINDOWS_DIR } from '../fs/types'
import { applySettings } from './apply'
import { desktopBackground, patternImage, patternNames, patterns } from './backgrounds'
import { changedSettings, defaultSettings, parseSettings, settingsReducer } from './model'
import { schemeNames, schemeProperties } from './schemes'

describe('persistent settings', () => {
  it('round trips every applet through persisted JSON', () => {
    const settings = settingsReducer(defaultSettings, {
      type: 'apply',
      patch: {
        pattern: 'Bricks',
        wallpaper: 'Setup',
        wallpaperMode: 'tile',
        clockOffset: 3600000,
        appearance: { scheme: 'Eggplant', colors: { title: '#123456' } },
        keyboard: { repeatDelay: 250, repeatRate: 30, cursorBlink: 0 },
        accessibility: { ...defaultSettings.accessibility, stickyKeys: true },
      },
    })
    expect(parseSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings)
  })

  it('validates corrupt storage and clamps external numeric values', () => {
    expect(parseSettings(null)).toEqual(defaultSettings)
    const result = parseSettings({
      desktopColor: 'url(https://invalid)',
      mouse: { doubleClickMs: 0 },
      clockOffset: Number.NaN,
      appearance: { scheme: 'missing', colors: { title: 'red' } },
    })
    expect(result.desktopColor).toBe('#008080')
    expect(result.mouse.doubleClickMs).toBe(100)
    expect(result.appearance).toEqual(defaultSettings.appearance)
    expect(result.clockOffset).toBe(0)
  })

  it('applies only changed fields so two open property sheets do not overwrite each other', () => {
    const draft = { ...defaultSettings, pattern: 'Weave' } satisfies typeof defaultSettings
    const clockChanged = settingsReducer(defaultSettings, { type: 'apply', patch: { clockOffset: 1000 } })
    const result = settingsReducer(clockChanged, {
      type: 'apply',
      patch: changedSettings(defaultSettings, draft),
    })
    expect(result.pattern).toBe('Weave')
    expect(result.clockOffset).toBe(1000)
    expect(settingsReducer(result, { type: 'reset' })).toEqual(defaultSettings)
  })
})

describe('Windows desktop backgrounds', () => {
  const wallpaper: FsNode = {
    id: DOCUMENTS_DIR,
    kind: 'file',
    name: 'Wallpaper.bmp',
    parent: WINDOWS_DIR,
    modified: 0,
    content:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF1sAAAAASUVORK5CYII=',
  }

  it('loads a file wallpaper at its native size and keeps it through unrelated settings edits', () => {
    const settings = parseSettings({ wallpaper: wallpaper.id, wallpaperMode: 'tile' }, [wallpaper])
    expect(settings.wallpaper).toBe(wallpaper.id)
    expect(desktopBackground(settings, [wallpaper])['--desktop-size']).toBe('1px 1px, 8px 8px')
    expect(desktopBackground(settings, [wallpaper])['--desktop-repeat']).toBe('repeat, repeat')
    expect(settingsReducer(settings, { type: 'apply', patch: { clockOffset: 1000 } }).wallpaper).toBe(
      wallpaper.id,
    )
    expect(parseSettings({ wallpaper: wallpaper.id }).wallpaper).toBeNull()
    expect(desktopBackground(settings)['--desktop-image']).toBe('none')
  })

  it('falls back to the pattern for corrupt image contents', () => {
    const corrupt = { ...wallpaper, content: 'data:image/png;base64,broken' }
    expect(
      desktopBackground({ ...defaultSettings, wallpaper: wallpaper.id }, [corrupt])['--desktop-image'],
    ).toBe('none')
  })
  it('supplies twenty distinct eight by eight monochrome bitmaps', () => {
    expect(patternNames).toHaveLength(20)
    const images = new Set<string>()
    for (const name of patternNames) {
      expect(patterns[name]).toHaveLength(8)
      expect(patterns[name].every((row) => Number.isInteger(row) && row >= 0 && row <= 255)).toBe(true)
      const image = patternImage(name)
      expect(decodeURIComponent(image)).toContain('width="8" height="8"')
      expect(image).not.toContain('https:')
      images.add(image)
    }
    expect(images.size).toBe(20)
  })

  it('centers or tiles wallpaper over a repeating pattern at its native size', () => {
    expect(desktopBackground({ ...defaultSettings, pattern: 'Bricks' })['--desktop-repeat']).toBe('repeat')
    expect(desktopBackground({ ...defaultSettings, pattern: 'Bricks' })['--desktop-position']).toBe(
      'left top',
    )
    const settings = {
      ...defaultSettings,
      wallpaper: 'Setup',
      pattern: 'Bricks',
    } satisfies typeof defaultSettings
    const centered = desktopBackground(settings)
    expect(centered['--desktop-repeat']).toBe('no-repeat, repeat')
    expect(centered['--desktop-size']).toBe('320px 200px, 8px 8px')
    expect(centered['--desktop-image']).toContain(patternImage('Bricks'))
    expect(desktopBackground({ ...settings, wallpaperMode: 'tile' })['--desktop-repeat']).toBe(
      'repeat, repeat',
    )
  })
})

describe('appearance application', () => {
  it('changes every theme token for Eggplant and restores Windows Standard', () => {
    expect(schemeNames).toHaveLength(18)
    const properties = new Map<string, string>()
    const target = {
      setProperty: (name: string, value: string | null) => {
        properties.set(name, value ?? '')
      },
    }
    applySettings({ ...defaultSettings, appearance: { scheme: 'Eggplant', colors: {} } }, target)
    expect(properties.get('--color-face')).toBe('#c0b0c8')
    expect(properties.get('--color-title')).toBe('#400040')
    expect(properties.get('--color-select')).toBe('#400040')
    applySettings(defaultSettings, target)
    expect(properties.get('--color-face')).toBe('#c0c0c0')
    expect(properties.get('--color-title')).toBe('#000080')
    expect(properties.get('--color-desktop')).toBe('#008080')
  })

  it('preserves custom item colors and explicit desktop color', () => {
    expect(schemeProperties({ scheme: 'Eggplant', colors: { title: '#112233' } }, '#445566')).toMatchObject({
      '--color-title': '#112233',
      '--color-desktop': '#445566',
    })
  })
})
