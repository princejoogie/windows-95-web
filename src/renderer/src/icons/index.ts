import { large, small, start } from './art'
import { pixelArtSet } from './pixel'

export const icons = {
  ...pixelArtSet(large),
  start: pixelArtSet(start),
  small: pixelArtSet(small),
} as const
