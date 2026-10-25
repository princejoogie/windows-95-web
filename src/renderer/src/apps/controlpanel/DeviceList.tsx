import { useId } from 'react'

export function DeviceList({
  label,
  items,
  value,
  onChange,
  className = '',
}: {
  label: string
  items: readonly string[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const id = useId()
  return (
    <div
      role="listbox"
      aria-label={label}
      aria-activedescendant={items.includes(value) ? `${id}-${items.indexOf(value)}` : undefined}
      tabIndex={0}
      className={`bevel-sunken bg-white p-1 overflow-auto outline-none ${className}`}
      onKeyDown={(event) => {
        const index = items.indexOf(value)
        const next =
          event.key === 'ArrowDown'
            ? Math.min(items.length - 1, index + 1)
            : event.key === 'ArrowUp'
              ? Math.max(0, index - 1)
              : event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? items.length - 1
                  : -1
        if (next >= 0 && items[next] !== undefined) {
          event.preventDefault()
          onChange(items[next])
        }
      }}
    >
      {items.map((item, index) => (
        <button
          type="button"
          key={item}
          role="option"
          tabIndex={-1}
          id={`${id}-${index}`}
          aria-selected={item === value}
          className={`block w-full text-left px-1 min-h-[18px] ${item === value ? 'bg-select text-white' : ''}`}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  )
}
