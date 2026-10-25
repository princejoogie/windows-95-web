import { useEffect, useId, useRef, useState } from 'react'
import { icons } from '../../icons'
import { Button, Checkbox, Dialog, GroupBox, Radio, Separator, TextBox } from '../../ui'
import { icon } from './art'
import { type GameNumber, gameNumber } from './game'
import type { Options, Statistics } from './preferences'

export function SelectGame({
  number,
  onSelect,
  onClose,
}: {
  number: GameNumber
  onSelect: (number: GameNumber) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(String(number))
  const [error, setError] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const inputId = useId()
  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])
  return (
    <Dialog title="Game Number" onClose={onClose} className="w-[290px]">
      <form
        className="flex flex-col gap-3 p-3"
        onSubmit={(event) => {
          event.preventDefault()
          const selected = gameNumber(value)
          if (selected === null) {
            setError(true)
            input.current?.focus()
            input.current?.select()
          } else onSelect(selected)
        }}
      >
        <label htmlFor={inputId} className="flex flex-col gap-2">
          Select a game number from 1 to 32000.
          <TextBox
            id={inputId}
            ref={input}
            aria-label="Game number"
            inputMode="numeric"
            maxLength={5}
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setError(false)
            }}
          />
        </label>
        {error && <p role="alert">Enter a whole number between 1 and 32000.</p>}
        <div className="flex justify-end gap-2">
          <Button type="submit" isDefault>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}

export function OptionsDialog({
  options,
  onApply,
  onClose,
}: {
  options: Options
  onApply: (options: Options) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(options)
  return (
    <Dialog title="Options" onClose={onClose} className="w-[310px]">
      <form
        className="flex flex-col gap-3 p-3"
        onSubmit={(event) => {
          event.preventDefault()
          onApply(draft)
        }}
        onKeyDown={(event) => {
          if (!event.altKey) return
          if (event.key.toLowerCase() === 'd') {
            event.preventDefault()
            setDraft({ ...draft, illegalMessages: !draft.illegalMessages })
          }
          if (event.key.toLowerCase() === 'q') {
            event.preventDefault()
            setDraft({ ...draft, quickPlay: !draft.quickPlay })
          }
        }}
      >
        <Checkbox
          autoFocus
          label={
            <>
              <u>D</u>isplay messages on illegal moves
            </>
          }
          checked={draft.illegalMessages}
          onChange={(event) => setDraft({ ...draft, illegalMessages: event.target.checked })}
        />
        <Checkbox
          label={
            <>
              <u>Q</u>uick play
            </>
          }
          checked={draft.quickPlay}
          onChange={(event) => setDraft({ ...draft, quickPlay: event.target.checked })}
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

export function MoveColumn({ onMove, onClose }: { onMove: (column: boolean) => void; onClose: () => void }) {
  const [column, setColumn] = useState(true)
  return (
    <Dialog title="Move to Empty Column" onClose={onClose} className="w-[270px]">
      <form
        className="flex flex-col gap-3 p-3"
        onSubmit={(event) => {
          event.preventDefault()
          onMove(column)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onMove(column)
          }
          if (event.altKey && ['c', 's'].includes(event.key.toLowerCase())) {
            event.preventDefault()
            setColumn(event.key.toLowerCase() === 'c')
          }
        }}
      >
        <Radio
          autoFocus
          name="freecell-move"
          label={
            <>
              Move <u>c</u>olumn
            </>
          }
          checked={column}
          onChange={() => setColumn(true)}
        />
        <Radio
          name="freecell-move"
          label={
            <>
              Move <u>s</u>ingle card
            </>
          }
          checked={!column}
          onChange={() => setColumn(false)}
        />
        <div className="flex justify-end gap-2">
          <Button type="submit" isDefault>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}

export function StatisticsDialog({
  statistics,
  session,
  onClear,
  onClose,
}: {
  statistics: Statistics
  session: { won: number; lost: number }
  onClear: () => void
  onClose: () => void
}) {
  const total = statistics.won + statistics.lost
  return (
    <Dialog title="FreeCell Statistics" onClose={onClose} className="w-[350px]">
      <div className="flex flex-col gap-3 p-3">
        <div className="flex gap-3">
          <GroupBox label="This session" className="flex-1">
            <dl className="grid grid-cols-2 gap-1">
              <dt>Won:</dt>
              <dd>{session.won}</dd>
              <dt>Lost:</dt>
              <dd>{session.lost}</dd>
            </dl>
          </GroupBox>
          <GroupBox label="Total" className="flex-1">
            <dl className="grid grid-cols-2 gap-1">
              <dt>Won:</dt>
              <dd data-stat="won">{statistics.won}</dd>
              <dt>Lost:</dt>
              <dd data-stat="lost">{statistics.lost}</dd>
              <dt>Percent:</dt>
              <dd>{total ? Math.round((100 * statistics.won) / total) : 0}%</dd>
            </dl>
          </GroupBox>
        </div>
        <GroupBox label="Streaks">
          <dl className="grid grid-cols-2 gap-1">
            <dt>Wins:</dt>
            <dd>{statistics.bestWin}</dd>
            <dt>Losses:</dt>
            <dd>{statistics.bestLoss}</dd>
            <dt>Current:</dt>
            <dd>
              {Math.abs(statistics.streak)} {statistics.streak < 0 ? 'losses' : 'wins'}
            </dd>
          </dl>
        </GroupBox>
        <div className="flex justify-end gap-2">
          <Button onClick={onClear}>Clear</Button>
          <Button autoFocus isDefault onClick={onClose}>
            OK
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export function About({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="About FreeCell" onClose={onClose} className="w-[400px]">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onClose()
        }}
      >
        <div className="flex items-center gap-4 px-5 py-3">
          <img src={icons.windowsLogo} width="32" height="32" alt="" />
          <div className="text-[24px]">Microsoft Windows 95</div>
        </div>
        <Separator className="mx-3" />
        <div className="flex gap-4 p-5">
          <img src={icon} width="32" height="32" className="shrink-0" alt="" />
          <div>
            Microsoft FreeCell
            <br />
            Version 4.00.950
            <br />
            <br />
            Copyright © 1981-1995 Microsoft Corp.
          </div>
        </div>
        <Separator className="mx-3" />
        <div className="flex justify-end p-3">
          <Button autoFocus isDefault type="submit">
            OK
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
