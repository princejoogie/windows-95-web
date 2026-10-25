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
