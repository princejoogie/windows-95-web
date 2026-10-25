import { type CSSProperties, type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useKeyDown } from '../../shell/context'
import type { AppManifest, AppProps } from '../../shell/types'
import { Button, Checkbox, Dialog, GroupBox, MenuBar, Radio, StatusBar, StatusPane } from '../../ui'
import { Cascade } from './Cascade'
import { BACKS, type Back, backImage, cardImage, cardName, icon, smallIcon } from './cards'
import { proofDeal } from './fixtures'
import {
  type Action,
  type Card,
  canMove,
  canRecycle,
  FOUNDATION_SLOTS,
  type Game,
  gameReducer,
  newGame,
  type Options,
  type Source,
  seededRandom,
  sourceCards,
  type Target,
} from './game'
import './solitaire.css'
import { loadPreferences, type Preferences, savePreferences } from './preferences'

interface Drag {
  source: Source
  pointerId: number
  startX: number
  startY: number
  x: number
  y: number
  offsetX: number
  offsetY: number
  moving: boolean
}
const COLUMNS = [0, 1, 2, 3, 4, 5, 6] as const

function initialGame(preferences: Preferences): Game {
  if (import.meta.env.DEV) {
    const params = new URLSearchParams(location.search)
    const fixture = proofDeal(params.get('solitaireDeal') ?? '')
    if (fixture) return fixture
    const seed = params.get('solitaireSeed')
    if (seed !== null && Number.isFinite(Number(seed)))
      return newGame(preferences.options, seededRandom(Number(seed)), preferences.vegasBalance)
  }
  return newGame(preferences.options, Math.random, preferences.vegasBalance)
}

function OptionsDialog({
  options,
  onApply,
  onClose,
}: {
  options: Options
  onApply: (options: Options) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(options)
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    form.current?.querySelector<HTMLInputElement>('input[name=solitaire-draw]:checked')?.focus()
  }, [])
  return (
    <Dialog title="Options" onClose={onClose} className="w-[310px]">
      <form
        ref={form}
        className="flex flex-col gap-3 p-3"
        onSubmit={(event) => {
          event.preventDefault()
          onApply(draft)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
            event.preventDefault()
            onApply(draft)
          }
          if (event.altKey) {
            const input = form.current?.querySelector<HTMLInputElement>(
              `input[data-shortcut="${event.key.toLowerCase()}"]:not(:disabled)`,
            )
            if (input) {
              event.preventDefault()
              event.stopPropagation()
              input.focus()
              input.click()
            }
          }
        }}
      >
        <div className="flex gap-3">
          <GroupBox label="Draw" className="flex flex-1 flex-col gap-2">
            <Radio
              name="solitaire-draw"
              label={
                <>
                  Draw <u>o</u>ne
                </>
              }
              data-shortcut="o"
              checked={draft.draw === 1}
              onChange={() => setDraft({ ...draft, draw: 1 })}
            />
            <Radio
              name="solitaire-draw"
              label={
                <>
                  Draw t<u>h</u>ree
                </>
              }
              data-shortcut="h"
              checked={draft.draw === 3}
              onChange={() => setDraft({ ...draft, draw: 3 })}
            />
          </GroupBox>
          <GroupBox label="Scoring" className="flex flex-1 flex-col gap-2">
            <Radio
              name="solitaire-scoring"
              label={
                <>
                  <u>S</u>tandard
                </>
              }
              data-shortcut="s"
              checked={draft.scoring === 'standard'}
              onChange={() => setDraft({ ...draft, scoring: 'standard' })}
            />
            <Radio
              name="solitaire-scoring"
              label={
                <>
                  <u>V</u>egas
                </>
              }
              data-shortcut="v"
              checked={draft.scoring === 'vegas'}
              onChange={() => setDraft({ ...draft, scoring: 'vegas' })}
            />
            <Radio
              name="solitaire-scoring"
              label={
                <>
                  <u>N</u>one
                </>
              }
              data-shortcut="n"
              checked={draft.scoring === 'none'}
              onChange={() => setDraft({ ...draft, scoring: 'none' })}
            />
          </GroupBox>
        </div>
        <Checkbox
          label={
            <>
              <u>T</u>imed game
            </>
          }
          data-shortcut="t"
          checked={draft.timed}
          onChange={(event) => setDraft({ ...draft, timed: event.target.checked })}
        />
        <Checkbox
          label={
            <>
              Status <u>b</u>ar
            </>
          }
          data-shortcut="b"
          checked={draft.statusBar}
          onChange={(event) => setDraft({ ...draft, statusBar: event.target.checked })}
        />
        <Checkbox
          label={
            <>
              Out<u>l</u>ine dragging
            </>
          }
          data-shortcut="l"
          checked={draft.outline}
          onChange={(event) => setDraft({ ...draft, outline: event.target.checked })}
        />
        <Checkbox
          label={
            <>
              <u>K</u>eep score
            </>
          }
          data-shortcut="k"
          checked={draft.keepScore}
          disabled={draft.scoring !== 'vegas'}
          className={draft.scoring !== 'vegas' ? 'text-embossed' : ''}
          onChange={(event) => setDraft({ ...draft, keepScore: event.target.checked })}
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="submit" isDefault>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}

function DeckDialog({
  back,
  onApply,
  onClose,
}: {
  back: Back
  onApply: (back: Back) => void
  onClose: () => void
}) {
  const [choice, setChoice] = useState(back)
  const gallery = useRef<HTMLDivElement>(null)
  useEffect(() => {
    gallery.current?.querySelector<HTMLInputElement>('input:checked')?.focus()
  }, [])
  return (
    <Dialog title="Select Card Back" onClose={onClose}>
      <form
        className="p-3"
        onSubmit={(event) => {
          event.preventDefault()
          onApply(choice)
        }}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            gallery.current?.contains(event.target instanceof Node ? event.target : null)
          ) {
            event.preventDefault()
            onApply(choice)
          }
        }}
      >
        <div
          ref={gallery}
          role="radiogroup"
          aria-label="Card backs"
          className="grid grid-cols-6 gap-2"
          onKeyDown={(event) => {
            const offsets: Record<string, number> = {
              ArrowLeft: -1,
              ArrowRight: 1,
              ArrowUp: -6,
              ArrowDown: 6,
            }
            const offset = offsets[event.key]
            if (offset === undefined) return
            event.preventDefault()
            const index = (BACKS.indexOf(choice) + offset + BACKS.length) % BACKS.length
            const next = BACKS[index]
            if (next) setChoice(next)
            gallery.current?.querySelectorAll<HTMLInputElement>('input')[index]?.focus()
          }}
        >
          {BACKS.map((name) => (
            <label
              key={name}
              title={name}
              className={`solitaire-back p-1 outline-none ${choice === name ? 'bevel-sunken bg-select' : 'bevel-raised'}`}
            >
              <input
                type="radio"
                name="solitaire-back"
                aria-label={name}
                value={name}
                checked={choice === name}
                tabIndex={choice === name ? 0 : -1}
                onChange={() => setChoice(name)}
              />
              <img src={backImage(name)} width="71" height="96" alt={name} draggable={false} />
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-3">
          <Button type="submit" isDefault>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}

function Solitaire({ window }: AppProps) {
  const [preferences] = useState(loadPreferences)
  const [game, setGame] = useState(() => initialGame(preferences))
  const [back, setBack] = useState<Back>(preferences.back)
  const vegasBalance = useRef(preferences.vegasBalance)
  const [dialog, setDialog] = useState<'options' | 'deck' | 'about' | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [cascadeStopped, setCascadeStopped] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const suppressClick = useRef(false)
  const [size, setSize] = useState({ width: 620, height: 400 })
  const active = window.focused && !window.minimized && dialog === null
  const dispatch = (action: Action) => setGame((current) => gameReducer(current, action))
  const deal = () => {
    setGame((current) =>
      newGame(
        current.options,
        Math.random,
        current.options.scoring === 'vegas' ? current.score : vegasBalance.current,
      ),
    )
    setCascadeStopped(false)
    setDrag(null)
  }
  useKeyDown((event) => {
    if (dialog) return
    if (event.key === 'F2') {
      event.preventDefault()
      deal()
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      dispatch({ type: 'undo' })
    }
    if (event.key === 'Escape') {
      setDrag(null)
      setCascadeStopped(true)
    }
  })
  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    const observer = new ResizeObserver(() =>
      setSize({ width: element.clientWidth, height: element.clientHeight }),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!active || !game.started || game.phase !== 'playing' || !game.options.timed) return
    const interval = setInterval(() => setGame((current) => gameReducer(current, { type: 'tick' })), 1000)
    return () => clearInterval(interval)
  }, [active, game.started, game.phase, game.options.timed])
  useEffect(() => {
    if (!active) setDrag(null)
  }, [active])
  useEffect(() => {
    if (game.options.scoring === 'vegas') vegasBalance.current = game.score
    savePreferences({ options: game.options, back, vegasBalance: vegasBalance.current })
  }, [game.options, game.score, back])

  const scale = Math.max(0.75, Math.min(size.width / 620, size.height / 360, 1.75))
  const cardWidth = 71 * scale
  const cardHeight = 96 * scale
  const margin = 12 * scale
  const gap = (size.width - margin * 2 - cardWidth) / 6
  const tableauY = 130 * scale
  const columnX = (column: number) => margin + column * gap
  const offsets = game.tableau.map((column) => {
    const natural = column.slice(0, -1).reduce((sum, card) => sum + (card.faceUp ? 21 : 9) * scale, 0)
    const compression = natural
      ? Math.min(1, Math.max(0, size.height - tableauY - cardHeight - margin) / natural)
      : 1
    let top = tableauY
    return column.map((card) => {
      const value = top
      top += (card.faceUp ? 21 : 9) * scale * compression
      return value
    })
  })
  const rect = (x: number, y: number): CSSProperties => ({
    left: x,
    top: y,
    width: cardWidth,
    height: cardHeight,
  })
  const autoFoundation = (source: Source) => {
    const pile = FOUNDATION_SLOTS.find((pile) => canMove(game, source, { kind: 'foundation', pile }))
    if (pile !== undefined) dispatch({ type: 'move', source, target: { kind: 'foundation', pile } })
  }
  const begin = (event: PointerEvent<HTMLButtonElement>, source: Source) => {
    if (event.button !== 0 || game.phase !== 'playing' || !sourceCards(game, source).length) return
    const board = root.current
    if (!board) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    const bounds = board.getBoundingClientRect()
    const cardBounds = event.currentTarget.getBoundingClientRect()
    event.currentTarget.setPointerCapture(event.pointerId)
    suppressClick.current = false
    setDrag({
      source,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      offsetX: event.clientX - cardBounds.left,
      offsetY: event.clientY - cardBounds.top,
      moving: false,
    })
  }
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return
    if (drag.moving) {
      suppressClick.current = true
      const bounds = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const y = event.clientY - bounds.top
      let target: Target | null = null
      for (let column = 0; column < 7; column++) {
        if (x < columnX(column) || x > columnX(column) + cardWidth) continue
        if (y >= tableauY && y < size.height) target = { kind: 'tableau', column }
        const pile = FOUNDATION_SLOTS[column - 3]
        if (pile !== undefined && y >= margin && y <= margin + cardHeight)
          target = { kind: 'foundation', pile }
      }
      if (target) dispatch({ type: 'move', source: drag.source, target })
    }
    setDrag(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const hidden = (source: Source) => {
    if (!drag?.moving || drag.source.kind !== source.kind) return false
    if (source.kind === 'waste') return true
    if (source.kind === 'foundation')
      return drag.source.kind === 'foundation' && drag.source.pile === source.pile
    return (
      drag.source.kind === 'tableau' &&
      source.column === drag.source.column &&
      source.index >= drag.source.index
    )
  }
  const cardButton = (card: Card, source: Source, x: number, y: number, faceUp = true) => (
    <button
      key={`${card.suit}-${card.rank}`}
      type="button"
      className="solitaire-card"
      data-card={`${card.suit}-${card.rank}`}
      data-pile={source.kind === 'tableau' ? `tableau-${source.column}` : source.kind}
      aria-label={faceUp ? cardName(card) : 'Face-down card'}
      style={{ ...rect(x, y), visibility: hidden(source) ? 'hidden' : 'visible' }}
      onPointerDown={(event) => {
        if (faceUp) begin(event, source)
      }}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false
          return
        }
        if (!faceUp && source.kind === 'tableau') dispatch({ type: 'flip', column: source.column })
      }}
      onKeyDown={(event) => {
        if (faceUp && event.key === 'Enter') {
          event.preventDefault()
          autoFoundation(source)
        }
      }}
      onDoubleClick={() => {
        if (faceUp && !suppressClick.current) autoFoundation(source)
      }}
    >
      <img src={faceUp ? cardImage(card) : backImage(back)} alt="" draggable={false} />
    </button>
  )
  const fan = Math.min(game.waste.length, Math.max(1, game.wasteFan))
  return (
    <div className="solitaire h-full w-full flex flex-col min-h-0">
      <MenuBar
        menus={[
          {
            label: '&Game',
            items: [
              { label: '&Deal', shortcut: 'F2', onSelect: deal },
              {
                label: '&Undo',
                shortcut: 'Ctrl+Z',
                disabled: !game.previous || game.phase === 'won',
                onSelect: () => dispatch({ type: 'undo' }),
              },
              'separator',
              { label: 'D&eck...', onSelect: () => setDialog('deck') },
              { label: '&Options...', onSelect: () => setDialog('options') },
              'separator',
              { label: 'E&xit', onSelect: window.close },
            ],
          },
          { label: '&Help', items: [{ label: '&About Solitaire', onSelect: () => setDialog('about') }] },
        ]}
      />
      <div
        ref={root}
        role="application"
        className="relative flex-1 min-h-0 overflow-hidden bg-[#008000] touch-none select-none"
        aria-label="Solitaire table"
        data-phase={game.phase}
        onPointerDownCapture={() => {
          suppressClick.current = false
        }}
        onPointerMove={(event) => {
          if (!drag || event.pointerId !== drag.pointerId) return
          const bounds = event.currentTarget.getBoundingClientRect()
          setDrag({
            ...drag,
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
            moving: drag.moving || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4,
          })
        }}
        onPointerUp={end}
        onPointerCancel={() => setDrag(null)}
        onLostPointerCapture={() => setDrag(null)}
      >
        <button
          type="button"
          className="solitaire-slot"
          style={rect(columnX(0), margin)}
          aria-label={
            game.stock.length
              ? `Stock, ${game.stock.length} cards`
              : canRecycle(game)
                ? 'Recycle waste'
                : 'Stock exhausted'
          }
          onClick={() => dispatch({ type: 'stock' })}
        >
          {game.stock.length ? (
            <img src={backImage(back)} alt="" draggable={false} />
          ) : (
            <span style={{ color: canRecycle(game) ? '#00ff00' : '#800000', fontSize: 50 * scale }}>
              {canRecycle(game) ? '↻' : '×'}
            </span>
          )}
        </button>
        {game.waste.slice(-fan).map((card, index) => {
          const x = columnX(1) + index * 14 * scale
          if (index === fan - 1) return cardButton(card, { kind: 'waste' }, x, margin)
          return (
            <img
              key={`${card.suit}-${card.rank}`}
              src={cardImage(card)}
              alt={cardName(card)}
              draggable={false}
              className="absolute pointer-events-none"
              data-pile="waste-fan"
              style={rect(x, margin)}
            />
          )
        })}
        {FOUNDATION_SLOTS.map((pile) => {
          const card = game.foundations[pile].at(-1)
          return (
            <div key={pile}>
              <div
                role="img"
                className="solitaire-slot pointer-events-none"
                style={rect(columnX(pile + 3), margin)}
                aria-label={`${card ? card.suit : 'Empty'} foundation ${pile + 1}`}
                data-foundation={pile}
                data-count={game.foundations[pile].length}
              />
              {card && cardButton(card, { kind: 'foundation', pile }, columnX(pile + 3), margin)}
            </div>
          )
        })}
        {COLUMNS.map((columnIndex) => {
          const column = game.tableau[columnIndex] ?? []
          return (
            <div key={`column-${columnIndex}`}>
              <div
                role="img"
                className="solitaire-slot pointer-events-none"
                style={rect(columnX(columnIndex), tableauY)}
                aria-label={`Tableau column ${columnIndex + 1}`}
                data-column={columnIndex}
                data-count={column.length}
              />
              {column.map((card, index) =>
                cardButton(
                  card,
                  { kind: 'tableau', column: columnIndex, index },
                  columnX(columnIndex),
                  offsets[columnIndex]?.[index] ?? tableauY,
                  card.faceUp,
                ),
              )}
            </div>
          )
        })}
        {drag?.moving && (
          <div className="absolute inset-0 z-20 pointer-events-none" aria-hidden="true">
            {sourceCards(game, drag.source).map((card, index) =>
              game.options.outline ? (
                <div
                  key={`${card.suit}-${card.rank}`}
                  className="absolute border border-white outline outline-black"
                  style={rect(drag.x - drag.offsetX, drag.y - drag.offsetY + index * 21 * scale)}
                />
              ) : (
                <img
                  key={`${card.suit}-${card.rank}`}
                  src={cardImage(card)}
                  alt=""
                  className="absolute"
                  style={rect(drag.x - drag.offsetX, drag.y - drag.offsetY + index * 21 * scale)}
                />
              ),
            )}
          </div>
        )}
        {game.phase === 'won' && !cascadeStopped && (
          <Cascade
            width={size.width}
            height={size.height}
            scale={scale}
            active={active}
            onStop={() => setCascadeStopped(true)}
          />
        )}
      </div>
      {game.options.statusBar && (
        <StatusBar className="shrink-0 px-[2px] pb-[2px]">
          <StatusPane className="flex-1">{game.phase === 'won' ? 'You won!' : ''}</StatusPane>
          {game.options.scoring !== 'none' && (
            <StatusPane className="w-[110px]">
              Score: {game.options.scoring === 'vegas' ? '$' : ''}
              {game.score}
            </StatusPane>
          )}
          {game.options.timed && <StatusPane className="w-[90px]">Time: {game.elapsed}</StatusPane>}
        </StatusBar>
      )}
      {dialog === 'options' && (
        <OptionsDialog
          options={game.options}
          onClose={() => setDialog(null)}
          onApply={(options) => {
            if (
              options.draw !== game.options.draw ||
              options.scoring !== game.options.scoring ||
              options.timed !== game.options.timed
            ) {
              setGame(
                newGame(
                  options,
                  Math.random,
                  game.options.scoring === 'vegas' ? game.score : vegasBalance.current,
                ),
              )
              setCascadeStopped(false)
            } else setGame({ ...game, options })
            setDialog(null)
          }}
        />
      )}
      {dialog === 'deck' && (
        <DeckDialog
          back={back}
          onClose={() => setDialog(null)}
          onApply={(choice) => {
            setBack(choice)
            setDialog(null)
          }}
        />
      )}
      {dialog === 'about' && (
        <Dialog title="About Solitaire" onClose={() => setDialog(null)} className="w-[310px]">
          <div className="flex gap-3 p-4">
            <img src={icon} alt="" className="size-8" />
            <div>
              Microsoft Solitaire
              <br />
              Windows 95
              <br />
              <br />
              Klondike
              <br />
              Build each foundation from Ace to King.
            </div>
          </div>
          <div className="flex justify-end p-3 pt-0">
            <Button onClick={() => setDialog(null)}>OK</Button>
          </div>
        </Dialog>
      )}
    </div>
  )
}

export const app: AppManifest = {
  id: 'solitaire',
  title: 'Solitaire',
  icon,
  smallIcon,
  exe: 'SOL.EXE',
  startMenu: ['Accessories', 'Games'],
  desktopShortcut: true,
  window: { kind: 'resizable', width: 620, height: 440, minWidth: 560, minHeight: 360 },
  component: Solitaire,
}
