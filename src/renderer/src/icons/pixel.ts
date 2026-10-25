/** The 16 colors of the Windows 95 VGA palette, keyed by the letters pixel art uses. */
export const PALETTE = {
  k: '#000000',
  R: '#800000',
  L: '#008000',
  Y: '#808000',
  B: '#000080',
  M: '#800080',
  C: '#008080',
  s: '#c0c0c0',
  g: '#808080',
  r: '#ff0000',
  l: '#00ff00',
  y: '#ffff00',
  b: '#0000ff',
  m: '#ff00ff',
  c: '#00ffff',
  w: '#ffffff',
} as const

/**
 * Turns rows of palette letters into an SVG data URL. `.` is transparent. Runs of one color become one
 * rect, and crisp edges keep the pixels hard at any size.
 */
export function pixelArt(rows: readonly string[], palette: Readonly<Record<string, string>> = PALETTE): string {
  const width = Math.max(...rows.map((row) => row.length))
  const rects: string[] = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const key = row[x] ?? '.'
      let end = x + 1
      while (end < row.length && row[end] === key) end++
      const fill = palette[key]
      if (key !== '.' && fill) rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${fill}"/>`)
      x = end
    }
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${rows.length}" viewBox="0 0 ${width} ${rows.length}" shape-rendering="crispEdges">${rects.join('')}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
