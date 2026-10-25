// Renders the Windows flag art to src/renderer/public/icon.ico: PNG entries at 16, 32, 48, and 256 px.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { crc32, deflateSync } from 'node:zlib'
import { large, small } from '../src/renderer/src/icons/art.ts'
import { PALETTE } from '../src/renderer/src/icons/pixel.ts'

export const ICO_PATH = fileURLToPath(new URL('../src/renderer/public/icon.ico', import.meta.url))

/** Each entry upscales its art by a whole number, so pixels stay square. */
const ENTRIES = [
  { size: 16, rows: small.windowsLogo },
  { size: 32, rows: large.windowsLogo },
  { size: 48, rows: small.windowsLogo },
  { size: 256, rows: large.windowsLogo },
]

function rgba(rows, size) {
  const scale = size / rows.length
  const pixels = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hex = PALETTE[rows[Math.floor(y / scale)][Math.floor(x / scale)]]
      if (!hex) continue
      const offset = (y * size + x) * 4
      pixels.writeUIntBE(Number.parseInt(hex.slice(1), 16), offset, 3)
      pixels[offset + 3] = 255
    }
  }
  return pixels
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

function png(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  const stride = size * 4
  const scanlines = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) pixels.copy(scanlines, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

export function buildIco() {
  const images = ENTRIES.map(({ size, rows }) => png(size, rgba(rows, size)))
  const dir = Buffer.alloc(6 + 16 * images.length)
  dir.writeUInt16LE(1, 2)
  dir.writeUInt16LE(images.length, 4)
  let offset = dir.length
  images.forEach((image, i) => {
    const entry = 6 + 16 * i
    const { size } = ENTRIES[i]
    dir[entry] = size % 256
    dir[entry + 1] = size % 256
    dir.writeUInt16LE(1, entry + 4)
    dir.writeUInt16LE(32, entry + 6)
    dir.writeUInt32LE(image.length, entry + 8)
    dir.writeUInt32LE(offset, entry + 12)
    offset += image.length
  })
  return Buffer.concat([dir, ...images])
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ico = buildIco()
  writeFileSync(ICO_PATH, ico)
  console.log(`wrote ${ICO_PATH} (${ico.length} bytes)`)
}
