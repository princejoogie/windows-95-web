export interface HelpTopic {
  readonly id: string
  readonly title: string
  readonly body: string
  readonly keywords?: readonly string[]
}

export interface HelpBook {
  readonly id: string
  readonly title: string
  readonly contents: readonly (
    | HelpTopic
    | { readonly title: string; readonly topics: readonly HelpTopic[] }
  )[]
}

export function topicsOf(book: HelpBook): readonly HelpTopic[] {
  return book.contents.flatMap((entry) => ('topics' in entry ? entry.topics : [entry]))
}

export function indexOf(book: HelpBook): readonly { keyword: string; topics: readonly HelpTopic[] }[] {
  const index = new Map<string, HelpTopic[]>()
  for (const topic of topicsOf(book)) {
    for (const keyword of new Set([topic.title, ...(topic.keywords ?? [])])) {
      const entries = index.get(keyword) ?? []
      entries.push(topic)
      index.set(keyword, entries)
    }
  }
  return [...index]
    .map(([keyword, topics]) => ({ keyword, topics }))
    .sort((a, b) => a.keyword.localeCompare(b.keyword))
}

export function searchTopics(book: HelpBook, query: string): readonly HelpTopic[] {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return topicsOf(book).filter((topic) => {
    const text = [topic.title, topic.body, ...(topic.keywords ?? [])].join(' ').toLocaleLowerCase()
    return words.every((word) => text.includes(word))
  })
}

export type HelpPart =
  | { readonly kind: 'text' | 'bold'; readonly text: string }
  | { readonly kind: 'jump' | 'popup'; readonly text: string; readonly target: string }

export function parseParagraph(text: string): readonly HelpPart[] {
  const parts: HelpPart[] = []
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g
  let end = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > end) parts.push({ kind: 'text', text: text.slice(end, match.index) })
    if (match[1] !== undefined) parts.push({ kind: 'bold', text: match[1] })
    else {
      const target = match[3] ?? ''
      parts.push({
        kind: target.startsWith('popup:') ? 'popup' : 'jump',
        text: match[2] ?? '',
        target: target.replace(/^popup:/, ''),
      })
    }
    end = match.index + match[0].length
  }
  if (end < text.length) parts.push({ kind: 'text', text: text.slice(end) })
  return parts
}
