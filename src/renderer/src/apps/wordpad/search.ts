export interface SearchOptions {
  readonly matchCase: boolean
  readonly wholeWord: boolean
}

const isWordChar = (char: string | undefined): boolean => char !== undefined && /[\p{L}\p{N}_]/u.test(char)

/** The next match at or after `start`, wrapping to the top when `wrap` is set. `null` when there is none. */
export function findNext(
  text: string,
  query: string,
  start: number,
  options: SearchOptions,
  wrap = true,
): number | null {
  if (!query) return null
  const haystack = options.matchCase ? text : text.toLowerCase()
  const needle = options.matchCase ? query : query.toLowerCase()
  const scan = (from: number, to: number): number | null => {
    let at = haystack.indexOf(needle, from)
    while (at >= 0 && at + needle.length <= to) {
      if (!options.wholeWord || (!isWordChar(text[at - 1]) && !isWordChar(text[at + needle.length])))
        return at
      at = haystack.indexOf(needle, at + 1)
    }
    return null
  }
  const found = scan(Math.max(0, start), text.length)
  if (found !== null || !wrap) return found
  return scan(0, Math.min(text.length, start + needle.length - 1))
}

/** Every match, left to right and non-overlapping. */
export function findAll(text: string, query: string, options: SearchOptions): number[] {
  const out: number[] = []
  let from = 0
  while (from <= text.length) {
    const at = findNext(text, query, from, options, false)
    if (at === null) break
    out.push(at)
    from = at + query.length
  }
  return out
}

export interface Segment<T> {
  readonly owner: T
  readonly length: number
}

/** Maps an offset in the joined text back to the segment it falls in and the offset inside it. */
export function locate<T>(
  segments: readonly Segment<T>[],
  offset: number,
): { owner: T; offset: number } | null {
  let base = 0
  for (const [index, segment] of segments.entries()) {
    const end = base + segment.length
    if (offset < end || (offset === end && index === segments.length - 1)) {
      return { owner: segment.owner, offset: offset - base }
    }
    base = end
  }
  return null
}
