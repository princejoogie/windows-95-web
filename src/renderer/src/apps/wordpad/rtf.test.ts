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
    expect(doc.paragraphs.map((p) => p.runs.map((r) => r.text).join(''))).toEqual([
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
