import { describe, expect, it } from 'vitest'
import { clockOffsetForParts, clockParts, formatClock } from './clock'
import { defaultSettings } from './model'
import { saverIsDue } from './ScreenSaverHost'

describe('virtual system clock', () => {
  it('sets a wall clock in the selected zone without changing the host clock', () => {
    const now = Date.UTC(1995, 7, 24, 0, 0, 0)
    const desired = { year: 1996, month: 2, day: 29, hour: 13, minute: 5, second: 9 }
    const offset = clockOffsetForParts(desired, 'Asia/Manila', now)
    expect(clockParts(now + offset, 'Asia/Manila')).toEqual(desired)
    expect(now).toBe(Date.UTC(1995, 7, 24, 0, 0, 0))
  })

  it('formats the taskbar clock with the persisted offset, region, and time zone', () => {
    const settings = {
      ...defaultSettings,
      clockOffset: 3600000,
      timeZone: 'UTC',
      regional: { ...defaultSettings.regional, time24: true },
    } satisfies typeof defaultSettings
    expect(formatClock(settings, Date.UTC(1995, 7, 24, 12, 5)).time).toBe('13:05')
    expect(formatClock(settings, Date.UTC(1995, 7, 24, 12, 5)).longDate).toContain('August 24, 1995')
  })

  it('uses standard time when automatic daylight saving is disabled', () => {
    const summer = Date.UTC(2026, 6, 1, 12)
    const settings = { ...defaultSettings, timeZone: 'America/Los_Angeles' } satisfies typeof defaultSettings
    expect(clockParts(summer, settings.timeZone).hour).toBe(5)
    expect(clockParts(summer, settings.timeZone, false).hour).toBe(4)
    expect(formatClock({ ...settings, adjustForDaylightSaving: false }, summer).time).toBe('4:00 AM')
    const desired = { year: 2026, month: 7, day: 1, hour: 4, minute: 0, second: 0 }
    expect(clockOffsetForParts(desired, settings.timeZone, summer, false)).toBe(0)
  })
})

describe('screen saver idle timing', () => {
  it('waits for the full interval, restarts on activity, and supports no saver', () => {
    const saver = {
      ...defaultSettings.screenSaver,
      name: 'Blank Screen',
      waitMinutes: 1 / 60,
    } satisfies typeof defaultSettings.screenSaver
    expect(saverIsDue(saver, 1000, 1999)).toBe(false)
    expect(saverIsDue(saver, 1000, 2000)).toBe(true)
    expect(saverIsDue(saver, 2000, 2001)).toBe(false)
    expect(saverIsDue({ ...saver, name: '(None)' }, 0, 999999)).toBe(false)
  })
})
