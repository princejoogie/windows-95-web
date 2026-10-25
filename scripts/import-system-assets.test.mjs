import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  cursorHotspot,
  embolden,
  importSystemAssets,
  parseFnt,
  parseFon,
  writeTtf,
} from './import-system-assets.mjs'

const temporary = []
afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function temp() {
  const path = mkdtempSync(join(tmpdir(), 'win95-assets-'))
  temporary.push(path)
  return path
}

function syntheticFnt(version) {
  const table = version === 0x200 ? 118 : 148
  const stride = version === 0x200 ? 4 : 6
  const bitmap = table + 2 * stride
  const bytes = Buffer.alloc(bitmap + 3 + 10)
  bytes.writeUInt16LE(version, 0)
  bytes.writeUInt32LE(bytes.length, 2)
  bytes.writeUInt16LE(8, 68)
  bytes.writeUInt16LE(96, 70)
  bytes.writeUInt16LE(96, 72)
  bytes.writeUInt16LE(3, 74)
  bytes.writeUInt16LE(400, 83)
  bytes.writeUInt16LE(3, 88)
  bytes[95] = 65
  bytes[96] = 65
  bytes.writeUInt32LE(bitmap + 3, 105)
  bytes.writeUInt16LE(3, table)
  if (version === 0x200) bytes.writeUInt16LE(bitmap, table + 2)
  else bytes.writeUInt32LE(bitmap, table + 2)
  bytes.set([0x40, 0xa0, 0xe0], bitmap)
  bytes.write('Test face', bitmap + 3)
  return bytes
}

function tables(font) {
  const result = {}
  for (let i = 0; i < font.readUInt16BE(4); i++) {
    const entry = 12 + i * 16
    result[font.toString('ascii', entry, entry + 4)] = font.subarray(
      font.readUInt32BE(entry + 8),
      font.readUInt32BE(entry + 8) + font.readUInt32BE(entry + 12),
    )
  }
  return result
}

function contoursFor(tables, id) {
  const start = tables.loca.readUInt32BE(id * 4)
  const end = tables.loca.readUInt32BE((id + 1) * 4)
  if (start === end) return []
  const glyph = tables.glyf.subarray(start, end)
  const count = glyph.readInt16BE(0)
  const ends = Array.from({ length: count }, (_, i) => glyph.readUInt16BE(10 + i * 2))
  const pointCount = ends.at(-1) + 1
  const instructions = glyph.readUInt16BE(10 + count * 2)
  const flagsOffset = 12 + count * 2 + instructions
  const xOffset = flagsOffset + pointCount
  const yOffset = xOffset + pointCount * 2
  let x = 0
  let y = 0
  const points = Array.from({ length: pointCount }, (_, i) => {
    expect(glyph[flagsOffset + i]).toBe(1)
    x += glyph.readInt16BE(xOffset + i * 2)
    y += glyph.readInt16BE(yOffset + i * 2)
    return [x / 64, y / 64]
  })
  let first = 0
  return ends.map((last) => {
    const contour = points.slice(first, last + 1)
    first = last + 1
    return contour
  })
}

function rasterize(contours, width, height, ascent) {
  return Array.from({ length: height }, (_, row) =>
    Uint8Array.from({ length: width }, (_, column) => {
      const x = column + 0.5
      const y = ascent - row - 0.5
      let winding = 0
      for (const contour of contours) {
        for (let i = 0; i < contour.length; i++) {
          const [ax, ay] = contour[i]
          const [bx, by] = contour[(i + 1) % contour.length]
          const cross = (bx - ax) * (y - ay) - (x - ax) * (by - ay)
          if (ay <= y && by > y && cross > 0) winding++
          if (ay > y && by <= y && cross < 0) winding--
        }
      }
      return winding === 0 ? 0 : 1
    }),
  )
}

function checkPixels(face) {
  const font = writeTtf(face)
  const t = tables(font)
  expect(Object.keys(t).sort()).toEqual(
    ['OS/2', 'cmap', 'gasp', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'name', 'post'].sort(),
  )
  expect(t.head.readUInt16BE(18)).toBe((face.height - face.internalLeading) * 64)
  expect(t.hhea.readInt16BE(4)).toBe(face.ascent * 64)
  expect(t.hhea.readInt16BE(6)).toBe((face.ascent - face.height) * 64)
  let sum = 0
  for (let i = 0; i < font.length; i += 4) sum = (sum + font.readUInt32BE(i)) >>> 0
  expect(sum).toBe(0xb1b0afba)
  for (let i = 0; i < face.glyphs.length; i++) {
    const glyph = face.glyphs[i]
    const contours = contoursFor(t, i + 1)
    expect(
      rasterize(contours, glyph.width, face.height, face.ascent),
      `U+${glyph.codePoint.toString(16)} pixels`,
    ).toEqual(glyph.rows)
    expect(t.hmtx.readUInt16BE((i + 1) * 4), 'advance width').toBe(glyph.width * 64)
  }
}

describe('Windows raster font conversion', () => {
  it.each([0x200, 0x300])(
    'reads FNT version %i and preserves every bitmap pixel in TTF outlines',
    (version) => {
      const face = parseFnt(syntheticFnt(version))
      expect(face.glyphs[0].rows.map((row) => [...row])).toEqual([
        [0, 1, 0],
        [1, 0, 1],
        [1, 1, 1],
      ])
      checkPixels(face)
    },
  )

  it('emboldens by OR with a one pixel right shift and increases the advance by one', () => {
    const face = parseFnt(syntheticFnt(0x200))
    const bold = embolden(face)
    expect(bold.glyphs[0].width).toBe(4)
    expect(bold.glyphs[0].rows.map((row) => [...row])).toEqual([
      [0, 1, 1, 0],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ])
    expect(face.glyphs[0].width).toBe(3)
    checkPixels(bold)
  })

  const windows = process.env.WINDIR ?? 'C:/Windows'
  it.skipIf(!existsSync(join(windows, 'Fonts/sserife.fon')))(
    'parses local sserife.fon and round-trips every glyph including the 8pt A',
    () => {
      const faces = parseFon(readFileSync(join(windows, 'Fonts/sserife.fon'))).filter(
        (face) => face.dpiX === 96 && face.dpiY === 96 && [8, 10, 12].includes(face.points),
      )
      expect(faces.map((face) => face.points)).toEqual([8, 10, 12])
      for (const face of faces) {
        expect(face.face).toBe('MS Sans Serif')
        expect(face.glyphs.some((glyph) => glyph.codePoint === 65)).toBe(true)
        checkPixels(face)
        checkPixels(embolden(face))
      }
    },
  )

  it.skipIf(!existsSync(join(windows, 'Fonts/vgafix.fon')))(
    'round-trips every local Fixedsys glyph and advance',
    () => {
      for (const face of parseFon(readFileSync(join(windows, 'Fonts/vgafix.fon')))) checkPixels(face)
    },
  )

  it('rejects broken headers and out-of-range bitmap data', () => {
    expect(() => parseFon(Buffer.alloc(4))).toThrow(/Truncated/)
    expect(() => parseFon(Buffer.alloc(64))).toThrow(/MZ/)
    const bytes = syntheticFnt(0x300)
    bytes.writeUInt32LE(bytes.length, 150)
    expect(() => parseFnt(bytes)).toThrow(/Truncated/)
  })
})

describe('system asset import', () => {
  it('reads the CUR hotspot from the native 32px directory entry', () => {
    const bytes = Buffer.alloc(24)
    bytes.writeUInt16LE(2, 2)
    bytes.writeUInt16LE(1, 4)
    bytes[6] = 32
    bytes[7] = 32
    bytes.writeUInt16LE(7, 10)
    bytes.writeUInt16LE(9, 12)
    bytes.writeUInt32LE(2, 14)
    bytes.writeUInt32LE(22, 18)
    expect(cursorHotspot(bytes)).toEqual({ x: 7, y: 9 })
    bytes.writeUInt16LE(32, 10)
    expect(() => cursorHotspot(bytes)).toThrow(/hotspot/)
  })

  it('creates an offline fallback, removes stale generated assets, and leaves unchanged files untouched', () => {
    const outputDir = temp()
    const messages = []
    const options = { windowsDir: join(outputDir, 'absent'), outputDir, log: (line) => messages.push(line) }
    writeFileSync(join(outputDir, 'old.ttf'), 'stale')
    const first = importSystemAssets(options)
    expect(first.fonts).toEqual([])
    expect(first.sounds).toEqual([])
    expect(existsSync(join(outputDir, 'old.ttf'))).toBe(false)
    expect(readFileSync(join(outputDir, '.gitignore'), 'utf8')).toBe('*\n!.gitignore\n')
    const before = statSync(join(outputDir, 'assets.css')).mtimeMs
    expect(importSystemAssets(options)).toEqual(first)
    expect(statSync(join(outputDir, 'assets.css')).mtimeMs).toBe(before)
    expect(messages).toEqual([first.message, first.message])
    expect(first.message).toMatch(/fallback fonts, CSS cursors, and silence/)
  })

  it('recreates a deleted output file even with a matching source signature', () => {
    const outputDir = temp()
    const options = { windowsDir: join(outputDir, 'absent'), outputDir, log: () => {} }
    importSystemAssets(options)
    rmSync(join(outputDir, 'assets.css'))
    importSystemAssets(options)
    expect(existsSync(join(outputDir, 'assets.css'))).toBe(true)
  })
})
