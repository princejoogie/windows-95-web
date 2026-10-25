import { describe, expect, it } from 'vitest'
import { type HelpBook, indexOf, parseParagraph, searchTopics, topicsOf } from './books'
import { help } from './help'

describe('Help books', () => {
  it('flattens grouped and ungrouped topics and merges shared keywords', () => {
    const book: HelpBook = {
      id: 'game',
      title: 'Game',
      contents: [
        { id: 'rules', title: 'Rules', body: 'Play cards.', keywords: ['cards'] },
        {
          title: 'Playing',
          topics: [{ id: 'score', title: 'Score', body: 'Count cards.', keywords: ['cards'] }],
        },
      ],
    }
    expect(topicsOf(book).map((topic) => topic.id)).toEqual(['rules', 'score'])
    expect(indexOf(book).find((entry) => entry.keyword === 'cards')?.topics).toHaveLength(2)
  })
  it('finds all words in titles, text, and keywords without case sensitivity', () => {
    expect(searchTopics(help, 'VIRTUAL profile').map((topic) => topic.id)).toEqual(['missing-file'])
    expect(searchTopics(help, 'WILDCARDS').map((topic) => topic.id)).toEqual(['find'])
    expect(searchTopics(help, '   ')).toEqual([])
    expect(searchTopics(help, 'nonexistentword')).toEqual([])
  })
  it('renders safe text, bold, jumps, and popup links without interpreting HTML', () => {
    expect(parseParagraph('<img> **Start** [Find](find) [Taskbar](popup:taskbar)')).toEqual([
      { kind: 'text', text: '<img> ' },
      { kind: 'bold', text: 'Start' },
      { kind: 'text', text: ' ' },
      { kind: 'jump', text: 'Find', target: 'find' },
      { kind: 'text', text: ' ' },
      { kind: 'popup', text: 'Taskbar', target: 'taskbar' },
    ])
  })
  it('ships unique topic ids and resolves every Windows book link', () => {
    const topics = topicsOf(help)
    const ids = new Set(topics.map((topic) => topic.id))
    expect(ids.size).toBe(topics.length)
    for (const topic of topics)
      for (const part of parseParagraph(topic.body)) {
        if ('target' in part) expect(ids.has(part.target), `${topic.id} -> ${part.target}`).toBe(true)
      }
  })
})
