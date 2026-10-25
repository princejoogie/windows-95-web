import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { Button, Dialog, GroupBox, MessageBox, Radio, TextBox } from '../../ui'
import { hex, type Transform } from './bitmap'
import { basicColors, fromHsl, type Hsl, toHsl } from './colors'

/** A dialog body that starts on its first control and takes Enter as OK, as Windows dialogs do. */
function DialogForm({
  focus,
  className,
  onSubmit,
  children,
}: {
  focus: string
  className: string
  onSubmit: () => void
  children: ReactNode
}) {
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    form.current?.querySelector<HTMLElement>(focus)?.focus()
  }, [focus])
  return (
    <form
      ref={form}
      className={className}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' || event.target instanceof HTMLButtonElement) return
        event.preventDefault()
        event.currentTarget.requestSubmit()
      }}
    >
      {children}
    </form>
  )
}
function Buttons({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-[6px] shrink-0">{children}</div>
}
function OkCancel({ onCancel, extra }: { onCancel: () => void; extra?: ReactNode }) {
  return (
    <Buttons>
      <Button type="submit" isDefault>
        OK
      </Button>
      <Button onClick={onCancel}>Cancel</Button>
      {extra}
    </Buttons>
  )
}
function useError() {
  const [error, setError] = useState<string | null>(null)
  return {
    setError,
    box: error && (
      <MessageBox
        title="Paint"
        icon="warning"
        message={error}
        buttons={['OK']}
        onClose={() => setError(null)}
      />
    ),
  }
}

type Units = 'inches' | 'cm' | 'pels'
const PER_UNIT: Record<Units, number> = { inches: 96, cm: 96 / 2.54, pels: 1 }
const shown = (pixels: number, units: Units) =>
  units === 'pels' ? String(pixels) : (pixels / PER_UNIT[units]).toFixed(2)

export function AttributesDialog({
  width,
  height,
  saved,
  bytes,
  monochrome,
  defaults,
  onApply,
  onClose,
}: {
  width: number
  height: number
  saved: string | null
  bytes: number | null
  monochrome: boolean
  defaults: { width: number; height: number }
  onApply: (width: number, height: number, monochrome: boolean) => void
  onClose: () => void
}) {
  const [units, setUnits] = useState<Units>('pels')
  const [fields, setFields] = useState({ width: String(width), height: String(height) })
  const [mono, setMono] = useState(monochrome)
  const { setError, box } = useError()
  const id = useId()
  const switchUnits = (next: Units) => {
    const toPixels = (value: string) => Math.round(Number(value) * PER_UNIT[units])
    setFields({ width: shown(toPixels(fields.width), next), height: shown(toPixels(fields.height), next) })
    setUnits(next)
  }
  return (
    <Dialog title="Attributes" onClose={onClose} className="w-[300px]">
      <DialogForm
        focus={'input[aria-label="Width"]'}
        className="flex gap-[10px] p-[10px]"
        onSubmit={() => {
          const w = Math.round(Number(fields.width) * PER_UNIT[units]),
            h = Math.round(Number(fields.height) * PER_UNIT[units])
          if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1 || w > 2048 || h > 2048) {
            setError('Please enter a width and height between 1 and 2048 pels.')
            return
          }
          onApply(w, h, mono)
        }}
      >
        <div className="flex flex-1 flex-col gap-[8px]">
          <dl className="grid grid-cols-[auto_1fr] gap-x-[10px] gap-y-[2px]">
            <dt>File last saved:</dt>
            <dd>{saved ?? 'Not Available'}</dd>
            <dt>Size on disk:</dt>
            <dd>{bytes === null ? 'Not Available' : `${bytes.toLocaleString('en-US')} bytes`}</dd>
          </dl>
          <div className="flex items-center gap-[6px]">
            <label htmlFor={`${id}-w`}>
              <span className="underline">W</span>idth:
            </label>
            <TextBox
              id={`${id}-w`}
              aria-label="Width"
              className="w-[48px]"
              value={fields.width}
              onChange={(event) => setFields({ ...fields, width: event.target.value })}
            />
            <label htmlFor={`${id}-h`} className="ml-[6px]">
              <span className="underline">H</span>eight:
            </label>
            <TextBox
              id={`${id}-h`}
              aria-label="Height"
              className="w-[48px]"
              value={fields.height}
              onChange={(event) => setFields({ ...fields, height: event.target.value })}
            />
          </div>
          <GroupBox label="Units">
            <div className="flex gap-[12px]">
              {(
                [
                  ['inches', 'Inches'],
                  ['cm', 'Cm'],
                  ['pels', 'Pels'],
                ] as const
              ).map(([value, label]) => (
                <Radio
                  key={value}
                  name={`${id}-units`}
                  label={label}
                  checked={units === value}
                  onChange={() => switchUnits(value)}
                />
              ))}
            </div>
          </GroupBox>
          <GroupBox label="Colors">
            <div className="flex gap-[12px]">
              <Radio
                name={`${id}-colors`}
                label="Black and white"
                checked={mono}
                onChange={() => setMono(true)}
              />
              <Radio name={`${id}-colors`} label="Colors" checked={!mono} onChange={() => setMono(false)} />
            </div>
          </GroupBox>
        </div>
        <OkCancel
          onCancel={onClose}
          extra={
            <Button
              onClick={() =>
                setFields({ width: shown(defaults.width, units), height: shown(defaults.height, units) })
              }
            >
              Default
            </Button>
          }
        />
      </DialogForm>
      {box}
    </Dialog>
  )
}

export function FlipRotateDialog({
  onApply,
  onClose,
}: {
  onApply: (kind: Exclude<Transform, 'invert'>) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<'horizontal' | 'vertical' | 'rotate'>('horizontal')
  const [angle, setAngle] = useState<'90' | '180' | '270'>('90')
  const id = useId()
  return (
    <Dialog title="Flip and Rotate" onClose={onClose} className="w-[270px]">
      <DialogForm
        focus={'input[type="radio"]:checked'}
        className="flex gap-[10px] p-[10px]"
        onSubmit={() => {
          onApply(mode === 'rotate' ? angle : mode)
        }}
      >
        <GroupBox label="Flip or rotate" className="flex-1">
          <div className="flex flex-col gap-[4px]">
            <Radio
              name={`${id}-mode`}
              label="Flip horizontal"
              checked={mode === 'horizontal'}
              onChange={() => setMode('horizontal')}
            />
            <Radio
              name={`${id}-mode`}
              label="Flip vertical"
              checked={mode === 'vertical'}
              onChange={() => setMode('vertical')}
            />
            <Radio
              name={`${id}-mode`}
              label="Rotate by angle"
              checked={mode === 'rotate'}
              onChange={() => setMode('rotate')}
            />
            <div className={`flex flex-col gap-[4px] pl-[20px] ${mode === 'rotate' ? '' : 'text-embossed'}`}>
              {(['90', '180', '270'] as const).map((value) => (
                <Radio
                  key={value}
                  name={`${id}-angle`}
                  label={`${value}°`}
                  disabled={mode !== 'rotate'}
                  checked={angle === value}
                  onChange={() => setAngle(value)}
                />
              ))}
            </div>
          </div>
        </GroupBox>
        <OkCancel onCancel={onClose} />
      </DialogForm>
    </Dialog>
  )
}

const stretchArt = {
  horizontal: 'M1 4h14M1 4l3-3M1 4l3 3M15 4l-3-3M15 4l-3 3',
  vertical: 'M8 1v14M8 1l-3 3M8 1l3 3M8 15l-3-3M8 15l3-3',
  skewH: 'M4 2h10l-4 12H0z',
  skewV: 'M2 4l12-4v10L2 14z',
}
function Glyph({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" className="shrink-0">
      <path d={d} fill="none" stroke="#000" />
    </svg>
  )
}

export function StretchSkewDialog({
  onApply,
  onClose,
}: {
  onApply: (
    stretch: { horizontal: number; vertical: number },
    skew: { horizontal: number; vertical: number },
  ) => void
  onClose: () => void
}) {
  const [values, setValues] = useState({ sh: '100', sv: '100', kh: '0', kv: '0' })
  const { setError, box } = useError()
  const id = useId()
  const row = (key: keyof typeof values, label: string, art: string, unit: string) => (
    <div className="flex items-center gap-[6px]">
      <Glyph d={art} />
      <label htmlFor={`${id}-${key}`} className="w-[64px]">
        {label}
      </label>
      <TextBox
        id={`${id}-${key}`}
        aria-label={`${unit === '%' ? 'Stretch' : 'Skew'} ${label.replace(':', '')}`}
        className="w-[40px]"
        value={values[key]}
        onChange={(event) => setValues({ ...values, [key]: event.target.value })}
      />
      <span>{unit}</span>
    </div>
  )
  return (
    <Dialog title="Stretch and Skew" onClose={onClose} className="w-[300px]">
      <DialogForm
        focus={'input'}
        className="flex gap-[10px] p-[10px]"
        onSubmit={() => {
          const [sh, sv, kh, kv] = [values.sh, values.sv, values.kh, values.kv].map(Number) as [
            number,
            number,
            number,
            number,
          ]
          if (![sh, sv].every((value) => Number.isInteger(value) && value >= 1 && value <= 500)) {
            setError('Please enter an integer between 1 and 500.')
            return
          }
          if (![kh, kv].every((value) => Number.isInteger(value) && value >= -89 && value <= 89)) {
            setError('Please enter an integer between -89 and 89.')
            return
          }
          onApply({ horizontal: sh, vertical: sv }, { horizontal: kh, vertical: kv })
        }}
      >
        <div className="flex flex-1 flex-col gap-[8px]">
          <GroupBox label="Stretch">
            <div className="flex flex-col gap-[4px]">
              {row('sh', 'Horizontal:', stretchArt.horizontal, '%')}
              {row('sv', 'Vertical:', stretchArt.vertical, '%')}
            </div>
          </GroupBox>
          <GroupBox label="Skew">
            <div className="flex flex-col gap-[4px]">
              {row('kh', 'Horizontal:', stretchArt.skewH, 'Degrees')}
              {row('kv', 'Vertical:', stretchArt.skewV, 'Degrees')}
            </div>
          </GroupBox>
        </div>
        <OkCancel onCancel={onClose} />
      </DialogForm>
      {box}
    </Dialog>
  )
}

export function CustomZoomDialog({
  zoom,
  onApply,
  onClose,
}: {
  zoom: number
  onApply: (zoom: number) => void
  onClose: () => void
}) {
  const [choice, setChoice] = useState(zoom)
  const id = useId()
  return (
    <Dialog title="Custom Zoom" onClose={onClose} className="w-[330px]">
      <DialogForm
        focus={'input[type="radio"]:checked'}
        className="flex gap-[10px] p-[10px]"
        onSubmit={() => {
          onApply(choice)
        }}
      >
        <div className="flex flex-1 flex-col gap-[8px]">
          <p>Current zoom: {zoom * 100}%</p>
          <GroupBox label="Zoom to">
            <div className="grid grid-cols-3 gap-[4px]">
              {[1, 2, 4, 6, 8].map((level) => (
                <Radio
                  key={level}
                  name={`${id}-zoom`}
                  label={`${level * 100}%`}
                  checked={choice === level}
                  onChange={() => setChoice(level)}
                />
              ))}
            </div>
          </GroupBox>
        </div>
        <OkCancel onCancel={onClose} />
      </DialogForm>
    </Dialog>
  )
}

const custom: string[] = Array.from({ length: 16 }, () => '#ffffff')
const SPECTRUM = { width: 175, height: 151 }

function Spectrum({ hsl, onPick }: { hsl: Hsl; onPick: (hue: number, sat: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    const data = context.createImageData(SPECTRUM.width, SPECTRUM.height)
    for (let y = 0; y < SPECTRUM.height; y++)
      for (let x = 0; x < SPECTRUM.width; x++) {
        const color = fromHsl({
          hue: (x / (SPECTRUM.width - 1)) * 239,
          sat: 240 - (y / (SPECTRUM.height - 1)) * 240,
          lum: 120,
        })
        const offset = (y * SPECTRUM.width + x) * 4
        data.data.set(
          [
            Number.parseInt(color.slice(1, 3), 16),
            Number.parseInt(color.slice(3, 5), 16),
            Number.parseInt(color.slice(5, 7), 16),
            255,
          ],
          offset,
        )
      }
    context.putImageData(data, 0, 0)
  }, [])
  const pick = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(SPECTRUM.width - 1, event.clientX - box.left)),
      y = Math.max(0, Math.min(SPECTRUM.height - 1, event.clientY - box.top))
    onPick(Math.round((x / (SPECTRUM.width - 1)) * 239), Math.round(240 - (y / (SPECTRUM.height - 1)) * 240))
  }
  const cx = (hsl.hue / 239) * (SPECTRUM.width - 1),
    cy = ((240 - hsl.sat) / 240) * (SPECTRUM.height - 1)
  return (
    <div className="relative bevel-sunken p-[2px]">
      <canvas
        ref={canvas}
        width={SPECTRUM.width}
        height={SPECTRUM.height}
        aria-label="Color spectrum"
        className="block"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          pick(event)
        }}
        onPointerMove={(event) => event.buttons && pick(event)}
      />
      <svg
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{ left: cx - 7, top: cy - 7 }}
        width="19"
        height="19"
      >
        <path d="M9 0v6M9 13v6M0 9h6M13 9h6" stroke="#000" strokeWidth="3" shapeRendering="crispEdges" />
      </svg>
    </div>
  )
}

/** The strip beside the spectrum: the chosen hue and saturation from white to black, with an arrow. */
function Luminosity({ hsl, onPick }: { hsl: Hsl; onPick: (lum: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const { hue, sat } = hsl
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    for (let y = 0; y < SPECTRUM.height; y++) {
      context.fillStyle = fromHsl({ hue, sat, lum: 240 - (y / (SPECTRUM.height - 1)) * 240 })
      context.fillRect(0, y, 10, 1)
    }
  }, [hue, sat])
  const pick = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const y = Math.max(0, Math.min(SPECTRUM.height - 1, event.clientY - box.top - 2))
    onPick(Math.round(240 - (y / (SPECTRUM.height - 1)) * 240))
  }
  return (
    <div
      role="slider"
      aria-label="Luminosity"
      aria-valuemin={0}
      aria-valuemax={240}
      aria-valuenow={hsl.lum}
      tabIndex={0}
      className="relative w-[24px] outline-none"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        pick(event)
      }}
      onPointerMove={(event) => event.buttons && pick(event)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') onPick(Math.min(240, hsl.lum + 1))
        if (event.key === 'ArrowDown') onPick(Math.max(0, hsl.lum - 1))
      }}
    >
      <span className="block w-[14px] bevel-sunken p-[2px]">
        <canvas ref={canvas} width={10} height={SPECTRUM.height} className="block" />
      </span>
      <svg
        aria-hidden="true"
        className="absolute left-[16px] pointer-events-none"
        style={{ top: 2 + ((240 - hsl.lum) / 240) * (SPECTRUM.height - 1) - 4 }}
        width="7"
        height="9"
        shapeRendering="crispEdges"
      >
        <path d="M0 4L6 0V8z" />
      </svg>
    </div>
  )
}

export function EditColorsDialog({
  color,
  onApply,
  onClose,
}: {
  color: string
  onApply: (color: string) => void
  onClose: () => void
}) {
  const [current, setCurrent] = useState(color)
  const [hsl, setHsl] = useState(() => toHsl(color))
  const [expanded, setExpanded] = useState(false)
  const [slot, setSlot] = useState(0)
  const [, refresh] = useState(0)
  const choose = (next: string) => {
    setCurrent(next)
    setHsl(toHsl(next))
  }
  const fromFields = (next: Hsl) => {
    setHsl(next)
    setCurrent(fromHsl(next))
  }
  const channels = [1, 3, 5].map((start) => Number.parseInt(current.slice(start, start + 2), 16))
  const withChannel = (index: number) => (value: number) =>
    choose(hex(channels.map((channel, i) => (i === index ? value : channel))))
  const swatch = (value: string, index: number, onPick: () => void, label: string) => (
    <button
      type="button"
      key={`${label}-${index}`}
      aria-label={`${label} ${value}`}
      aria-pressed={current === value}
      className={`size-[19px] p-[2px] outline-none ${current === value ? 'outline-1 outline-dotted outline-black' : ''}`}
      onClick={onPick}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        event.currentTarget.form?.requestSubmit()
      }}
    >
      <span className="block size-full bevel-sunken" style={{ backgroundColor: value }} />
    </button>
  )
  const fieldId = useId()
  const field = (label: string, value: number, max: number, set: (value: number) => void) => (
    <div className="flex items-center justify-end gap-[4px]">
      <label htmlFor={`${fieldId}-${label}`}>{label}</label>
      <TextBox
        id={`${fieldId}-${label}`}
        aria-label={label.replace(':', '')}
        className="w-[30px]"
        value={value}
        onChange={(event) => {
          const parsed = Number(event.target.value)
          if (Number.isInteger(parsed) && parsed >= 0 && parsed <= max) set(parsed)
        }}
      />
    </div>
  )
  return (
    <Dialog title="Edit Colors" onClose={onClose} className={expanded ? 'w-[450px]' : 'w-[226px]'}>
      <DialogForm
        focus={'button[aria-pressed="true"], button[type="submit"]'}
        className="flex gap-[10px] p-[8px]"
        onSubmit={() => {
          onApply(current)
        }}
      >
        <div className="flex w-[204px] shrink-0 flex-col gap-[4px]">
          <span>
            <span className="underline">B</span>asic colors:
          </span>
          <div className="grid grid-cols-8">
            {basicColors.map((value, index) => swatch(value, index, () => choose(value), 'Basic color'))}
          </div>
          <span className="mt-[6px]">
            <span className="underline">C</span>ustom colors:
          </span>
          <div className="grid grid-cols-8">
            {custom.map((value, index) =>
              swatch(
                value,
                index,
                () => {
                  setSlot(index)
                  choose(value)
                },
                'Custom color',
              ),
            )}
          </div>
          <Button className="mt-[8px] w-full" disabled={expanded} onClick={() => setExpanded(true)}>
            <span className="underline">D</span>efine Custom Colors &gt;&gt;
          </Button>
          <div className="mt-[8px] flex gap-[6px]">
            <Button type="submit" isDefault>
              OK
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </div>
        </div>
        {expanded && (
          <div className="flex flex-col gap-[6px]">
            <div className="flex gap-[6px]">
              <Spectrum hsl={hsl} onPick={(hue, sat) => fromFields({ ...hsl, hue, sat })} />
              <Luminosity hsl={hsl} onPick={(lum) => fromFields({ ...hsl, lum })} />
            </div>
            <div className="flex gap-[6px]">
              <div className="flex flex-col items-center">
                <span className="block h-[40px] w-[60px] bevel-sunken" style={{ backgroundColor: current }} />
                <span>Color|Solid</span>
              </div>
              <div className="grid grid-cols-2 gap-x-[6px] gap-y-[2px]">
                {field('Hue:', hsl.hue, 239, (hue) => fromFields({ ...hsl, hue }))}
                {field('Red:', channels[0] ?? 0, 255, withChannel(0))}
                {field('Sat:', hsl.sat, 240, (sat) => fromFields({ ...hsl, sat }))}
                {field('Green:', channels[1] ?? 0, 255, withChannel(1))}
                {field('Lum:', hsl.lum, 240, (lum) => fromFields({ ...hsl, lum }))}
                {field('Blue:', channels[2] ?? 0, 255, withChannel(2))}
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                custom[slot] = current
                setSlot((slot + 1) % custom.length)
                refresh((n) => n + 1)
              }}
            >
              <span className="underline">A</span>dd to Custom Colors
            </Button>
          </div>
        )}
      </DialogForm>
    </Dialog>
  )
}
