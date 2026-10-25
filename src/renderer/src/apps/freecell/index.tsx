import { useEffect, useRef, useState } from 'react'
import { useKeyDown } from '../../shell/context'
import { launch } from '../../shell/system'
import type { AppManifest, AppProps } from '../../shell/types'
import { playSound } from '../../system/sound'
import { MessageBox } from '../../ui'
import { cardImage, cardName, slotImage } from '../solitaire/cards'
import { icon, kingLeft, kingRight, smallIcon } from './art'
import { About, MoveColumn, OptionsDialog, SelectGame, StatisticsDialog } from './Dialogs'
import {
  CELLS,
  COLUMNS,
  canMove,
  type GameNumber,
  hasLegalMove,
  movableColumn,
  move,
  newGame,
  randomGameNumber,
  type Source,
  sourceCards,
  type Target,
  undo,
} from './game'
import { Menu } from './Menu'
import { EMPTY_STATISTICS, loadPreferences, recordResult, savePreferences } from './preferences'
import './freecell.css'

type Pending = { readonly kind: 'deal'; readonly number: GameNumber } | { readonly kind: 'exit' }
type Modal =
  | {
      readonly kind:
        | 'none'
        | 'select'
        | 'options'
        | 'statistics'
        | 'clear'
        | 'about'
        | 'illegal'
        | 'won'
        | 'blocked'
    }
  | { readonly kind: 'abandon'; readonly pending: Pending }
  | { readonly kind: 'column'; readonly source: Source; readonly target: Target }

function FreeCell({ window: appWindow }: AppProps) {
  const [game, setGame] = useState(() => newGame(randomGameNumber()))
  const [preferences, setPreferences] = useState(loadPreferences)
  const [session, setSession] = useState({ won: 0, lost: 0 })
  const [selection, setSelection] = useState<Source | null>(null)
  const [modal, setModal] = useState<Modal>({ kind: 'none' })
  const [look, setLook] = useState<'left' | 'right'>('left')
  const board = useRef<HTMLDivElement>(null)
  const closeResult = useRef<((closed: boolean) => void) | null>(null)
  const position = game.position
  const closeDialog = () => {
    setModal({ kind: 'none' })
    closeResult.current?.(false)
    closeResult.current = null
  }
  const record = (won: boolean) => {
    const saved = loadPreferences()
    const next = { ...saved, statistics: recordResult(saved.statistics, won) }
    savePreferences(next)
    setPreferences(next)
    setSession((session) => ({ won: session.won + Number(won), lost: session.lost + Number(!won) }))
  }
  const perform = (pending: Pending) => {
    if (pending.kind === 'exit') {
      closeResult.current?.(true)
      closeResult.current = null
      appWindow.close()
      return
    }
    setGame(newGame(pending.number))
    setSelection(null)
    closeDialog()
  }
  const request = (pending: Pending) => {
    if (game.phase === 'playing' && position.moves > 0) setModal({ kind: 'abandon', pending })
    else perform(pending)
  }
  const exit = () => request({ kind: 'exit' })
  useEffect(() =>
    appWindow.onCloseRequest(
      () =>
        new Promise<boolean>((resolve) => {
          closeResult.current = resolve
          exit()
        }),
    ),
  )
  useEffect(() => {
    appWindow.setTitle(`FreeCell Game #${game.number}`)
  }, [appWindow, game.number])

  const illegal = () => {
    setSelection(null)
    if (preferences.options.illegalMessages) {
      void playSound('chord')
      setModal({ kind: 'illegal' })
    }
  }
  const play = (source: Source, target: Target) => {
    const next = move(game, source, target)
    if (next === game) {
      illegal()
      return
    }
    setGame(next)
    setSelection(null)
    closeDialog()
    if (next.phase === 'won') {
      record(true)
      void playSound('tada')
      setModal({ kind: 'won' })
    } else if (!hasLegalMove(next.position)) setModal({ kind: 'blocked' })
  }
  const destination = (target: Target) => {
    if (!selection || modal.kind !== 'none' || game.phase === 'won') return
    let source = selection
    if (source.kind === 'column' && target.kind === 'column') {
      if (source.column === target.column) {
        setSelection(null)
        return
      }
      const column = position.columns[source.column] ?? []
      if (source.index === column.length - 1)
        source = movableColumn(position, source.column, target) ?? source
      if (
        position.columns[target.column]?.length === 0 &&
        sourceCards(position, source).length > 1 &&
        canMove(position, source, target) &&
        !preferences.options.quickPlay
      ) {
        setModal({ kind: 'column', source, target })
        return
      }
    }
    play(source, target)
  }
  const select = (source: Source) => {
    if (modal.kind !== 'none' || game.phase === 'won') return
    if (selection) {
      if (selection.kind === 'cell' && source.kind === 'cell' && selection.cell === source.cell)
        setSelection(null)
      else destination(source.kind === 'column' ? { kind: 'column', column: source.column } : source)
    } else if (sourceCards(position, source).length) setSelection(source)
    else illegal()
  }
  const quickMove = (source: Source) => {
    if (modal.kind !== 'none') return
    const home = CELLS.find((cell) => canMove(position, source, { kind: 'home', cell }))
    const cell = CELLS.find((cell) => canMove(position, source, { kind: 'cell', cell }))
    if (home !== undefined) play(source, { kind: 'home', cell: home })
    else if (cell !== undefined) play(source, { kind: 'cell', cell })
    else illegal()
  }
  const undoMove = () => {
    setGame(undo(game))
    setSelection(null)
    closeDialog()
  }
  useKeyDown((event) => {
    if (event.defaultPrevented || modal.kind !== 'none') return
    const shortcuts: Record<string, () => unknown> = {
      f1: () => launch('help', { book: 'freecell' }),
      f2: () => request({ kind: 'deal', number: randomGameNumber() }),
      f3: () => setModal({ kind: 'select' }),
      f4: () => setModal({ kind: 'statistics' }),
      f5: () => setModal({ kind: 'options' }),
      f10: undoMove,
    }
    const action = shortcuts[event.key.toLowerCase()]
    if (action && !event.altKey && !event.ctrlKey) {
      event.preventDefault()
      action()
    }
    if (event.key === 'Escape') setSelection(null)
  })

  const selected = (source: Source) =>
    selection?.kind === source.kind &&
    (source.kind === 'cell'
      ? selection.kind === 'cell' && selection.cell === source.cell
      : selection.kind === 'column' && selection.column === source.column && source.index >= selection.index)
  return (
    <div
      className="freecell flex h-full w-full flex-col"
      data-game-number={game.number}
      data-moves={position.moves}
      data-phase={game.phase}
    >
      <Menu
        enabled={modal.kind === 'none'}
        menus={[
          {
            label: '&Game',
            items: [
              {
                label: '&New Game',
                shortcut: 'F2',
                onSelect: () => request({ kind: 'deal', number: randomGameNumber() }),
              },
              { label: '&Select Game...', shortcut: 'F3', onSelect: () => setModal({ kind: 'select' }) },
              { label: '&Restart Game', onSelect: () => request({ kind: 'deal', number: game.number }) },
              'separator',
              { label: 'S&tatistics...', shortcut: 'F4', onSelect: () => setModal({ kind: 'statistics' }) },
              { label: '&Options...', shortcut: 'F5', onSelect: () => setModal({ kind: 'options' }) },
              'separator',
              {
                label: '&Undo',
                shortcut: 'F10',
                disabled: !game.previous || game.phase === 'won',
                onSelect: undoMove,
              },
              'separator',
              { label: 'E&xit', onSelect: exit },
            ],
          },
          {
            label: '&Help',
            items: [
              { label: '&Help Topics', shortcut: 'F1', onSelect: () => launch('help', { book: 'freecell' }) },
              'separator',
              { label: '&About FreeCell...', onSelect: () => setModal({ kind: 'about' }) },
            ],
          },
        ]}
      />
      <div
        ref={board}
        className="freecell-board"
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          setLook(event.clientX < bounds.left + bounds.width / 2 ? 'left' : 'right')
        }}
      >
        <div className="freecell-top">
          <fieldset className="freecell-cell-group" aria-label="Free cells">
            {CELLS.map((cell) => {
              const card = position.cells[cell]
              const source = { kind: 'cell', cell } as const
              return (
                <button
                  type="button"
                  key={cell}
                  className={`freecell-card ${selected(source) ? 'freecell-selected' : ''}`}
                  data-cell={cell}
                  aria-label={`Free cell ${cell + 1}${card ? `: ${cardName(card)}` : ', empty'}`}
                  aria-pressed={selected(source)}
                  onClick={() => (card ? select(source) : destination(source))}
                  onDoubleClick={() => {
                    if (card) quickMove(source)
                  }}
                >
                  <img
                    src={card ? cardImage(card) : slotImage}
                    width="71"
                    height="96"
                    alt=""
                    draggable={false}
                  />
                </button>
              )
            })}
          </fieldset>
          <img
            className="freecell-king"
            src={look === 'left' ? kingLeft : kingRight}
            data-look={look}
            width="32"
            height="36"
            alt="King"
            draggable={false}
          />
          <fieldset className="freecell-cell-group" aria-label="Home cells">
            {CELLS.map((cell) => {
              const card = position.homes[cell].at(-1)
              return (
                <button
                  type="button"
                  key={cell}
                  className="freecell-card"
                  data-home={cell}
                  data-count={position.homes[cell].length}
                  aria-label={`Home cell ${cell + 1}${card ? `: ${cardName(card)}` : ', empty'}`}
                  onClick={() => destination({ kind: 'home', cell })}
                >
                  <img
                    src={card ? cardImage(card) : slotImage}
                    width="71"
                    height="96"
                    alt=""
                    draggable={false}
                  />
                </button>
              )
            })}
          </fieldset>
        </div>
        <div
          className="freecell-columns"
          style={{
            minHeight: 96 + (Math.max(1, ...position.columns.map((column) => column.length)) - 1) * 22,
          }}
        >
          {COLUMNS.map((column) => (
            <div key={column} className="freecell-column" data-column={column}>
              <button
                type="button"
                className="freecell-empty"
                aria-label={`Column ${column + 1}, ${position.columns[column]?.length ? 'destination' : 'empty'}`}
                onClick={() => destination({ kind: 'column', column })}
              />
              {position.columns[column]?.map((card, index) => {
                const source: Source = { kind: 'column', column, index }
                return (
                  <button
                    type="button"
                    key={`${card.suit}-${card.rank}`}
                    data-card={`${card.rank}-${card.suit}`}
                    data-index={index}
                    className={`freecell-card freecell-tableau-card ${selected(source) ? 'freecell-selected' : ''}`}
                    style={{ top: index * 22 }}
                    aria-label={`${cardName(card)}, column ${column + 1}`}
                    aria-pressed={selected(source)}
                    onClick={() => select(source)}
                    onDoubleClick={() => quickMove(source)}
                    onKeyDown={(event) => {
                      const offsets: Record<string, [number, number]> = {
                        ArrowLeft: [-1, 0],
                        ArrowRight: [1, 0],
                        ArrowUp: [0, -1],
                        ArrowDown: [0, 1],
                      }
                      const offset = offsets[event.key]
                      if (!offset) return
                      event.preventDefault()
                      const nextColumn = Math.max(0, Math.min(7, column + offset[0]))
                      const nextIndex = Math.max(
                        0,
                        Math.min((position.columns[nextColumn]?.length ?? 1) - 1, index + offset[1]),
                      )
                      board.current
                        ?.querySelector<HTMLButtonElement>(
                          `[data-column="${nextColumn}"] [data-index="${nextIndex}"]`,
                        )
                        ?.focus()
                    }}
                  >
                    <img src={cardImage(card)} width="71" height="96" alt="" draggable={false} />
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="freecell-remaining">
          Cards Left: {52 - position.homes.reduce((sum, home) => sum + home.length, 0)}
        </div>
      </div>
      {modal.kind === 'select' && (
        <SelectGame
          number={game.number}
          onClose={closeDialog}
          onSelect={(number) => request({ kind: 'deal', number })}
        />
      )}
      {modal.kind === 'options' && (
        <OptionsDialog
          options={preferences.options}
          onClose={closeDialog}
          onApply={(options) => {
            const next = { ...loadPreferences(), options }
            setPreferences(next)
            savePreferences(next)
            closeDialog()
          }}
        />
      )}
      {modal.kind === 'statistics' && (
        <StatisticsDialog
          statistics={preferences.statistics}
          session={session}
          onClose={closeDialog}
          onClear={() => setModal({ kind: 'clear' })}
        />
      )}
      {modal.kind === 'clear' && (
        <MessageBox
          title="FreeCell"
          icon="question"
          message="Clear all statistics?"
          buttons={['Yes', 'No']}
          onClose={(result) => {
            if (result === 'Yes') {
              const next = { ...loadPreferences(), statistics: EMPTY_STATISTICS }
              savePreferences(next)
              setPreferences(next)
              setSession({ won: 0, lost: 0 })
            }
            setModal({ kind: 'statistics' })
          }}
        />
      )}
      {modal.kind === 'about' && <About onClose={closeDialog} />}
      {modal.kind === 'column' && (
        <MoveColumn
          onClose={() => {
            setSelection(null)
            closeDialog()
          }}
          onMove={(column) => {
            const source = modal.source
            play(
              !column && source.kind === 'column'
                ? { ...source, index: (position.columns[source.column]?.length ?? 1) - 1 }
                : source,
              modal.target,
            )
          }}
        />
      )}
      {modal.kind === 'illegal' && (
        <MessageBox
          title="FreeCell"
          icon="warning"
          message="That move is not allowed."
          buttons={['OK']}
          onClose={closeDialog}
        />
      )}
      {modal.kind === 'won' && (
        <MessageBox
          title="FreeCell"
          message={'Congratulations, you win!\nDo you want to play again?'}
          buttons={['Yes', 'No']}
          onClose={(result) => {
            if (result === 'Yes') perform({ kind: 'deal', number: randomGameNumber() })
            else closeDialog()
          }}
        />
      )}
      {modal.kind === 'blocked' && (
        <MessageBox
          title="FreeCell"
          icon="info"
          message={'There are no more legal moves.\nUndo the last move or start a new game.'}
          buttons={['Undo', 'New Game']}
          onClose={(result) => {
            if (result === 'Undo') undoMove()
            else if (result === 'New Game') {
              record(false)
              perform({ kind: 'deal', number: randomGameNumber() })
            } else closeDialog()
          }}
        />
      )}
      {modal.kind === 'abandon' && (
        <MessageBox
          title="FreeCell"
          icon="question"
          message={
            'This game is not finished.\nIf you quit now, it will count as a loss.\nDo you want to quit this game?'
          }
          buttons={['Yes', 'No']}
          onClose={(result) => {
            if (result === 'Yes') {
              record(false)
              perform(modal.pending)
            } else closeDialog()
          }}
        />
      )}
    </div>
  )
}

export const app: AppManifest = {
  id: 'freecell',
  title: 'FreeCell',
  exe: 'FREECELL.EXE',
  icon,
  smallIcon,
  startMenu: ['Accessories', 'Games'],
  window: { kind: 'resizable', width: 720, height: 460, minWidth: 640, minHeight: 410 },
  component: FreeCell,
}
