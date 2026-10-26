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

/** Absolute virtual time. Stored file timestamps already include this offset. */
export const virtualTimestamp = (settings: Settings, now = Date.now()): number => now + settings.clockOffset

/** Adapts legacy date formatters that read local Date fields. Do not store this value as a timestamp. */
export function wallClockDate(settings: Settings, timestamp = virtualTimestamp(settings)): Date {
  const parts = clockParts(timestamp, settings.timeZone, settings.adjustForDaylightSaving)
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
}

export function formatDate(settings: Settings, timestamp = virtualTimestamp(settings)): string {
  const { year, month, day } = clockParts(timestamp, settings.timeZone, settings.adjustForDaylightSaving)
  const two = (value: number) => String(value).padStart(2, '0')
  switch (settings.regional.dateFormat) {
    case 'M/d/yy':
      return `${month}/${day}/${two(year % 100)}`
    case 'M/d/yyyy':
      return `${month}/${day}/${year}`
    case 'dd/MM/yyyy':
      return `${two(day)}/${two(month)}/${year}`
    case 'yyyy-MM-dd':
      return `${year}-${two(month)}-${two(day)}`
  }
}

export function formatTime(settings: Settings, timestamp = virtualTimestamp(settings)): string {
  const { hour, minute } = clockParts(timestamp, settings.timeZone, settings.adjustForDaylightSaving)
  const minutes = String(minute).padStart(2, '0')
  return settings.regional.time24
    ? `${String(hour).padStart(2, '0')}:${minutes}`
    : `${hour % 12 || 12}:${minutes} ${hour < 12 ? 'AM' : 'PM'}`
}

export function formatDateTime(settings: Settings, timestamp = virtualTimestamp(settings)): string {
  return `${formatDate(settings, timestamp)} ${formatTime(settings, timestamp)}`
}

export function formatTimeDate(settings: Settings, timestamp = virtualTimestamp(settings)): string {
  return `${formatTime(settings, timestamp)} ${formatDate(settings, timestamp)}`
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
