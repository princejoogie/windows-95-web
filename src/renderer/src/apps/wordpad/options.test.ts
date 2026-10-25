import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OPTIONS,
  DEFAULT_PAGE,
  dateTimeFormats,
  displayName,
  documentTypeFor,
  formatMeasure,
  loadOptions,
  pageArea,
  parseMeasure,
  saveOptions,
} from './options'

describe('WordPad options', () => {
  it('knows which document type a file is and how Windows shows its name', () => {
    expect(documentTypeFor('Letter.doc')).toBe('word6')
    expect(documentTypeFor('notes.RTF')).toBe('rtf')
    expect(documentTypeFor('readme.txt')).toBe('text')
    expect(documentTypeFor('old.wri')).toBe('write')
    expect(documentTypeFor('data.csv')).toBe('text')
    expect(displayName('Letter.doc')).toBe('Letter')
    expect(displayName('notes.v2.rtf')).toBe('notes.v2')
    expect(displayName('data.csv')).toBe('data.csv')
  })

  it('persists per-type view options and falls back to the defaults for anything missing or broken', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    }
    expect(loadOptions(storage)).toEqual(DEFAULT_OPTIONS)
    const changed = {
      ...DEFAULT_OPTIONS,
      units: 'cm' as const,
      types: {
        ...DEFAULT_OPTIONS.types,
        text: { ...DEFAULT_OPTIONS.types.text, ruler: true, wordWrap: 'none' as const },
      },
    }
    saveOptions(changed, storage)
    expect(loadOptions(storage)).toEqual(changed)
    store.set('w95.wordpad.options', '{"types":{"rtf":{"toolbar":false}}')
    expect(loadOptions(storage)).toEqual(DEFAULT_OPTIONS)
    store.set('w95.wordpad.options', '{"types":{"rtf":{"toolbar":false}}}')
    expect(loadOptions(storage).types.rtf).toEqual({ ...DEFAULT_OPTIONS.types.rtf, toolbar: false })
  })

  it('shows and reads measurements in the chosen unit', () => {
    expect(formatMeasure(720, 'inches')).toBe('0.5"')
    expect(formatMeasure(1440, 'cm')).toBe('2.54 cm')
    expect(formatMeasure(240, 'points')).toBe('12 pt')
    expect(formatMeasure(720, 'picas')).toBe('3 pi')
    expect(parseMeasure('0.5', 'inches')).toBe(720)
    expect(parseMeasure('1.27 cm', 'inches')).toBe(720)
    expect(parseMeasure('-0.25"', 'cm')).toBe(-360)
    expect(parseMeasure('12pt', 'inches')).toBe(240)
    expect(parseMeasure('abc', 'inches')).toBe(null)
  })

  it('computes the printable area from the paper, orientation, and margins', () => {
    expect(pageArea(DEFAULT_PAGE)).toEqual({
      paperWidth: 12240,
      paperHeight: 15840,
      width: 8640,
      height: 12960,
    })
    expect(pageArea({ ...DEFAULT_PAGE, orientation: 'landscape' })).toMatchObject({
      width: 12240,
      height: 9360,
    })
  })

  it('lists the Date and Time formats for a moment', () => {
    const formats = dateTimeFormats(new Date(1995, 7, 24, 15, 4, 9))
    expect(formats).toEqual([
      '8/24/95',
      '08/24/95',
      '8/24/1995',
      '08/24/1995',
      '95/08/24',
      '1995-08-24',
      '24-Aug-95',
      'Thursday, August 24, 1995',
      'August 24, 1995',
      'Thursday, 24 August, 1995',
      '24 August, 1995',
      '3:04:09 PM',
      '03:04:09 PM',
      '15:04:09',
      '15:04:09',
    ])
  })
})
