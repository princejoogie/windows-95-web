/** The Options page settings. They apply to every Doom window and survive a restart. */
export interface Options {
  /** 0 to `MOUSE_STEPS - 1`. */
  readonly mouse: number
  /** 0 to `VOLUME_STEPS - 1`. */
  readonly volume: number
  /** Off gives the 3D view the whole screen, like Doom's largest screen size. */
  readonly statusBar: boolean
}

export const MOUSE_STEPS = 10
export const VOLUME_STEPS = 16

export const DEFAULT_OPTIONS: Options = { mouse: 5, volume: 8, statusBar: true }

export const OPTIONS_KEY = 'w95.doom95.options.v1'

const step = (value: unknown, steps: number, fallback: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < steps ? value : fallback

export function parseOptions(value: unknown): Options {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    mouse: step(raw.mouse, MOUSE_STEPS, DEFAULT_OPTIONS.mouse),
    volume: step(raw.volume, VOLUME_STEPS, DEFAULT_OPTIONS.volume),
    statusBar: typeof raw.statusBar === 'boolean' ? raw.statusBar : DEFAULT_OPTIONS.statusBar,
  }
}

/** Radians of turn per pixel of mouse motion. The default step matches the original fixed rate. */
export const mouseScale = (options: Options): number =>
  0.0032 * ((options.mouse + 1) / (DEFAULT_OPTIONS.mouse + 1))

/** Master gain. The default step matches the original fixed level. */
export const masterGain = (options: Options): number => 0.35 * (options.volume / DEFAULT_OPTIONS.volume)

export function loadOptions(storage: Pick<Storage, 'getItem'> = localStorage): Options {
  try {
    return parseOptions(JSON.parse(storage.getItem(OPTIONS_KEY) ?? 'null'))
  } catch {
    return DEFAULT_OPTIONS
  }
}

export function storeOptions(options: Options, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(OPTIONS_KEY, JSON.stringify(options))
  } catch {}
}
