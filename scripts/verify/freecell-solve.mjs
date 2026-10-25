// Historical proof from an earlier rebuild round. See scripts/verify/README.md.
import { readFileSync, writeFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`
const solitaire = moduleUrl(readFileSync('src/renderer/src/apps/solitaire/game.ts', 'utf8'))
export const rules = await import(
  moduleUrl(
    readFileSync('src/renderer/src/apps/freecell/game.ts', 'utf8').replace(
      "'../solitaire/game'",
      JSON.stringify(solitaire),
    ),
  )
)

function key(position) {
  const card = ({ rank, suit }) => rank * 4 + ['clubs', 'diamonds', 'hearts', 'spades'].indexOf(suit)
  return `${position.columns
    .map((column) => column.map(card).join(','))
    .sort()
    .join('|')};${position.cells
    .filter(Boolean)
    .map(card)
    .sort((a, b) => a - b)
    .join(',')}`
}

function score(position, depth) {
  let disorder = 0
  let blockers = 0
  for (const column of position.columns) {
    for (let index = 0; index < column.length; index++) {
      const card = column[index]
      const next = column[index + 1]
      if (
        next &&
        (card.rank !== next.rank + 1 ||
          ['hearts', 'diamonds'].includes(card.suit) === ['hearts', 'diamonds'].includes(next.suit))
      )
        disorder++
      const home = position.homes.find((pile) => pile[0]?.suit === card.suit)?.length ?? 0
      if (card.rank === home + 1) blockers += column.length - index - 1
    }
  }
  return (
    10 * (52 - position.homes.flat().length) +
    5 * disorder +
    4 * blockers +
    3 * position.cells.filter(Boolean).length +
    depth * 0.2
  )
}

class Queue {
  items = []
  push(node) {
    const items = this.items
    items.push(node)
    let index = items.length - 1
    while (index > 0) {
      const parent = (index - 1) >> 1
      if (items[parent].score <= node.score) break
      items[index] = items[parent]
      index = parent
    }
    items[index] = node
  }
  pop() {
    const items = this.items
    const first = items[0]
    const last = items.pop()
    if (!items.length) return first
    let index = 0
    for (;;) {
      let child = index * 2 + 1
      if (child >= items.length) break
      if (child + 1 < items.length && items[child + 1].score < items[child].score) child++
      if (last.score <= items[child].score) break
      items[index] = items[child]
      index = child
    }
    items[index] = last
    return first
  }
}

export function solve(number, maxVisited = 300000) {
  const parsed = rules.gameNumber(String(number))
  if (parsed === null) throw new Error('Invalid deal number')
  const game = rules.newGame(parsed)
  const queue = new Queue()
  queue.push({ game, score: score(game.position, 0), parent: null, step: null, depth: 0 })
  const visited = new Set([key(game.position)])
  while (queue.items.length && visited.size < maxVisited) {
    const node = queue.pop()
    if (node.game.phase === 'won') {
      const steps = []
      let current = node
      while (current.step) {
        steps.push(current.step)
        current = current.parent
      }
      return { number, visited: visited.size, steps: steps.reverse() }
    }
    const position = node.game.position
    const sources = [
      ...rules.COLUMNS.flatMap((column) =>
        position.columns[column].map((_, index) => ({ kind: 'column', column, index })),
      ),
      ...rules.CELLS.filter((cell) => position.cells[cell]).map((cell) => ({ kind: 'cell', cell })),
    ]
    const free = rules.CELLS.find((cell) => !position.cells[cell])
    const empty = rules.COLUMNS.find((column) => !position.columns[column].length)
    const targets = [
      ...rules.COLUMNS.filter((column) => position.columns[column].length || column === empty).map(
        (column) => ({ kind: 'column', column }),
      ),
      ...rules.CELLS.map((cell) => ({ kind: 'home', cell })),
      ...(free === undefined ? [] : [{ kind: 'cell', cell: free }]),
    ]
    for (const source of sources) {
      for (const target of targets) {
        if (source.kind === 'cell' && target.kind === 'cell') continue
        if (
          source.kind === 'column' &&
          source.index === 0 &&
          target.kind === 'column' &&
          !position.columns[target.column].length
        )
          continue
        if (!rules.canMove(position, source, target)) continue
        const next = { ...rules.move(node.game, source, target), previous: null }
        const identity = key(next.position)
        if (visited.has(identity)) continue
        visited.add(identity)
        queue.push({
          game: next,
          parent: node,
          step: { source, target },
          depth: node.depth + 1,
          score: score(next.position, node.depth + 1),
        })
      }
    }
  }
  throw new Error(`No solution within ${visited.size} positions`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = solve(Number(process.argv[2] ?? 1))
  if (process.argv[3]) writeFileSync(process.argv[3], `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify({ number: result.number, visited: result.visited, moves: result.steps.length }))
}
