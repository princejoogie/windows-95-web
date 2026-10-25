import { type ReactNode, useEffect, useRef, useState } from 'react'
import { PALETTE, pixelArt } from '../../icons/pixel'
import { Button } from '../../ui'
import type { Brush, FillMode } from './bitmap'
import {
  brushes,
  eraserSizes,
  type Options,
  sprayRadii,
  type Tool,
  type ToolInfo,
  tools,
  widths,
  zoomLevels,
} from './tools'

/** Glyph rows use `x` for ink, black normally and white on the navy of a chosen option. */
const glyph = (rows: readonly string[]) => ({
  normal: pixelArt(rows, { ...PALETTE, x: '#000000' }),
  chosen: pixelArt(rows, { ...PALETTE, x: '#ffffff' }),
})
function brushRows(brush: Brush, size: number): string[] {
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      if (brush === 'round')
        return (x - (size - 1) / 2) ** 2 + (y - (size - 1) / 2) ** 2 <= (size / 2) ** 2 ? 'x' : '.'
      if (brush === 'slash') return x + y === size - 1 ? 'x' : '.'
      if (brush === 'backslash') return x === y ? 'x' : '.'
      return 'x'
    }).join(''),
  )
}
const brushGlyphs = brushes.map(({ brush, size }) => glyph(brushRows(brush, size)))
const sprayGlyphs = [
  glyph(['..x.x', '.x.x.x', 'x.x.x', '.x.x.x', '..x.x']),
  glyph([
    '...x.x.x',
    '..x...x.x',
    '.x.x.x...x',
    'x...x.x.x',
    '.x.x...x.x',
    'x...x.x.x',
    '.x.x...x',
    '..x.x.x',
  ]),
  glyph([
    '....x.x.x.x',
    '..x...x...x.x',
    '.x.x.x...x...x',
    'x...x...x.x.x',
    '.x.x...x...x.x',
    'x...x.x...x...x',
    '.x.x...x.x.x.x',
    'x...x.x...x..x',
    '.x.x...x.x.x',
    '..x.x.x...x',
    '....x...x',
  ]),
]
const opaqueGlyphs = {
  opaque: pixelArt([
    'kkkkkkkkkkkkkkkkkkkkkkk',
    'kwwwwwwwwwwwwwwwwwwwwwk',
    'kwwwwwbbbbwwwwwwwwwwwwk',
    'kwwwwbbbbbbwwwwwwwwwwwk',
    'kwwwbbbbbbbbwwwrrrrrwwk',
    'kwwwbbbbbbbbwwwrrrrrwwk',
    'kwwwwbbbbbbwwwwrrrrrwwk',
    'kwwwwwbbbbwwwwwrrrrrwwk',
    'kwwwwwwwwwwwwwwwwwwwwwk',
    'kkkkkkkkkkkkkkkkkkkkkkk',
  ]),
  transparent: pixelArt([
    'k.k.k.k.k.k.k.k.k.k.k.k',
    '.......................',
    'k.....bbbb............k',
    '.....bbbbbb............',
    'k..bbbbbbbbb...rrrrr..k',
    '...bbbbbbbbb...rrrrr...',
    'k....bbbbbb....rrrrr..k',
    '......bbbb.....rrrrr...',
    'k.....................k',
    '.k.k.k.k.k.k.k.k.k.k.k.',
  ]),
}

function Choice({
  chosen,
  label,
  onChoose,
  className = '',
  children,
}: {
  chosen: boolean
  label: string
  onChoose: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={chosen}
      className={`flex items-center justify-center outline-none ${chosen ? 'bg-select text-white' : ''} ${className}`}
      onPointerDown={(event) => event.preventDefault()}
      onClick={onChoose}
    >
      {children}
    </button>
  )
}

function OptionBox({
  info,
  options,
  zoom,
  onOptions,
  onZoom,
}: {
  info: ToolInfo
  options: Options
  zoom: number
  onOptions: (options: Options) => void
  onZoom: (zoom: number) => void
}) {
  const set = (change: Partial<Options>) => onOptions({ ...options, ...change })
  switch (info.options) {
    case 'opaque':
      return (
        <div className="flex flex-col gap-[2px] p-[2px]">
          {([true, false] as const).map((opaque) => (
            <Choice
              key={String(opaque)}
              chosen={options.opaque === opaque}
              label={opaque ? 'Opaque' : 'Transparent'}
              className="h-[25px]"
              onChoose={() => set({ opaque })}
            >
              <img src={opaque ? opaqueGlyphs.opaque : opaqueGlyphs.transparent} alt="" />
            </Choice>
          ))}
        </div>
      )
    case 'width':
      return (
        <div className="flex flex-col gap-[1px] p-[2px]">
          {widths.map((width) => (
            <Choice
              key={width}
              chosen={options.width === width}
              label={`Line width ${width}`}
              className="h-[11px] px-[3px]"
              onChoose={() => set({ width })}
            >
              <span className="block w-full bg-current" style={{ height: width }} />
            </Choice>
          ))}
        </div>
      )
    case 'eraser':
      return (
        <div className="flex flex-col p-[2px]">
          {eraserSizes.map((eraser) => (
            <Choice
              key={eraser}
              chosen={options.eraser === eraser}
              label={`Eraser size ${eraser}`}
              className="h-[15px]"
              onChoose={() => set({ eraser })}
            >
              <span className="block bg-current" style={{ width: eraser, height: eraser }} />
            </Choice>
          ))}
        </div>
      )
    case 'zoom':
      return (
        <div className="flex flex-col p-[2px]">
          {zoomLevels.map((level) => (
            <Choice
              key={level}
              chosen={zoom === level}
              label={`${level}x zoom`}
              className="h-[15px]"
              onChoose={() => onZoom(level)}
            >
              {level}x
            </Choice>
          ))}
        </div>
      )
    case 'brush':
      return (
        <div className="grid grid-cols-3 p-[2px] gap-y-[3px]">
          {brushes.map(({ brush, size }, index) => {
            const chosen = options.brush === brush && options.brushSize === size
            const art = brushGlyphs[index]
            return (
              <Choice
                key={`${brush}-${size}`}
                chosen={chosen}
                label={`${brush} brush ${size}`}
                className="h-[12px]"
                onChoose={() => set({ brush, brushSize: size })}
              >
                <img src={chosen ? art?.chosen : art?.normal} alt="" />
              </Choice>
            )
          })}
        </div>
      )
    case 'spray':
      return (
        <div className="grid grid-cols-2 p-[2px] gap-[2px]">
          {sprayRadii.map((spray, index) => {
            const chosen = options.spray === spray
            const art = sprayGlyphs[index]
            return (
              <Choice
                key={spray}
                chosen={chosen}
                label={`Airbrush size ${spray}`}
                className={index === 2 ? 'col-span-2 h-[22px]' : 'h-[20px]'}
                onChoose={() => set({ spray })}
              >
                <img src={chosen ? art?.chosen : art?.normal} alt="" />
              </Choice>
            )
          })}
        </div>
      )
    case 'fill':
      return (
        <div className="flex flex-col gap-[3px] p-[3px]">
          {(['outline', 'both', 'solid'] satisfies FillMode[]).map((fill) => (
            <Choice
              key={fill}
              chosen={options.fill === fill}
              label={`${fill} shape`}
              className="h-[17px] px-[4px]"
              onChoose={() => set({ fill })}
            >
              <span
                className="block h-[10px] w-full"
                style={{
                  border: fill === 'solid' ? 'none' : '1px solid currentColor',
                  background: fill === 'outline' ? 'transparent' : '#808080',
                }}
              />
            </Choice>
          ))}
        </div>
      )
    default:
      return null
  }
}

/** A Windows tooltip: pale yellow with a black border, shown after the pointer rests. */
function useTooltip() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return {
    tip,
    show(text: string, x: number, y: number) {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setTip({ text, x, y }), 500)
    },
    hide() {
      clearTimeout(timer.current)
      setTip(null)
    },
  }
}

export function ToolBox({
  tool,
  options,
  zoom,
  onTool,
  onOptions,
  onZoom,
  onHelp,
}: {
  tool: Tool
  options: Options
  zoom: number
  onTool: (tool: Tool) => void
  onOptions: (options: Options) => void
  onZoom: (zoom: number) => void
  onHelp: (help: string | null) => void
}) {
  const tooltip = useTooltip()
  const info = tools.find((entry) => entry.id === tool) ?? tools[0]
  return (
    <div className="relative w-[56px] shrink-0 pl-[3px] pr-[2px] pt-[1px]" data-paint="toolbox">
      <div className="grid grid-cols-2">
        {tools.map((entry) => (
          <Button
            key={entry.id}
            aria-label={entry.label}
            aria-pressed={tool === entry.id}
            pressed={tool === entry.id}
            className="min-w-0! w-[25px]! h-[25px]! p-0!"
            onPointerEnter={(event) => {
              onHelp(entry.help)
              const box = event.currentTarget.getBoundingClientRect()
              tooltip.show(entry.label, box.left + 12, box.bottom + 4)
            }}
            onPointerLeave={() => {
              onHelp(null)
              tooltip.hide()
            }}
            onPointerDown={() => tooltip.hide()}
            onClick={() => onTool(entry.id)}
          >
            <img src={entry.icon} alt="" className="mx-auto size-4" />
          </Button>
        ))}
      </div>
      <div className="bevel-sunken mx-auto mt-[4px] h-[66px] w-[41px]" data-paint="options">
        {info && (
          <OptionBox info={info} options={options} zoom={zoom} onOptions={onOptions} onZoom={onZoom} />
        )}
      </div>
      {tooltip.tip && (
        <div
          role="tooltip"
          className="fixed z-[10000] pointer-events-none whitespace-nowrap border border-black bg-[#ffffe1] px-[2px] leading-[14px]"
          style={{ left: tooltip.tip.x, top: tooltip.tip.y }}
        >
          {tooltip.tip.text}
        </div>
      )}
    </div>
  )
}
