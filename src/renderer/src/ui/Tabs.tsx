import type { KeyboardEvent, ReactNode } from 'react'

const EDGE =
  'shadow-[inset_1px_1px_var(--color-hilight),inset_-1px_0_var(--color-dark),inset_-2px_0_var(--color-shadow)]'

/**
 * A Windows 95 property sheet: a row of tabs over a raised page. The selected tab stands 2px taller and
 * merges into the page. Left and Right walk the tabs, and Ctrl+Tab or Ctrl+Shift+Tab turns the page from
 * anywhere inside the sheet.
 */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  children,
  className = '',
  pageClassName = 'px-[12px] pt-[14px] pb-[12px]',
}: {
  tabs: readonly T[]
  active: NoInfer<T>
  onChange: (tab: NoInfer<T>) => void
  children: ReactNode
  className?: string
  pageClassName?: string
}) {
  const index = tabs.indexOf(active)
  const turn = (event: KeyboardEvent, next: T | undefined, focusTab: boolean) => {
    if (next === undefined) return
    event.preventDefault()
    event.stopPropagation()
    onChange(next)
    if (focusTab)
      event.currentTarget
        .closest('[data-tabs]')
        ?.querySelectorAll<HTMLElement>('[role="tab"]')
        [tabs.indexOf(next)]?.focus()
  }
  const step = (by: number) => tabs[(index + by + tabs.length) % tabs.length]
  const turnPage = (event: KeyboardEvent) => {
    if (event.ctrlKey && event.key === 'Tab') turn(event, step(event.shiftKey ? -1 : 1), false)
    else if (event.ctrlKey && (event.key === 'PageDown' || event.key === 'PageUp'))
      turn(event, step(event.key === 'PageDown' ? 1 : -1), false)
  }
  return (
    <div data-tabs className={`flex flex-col ${className}`}>
      <div role="tablist" className="flex h-[20px] items-end pl-[2px]" onKeyDown={turnPage}>
        {tabs.map((tab) => {
          const on = tab === active
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              className={`group relative bg-face outline-none whitespace-nowrap ${EDGE} ${
                on ? 'z-10 -mx-[2px] -mb-[2px] h-[22px] px-[8px] pb-[2px]' : 'h-[18px] px-[6px]'
              }`}
              onClick={() => onChange(tab)}
              onKeyDown={(event) => {
                if (event.ctrlKey) return
                if (event.key === 'ArrowRight') turn(event, step(1), true)
                else if (event.key === 'ArrowLeft') turn(event, step(-1), true)
                else if (event.key === 'Home') turn(event, tabs[0], true)
                else if (event.key === 'End') turn(event, tabs.at(-1), true)
              }}
            >
              <span className="relative px-[1px]">
                {tab}
                <span aria-hidden="true" className="dotted-frame hidden group-focus:block" />
              </span>
            </button>
          )
        })}
      </div>
      <div
        role="tabpanel"
        aria-label={active}
        className={`bevel-window bg-face ${pageClassName}`}
        onKeyDown={turnPage}
      >
        {children}
      </div>
    </div>
  )
}
