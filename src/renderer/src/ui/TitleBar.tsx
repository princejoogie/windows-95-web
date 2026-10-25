import type { HTMLAttributes, ReactNode } from 'react'
import { pixelArt } from '../icons/pixel'

const GLYPHS = {
  minimize: ['........', '........', '........', '........', '........', '.kkkkkk.', '.kkkkkk.'],
  maximize: [
    'kkkkkkkkk',
    'kkkkkkkkk',
    'k.......k',
    'k.......k',
    'k.......k',
    'k.......k',
    'k.......k',
    'k.......k',
    'kkkkkkkkk',
  ],
  restore: [
    '..kkkkkk',
    '..kkkkkk',
    '..k....k',
    'kkkkkk.k',
    'kkkkkk.k',
    'k....kkk',
    'k....k..',
    'k....k..',
    'kkkkkk..',
  ],
  close: ['kk....kk', '.kk..kk.', '..kkkk..', '...kk...', '..kkkk..', '.kk..kk.', 'kk....kk'],
  help: ['..kkkk..', '.kk..kk.', '.....kk.', '....kk..', '...kk...', '........', '...kk...'],
} as const

export type Glyph = keyof typeof GLYPHS

/** Disabled glyphs are drawn in gray with a white copy one pixel down and right. */
function embossed(rows: readonly string[]): string[] {
  const height = rows.length + 1
  const width = (rows[0]?.length ?? 0) + 1
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      if (rows[y]?.[x] === 'k') return 'g'
      return rows[y - 1]?.[x - 1] === 'k' ? 'w' : '.'
    }).join(''),
  )
}

const glyphUrl = Object.fromEntries(
  Object.entries(GLYPHS).flatMap(([name, rows]) => [
    [name, pixelArt(rows)],
    [`${name}-disabled`, pixelArt(embossed(rows))],
  ]),
) as Record<string, string>

export function TitleButton({
  glyph,
  disabled,
  onClick,
  label,
}: {
  glyph: Glyph
  disabled?: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className="group grid place-items-center w-[16px] h-[14px] bg-face bevel-raised enabled:active:bevel-pressed outline-none"
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={onClick}
    >
      <img
        src={glyphUrl[disabled ? `${glyph}-disabled` : glyph]}
        alt=""
        className="group-enabled:group-active:translate-x-px group-enabled:group-active:translate-y-px"
      />
    </button>
  )
}

interface TitleBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: string
  active: boolean
  icon?: string | undefined
  children?: ReactNode
}

export function TitleBar({ title, active, icon, children, ...rest }: TitleBarProps) {
  return (
    <div
      className={`flex items-center h-[18px] pl-[2px] pr-[2px] gap-[3px] shrink-0 ${active ? 'bg-title text-white' : 'bg-title-inactive text-face'}`}
      {...rest}
    >
      {icon && <img src={icon} alt="" className="size-4 shrink-0" />}
      <span className="flex-1 truncate font-bold">{title}</span>
      <div className="flex items-center">{children}</div>
    </div>
  )
}
