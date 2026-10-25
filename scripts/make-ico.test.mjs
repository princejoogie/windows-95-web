import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { buildIco, ICO_PATH } from './make-ico.mjs'

const PNG_SIGNATURE = '89504e470d0a1a0a'

function readIco(file) {
  const entries = Array.from({ length: file.readUInt16LE(4) }, (_, i) => {
    const at = 6 + 16 * i
    return {
      size: file[at] || 256,
      height: file[at + 1] || 256,
      planes: file.readUInt16LE(at + 4),
      bpp: file.readUInt16LE(at + 6),
      bytes: file.readUInt32LE(at + 8),
      offset: file.readUInt32LE(at + 12),
    }
  })
  return { reserved: file.readUInt16LE(0), type: file.readUInt16LE(2), entries }
}

/** Decodes the 8-bit RGBA, filter-0 PNGs that make-ico writes. */
function decodePng(data) {
  expect(data.subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE)
  const width = data.readUInt32BE(16)
  const height = data.readUInt32BE(20)
  const idat = []
  for (let at = 8; at < data.length; ) {
    const length = data.readUInt32BE(at)
    if (data.toString('ascii', at + 4, at + 8) === 'IDAT') idat.push(data.subarray(at + 8, at + 8 + length))
    at += length + 12
  }
  const raw = inflateSync(Buffer.concat(idat))
  const pixel = (x, y) =>
    raw
      .readUInt32BE(y * (width * 4 + 1) + 1 + x * 4)
      .toString(16)
      .padStart(8, '0')
  return { width, height, pixel }
}

describe('icon.ico', () => {
  const file = readFileSync(ICO_PATH)
  const ico = readIco(file)

  it('is an icon directory of four 32-bit images at 16, 32, 48, and 256 px', () => {
    expect(ico.reserved).toBe(0)
    expect(ico.type).toBe(1)
    expect(ico.entries.map((entry) => [entry.size, entry.height, entry.planes, entry.bpp])).toEqual([
      [16, 16, 1, 32],
      [32, 32, 1, 32],
      [48, 48, 1, 32],
      [256, 256, 1, 32],
    ])
  })

  it('packs each image right after the directory and the one before it, ending at the end of the file', () => {
    let expected = 6 + 16 * ico.entries.length
    for (const entry of ico.entries) {
      expect(entry.offset).toBe(expected)
      expected += entry.bytes
    }
    expect(expected).toBe(file.length)
  })

  it('stores each image as a PNG of the size its entry declares, showing the flag', () => {
    for (const entry of ico.entries) {
      const image = decodePng(file.subarray(entry.offset, entry.offset + entry.bytes))
      expect([image.width, image.height]).toEqual([entry.size, entry.size])
      expect(image.pixel(0, 0)).toBe('00000000')
    }
    const big = ico.entries[3]
    const flag = decodePng(file.subarray(big.offset, big.offset + big.bytes))
    expect(flag.pixel(19 * 8 + 4, 9 * 8 + 4)).toBe('ff0000ff')
    expect(flag.pixel(27 * 8 + 4, 9 * 8 + 4)).toBe('00ff00ff')
    expect(flag.pixel(19 * 8 + 4, 18 * 8 + 4)).toBe('0000ffff')
    expect(flag.pixel(27 * 8 + 4, 18 * 8 + 4)).toBe('ffff00ff')
  })

  it('is up to date with the flag art', () => {
    expect(buildIco().equals(file)).toBe(true)
  })
})
