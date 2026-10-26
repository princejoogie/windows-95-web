import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAGRAPH, DEFAULT_RUN, type Document, emptyDocument, normalize, plainText } from './model'
import { isRtf, parseRtf, writeRtf } from './rtf'

const run = (text: string, style: Partial<typeof DEFAULT_RUN> = {}) => ({ ...DEFAULT_RUN, ...style, text })

const letter: Document = {
  paragraphs: [
    { ...DEFAULT_PARAGRAPH, align: 'center', runs: [run('Memo', { bold: true, size: 14, font: 'Arial' })] },
    { ...DEFAULT_PARAGRAPH, runs: [] },
    {
      ...DEFAULT_PARAGRAPH,
      left: 720,
      first: -360,
      right: 1440,
      tabs: [720, 2160],
      runs: [
        run('Plain, '),
        run('italic', { italic: true }),
        run(' and '),
        run('red underlined', { underline: true, color: '#ff0000' }),
        run('\tafter a tab\nand a line break.'),
      ],
    },
    { ...DEFAULT_PARAGRAPH, bullet: true, left: 360, first: -360, runs: [run('First point')] },
    { ...DEFAULT_PARAGRAPH, bullet: true, left: 360, first: -360, runs: [run('Second {braced} \\ point')] },
    { ...DEFAULT_PARAGRAPH, align: 'justify', runs: [run('Café naïve — © 1995 中文 \u{1F600}')] },
    { ...DEFAULT_PARAGRAPH, align: 'right', runs: [run('struck', { strike: true, size: 8.5 })] },
    { ...DEFAULT_PARAGRAPH, runs: [] },
  ],
}

describe('RTF', () => {
  it.each([
    ['png', 'pngblip', '89504e470d0a1a0a', 'iVBORw0KGgo='],
    ['jpeg', 'jpegblip', 'ffd8ffd9', '/9j/2Q=='],
  ])(
    'reads a Word shppict %s with metadata and skips its unsupported WMF fallback',
    (format, blip, hex, data) => {
      let doc = parseRtf(`{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}{\\f1 Times New Roman;}}\\f0\\b Before
{\\*\\shppict{\\pict\\${blip}\\picw800\\pich400\\picwgoal1000\\pichgoal673
{\\*\\blipuid 0123456789abcdef0123456789abcdef}
{\\*\\picprop{\\sp{\\sn wzDescription}{\\sv Wrapped picture}}}
${hex}}}
{\\nonshppict{\\pict\\wmetafile8\\picw800\\pich400\\picwgoal1000\\pichgoal673 01020304}}
\\b0\\f1\\i After}`)
      for (let save = 0; save < 4; save++) {
        expect(doc.paragraphs[0]?.runs.filter((inline) => 'kind' in inline)).toEqual([
          { kind: 'picture', format, data, width: 67, height: 45 },
        ])
        expect(plainText(doc)).toBe('BeforeAfter')
        expect(doc.paragraphs[0]?.runs[0]).toMatchObject({ text: 'Before', font: 'Arial', bold: true })
        expect(doc.paragraphs[0]?.runs.at(-1)).toMatchObject({
          text: 'After',
          font: 'Times New Roman',
          bold: false,
          italic: true,
        })
        doc = parseRtf(writeRtf(doc))
      }
    },
  )

  it('shows the primary picture once even when nonshppict contains a readable fallback', () => {
    const doc = parseRtf(
      '{\\rtf1 Before{\\*\\shppict{\\pict\\pngblip\\picw1\\pich1 89504e470d0a1a0a}}{\\nonshppict{\\pict\\pngblip\\picw2\\pich2 ffd8ffd9}}After}',
    )
    expect(doc.paragraphs[0]?.runs.filter((inline) => 'kind' in inline)).toEqual([
      { kind: 'picture', format: 'png', data: 'iVBORw0KGgo=', width: 1, height: 1 },
    ])
    expect(plainText(doc)).toBe('BeforeAfter')
  })

  it('keeps text around unsupported wrapped WMF and EMF without inventing a picture', () => {
    const doc = parseRtf(
      '{\\rtf1 Before{\\*\\shppict{\\pict\\emfblip\\picw1\\pich1 0102}}{\\nonshppict{\\pict\\wmetafile8\\picw1\\pich1 0304}}After}',
    )
    expect(plainText(doc)).toBe('BeforeAfter')
    expect(doc.paragraphs[0]?.runs.filter((inline) => 'kind' in inline)).toEqual([])
  })
  it.each([
    ['blipuid', '{\\*\\blipuid 0123456789abcdef0123456789abcdef}'],
    [
      'picprop',
      '{\\*\\picprop{\\sp{\\sn wzDescription}{\\sv abcdef0123456789}}{\\sp{\\sn pictureSize}{\\sv \\picw999\\pich999}}}',
    ],
  ])(
    'ignores nested %s picture metadata while retaining exact bytes and surrounding styles',
    (_name, metadata) => {
      const rtf = `{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\f0\\b Before
{\\pict\\pngblip\\picw1\\pich1\\picwgoal15\\pichgoal15
${metadata}
89504e47
{\\*\\blipuid fedcba9876543210fedcba9876543210}
0d0a1a0a}\\b0 After}`
      const doc = parseRtf(rtf)
      const picture = doc.paragraphs[0]?.runs.find((inline) => 'kind' in inline)
      expect(picture).toMatchObject({ kind: 'picture', width: 1, height: 1 })
      if (!picture || !('kind' in picture)) throw new Error('Expected the embedded picture')
      expect(Array.from(atob(picture.data), (byte) => byte.charCodeAt(0))).toEqual([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ])
      expect(picture.data).toBe('iVBORw0KGgo=')
      expect(doc.paragraphs[0]?.runs[0]).toMatchObject({ text: 'Before', bold: true, font: 'Arial' })
      expect(doc.paragraphs[0]?.runs.at(-1)).toMatchObject({ text: 'After', bold: false, font: 'Arial' })
      expect(parseRtf(writeRtf(doc))).toEqual(doc)
    },
  )

  it('keeps a foreign picture after saving dimensions whose twip size is not divisible by fifteen', () => {
    const doc = parseRtf(
      '{\\rtf1 Before{\\pict\\pngblip\\picw1\\pich1\\picwgoal1000\\pichgoal673 89504e470d0a1a0a}After}',
    )
    const saved = parseRtf(writeRtf(doc))
    expect(saved.paragraphs[0]?.runs.find((inline) => 'kind' in inline)).toEqual({
      kind: 'picture',
      format: 'png',
      data: 'iVBORw0KGgo=',
      width: 67,
      height: 45,
    })
    expect(plainText(saved)).toBe('BeforeAfter')
  })

  it('rounds foreign twip dimensions to positive whole pixels and retains pictures through repeated saves', () => {
    for (const [goalWidth, goalHeight, width, height] of [
      [1000, 673, 67, 45],
      [1, 7, 1, 1],
      [22, 23, 1, 2],
    ]) {
      let doc = parseRtf(
        `{\\rtf1 Before{\\pict\\pngblip\\picw1\\pich1\\picwgoal${goalWidth}\\pichgoal${goalHeight} 89504e470d0a1a0a}After}`,
      )
      for (let save = 0; save < 4; save++) {
        const picture = doc.paragraphs[0]?.runs.find((inline) => 'kind' in inline)
        expect(picture).toEqual({ kind: 'picture', format: 'png', data: 'iVBORw0KGgo=', width, height })
        expect(plainText(doc)).toBe('BeforeAfter')
        doc = parseRtf(writeRtf(doc))
      }
    }
  })
  it('writes fractional pixel inputs as recoverable integer picture dimensions', () => {
    const doc: Document = {
      paragraphs: [
        {
          ...DEFAULT_PARAGRAPH,
          runs: [
            { kind: 'picture', format: 'png', data: 'iVBORw0KGgo=', width: 1000 / 15, height: 673 / 15 },
          ],
        },
      ],
    }
    const saved = parseRtf(writeRtf(doc))
    expect(saved.paragraphs[0]?.runs).toEqual([
      { kind: 'picture', format: 'png', data: 'iVBORw0KGgo=', width: 67, height: 45 },
    ])
    expect(parseRtf(writeRtf(saved))).toEqual(saved)
  })
  it('preserves picture bytes, dimensions, and placement between formatted text', () => {
    const picture = { kind: 'picture', format: 'png', data: 'iVBORw0KGgo=', width: 120, height: 70 } as const
    const doc: Document = {
      paragraphs: [{ ...DEFAULT_PARAGRAPH, runs: [run('Before', { bold: true }), picture, run('After')] }],
    }
    const rtf = writeRtf(doc)
    expect(rtf).toContain('\\pict\\pngblip\\picw120\\pich70\\picwgoal1800\\pichgoal1050')
    expect(rtf).toContain('89504e470d0a1a0a')
    expect(rtf).not.toContain('<img')
    expect(parseRtf(rtf)).toEqual(doc)
    expect(plainText(doc)).toBe('BeforeAfter')
  })

  it('reads JPEG pictures and ignores unsupported or corrupt picture data', () => {
    const doc: Document = {
      paragraphs: [
        {
          ...DEFAULT_PARAGRAPH,
          runs: [{ kind: 'picture', format: 'jpeg', data: '/9j/2Q==', width: 5, height: 4 }],
        },
      ],
    }
    expect(parseRtf(writeRtf(doc))).toEqual(doc)
    expect(plainText(parseRtf('{\\rtf1 A{\\pict\\pngblip\\picw1\\pich1 xyz}B}'))).toBe('AB')
  })
  it('writes a file other RTF readers recognize', () => {
    const rtf = writeRtf(letter)
    expect(rtf.startsWith('{\\rtf1\\ansi')).toBe(true)
    expect(rtf).toContain('{\\fonttbl')
    expect(rtf).toContain('{\\colortbl ;\\red255\\green0\\blue0;}')
    expect(rtf).toContain('\\qc')
    expect(rtf).toContain('\\li720\\ri1440\\fi-360\\tx720\\tx2160')
    expect(rtf).toContain('\\pnlvlblt')
    expect(rtf).toContain("\\'b7")
    expect(rtf).toContain('\\u233?')
    expect(rtf).toContain('Second \\{braced\\} \\\\ point')
    expect(rtf.trim().endsWith('}')).toBe(true)
    expect(isRtf(rtf)).toBe(true)
    expect(isRtf('hello')).toBe(false)
  })

  it('reads back exactly what it wrote', () => {
    expect(parseRtf(writeRtf(letter))).toEqual(normalize(letter))
  })

  it('round-trips an empty document and one with only an empty paragraph', () => {
    expect(parseRtf(writeRtf(emptyDocument()))).toEqual(emptyDocument())
    const twoEmpty: Document = {
      paragraphs: [
        { ...DEFAULT_PARAGRAPH, runs: [] },
        { ...DEFAULT_PARAGRAPH, runs: [] },
      ],
    }
    expect(parseRtf(writeRtf(twoEmpty))).toEqual(twoEmpty)
  })

  it('reads files written by Word and WordPad, skipping what it does not show', () => {
    const rtf = `{\\rtf1\\ansi\\ansicpg1252\\deff0\\deflang1033{\\fonttbl{\\f0\\fswiss\\fprq2\\fcharset0 Arial;}{\\f1\\froman\\fcharset0 Times New Roman;}}
{\\colortbl ;\\red0\\green0\\blue255;}
{\\*\\generator Msftedit 5.41.15.1507;}{\\info{\\author Someone}}\\viewkind4\\uc1\\pard\\qc\\f0\\fs24\\b Title\\b0\\par
\\pard\\fi720\\f1\\fs20 Body with \\cf1\\ul blue\\cf0\\ulnone  text and \\'e9 and \\u8212?\\~nbsp.\\par
{\\pict\\wmetafile8 0102}\\par
\\pard{\\pntext\\f2\\'b7\\tab}{\\*\\pn\\pnlvlblt\\pnf2\\pnindent0{\\pntxtb\\'b7}}\\fi-360\\li360 Bullet one\\par
\\pard\\par
}`
    const doc = parseRtf(rtf)
    expect(doc.paragraphs.map((p) => p.runs.map((r) => ('kind' in r ? '' : r.text)).join(''))).toEqual([
      'Title',
      'Body with blue text and é and — nbsp.',
      '',
      'Bullet one',
      '',
    ])
    expect(doc.paragraphs[0]).toMatchObject({ align: 'center' })
    expect(doc.paragraphs[0]?.runs[0]).toMatchObject({ bold: true, size: 12, font: 'Arial' })
    expect(doc.paragraphs[1]).toMatchObject({ first: 720 })
    expect(doc.paragraphs[1]?.runs[1]).toMatchObject({
      text: 'blue',
      underline: true,
      color: '#0000ff',
      font: 'Times New Roman',
    })
    expect(doc.paragraphs[3]).toMatchObject({ bullet: true, left: 360, first: -360 })
  })

  it('keeps the plain text of a document the way Notepad would read it', () => {
    expect(plainText(parseRtf(writeRtf(letter)))).toBe(
      'Memo\n\nPlain, italic and red underlined\tafter a tab\nand a line break.\nFirst point\nSecond {braced} \\ point\nCafé naïve — © 1995 中文 \u{1F600}\nstruck\n',
    )
  })
})
