import { useEffect, useId, useRef, useState } from 'react'
import { fontHasCharacter, useFontChoices, useFonts } from '../../fonts/catalog'
import { useKeyDown } from '../../shell/context'
import { launch } from '../../shell/system'
import type { AppManifest, AppProps } from '../../shell/types'
import { Button, ComboBox, MessageBox, StatusBar, StatusPane, TextBox } from '../../ui'
import { FONTS, isSymbolFont } from '../wordpad/fonts'
import { COLUMNS, cellCode, cellIndex, glyphFor, keystroke, LAST_CODE, moveSelection, ROWS } from './chars'
import { charmapIcon, charmapSmallIcon } from './icon'

const CELL_WIDTH = 18
const CELL_HEIGHT = 16

function fontFamily(font: string): string {
  return `"${font}", ${isSymbolFont(font) ? 'serif' : 'sans-serif'}`
}

export function CharacterMap({ window: windowApi }: AppProps) {
  const fonts = useFontChoices(FONTS)
  const [font, setFont] = useState('Arial')
  const installed = useFonts().find((entry) => entry.name === font)
  const glyph = (code: number) => {
    const text = glyphFor(font, code)
    return installed && !fontHasCharacter(installed, text.codePointAt(0) ?? 0) ? '' : text
  }
  const [selected, setSelected] = useState(cellIndex(65))
  const [chars, setChars] = useState('')
  const [magnified, setMagnified] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const grid = useRef<HTMLFieldSetElement>(null)
  const id = useId()
  const code = cellCode(selected)

  useEffect(() => windowApi.setTitle('Character Map'), [windowApi])

  const cellAt = (clientX: number, clientY: number): number | null => {
    const box = grid.current?.getBoundingClientRect()
    if (!box) return null
    const column = Math.floor((clientX - box.left - 2) / CELL_WIDTH)
    const row = Math.floor((clientY - box.top - 2) / CELL_HEIGHT)
    if (column < 0 || column >= COLUMNS || row < 0 || row >= ROWS) return null
    const index = row * COLUMNS + column
    return cellCode(index) === null ? null : index
  }

  const pick = (index: number) => {
    const picked = cellCode(index)
    if (picked !== null) setChars((value) => value + glyph(picked))
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(chars)
    } catch {
      setError('The Clipboard is not available.')
    }
  }

  useKeyDown((event) => {
    if (error) return
    if (event.altKey && event.key === 'F4') {
      event.preventDefault()
      windowApi.close()
    }
    if (event.key === 'F1') {
      event.preventDefault()
      launch('help', { book: 'charmap' })
    }
    if (!event.altKey || event.ctrlKey || event.metaKey) return
    const actions: Record<string, () => void> = {
      s: () => pick(selected),
      a: () => document.getElementById(`${id}-chars`)?.focus(),
      h: () => launch('help', { book: 'charmap' }),
      f: () => document.getElementById(`${id}-font`)?.focus(),
      c: () => {
        if (chars) void copy()
      },
    }
    const action = actions[event.key.toLowerCase()]
    if (action) {
      event.preventDefault()
      action()
    }
  })

  return (
    <div className="flex w-[594px] flex-col gap-[6px] bg-face p-[6px]">
      <div className="flex items-center gap-[6px]">
        <label htmlFor={`${id}-font`}>
          <span className="underline">F</span>ont:
        </label>
        <ComboBox
          id={`${id}-font`}
          aria-label="Font"
          className="w-[150px]"
          value={font}
          onChange={setFont}
          options={fonts.map((name) => ({ key: name, label: name }))}
        />
        <label htmlFor={`${id}-chars`} className="ml-[6px]">
          Ch<span className="underline">a</span>racters to copy:
        </label>
        <TextBox
          id={`${id}-chars`}
          className="min-w-0 flex-1"
          style={{ fontFamily: fontFamily(font) }}
          value={chars}
          onChange={(event) => setChars(event.target.value)}
        />
        <Button onClick={() => windowApi.close()}>Close</Button>
      </div>
      <div className="relative">
        <fieldset
          ref={grid}
          aria-label="Characters"
          className="m-0 grid min-w-0 border-0 bg-white bevel-sunken p-[2px]"
          style={{
            gridTemplateColumns: `repeat(${COLUMNS}, ${CELL_WIDTH}px)`,
            gridAutoRows: `${CELL_HEIGHT}px`,
            width: COLUMNS * CELL_WIDTH + 4,
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            const index = cellAt(event.clientX, event.clientY)
            if (index === null) return
            event.currentTarget.setPointerCapture(event.pointerId)
            setSelected(index)
            setMagnified(index)
          }}
          onPointerMove={(event) => {
            if (magnified === null) return
            const index = cellAt(event.clientX, event.clientY)
            if (index !== null) {
              setSelected(index)
              setMagnified(index)
            }
          }}
          onPointerUp={() => setMagnified(null)}
          onPointerCancel={() => setMagnified(null)}
          onDoubleClick={(event) => {
            const index = cellAt(event.clientX, event.clientY)
            if (index !== null) pick(index)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              pick(selected)
              return
            }
            const next = moveSelection(selected, event.key)
            if (next !== selected) {
              event.preventDefault()
              setSelected(next)
              document.getElementById(`${id}-cell-${next}`)?.focus()
            }
          }}
        >
          {Array.from({ length: COLUMNS * ROWS }, (_, index) => {
            const cell = cellCode(index)
            const lit = index === selected
            return (
              <button
                key={cell ?? 'spare'}
                type="button"
                id={`${id}-cell-${index}`}
                tabIndex={lit ? 0 : -1}
                aria-pressed={lit}
                aria-label={cell === null ? 'Unused cell' : `Character ${cell}`}
                disabled={cell === null}
                className={`flex items-center justify-center text-[12px] leading-none outline-none ${
                  lit
                    ? 'bg-select text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-white focus-visible:-outline-offset-1'
                    : ''
                }`}
                style={{ width: CELL_WIDTH, height: CELL_HEIGHT, fontFamily: fontFamily(font) }}
              >
                {cell === null ? '' : glyph(cell)}
              </button>
            )
          })}
        </fieldset>
        {magnified !== null && cellCode(magnified) !== null && (
          <div
            role="presentation"
            aria-label="Magnified character"
            className="pointer-events-none absolute z-10 flex items-center justify-center bg-white bevel-raised text-[28px] leading-none"
            style={{
              width: CELL_WIDTH * 2 + 6,
              height: CELL_HEIGHT * 2 + 10,
              left: 2 + (magnified % COLUMNS) * CELL_WIDTH - CELL_WIDTH / 2 - 3,
              top: 2 + Math.floor(magnified / COLUMNS) * CELL_HEIGHT - CELL_HEIGHT / 2 - 5,
              fontFamily: fontFamily(font),
            }}
          >
            {glyph(cellCode(magnified) ?? LAST_CODE)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-[6px]">
        <span className="flex-1">Table of available characters in the selected font.</span>
        <Button onClick={() => pick(selected)}>
          <span className="underline">S</span>elect
        </Button>
        <Button onClick={() => void copy()} disabled={!chars}>
          <span className="underline">C</span>opy
        </Button>
        <Button onClick={() => launch('help', { book: 'charmap' })}>
          <span className="underline">H</span>elp
        </Button>
      </div>
      <StatusBar>
        <StatusPane className="flex-1">{code === null ? '' : `Character: ${code}`}</StatusPane>
        <StatusPane className="w-[150px]" aria-live="polite">
          {code === null ? '' : `Keystroke: ${keystroke(code)}`}
        </StatusPane>
      </StatusBar>
      {error && (
        <MessageBox
          title="Character Map"
          icon="warning"
          message={error}
          buttons={['OK']}
          onClose={() => setError(null)}
        />
      )}
    </div>
  )
}

export const app: AppManifest = {
  id: 'charmap',
  title: 'Character Map',
  icon: charmapIcon,
  smallIcon: charmapSmallIcon,
  exe: 'CHARMAP.EXE',
  startMenu: ['Accessories'],
  window: { kind: 'fixed' },
  component: CharacterMap,
}
