import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react'
import { Button, TitleBar, TitleButton } from '../../ui'
import type { Bitmap } from './bitmap'
import { drawBitmap } from './Canvas'
import { fonts, sizes, type TextStyle } from './text'

/** A small tool window that floats over Paint, like the Fonts toolbar and the Thumbnail. */
function Floater({
  title,
  start,
  onClose,
  children,
}: {
  title: string
  start: { x: number; y: number }
  onClose: () => void
  children: ReactNode
}) {
  const [at, setAt] = useState(start)
  const drag = useRef<{ x: number; y: number; from: { x: number; y: number } } | null>(null)
  return (
    <div
      role="toolbar"
      aria-label={title}
      className="absolute z-30 flex flex-col p-[3px] bg-face bevel-window"
      style={{ left: at.x, top: at.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <TitleBar
        title={title}
        active
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { x: event.clientX, y: event.clientY, from: at }
        }}
        onPointerMove={(event) => {
          const start = drag.current
          if (start)
            setAt({ x: start.from.x + event.clientX - start.x, y: start.from.y + event.clientY - start.y })
        }}
        onPointerUp={() => {
          drag.current = null
        }}
      >
        <TitleButton glyph="close" label="Close" onClick={onClose} />
      </TitleBar>
      {children}
    </div>
  )
}

function Combo({
  label,
  value,
  options,
  width,
  onChange,
}: {
  label: string
  value: string
  options: readonly string[]
  width: number
  onChange: (value: string) => void
}) {
  return (
    <span className="relative inline-block h-[21px] bg-white bevel-sunken" style={{ width }}>
      <select
        aria-label={label}
        value={value}
        className="absolute inset-0 appearance-none bg-transparent pl-[3px] pr-[18px] outline-none"
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[2px] right-[2px] grid h-[17px] w-[16px] place-items-center bg-face bevel-raised"
      >
        <svg aria-hidden="true" width="7" height="4" viewBox="0 0 7 4" shapeRendering="crispEdges">
          <path d="M0 0h7v1H6v1H5v1H4v1H3V3H2V2H1V1H0z" />
        </svg>
      </span>
    </span>
  )
}

export function FontsToolbar({
  style,
  onStyle,
  onClose,
}: {
  style: TextStyle
  onStyle: (style: TextStyle) => void
  onClose: () => void
}) {
  const toggle = (key: 'bold' | 'italic' | 'underline', glyph: ReactNode, label: string) => (
    <Button
      aria-label={label}
      aria-pressed={style[key]}
      pressed={style[key]}
      className="min-w-0! w-[23px]! h-[22px]! p-0!"
      onClick={() => onStyle({ ...style, [key]: !style[key] })}
    >
      {glyph}
    </Button>
  )
  return (
    <Floater title="Fonts" start={{ x: 70, y: 30 }} onClose={onClose}>
      <div className="flex items-center gap-[4px] p-[4px]">
        <Combo
          label="Font"
          value={style.font}
          options={fonts}
          width={150}
          onChange={(font) => onStyle({ ...style, font })}
        />
        <Combo
          label="Font size"
          value={String(style.size)}
          options={sizes.map(String)}
          width={46}
          onChange={(size) => onStyle({ ...style, size: Number(size) })}
        />
        <span className="flex">
          {toggle('bold', <b>B</b>, 'Bold')}
          {toggle('italic', <i className="font-serif">I</i>, 'Italic')}
          {toggle('underline', <u>U</u>, 'Underline')}
        </span>
      </div>
    </Floater>
  )
}

/** Shows the part of the picture under the zoomed view at its normal size. */
export function Thumbnail({
  image,
  zoom,
  scroller,
  onClose,
}: {
  image: Bitmap
  zoom: number
  scroller: RefObject<HTMLDivElement | null>
  onClose: () => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [origin, setOrigin] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const update = () =>
      setOrigin({ x: Math.floor(element.scrollLeft / zoom), y: Math.floor(element.scrollTop / zoom) })
    update()
    element.addEventListener('scroll', update)
    return () => element.removeEventListener('scroll', update)
  }, [scroller, zoom])
  useEffect(() => {
    const target = canvas.current
    if (!target) return
    const full = document.createElement('canvas')
    drawBitmap(full, image)
    const context = target.getContext('2d')
    if (!context) return
    context.fillStyle = '#808080'
    context.fillRect(0, 0, target.width, target.height)
    context.drawImage(full, -origin.x, -origin.y)
  }, [image, origin])
  return (
    <Floater title="Thumbnail" start={{ x: 300, y: 40 }} onClose={onClose}>
      <canvas ref={canvas} aria-label="Thumbnail" width={130} height={100} className="block bevel-sunken" />
    </Floater>
  )
}
