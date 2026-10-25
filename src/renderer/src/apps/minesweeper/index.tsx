import { useEffect, useId, useRef, useState } from 'react'
import { useKeyDown } from '../../shell/context'
import type { AppManifest, AppProps } from '../../shell/types'
import { Button, Dialog, MenuBar, TextBox } from '../../ui'
import { faces, flagIcon, largeMineIcon, mineIcon, wrongFlagIcon } from './art'
import {
  advanceTime,
  type BoardSize,
  chord,
  counterDigits,
  createGame,
  customSize,
  LEVEL_NAMES,
  LEVELS,
  type Level,
  mark,
  minesLeft,
  neighbors,
  reveal,
  seconds,
} from './game'
import { emptyRecords, loadPreferences, savePreferences } from './preferences'
import './minesweeper.css'

type AppDialog =
  | { kind: 'none' }
  | { kind: 'custom' }
  | { kind: 'scores' }
  | { kind: 'about' }
  | { kind: 'record'; level: Exclude<Level, 'custom'>; seconds: number }

const segments: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
}
const segmentShapes = {
  a: '2,0 10,0 8,2 4,2',
  b: '10,1 10,10 8,8 8,3',
  c: '10,12 10,21 8,19 8,14',
  d: '2,22 10,22 8,20 4,20',
  e: '1,12 3,14 3,19 1,21',
  f: '1,1 3,3 3,8 1,10',
  g: '2,11 4,10 8,10 10,11 8,12 4,12',
}

function Counter({ value, label }: { value: number; label: string }) {
  return (
    <output aria-label={`${label}: ${value}`} className="mine-counter">
      {[...counterDigits(value)].map((digit, index) => (
        <svg
          // biome-ignore lint/suspicious/noArrayIndexKey: each fixed display position owns its digit
          key={index}
          width="12"
          height="23"
          viewBox="0 0 12 23"
          aria-hidden="true"
          shapeRendering="crispEdges"
        >
          {Object.entries(segmentShapes).map(([segment, points]) => (
            <polygon
              key={segment}
              points={points}
              fill={segments[digit]?.includes(segment) ? '#ff0000' : '#400000'}
            />
          ))}
        </svg>
      ))}
    </output>
  )
}

function CustomDialog({
  size,
  onAccept,
  onClose,
}: {
  size: BoardSize
  onAccept: (size: BoardSize) => void
  onClose: () => void
}) {
  const id = useId()
  const [height, setHeight] = useState(String(size.height))
  const [width, setWidth] = useState(String(size.width))
  const [mines, setMines] = useState(String(size.mines))
  return (
    <Dialog title="Custom Field" onClose={onClose}>
      <form
        className="mine-custom"
        onSubmit={(event) => {
          event.preventDefault()
          onAccept(customSize({ height: Number(height), width: Number(width), mines: Number(mines) }))
        }}
      >
        <div className="mine-custom-fields">
          <label htmlFor={`${id}-height`}>
            Height:{' '}
            <TextBox
              id={`${id}-height`}
              aria-label="Height"
              value={height}
              onChange={(event) => setHeight(event.target.value)}
              inputMode="numeric"
              autoFocus
            />
          </label>
          <label htmlFor={`${id}-width`}>
            Width:{' '}
            <TextBox
              id={`${id}-width`}
              aria-label="Width"
              value={width}
              onChange={(event) => setWidth(event.target.value)}
              inputMode="numeric"
            />
          </label>
          <label htmlFor={`${id}-mines`}>
            Mines:{' '}
            <TextBox
              id={`${id}-mines`}
              aria-label="Mines"
              value={mines}
              onChange={(event) => setMines(event.target.value)}
              inputMode="numeric"
            />
          </label>
        </div>
        <div className="mine-dialog-buttons">
          <Button type="submit" isDefault>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}

function RecordDialog({
  level,
  onAccept,
}: {
  level: Exclude<Level, 'custom'>
  onAccept: (name: string) => void
}) {
  const [name, setName] = useState('Anonymous')
  return (
    <Dialog title="Fastest Time" onClose={() => onAccept(name)}>
      <form
        className="mine-record"
        onSubmit={(event) => {
          event.preventDefault()
          onAccept(name)
        }}
      >
        <p>
          You have the fastest time for {LEVEL_NAMES[level]} level.
          <br />
          Please enter your name.
        </p>
        <TextBox
          aria-label="Name"
          value={name}
          maxLength={32}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" isDefault>
          OK
        </Button>
      </form>
    </Dialog>
  )
}

function Minesweeper({ window: appWindow }: AppProps) {
  const [preferences, setPreferences] = useState(loadPreferences)
  const [game, setGame] = useState(() =>
    createGame(
      preferences.level === 'custom' ? preferences.custom : LEVELS[preferences.level],
      Math.floor(Math.random() * 4294967296),
    ),
  )
  const [dialog, setDialog] = useState<AppDialog>({ kind: 'none' })
  const [held, setHeld] = useState<{ index: number; chord: boolean } | null>(null)
  const gesture = useRef<{ chord: boolean; finished: boolean } | null>(null)
  const recorded = useRef(false)
  const board = useRef<HTMLFieldSetElement>(null)
  const [focusCell, setFocusCell] = useState(0)

  useEffect(() => savePreferences(preferences), [preferences])

  useEffect(() => {
    if (game.phase.kind !== 'running' || !appWindow.focused || appWindow.minimized || dialog.kind !== 'none')
      return
    let previous = performance.now()
    const timer = globalThis.setInterval(() => {
      const now = performance.now()
      const elapsed = now - previous
      previous = now
      setGame((current) => advanceTime(current, elapsed))
    }, 100)
    return () => globalThis.clearInterval(timer)
  }, [game.phase.kind, appWindow.focused, appWindow.minimized, dialog.kind])

  useEffect(() => {
    if (game.phase.kind !== 'won' || recorded.current) return
    recorded.current = true
    const level = preferences.level
    if (level !== 'custom' && seconds(game) < preferences.records[level].seconds) {
      setDialog({ kind: 'record', level, seconds: seconds(game) })
    }
  }, [game, preferences.level, preferences.records])

  useEffect(() => {
    const release = (event: MouseEvent) => {
      if (event.buttons !== 0) return
      gesture.current = null
      setHeld(null)
    }
    const cancel = () => {
      gesture.current = null
      setHeld(null)
    }
    globalThis.addEventListener('mouseup', release)
    globalThis.addEventListener('blur', cancel)
    return () => {
      globalThis.removeEventListener('mouseup', release)
      globalThis.removeEventListener('blur', cancel)
    }
  }, [])

  const newGame = (level = preferences.level, custom = preferences.custom) => {
    recorded.current = false
    gesture.current = null
    setHeld(null)
    setFocusCell(0)
    setDialog({ kind: 'none' })
    setPreferences((current) => ({ ...current, level, custom }))
    setGame(createGame(level === 'custom' ? custom : LEVELS[level], Math.floor(Math.random() * 4294967296)))
  }

  useKeyDown((event) => {
    if (event.key === 'F2' && dialog.kind === 'none') {
      event.preventDefault()
      newGame()
    }
  })

  const finished = game.phase.kind === 'won' || game.phase.kind === 'lost'
  const face =
    game.phase.kind === 'won' ? 'win' : game.phase.kind === 'lost' ? 'dead' : held ? 'surprised' : 'smile'
  const pressed = held?.chord ? neighbors(game.size, held.index) : held ? [held.index] : []
  const closeDialog = () => setDialog({ kind: 'none' })

  return (
    <div className={`minesweeper ${preferences.color ? '' : 'mine-monochrome'}`}>
      <MenuBar
        menus={[
          {
            label: '&Game',
            items: [
              { label: '&New', shortcut: 'F2', onSelect: () => newGame() },
              'separator',
              ...(['beginner', 'intermediate', 'expert'] satisfies Level[]).map((level) => ({
                label: `&${LEVEL_NAMES[level]}`,
                checked: preferences.level === level,
                onSelect: () => newGame(level),
              })),
              {
                label: '&Custom...',
                checked: preferences.level === 'custom',
                onSelect: () => setDialog({ kind: 'custom' }),
              },
              'separator',
              {
                label: '&Marks (?)',
                checked: preferences.marks,
                onSelect: () => setPreferences((current) => ({ ...current, marks: !current.marks })),
              },
              {
                label: 'Co&lor',
                checked: preferences.color,
                onSelect: () => setPreferences((current) => ({ ...current, color: !current.color })),
              },
              'separator',
              { label: '&Best Times...', onSelect: () => setDialog({ kind: 'scores' }) },
              'separator',
              { label: 'E&xit', onSelect: appWindow.close },
            ],
          },
          {
            label: '&Help',
            items: [{ label: '&About Minesweeper', onSelect: () => setDialog({ kind: 'about' }) }],
          },
        ]}
      />
      <div className="mine-frame">
        <div className="mine-panel">
          <Counter value={minesLeft(game)} label="Mines left" />
          <button
            type="button"
            className="mine-face"
            aria-label={`New game, ${face === 'win' ? 'sunglasses' : face} face`}
            onClick={() => newGame()}
          >
            <img src={faces[face]} alt="" width="16" height="16" />
          </button>
          <Counter value={seconds(game)} label="Time" />
        </div>
        <fieldset
          ref={board}
          aria-label={`${LEVEL_NAMES[preferences.level]} minefield, ${game.size.width} by ${game.size.height}`}
          className="mine-board"
          style={{ gridTemplateColumns: `repeat(${game.size.width}, 16px)` }}
          onContextMenu={(event) => event.preventDefault()}
          onMouseLeave={() => setHeld(null)}
        >
          {game.cells.map((cell, index) => {
            const lost = game.phase.kind === 'lost'
            const wrongFlag = lost && cell.cover === 'flag' && !cell.mine
            const showMine = lost && cell.mine && cell.cover !== 'flag'
            const open = cell.cover === 'open' || showMine || wrongFlag
            const down = !finished && pressed.includes(index) && cell.cover !== 'flag'
            const exploded = game.phase.kind === 'lost' && game.phase.exploded === index
            const label = wrongFlag
              ? 'wrong flag'
              : showMine
                ? 'mine'
                : cell.cover === 'open'
                  ? `${cell.adjacent || 'empty'}`
                  : cell.cover
            return (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: a cell is identified by its board position
                key={index}
                type="button"
                tabIndex={focusCell === index ? 0 : -1}
                aria-label={`Row ${Math.floor(index / game.size.width) + 1}, column ${(index % game.size.width) + 1}, ${label}`}
                className={`mine-cell ${open || down ? 'mine-open' : ''} ${exploded ? 'mine-exploded' : ''}`}
                data-number={cell.adjacent}
                data-cell={index}
                onFocus={() => setFocusCell(index)}
                onMouseDown={(event) => {
                  if (finished || dialog.kind !== 'none') return
                  const isChord = event.button === 1 || (event.buttons & 3) === 3
                  gesture.current = { chord: isChord || Boolean(gesture.current?.chord), finished: false }
                  if (event.button !== 2 || isChord) setHeld({ index, chord: gesture.current.chord })
                  if (event.button === 1) event.preventDefault()
                }}
                onMouseEnter={(event) => {
                  if (gesture.current && (event.buttons & 5) !== 0)
                    setHeld({ index, chord: gesture.current.chord })
                }}
                onMouseUp={(event) => {
                  const current = gesture.current
                  if (!current || current.finished || finished || dialog.kind !== 'none') return
                  current.finished = true
                  setHeld(null)
                  if (current.chord) setGame((game) => chord(game, index))
                  else if (event.button === 2) setGame((game) => mark(game, index, preferences.marks))
                  else if (event.button === 0) setGame((game) => reveal(game, index))
                }}
                onClick={(event) => {
                  if (event.detail === 0 && dialog.kind === 'none') setGame((game) => reveal(game, index))
                }}
                onKeyDown={(event) => {
                  if (dialog.kind !== 'none') return
                  if (event.key.toLowerCase() === 'f') {
                    event.preventDefault()
                    setGame((game) => mark(game, index, preferences.marks))
                  }
                  if (event.key.toLowerCase() === 'c') {
                    event.preventDefault()
                    setGame((game) => chord(game, index))
                  }
                  const offset = {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -game.size.width,
                    ArrowDown: game.size.width,
                  }[event.key]
                  if (offset !== undefined) {
                    event.preventDefault()
                    const next = Math.max(0, Math.min(game.cells.length - 1, index + offset))
                    const target = board.current?.children.item(next)
                    if (target instanceof HTMLButtonElement) target.focus()
                  }
                }}
              >
                {wrongFlag ? (
                  <img src={wrongFlagIcon} alt="" />
                ) : showMine ? (
                  <img src={mineIcon} alt="" />
                ) : cell.cover === 'flag' ? (
                  <img src={flagIcon} alt="" />
                ) : cell.cover === 'question' ? (
                  '?'
                ) : cell.cover === 'open' && cell.adjacent > 0 ? (
                  cell.adjacent
                ) : (
                  ''
                )}
              </button>
            )
          })}
        </fieldset>
      </div>
      {dialog.kind === 'custom' && (
        <CustomDialog size={game.size} onClose={closeDialog} onAccept={(size) => newGame('custom', size)} />
      )}
      {dialog.kind === 'record' && (
        <RecordDialog
          level={dialog.level}
          onAccept={(name) => {
            setPreferences((current) => ({
              ...current,
              records: {
                ...current.records,
                [dialog.level]: { seconds: dialog.seconds, name: name.trim() || 'Anonymous' },
              },
            }))
            closeDialog()
          }}
        />
      )}
      {dialog.kind === 'scores' && (
        <Dialog title="Fastest Mine Sweepers" onClose={closeDialog}>
          <div className="mine-scores">
            <table>
              <tbody>
                {Object.entries(preferences.records).map(([level, record]) => (
                  <tr key={level}>
                    <th>{level.charAt(0).toUpperCase() + level.slice(1)}:</th>
                    <td>{record.seconds} seconds</td>
                    <td>{record.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div>
              <Button onClick={() => setPreferences((current) => ({ ...current, records: emptyRecords() }))}>
                Reset Scores
              </Button>
              <Button isDefault onClick={closeDialog}>
                OK
              </Button>
            </div>
          </div>
        </Dialog>
      )}
      {dialog.kind === 'about' && (
        <Dialog title="About Minesweeper" onClose={closeDialog}>
          <div className="mine-about">
            <img src={largeMineIcon} alt="" width="32" height="32" />
            <div>
              <p>Minesweeper</p>
              <p>Windows 95</p>
              <p>Find all the mines without uncovering one.</p>
            </div>
            <Button isDefault onClick={closeDialog}>
              OK
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  )
}

export const app: AppManifest = {
  id: 'minesweeper',
  title: 'Minesweeper',
  icon: largeMineIcon,
  smallIcon: mineIcon,
  exe: 'WINMINE.EXE',
  startMenu: ['Accessories', 'Games'],
  desktopShortcut: true,
  window: { kind: 'fixed' },
  component: Minesweeper,
}
