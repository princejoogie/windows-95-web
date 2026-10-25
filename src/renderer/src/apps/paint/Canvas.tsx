import {
  type PointerEvent,
  type RefObject,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  type Bitmap,
  bounds,
  boundsOf,
  colorAt,
  curve,
  flood,
  type Ink,
  type Point,
  polygon,
  polyline,
  type Rect,
  recolor,
  type Shape,
  seededRandom,
  select,
  shape,
  spray,
  stroke,
} from './bitmap'
import { contains, type Floating, lift, type Marquee, rectOf } from './marquee'
import { cssFont, drawText, lineHeight, type TextStyle } from './text'
import type { Options, Tool } from './tools'

type DrawingTool = Shape | 'pencil' | 'brush' | 'eraser' | 'spray'
type Gesture =
  | {
      kind: 'draw'
      tool: DrawingTool
      start: Point
      last: Point
      preview: Bitmap
      ink: Ink
      alternate: boolean
    }
  | { kind: 'select'; start: Point; last: Point; points: Point[]; freeform: boolean }
  | { kind: 'move'; floating: Floating; grab: Point; from: Point; smear: boolean }
  | { kind: 'pending' }
  | { kind: 'text'; start: Point; last: Point }
/** Curve and Polygon take several drags and clicks before they draw. */
type Pending =
  | { kind: 'curve'; start: Point; end: Point; controls: Point[]; phase: 0 | 1 | 2; ink: Ink; button: number }
  | { kind: 'polygon'; vertices: Point[]; ink: Ink; button: number }
const pendingPreview = (current: Pending, base: Bitmap): Bitmap =>
  current.kind === 'curve'
    ? curve(base, current.start, current.end, current.controls, current.ink.foreground, current.ink.width)
    : polyline(base, current.vertices, current.ink.foreground, current.ink.width)
function paintTo(canvas: RefObject<HTMLCanvasElement | null>, image: Bitmap) {
  if (canvas.current) drawBitmap(canvas.current, image)
}
interface TextFrame {
  rect: Rect
  text: string
}

export function drawBitmap(canvas: HTMLCanvasElement, image: Bitmap) {
  if (canvas.width !== image.width) canvas.width = image.width
  if (canvas.height !== image.height) canvas.height = image.height
  canvas
    .getContext('2d')
    ?.putImageData(new ImageData(new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0)
}
export function encodeBitmap(image: Bitmap): string {
  const canvas = document.createElement('canvas')
  drawBitmap(canvas, image)
  return canvas.toDataURL('image/png')
}
export async function decodeBitmap(content: string): Promise<Bitmap> {
  if (!content.startsWith('data:image/png;base64,'))
    throw new Error('Paint cannot read this file. It must be a picture saved by Paint.')
  const image = new Image()
  image.src = content
  await image.decode()
  if (image.width < 1 || image.height < 1 || image.width > 2048 || image.height > 2048)
    throw new Error('The picture must be between 1 and 2048 pixels wide and high.')
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Paint cannot create a drawing surface.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, image.width, image.height)
  context.drawImage(image, 0, 0)
  return {
    width: image.width,
    height: image.height,
    pixels: context.getImageData(0, 0, image.width, image.height).data,
  }
}

/** Shift keeps lines at 45 degree steps and makes squares and circles. */
function constrain(kind: Shape, start: Point, point: Point, shift: boolean): Point {
  if (!shift) return point
  const dx = point.x - start.x,
    dy = point.y - start.y
  if (kind === 'line' && Math.abs(dy) * 2 < Math.abs(dx)) return { x: point.x, y: start.y }
  if (kind === 'line' && Math.abs(dx) * 2 < Math.abs(dy)) return { x: start.x, y: point.y }
  const side = Math.max(Math.abs(dx), Math.abs(dy))
  return { x: start.x + Math.sign(dx || 1) * side, y: start.y + Math.sign(dy || 1) * side }
}

interface CanvasProps {
  active: boolean
  /** The picture with any floating selection drawn on it. */
  image: Bitmap
  marquee: Marquee | null
  tool: Tool
  colors: { foreground: string; background: string }
  options: Options
  zoom: number
  grid: boolean
  textStyle: TextStyle
  scroller: RefObject<HTMLDivElement | null>
  onCommit: (image: Bitmap) => void
  onMarquee: (marquee: Marquee | null) => void
  /** Drops a floating selection into the picture. */
  onDrop: () => void
  onColor: (color: string, background: boolean) => void
  onZoom: (zoom: number, focus: Point) => void
  onPosition: (point: Point | null) => void
  onSize: (size: { width: number; height: number } | null) => void
}
export function PaintCanvas(props: CanvasProps) {
  const { active, image, marquee, tool, colors, options, zoom, grid, textStyle } = props
  const canvas = useRef<HTMLCanvasElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const pending = useRef<Pending | null>(null)
  const [outline, setOutline] = useState<{ rect?: Rect; points?: Point[] } | null>(null)
  const [frame, setFrame] = useState<TextFrame | null>(null)
  const [hover, setHover] = useState<Point | null>(null)
  const random = useRef(seededRandom(95))
  const sprayTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const latest = useRef({ props, frame })
  latest.current = { props, frame }

  const show = (next: Bitmap) => paintTo(canvas, next)
  const finishPending = (close: boolean) => {
    const current = pending.current
    pending.current = null
    if (!current) return
    const base = latest.current.props.image
    if (current.kind === 'curve') latest.current.props.onCommit(pendingPreview(current, base))
    else if (close && current.vertices.length > 2)
      latest.current.props.onCommit(polygon(base, current.vertices, current.ink))
    else latest.current.props.onCommit(pendingPreview(current, base))
  }
  const commitText = () => {
    const { frame: open, props: now } = latest.current
    setFrame(null)
    if (!open?.text) return
    now.onCommit(
      drawText(
        now.image,
        open.rect,
        open.text,
        now.textStyle,
        now.colors.foreground,
        now.options.opaque ? now.colors.background : null,
      ),
    )
  }

  useLayoutEffect(() => {
    const current = pending.current
    paintTo(canvas, current ? pendingPreview(current, image) : image)
  }, [image])
  useEffect(() => {
    if (active) return
    clearInterval(sprayTimer.current)
    gesture.current = null
    setOutline(null)
    if (canvas.current) drawBitmap(canvas.current, latest.current.props.image)
  }, [active])
  const settle = useEffectEvent((next: Tool) => {
    finishPending(true)
    if (next !== 'text') commitText()
    setOutline(null)
    setHover(null)
  })
  useEffect(() => settle(tool), [tool])
  useEffect(() => () => clearInterval(sprayTimer.current), [])
  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !pending.current) return
      pending.current = null
      paintTo(canvas, latest.current.props.image)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active])

  const raw = (event: PointerEvent<HTMLElement>): Point => {
    const rect = canvas.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: Math.floor((event.clientX - rect.left) / zoom),
      y: Math.floor((event.clientY - rect.top) / zoom),
    }
  }
  const clamp = (point: Point): Point => ({
    x: Math.max(0, Math.min(image.width - 1, point.x)),
    y: Math.max(0, Math.min(image.height - 1, point.y)),
  })
  const draw = (current: Extract<Gesture, { kind: 'draw' }>, point: Point, shift: boolean): Bitmap => {
    const color = current.ink.foreground
    switch (current.tool) {
      case 'pencil':
        return stroke(current.preview, current.last, point, color)
      case 'brush':
        return stroke(current.preview, current.last, point, color, options.brushSize, options.brush)
      case 'eraser':
        return current.alternate
          ? recolor(
              current.preview,
              current.last,
              point,
              options.eraser,
              colors.foreground,
              colors.background,
            )
          : stroke(current.preview, current.last, point, colors.background, options.eraser)
      case 'spray':
        return spray(current.preview, point, color, options.spray, random.current)
      default: {
        const end = constrain(current.tool, current.start, point, shift)
        props.onSize(bounds(current.start, end))
        return shape(image, current.tool, current.start, end, current.ink)
      }
    }
  }
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const free = raw(event),
      point = clamp(free)
    props.onPosition(point)
    if (tool === 'zoom' && zoom === 1) setHover(point)
    const current = gesture.current
    if (!current) return
    if (current.kind === 'draw') {
      current.preview = draw(current, point, event.shiftKey)
      current.last = point
      show(current.preview)
    } else if (current.kind === 'select') {
      current.last = point
      current.points.push(point)
      const rect = current.freeform ? boundsOf(current.points) : bounds(current.start, point)
      setOutline(current.freeform ? { points: [...current.points] } : { rect })
      props.onSize(rect)
    } else if (current.kind === 'move') {
      const at = { x: current.from.x + free.x - current.grab.x, y: current.from.y + free.y - current.grab.y }
      const transparent = options.opaque ? undefined : colors.background
      const floating: Floating = current.smear
        ? { ...lift(image, current.floating, colors.background, true, transparent), at }
        : { ...current.floating, at }
      current.floating = floating
      props.onMarquee(floating)
    } else if (current.kind === 'text') {
      current.last = point
      const rect = bounds(current.start, point)
      setOutline({ rect })
      props.onSize(rect)
    } else {
      const open = pending.current
      if (!open) return
      if (open.kind === 'curve') {
        if (open.phase === 0) open.end = point
        else open.controls[open.controls.length - 1] = point
      } else open.vertices[open.vertices.length - 1] = point
      show(pendingPreview(open, image))
    }
  }

  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!active) return
    if (event.button !== 0 && event.button !== 2) return
    const free = raw(event),
      point = clamp(free),
      alternate = event.button === 2
    const ink: Ink = {
      foreground: alternate ? colors.background : colors.foreground,
      background: alternate ? colors.foreground : colors.background,
      width: options.width,
      fill: options.fill,
    }
    if (frame) {
      commitText()
      if (tool === 'text') return
    }
    if (tool === 'picker') return props.onColor(colorAt(image, point), alternate)
    if (tool === 'zoom') return props.onZoom(zoom === 1 ? 4 : 1, point)
    if (tool === 'fill') return props.onCommit(flood(image, point, ink.foreground))
    event.currentTarget.setPointerCapture(event.pointerId)
    if (tool === 'text') {
      gesture.current = { kind: 'text', start: point, last: point }
      return
    }
    if (tool === 'select' || tool === 'freeSelect') {
      if (marquee && contains(marquee, free) && !alternate) {
        const transparent = options.opaque ? undefined : colors.background
        const floating = lift(image, marquee, colors.background, event.ctrlKey, transparent)
        gesture.current = { kind: 'move', floating, grab: free, from: floating.at, smear: event.shiftKey }
        props.onMarquee(floating)
        return
      }
      if (marquee?.kind === 'floating') props.onDrop()
      else if (marquee) props.onMarquee(null)
      gesture.current = {
        kind: 'select',
        start: point,
        last: point,
        points: [point],
        freeform: tool === 'freeSelect',
      }
      return
    }
    if (tool === 'curve' || tool === 'polygon') {
      const open = pending.current
      if (open && open.button !== event.button) {
        pending.current = null
        show(image)
        return
      }
      if (!open) {
        pending.current =
          tool === 'curve'
            ? { kind: 'curve', start: point, end: point, controls: [], phase: 0, ink, button: event.button }
            : { kind: 'polygon', vertices: [point, point], ink, button: event.button }
      } else if (open.kind === 'curve') {
        open.controls = open.phase === 1 ? [point] : [open.controls[0] ?? point, point]
      } else open.vertices.push(point)
      gesture.current = { kind: 'pending' }
      show(pendingPreview(pending.current as Pending, image))
      return
    }
    const current: Extract<Gesture, { kind: 'draw' }> = {
      kind: 'draw',
      tool,
      start: point,
      last: point,
      preview: image,
      ink,
      alternate,
    }
    current.preview = draw(current, point, event.shiftKey)
    gesture.current = current
    show(current.preview)
    if (tool === 'spray') {
      sprayTimer.current = setInterval(() => {
        const spraying = gesture.current
        if (spraying?.kind !== 'draw' || spraying.tool !== 'spray') return
        spraying.preview = spray(
          spraying.preview,
          spraying.last,
          spraying.ink.foreground,
          options.spray,
          random.current,
        )
        if (canvas.current) drawBitmap(canvas.current, spraying.preview)
      }, 40)
    }
  }

  const up = (event: PointerEvent<HTMLCanvasElement>) => {
    clearInterval(sprayTimer.current)
    if (!gesture.current) return
    move(event)
    const current = gesture.current
    gesture.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    props.onSize(null)
    setOutline(null)
    if (current.kind === 'select') {
      const points = current.freeform ? current.points : [current.start, current.last]
      const rect = boundsOf(points)
      if (rect.width < 2 && rect.height < 2) return
      props.onMarquee({
        kind: 'region',
        selection: select(
          image,
          rect,
          { x: rect.x + rect.width - 1, y: rect.y + rect.height - 1 },
          current.freeform ? points : undefined,
        ),
      })
    } else if (current.kind === 'text') {
      const rect = bounds(current.start, current.last)
      const height = lineHeight(textStyle) + 2
      setFrame({
        rect:
          rect.width < 4 && rect.height < 4
            ? { ...rect, width: Math.max(8, Math.min(150, image.width - rect.x)), height }
            : { ...rect, height: Math.max(rect.height, height) },
        text: '',
      })
    } else if (current.kind === 'pending') {
      const open = pending.current
      if (open?.kind === 'curve') {
        if (open.phase === 2) finishPending(false)
        else open.phase = open.phase === 0 ? 1 : 2
      } else if (open?.kind === 'polygon') {
        const first = open.vertices[0],
          last = open.vertices.at(-1)
        if (
          open.vertices.length > 3 &&
          first &&
          last &&
          Math.abs(first.x - last.x) <= 2 &&
          Math.abs(first.y - last.y) <= 2
        ) {
          open.vertices.pop()
          finishPending(true)
        }
      }
    } else if (current.kind === 'draw') props.onCommit(current.preview)
  }

  const magnifier =
    tool === 'zoom' && zoom === 1 && hover && props.scroller.current
      ? (() => {
          const width = Math.min(image.width, Math.ceil(props.scroller.current.clientWidth / 4)),
            height = Math.min(image.height, Math.ceil(props.scroller.current.clientHeight / 4))
          return {
            x: Math.max(0, Math.min(image.width - width, hover.x - Math.floor(width / 2))),
            y: Math.max(0, Math.min(image.height - height, hover.y - Math.floor(height / 2))),
            width,
            height,
          }
        })()
      : null
  const boxes = [outline?.rect, marquee ? rectOf(marquee) : undefined, magnifier]
  return (
    <div
      className="relative shrink-0 bg-white shadow-[1px_1px_#000]"
      style={{ width: image.width * zoom, height: image.height * zoom }}
    >
      <canvas
        ref={canvas}
        aria-label="Paint canvas"
        className="block touch-none cursor-crosshair pixelated"
        style={{ width: image.width * zoom, height: image.height * zoom }}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={() => {
          if (!gesture.current) props.onPosition(null)
          setHover(null)
        }}
        onDoubleClick={() => {
          if (pending.current?.kind === 'polygon') finishPending(true)
        }}
        onPointerCancel={() => {
          clearInterval(sprayTimer.current)
          gesture.current = null
          show(image)
          setOutline(null)
          props.onSize(null)
        }}
      />
      {grid && zoom >= 4 && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)`,
            backgroundSize: `${zoom}px ${zoom}px`,
          }}
        />
      )}
      <svg
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none overflow-visible"
        width={image.width * zoom}
        height={image.height * zoom}
        shapeRendering="crispEdges"
      >
        {boxes.map(
          (box, index) =>
            box && (
              <g
                key={['drag', 'marquee', 'magnifier'][index]}
                data-outline={['drag', 'marquee', 'magnifier'][index]}
              >
                <rect
                  x={box.x * zoom + 0.5}
                  y={box.y * zoom + 0.5}
                  width={box.width * zoom - 1}
                  height={box.height * zoom - 1}
                  fill="none"
                  stroke="#fff"
                />
                <rect
                  x={box.x * zoom + 0.5}
                  y={box.y * zoom + 0.5}
                  width={box.width * zoom - 1}
                  height={box.height * zoom - 1}
                  fill="none"
                  stroke="#000"
                  strokeDasharray={index === 2 ? undefined : '1 1'}
                />
              </g>
            ),
        )}
        {outline?.points && (
          <polyline
            points={outline.points.map((p) => `${p.x * zoom + 0.5},${p.y * zoom + 0.5}`).join(' ')}
            fill="none"
            stroke="#000"
            strokeDasharray="1 1"
          />
        )}
      </svg>
      {frame && (
        <textarea
          // biome-ignore lint/a11y/noAutofocus: a new text frame takes the typing at once, as Paint does
          autoFocus
          aria-label="Text"
          spellCheck={false}
          wrap="soft"
          value={frame.text}
          className="absolute resize-none overflow-hidden p-0 outline-none border border-dotted border-black select-text"
          style={{
            left: frame.rect.x * zoom - 1,
            top: frame.rect.y * zoom - 1,
            width: frame.rect.width * zoom + 2,
            height: frame.rect.height * zoom + 2,
            font: cssFont(textStyle, zoom),
            lineHeight: `${lineHeight(textStyle) * zoom}px`,
            textDecoration: textStyle.underline ? 'underline' : 'none',
            color: colors.foreground,
            background: options.opaque ? colors.background : 'transparent',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
          onChange={(event) => {
            const element = event.currentTarget
            const grown = Math.ceil(element.scrollHeight / zoom)
            setFrame({
              rect: {
                ...frame.rect,
                height: Math.min(image.height - frame.rect.y, Math.max(frame.rect.height, grown)),
              },
              text: element.value,
            })
          }}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Escape') setFrame(null)
          }}
        />
      )}
    </div>
  )
}
