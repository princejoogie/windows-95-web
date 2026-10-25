import { useReducer, useState } from 'react'
import { icons } from '../../icons'
import { useKeyDown } from '../../shell/context'
import type { AppManifest } from '../../shell/types'
import { Button, MenuBar, MessageBox } from '../../ui'
import { type Action, initialCalculator, type Key, keyboardAction, reduceCalculator } from './engine'

const rows: readonly (readonly { label: string; action: Action }[])[] = [
  ['7', '8', '9', '/', 'sqrt'],
  ['4', '5', '6', '*', '%'],
  ['1', '2', '3', '-', '1/x'],
  ['0', '+/-', '.', '+', '='],
].map((row) =>
  row.map((label) => {
    const special: Record<string, Key> = { sqrt: 'sqrt', '%': 'percent', '1/x': 'reciprocal', '+/-': 'sign' }
    const action = keyboardAction(label) ?? { kind: 'key', key: special[label] ?? 'clear' }
    return { label, action }
  }),
)
const memoryKeys: readonly Key[] = ['MC', 'MR', 'MS', 'M+']

function Calculator() {
  const [state, dispatch] = useReducer(reduceCalculator, initialCalculator)
  const [message, setMessage] = useState<string | null>(null)
  const copy = () =>
    navigator.clipboard.writeText(state.display).catch(() => setMessage('The Clipboard is not available.'))
  const paste = () =>
    navigator.clipboard
      .readText()
      .then((text) => dispatch({ kind: 'paste', text }))
      .catch(() => setMessage('The Clipboard is not available.'))
  useKeyDown((event) => {
    if (message || event.altKey || event.target instanceof HTMLInputElement) return
    if (event.ctrlKey || event.metaKey) {
      if (event.key.toLowerCase() === 'c') {
        event.preventDefault()
        void copy()
      }
      if (event.key.toLowerCase() === 'v') {
        event.preventDefault()
        void paste()
      }
      return
    }
    const action = keyboardAction(event.key)
    if (action) {
      event.preventDefault()
      dispatch(action)
    }
  })
  return (
    <div className="w-[260px] bg-face pb-3">
      <MenuBar
        menus={[
          {
            label: '&Edit',
            items: [
              { label: '&Copy', shortcut: 'Ctrl+C', onSelect: copy },
              { label: '&Paste', shortcut: 'Ctrl+V', onSelect: paste },
            ],
          },
          { label: '&View', items: [{ label: '&Standard', checked: true }] },
          {
            label: '&Help',
            items: [
              {
                label: '&About Calculator',
                onSelect: () => setMessage('Calculator\nWindows 95\nStandard Calculator'),
              },
            ],
          },
        ]}
      />
      <div className="mx-[9px] mt-[6px]">
        <output
          aria-label="Calculator display"
          className="bevel-sunken flex h-[27px] items-center justify-end overflow-hidden bg-white px-[5px] select-text"
          style={{ fontSize: state.entry === 'error' ? 11 : 13 }}
        >
          {state.display}
          {state.entry !== 'error' && !/[.e]/i.test(state.display) ? '.' : ''}
        </output>
        <div className="mt-[9px] flex gap-[9px]">
          <div className="flex w-[34px] shrink-0 flex-col gap-[5px]">
            <output
              aria-label="Memory indicator"
              className="bevel-sunken mb-[4px] flex h-[27px] items-center justify-center"
            >
              {state.memory !== 0 ? 'M' : ''}
            </output>
            {memoryKeys.map((key) => (
              <Button
                key={key}
                className="min-w-0! h-[27px]! px-0! text-[#800000]"
                onClick={() => dispatch({ kind: 'key', key })}
              >
                {key}
              </Button>
            ))}
          </div>
          <div className="flex-1">
            <div className="mb-[9px] grid grid-cols-3 gap-[5px]">
              {(
                [
                  { label: 'Back', key: 'back' },
                  { label: 'CE', key: 'clearEntry' },
                  { label: 'C', key: 'clear' },
                ] satisfies { label: string; key: Key }[]
              ).map(({ label, key }) => (
                <Button
                  key={key}
                  className="min-w-0! h-[27px]! px-0! text-[#800000]"
                  onClick={() => dispatch({ kind: 'key', key })}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-[5px]">
              {rows.flat().map(({ label, action }) => (
                <Button
                  key={label}
                  className={`min-w-0! h-[27px]! px-0! ${/^[+*/=-]$/.test(label) ? 'text-[#800000]' : 'text-[#000080]'}`}
                  onClick={() => dispatch(action)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {message && (
        <MessageBox
          title={message.startsWith('Calculator') ? 'About Calculator' : 'Calculator'}
          message={message}
          buttons={['OK']}
          onClose={() => setMessage(null)}
        />
      )}
    </div>
  )
}

export const app: AppManifest = {
  id: 'calculator',
  title: 'Calculator',
  icon: icons.calculator,
  exe: 'CALC.EXE',
  startMenu: ['Accessories'],
  window: { kind: 'fixed' },
  component: Calculator,
}
