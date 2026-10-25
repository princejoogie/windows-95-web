import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useKeyDown } from '../../shell/context'
import type { AppManifest, AppProps } from '../../shell/types'
import { AboutDialog, Accel, Button, Dialog, MessageBox, TextBox } from '../../ui'
import { type HelpBook, type HelpTopic, indexOf, parseParagraph, searchTopics, topicsOf } from './books'
import { CommandMenu, Tabs } from './controls'
import { help } from './help'
import { bookClosed, bookOpen, helpIcon, pageIcon } from './icons'
import './help.css'

const modules = import.meta.glob<{ help: HelpBook }>('../*/help.ts', { eager: true })
const books = Object.values(modules).map((module) => module.help)
const tabs = ['Contents', 'Index', 'Find'] as const

function HelpTopics({
  book,
  onDisplay,
  onCancel,
}: {
  book: HelpBook
  onDisplay: (topic: HelpTopic) => void
  onCancel: () => void
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Contents')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [selected, setSelected] = useState('')
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [indexChoice, setIndexChoice] = useState('')
  const [findChoice, setFindChoice] = useState('')
  const [disambiguate, setDisambiguate] = useState<readonly HelpTopic[] | null>(null)
  const inputId = useId()
  const index = useMemo(() => indexOf(book), [book])
  const results = useMemo(() => searchTopics(book, query), [book, query])
  const rows = book.contents.flatMap<{
    key: string
    entry: HelpBook['contents'][number]
    parent: string | null
  }>((entry, group) =>
    'topics' in entry
      ? [
          { key: `group-${group}`, entry, parent: null },
          ...(expanded.has(entry.title)
            ? entry.topics.map((topic) => ({ key: topic.id, entry: topic, parent: entry.title }))
            : []),
        ]
      : [{ key: entry.id, entry, parent: null }],
  )
  const selectedRow = rows.find((row) => row.key === selected) ?? rows[0]
  const currentIndex = index.find((entry) => entry.keyword === indexChoice) ?? index[0]
  const findTopic = results.find((entry) => entry.id === findChoice) ?? results[0]
  const toggle = (title: string) =>
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  const display = () => {
    if (tab === 'Contents' && selectedRow) {
      if ('topics' in selectedRow.entry) toggle(selectedRow.entry.title)
      else onDisplay(selectedRow.entry)
    } else if (tab === 'Index' && currentIndex) {
      if (currentIndex.topics.length > 1) setDisambiguate(currentIndex.topics)
      else if (currentIndex.topics[0]) onDisplay(currentIndex.topics[0])
    } else if (tab === 'Find' && findTopic) onDisplay(findTopic)
  }
  return (
    <div className="help-browser">
      <Tabs items={tabs} value={tab} onChange={setTab} />
      <div className="classic-sheet" role="tabpanel" aria-label={tab}>
        <p className="mb-3">
          {tab === 'Contents'
            ? 'Click a book, and then click Open. Or click another tab.'
            : tab === 'Index'
              ? 'Type the first few letters of the word you are looking for.'
              : 'Type the words you want to find in this Help book.'}
        </p>
        {tab === 'Contents' ? (
          <div role="tree" aria-label="Help contents" className="help-tree bevel-sunken">
            {rows.map((row, rowIndex) => {
              const group = 'topics' in row.entry
              return (
                <button
                  key={row.key}
                  type="button"
                  role="treeitem"
                  aria-level={row.parent ? 2 : 1}
                  aria-expanded={group ? expanded.has(row.entry.title) : undefined}
                  aria-selected={selectedRow?.key === row.key}
                  tabIndex={selectedRow?.key === row.key ? 0 : -1}
                  style={{ marginLeft: row.parent ? 20 : 0 }}
                  onFocus={() => setSelected(row.key)}
                  onClick={() => setSelected(row.key)}
                  onDoubleClick={() =>
                    'topics' in row.entry ? toggle(row.entry.title) : onDisplay(row.entry)
                  }
                  onKeyDown={(event) => {
                    let next = rowIndex
                    if (event.key === 'ArrowDown') next = Math.min(rows.length - 1, rowIndex + 1)
                    else if (event.key === 'ArrowUp') next = Math.max(0, rowIndex - 1)
                    else if (event.key === 'Home') next = 0
                    else if (event.key === 'End') next = rows.length - 1
                    else if (event.key === 'ArrowRight' && group && !expanded.has(row.entry.title)) {
                      event.preventDefault()
                      toggle(row.entry.title)
                      return
                    } else if (event.key === 'ArrowLeft') {
                      if (group && expanded.has(row.entry.title)) {
                        event.preventDefault()
                        toggle(row.entry.title)
                        return
                      }
                      next = rows.findIndex((item) => item.entry.title === row.parent)
                    } else if (event.key === 'Enter') {
                      event.preventDefault()
                      display()
                      return
                    } else return
                    event.preventDefault()
                    event.currentTarget.parentElement
                      ?.querySelectorAll<HTMLButtonElement>('[role=treeitem]')
                      [next]?.focus()
                  }}
                >
                  <img
                    src={group ? (expanded.has(row.entry.title) ? bookOpen : bookClosed) : pageIcon}
                    alt=""
                  />
                  <span>{row.entry.title}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <>
            <label className="sr-only" htmlFor={inputId}>
              {tab === 'Index' ? 'Keyword' : 'Find words'}
            </label>
            <TextBox
              id={inputId}
              value={tab === 'Index' ? keyword : query}
              onChange={(event) => {
                if (tab === 'Find') {
                  setQuery(event.target.value)
                  setFindChoice('')
                } else {
                  setKeyword(event.target.value)
                  const match = index.find((entry) =>
                    entry.keyword.toLocaleLowerCase().startsWith(event.target.value.toLocaleLowerCase()),
                  )
                  setIndexChoice(match?.keyword ?? '')
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  display()
                }
              }}
            />
            <p className="my-2">
              {tab === 'Index'
                ? 'Click the index entry you want, and then click Display.'
                : `${results.length} topic(s) found. Select a topic, and then click Display.`}
            </p>
            <select
              size={10}
              aria-label={tab === 'Index' ? 'Index entries' : 'Matching topics'}
              className="help-list bevel-sunken"
              value={tab === 'Index' ? (currentIndex?.keyword ?? '') : (findTopic?.id ?? '')}
              onChange={(event) =>
                tab === 'Index' ? setIndexChoice(event.target.value) : setFindChoice(event.target.value)
              }
              onDoubleClick={display}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  display()
                }
              }}
            >
              {tab === 'Index'
                ? index.map((entry) => (
                    <option key={entry.keyword} value={entry.keyword}>
                      {entry.keyword}
                    </option>
                  ))
                : results.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.title}
                    </option>
                  ))}
            </select>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-3">
        <Button data-help-display isDefault disabled={tab === 'Find' && !findTopic} onClick={display}>
          <Accel
            label={tab === 'Contents' && selectedRow && 'topics' in selectedRow.entry ? '&Open' : '&Display'}
          />
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
      {disambiguate && (
        <Dialog title="Topics Found" onClose={() => setDisambiguate(null)} className="w-[330px]">
          <p className="p-3">Select a topic, then click Display.</p>
          <select
            aria-label="Topics for keyword"
            className="help-list mx-3 w-auto!"
            size={6}
            defaultValue={disambiguate[0]?.id}
            onChange={(event) => setSelected(event.target.value)}
            onDoubleClick={(event) => {
              const topic = disambiguate.find((entry) => entry.id === event.currentTarget.value)
              if (topic) onDisplay(topic)
            }}
          >
            {disambiguate.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2 p-3">
            <Button
              isDefault
              onClick={() => {
                const topic = disambiguate.find((entry) => entry.id === selected) ?? disambiguate[0]
                if (topic) onDisplay(topic)
              }}
            >
              Display
            </Button>
            <Button onClick={() => setDisambiguate(null)}>Cancel</Button>
          </div>
        </Dialog>
      )}
    </div>
  )
}

function TopicBody({
  topic,
  onJump,
  onPopup,
}: {
  topic: HelpTopic
  onJump: (id: string) => void
  onPopup: (id: string) => void
}) {
  return (
    <>
      <h1>{topic.title}</h1>
      {topic.body.split(/\n\s*\n/).map((paragraph) => (
        <p key={paragraph}>
          {parseParagraph(paragraph).map((part) =>
            part.kind === 'bold' ? (
              <strong key={`bold-${part.text}`}>{part.text}</strong>
            ) : 'target' in part ? (
              <a
                key={`${part.target}-${part.text}`}
                href={`#${part.target}`}
                data-popup={part.kind === 'popup'}
                onClick={(event) => {
                  event.preventDefault()
                  if (part.kind === 'popup') onPopup(part.target)
                  else onJump(part.target)
                }}
              >
                {part.text}
              </a>
            ) : (
              part.text
            ),
          )}
        </p>
      ))}
    </>
  )
}

function Help({ args, window: appWindow }: AppProps) {
  const book = books.find((entry) => entry.id === args.book) ?? help
  const topics = useMemo(() => topicsOf(book), [book])
  const [navigation, setNavigation] = useState<{ back: readonly HelpTopic[]; visited: readonly HelpTopic[] }>(
    { back: [], visited: [] },
  )
  const history = navigation.back
  const [showTopics, setShowTopics] = useState(true)
  const [popup, setPopup] = useState<HelpTopic | null>(null)
  const [dialog, setDialog] = useState<'history' | 'about' | null>(null)
  const [message, setMessage] = useState<string | null>(
    args.book && !books.some((entry) => entry.id === args.book)
      ? `The Help book "${args.book}" is not installed. Windows Help has been opened instead.`
      : null,
  )
  const [fontSize, setFontSize] = useState(13)
  const topic = history.at(-1)
  const article = useRef<HTMLElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const openTopic = (next: HelpTopic) => {
    setNavigation((previous) => ({
      back: previous.back.at(-1)?.id === next.id ? previous.back : [...previous.back, next],
      visited: [...previous.visited.filter((entry) => entry.id !== next.id), next],
    }))
    setShowTopics(false)
    setPopup(null)
    setDialog(null)
    requestAnimationFrame(() => {
      article.current?.scrollTo(0, 0)
      article.current?.focus()
    })
  }
  const jump = (id: string) => {
    const next = topics.find((entry) => entry.id === id)
    if (next) openTopic(next)
    else setMessage('This topic is not available in the current Help book.')
  }
  const openPopup = (id: string) => {
    const next = topics.find((entry) => entry.id === id)
    if (next) setPopup(next)
    else setMessage('This explanation is not available in the current Help book.')
  }
  useEffect(() => {
    appWindow.setTitle(showTopics ? `Help Topics: ${book.title}` : book.title)
  }, [appWindow, book.title, showTopics])
  useEffect(() => {
    if (!popup) return
    const previous = document.activeElement
    popupRef.current?.focus()
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [popup])
  useKeyDown((event) => {
    if (dialog || message) return
    if (event.key === 'Escape' && popup) {
      event.preventDefault()
      setPopup(null)
    } else if (event.key === 'Escape' && showTopics) {
      event.preventDefault()
      if (topic) setShowTopics(false)
      else appWindow.close()
    } else if (event.key === 'F1') {
      event.preventDefault()
      setShowTopics(true)
    } else if (event.altKey && event.key === 'ArrowLeft' && !showTopics && history.length > 1) {
      event.preventDefault()
      setNavigation((previous) => ({ ...previous, back: previous.back.slice(0, -1) }))
    } else if (event.altKey && event.key.toLowerCase() === 'o' && !showTopics) {
      event.preventDefault()
      root.current?.querySelector<HTMLButtonElement>('[aria-haspopup=menu]')?.click()
    } else if (event.altKey && ['d', 'o'].includes(event.key.toLowerCase()) && showTopics) {
      event.preventDefault()
      root.current?.querySelector<HTMLButtonElement>('[data-help-display]')?.click()
    }
  })
  const copy = () => {
    if (topic)
      void navigator.clipboard
        .writeText(
          [
            topic.title,
            ...topic.body.split(/\n\s*\n/).map((paragraph) =>
              parseParagraph(paragraph)
                .map((part) => part.text)
                .join(''),
            ),
          ].join('\n\n'),
        )
        .catch(() => setMessage('The Clipboard is not available.'))
  }
  const printTopic = () => {
    const element = article.current
    if (!element) return
    element.dataset.helpPrint = 'true'
    globalThis.addEventListener('afterprint', () => delete element.dataset.helpPrint, { once: true })
    globalThis.print()
  }
  return (
    <div ref={root} className="relative flex h-full w-full flex-col">
      {showTopics ? (
        <HelpTopics
          book={book}
          onDisplay={openTopic}
          onCancel={() => (topic ? setShowTopics(false) : appWindow.close())}
        />
      ) : (
        topic && (
          <>
            <div className="flex shrink-0 gap-1 p-1 border-b border-shadow">
              <Button onClick={() => setShowTopics(true)}>Help Topics</Button>
              <Button
                disabled={history.length < 2}
                onClick={() =>
                  setNavigation((previous) => ({ ...previous, back: previous.back.slice(0, -1) }))
                }
              >
                Back
              </Button>
              <CommandMenu
                label="&Options"
                commands={[
                  { label: '&History...', action: () => setDialog('history') },
                  'separator',
                  ...[
                    { label: 'Small', size: 11 },
                    { label: 'Normal', size: 13 },
                    { label: 'Large', size: 16 },
                  ].map(({ label, size }) => ({
                    label: `${label} font`,
                    checked: fontSize === size,
                    action: () => setFontSize(size),
                  })),
                  'separator',
                  { label: '&Copy', action: copy },
                  {
                    label: '&Print Topic...',
                    action: printTopic,
                  },
                  'separator',
                  { label: '&About Windows Help', action: () => setDialog('about') },
                ]}
              >
                <Accel label="&Options" />
              </CommandMenu>
            </div>
            <article
              ref={article}
              tabIndex={-1}
              aria-label="Help topic"
              className="help-topic outline-none"
              style={{ fontSize }}
            >
              <TopicBody topic={topic} onJump={jump} onPopup={openPopup} />
            </article>
          </>
        )
      )}
      {popup && (
        <div
          className="help-popup-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setPopup(null)
          }}
        >
          <div ref={popupRef} tabIndex={-1} role="dialog" aria-label={popup.title} className="help-popup">
            <TopicBody topic={popup} onJump={jump} onPopup={openPopup} />
          </div>
        </div>
      )}
      {dialog === 'history' && (
        <Dialog title="History" onClose={() => setDialog(null)} className="w-[340px]">
          <p className="p-3">Double-click a topic to return to it.</p>
          <select
            size={8}
            aria-label="Topics visited"
            className="help-list mx-3 w-auto!"
            onDoubleClick={(event) => jump(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') jump(event.currentTarget.value)
            }}
          >
            {[...navigation.visited].reverse().map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
          <Button className="m-3 self-end" onClick={() => setDialog(null)}>
            Close
          </Button>
        </Dialog>
      )}
      {dialog === 'about' && (
        <AboutDialog app="Windows Help" icon={helpIcon} onClose={() => setDialog(null)} />
      )}
      {message && (
        <MessageBox
          title="Windows Help"
          message={message}
          buttons={['OK']}
          onClose={() => setMessage(null)}
        />
      )}
    </div>
  )
}

export const app: AppManifest = {
  id: 'help',
  title: 'Help Topics: Windows Help',
  icon: helpIcon,
  smallIcon: bookClosed,
  exe: 'WINHLP32.EXE',
  window: { kind: 'resizable', width: 490, height: 365, minWidth: 370, minHeight: 290 },
  component: Help,
}
