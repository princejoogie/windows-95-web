import { useEffect, useRef, useState } from 'react'
import { useKeyDown } from '../../shell/context'
import type { MenuBarMenu } from '../../ui/Menu'
import { Accel } from '../../ui/text'

export function Menu({ menus, enabled }: { menus: readonly MenuBarMenu[]; enabled: boolean }) {
  const [open, setOpen] = useState<number | null>(null)
  const [hot, setHot] = useState(-1)
  const root = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<Element | null>(null)
  const close = () => {
    setOpen(null)
    if (previousFocus.current instanceof HTMLElement) previousFocus.current.focus()
  }
  const show = (index: number, selectFirst = false) => {
    if (open === null) previousFocus.current = document.activeElement
    setOpen(index)
    setHot(
      selectFirst
        ? (menus[index]?.items.findIndex((entry) => entry !== 'separator' && !entry.disabled) ?? -1)
        : -1,
    )
  }
  useEffect(() => {
    if (open === null) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(null)
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [open])
  useEffect(() => {
    if (!enabled) setOpen(null)
  }, [enabled])
  useEffect(() => {
    if (open !== null) root.current?.querySelector<HTMLButtonElement>(`[data-entry="${hot}"]`)?.focus()
  }, [open, hot])
  useKeyDown((event) => {
    if (!enabled || event.defaultPrevented) return
    const key = event.key.toLowerCase()
    const menu = menus.findIndex((menu) => menu.label.match(/&(.)/)?.[1]?.toLowerCase() === key)
    if (event.key === 'Alt' || (event.altKey && menu !== -1)) {
      event.preventDefault()
      if (event.key === 'Alt' && open !== null) close()
      else show(menu === -1 ? 0 : menu, true)
      return
    }
    if (open === null) return
    const items = menus[open]?.items ?? []
    const choices = items.flatMap((entry, index) => (entry !== 'separator' && !entry.disabled ? [index] : []))
    if (key === 'escape') close()
    else if (key === 'arrowleft' || key === 'arrowright')
      show((open + (key === 'arrowleft' ? menus.length - 1 : 1)) % menus.length, true)
    else if (key === 'arrowdown' || key === 'arrowup') {
      const next = (choices.indexOf(hot) + (key === 'arrowdown' ? 1 : choices.length - 1)) % choices.length
      setHot(choices[next] ?? -1)
    } else if (key === 'home' || key === 'end') setHot((key === 'home' ? choices[0] : choices.at(-1)) ?? -1)
    else {
      const index =
        key === 'enter' || key === ' '
          ? hot
          : items.findIndex(
              (entry) =>
                entry !== 'separator' &&
                !entry.disabled &&
                entry.label.match(/&(.)/)?.[1]?.toLowerCase() === key,
            )
      const entry = items[index]
      if (!entry || entry === 'separator' || entry.disabled) return
      close()
      entry.onSelect?.()
    }
    event.preventDefault()
  })
  return (
    <div ref={root} role="menubar" className="freecell-menu relative flex h-[19px] shrink-0 bg-face">
      {menus.map((menu, index) => (
        <div className="relative" key={menu.label}>
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === index}
            className={`h-[19px] px-[6px] outline-none ${open === index ? 'bevel-shallow' : ''}`}
            onKeyDown={(event) => {
              if (['Enter', ' ', 'ArrowDown'].includes(event.key)) {
                event.preventDefault()
                show(index, true)
              }
            }}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (open === index) close()
              else show(index)
            }}
            onPointerEnter={() => {
              if (open !== null) show(index)
            }}
          >
            <Accel label={menu.label} />
          </button>
          {open === index && (
            <div
              role="menu"
              aria-label={menu.label.replace('&', '')}
              className="absolute left-0 top-full z-50 min-w-[190px] p-[3px] bg-face bevel-window"
            >
              {menu.items.map((entry, item) => {
                const next = menu.items[item + 1]
                return entry === 'separator' ? (
                  <div
                    key={`before-${next && next !== 'separator' ? next.label : 'end'}`}
                    className="my-[3px] mx-px h-[2px] border-t border-shadow border-b-white border-b"
                  />
                ) : (
                  <button
                    key={entry.label}
                    type="button"
                    role="menuitem"
                    aria-disabled={entry.disabled}
                    data-entry={item}
                    tabIndex={-1}
                    className={`flex w-full items-center h-[18px] pl-[20px] pr-[8px] whitespace-nowrap text-left outline-none ${hot === item ? 'bg-select text-white' : ''} ${entry.disabled ? 'text-embossed' : ''}`}
                    onPointerEnter={() => setHot(item)}
                    onClick={() => {
                      if (!entry.disabled) {
                        close()
                        entry.onSelect?.()
                      }
                    }}
                  >
                    <span className="flex-1 pr-[20px]">
                      <Accel label={entry.label} />
                    </span>
                    <span>{entry.shortcut}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
