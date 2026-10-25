import { useEffect, useRef, useState } from 'react'
import { useKeyDown } from '../../shell/context'
import { launch } from '../../shell/system'
import type { AppManifest, AppProps } from '../../shell/types'
import { AboutDialog, Button, MenuBar, MessageBox, StatusBar, StatusPane } from '../../ui'
import { backImage, cardImage, cardName } from '../solitaire/cards'
import { icon, smallIcon } from './art'
import { ComputerDialog, NetworkDialog, ScoreDialog } from './dialogs'
import {
  type Action,
  type Card,
  choosePlay,
  type Game,
  gameReducer,
  legalCards,
  newGame,
  passDirection,
  passTarget,
  points,
  SEATS,
  sameCard,
  totals,
} from './game'
import { loadPreferences, savePreferences } from './preferences'
import './hearts.css'

type OpenDialog = 'network' | 'score' | 'computers' | 'about' | 'new' | null

function seed(): number {
  if (import.meta.env.DEV) {
    const value = new URLSearchParams(location.search).get('heartsSeed')
    if (value !== null && Number.isFinite(Number(value))) return Number(value)
  }
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now()
}

function illegalMove(game: Game): string {
  if (game.kind !== 'playing') return 'Wait until it is your turn.'
  const lead = game.trick[0]
  if (lead && game.hands[0].some((card) => card.suit === lead.card.suit))
    return `You must follow suit. Play a ${lead.card.suit.slice(0, -1)}.`
  if (game.captured.every((cards) => cards.length === 0))
    return lead
      ? 'You cannot play a heart or the queen of spades on the first trick while you have another card.'
      : 'You must lead the two of clubs.'
  return 'Hearts have not been broken. You must lead another suit while you have one.'
}

function status(game: Game | null, names: readonly string[], selected: number): string {
  if (!game) return 'Choose New Game from the Game menu to play Hearts.'
  switch (game.kind) {
    case 'passing':
      return selected === 3
        ? 'Click Pass to pass the selected cards.'
        : `Select three cards to pass to ${names[passTarget(game.hand, 0)]}`
    case 'receiving':
      return 'These are the cards you received. Click to continue.'
    case 'playing':
      return game.turn === 0
        ? game.trick.length === 0
          ? 'It is your turn. Lead a card.'
          : 'It is your turn. Play a card.'
        : `${names[game.turn]} is playing.`
    case 'trick':
      return `${names[game.winner]} takes the trick. Click to continue.`
    case 'scores':
      return game.gameOver
        ? 'The game is over. Choose New Game to play again.'
        : 'The hand is over. Click to continue.'
  }
}

function Hearts({ window }: AppProps) {
  const [preferences, setPreferences] = useState(loadPreferences)
  const [game, setGame] = useState<Game | null>(null)
  const [dialog, setDialog] = useState<OpenDialog>('network')
  const [message, setMessage] = useState<string | null>(null)
  const [selected, setSelected] = useState<readonly Card[]>([])
  const [size, setSize] = useState({ width: 680, height: 459 })
  const table = useRef<HTMLDivElement>(null)
  const sound = useRef<AudioContext | null>(null)
  const active = window.focused && !window.minimized && dialog === null && message === null
  const playerNames = [
    preferences.name,
    preferences.computers[1],
    preferences.computers[2],
    preferences.computers[3],
  ] as const
  const legal = game ? legalCards(game) : []
  const scoreOpen = dialog === 'score'
  const dispatch = (action: Action) => setGame((current) => (current ? gameReducer(current, action) : null))
  const continueGame = () => dispatch({ type: 'continue' })
  const requestNew = () => setDialog(game && !(game.kind === 'scores' && game.gameOver) ? 'new' : 'network')

  useEffect(() => {
    savePreferences(preferences)
  }, [preferences])
  useEffect(() => {
    if (game?.kind === 'scores') setDialog('score')
  }, [game])
  useEffect(() => {
    const node = table.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  useEffect(
    () => () => {
      void sound.current?.close()
    },
    [],
  )
  useEffect(() => {
    if (!active || game?.kind !== 'playing' || game.turn === 0) return
    const timer = setTimeout(
      () => {
        const card = choosePlay(game)
        if (card)
          setGame((current) =>
            current === game ? gameReducer(game, { type: 'play', seat: game.turn, card }) : current,
          )
      },
      preferences.animation ? 380 : 45,
    )
    return () => clearTimeout(timer)
  }, [active, game, preferences.animation])

  const playSound = () => {
    if (!preferences.sound) return
    try {
      const context = sound.current ?? new AudioContext()
      sound.current = context
      void context.resume().catch(() => {})
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'square'
      oscillator.frequency.value = 180
      gain.gain.setValueAtTime(0.025, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.025)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.03)
    } catch {
      // Audio is optional when the host has no output device.
    }
  }
  const selectCard = (card: Card) => {
    if (!game || !active) return
    if (game.kind === 'passing') {
      setSelected((cards) =>
        cards.some((other) => sameCard(other, card))
          ? cards.filter((other) => !sameCard(other, card))
          : cards.length < 3
            ? [...cards, card]
            : cards,
      )
      playSound()
    } else if (game.kind === 'playing' && game.turn === 0) {
      if (!legal.some((other) => sameCard(other, card))) setMessage(illegalMove(game))
      else {
        playSound()
        dispatch({ type: 'play', seat: 0, card })
      }
    }
  }

  useKeyDown((event) => {
    if (message || dialog || scoreOpen) return
    if (event.key === 'F2') {
      event.preventDefault()
      requestNew()
    }
    if (event.key === 'F1') {
      event.preventDefault()
      launch('help', { book: 'hearts' })
    }
    if (event.key === 'Enter' && (game?.kind === 'receiving' || game?.kind === 'trick')) {
      event.preventDefault()
      continueGame()
    }
  })

  const human = game?.hands[0] ?? []
  const spacing = Math.min(32, (size.width - 220 - 71) / Math.max(1, human.length - 1))
  const handWidth = 71 + Math.max(0, human.length - 1) * spacing
  const handX = Math.round((size.width - handWidth) / 2)
  const gameScores = game ? totals(game) : [0, 0, 0, 0]
  const canContinue = game?.kind === 'trick' || game?.kind === 'receiving'
  return (
    <div className="hearts h-full w-full flex flex-col min-h-0">
      <MenuBar
        menus={[
          {
            label: '&Game',
            items: [
              { label: '&New Game', shortcut: 'F2', onSelect: requestNew },
              { label: '&Score...', disabled: !game, onSelect: () => setDialog('score') },
              'separator',
              { label: '&Quit', onSelect: window.close },
            ],
          },
          {
            label: '&Options',
            items: [
              {
                label: '&Sound',
                checked: preferences.sound,
                onSelect: () => setPreferences({ ...preferences, sound: !preferences.sound }),
              },
              {
                label: '&Animation',
                checked: preferences.animation,
                onSelect: () => setPreferences({ ...preferences, animation: !preferences.animation }),
              },
              'separator',
              { label: '&Computer players...', onSelect: () => setDialog('computers') },
            ],
          },
          {
            label: '&Help',
            items: [
              { label: '&Help Topics', shortcut: 'F1', onSelect: () => launch('help', { book: 'hearts' }) },
              'separator',
              { label: '&About Hearts', onSelect: () => setDialog('about') },
            ],
          },
        ]}
      />
      <div
        ref={table}
        role="application"
        aria-label="Hearts table"
        className="hearts-table relative flex-1 min-h-0 overflow-hidden select-none"
        data-phase={game?.kind ?? 'waiting'}
        data-hand={game?.hand ?? 0}
        data-turn={game?.kind === 'playing' ? game.turn : ''}
        data-direction={game ? passDirection(game.hand) : ''}
        data-hearts-broken={game?.heartsBroken ?? false}
        data-active={active}
        data-animation={preferences.animation}
      >
        {game && (
          <>
            {SEATS.filter((seat) => seat !== 0).map((seat) => {
              const count = game.hands[seat].length
              const step = seat === 2 ? 10 : Math.min(12, (size.height - 260) / 12)
              const length = 71 + Math.max(0, count - 1) * step
              const handStyle =
                seat === 2
                  ? { width: length, height: 96, left: Math.round((size.width - length) / 2), top: 10 }
                  : {
                      width: 96,
                      height: length,
                      top: Math.round((size.height - length) / 2),
                      ...(seat === 1 ? { left: 10 } : { right: 10 }),
                    }
              return (
                <div
                  key={seat}
                  className={`hearts-opponent hearts-seat-${seat}`}
                  style={handStyle}
                  role="img"
                  aria-label={`${playerNames[seat]}, ${count} cards`}
                  data-player={seat}
                  data-count={count}
                >
                  {game.hands[seat].map((hiddenCard, index) => (
                    <img
                      key={`${hiddenCard.suit}-${hiddenCard.rank}`}
                      src={backImage('Blue weave')}
                      alt=""
                      draggable={false}
                      width="71"
                      height="96"
                      style={
                        seat === 2 ? { left: index * step, top: 0 } : { left: 12, top: index * step - 12 }
                      }
                    />
                  ))}
                </div>
              )
            })}
            {SEATS.map((seat) => (
              <div
                key={seat}
                className={`hearts-name hearts-name-${seat}`}
                data-name={seat}
                data-score={gameScores[seat]}
                data-current={game.kind === 'playing' && game.turn === seat}
              >
                {playerNames[seat]}
              </div>
            ))}
            {(game.kind === 'playing' || game.kind === 'trick') &&
              game.trick.map((play) => (
                <img
                  key={`${play.card.suit}-${play.card.rank}`}
                  className={`hearts-play hearts-play-${play.seat}`}
                  src={cardImage(play.card)}
                  width="71"
                  height="96"
                  alt={`${playerNames[play.seat]} played ${cardName(play.card)}`}
                  draggable={false}
                  data-played-by={play.seat}
                  data-points={points(play.card)}
                />
              ))}
            <fieldset className="hearts-hand" aria-label="Your hand">
              {human.map((card, index) => {
                const raised =
                  selected.some((other) => sameCard(other, card)) ||
                  (game.kind === 'receiving' && game.received[0].some((other) => sameCard(other, card)))
                return (
                  <button
                    type="button"
                    key={`${card.suit}-${card.rank}`}
                    className="hearts-card"
                    aria-label={cardName(card)}
                    aria-pressed={game.kind === 'passing' ? raised : undefined}
                    data-card={`${card.suit}-${card.rank}`}
                    data-raised={raised}
                    data-legal={legal.some((other) => sameCard(other, card))}
                    disabled={game.kind !== 'passing' && !(game.kind === 'playing' && game.turn === 0)}
                    style={{ left: handX + index * spacing, bottom: raised ? 38 : 24, zIndex: index }}
                    onClick={() => selectCard(card)}
                    onKeyDown={(event) => {
                      const buttons = table.current?.querySelectorAll<HTMLButtonElement>('.hearts-card')
                      const next =
                        event.key === 'ArrowRight'
                          ? index + 1
                          : event.key === 'ArrowLeft'
                            ? index - 1
                            : event.key === 'Home'
                              ? 0
                              : event.key === 'End'
                                ? human.length - 1
                                : null
                      if (next !== null) {
                        event.preventDefault()
                        buttons?.[(next + human.length) % human.length]?.focus()
                      }
                    }}
                  >
                    <img src={cardImage(card)} alt="" draggable={false} width="71" height="96" />
                  </button>
                )
              })}
            </fieldset>
            {game.kind === 'passing' && (
              <div className="hearts-pass">
                <Button
                  disabled={selected.length !== 3}
                  onClick={() => {
                    dispatch({ type: 'pass', cards: selected })
                    setSelected([])
                  }}
                >
                  Pass
                </Button>
              </div>
            )}
            {canContinue && (
              <button
                type="button"
                className="hearts-continue"
                aria-label="Click to continue"
                onClick={continueGame}
              />
            )}
            {game.kind === 'scores' && dialog === null && (
              <div className="hearts-pass">
                <Button onClick={() => setDialog('network')}>New Game</Button>
              </div>
            )}
          </>
        )}
      </div>
      <StatusBar className="shrink-0 px-[2px] pb-[2px]">
        <StatusPane className="flex-1">
          <span role="status">{status(game, playerNames, selected.length)}</span>
        </StatusPane>
      </StatusBar>
      {dialog === 'network' && (
        <NetworkDialog
          name={preferences.name}
          onClose={() => setDialog(null)}
          onConnect={() =>
            setMessage('No dealer could be found. To start a game, choose "I want to be dealer".')
          }
          onStart={(name) => {
            setPreferences({ ...preferences, name })
            setSelected([])
            setGame(newGame(seed()))
            setDialog(null)
          }}
        />
      )}
      {dialog === 'new' && (
        <MessageBox
          title="Hearts"
          message="Do you want to quit this game and start a new game?"
          icon="question"
          buttons={['Yes', 'No']}
          onClose={(result) => setDialog(result === 'Yes' ? 'network' : null)}
        />
      )}
      {dialog === 'computers' && (
        <ComputerDialog
          preferences={preferences}
          onClose={() => setDialog(null)}
          onApply={(value) => {
            setPreferences(value)
            setDialog(null)
          }}
        />
      )}
      {dialog === 'about' && <AboutDialog app="Hearts" icon={icon} onClose={() => setDialog(null)} />}
      {scoreOpen && game && (
        <ScoreDialog
          game={game}
          names={playerNames}
          onClose={() => {
            if (game.kind === 'scores' && !game.gameOver) continueGame()
            setDialog(null)
          }}
          onNew={() => setDialog('network')}
        />
      )}
      {message && (
        <MessageBox
          title="Hearts"
          message={message}
          icon="info"
          buttons={['OK']}
          onClose={() => setMessage(null)}
        />
      )}
    </div>
  )
}

export const app: AppManifest = {
  id: 'hearts',
  title: 'Hearts',
  exe: 'MSHEARTS.EXE',
  icon,
  smallIcon,
  startMenu: ['Accessories', 'Games'],
  window: { kind: 'resizable', width: 680, height: 500, minWidth: 560, minHeight: 460 },
  component: Hearts,
}
