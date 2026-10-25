import type { FsNode } from '../fs/types'
import type { SoundName as SystemSoundName } from '../system/sound'
import { type BackgroundSettings, patternNames, wallpaperNames, wallpaperNode } from './backgrounds'
import { type AppearanceSettings, schemeNames, themeColorNames } from './schemes'
import { windowsTimeZones } from './timeZones'

export const saverNames = [
  '(None)',
  'Flying Windows',
  'Starfield Simulation',
  'Mystify Your Mind',
  'Curves and Colors',
  'Scrolling Marquee',
  'Blank Screen',
] as const
export type SaverName = (typeof saverNames)[number]
export const soundNames = [
  '(None)',
  'ding',
  'chord',
  'tada',
  'chimes',
  'notify',
  'recycle',
] as const satisfies readonly (SystemSoundName | '(None)')[]
export type SoundName = SystemSoundName | '(None)'
export const soundEvents = [
  'Asterisk',
  'Critical Stop',
  'Default Sound',
  'Exclamation',
  'Exit Windows',
  'Maximize',
  'Menu Command',
  'Menu Popup',
  'Minimize',
  'New Mail Notification',
  'Question',
  'Restore Down',
  'Restore Up',
  'Start Windows',
  'Empty Recycle Bin',
] as const
export type SoundEvent = (typeof soundEvents)[number]
export const locales = [
  'English (United States)',
  'English (United Kingdom)',
  'English (Philippines)',
  'French (France)',
  'German (Germany)',
  'Japanese (Japan)',
] as const
export const timeZones = windowsTimeZones.map((zone) => zone.id)

export interface Settings extends BackgroundSettings {
  appearance: AppearanceSettings
  screenSaver: { name: SaverName; waitMinutes: number; marquee: string; speed: number }
  mouse: { doubleClickMs: number; swapped: boolean; trails: boolean; motion: number }
  soundScheme: Record<SoundEvent, SoundName>
  clockOffset: number
  timeZone: (typeof timeZones)[number]
  adjustForDaylightSaving: boolean
  keyboard: { repeatDelay: number; repeatRate: number; cursorBlink: number }
  regional: {
    locale: (typeof locales)[number]
    currency: string
    dateFormat: 'M/d/yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd'
    time24: boolean
  }
  accessibility: {
    stickyKeys: boolean
    filterKeys: boolean
    toggleKeys: boolean
    highContrast: boolean
    mouseKeys: boolean
    showSounds: boolean
  }
  network: {
    computer: string
    workgroup: string
    description: string
    userAccess: boolean
    components: string[]
  }
  passwords: { remoteAdmin: boolean; separateProfiles: boolean; desktop: boolean; startMenu: boolean }
  multimedia: {
    playbackVolume: number
    recordingVolume: number
    preferredOnly: boolean
    videoSize: string
    midi: string
    cdVolume: number
  }
  dialing: { location: string; country: string; areaCode: string; outside: string; tone: boolean }
  joystick: { type: string }
}

export const defaultSettings: Settings = {
  desktopColor: '#008080',
  pattern: null,
  customPattern: null,
  wallpaper: null,
  wallpaperMode: 'center',
  appearance: { scheme: 'Windows Standard', colors: {} },
  screenSaver: { name: '(None)', waitMinutes: 10, marquee: 'Windows 95', speed: 3 },
  mouse: { doubleClickMs: 500, swapped: false, trails: false, motion: 5 },
  soundScheme: {
    Asterisk: 'ding',
    'Critical Stop': 'chord',
    'Default Sound': 'ding',
    Exclamation: 'chord',
    'Exit Windows': 'chimes',
    Maximize: '(None)',
    'Menu Command': '(None)',
    'Menu Popup': '(None)',
    Minimize: '(None)',
    'New Mail Notification': 'notify',
    Question: 'chord',
    'Restore Down': '(None)',
    'Restore Up': '(None)',
    'Start Windows': 'tada',
    'Empty Recycle Bin': 'recycle',
  },
  clockOffset: 0,
  timeZone: 'Asia/Manila',
  adjustForDaylightSaving: true,
  keyboard: { repeatDelay: 500, repeatRate: 20, cursorBlink: 530 },
  regional: { locale: 'English (United States)', currency: '$', dateFormat: 'M/d/yyyy', time24: false },
  accessibility: {
    stickyKeys: false,
    filterKeys: false,
    toggleKeys: false,
    highContrast: false,
    mouseKeys: false,
    showSounds: false,
  },
  network: {
    computer: 'WINDOWS95',
    workgroup: 'WORKGROUP',
    description: '',
    userAccess: false,
    components: ['Client for Microsoft Networks', 'Dial-Up Adapter', 'TCP/IP'],
  },
  passwords: { remoteAdmin: false, separateProfiles: false, desktop: true, startMenu: true },
  multimedia: {
    playbackVolume: 75,
    recordingVolume: 75,
    preferredOnly: false,
    videoSize: 'Original size',
    midi: 'MIDI Mapper',
    cdVolume: 75,
  },
  dialing: {
    location: 'My Location',
    country: 'United States of America (1)',
    areaCode: '',
    outside: '',
    tone: true,
  },
  joystick: { type: '(None)' },
}

export type SettingsAction = { type: 'apply'; patch: Partial<Settings> } | { type: 'reset' }

export function settingsReducer(state: Settings, action: SettingsAction): Settings {
  if (action.type === 'reset') return defaultSettings
  return {
    ...parseSettings({ ...state, ...action.patch }),
    wallpaper: action.patch.wallpaper === undefined ? state.wallpaper : action.patch.wallpaper,
  }
}

function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {}
}

function choice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return choices.find((candidate) => candidate === value) ?? fallback
}

function number(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function text(value: unknown, fallback: string, limit: number): string {
  return typeof value === 'string' ? value.slice(0, limit) : fallback
}

export function hexColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback
}

export function parseSettings(value: unknown, nodes: readonly FsNode[] = []): Settings {
  const source = object(value)
  const appearance = object(source.appearance)
  const colors = object(appearance.colors)
  const saver = object(source.screenSaver)
  const mouse = object(source.mouse)
  const sounds = object(source.soundScheme)
  const keyboard = object(source.keyboard)
  const regional = object(source.regional)
  const accessibility = object(source.accessibility)
  const network = object(source.network)
  const passwords = object(source.passwords)
  const multimedia = object(source.multimedia)
  const dialing = object(source.dialing)
  const joystick = object(source.joystick)
  const defaults = defaultSettings
  const soundScheme = { ...defaults.soundScheme }
  for (const event of soundEvents)
    soundScheme[event] = choice(sounds[event], soundNames, defaults.soundScheme[event])
  return {
    desktopColor: hexColor(source.desktopColor, defaults.desktopColor),
    pattern: patternNames.find((name) => name === source.pattern) ?? null,
    customPattern:
      Array.isArray(source.customPattern) &&
      source.customPattern.length === 8 &&
      source.customPattern.every(
        (row) => typeof row === 'number' && Number.isInteger(row) && row >= 0 && row <= 255,
      )
        ? source.customPattern
        : null,
    wallpaper:
      wallpaperNames.find((name) => name === source.wallpaper) ??
      wallpaperNode(source.wallpaper, nodes)?.id ??
      null,
    wallpaperMode: source.wallpaperMode === 'tile' ? 'tile' : 'center',
    appearance: {
      scheme: choice(appearance.scheme, schemeNames, defaults.appearance.scheme),
      colors: Object.fromEntries(
        themeColorNames.flatMap((name) =>
          typeof colors[name] === 'string' && /^#[0-9a-f]{6}$/i.test(colors[name])
            ? [[name, colors[name]]]
            : [],
        ),
      ),
    },
    screenSaver: {
      name: choice(saver.name, saverNames, defaults.screenSaver.name),
      waitMinutes: number(saver.waitMinutes, 10, 1 / 60, 120),
      marquee: text(saver.marquee, 'Windows 95', 128),
      speed: number(saver.speed, 3, 1, 10),
    },
    mouse: {
      doubleClickMs: number(mouse.doubleClickMs, 500, 100, 900),
      swapped: bool(mouse.swapped, false),
      trails: bool(mouse.trails, false),
      motion: number(mouse.motion, 5, 1, 10),
    },
    soundScheme,
    clockOffset: number(source.clockOffset, 0, -3155760000000, 3155760000000),
    timeZone: choice(source.timeZone, timeZones, defaults.timeZone),
    adjustForDaylightSaving: bool(source.adjustForDaylightSaving, true),
    keyboard: {
      repeatDelay: number(keyboard.repeatDelay, 500, 250, 1000),
      repeatRate: number(keyboard.repeatRate, 20, 2, 30),
      cursorBlink: number(keyboard.cursorBlink, 530, 0, 1200),
    },
    regional: {
      locale: choice(regional.locale, locales, defaults.regional.locale),
      currency: text(regional.currency, '$', 8),
      dateFormat: choice(
        regional.dateFormat,
        ['M/d/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd'],
        defaults.regional.dateFormat,
      ),
      time24: bool(regional.time24, false),
    },
    accessibility: {
      stickyKeys: bool(accessibility.stickyKeys, false),
      filterKeys: bool(accessibility.filterKeys, false),
      toggleKeys: bool(accessibility.toggleKeys, false),
      highContrast: bool(accessibility.highContrast, false),
      mouseKeys: bool(accessibility.mouseKeys, false),
      showSounds: bool(accessibility.showSounds, false),
    },
    network: {
      computer: text(network.computer, defaults.network.computer, 15),
      workgroup: text(network.workgroup, defaults.network.workgroup, 15),
      description: text(network.description, '', 48),
      userAccess: bool(network.userAccess, false),
      components: Array.isArray(network.components)
        ? defaults.network.components.filter(
            (name) => Array.isArray(network.components) && network.components.includes(name),
          )
        : [...defaults.network.components],
    },
    passwords: {
      remoteAdmin: bool(passwords.remoteAdmin, false),
      separateProfiles: bool(passwords.separateProfiles, false),
      desktop: bool(passwords.desktop, true),
      startMenu: bool(passwords.startMenu, true),
    },
    multimedia: {
      playbackVolume: number(multimedia.playbackVolume, 75, 0, 100),
      recordingVolume: number(multimedia.recordingVolume, 75, 0, 100),
      preferredOnly: bool(multimedia.preferredOnly, false),
      videoSize: choice(
        multimedia.videoSize,
        ['Original size', 'Double size', 'Full screen'],
        'Original size',
      ),
      midi: choice(multimedia.midi, ['MIDI Mapper'], 'MIDI Mapper'),
      cdVolume: number(multimedia.cdVolume, 75, 0, 100),
    },
    dialing: {
      location: text(dialing.location, 'My Location', 48),
      country: choice(
        dialing.country,
        ['United States of America (1)', 'United Kingdom (44)', 'Philippines (63)'],
        'United States of America (1)',
      ),
      areaCode: text(dialing.areaCode, '', 8),
      outside: text(dialing.outside, '', 8),
      tone: bool(dialing.tone, true),
    },
    joystick: {
      type: choice(
        joystick.type,
        ['(None)', '2-axis, 2-button joystick', '2-axis, 4-button joystick', 'Flight yoke', 'Gamepad'],
        '(None)',
      ),
    },
  }
}

export function changedSettings(before: Settings, after: Settings): Partial<Settings> {
  return Object.fromEntries(
    Object.entries(after).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(Reflect.get(before, key)),
    ),
  )
}
