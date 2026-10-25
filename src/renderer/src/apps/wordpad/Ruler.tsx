import { type PointerEvent as ReactPointerEvent, useRef, useState } from 'react'
import { type ParagraphStyle, TWIPS_PER_CM, TWIPS_PER_INCH, TWIPS_PER_POINT, twipsToPixels } from './model'
import type { Units } from './options'

/** Indents and tabs snap to a sixteenth of an inch, as WordPad's ruler does. */
const SNAP_TWIPS = 90
const MIN_TEXT_TWIPS = 720

type Drag =
  | { kind: 'first' | 'left' | 'both' | 'right'; value: number }
  | { kind: 'tab'; index: number; value: number; remove: boolean }

interface RulerProps {
  /** Width of the text area in twips, or `null` when wrapping to the window. */
  readonly widthTwips: number | null
  /** Pixels between the ruler's left edge and the zero mark. */
  readonly gutter: number
  readonly paragraph: ParagraphStyle
  readonly units: Units
  readonly onChange: (patch: Partial<Omit<ParagraphStyle, 'bullet'>>) => void
}

function unitTicks(units: Units): { major: number; minor: number; label: (n: number) => string } {
  switch (units) {
    case 'cm':
      return { major: TWIPS_PER_CM, minor: TWIPS_PER_CM / 4, label: (n) => String(n) }
    case 'points':
      return { major: TWIPS_PER_POINT * 36, minor: TWIPS_PER_POINT * 9, label: (n) => String(n * 36) }
    case 'picas':
      return {
        major: TWIPS_PER_POINT * 12 * 6,
        minor: TWIPS_PER_POINT * 12 * 1.5,
        label: (n) => String(n * 6),
      }
    default:
      return { major: TWIPS_PER_INCH, minor: TWIPS_PER_INCH / 8, label: (n) => String(n) }
  }
}

/** The WordPad ruler: inch marks, draggable indent markers, and tab stops you click to add and drag off to remove. */
export function Ruler({ widthTwips, gutter, paragraph, units, onChange }: RulerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [measured, setMeasured] = useState(0)
  const bandTwips = widthTwips ?? Math.max(MIN_TEXT_TWIPS, (measured - gutter - 8) * 15)
  const bandWidth = twipsToPixels(bandTwips)

  const twipsAt = (clientX: number): number => {
    const left = ref.current?.getBoundingClientRect().left ?? 0
    const raw = (clientX - left - gutter) * 15
    return Math.round(raw / SNAP_TWIPS) * SNAP_TWIPS
  }

  const left = drag?.kind === 'left' || drag?.kind === 'both' ? drag.value : paragraph.left
  const first =
    drag?.kind === 'first' ? drag.value - left : drag?.kind === 'both' ? paragraph.first : paragraph.first
  const right = drag?.kind === 'right' ? drag.value : paragraph.right
  const tabs = paragraph.tabs.map((tab, index) =>
    drag?.kind === 'tab' && drag.index === index ? drag.value : tab,
  )

  const startMarker = (kind: 'first' | 'left' | 'both' | 'right') => (event: ReactPointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const value =
      kind === 'first'
        ? paragraph.left + paragraph.first
        : kind === 'right'
          ? paragraph.right
          : paragraph.left
    setDrag({ kind, value })
  }

  const moveMarker = (event: ReactPointerEvent) => {
    if (!drag) return
    const at = twipsAt(event.clientX)
    if (drag.kind === 'right') {
      setDrag({ ...drag, value: Math.max(0, Math.min(bandTwips - left - MIN_TEXT_TWIPS, bandTwips - at)) })
    } else if (drag.kind === 'tab') {
      const box = ref.current?.getBoundingClientRect()
      const outside = box ? event.clientY < box.top - 12 || event.clientY > box.bottom + 12 : false
      setDrag({ ...drag, value: Math.max(SNAP_TWIPS, Math.min(bandTwips, at)), remove: outside })
    } else {
      const max = bandTwips - right - MIN_TEXT_TWIPS
      const value = Math.max(drag.kind === 'first' ? Math.min(0, left) : 0, Math.min(max, at))
      setDrag({ ...drag, value })
    }
  }

  const endMarker = () => {
    if (!drag) return
    switch (drag.kind) {
      case 'first':
        onChange({ first: drag.value - paragraph.left })
        break
      case 'left':
        onChange({ left: drag.value, first: paragraph.first + paragraph.left - drag.value })
        break
      case 'both':
        onChange({ left: drag.value })
        break
      case 'right':
        onChange({ right: drag.value })
        break
      case 'tab': {
        const next = paragraph.tabs.filter((_, index) => index !== drag.index)
        if (!drag.remove) next.push(drag.value)
        onChange({ tabs: [...new Set(next)].sort((a, b) => a - b) })
        break
      }
    }
    setDrag(null)
  }

  const addTab = (event: ReactPointerEvent) => {
    if (event.button !== 0 || drag) return
    const at = twipsAt(event.clientX)
    if (at <= 0 || at >= bandTwips) return
    onChange({ tabs: [...new Set([...paragraph.tabs, at])].sort((a, b) => a - b) })
  }

  const ticks = unitTicks(units)
  const marks: { x: number; kind: 'major' | 'minor' | 'half'; label?: string }[] = []
  for (let t = ticks.minor, i = 1; t < bandTwips; t += ticks.minor, i++) {
    const perMajor = Math.round(ticks.major / ticks.minor)
    if (i % perMajor === 0)
      marks.push({ x: twipsToPixels(t), kind: 'major', label: ticks.label(i / perMajor) })
    else if (perMajor % 2 === 0 && i % (perMajor / 2) === 0) marks.push({ x: twipsToPixels(t), kind: 'half' })
    else marks.push({ x: twipsToPixels(t), kind: 'minor' })
  }

  return (
    <div
      ref={(node) => {
        ref.current = node
        if (node && node.clientWidth !== measured) setMeasured(node.clientWidth)
      }}
      className="wordpad-ruler shrink-0 border-b border-shadow"
      role="slider"
      aria-label="Ruler"
      aria-valuenow={paragraph.left}
      tabIndex={-1}
      onPointerMove={moveMarker}
      onPointerUp={endMarker}
      onPointerCancel={() => setDrag(null)}
    >
      <div
        className="wordpad-ruler-band"
        style={{ left: gutter, width: bandWidth }}
        onPointerDown={addTab}
        role="presentation"
      >
        {marks.map((mark) => (
          <span
            key={mark.x}
            className="absolute text-[9px] leading-none"
            style={{
              left: mark.x,
              top: mark.kind === 'major' ? 1 : mark.kind === 'half' ? 3 : 4,
              width: mark.kind === 'major' ? 0 : 1,
              height: mark.kind === 'major' ? 0 : mark.kind === 'half' ? 5 : 3,
              background: mark.kind === 'major' ? 'none' : '#000',
            }}
          >
            {mark.label && <span className="absolute -translate-x-1/2 font-sans">{mark.label}</span>}
          </span>
        ))}
        {tabs.map((tab, index) => (
          <span
            key={paragraph.tabs[index] ?? tab}
            role="presentation"
            aria-label={`Tab stop ${tab}`}
            data-tab={tab}
            className="wordpad-tab-stop"
            style={{
              left: twipsToPixels(tab),
              opacity: drag?.kind === 'tab' && drag.index === index && drag.remove ? 0.3 : 1,
            }}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              event.currentTarget.setPointerCapture(event.pointerId)
              setDrag({ kind: 'tab', index, value: tab, remove: false })
            }}
          />
        ))}
      </div>
      <span
        role="presentation"
        aria-label="First line indent"
        className="wordpad-marker wordpad-marker-down"
        style={{ left: gutter + twipsToPixels(left + first) }}
        onPointerDown={startMarker('first')}
      />
      <span
        role="presentation"
        aria-label="Left indent"
        className="wordpad-marker wordpad-marker-up"
        style={{ left: gutter + twipsToPixels(left) }}
        onPointerDown={startMarker('left')}
      />
      <span
        role="presentation"
        aria-label="Left and first indent"
        className="wordpad-marker wordpad-marker-box"
        style={{ left: gutter + twipsToPixels(left) }}
        onPointerDown={startMarker('both')}
      />
      <span
        role="presentation"
        aria-label="Right indent"
        className="wordpad-marker wordpad-marker-up"
        style={{ left: gutter + bandWidth - twipsToPixels(right) }}
        onPointerDown={startMarker('right')}
      />
    </div>
  )
}
