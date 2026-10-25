import { type CSSProperties, type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fsStore, useFs } from '../../fs/store'
import { WINDOWS_DIR } from '../../fs/types'
import { useKeyDown } from '../../shell/context'
import { launch, openNode, windowsStore } from '../../shell/system'
import type { AppManifest, AppProps } from '../../shell/types'
import { AboutDialog, MessageBox } from '../../ui'
import { ConsoleMenu, type ConsoleMenuItem } from './ConsoleMenu'
import { dosIcon, dosSmallIcon, toolbarIcons } from './icons'
import { BANNER, execute, newSession, prompt } from './interpreter'
import { FONTS, Properties, type Settings } from './Properties'
import { type Cell, COLUMNS, type Mark, markedText, nextPage, print, ROWS, type Screen, wrap } from './screen'
import './console.css'

const SCREEN_ROWS = Array.from({ length: ROWS }, (_, row) => row)

function DosPrompt({ window: api, args }: AppProps) {
  const filesystem = useFs((state) => state)
  const [session, setSession] = useState(() => newSession(args.folder ?? WINDOWS_DIR))
  const [screen, setScreen] = useState<Screen>({ lines: BANNER, queue: [] })
  const [input, setInput] = useState('')
  const [caret, setCaret] = useState(0)
  const [settings, setSettings] = useState<Settings>({ font: 1, blink: true, toolbar: true })
  const [full, setFull] = useState(false)
  const [viewport, setViewport] = useState({ width: innerWidth, height: innerHeight })
  const [mark, setMark] = useState<Mark | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [dialog, setDialog] = useState<'none' | 'properties' | 'help' | 'about'>('none')
  const [error, setError] = useState('')
  const commandInput = useRef<HTMLInputElement>(null)
  const consoleRef = useRef<HTMLDivElement>(null)
  const history = useRef<string[]>([])
  const historyPosition = useRef<number | null>(null)
  const draft = useRef('')
  const dragging = useRef(false)
  const clipboard = useRef('')
  const font = FONTS[settings.font] ?? FONTS[1]
  const fullVisible = full && api.focused && !api.minimized && dialog === 'none' && !error
  const waiting = screen.queue.length > 0
  const prefix = session.pending.kind === 'ready' ? prompt(session, filesystem, Date.now()) : ''
  const commandLines = wrap([`${prefix}${input}${(prefix.length + input.length) % COLUMNS === 0 ? ' ' : ''}`])
  const visible = waiting ? [...screen.lines, '-- More --'] : [...screen.lines, ...commandLines].slice(-ROWS)
  const caretIndex = prefix.length + caret
  const cursorRow =
    Math.min(screen.lines.length, ROWS - commandLines.length) + Math.floor(caretIndex / COLUMNS)
  const cursorColumn = caretIndex % COLUMNS
  const style: CSSProperties & { '--dos-cell': string; '--dos-row': string; '--dos-font-size': string } = {
    '--dos-cell': `${font.width}px`,
    '--dos-row': `${font.height}px`,
    '--dos-font-size': `${font.size}px`,
    transform: fullVisible
      ? `scale(${viewport.width / (font.width * COLUMNS)}, ${viewport.height / (font.height * ROWS)})`
      : undefined,
  }

  useEffect(() => {
    const resize = () => setViewport({ width: innerWidth, height: innerHeight })
    addEventListener('resize', resize)
    return () => removeEventListener('resize', resize)
  }, [])
  useLayoutEffect(() => {
    if (api.focused && !api.minimized && dialog === 'none' && !menu && !error)
      commandInput.current?.focus({ preventScroll: !fullVisible })
  }, [api.focused, api.minimized, dialog, menu, error, fullVisible])
  useEffect(() => {
    if (!api.focused) setMenu(null)
  }, [api.focused])

  const editLine = (value: string) => {
    setInput(value.slice(0, 127))
    setCaret(Math.min(value.length, 127))
    requestAnimationFrame(() => {
      commandInput.current?.focus()
      commandInput.current?.setSelectionRange(Math.min(value.length, 127), Math.min(value.length, 127))
    })
  }
  const submit = () => {
    const result = execute(session, fsStore.get(), input, Date.now())
    for (const action of result.actions) fsStore.dispatch(action)
    if (session.pending.kind === 'ready' && input.trim()) {
      history.current = [...history.current, input].slice(-50)
    }
    historyPosition.current = null
    draft.current = ''
    setSession(result.session)
    setScreen(
      print(
        result.clear ? [] : [...screen.lines, ...wrap([`${prefix}${input}`])],
        result.output,
        result.paginate,
      ),
    )
    setInput('')
    setCaret(0)
    for (const effect of result.effects) {
      if (effect.kind === 'exit') api.close()
      else if (effect.kind === 'launch') launch(effect.app, effect.args)
      else openNode(effect.id)
    }
  }
  const cancel = () => {
    setSession({ ...session, pending: { kind: 'ready' } })
    setScreen({
      lines: [...screen.lines, `${waiting ? '' : prefix + input}^C`].slice(-(ROWS - 1)),
      queue: [],
    })
    editLine('')
    historyPosition.current = null
    setMark(null)
  }
  const copy = async () => {
    if (!mark) return
    const text = markedText(visible, mark)
    clipboard.current = text
    try {
      await navigator.clipboard.writeText(text)
      setMark(null)
      commandInput.current?.focus()
    } catch {
      setError('The Clipboard is not available. Try copying the selection again.')
    }
  }
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const value = text.replace(/[\r\n]+/g, ' ')
      editLine(input.slice(0, caret) + value + input.slice(commandInput.current?.selectionEnd ?? caret))
    } catch {
      if (clipboard.current)
        editLine(input.slice(0, caret) + clipboard.current.replace(/[\r\n]+/g, ' ') + input.slice(caret))
      else setError('The Clipboard is not available. You can paste text with Shift+Insert or Ctrl+V.')
    }
  }
  const markText = () => setMark({ anchor: { row: 0, column: 0 }, end: { row: 0, column: 0 } })
  const properties = () => {
    setFull(false)
    setDialog('properties')
  }
  const toggleFull = () => {
    setMenu(null)
    setFull(!full)
  }
  const background = () => {
    setFull(false)
    windowsStore.dispatch({ type: 'minimize', id: api.id })
  }
  const tools = [
    { label: 'Mark', action: markText, pressed: Boolean(mark) },
    { label: 'Copy', action: () => void copy(), disabled: !mark },
    { label: 'Paste', action: () => void paste(), disabled: waiting || session.pending.kind !== 'ready' },
    { label: 'Full Screen', action: toggleFull },
    { label: 'Properties', action: properties },
    { label: 'Background', action: background },
  ] satisfies {
    label: keyof typeof toolbarIcons
    action: () => void
    pressed?: boolean
    disabled?: boolean
  }[]
  const menuItems: ConsoleMenuItem[] = [
    { label: '&Mark', select: markText },
    { label: '&Copy', select: () => void copy(), disabled: !mark, shortcut: 'Enter' },
    { label: '&Paste', select: () => void paste(), disabled: waiting, shortcut: 'Shift+Ins' },
    {
      label: '&Toolbar',
      checked: settings.toolbar,
      select: () => setSettings({ ...settings, toolbar: !settings.toolbar }),
    },
    { label: '&Full Screen', checked: full, select: toggleFull, shortcut: 'Alt+Enter' },
    { label: 'P&roperties', select: properties },
    { label: '&Background', select: background },
    {
      label: '&Help',
      select: () => {
        setFull(false)
        setDialog('help')
      },
      shortcut: 'F1',
    },
    {
      label: '&About MS-DOS Prompt',
      select: () => {
        setFull(false)
        setDialog('about')
      },
    },
  ]

  useKeyDown((event) => {
    if (api.minimized || dialog !== 'none' || error || menu) return
    if (event.altKey && event.key === 'Enter') {
      event.preventDefault()
      toggleFull()
      return
    }
    if (event.key === 'F1') {
      event.preventDefault()
      setFull(false)
      setDialog('help')
      return
    }
    if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
      event.preventDefault()
      const rect = consoleRef.current?.getBoundingClientRect()
      setMenu({ x: rect?.left ?? 0, y: rect?.top ?? 0 })
      return
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'c') {
      event.preventDefault()
      if (mark) void copy()
      else cancel()
      return
    }
    if (mark) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMark(null)
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        void copy()
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault()
        const end = {
          row: Math.max(
            0,
            Math.min(
              ROWS - 1,
              mark.end.row + (event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0),
            ),
          ),
          column: Math.max(
            0,
            Math.min(
              COLUMNS - 1,
              mark.end.column + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0),
            ),
          ),
        }
        setMark({ anchor: event.shiftKey ? mark.anchor : end, end })
      }
      return
    }
    if (waiting) {
      if (!event.altKey && !event.ctrlKey && !['Shift', 'Control', 'Alt', 'Tab'].includes(event.key)) {
        event.preventDefault()
        if (event.key === 'Escape' || event.key.toLowerCase() === 'q') cancel()
        else setScreen(nextPage(screen, event.key === 'Enter'))
      }
      return
    }
    if (event.target !== commandInput.current) return
    if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      editLine('')
      historyPosition.current = null
    } else if (event.key === 'F3') {
      event.preventDefault()
      const previous = history.current.at(-1) ?? ''
      editLine(input + previous.slice(input.length))
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      if (!history.current.length || session.pending.kind !== 'ready') return
      if (historyPosition.current === null) {
        if (event.key === 'ArrowDown') return
        draft.current = input
      }
      const position = Math.max(
        0,
        Math.min(
          history.current.length,
          (historyPosition.current ?? history.current.length) + (event.key === 'ArrowUp' ? -1 : 1),
        ),
      )
      historyPosition.current = position === history.current.length ? null : position
      editLine(history.current[position] ?? draft.current)
    } else if (event.shiftKey && event.key === 'Insert') {
      event.preventDefault()
      void paste()
    }
  })

  const cellAt = (event: PointerEvent<HTMLDivElement>): Cell => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      row: Math.max(0, Math.min(ROWS - 1, Math.floor((event.clientY - bounds.top) / (bounds.height / ROWS)))),
      column: Math.max(
        0,
        Math.min(COLUMNS - 1, Math.floor((event.clientX - bounds.left) / (bounds.width / COLUMNS))),
      ),
    }
  }
  const consoleElement = (
    <div
      ref={consoleRef}
      role="application"
      aria-label="MS-DOS console"
      className="dos-screen"
      style={style}
      onContextMenu={(event) => {
        event.preventDefault()
        setMenu({ x: event.clientX, y: event.clientY })
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        commandInput.current?.focus()
        if (!mark) return
        event.preventDefault()
        const cell = cellAt(event)
        setMark({ anchor: cell, end: cell })
        dragging.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (dragging.current && mark) setMark({ ...mark, end: cellAt(event) })
      }}
      onPointerUp={() => {
        dragging.current = false
      }}
      onPointerCancel={() => {
        dragging.current = false
      }}
    >
      <pre role="log" aria-label="MS-DOS screen" aria-live="polite">
        {mark
          ? SCREEN_ROWS.map((row) => {
              const line = visible[row] ?? ''
              const top = Math.min(mark.anchor.row, mark.end.row)
              const bottom = Math.max(mark.anchor.row, mark.end.row)
              const left = Math.min(mark.anchor.column, mark.end.column)
              const right = Math.max(mark.anchor.column, mark.end.column)
              const text = line.padEnd(COLUMNS)
              return (
                <span key={row}>
                  {row >= top && row <= bottom ? (
                    <>
                      {text.slice(0, left)}
                      <span className="dos-mark">{text.slice(left, right + 1)}</span>
                      {text.slice(right + 1)}
                    </>
                  ) : (
                    line
                  )}
                  {row < ROWS - 1 ? '\n' : ''}
                </span>
              )
            })
          : visible.join('\n')}
      </pre>
      <input
        ref={commandInput}
        aria-label="MS-DOS command line"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={input}
        maxLength={127}
        readOnly={waiting || Boolean(mark)}
        style={{ left: cursorColumn * font.width, top: cursorRow * font.height }}
        onChange={(event) => {
          setInput(event.target.value)
          setCaret(event.target.selectionStart ?? event.target.value.length)
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
        onPaste={(event) => {
          event.preventDefault()
          if (!waiting && !mark)
            editLine(
              input.slice(0, caret) +
                event.clipboardData.getData('text').replace(/[\r\n]+/g, ' ') +
                input.slice(event.currentTarget.selectionEnd ?? caret),
            )
        }}
      />
      {api.focused && !api.minimized && !mark && !waiting && (
        <span
          aria-hidden="true"
          className={`dos-caret ${settings.blink ? 'dos-caret-blink' : ''}`}
          style={{ left: cursorColumn * font.width, top: (cursorRow + 1) * font.height - 2 }}
        />
      )}
    </div>
  )

  return (
    <div className="dos-app">
      {settings.toolbar && (
        <div
          role="toolbar"
          aria-label="MS-DOS toolbar"
          className="dos-toolbar"
          onContextMenu={(event) => {
            event.preventDefault()
            setMenu({ x: event.clientX, y: event.clientY })
          }}
        >
          <select
            aria-label="Font size"
            value={settings.font}
            className="bevel-sunken"
            onChange={(event) => setSettings({ ...settings, font: Number(event.target.value) })}
          >
            {FONTS.map((font, index) => (
              <option key={font.label} value={index}>
                {font.label}
              </option>
            ))}
          </select>
          {tools.map((tool) => (
            <button
              key={tool.label}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={tool.pressed}
              disabled={tool.disabled}
              onClick={tool.action}
              className={`dos-tool ${tool.pressed ? 'bevel-pressed' : 'bevel-raised'}`}
            >
              <img src={toolbarIcons[tool.label]} alt="" />
            </button>
          ))}
        </div>
      )}
      <div className="dos-viewport">{!fullVisible && consoleElement}</div>
      {fullVisible &&
        createPortal(
          <section className="dos-fullscreen" aria-label="Full-screen MS-DOS Prompt">
            {consoleElement}
          </section>,
          document.body,
        )}
      {menu && <ConsoleMenu at={menu} items={menuItems} onClose={() => setMenu(null)} />}
      {dialog === 'properties' && (
        <Properties
          settings={settings}
          onApply={(settings, fullscreen) => {
            setSettings(settings)
            setFull(fullscreen)
          }}
          onClose={() => setDialog('none')}
        />
      )}
      {dialog === 'about' && (
        <AboutDialog app="MS-DOS Prompt" icon={dosIcon} onClose={() => setDialog('none')} />
      )}
      {dialog === 'help' && (
        <MessageBox
          title="MS-DOS Prompt Help"
          buttons={['OK']}
          icon="info"
          message={
            'Type HELP for a list of commands, or HELP followed by a command name.\n\nUp and Down recall commands. F3 repeats the last command. Esc clears the line. Ctrl+C cancels a command.\n\nAlt+Enter switches between a window and full screen. Right-click or press Shift+F10 for the menu and toolbar setting.\n\nMark selects a rectangle of text. Enter copies it. Shift+Insert pastes.\n\nType EXIT to close this window.'
          }
          onClose={() => setDialog('none')}
        />
      )}
      {error && (
        <MessageBox
          title="MS-DOS Prompt"
          message={error}
          icon="warning"
          buttons={['OK']}
          onClose={() => setError('')}
        />
      )}
    </div>
  )
}

export const app: AppManifest = {
  id: 'dosprompt',
  title: 'MS-DOS Prompt',
  exe: 'COMMAND.COM',
  icon: dosIcon,
  smallIcon: dosSmallIcon,
  startMenu: [],
  window: { kind: 'resizable', width: 640, height: 428, minWidth: 320, minHeight: 200 },
  component: DosPrompt,
}
