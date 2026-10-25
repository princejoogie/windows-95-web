import { DEFAULT_OPTIONS, deck, type Game, newGame, RANKS, seededRandom, type TableauCard } from './game'

export function proofDeal(kind: string): Game | null {
  const game = newGame(DEFAULT_OPTIONS, seededRandom(95))
  if (kind === 'win') {
    return {
      ...game,
      stock: [],
      waste: [],
      tableau: [[], [], [], [], [], [], [{ suit: 'spades', rank: 13, faceUp: true }]],
      foundations: [
        RANKS.map((rank) => ({ rank, suit: 'clubs' })),
        RANKS.map((rank) => ({ rank, suit: 'diamonds' })),
        RANKS.map((rank) => ({ rank, suit: 'hearts' })),
        RANKS.slice(0, 12).map((rank) => ({ rank, suit: 'spades' })),
      ],
      elapsed: 90,
      score: 500,
    }
  }
  if (kind === 'run') {
    const tableau: TableauCard[][] = [
      [
        { suit: 'clubs', rank: 4, faceUp: false },
        { suit: 'hearts', rank: 7, faceUp: true },
        { suit: 'clubs', rank: 6, faceUp: true },
        { suit: 'diamonds', rank: 5, faceUp: true },
      ],
      [{ suit: 'spades', rank: 8, faceUp: true }],
      [{ suit: 'diamonds', rank: 8, faceUp: true }],
      [],
      [],
      [],
      [],
    ]
    const used = new Set(tableau.flat().map((card) => `${card.suit}-${card.rank}`))
    return { ...game, tableau, stock: deck().filter((card) => !used.has(`${card.suit}-${card.rank}`)) }
  }
  return null
}
