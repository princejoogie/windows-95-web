/**
 * Levels are ASCII grids. One character is one cell, and a cell is one unit wide. `x` grows east and
 * `y` grows south, so angle 0 faces east and angle PI/2 faces south.
 */

export type KeyColor = 'red' | 'blue' | 'yellow'

export const KEY_COLORS: readonly KeyColor[] = ['red', 'blue', 'yellow']

export type MonsterKind = 'trooper' | 'demon' | 'barrel'
export type ItemKind = 'health' | 'armor' | 'clip' | 'shells' | 'shotgun' | 'redKey' | 'blueKey' | 'yellowKey'
export type ThingKind = MonsterKind | ItemKind

/** Wall, door, and flat texture ids. 0 is an open cell. */
export const TEX = {
  tech: 1,
  brick: 2,
  metal: 3,
  wood: 4,
  stone: 5,
  exit: 6,
  exitOn: 7,
  door: 8,
  doorRed: 9,
  doorBlue: 10,
  doorYellow: 11,
  jamb: 12,
  floor: 13,
  ceiling: 14,
} as const

export const TEXTURE_COUNT = 15

const WALLS: Readonly<Record<string, number>> = {
  ' ': TEX.stone,
  '#': TEX.tech,
  '%': TEX.brick,
  '=': TEX.metal,
  $: TEX.wood,
  '@': TEX.stone,
  E: TEX.exit,
}

const DOORS: Readonly<Record<string, KeyColor | null>> = { D: null, R: 'red', U: 'blue', Y: 'yellow' }

const THINGS: Readonly<Record<string, ThingKind>> = {
  t: 'trooper',
  d: 'demon',
  o: 'barrel',
  h: 'health',
  a: 'armor',
  c: 'clip',
  s: 'shells',
  g: 'shotgun',
  r: 'redKey',
  u: 'blueKey',
  y: 'yellowKey',
}

const STARTS: Readonly<Record<string, number>> = { '>': 0, v: Math.PI / 2, '<': Math.PI, '^': -Math.PI / 2 }

export const doorTexture = (key: KeyColor | null): number =>
  key === 'red' ? TEX.doorRed : key === 'blue' ? TEX.doorBlue : key === 'yellow' ? TEX.doorYellow : TEX.door

/** `x` doors span east to west between walls and sit on the cell's horizontal midline. */
export interface DoorSpec {
  readonly x: number
  readonly y: number
  readonly axis: 'x' | 'y'
  readonly key: KeyColor | null
}

export interface ThingSpawn {
  readonly kind: ThingKind
  /** Cell centers. */
  readonly x: number
  readonly y: number
}

export interface LevelSource {
  readonly name: string
  readonly par: number
  readonly rows: readonly string[]
}

export interface Level {
  readonly name: string
  /** Par time in seconds. */
  readonly par: number
  readonly width: number
  readonly height: number
  /** A texture id per cell, row-major. 0 is open floor. Door cells are 0 here and live in `doors`. */
  readonly walls: Uint8Array
  readonly doors: readonly DoorSpec[]
  readonly things: readonly ThingSpawn[]
  /** Cell indices of secret floor. Stepping on one finds that secret. */
  readonly secrets: readonly number[]
  readonly start: { readonly x: number; readonly y: number; readonly angle: number }
}

export class MapError extends Error {
  override name = 'MapError'
}

/**
 * Legend. Walls: `#` tech, `%` brick, `=` metal, `$` wood, `@` and space stone, `E` exit switch. Doors:
 * `D` plain, `R` red, `U` blue, `Y` yellow. Floor: `.`, and `S` for a secret. Player start: `>` `v` `<`
 * `^`. Things: `t` trooper, `d` demon, `o` barrel, `h` health, `a` armor, `c` clip, `s` shells, `g`
 * shotgun, `r` `u` `y` keys.
 */
export function parseLevel(source: LevelSource): Level {
  const { rows } = source
  const height = rows.length
  const width = Math.max(0, ...rows.map((row) => row.length))
  if (height < 3 || width < 3) throw new MapError(`${source.name}: a level needs at least 3x3 cells`)
  const walls = new Uint8Array(width * height)
  const doors: DoorSpec[] = []
  const things: ThingSpawn[] = []
  const secrets: number[] = []
  let start: Level['start'] | null = null

  const charAt = (x: number, y: number) => rows[y]?.[x] ?? ' '
  const isWallChar = (ch: string) => WALLS[ch] !== undefined

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = charAt(x, y)
      const cell = y * width + x
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1
      const wall = WALLS[ch]
      if (wall !== undefined) {
        walls[cell] = wall
        continue
      }
      if (edge) throw new MapError(`${source.name}: open cell '${ch}' at ${x},${y} on the border`)
      const key = DOORS[ch]
      if (key !== undefined) {
        if (isWallChar(charAt(x - 1, y)) && isWallChar(charAt(x + 1, y))) doors.push({ x, y, axis: 'x', key })
        else if (isWallChar(charAt(x, y - 1)) && isWallChar(charAt(x, y + 1)))
          doors.push({ x, y, axis: 'y', key })
        else throw new MapError(`${source.name}: door at ${x},${y} needs walls on two opposite sides`)
        continue
      }
      const angle = STARTS[ch]
      if (angle !== undefined) {
        if (start) throw new MapError(`${source.name}: more than one player start`)
        start = { x: x + 0.5, y: y + 0.5, angle }
        continue
      }
      const thing = THINGS[ch]
      if (thing) things.push({ kind: thing, x: x + 0.5, y: y + 0.5 })
      else if (ch === 'S') secrets.push(cell)
      else if (ch !== '.') throw new MapError(`${source.name}: unknown cell '${ch}' at ${x},${y}`)
    }
  }
  if (!start) throw new MapError(`${source.name}: no player start`)
  return { name: source.name, par: source.par, width, height, walls, doors, things, secrets, start }
}
