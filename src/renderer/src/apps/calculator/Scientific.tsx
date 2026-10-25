import type { Dispatch } from 'react'
import { useId, useState } from 'react'
import { Button, Checkbox, Radio } from '../../ui'
import { ModelessDialog } from '../notepad/ModelessDialog'
import { type Action, type Calculator, decimalOnly, type Key } from './engine'

const rows: readonly (readonly [string, Key | null][])[] = [
  [
    ['Sta', null],
    ['F-E', 'FE'],
    ['(', 'open'],
    [')', 'close'],
    ['MC', 'MC'],
    ['7', null],
    ['8', null],
    ['9', null],
    ['/', '/'],
    ['Mod', 'mod'],
    ['And', 'and'],
  ],
  [
    ['Ave', 'Ave'],
    ['dms', 'dms'],
    ['Exp', 'exp'],
    ['ln', 'ln'],
    ['MR', 'MR'],
    ['4', null],
    ['5', null],
    ['6', null],
    ['*', '*'],
    ['Or', 'or'],
    ['Xor', 'xor'],
  ],
  [
    ['Sum', 'Sum'],
    ['sin', 'sin'],
    ['x^y', 'power'],
    ['log', 'log'],
    ['MS', 'MS'],
    ['1', null],
    ['2', null],
    ['3', null],
    ['-', '-'],
    ['Lsh', 'lsh'],
    ['Not', 'not'],
  ],
  [
    ['s', 's'],
    ['cos', 'cos'],
    ['x^3', 'cube'],
    ['n!', 'factorial'],
    ['M+', 'M+'],
    ['0', null],
    ['+/-', 'sign'],
    ['.', 'decimal'],
    ['+', '+'],
    ['=', 'equals'],
    ['Int', 'int'],
  ],
  [
    ['Dat', 'Dat'],
    ['tan', 'tan'],
    ['x^2', 'square'],
    ['1/x', 'reciprocal'],
    ['pi', 'pi'],
    ['A', null],
    ['B', null],
    ['C', null],
    ['D', null],
    ['E', null],
    ['F', null],
  ],
]

export function Scientific({ state, dispatch }: { state: Calculator; dispatch: Dispatch<Action> }) {
  const [statistics, setStatistics] = useState(false)
  const [selected, setSelected] = useState(0)
  const selection = state.samples.some((sample) => sample.id === selected)
    ? selected
    : (state.samples.at(-1)?.id ?? 0)
  const group = useId()
  return (
    <>
      <div className="flex justify-between py-[8px]">
        <fieldset className="flex gap-[12px]" aria-label="Number base">
          {(
            [
              { label: 'Hex', base: 16 },
              { label: 'Dec', base: 10 },
              { label: 'Oct', base: 8 },
              { label: 'Bin', base: 2 },
            ] as const
          ).map(({ label, base }) => (
            <Radio
              key={base}
              label={label}
              name={`${group}-base`}
              checked={state.base === base}
              onChange={() => dispatch({ kind: 'base', base })}
            />
          ))}
        </fieldset>
        <fieldset className="flex gap-[10px]" aria-label={state.base === 10 ? 'Angle unit' : 'Word size'}>
          {state.base === 10
            ? (
                [
                  { label: 'Degrees', angle: 'degrees' },
                  { label: 'Radians', angle: 'radians' },
                  { label: 'Grads', angle: 'grads' },
                ] as const
              ).map(({ label, angle }) => (
                <Radio
                  key={angle}
                  label={label}
                  name={`${group}-angle`}
                  checked={state.angle === angle}
                  onChange={() => dispatch({ kind: 'angle', angle })}
                />
              ))
            : (
                [
                  { label: 'Dword', bits: 32 },
                  { label: 'Word', bits: 16 },
                  { label: 'Byte', bits: 8 },
                ] as const
              ).map(({ label, bits }) => (
                <Radio
                  key={bits}
                  label={label}
                  name={`${group}-word`}
                  checked={state.bits === bits}
                  onChange={() => dispatch({ kind: 'word', bits })}
                />
              ))}
        </fieldset>
      </div>
      <div className="mb-[9px] flex items-center gap-[8px]">
        <Checkbox
          label="Inv"
          checked={state.inverse}
          onChange={() => dispatch({ kind: 'toggle', option: 'inverse' })}
        />
        <Checkbox
          label="Hyp"
          checked={state.hyperbolic}
          disabled={state.base !== 10}
          onChange={() => dispatch({ kind: 'toggle', option: 'hyperbolic' })}
        />
        <output
          aria-label="Parentheses indicator"
          className="bevel-sunken w-[35px] h-[27px] grid place-items-center"
        >
          {state.parentheses.length ? `(=${state.parentheses.length}` : ''}
        </output>
        <output
          aria-label="Memory indicator"
          className="bevel-sunken w-[35px] h-[27px] grid place-items-center"
        >
          {state.memory ? 'M' : ''}
        </output>
        <div className="flex flex-1 justify-end gap-[5px]">
          {(
            [
              { label: 'Back', key: 'back' },
              { label: 'CE', key: 'clearEntry' },
              { label: 'C', key: 'clear' },
            ] satisfies { label: string; key: Key }[]
          ).map(({ label, key }) => (
            <Button
              key={key}
              className="min-w-0! w-[65px] h-[27px]! text-[#800000]"
              onClick={() => dispatch({ kind: 'key', key })}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-11 gap-[5px]">
        {rows.flatMap((row) =>
          row.map(([label, key], column) => (
            <Button
              key={label}
              className={`min-w-0! h-[27px]! px-0! ${column === 0 ? 'text-[#800080]' : key && (column === 4 || column >= 8) ? 'text-[#800000]' : 'text-[#000080]'}`}
              disabled={
                key
                  ? (state.base !== 10 && decimalOnly.includes(key)) ||
                    (['Ave', 'Sum', 's'].includes(key) && !state.samples.length)
                  : label === 'Sta'
                    ? state.base !== 10
                    : Number.parseInt(label, 16) >= state.base
              }
              onClick={() =>
                label === 'Sta'
                  ? setStatistics(true)
                  : dispatch(key ? { kind: 'key', key } : { kind: 'digit', digit: label })
              }
            >
              {label}
            </Button>
          )),
        )}
      </div>
      {statistics && (
        <ModelessDialog title="Statistics Box" onClose={() => setStatistics(false)} className="w-[255px]">
          <div className="p-[10px] flex flex-col gap-[8px]">
            <select
              aria-label="Statistical data"
              size={6}
              className="bevel-sunken bg-white h-[100px] outline-none"
              value={selection}
              onChange={(event) => setSelected(Number(event.target.value))}
            >
              {state.samples.map((sample) => (
                <option key={sample.id} value={sample.id}>
                  {sample.value}
                </option>
              ))}
            </select>
            <p>Count = {state.samples.length}</p>
            <div className="grid grid-cols-2 gap-[6px]">
              <Button
                disabled={!state.samples.length}
                onClick={() => dispatch({ kind: 'statistics', command: 'delete', id: selection })}
              >
                CD
              </Button>
              <Button onClick={() => dispatch({ kind: 'statistics', command: 'clear' })}>CAD</Button>
              <Button onClick={() => dispatch({ kind: 'key', key: 'Dat' })}>Add</Button>
              <Button onClick={() => setStatistics(false)}>RET</Button>
            </div>
          </div>
        </ModelessDialog>
      )}
    </>
  )
}
