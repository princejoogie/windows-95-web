import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const OUTPUT = fileURLToPath(new URL('../src/renderer/src/assets/system/', import.meta.url))
const SOUNDS = ['tada', 'chord', 'ding', 'chimes', 'notify', 'recycle']
const CURSORS = {
  default: ['arrow_r', 'default'],
  progress: ['busy_r', 'progress'],
  wait: ['wait_r', 'wait'],
  text: ['beam_r', 'text'],
  'nwse-resize': ['size1_r', 'nwse-resize'],
  'nesw-resize': ['size2_r', 'nesw-resize'],
  'ew-resize': ['size3_r', 'ew-resize'],
  'ns-resize': ['size4_r', 'ns-resize'],
  move: ['move_r', 'move'],
  'not-allowed': ['no_r', 'not-allowed'],
  help: ['help_r', 'help'],
}

function span(bytes, offset, length) {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0 ||
    offset + length > bytes.length
  ) {
    throw new Error('Truncated Windows font resource')
  }
  return bytes.subarray(offset, offset + length)
}

export function parseFon(bytes) {
  span(bytes, 0, 64)
  if (bytes.toString('ascii', 0, 2) !== 'MZ') throw new Error('Expected an MZ executable')
  const ne = bytes.readUInt32LE(60)
  span(bytes, ne, 40)
  if (bytes.toString('ascii', ne, ne + 2) !== 'NE') throw new Error('Expected an NE resource table')
  const table = ne + bytes.readUInt16LE(ne + 36)
  span(bytes, table, 2)
  const shift = bytes.readUInt16LE(table)
  if (shift > 16) throw new Error('Invalid NE resource alignment')
  const fonts = []
  let offset = table + 2
  for (;;) {
    span(bytes, offset, 2)
    const type = bytes.readUInt16LE(offset)
    if (type === 0) return fonts
    span(bytes, offset, 8)
    const count = bytes.readUInt16LE(offset + 2)
    offset += 8
    span(bytes, offset, count * 12)
    for (let i = 0; i < count; i++, offset += 12) {
      if (type !== 0x8008) continue
      const start = bytes.readUInt16LE(offset) * 2 ** shift
      const length = bytes.readUInt16LE(offset + 2) * 2 ** shift
      fonts.push(parseFnt(span(bytes, start, length)))
    }
  }
}

export function parseFnt(bytes) {
  span(bytes, 0, 118)
  const version = bytes.readUInt16LE(0)
  if (version !== 0x200 && version !== 0x300) throw new Error('Only FNT v2 and v3 are supported')
  const size = bytes.readUInt32LE(2)
  bytes = span(bytes, 0, size)
  if (bytes.readUInt16LE(66) & 1) throw new Error('Expected a raster FNT font')
  if (bytes[85] !== 0) throw new Error('Expected the Windows ANSI character set')
  const height = bytes.readUInt16LE(88)
  const ascent = bytes.readUInt16LE(74)
  const internalLeading = bytes.readUInt16LE(76)
  if (height === 0 || ascent > height || internalLeading >= height) throw new Error('Invalid FNT metrics')
  const first = bytes[95]
  const last = bytes[96]
  if (last < first) throw new Error('Invalid FNT character range')
  const table = version === 0x200 ? 118 : 148
  const stride = version === 0x200 ? 4 : 6
  span(bytes, table, (last - first + 2) * stride)
  const faceOffset = bytes.readUInt32LE(105)
  span(bytes, faceOffset, 1)
  const faceEnd = bytes.indexOf(0, faceOffset)
  if (faceEnd < 0) throw new Error('Unterminated FNT face name')
  const decoder = new TextDecoder('windows-1252')
  const glyphs = []
  for (let code = first; code <= last; code++) {
    const entry = table + (code - first) * stride
    const width = bytes.readUInt16LE(entry)
    const offset = version === 0x200 ? bytes.readUInt16LE(entry + 2) : bytes.readUInt32LE(entry + 2)
    const bitmap = span(bytes, offset, Math.ceil(width / 8) * height)
    const rows = Array.from({ length: height }, (_, y) =>
      Uint8Array.from(
        { length: width },
        (_, x) => (bitmap[Math.floor(x / 8) * height + y] >> (7 - (x % 8))) & 1,
      ),
    )
    glyphs.push({ codePoint: decoder.decode(Uint8Array.of(code)).codePointAt(0), width, rows })
  }
  return {
    face: bytes.toString('latin1', faceOffset, faceEnd),
    points: bytes.readUInt16LE(68),
    dpiX: bytes.readUInt16LE(72),
    dpiY: bytes.readUInt16LE(70),
    ascent,
    height,
    internalLeading,
    externalLeading: bytes.readUInt16LE(78),
    weight: bytes.readUInt16LE(83),
    defaultGlyph: bytes[97],
    glyphs,
  }
}

export function embolden(face) {
  return {
    ...face,
    weight: 700,
    glyphs: face.glyphs.map((glyph) => ({
      ...glyph,
      width: glyph.width + 1,
      rows: glyph.rows.map((row) =>
        Uint8Array.from({ length: glyph.width + 1 }, (_, x) => (row[x] || row[x - 1] ? 1 : 0)),
      ),
    })),
  }
}

function rectangles(rows) {
  const result = []
  let previous = new Map()
  for (let y = 0; y < rows.length; y++) {
    const active = new Map()
    for (let x = 0; x < rows[y].length; x++) {
      if (!rows[y][x]) continue
      const left = x
      while (x + 1 < rows[y].length && rows[y][x + 1]) x++
      const key = `${left}:${x + 1}`
      const rect = previous.get(key) ?? { left, right: x + 1, top: y, bottom: y }
      if (!previous.has(key)) result.push(rect)
      rect.bottom = y + 1
      active.set(key, rect)
    }
    previous = active
  }
  return result
}

function u16(...values) {
  const buffer = Buffer.alloc(values.length * 2)
  values.forEach((value, i) => {
    buffer.writeUInt16BE(value & 0xffff, i * 2)
  })
  return buffer
}

function u32(...values) {
  const buffer = Buffer.alloc(values.length * 4)
  values.forEach((value, i) => {
    buffer.writeUInt32BE(value >>> 0, i * 4)
  })
  return buffer
}

const SCALE = 64

function outline(glyph, ascent) {
  const rects = rectangles(glyph.rows)
  const points = rects.flatMap(({ left, right, top, bottom }) => [
    [left * SCALE, (ascent - top) * SCALE],
    [right * SCALE, (ascent - top) * SCALE],
    [right * SCALE, (ascent - bottom) * SCALE],
    [left * SCALE, (ascent - bottom) * SCALE],
  ])
  if (points.length === 0)
    return { data: Buffer.alloc(0), bounds: [0, 0, 0, 0], points: 0, contours: 0, instructions: 0 }
  const bounds = [
    Math.min(...points.map(([x]) => x)),
    Math.min(...points.map(([, y]) => y)),
    Math.max(...points.map(([x]) => x)),
    Math.max(...points.map(([, y]) => y)),
  ]
  // Round both axes in the font so fractional CSS baselines cannot soften a pixel edge.
  const instructions = Buffer.concat(
    [0, 1].map((axis) =>
      Buffer.concat([
        Buffer.of(axis),
        ...points.map((_, i) => Buffer.concat([Buffer.of(0xb8), u16(i), Buffer.of(0x2f)])),
      ]),
    ),
  )
  let x = 0
  let y = 0
  const dx = []
  const dy = []
  for (const point of points) {
    dx.push(point[0] - x)
    dy.push(point[1] - y)
    ;[x, y] = point
  }
  const data = Buffer.concat([
    u16(rects.length, ...bounds),
    u16(...rects.map((_, i) => i * 4 + 3)),
    u16(instructions.length),
    instructions,
    Buffer.alloc(points.length, 1),
    u16(...dx),
    u16(...dy),
  ])
  return { data, bounds, points: points.length, contours: rects.length, instructions: instructions.length }
}

function cmapTable(glyphs) {
  const entries = glyphs.map((glyph, i) => [glyph.codePoint, i + 1]).sort(([a], [b]) => a - b)
  const segments = []
  for (const [code, id] of entries) {
    const delta = (id - code) & 0xffff
    const last = segments.at(-1)
    if (last && last.end + 1 === code && last.delta === delta) last.end = code
    else segments.push({ start: code, end: code, delta })
  }
  segments.push({ start: 0xffff, end: 0xffff, delta: 1 })
  const count = segments.length
  const power = 2 ** Math.floor(Math.log2(count))
  const subtable = Buffer.concat([
    u16(4, 16 + count * 8, 0, count * 2, power * 2, Math.log2(power), count * 2 - power * 2),
    u16(...segments.map((segment) => segment.end)),
    u16(0),
    u16(...segments.map((segment) => segment.start)),
    u16(...segments.map((segment) => segment.delta)),
    Buffer.alloc(count * 2),
  ])
  return Buffer.concat([u16(0, 1, 3, 1), u32(12), subtable])
}

function nameTable(family, bold) {
  const style = bold ? 'Bold' : 'Regular'
  const strings = [
    [1, family],
    [2, style],
    [3, `Windows95-local-${family}-${style}`],
    [4, `${family} ${style}`],
    [5, 'Version 1.0'],
    [6, `${family.replaceAll(/[^a-zA-Z0-9]/g, '')}-${style}`],
  ]
  let offset = 0
  const records = []
  const values = []
  for (const [id, value] of strings) {
    const encoded = Buffer.from(value, 'utf16le').swap16()
    records.push(u16(3, 1, 0x409, id, encoded.length, offset))
    values.push(encoded)
    offset += encoded.length
  }
  return Buffer.concat([u16(0, records.length, 6 + records.length * 12), ...records, ...values])
}

function checksum(data) {
  const padded = Buffer.alloc(Math.ceil(data.length / 4) * 4)
  data.copy(padded)
  let sum = 0
  for (let i = 0; i < padded.length; i += 4) sum = (sum + padded.readUInt32BE(i)) >>> 0
  return sum
}

export function writeTtf(face, family = face.face) {
  const bold = face.weight >= 700
  const em = (face.height - face.internalLeading) * SCALE
  const glyphs = [face.glyphs[face.defaultGlyph] ?? face.glyphs[0], ...face.glyphs]
  const outlines = glyphs.map((glyph) => outline(glyph, face.ascent))
  const bounds = [
    Math.min(...outlines.map((glyph) => glyph.bounds[0])),
    Math.min(...outlines.map((glyph) => glyph.bounds[1])),
    Math.max(...outlines.map((glyph) => glyph.bounds[2])),
    Math.max(...outlines.map((glyph) => glyph.bounds[3])),
  ]
  let location = 0
  const locations = [0]
  const glyf = []
  for (const glyph of outlines) {
    const padded = Buffer.alloc(Math.ceil(glyph.data.length / 4) * 4)
    glyph.data.copy(padded)
    glyf.push(padded)
    location += padded.length
    locations.push(location)
  }
  const head = Buffer.concat([
    u32(0x10000, 0x10000, 0, 0x5f0f3cf5),
    u16(0x0b, em),
    Buffer.alloc(16),
    u16(...bounds, bold ? 1 : 0, 8, 2, 1, 0),
  ])
  const advances = glyphs.map((glyph) => glyph.width * SCALE)
  const hhea = Buffer.concat([
    u32(0x10000),
    u16(
      face.ascent * SCALE,
      -(face.height - face.ascent) * SCALE,
      face.externalLeading * SCALE,
      Math.max(...advances),
      Math.min(...outlines.map((glyph) => glyph.bounds[0])),
      Math.min(...outlines.map((glyph, i) => advances[i] - glyph.bounds[2])),
      bounds[2],
      1,
      0,
      0,
    ),
    Buffer.alloc(8),
    u16(0, glyphs.length),
  ])
  const maxp = Buffer.concat([
    u32(0x10000),
    u16(
      glyphs.length,
      Math.max(...outlines.map((glyph) => glyph.points)),
      Math.max(...outlines.map((glyph) => glyph.contours)),
      0,
      0,
      2,
      0,
      0,
      0,
      0,
      1,
      Math.max(...outlines.map((glyph) => glyph.instructions)),
      0,
      0,
    ),
  ])
  const os2 = Buffer.alloc(96)
  u16(
    4,
    Math.round(advances.reduce((sum, width) => sum + width, 0) / advances.length),
    face.weight,
    5,
    0,
  ).copy(os2)
  os2[32] = 2
  os2[33] = face.face === 'Fixedsys' ? 11 : 0
  os2.writeUInt32BE(3, 42)
  os2.write('W95L', 58, 'ascii')
  os2.writeUInt16BE((bold ? 0x20 : 0x40) | 0x80, 62)
  os2.writeUInt16BE(Math.min(...face.glyphs.map((glyph) => glyph.codePoint)), 64)
  os2.writeUInt16BE(Math.max(...face.glyphs.map((glyph) => glyph.codePoint)), 66)
  u16(
    face.ascent * SCALE,
    -(face.height - face.ascent) * SCALE,
    face.externalLeading * SCALE,
    face.ascent * SCALE,
    (face.height - face.ascent) * SCALE,
  ).copy(os2, 68)
  os2.writeUInt32BE(1, 78)
  const glyphHeight = (code) => {
    const index = face.glyphs.findIndex((glyph) => glyph.codePoint === code)
    return index < 0 ? 0 : outlines[index + 1].bounds[3]
  }
  u16(glyphHeight(120), glyphHeight(65), 0, 32, 1).copy(os2, 86)
  const fixed = new Set(advances).size === 1
  const post = Buffer.concat([u32(0x30000, 0), u16(-SCALE, SCALE), u32(fixed ? 1 : 0), Buffer.alloc(16)])
  const tables = Object.entries({
    cmap: cmapTable(face.glyphs),
    gasp: u16(0, 1, 0xffff, 1),
    glyf: Buffer.concat(glyf),
    head,
    hhea,
    hmtx: Buffer.concat(glyphs.map((_, i) => u16(advances[i], outlines[i].bounds[0]))),
    loca: u32(...locations),
    maxp,
    name: nameTable(family, bold),
    'OS/2': os2,
    post,
  }).sort(([a], [b]) => (a < b ? -1 : 1))
  const count = tables.length
  const power = 2 ** Math.floor(Math.log2(count))
  let offset = 12 + count * 16
  let headOffset = 0
  const directory = []
  const contents = []
  for (const [tag, table] of tables) {
    directory.push(Buffer.concat([Buffer.from(tag), u32(checksum(table), offset, table.length)]))
    const padded = Buffer.alloc(Math.ceil(table.length / 4) * 4)
    table.copy(padded)
    contents.push(padded)
    if (tag === 'head') headOffset = offset
    offset += padded.length
  }
  const font = Buffer.concat([
    u32(0x10000),
    u16(count, power * 16, Math.log2(power), count * 16 - power * 16),
    ...directory,
    ...contents,
  ])
  font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, headOffset + 8)
  return font
}

export function cursorHotspot(bytes) {
  span(bytes, 0, 6)
  if (bytes.readUInt16LE(0) !== 0 || bytes.readUInt16LE(2) !== 2 || bytes.readUInt16LE(4) === 0)
    throw new Error('Invalid CUR directory')
  const count = bytes.readUInt16LE(4)
  span(bytes, 6, count * 16)
  let entry = 6
  for (let i = 0; i < count; i++) {
    const offset = 6 + i * 16
    if (bytes[offset] === 32 && bytes[offset + 1] === 32) {
      entry = offset
      break
    }
  }
  const x = bytes.readUInt16LE(entry + 4)
  const y = bytes.readUInt16LE(entry + 6)
  if (x >= (bytes[entry] || 256) || y >= (bytes[entry + 1] || 256)) throw new Error('Invalid CUR hotspot')
  span(bytes, bytes.readUInt32LE(entry + 12), bytes.readUInt32LE(entry + 8))
  return { x, y }
}

function writeChanged(path, data) {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
  if (existsSync(path) && readFileSync(path).equals(buffer)) return
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, buffer)
}

function cssRule(selector, declarations) {
  return `${selector} {\n${declarations.map((declaration) => `  ${declaration};`).join('\n')}\n}`
}

export function importSystemAssets({
  windowsDir = process.env.W95_SYSTEM_ROOT ?? process.env.WINDIR ?? 'C:/Windows',
  outputDir = OUTPUT,
  log = console.log,
} = {}) {
  mkdirSync(outputDir, { recursive: true })
  writeChanged(join(outputDir, '.gitignore'), '*\n!.gitignore\n')
  const sources = [
    'Fonts/sserife.fon',
    'Fonts/vgafix.fon',
    ...Object.values(CURSORS).map(([name]) => `Cursors/${name}.cur`),
    ...SOUNDS.map((name) => `Media/${name}.wav`),
  ]
  const signature = createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url)))
  signature.update(resolve(windowsDir))
  for (const path of sources) {
    const fullPath = join(windowsDir, path)
    if (existsSync(fullPath)) {
      const stat = statSync(fullPath)
      signature.update(`${path}:${stat.size}:${stat.mtimeMs}`)
    } else signature.update(`${path}:missing`)
  }
  const key = signature.digest('hex')
  const cacheFile = join(outputDir, 'manifest.cache')
  if (existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, 'utf8'))
      if (cached.key === key && cached.files.every((file) => existsSync(join(outputDir, file)))) {
        log(cached.message)
        return cached
      }
    } catch {
      /* A partial prior import is rebuilt. */
    }
  }
  const files = []
  const css = []
  const fonts = []
  const cursors = {}
  const sounds = []
  const errors = []
  const emit = (name, data) => {
    writeChanged(join(outputDir, name), data)
    files.push(name)
  }
  for (const [source, prefix] of [
    ['sserife', 'ms-sans-serif'],
    ['vgafix', 'fixedsys'],
  ]) {
    const path = join(windowsDir, 'Fonts', `${source}.fon`)
    if (!existsSync(path)) continue
    try {
      for (const face of parseFon(readFileSync(path))) {
        if (
          face.dpiX !== 96 ||
          face.dpiY !== 96 ||
          (source === 'sserife' && ![8, 10, 12].includes(face.points))
        )
          continue
        const family =
          source === 'sserife'
            ? `MS Sans Serif Bitmap${face.points === 8 ? '' : ` ${face.points}pt`}`
            : 'Fixedsys Bitmap'
        const nativeSize = face.height - face.internalLeading
        for (const variant of source === 'sserife' ? [face, embolden(face)] : [face]) {
          const file = `${prefix}-${face.points}${variant.weight >= 700 ? '-bold' : ''}.ttf`
          emit(file, writeTtf(variant, family))
          css.push(
            cssRule('@font-face', [
              `font-family: "${family}"`,
              `src: url("./${file}") format("truetype")`,
              'font-style: normal',
              `font-weight: ${variant.weight}`,
              'font-display: block',
            ]),
          )
          fonts.push({
            family,
            file,
            nativeSize,
            ascent: face.ascent,
            descent: face.height - face.ascent,
            weight: variant.weight,
          })
        }
        if (source === 'vgafix')
          css.push(
            cssRule(':root', [
              `--system-fixedsys-size: ${nativeSize}px`,
              `--system-fixedsys-height: ${face.height}px`,
            ]),
          )
      }
    } catch (error) {
      errors.push(`${source}: ${error.message}`)
    }
  }
  for (const [role, [name, fallback]] of Object.entries(CURSORS)) {
    const file = `${name}.cur`
    const path = join(windowsDir, 'Cursors', file)
    if (!existsSync(path)) continue
    try {
      const bytes = readFileSync(path)
      const { x, y } = cursorHotspot(bytes)
      emit(file, bytes)
      css.push(cssRule(':root', [`--cursor-${role}: url("./${file}") ${x} ${y}, ${fallback}`]))
      cursors[role] = { file, x, y }
    } catch (error) {
      errors.push(`${name}: ${error.message}`)
    }
  }
  for (const name of SOUNDS) {
    const file = `${name}.wav`
    const path = join(windowsDir, 'Media', file)
    if (!existsSync(path)) continue
    emit(file, readFileSync(path))
    sounds.push(name)
  }
  emit('assets.css', `${css.join('\n')}\n`)
  const imported = fonts.length + Object.keys(cursors).length + sounds.length
  const message = imported
    ? `System assets: ${fonts.length} fonts, ${Object.keys(cursors).length} cursors, ${sounds.length} sounds${errors.length ? `; ${errors.join('; ')}` : ''}.`
    : 'System assets: Windows files unavailable; using fallback fonts, CSS cursors, and silence.'
  const manifest = { key, files, fonts, cursors, sounds, message }
  for (const file of readdirSync(outputDir)) {
    if (file !== '.gitignore' && file !== 'manifest.cache' && !files.includes(file))
      unlinkSync(join(outputDir, file))
  }
  writeChanged(cacheFile, `${JSON.stringify(manifest, null, 2)}\n`)
  log(message)
  return manifest
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) importSystemAssets()
