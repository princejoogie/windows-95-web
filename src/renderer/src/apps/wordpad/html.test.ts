import { describe, expect, it } from 'vitest'
import { firstFamily, paragraphCss, pointsFrom, renderDocument, runCss } from './html'
import { DEFAULT_PARAGRAPH, DEFAULT_RUN, type Document } from './model'

const run = (text: string, style: Partial<typeof DEFAULT_RUN> = {}) => ({ ...DEFAULT_RUN, ...style, text })

describe('rendering the document for the editor', () => {
  it('writes well-formed inline styles, quoting font names so the attribute survives', () => {
    const html = renderDocument({
      paragraphs: [{ ...DEFAULT_PARAGRAPH, runs: [run('Hi', { underline: true, color: '#ff0000' })] }],
    })
    expect(html).toBe(
      `<div><span style="font-family:&#39;Times New Roman&#39;;font-size:10pt;color:#ff0000;text-decoration:underline">Hi</span></div>`.replace(
        /&#39;/g,
        "'",
      ),
    )
    expect(html.match(/"/g)?.length).toBe(2)
  })

  it('escapes markup in text, turns line breaks into <br>, and gives empty paragraphs a line', () => {
    const html = renderDocument({
      paragraphs: [
        { ...DEFAULT_PARAGRAPH, runs: [run('a < b & "c"\nnext')] },
        { ...DEFAULT_PARAGRAPH, runs: [] },
      ],
    })
    expect(html).toContain('a &lt; b &amp; &quot;c&quot;<br>next')
    expect(html.endsWith('<div><br></div>')).toBe(true)
  })

  it('groups bulleted paragraphs into one list and carries alignment, indents, and tabs', () => {
    const doc: Document = {
      paragraphs: [
        {
          ...DEFAULT_PARAGRAPH,
          align: 'center',
          left: 720,
          first: -360,
          tabs: [1440, 2880],
          runs: [run('Head')],
        },
        { ...DEFAULT_PARAGRAPH, bullet: true, left: 360, first: -360, runs: [run('one')] },
        { ...DEFAULT_PARAGRAPH, bullet: true, left: 360, first: -360, runs: [run('two')] },
        { ...DEFAULT_PARAGRAPH, runs: [run('after')] },
      ],
    }
    const html = renderDocument(doc)
    expect(
      html.startsWith(
        '<div style="text-align:center;margin-left:48px;text-indent:-24px" data-tabs="1440,2880">',
      ),
    ).toBe(true)
    expect(html.match(/<ul>/g)?.length).toBe(1)
    expect(html.match(/<li /g)?.length).toBe(2)
    expect(html).toContain('</ul><div>')
  })

  it('reads CSS sizes and families the way the browser reports them', () => {
    expect(pointsFrom('14pt', 10)).toBe(14)
    expect(pointsFrom('13.3333px', 10)).toBe(10)
    expect(pointsFrom('xxx-large', 10)).toBe(36)
    expect(pointsFrom('bogus', 10)).toBe(10)
    expect(firstFamily('"Times New Roman", serif')).toBe('Times New Roman')
    expect(firstFamily("'Arial'")).toBe('Arial')
    expect(runCss({ ...DEFAULT_RUN, bold: true, italic: true, strike: true, font: 'Arial', size: 8.5 })).toBe(
      'font-family:Arial;font-size:8.5pt;color:#000000;font-weight:bold;font-style:italic;text-decoration:line-through',
    )
    expect(paragraphCss({ ...DEFAULT_PARAGRAPH, right: 1440 })).toBe('margin-right:96px')
  })
})
