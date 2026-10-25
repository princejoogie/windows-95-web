import type { Settings } from './model'
import { timeZoneInfo } from './timeZones'

export interface ClockParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export function clockParts(timestamp: number, timeZone: string, adjustForDaylightSaving = true): ClockParts {
  const zone = adjustForDaylightSaving ? timeZone : 'UTC'
  const at = timestamp + (adjustForDaylightSaving ? 0 : timeZoneInfo(timeZone).offset * 60000)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(at)
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

export function clockOffsetForParts(
  parts: ClockParts,
  timeZone: string,
  now: number,
  adjustForDaylightSaving = true,
): number {
  const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  let timestamp = desired
  for (let i = 0; i < 3; i++) {
    const actual = clockParts(timestamp, timeZone, adjustForDaylightSaving)
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
  const zone = settings.adjustForDaylightSaving ? settings.timeZone : 'UTC'
  const date = new Date(
    now +
      settings.clockOffset +
      (settings.adjustForDaylightSaving ? 0 : timeZoneInfo(settings.timeZone).offset * 60000),
  )
  const locale = localeCodes[settings.regional.locale]
  return {
    time: date.toLocaleTimeString(locale, {
      timeZone: zone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: !settings.regional.time24,
    }),
    longDate: date.toLocaleDateString(locale, {
      timeZone: zone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  }
}
