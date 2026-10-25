/** What each pixel of the drive pie shows: nothing, a face or side of a slice, or the black outline. */
export type PieCell = 'none' | 'used' | 'free' | 'usedSide' | 'freeSide' | 'edge'

export const PIE_COLORS: Readonly<Record<Exclude<PieCell, 'none'>, string>> = {
  used: '#0000ff',
  free: '#ff00ff',
  usedSide: '#000080',
  freeSide: '#800080',
  edge: '#000000',
}

/**
 * The Windows 95 disk-usage pie: a tilted disc with a raised edge. Used space is the blue slice, starting
 * at three o'clock and running counterclockwise; free space is magenta. Every boundary is a 1px black line,
 * and nothing is antialiased.
 */
export function drivePie(width: number, height: number, depth: number, used: number): PieCell[][] {
  const rx = (width - 1) / 2
  const ry = (height - depth - 1) / 2
  const cx = rx
  const cy = ry
  const sweep = Math.max(0, Math.min(1, used)) * Math.PI * 2
  const isUsed = (angle: number) => (angle < 0 ? angle + Math.PI * 2 : angle) < sweep
  const inside = (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
  const face = (x: number, y: number): PieCell => {
    if (inside(x, y)) return isUsed(Math.atan2((cy - y) / ry, (x - cx) / rx)) ? 'used' : 'free'
    if (y <= cy) return 'none'
    for (let drop = 1; drop <= depth; drop++) {
      if (!inside(x, y - drop)) continue
      const u = Math.max(-1, Math.min(1, (x - cx) / rx))
      return isUsed(Math.atan2(-Math.sqrt(1 - u * u), u)) ? 'usedSide' : 'freeSide'
    }
    return 'none'
  }
  const cells = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => face(x, y)))
  const at = (x: number, y: number) => cells[y]?.[x] ?? 'none'
  return cells.map((row, y) =>
    row.map((cell, x) => {
      if (cell === 'none') return cell
      const outer = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes('none')
      const seam = (other: PieCell) => other !== 'none' && other !== cell
      return outer || seam(at(x + 1, y)) || seam(at(x, y + 1)) ? 'edge' : cell
    }),
  )
}
