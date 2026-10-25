/** Returns a float in [0, 1). */
export type Rng = () => number

/** A seeded mulberry32 generator, so a level plays the same way from the same seed. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** An integer in [min, max]. */
export const roll = (rng: Rng, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1))

/** A triangular spread in (-1, 1), like Doom's `P_Random() - P_Random()`. */
export const spread = (rng: Rng): number => rng() - rng()
