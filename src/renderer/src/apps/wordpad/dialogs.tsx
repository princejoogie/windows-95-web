import { type ReactNode, useId, useState } from 'react'
import { wallClockDate } from '../../settings/clock'
import { settingsStore } from '../../settings/store'
import { Button, Checkbox, ComboBox, Dialog, GroupBox, ListBox, Radio, Tabs, TextBox } from '../../ui'
import { FONT_SIZES, FONTS, scriptsFor } from './fonts'
import { runCss } from './html'
import type { Alignment, ParagraphStyle, RunStyle } from './model'
import {
  DOCUMENT_TYPES,
  type DocumentType,
  dateTimeFormats,
  formatMeasure,
  type Options,
  PAPER_SIZES,
  type PageSetup,
  pageArea,
  parseMeasure,
  type TypeOptions,
  type Units,
  type WordWrap,
} from './options'
import type { SearchOptions } from './search'
import { COLORS } from './Toolbar'

function Buttons({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-[6px]">{children}</div>
}

export function NewDialog({
  onSelect,
  onClose,
}: {
  onSelect: (type: DocumentType) => void
  onClose: () => void
}) {
  const [type, setType] = useState<DocumentType>('word6')
  const labels = DOCUMENT_TYPES.map((entry) => entry.label)
  const label = DOCUMENT_TYPES.find((entry) => entry.type === type)?.label ?? labels[0] ?? ''
  return (
    <Dialog title="New" onClose={onClose} className="w-[300px]">
      <form
        className="flex gap-[10px] p-[10px]"
        onSubmit={(event) => {
          event.preventDefault()
          onSelect(type)
        }}
      >
        <div className="flex flex-1 flex-col gap-[4px]">
          <span>New document type:</span>
          <ListBox
            label="New document type"
            items={labels}
            value={label}
            className="h-[90px]"
            onChange={(next) =>
              setType(DOCUMENT_TYPES.find((entry) => entry.label === next)?.type ?? 'word6')
            }
            onPick={(next) => onSelect(DOCUMENT_TYPES.find((entry) => entry.label === next)?.type ?? 'word6')}
          />
        </div>
        <Buttons>
          <Button type="submit" isDefault autoFocus>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </Buttons>
      </form>
    </Dialog>
  )
}

const STYLES = ['Regular', 'Italic', 'Bold', 'Bold Italic'] as const
type FontStyleName = (typeof STYLES)[number]

const styleName = (style: RunStyle): FontStyleName =>
  style.bold && style.italic ? 'Bold Italic' : style.bold ? 'Bold' : style.italic ? 'Italic' : 'Regular'

export function FontDialog({
  current,
  onApply,
  onClose,
}: {
  current: RunStyle
  onApply: (style: RunStyle) => void
  onClose: () => void
}) {
  const [style, setStyle] = useState<RunStyle>(current)
  const [sizeText, setSizeText] = useState(String(current.size))
  const id = useId()
  const fonts = FONTS.includes(style.font) ? FONTS : [style.font, ...FONTS]
  const setStyleName = (name: FontStyleName) =>
    setStyle((s) => ({ ...s, bold: name.startsWith('Bold'), italic: name.endsWith('Italic') }))
  const commitSize = (text: string) => {
    setSizeText(text)
    const size = Number(text)
    if (size >= 1 && size <= 1638) setStyle((s) => ({ ...s, size: Math.round(size * 2) / 2 }))
  }
  return (
    <Dialog title="Font" onClose={onClose} className="w-[430px]">
      <form
        className="flex flex-col gap-[8px] p-[10px]"
        onSubmit={(event) => {
          event.preventDefault()
          onApply(style)
        }}
      >
        <div className="flex gap-[8px]">
          <div className="flex w-[160px] flex-col gap-[2px]">
            <label htmlFor={`${id}-font`}>
              <span className="underline">F</span>ont:
            </label>
            <TextBox
              id={`${id}-font`}
              value={style.font}
              autoFocus
              onChange={(event) => setStyle((s) => ({ ...s, font: event.target.value }))}
            />
            <ListBox
              label="Font list"
              items={fonts}
              value={style.font}
              className="h-[96px]"
              onChange={(font) => setStyle((s) => ({ ...s, font }))}
            />
          </div>
          <div className="flex w-[110px] flex-col gap-[2px]">
            <label htmlFor={`${id}-style`}>
              Font st<span className="underline">y</span>le:
            </label>
            <TextBox id={`${id}-style`} value={styleName(style)} readOnly />
            <ListBox
              label="Font style"
              items={STYLES}
              value={styleName(style)}
              className="h-[96px]"
              onChange={setStyleName}
            />
          </div>
          <div className="flex w-[50px] flex-col gap-[2px]">
            <label htmlFor={`${id}-size`}>
              <span className="underline">S</span>ize:
            </label>
            <TextBox
              id={`${id}-size`}
              value={sizeText}
              onChange={(event) => commitSize(event.target.value)}
            />
            <ListBox
              label="Size list"
              items={FONT_SIZES}
              value={FONT_SIZES.includes(style.size) ? style.size : null}
              className="h-[96px]"
              onChange={(size) => commitSize(String(size))}
            />
          </div>
          <Buttons>
            <Button type="submit" isDefault>
              OK
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </Buttons>
        </div>
        <div className="flex gap-[8px]">
          <GroupBox label="Effects" className="w-[160px]">
            <div className="flex flex-col gap-[6px]">
              <Checkbox
                label={
                  <>
                    Stri<span className="underline">k</span>eout
                  </>
                }
                checked={style.strike}
                onChange={(event) => setStyle((s) => ({ ...s, strike: event.target.checked }))}
              />
              <Checkbox
                label={
                  <>
                    <span className="underline">U</span>nderline
                  </>
                }
                checked={style.underline}
                onChange={(event) => setStyle((s) => ({ ...s, underline: event.target.checked }))}
              />
              <label htmlFor={`${id}-color`} className="flex flex-col gap-[2px]">
                <span>
                  <span className="underline">C</span>olor:
                </span>
                <ComboBox
                  id={`${id}-color`}
                  aria-label="Color"
                  className=""
                  value={style.color}
                  onChange={(color) => setStyle((s) => ({ ...s, color }))}
                  options={COLORS.map((color) => ({ key: color.value, label: color.name }))}
                />
              </label>
            </div>
          </GroupBox>
          <div className="flex flex-1 flex-col gap-[6px]">
            <GroupBox label="Sample" className="h-[70px]">
              <div className="flex h-[44px] items-center justify-center overflow-hidden bg-white bevel-sunken">
                <span
                  className="whitespace-nowrap"
                  style={Object.fromEntries(
                    runCss(style)
                      .split(';')
                      .map((rule) => rule.split(':'))
                      .map(([key, value]) => [
                        (key ?? '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
                        value ?? '',
                      ]),
                  )}
                >
                  AaBbYyZz
                </span>
              </div>
            </GroupBox>
            <label htmlFor={`${id}-script`} className="flex flex-col gap-[2px]">
              <span>
                Sc<span className="underline">r</span>ipt:
              </span>
              <ComboBox
                id={`${id}-script`}
                aria-label="Script"
                className=""
                value={scriptsFor(style.font)[0] ?? ''}
                onChange={() => undefined}
                options={scriptsFor(style.font).map((script) => ({ key: script, label: script }))}
              />
            </label>
          </div>
        </div>
      </form>
    </Dialog>
  )
}

function MeasureBox({
  id,
  label,
  value,
  units,
  onChange,
}: {
  id: string
  label: ReactNode
  value: number
  units: Units
  onChange: (twips: number) => void
}) {
  const [text, setText] = useState(formatMeasure(value, units))
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-[8px]">
      <span>{label}</span>
      <TextBox
        id={id}
        className="w-[70px]"
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          const twips = parseMeasure(event.target.value, units)
          if (twips !== null) onChange(twips)
        }}
        onBlur={() => setText(formatMeasure(value, units))}
      />
    </label>
  )
}

export function ParagraphDialog({
  paragraph,
  units,
  onApply,
  onClose,
}: {
  paragraph: ParagraphStyle
  units: Units
  onApply: (patch: { left: number; right: number; first: number; align: Alignment }) => void
  onClose: () => void
}) {
  const [left, setLeft] = useState(paragraph.left)
  const [right, setRight] = useState(paragraph.right)
  const [first, setFirst] = useState(paragraph.first)
  const [align, setAlign] = useState<Alignment>(paragraph.align === 'justify' ? 'left' : paragraph.align)
  const id = useId()
  return (
    <Dialog title="Paragraph" onClose={onClose} className="w-[330px]">
      <form
        className="flex gap-[10px] p-[10px]"
        onSubmit={(event) => {
          event.preventDefault()
          onApply({ left, right, first, align })
        }}
      >
        <div className="flex flex-1 flex-col gap-[8px]">
          <GroupBox label="Indentation">
            <div className="flex flex-col gap-[6px]">
              <MeasureBox
                id={`${id}-left`}
                label={
                  <>
                    <span className="underline">L</span>eft:
                  </>
                }
                value={left}
                units={units}
                onChange={setLeft}
              />
              <MeasureBox
                id={`${id}-right`}
                label={
                  <>
                    <span className="underline">R</span>ight:
                  </>
                }
                value={right}
                units={units}
                onChange={setRight}
              />
              <MeasureBox
                id={`${id}-first`}
                label={
                  <>
                    <span className="underline">F</span>irst line:
                  </>
                }
                value={first}
                units={units}
                onChange={setFirst}
              />
            </div>
          </GroupBox>
          <label htmlFor={`${id}-align`} className="flex items-center justify-between gap-[8px]">
            <span>
              <span className="underline">A</span>lignment:
            </span>
            <ComboBox
              id={`${id}-align`}
              aria-label="Alignment"
              className="w-[110px]"
              value={align}
              onChange={(value) => {
                if (value === 'left' || value === 'right' || value === 'center') setAlign(value)
              }}
              options={['left', 'right', 'center'].map((key) => ({
                key,
                label: key.charAt(0).toUpperCase() + key.slice(1),
              }))}
            />
          </label>
        </div>
        <Buttons>
          <Button type="submit" isDefault autoFocus>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </Buttons>
      </form>
    </Dialog>
  )
}

export function TabsDialog({
  tabs,
  units,
  onApply,
  onClose,
}: {
  tabs: readonly number[]
  units: Units
  onApply: (tabs: readonly number[]) => void
  onClose: () => void
}) {
  const [stops, setStops] = useState<readonly number[]>(tabs)
  const [text, setText] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const id = useId()
  const typed = parseMeasure(text, units)
  const set = () => {
    if (typed === null || typed <= 0) return
    setStops((current) => [...new Set([...current, typed])].sort((a, b) => a - b))
    setText('')
  }
  const clear = () => {
    const target = selected ?? typed
    if (target === null) return
    setStops((current) => current.filter((stop) => stop !== target))
    setSelected(null)
    setText('')
  }
  return (
    <Dialog title="Tabs" onClose={onClose} className="w-[300px]">
      <form
        className="flex gap-[10px] p-[10px]"
        onSubmit={(event) => {
          event.preventDefault()
          if (typed !== null && typed > 0 && !stops.includes(typed)) {
            onApply([...new Set([...stops, typed])].sort((a, b) => a - b))
          } else onApply(stops)
        }}
      >
        <div className="flex flex-1 flex-col gap-[4px]">
          <label htmlFor={`${id}-position`}>
            <span className="underline">T</span>ab stop position:
          </label>
          <TextBox
            id={`${id}-position`}
            autoFocus
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setSelected(null)
            }}
          />
          <ListBox
            label="Tab stops"
            items={stops}
            value={selected}
            className="h-[96px]"
            render={(stop) => formatMeasure(stop, units)}
            onChange={(stop) => {
              setSelected(stop)
              setText(formatMeasure(stop, units))
            }}
          />
        </div>
        <Buttons>
          <Button type="submit" isDefault>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={set} disabled={typed === null || typed <= 0}>
            <span className="underline">S</span>et
          </Button>
          <Button onClick={clear} disabled={selected === null && typed === null}>
            Cl<span className="underline">e</span>ar
          </Button>
          <Button onClick={() => setStops([])} disabled={stops.length === 0}>
            Clear <span className="underline">A</span>ll
          </Button>
        </Buttons>
      </form>
    </Dialog>
  )
}

const OPTION_TABS: readonly { readonly tab: string; readonly type: DocumentType | null }[] = [
  { tab: 'Options', type: null },
  { tab: 'Text', type: 'text' },
  { tab: 'Rich Text', type: 'rtf' },
  { tab: 'Word', type: 'word6' },
  { tab: 'Write', type: 'write' },
  { tab: 'Embedded', type: 'embedded' },
]

export function OptionsDialog({
  options,
  initialType,
  onApply,
  onClose,
}: {
  options: Options
  initialType: DocumentType
  onApply: (options: Options) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(options)
  const [tab, setTab] = useState(OPTION_TABS.find((entry) => entry.type === initialType)?.tab ?? 'Options')
  const type = OPTION_TABS.find((entry) => entry.tab === tab)?.type ?? null
  const id = useId()
  const patchType = (patch: Partial<TypeOptions>) => {
    if (!type) return
    setDraft((d) => ({ ...d, types: { ...d.types, [type]: { ...d.types[type], ...patch } } }))
  }
  const current = type ? draft.types[type] : null
  const units: readonly { readonly value: Units; readonly label: string }[] = [
    { value: 'inches', label: 'Inches' },
    { value: 'cm', label: 'Centimeters' },
    { value: 'points', label: 'Points' },
    { value: 'picas', label: 'Picas' },
  ]
  return (
    <Dialog title="Options" onClose={onClose} className="w-[380px]">
      <form
        className="flex flex-col gap-[8px] p-[8px]"
        onSubmit={(event) => {
          event.preventDefault()
          onApply(draft)
        }}
      >
        <Tabs tabs={OPTION_TABS.map((entry) => entry.tab)} active={tab} onChange={setTab}>
          {current ? (
            <div className="flex gap-[12px]">
              <GroupBox label="Word wrap" className="flex-1">
                <div className="flex flex-col gap-[6px]">
                  {(
                    [
                      ['none', 'No wrap'],
                      ['window', 'Wrap to window'],
                      ['ruler', 'Wrap to ruler'],
                    ] as const
                  ).map(([value, label]) => (
                    <Radio
                      key={value}
                      name={`${id}-wrap`}
                      label={label}
                      checked={current.wordWrap === value}
                      onChange={() => patchType({ wordWrap: value as WordWrap })}
                    />
                  ))}
                </div>
              </GroupBox>
              <GroupBox label="Toolbars" className="flex-1">
                <div className="flex flex-col gap-[6px]">
                  <Checkbox
                    label="Toolbar"
                    checked={current.toolbar}
                    onChange={(e) => patchType({ toolbar: e.target.checked })}
                  />
                  <Checkbox
                    label="Format bar"
                    checked={current.formatBar}
                    onChange={(e) => patchType({ formatBar: e.target.checked })}
                  />
                  <Checkbox
                    label="Ruler"
                    checked={current.ruler}
                    onChange={(e) => patchType({ ruler: e.target.checked })}
                  />
                  <Checkbox
                    label="Status bar"
                    checked={current.statusBar}
                    onChange={(e) => patchType({ statusBar: e.target.checked })}
                  />
                </div>
              </GroupBox>
            </div>
          ) : (
            <div className="flex flex-col gap-[10px]">
              <GroupBox label="Measurement units">
                <div className="grid grid-cols-2 gap-[6px]">
                  {units.map((unit) => (
                    <Radio
                      key={unit.value}
                      name={`${id}-units`}
                      label={unit.label}
                      checked={draft.units === unit.value}
                      onChange={() => setDraft((d) => ({ ...d, units: unit.value }))}
                    />
                  ))}
                </div>
              </GroupBox>
              <Checkbox
                label="Automatic word selection"
                checked={draft.automaticWordSelection}
                onChange={(e) => setDraft((d) => ({ ...d, automaticWordSelection: e.target.checked }))}
              />
            </div>
          )}
        </Tabs>
        <div className="flex justify-end gap-[6px]">
          <Button type="submit" isDefault>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}

export function DateTimeDialog({
  onInsert,
  onClose,
}: {
  onInsert: (text: string) => void
  onClose: () => void
}) {
  const [formats] = useState(() => dateTimeFormats(wallClockDate(settingsStore.get())))
  const [choice, setChoice] = useState(formats[0] ?? '')
  return (
    <Dialog title="Date and Time" onClose={onClose} className="w-[300px]">
      <form
        className="flex gap-[10px] p-[10px]"
        onSubmit={(event) => {
          event.preventDefault()
          onInsert(choice)
        }}
      >
        <div className="flex flex-1 flex-col gap-[4px]">
          <span>
            <span className="underline">A</span>vailable formats:
          </span>
          <ListBox
            label="Available formats"
            items={formats}
            value={choice}
            className="h-[150px]"
            onChange={setChoice}
            onPick={onInsert}
          />
        </div>
        <Buttons>
          <Button type="submit" isDefault autoFocus>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </Buttons>
      </form>
    </Dialog>
  )
}

/** The gray lines standing for text on the Page Setup preview. Every fifth one is a short paragraph end. */
const PREVIEW_LINES = Array.from({ length: 12 }, (_, i) => ({
  id: `line-${i}`,
  width: i % 5 === 4 ? 60 : 100,
}))

export function PageSetupDialog({
  page,
  units,
  onApply,
  onClose,
}: {
  page: PageSetup
  units: Units
  onApply: (page: PageSetup) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(page)
  const id = useId()
  const area = pageArea(draft)
  const scale = 60 / Math.max(area.paperWidth, area.paperHeight)
  return (
    <Dialog title="Page Setup" onClose={onClose} className="w-[380px]">
      <form
        className="flex flex-col gap-[8px] p-[10px]"
        onSubmit={(event) => {
          event.preventDefault()
          onApply(draft)
        }}
      >
        <div className="flex justify-center py-[6px]">
          <div
            className="relative bg-white shadow-[2px_2px_#000]"
            style={{
              width: area.paperWidth * scale,
              height: area.paperHeight * scale,
              border: '1px solid #000',
            }}
            role="img"
            aria-label="Page preview"
          >
            <div
              className="absolute flex flex-col gap-[2px] overflow-hidden"
              style={{
                left: draft.left * scale,
                top: draft.top * scale,
                right: draft.right * scale,
                bottom: draft.bottom * scale,
              }}
            >
              {PREVIEW_LINES.map((line) => (
                <div key={line.id} className="h-px bg-shadow" style={{ width: `${line.width}%` }} />
              ))}
            </div>
          </div>
        </div>
        <GroupBox label="Paper">
          <div className="flex flex-col gap-[6px]">
            <label htmlFor={`${id}-size`} className="flex items-center gap-[8px]">
              <span className="w-[50px]">
                Si<span className="underline">z</span>e:
              </span>
              <ComboBox
                id={`${id}-size`}
                aria-label="Paper size"
                className="flex-1"
                value={draft.paper}
                onChange={(paper) => setDraft((d) => ({ ...d, paper }))}
                options={PAPER_SIZES.map((size) => ({ key: size.name, label: size.name }))}
              />
            </label>
            <label htmlFor={`${id}-source`} className="flex items-center gap-[8px]">
              <span className="w-[50px]">
                <span className="underline">S</span>ource:
              </span>
              <ComboBox
                id={`${id}-source`}
                aria-label="Paper source"
                className="flex-1"
                value={'Default tray'}
                onChange={() => undefined}
                options={[{ key: 'Default tray', label: 'Default tray' }]}
              />
            </label>
          </div>
        </GroupBox>
        <div className="flex gap-[8px]">
          <GroupBox label="Orientation" className="w-[120px]">
            <div className="flex flex-col gap-[6px]">
              <Radio
                name={`${id}-orientation`}
                label={
                  <>
                    P<span className="underline">o</span>rtrait
                  </>
                }
                checked={draft.orientation === 'portrait'}
                onChange={() => setDraft((d) => ({ ...d, orientation: 'portrait' }))}
              />
              <Radio
                name={`${id}-orientation`}
                label={
                  <>
                    L<span className="underline">a</span>ndscape
                  </>
                }
                checked={draft.orientation === 'landscape'}
                onChange={() => setDraft((d) => ({ ...d, orientation: 'landscape' }))}
              />
            </div>
          </GroupBox>
          <GroupBox label={`Margins (${units === 'cm' ? 'centimeters' : units})`} className="flex-1">
            <div className="grid grid-cols-2 gap-x-[12px] gap-y-[6px]">
              <MeasureBox
                id={`${id}-left`}
                label="Left:"
                value={draft.left}
                units={units}
                onChange={(left) => setDraft((d) => ({ ...d, left }))}
              />
              <MeasureBox
                id={`${id}-right`}
                label="Right:"
                value={draft.right}
                units={units}
                onChange={(right) => setDraft((d) => ({ ...d, right }))}
              />
              <MeasureBox
                id={`${id}-top`}
                label="Top:"
                value={draft.top}
                units={units}
                onChange={(top) => setDraft((d) => ({ ...d, top }))}
              />
              <MeasureBox
                id={`${id}-bottom`}
                label="Bottom:"
                value={draft.bottom}
                units={units}
                onChange={(bottom) => setDraft((d) => ({ ...d, bottom }))}
              />
            </div>
          </GroupBox>
        </div>
        <div className="flex justify-end gap-[6px]">
          <Button type="submit" isDefault>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button disabled>
            <span className="underline">P</span>rinter...
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export interface FindState extends SearchOptions {
  readonly query: string
  readonly replacement: string
}

export function FindDialog({
  replace,
  state,
  onChange,
  onFindNext,
  onReplace,
  onReplaceAll,
  onClose,
}: {
  replace: boolean
  state: FindState
  onChange: (state: FindState) => void
  onFindNext: () => void
  onReplace: () => void
  onReplaceAll: () => void
  onClose: () => void
}) {
  const id = useId()
  return (
    <Dialog title={replace ? 'Replace' : 'Find'} onClose={onClose} className="w-[370px]">
      <form
        className="flex gap-[10px] p-[10px]"
        onSubmit={(event) => {
          event.preventDefault()
          onFindNext()
        }}
      >
        <div className="flex flex-1 flex-col gap-[8px]">
          <label htmlFor={`${id}-find`} className="flex items-center gap-[6px]">
            <span className="w-[72px] shrink-0">
              Fi<span className="underline">n</span>d what:
            </span>
            <TextBox
              id={`${id}-find`}
              className="min-w-0 flex-1"
              autoFocus
              value={state.query}
              onFocus={(event) => event.target.select()}
              onChange={(event) => onChange({ ...state, query: event.target.value })}
            />
          </label>
          {replace && (
            <label htmlFor={`${id}-replace`} className="flex items-center gap-[6px]">
              <span className="w-[72px] shrink-0">
                Re<span className="underline">p</span>lace with:
              </span>
              <TextBox
                id={`${id}-replace`}
                className="min-w-0 flex-1"
                value={state.replacement}
                onChange={(event) => onChange({ ...state, replacement: event.target.value })}
              />
            </label>
          )}
          <Checkbox
            label={
              <>
                Match <span className="underline">w</span>hole word only
              </>
            }
            checked={state.wholeWord}
            onChange={(event) => onChange({ ...state, wholeWord: event.target.checked })}
          />
          <Checkbox
            label={
              <>
                Match <span className="underline">c</span>ase
              </>
            }
            checked={state.matchCase}
            onChange={(event) => onChange({ ...state, matchCase: event.target.checked })}
          />
        </div>
        <Buttons>
          <Button type="submit" isDefault disabled={!state.query}>
            <span className="underline">F</span>ind Next
          </Button>
          {replace && (
            <>
              <Button onClick={onReplace} disabled={!state.query}>
                <span className="underline">R</span>eplace
              </Button>
              <Button onClick={onReplaceAll} disabled={!state.query}>
                Replace <span className="underline">A</span>ll
              </Button>
            </>
          )}
          <Button onClick={onClose}>Cancel</Button>
        </Buttons>
      </form>
    </Dialog>
  )
}

export function PasteSpecialDialog({
  onPaste,
  onClose,
}: {
  onPaste: (kind: 'rich' | 'text') => void
  onClose: () => void
}) {
  const kinds = ['Rich Text (RTF)', 'Unformatted Text'] as const
  const [kind, setKind] = useState<(typeof kinds)[number]>(kinds[0])
  const pick = (choice: (typeof kinds)[number]) => onPaste(choice === 'Unformatted Text' ? 'text' : 'rich')
  return (
    <Dialog title="Paste Special" onClose={onClose} className="w-[400px]">
      <form
        className="flex gap-[10px] p-[10px]"
        onSubmit={(event) => {
          event.preventDefault()
          pick(kind)
        }}
      >
        <div className="flex flex-1 flex-col gap-[8px]">
          <div className="flex gap-[6px]">
            <span className="w-[50px]">Source:</span>
            <span>Clipboard</span>
          </div>
          <div className="flex gap-[6px]">
            <span className="w-[50px] pt-[14px]">
              <span className="underline">A</span>s:
            </span>
            <div className="flex flex-1 flex-col gap-[4px]">
              <Radio name="paste-special" label="Paste" checked readOnly />
              <ListBox
                label="As"
                items={kinds}
                value={kind}
                className="h-[60px]"
                onChange={setKind}
                onPick={pick}
              />
            </div>
          </div>
          <GroupBox label="Result">
            <p className="h-[32px]">
              {kind === 'Unformatted Text'
                ? 'Inserts the contents of the Clipboard into your document as text without any formatting.'
                : 'Inserts the contents of the Clipboard into your document so that you can edit it with the text formatting it has.'}
            </p>
          </GroupBox>
        </div>
        <Buttons>
          <Button type="submit" isDefault autoFocus>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </Buttons>
      </form>
    </Dialog>
  )
}

export function PrintDialog({ onPrint, onClose }: { onPrint: () => void; onClose: () => void }) {
  const id = useId()
  const [range, setRange] = useState<'all' | 'pages' | 'selection'>('all')
  const [copies, setCopies] = useState(1)
  return (
    <Dialog title="Print" onClose={onClose} className="w-[430px]">
      <form
        className="flex flex-col gap-[8px] p-[10px]"
        onSubmit={(event) => {
          event.preventDefault()
          onPrint()
        }}
      >
        <GroupBox label="Printer">
          <div className="grid grid-cols-[60px_1fr_auto] items-center gap-x-[6px] gap-y-[4px]">
            <label htmlFor={`${id}-printer`}>
              <span className="underline">N</span>ame:
            </label>
            <ComboBox
              id={`${id}-printer`}
              aria-label="Printer name"
              className=""
              value={'Generic / Text Only'}
              onChange={() => undefined}
              options={[{ key: 'Generic / Text Only', label: 'Generic / Text Only' }]}
            />
            <Button disabled>
              <span className="underline">P</span>roperties
            </Button>
            <span>Status:</span>
            <span className="col-span-2">Default printer; Ready</span>
            <span>Type:</span>
            <span className="col-span-2">Generic / Text Only</span>
            <span>Where:</span>
            <span className="col-span-2">FILE:</span>
            <span>Comment:</span>
            <span />
            <Checkbox label="Print to file" checked readOnly />
          </div>
        </GroupBox>
        <div className="flex gap-[8px]">
          <GroupBox label="Print range" className="flex-1">
            <div className="flex flex-col gap-[6px]">
              <Radio
                name={`${id}-range`}
                label="All"
                checked={range === 'all'}
                onChange={() => setRange('all')}
              />
              <div className="flex items-center gap-[6px]">
                <Radio
                  name={`${id}-range`}
                  label="Pages"
                  checked={range === 'pages'}
                  onChange={() => setRange('pages')}
                />
                <span>from:</span>
                <TextBox
                  className="w-[34px]"
                  defaultValue="1"
                  disabled={range !== 'pages'}
                  aria-label="From page"
                />
                <span>to:</span>
                <TextBox
                  className="w-[34px]"
                  defaultValue="1"
                  disabled={range !== 'pages'}
                  aria-label="To page"
                />
              </div>
              <Radio
                name={`${id}-range`}
                label="Selection"
                checked={range === 'selection'}
                onChange={() => setRange('selection')}
              />
            </div>
          </GroupBox>
          <GroupBox label="Copies" className="w-[150px]">
            <label htmlFor={`${id}-copies`} className="flex items-center justify-between gap-[6px]">
              <span>
                Number of <span className="underline">c</span>opies:
              </span>
              <TextBox
                id={`${id}-copies`}
                className="w-[40px]"
                type="number"
                min={1}
                max={99}
                value={copies}
                onChange={(event) => setCopies(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <Checkbox className="mt-[8px]" label="Collate" disabled={copies < 2} />
          </GroupBox>
        </div>
        <div className="flex justify-end gap-[6px]">
          <Button type="submit" isDefault autoFocus>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}
