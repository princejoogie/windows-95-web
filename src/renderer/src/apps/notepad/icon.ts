import { pixelArt } from '../../icons/pixel'

export const notepadIcon = pixelArt(
  Array.from({ length: 32 }, (_, y) =>
    Array.from({ length: 32 }, (_, x) => {
      if (x < 5 || x > 26 || y < 2 || y > 29) return '.'
      if (x === 26 || y === 29) return 'k'
      if (x === 5 || y === 2) return 'g'
      if (y < 6) return y === 4 && x % 4 === 0 ? 'k' : 'B'
      if (x === 8) return 'r'
      if (y > 8 && y < 27 && y % 4 === 1 && x > 10 && x < 24) return 'c'
      return 'w'
    }).join(''),
  ),
)
