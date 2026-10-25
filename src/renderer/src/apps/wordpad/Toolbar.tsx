import { type ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ComboBox, type MenuEntry, MenuList } from '../../ui'
import type { SelectionState } from './editor'
import { FONT_SIZES, FONTS } from './fonts'
import { type ToolbarIcon, toolbarIcons } from './icons'
import type { Alignment } from './model'

const TOOLTIP_DELAY_MS = 600

/** A flat Windows 95 toolbar button. It never takes focus, so the document selection survives the click. */
export function ToolButton({
  icon,
  label,
  onClick,
  pressed,
  disabled,
}: {
  icon: ToolbarIcon
  label: string
  onClick: () => void
  pressed?: boolean
  disabled?: boolean
}) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <>
      <button
        type="button"
        className="wordpad-tool"
        aria-label={label}
        aria-pressed={pressed ? 'true' : undefined}
        disabled={disabled}
        tabIndex={-1}
        onPointerDown={(event) => event.preventDefault()}
        onPointerEnter={(event) => {
          const box = event.currentTarget.getBoundingClientRect()
          clearTimeout(timer.current)
          timer.current = setTimeout(() => setTip({ x: box.left, y: box.bottom + 2 }), TOOLTIP_DELAY_MS)
        }}
        onPointerLeave={() => {
          clearTimeout(timer.current)
          setTip(null)
        }}
        onClick={() => {
          setTip(null)
          onClick()
        }}
      >
        <img src={toolbarIcons[icon]} alt="" width={16} height={15} />
      </button>
      {tip &&
        createPortal(
          <div role="tooltip" className="wordpad-tooltip" style={{ left: tip.x, top: tip.y }}>
            {label}
          </div>,
          document.body,
        )}
    </>
  )
}

export function ToolSeparator() {
  return <span className="mx-[2px] h-[22px] w-[2px] border-l border-shadow border-r border-r-white" />
}

export function ToolStrip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className="flex h-[26px] shrink-0 items-center gap-0 px-[2px] border-t border-t-white border-b border-b-shadow"
    >
      {children}
    </div>
  )
}

export interface ToolbarActions {
  readonly onNew: () => void
  readonly onOpen: () => void
  readonly onSave: () => void
  readonly onPrint: () => void
  readonly onPreview: () => void
  readonly onFind: () => void
  readonly onCut: () => void
  readonly onCopy: () => void
  readonly onPaste: () => void
  readonly onUndo: () => void
  readonly onDateTime: () => void
}

export function Toolbar({ actions, hasSelection }: { actions: ToolbarActions; hasSelection: boolean }) {
  return (
    <ToolStrip label="Toolbar">
      <ToolButton icon="new" label="New" onClick={actions.onNew} />
      <ToolButton icon="open" label="Open" onClick={actions.onOpen} />
      <ToolButton icon="save" label="Save" onClick={actions.onSave} />
      <ToolSeparator />
      <ToolButton icon="print" label="Print" onClick={actions.onPrint} />
      <ToolButton icon="preview" label="Print Preview" onClick={actions.onPreview} />
      <ToolSeparator />
      <ToolButton icon="find" label="Find" onClick={actions.onFind} />
      <ToolSeparator />
      <ToolButton icon="cut" label="Cut" onClick={actions.onCut} disabled={!hasSelection} />
      <ToolButton icon="copy" label="Copy" onClick={actions.onCopy} disabled={!hasSelection} />
      <ToolButton icon="paste" label="Paste" onClick={actions.onPaste} />
      <ToolSeparator />
      <ToolButton icon="undo" label="Undo" onClick={actions.onUndo} />
      <ToolSeparator />
      <ToolButton icon="datetime" label="Date/Time" onClick={actions.onDateTime} />
    </ToolStrip>
  )
}

export const COLORS: readonly { readonly name: string; readonly value: string }[] = [
  { name: 'Black', value: '#000000' },
  { name: 'Maroon', value: '#800000' },
  { name: 'Green', value: '#008000' },
  { name: 'Olive', value: '#808000' },
  { name: 'Navy', value: '#000080' },
  { name: 'Purple', value: '#800080' },
  { name: 'Teal', value: '#008080' },
  { name: 'Gray', value: '#808080' },
  { name: 'Silver', value: '#c0c0c0' },
  { name: 'Red', value: '#ff0000' },
  { name: 'Lime', value: '#00ff00' },
  { name: 'Yellow', value: '#ffff00' },
  { name: 'Blue', value: '#0000ff' },
  { name: 'Fuchsia', value: '#ff00ff' },
  { name: 'Aqua', value: '#00ffff' },
  { name: 'White', value: '#ffffff' },
]

const swatch = (color: string): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect x="2" y="3" width="12" height="10" fill="${color}" stroke="#000"/></svg>`,
  )}`

export const colorName = (value: string): string =>
  COLORS.find((color) => color.value === value)?.name ?? 'Automatic'

export interface FormatActions {
  readonly onFont: (font: string) => void
  readonly onSize: (size: number) => void
  readonly onToggle: (command: 'bold' | 'italic' | 'underline') => void
  readonly onColor: (color: string) => void
  readonly onAlign: (align: Alignment) => void
  readonly onBullets: () => void
  /** Called before a control that takes focus, such as a combo box, changes the selection. */
  readonly onBeforeFocusSteal: () => void
}

export function FormatBar({ state, actions }: { state: SelectionState; actions: FormatActions }) {
  const [colors, setColors] = useState<{ x: number; y: number } | null>(null)
  const sizes = FONT_SIZES.includes(state.size)
    ? FONT_SIZES
    : [...FONT_SIZES, state.size].sort((a, b) => a - b)
  const fonts = FONTS.includes(state.font) ? FONTS : [state.font, ...FONTS]
  const colorItems: MenuEntry[] = [
    ...COLORS.map((color) => ({
      label: color.name,
      icon: swatch(color.value),
      onSelect: () => actions.onColor(color.value),
    })),
    'separator',
    { label: 'Automatic', onSelect: () => actions.onColor('#000000') },
  ]
  return (
    <ToolStrip label="Format Bar">
      <div onPointerDownCapture={actions.onBeforeFocusSteal} onFocusCapture={actions.onBeforeFocusSteal}>
        <ComboBox
          aria-label="Font"
          className="w-[150px]"
          value={state.font}
          onChange={actions.onFont}
          options={fonts.map((font) => ({ key: font, label: font }))}
        />
      </div>
      <div onPointerDownCapture={actions.onBeforeFocusSteal} onFocusCapture={actions.onBeforeFocusSteal}>
        <ComboBox
          aria-label="Font Size"
          className="ml-[2px] w-[44px]"
          value={String(state.size)}
          onChange={(size) => actions.onSize(Number(size))}
          options={sizes.map((size) => ({ key: String(size), label: String(size) }))}
        />
      </div>

      <ToolSeparator />
      <ToolButton icon="bold" label="Bold" pressed={state.bold} onClick={() => actions.onToggle('bold')} />
      <ToolButton
        icon="italic"
        label="Italic"
        pressed={state.italic}
        onClick={() => actions.onToggle('italic')}
      />
      <ToolButton
        icon="underline"
        label="Underline"
        pressed={state.underline}
        onClick={() => actions.onToggle('underline')}
      />
      <span className="relative inline-flex">
        <ToolButton
          icon="color"
          label="Color"
          pressed={colors !== null}
          onClick={() => setColors((open) => (open ? null : { x: 0, y: 23 }))}
        />
        {colors && (
          <MenuList
            items={colorItems}
            onClose={() => setColors(null)}
            style={{ left: colors.x, top: colors.y }}
          />
        )}
      </span>
      <ToolSeparator />
      <ToolButton
        icon="alignLeft"
        label="Align Left"
        pressed={state.align === 'left'}
        onClick={() => actions.onAlign('left')}
      />
      <ToolButton
        icon="alignCenter"
        label="Center"
        pressed={state.align === 'center'}
        onClick={() => actions.onAlign('center')}
      />
      <ToolButton
        icon="alignRight"
        label="Align Right"
        pressed={state.align === 'right'}
        onClick={() => actions.onAlign('right')}
      />
      <ToolSeparator />
      <ToolButton icon="bullets" label="Bullets" pressed={state.bullet} onClick={actions.onBullets} />
    </ToolStrip>
  )
}
