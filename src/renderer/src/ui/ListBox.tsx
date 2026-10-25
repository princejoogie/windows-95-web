import type { CSSProperties, ReactNode } from 'react'

/** A Windows 95 single-selection list box: a sunken white well of 16px rows, walked with the arrow keys. */
export function ListBox<T extends string | number>({
  label,
  items,
  value,
  onChange,
  onPick,
  render,
  className = '',
  style,
}: {
  label: string
  items: readonly T[]
  value: T | null
  onChange: (value: T) => void
  /** A double-click, which usually also presses the dialog's OK. */
  onPick?: (value: T) => void
  render?: (value: T) => ReactNode
  className?: string
  style?: (value: T) => CSSProperties | undefined
}) {
  return (
    <div
      role="listbox"
      aria-label={label}
      className={`overflow-y-auto bg-white bevel-sunken p-[2px] ${className}`}
      tabIndex={0}
      onKeyDown={(event) => {
        const index = value === null ? -1 : items.indexOf(value)
        const target = {
          ArrowDown: Math.min(index + 1, items.length - 1),
          ArrowUp: Math.max(index - 1, 0),
          Home: 0,
          End: items.length - 1,
        }[event.key]
        const next = target === undefined ? undefined : items[target]
        if (next === undefined) return
        event.preventDefault()
        if (next !== value) onChange(next)
      }}
    >
      {items.map((item) => (
        <button
          key={item}
          type="button"
          role="option"
          aria-selected={item === value}
          tabIndex={-1}
          className={`block h-[16px] w-full truncate px-[2px] text-left leading-[16px] outline-none ${
            item === value ? 'bg-select text-white' : ''
          }`}
          style={style?.(item)}
          ref={(element) => {
            if (element && item === value) element.scrollIntoView({ block: 'nearest' })
          }}
          onClick={() => onChange(item)}
          onDoubleClick={() => onPick?.(item)}
        >
          {render ? render(item) : String(item)}
        </button>
      ))}
    </div>
  )
}
