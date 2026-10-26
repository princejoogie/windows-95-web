export interface FontMetadata {
  readonly name: string
  readonly format: 'TrueType' | 'OpenType'
  readonly byteLength: number
}

export function fontBytes(content: string): Uint8Array<ArrayBuffer> {
  const match =
    /^data:(?:font\/(?:ttf|otf)|application\/(?:x-font-ttf|octet-stream));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      content,
    )
  if (!match?.[1] || content.length > 12_000_000)
    throw new Error('This file does not contain supported TrueType or OpenType font data.')
  const raw = atob(match[1])
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

export function inspectFont(bytes: Uint8Array<ArrayBuffer>): FontMetadata {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const fail = () => {
    throw new Error('The font file is damaged or is not a supported TrueType or OpenType font.')
  }
  if (bytes.length < 12) return fail()
  const signature = view.getUint32(0)
  if (signature !== 0x00010000 && signature !== 0x4f54544f) return fail()
  const count = view.getUint16(4)
  if (!count || count > 256 || 12 + count * 16 > bytes.length) return fail()
  const tables = new Map<string, { offset: number; length: number }>()
  for (let index = 0; index < count; index++) {
    const at = 12 + index * 16
    const tag = String.fromCharCode(...bytes.subarray(at, at + 4))
    const offset = view.getUint32(at + 8)
    const length = view.getUint32(at + 12)
    if (offset < 12 + count * 16 || offset + length > bytes.length || tables.has(tag)) return fail()
    tables.set(tag, { offset, length })
  }
  for (const tag of ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'post'])
    if (!tables.has(tag)) return fail()
  if (signature === 0x00010000 && (!tables.has('glyf') || !tables.has('loca'))) return fail()
  if (signature === 0x4f54544f && !tables.has('CFF ') && !tables.has('CFF2')) return fail()
  const name = tables.get('name')
  if (!name || name.length < 6) return fail()
  const records = view.getUint16(name.offset + 2)
  const storage = view.getUint16(name.offset + 4)
  if (6 + records * 12 > name.length || storage > name.length) return fail()
  const names: { text: string; priority: number }[] = []
  for (let index = 0; index < records; index++) {
    const at = name.offset + 6 + index * 12
    const platform = view.getUint16(at)
    const language = view.getUint16(at + 4)
    const id = view.getUint16(at + 6)
    const length = view.getUint16(at + 8)
    const offset = name.offset + storage + view.getUint16(at + 10)
    if (offset + length > name.offset + name.length) return fail()
    if (id !== 1 && id !== 16) continue
    let text = ''
    if (platform === 0 || platform === 3) {
      if (length % 2) return fail()
      for (let n = offset; n < offset + length; n += 2) text += String.fromCharCode(view.getUint16(n))
    } else if (platform === 1)
      text = new TextDecoder('macintosh').decode(bytes.subarray(offset, offset + length))
    text = text.replaceAll('\0', '').trim()
    if (text && text.length <= 128)
      names.push({
        text,
        priority: (id === 16 ? 4 : 0) + (language === 0x409 ? 2 : 0) + (platform === 3 ? 1 : 0),
      })
  }
  const family = names.sort((a, b) => b.priority - a.priority)[0]?.text
  if (!family) return fail()
  return {
    name: family,
    format: signature === 0x00010000 ? 'TrueType' : 'OpenType',
    byteLength: bytes.length,
  }
}

export function fontData(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `data:font/ttf;base64,${btoa(binary)}`
}

export function fontCharacterRanges(bytes: Uint8Array<ArrayBuffer>): readonly (readonly [number, number])[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const count = view.getUint16(4)
  let cmap = 0
  for (let n = 0; n < count; n++) {
    const at = 12 + n * 16
    if (view.getUint32(at) === 0x636d6170) cmap = view.getUint32(at + 8)
  }
  if (!cmap) return []
  const candidates: { offset: number; priority: number }[] = []
  for (let n = 0; n < view.getUint16(cmap + 2); n++) {
    const at = cmap + 4 + n * 8
    const platform = view.getUint16(at)
    const encoding = view.getUint16(at + 2)
    const offset = cmap + view.getUint32(at + 4)
    const format = view.getUint16(offset)
    if ((platform === 0 || platform === 3) && [0, 4, 6, 12].includes(format))
      candidates.push({
        offset,
        priority: (format === 12 ? 10 : 0) + (platform === 0 ? 2 : encoding === 1 ? 1 : 0),
      })
  }
  const offset = candidates.sort((a, b) => b.priority - a.priority)[0]?.offset
  if (offset === undefined) return []
  const format = view.getUint16(offset)
  const ranges: [number, number][] = []
  const add = (start: number, end = start) => {
    const last = ranges.at(-1)
    if (last && last[1] + 1 === start) last[1] = end
    else ranges.push([start, end])
  }
  if (format === 12) {
    for (let n = 0; n < view.getUint32(offset + 12); n++) {
      const at = offset + 16 + n * 12
      const start = view.getUint32(at) + (view.getUint32(at + 8) === 0 ? 1 : 0)
      const end = view.getUint32(at + 4)
      if (start <= end) add(start, end)
    }
  } else if (format === 4) {
    const segments = view.getUint16(offset + 6) / 2
    for (let n = 0; n < segments; n++) {
      const end = view.getUint16(offset + 14 + n * 2)
      const start = view.getUint16(offset + 16 + segments * 2 + n * 2)
      const delta = view.getInt16(offset + 16 + segments * 4 + n * 2)
      const rangeAt = offset + 16 + segments * 6 + n * 2
      const range = view.getUint16(rangeAt)
      for (let code = start; code <= end && code < 0xffff; code++) {
        const glyph = range ? view.getUint16(rangeAt + range + (code - start) * 2) : (code + delta) & 0xffff
        if (glyph && (!range || (glyph + delta) & 0xffff)) add(code)
      }
    }
  } else if (format === 0) {
    for (let code = 0; code < 256; code++) if (view.getUint8(offset + 6 + code)) add(code)
  } else if (format === 6) {
    const first = view.getUint16(offset + 6)
    for (let n = 0; n < view.getUint16(offset + 8); n++)
      if (view.getUint16(offset + 10 + n * 2)) add(first + n)
  }
  return ranges
}
