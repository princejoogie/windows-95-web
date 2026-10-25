import type { Settings } from './model'

export interface ClockParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export function clockParts(timestamp: number, timeZone: string): ClockParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(timestamp)
  const part = (name: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === name)?.value ?? 0)
  return {
    year: part('year'),
    month: part('month'),
    day: part('day'),
    hour: part('hour'),
    minute: part('minute'),
    second: part('second'),
  }
}

export function clockOffsetForParts(parts: ClockParts, timeZone: string, now: number): number {
  const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  let timestamp = desired
  for (let i = 0; i < 3; i++) {
    const actual = clockParts(timestamp, timeZone)
    const wall = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    )
    timestamp += desired - wall
  }
  return timestamp - now
}

const localeCodes: Record<Settings['regional']['locale'], string> = {
  'English (United States)': 'en-US',
  'English (United Kingdom)': 'en-GB',
  'English (Philippines)': 'en-PH',
  'French (France)': 'fr-FR',
  'German (Germany)': 'de-DE',
  'Japanese (Japan)': 'ja-JP',
}

export function formatClock(settings: Settings, now = Date.now()): { time: string; longDate: string } {
  const date = new Date(now + settings.clockOffset)
  const locale = localeCodes[settings.regional.locale]
  return {
    time: date.toLocaleTimeString(locale, {
      timeZone: settings.timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: !settings.regional.time24,
    }),
    longDate: date.toLocaleDateString(locale, {
      timeZone: settings.timeZone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  }
}
