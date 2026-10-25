import { useId, useState } from 'react'
import { Button, Dialog, Radio, Separator, TextBox } from '../../ui'
import { icon, windowsFlag } from './art'
import { four, type Game, SEATS, totals } from './game'
import type { Preferences } from './preferences'

export function NetworkDialog({
  name,
  onStart,
  onConnect,
  onClose,
}: {
  name: string
  onStart: (name: string) => void
  onConnect: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(name)
  const nameId = useId()
  const [mode, setMode] = useState<'connect' | 'dealer'>('connect')
  return (
    <Dialog title="The Microsoft Hearts Network" onClose={onClose} className="w-[360px]">
      <form
        className="p-3 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (mode === 'connect') onConnect()
          else onStart(draft.trim() || 'Player')
        }}
      >
        <div className="flex items-start gap-3">
          <img src={icon} width="32" height="32" alt="" className="mt-1" />
          <div className="flex-1 flex flex-col gap-2">
            <label htmlFor={nameId}>
              What is your <u>n</u>ame?
            </label>
            <TextBox
              id={nameId}
              accessKey="n"
              maxLength={20}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 pl-[44px]">
          <Radio
            name="hearts-network"
            accessKey="c"
            label={
              <>
                I want to <u>c</u>onnect to another game
              </>
            }
            checked={mode === 'connect'}
            onChange={() => setMode('connect')}
          />
          <Radio
            name="hearts-network"
            accessKey="d"
            label={
              <>
                I want to be <u>d</u>ealer
              </>
            }
            checked={mode === 'dealer'}
            onChange={() => setMode('dealer')}
          />
        </div>
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

export function ComputerDialog({
  preferences,
  onApply,
  onClose,
}: {
  preferences: Preferences
  onApply: (preferences: Preferences) => void
  onClose: () => void
}) {
  const [names, setNames] = useState(preferences.computers)
  const id = useId()
  return (
    <Dialog title="Computer Players" onClose={onClose} className="w-[292px]">
      <form
        className="p-3 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const defaults = ['Player', 'Pauline', 'Michele', 'Ben']
          onApply({
            ...preferences,
            computers: four((seat) => names[seat].trim() || defaults[seat] || 'Player'),
          })
        }}
      >
        {[1, 2, 3].map((seat) => (
          <label key={seat} htmlFor={`${id}-${seat}`} className="flex items-center gap-3">
            <span className="w-[60px]">Player {seat + 1}:</span>
            <TextBox
              id={`${id}-${seat}`}
              aria-label={`Player ${seat + 1}`}
              maxLength={20}
              className="w-[170px]"
              value={names[seat]}
              onChange={(event) =>
                setNames(four((index) => (index === seat ? event.target.value : names[index])))
              }
            />
          </label>
        ))}
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

export function ScoreDialog({
  game,
  names,
  onClose,
  onNew,
}: {
  game: Game
  names: Preferences['computers']
  onClose: () => void
  onNew: () => void
}) {
  const scores = totals(game)
  const over = game.kind === 'scores' && game.gameOver
  const low = Math.min(...scores)
  const winners = SEATS.filter((seat) => scores[seat] === low).map((seat) => names[seat])
  const moon = game.history.at(-1)?.moon
  return (
    <Dialog title="Score" onClose={onClose} className="w-[440px]">
      <form
        className="p-3"
        onSubmit={(event) => {
          event.preventDefault()
          onClose()
        }}
      >
        {over && (
          <p className="text-center pb-3" data-game-over>
            {winners.join(' and ')} {winners.length === 1 ? 'wins' : 'win'} the game!
          </p>
        )}
        {moon !== null && moon !== undefined && (
          <p className="text-center pb-2">{names[moon]} shot the moon!</p>
        )}
        <div className="hearts-score-sheet bevel-sunken bg-white overflow-auto max-h-[240px]">
          <table className="w-full text-center" aria-label="Hearts scores">
            <thead>
              <tr>
                <th scope="col">Hand</th>
                {SEATS.map((seat) => (
                  <th scope="col" key={seat}>
                    {names[seat]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {game.history.map((row) => (
                <tr key={row.hand} data-score-hand={row.hand}>
                  <th scope="row">{row.hand}</th>
                  {row.points.map((score, seat) => (
                    <td key={SEATS[seat]}>{score}</td>
                  ))}
                </tr>
              ))}
              {game.history.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4">
                    No hands have been completed.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                {SEATS.map((seat) => (
                  <td key={seat} data-total={seat}>
                    {scores[seat]}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        {over && <p className="pt-3 text-center">The game ends when a player reaches 100 points.</p>}
        <div className="flex justify-end gap-2 pt-3">
          {over && <Button onClick={onNew}>New Game</Button>}
          <Button type="submit" isDefault>
            OK
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="About Hearts" onClose={onClose} className="w-[400px]">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onClose()
        }}
      >
        <div className="flex items-center gap-4 px-5 py-3">
          <img src={windowsFlag} width="40" height="32" alt="" />
          <div className="text-[24px]">Microsoft Windows 95</div>
        </div>
        <Separator className="mx-3" />
        <div className="flex gap-4 p-5">
          <img src={icon} width="32" height="32" className="shrink-0" alt="" />
          <div>
            Microsoft Hearts
            <br />
            Version 4.00.950
            <br />
            <br />
            Copyright © 1991-1995 Microsoft Corp.
          </div>
        </div>
        <Separator className="mx-3" />
        <div className="flex justify-end p-3">
          <Button type="submit" isDefault>
            OK
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
