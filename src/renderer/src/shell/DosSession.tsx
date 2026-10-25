import { useEffect, useRef, useState } from 'react'
import { BANNER, execute, newSession, prompt } from '../apps/dosprompt/interpreter'
import { nextPage, print, ROWS, type Screen, wrap } from '../apps/dosprompt/screen'
import { fsStore } from '../fs/store'

export function DosSession({ onWindows }: { onWindows: () => void }) {
  const [session, setSession] = useState(newSession)
  const [screen, setScreen] = useState<Screen>({ lines: BANNER, queue: [] })
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<readonly string[]>([])
  const [historyAt, setHistoryAt] = useState<number | null>(null)
  const draft = useRef('')
  const field = useRef<HTMLInputElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [caretVisible, setCaretVisible] = useState(true)
  const waiting = screen.queue.length > 0
  const prefix = session.pending.kind === 'ready' ? prompt(session, fsStore.get(), Date.now()) : ''
  const lines = waiting
    ? [...screen.lines, '-- More --']
    : [...screen.lines, ...wrap([`${prefix}${input} `])].slice(-ROWS)
  useEffect(() => {
    field.current?.focus()
    const timer = setInterval(() => setCaretVisible((visible) => !visible), 500)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    context.fillStyle = '#000000'
    context.fillRect(0, 0, 640, 375)
    context.font = '12px "Fixedsys Bitmap", "Fixedsys", monospace'
    context.textBaseline = 'top'
    context.fillStyle = '#c0c0c0'
    lines.forEach((line, row) => {
      context.fillText(line, 0, row * 15)
    })
    if (caretVisible && !waiting)
      context.fillRect(((prefix.length + input.length) % 80) * 8, (lines.length - 1) * 15 + 13, 8, 2)
  }, [lines, prefix, input, caretVisible, waiting])
  const submit = () => {
    if (/^win(?:\.com)?\s*$/i.test(input.trim())) {
      onWindows()
      return
    }
    const result = execute(session, fsStore.get(), input, Date.now())
    for (const action of result.actions) fsStore.dispatch(action)
    if (result.effects.some((effect) => effect.kind === 'exit')) {
      onWindows()
      return
    }
    if (input.trim() && session.pending.kind === 'ready')
      setHistory((previous) => [...previous, input].slice(-50))
    setHistoryAt(null)
    setSession(result.session)
    const output = result.effects.length
      ? [...result.output, 'This program requires Microsoft Windows.']
      : result.output
    setScreen(
      print(result.clear ? [] : [...screen.lines, ...wrap([prefix + input])], output, result.paginate),
    )
    setInput('')
  }
  return (
    <div
      data-dos-session
      className="absolute inset-0 bg-black cursor-none"
      onPointerDown={() => field.current?.focus()}
    >
      <canvas
        ref={canvas}
        width={640}
        height={375}
        className="block w-full h-full pixelated"
        aria-label="MS-DOS display"
      />
      <pre className="sr-only" role="log" aria-label="MS-DOS screen">
        {lines.join('\n')}
      </pre>
      <input
        ref={field}
        aria-label="MS-DOS command"
        className="absolute left-0 top-0 w-px h-px opacity-0"
        autoComplete="off"
        spellCheck={false}
        value={input}
        maxLength={127}
        onBlur={() => field.current?.focus()}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (waiting) {
            event.preventDefault()
            setScreen(
              event.key === 'Escape' || (event.ctrlKey && event.key.toLowerCase() === 'c')
                ? { lines: screen.lines, queue: [] }
                : nextPage(screen, event.key === 'Enter'),
            )
          } else if (event.key === 'Enter') {
            event.preventDefault()
            submit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            setInput('')
          } else if (event.ctrlKey && event.key.toLowerCase() === 'c') {
            event.preventDefault()
            setInput('')
            setSession({ ...session, pending: { kind: 'ready' } })
            setScreen({ lines: [...screen.lines, `${prefix}${input}^C`].slice(-(ROWS - 1)), queue: [] })
          } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            if (!history.length) return
            if (historyAt === null) draft.current = input
            const at = Math.max(
              0,
              Math.min(history.length, (historyAt ?? history.length) + (event.key === 'ArrowUp' ? -1 : 1)),
            )
            setHistoryAt(at)
            setInput(history[at] ?? draft.current)
          }
        }}
      />
    </div>
  )
}
