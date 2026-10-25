export const COLUMNS = 80
export const ROWS = 25

export function wrap(lines: readonly string[]): string[] {
  return lines.flatMap((line) => {
    let expanded = ''
    for (const char of line.replace(/\r/g, ''))
      expanded += char === '\t' ? ' '.repeat(8 - (expanded.length % 8)) : char
    return expanded.split('\n').flatMap((part) => part.match(/.{1,80}/g) ?? [''])
  })
}

export interface Screen {
  readonly lines: readonly string[]
  readonly queue: readonly string[]
}

export function print(lines: readonly string[], output: readonly string[], paginate: boolean): Screen {
  const wrapped = wrap(output)
  const room = paginate ? Math.max(1, ROWS - 1 - lines.length) : wrapped.length
  return { lines: [...lines, ...wrapped.slice(0, room)].slice(-(ROWS - 1)), queue: wrapped.slice(room) }
}

export function nextPage(screen: Screen, oneLine = false): Screen {
  const count = oneLine ? 1 : ROWS - 1
  return {
    lines: [...screen.lines, ...screen.queue.slice(0, count)].slice(-(ROWS - 1)),
    queue: screen.queue.slice(count),
  }
}

export interface Cell {
  readonly row: number
  readonly column: number
}
export interface Mark {
  readonly anchor: Cell
  readonly end: Cell
}

export function markedText(lines: readonly string[], mark: Mark): string {
  const left = Math.min(mark.anchor.column, mark.end.column)
  const right = Math.max(mark.anchor.column, mark.end.column)
  const top = Math.min(mark.anchor.row, mark.end.row)
  const bottom = Math.max(mark.anchor.row, mark.end.row)
  return lines
    .slice(top, bottom + 1)
    .map((line) =>
      line
        .padEnd(COLUMNS)
        .slice(left, right + 1)
        .trimEnd(),
    )
    .join('\r\n')
}
