import { type ReactNode, useRef, useState } from 'react'
import { Accel } from '../../ui'

export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly T[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="tablist" className="classic-tabs">
      {items.map((item, index) => (
        <button
          key={item}
          type="button"
          role="tab"
          aria-selected={value === item}
          tabIndex={value === item ? 0 : -1}
          onClick={() => onChange(item)}
          onKeyDown={(event) => {
            const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
            const next =
              event.key === 'Home'
                ? items[0]
                : event.key === 'End'
                  ? items.at(-1)
                  : offset
                    ? items[(index + offset + items.length) % items.length]
                    : undefined
            if (!next) return
            event.preventDefault()
            onChange(next)
            const sibling =
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]')[
                items.indexOf(next)
              ]
            sibling?.focus()
          }}
        >
          {item}
        </button>
      ))}
    </div>
  )
}

export interface Command {
  readonly label: string
  readonly action: () => void
  readonly disabled?: boolean
  readonly checked?: boolean
  readonly shortcut?: string
}

export function CommandMenu({
  label,
  commands,
  children,
}: {
  label: string
  commands: readonly (Command | 'separator')[]
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLFieldSetElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const focusFirst = () =>
    requestAnimationFrame(() =>
      root.current?.querySelector<HTMLButtonElement>('[role=menuitem]:not(:disabled)')?.focus(),
    )
  return (
    <fieldset
      ref={root}
      className="classic-command"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className={children ? 'classic-toolbar-button' : 'classic-menu-button'}
        onClick={() => {
          setOpen(!open)
          if (!open) focusFirst()
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            focusFirst()
          }
        }}
      >
        {children ?? <Accel label={label} />}
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label.replace('&', '')}
          className="classic-command-items bevel-window"
          onKeyDown={(event) => {
            const buttons = [
              ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
            ]
            const index =
              document.activeElement instanceof HTMLButtonElement
                ? buttons.indexOf(document.activeElement)
                : -1
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              setOpen(false)
              button.current?.focus()
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              buttons[
                (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
              ]?.focus()
            } else if (event.key.length === 1) {
              const match = commands.find(
                (item) =>
                  item !== 'separator' &&
                  item.label.match(/&(.)/)?.[1]?.toLowerCase() === event.key.toLowerCase(),
              )
              if (match && match !== 'separator' && !match.disabled) {
                event.preventDefault()
                setOpen(false)
                match.action()
              }
            }
          }}
        >
          {commands.map((command, index) =>
            command === 'separator' ? (
              <hr
                key={`separator-${commands.slice(index + 1).find((entry) => entry !== 'separator')?.label}`}
              />
            ) : (
              <button
                key={command.label}
                type="button"
                role="menuitem"
                disabled={command.disabled}
                onClick={() => {
                  setOpen(false)
                  button.current?.focus()
                  command.action()
                }}
              >
                <span className="classic-command-check">{command.checked ? '✓' : ''}</span>
                <Accel label={command.label} />
                <span className="ml-auto pl-5">{command.shortcut}</span>
              </button>
            ),
          )}
        </div>
      )}
    </fieldset>
  )
}
