import { describe, expect, it } from 'vitest'
import { help } from './help'

const topics = help.contents.flatMap((entry) => ('topics' in entry ? entry.topics : [entry]))

describe('Paint help book', () => {
  it('is the paint book with unique topic ids', () => {
    expect(help.id).toBe('paint')
    expect(new Set(topics.map((topic) => topic.id)).size).toBe(topics.length)
  })
  it('only jumps to topics that exist', () => {
    const ids = new Set(topics.map((topic) => topic.id))
    const jumps = topics.flatMap((topic) =>
      [...topic.body.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]),
    )
    expect(jumps.length).toBeGreaterThan(0)
    for (const jump of jumps) expect(ids.has(jump ?? '')).toBe(true)
  })
  it('covers the tools, the clipboard, and the menus', () => {
    const text = topics.map((topic) => topic.title).join(' ')
    for (const subject of ['curves', 'polygons', 'text', 'selections', 'copying', 'Zooming', 'colors'])
      expect(text.toLowerCase()).toContain(subject.toLowerCase())
  })
})
