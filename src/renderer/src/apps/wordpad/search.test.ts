import { describe, expect, it } from 'vitest'
import { findAll, findNext, locate } from './search'

const loose = { matchCase: false, wholeWord: false }
const text = 'The cat sat. The CAT concatenated. cat'

describe('find', () => {
  it('finds the next match after the caret, ignoring case by default', () => {
    expect(findNext(text, 'cat', 0, loose)).toBe(4)
    expect(findNext(text, 'cat', 5, loose)).toBe(17)
    expect(findNext(text, 'cat', 18, loose)).toBe(24)
  })

  it('wraps to the top once the end is reached, and reports none when the word is absent', () => {
    expect(findNext(text, 'cat', 36, loose)).toBe(4)
    expect(findNext(text, 'cat', 36, loose, false)).toBe(null)
    expect(findNext(text, 'dog', 0, loose)).toBe(null)
    expect(findNext(text, '', 0, loose)).toBe(null)
  })

  it('honours Match case and Match whole word only', () => {
    expect(findNext(text, 'CAT', 0, { ...loose, matchCase: true })).toBe(17)
    expect(findNext(text, 'cat', 18, { ...loose, wholeWord: true })).toBe(35)
    expect(findAll(text, 'cat', { ...loose, wholeWord: true })).toEqual([4, 17, 35])
    expect(findAll(text, 'cat', loose)).toEqual([4, 17, 24, 35])
  })

  it('maps a flat offset to the text node that holds it', () => {
    const segments = [
      { owner: 'a', length: 3 },
      { owner: 'b', length: 0 },
      { owner: 'c', length: 4 },
    ]
    expect(locate(segments, 0)).toEqual({ owner: 'a', offset: 0 })
    expect(locate(segments, 2)).toEqual({ owner: 'a', offset: 2 })
    expect(locate(segments, 3)).toEqual({ owner: 'c', offset: 0 })
    expect(locate(segments, 7)).toEqual({ owner: 'c', offset: 4 })
    expect(locate(segments, 8)).toBe(null)
  })
})
