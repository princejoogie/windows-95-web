import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { typeAhead } from '../shell/desktopModel'

export interface ComboOption {
  readonly key: string
  readonly label: string
  /** 16x16 icon URL, drawn left of the label. */
  readonly icon?: string
  /** Tree depth, 10px per level, as the Look in list draws folders. */
  readonly indent?: number
}

interface ComboBoxProps {
  readonly id?: string
  readonly options: readonly ComboOption[]
  readonly value: string
  readonly onChange: (key: string) => void
  readonly className?: string
  readonly 'aria-label'?: string
}

const ROW = 16
const MAX_ROWS = 10

function DropArrow() {
  return (
    <svg aria-hidden="true" width="7" height="4" viewBox="0 0 7 4" shapeRendering="crispEdges">
      <path d="M0 0h7v1H6v1H5v1H4v1H3V3H2V2H1V1H0z" />
    </svg>
  )
}

function Row({ option, lit, inField }: { option: ComboOption; lit: boolean; inField?: boolean }) {
  const icon = Boolean(option.icon)
  return (
    <span
      className={`flex items-center h-[16px] min-w-0 ${icon ? 'gap-[4px]' : ''} ${lit && !icon ? 'bg-select text-white' : ''}`}
      style={{ paddingLeft: inField ? 0 : (option.indent ?? 0) * 10 + 2 }}
    >
      {option.icon && <img src={option.icon} alt="" className="size-4 shrink-0" />}
      <span className={`truncate px-[1px] ${lit && icon ? 'bg-select text-white' : ''}`}>{option.label}</span>
    </span>
  )
}

/**
 * A Windows 95 drop-down list combo box: a sunken white field with a raised arrow button, and a list that
 * drops below it. Alt+Down or F4 opens it; the arrows choose, Enter picks, Esc backs out.
 */
export function ComboBox({ id, options, value, onChange, className = '', ...rest }: ComboBoxProps) {
  const listId = useId()
  const field = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [hot, setHot] = useState(0)
  const [focused, setFocused] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const index = Math.max(
    0,
    options.findIndex((option) => option.key === value),
  )
  const current = options[index]

  const pick = (at: number) => {
    const option = options[Math.max(0, Math.min(at, options.length - 1))]
    setOpen(false)
    if (option && option.key !== value) onChange(option.key)
  }
  const show = () => {
    setHot(index)
    setRect(field.current?.getBoundingClientRect() ?? null)
    setOpen(true)
  }

  useLayoutEffect(() => {
    if (!open) return
    const row = list.current?.children[hot] as HTMLElement | undefined
    row?.scrollIntoView({ block: 'nearest' })
  }, [open, hot])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!field.current?.contains(target) && !list.current?.contains(target)) setOpen(false)
    }
    // Runs before the dialog's own Escape handler, which would otherwise close the whole dialog.
    const keys = (event: KeyboardEvent) => {
      const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
      let handled = true
      if (step !== undefined && !event.altKey)
        setHot((at) => Math.max(0, Math.min(at + step, options.length - 1)))
      else if (event.key === 'Home') setHot(0)
      else if (event.key === 'End') setHot(options.length - 1)
      else if (event.key === 'Enter' || event.key === 'F4' || (event.altKey && event.key.startsWith('Arrow')))
        pick(hot)
      else if (event.key === 'Escape') setOpen(false)
      else if (event.key === 'Tab') {
        pick(hot)
        handled = false
      } else handled = false
      if (!handled) return
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    const close = () => setOpen(false)
    document.addEventListener('pointerdown', outside, true)
    addEventListener('keydown', keys, true)
    addEventListener('blur', close)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      removeEventListener('keydown', keys, true)
      removeEventListener('blur', close)
    }
  })

  return (
    <>
      <div
        ref={field}
        id={id}
        role="combobox"
        tabIndex={0}
        aria-label={rest['aria-label']}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        className={`relative h-[21px] bg-white bevel-sunken outline-none pl-[3px] pr-[19px] flex items-center ${className}`}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          field.current?.focus()
          if (open) setOpen(false)
          else show()
        }}
        onKeyDown={(event) => {
          if (open) return
          if ((event.altKey && event.key === 'ArrowDown') || event.key === 'F4') {
            event.preventDefault()
            show()
            return
          }
          const moves: Record<string, number> = {
            ArrowDown: index + 1,
            ArrowUp: index - 1,
            ArrowRight: index + 1,
            ArrowLeft: index - 1,
            Home: 0,
            End: options.length - 1,
          }
          const to = moves[event.key]
          if (to !== undefined && !event.altKey) {
            event.preventDefault()
            pick(to)
            return
          }
          if (event.key.length === 1 && !event.ctrlKey && !event.altKey) {
            const next = typeAhead(
              options.map((option) => ({ key: option.key, label: option.label })),
              value,
              event.key,
            )
            if (next) onChange(next)
          }
        }}
      >
        {current && (
          <span
            className={`min-w-0 ${focused && !open && !current.icon ? 'bg-select text-white px-[1px] -ml-[1px]' : ''}`}
          >
            <Row option={current} lit={focused && !open && Boolean(current.icon)} inField />
          </span>
        )}
        <span
          aria-hidden="true"
          className={`absolute right-[2px] top-[2px] bottom-[2px] w-[16px] grid place-items-center bg-face ${open ? 'bevel-pressed' : 'bevel-raised'}`}
        >
          <span className={open ? 'translate-x-px translate-y-px' : ''}>
            <DropArrow />
          </span>
        </span>
      </div>
      {open &&
        rect &&
        createPortal(
          <div
            ref={list}
            id={listId}
            role="listbox"
            className="fixed z-[30000] bg-white border border-black overflow-y-auto overflow-x-hidden"
            style={{
              left: rect.left,
              top: rect.bottom,
              width: rect.width,
              maxHeight: ROW * MAX_ROWS + 2,
            }}
            onPointerDown={(event) => event.preventDefault()}
          >
            {options.map((option, at) => (
              <div
                key={option.key}
                role="option"
                aria-selected={at === hot}
                tabIndex={-1}
                className="h-[16px]"
                onPointerEnter={() => setHot(at)}
                onPointerUp={() => pick(at)}
              >
                <Row option={option} lit={at === hot} />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
