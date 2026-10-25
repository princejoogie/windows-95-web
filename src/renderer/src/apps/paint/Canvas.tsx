import { type PointerEvent, useEffect, useRef, useState } from 'react'
import {
  type Bitmap,
  bounds,
  colorAt,
  flood,
  type Ink,
  moveSelection,
  type Point,
  type Rect,
  type Selection,
  type Shape,
  seededRandom,
  select,
  shape,
  spray,
  stroke,
} from './bitmap'
import type { Tool } from './tools'

type DrawingTool = Shape | 'pencil' | 'brush' | 'eraser' | 'spray'
type Gesture =
  | { kind: 'draw'; tool: DrawingTool; start: Point; last: Point; preview: Bitmap; ink: Ink }
  | { kind: 'select'; start: Point; last: Point; points: Point[]; freeform: boolean }
  | { kind: 'move'; selection: Selection; start: Point; destination: Point; preview: Bitmap }

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

interface CanvasProps {
  active: boolean
  image: Bitmap
  tool: Tool
  ink: Ink
  zoom: number
  onCommit: (image: Bitmap) => void
  onColor: (color: string, background: boolean) => void
  onZoom: (zoom: number) => void
  onPosition: (point: Point) => void
  onText: (point: Point) => void
}
export function PaintCanvas({
  active,
  image,
  tool,
  ink,
  zoom,
  onCommit,
  onColor,
  onZoom,
  onPosition,
  onText,
}: CanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [outline, setOutline] = useState<Rect | null>(null)
  const random = useRef(seededRandom(95))
  const sprayTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  useEffect(() => {
    clearInterval(sprayTimer.current)
    gesture.current = null
    if (canvas.current) drawBitmap(canvas.current, image)
    setSelection(null)
    setOutline(null)
    return () => clearInterval(sprayTimer.current)
  }, [image])
  useEffect(() => {
    if (active) return
    clearInterval(sprayTimer.current)
    gesture.current = null
    if (canvas.current) drawBitmap(canvas.current, image)
  }, [active, image])
  useEffect(() => {
    if (tool !== 'select' && tool !== 'freeSelect') {
      setSelection(null)
      setOutline(null)
    }
  }, [tool])
  const show = (next: Bitmap) => {
    if (canvas.current) drawBitmap(canvas.current, next)
  }
  const position = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(image.width - 1, Math.floor((event.clientX - rect.left) / zoom))),
      y: Math.max(0, Math.min(image.height - 1, Math.floor((event.clientY - rect.top) / zoom))),
    }
  }
  const draw = (current: Extract<Gesture, { kind: 'draw' }>, point: Point): Bitmap => {
    const color = current.ink.foreground
    switch (current.tool) {
      case 'pencil':
        return stroke(current.preview, current.last, point, color)
      case 'brush':
        return stroke(current.preview, current.last, point, color, current.ink.width, current.ink.brush)
      case 'eraser':
        return stroke(current.preview, current.last, point, current.ink.background, current.ink.width * 3)
      case 'spray':
        return spray(current.preview, point, color, current.ink.width * 3, random.current)
      default:
        return shape(image, current.tool, current.start, point, current.ink)
    }
  }
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = position(event)
    onPosition(point)
    const current = gesture.current
    if (!current) return
    if (current.kind === 'draw') {
      current.preview = draw(current, point)
      current.last = point
      show(current.preview)
    } else if (current.kind === 'select') {
      current.last = point
      current.points.push(point)
      const points = current.freeform ? current.points : [current.start, point]
      setOutline(
        bounds(
          { x: Math.min(...points.map((p) => p.x)), y: Math.min(...points.map((p) => p.y)) },
          { x: Math.max(...points.map((p) => p.x)), y: Math.max(...points.map((p) => p.y)) },
        ),
      )
    } else {
      current.destination = {
        x: Math.max(
          0,
          Math.min(image.width - current.selection.width, current.selection.x + point.x - current.start.x),
        ),
        y: Math.max(
          0,
          Math.min(image.height - current.selection.height, current.selection.y + point.y - current.start.y),
        ),
      }
      current.preview = moveSelection(image, current.selection, current.destination, ink.background)
      show(current.preview)
      setOutline({ ...current.selection, ...current.destination })
    }
  }
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
        onPointerDown={(event) => {
          if (!active) return
          if (event.button !== 0 && event.button !== 2) return
          const point = position(event),
            background = event.button === 2
          const colors = background ? { ...ink, foreground: ink.background, background: ink.foreground } : ink
          if (tool === 'picker') {
            onColor(colorAt(image, point), background)
            return
          }
          if (tool === 'zoom') {
            onZoom(zoom === 1 ? 4 : 1)
            return
          }
          if (tool === 'fill') {
            onCommit(flood(image, point, colors.foreground))
            return
          }
          if (tool === 'text') {
            onText(point)
            return
          }
          event.currentTarget.setPointerCapture(event.pointerId)
          if (tool === 'select' || tool === 'freeSelect') {
            if (
              selection &&
              point.x >= selection.x &&
              point.y >= selection.y &&
              point.x < selection.x + selection.width &&
              point.y < selection.y + selection.height
            ) {
              gesture.current = {
                kind: 'move',
                selection,
                start: point,
                destination: selection,
                preview: image,
              }
            } else {
              setSelection(null)
              setOutline(null)
              gesture.current = {
                kind: 'select',
                start: point,
                last: point,
                points: [point],
                freeform: tool === 'freeSelect',
              }
            }
          } else {
            const current: Extract<Gesture, { kind: 'draw' }> = {
              kind: 'draw',
              tool,
              start: point,
              last: point,
              preview: image,
              ink: colors,
            }
            current.preview = draw(current, point)
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
                  spraying.ink.width * 3,
                  random.current,
                )
                if (canvas.current) drawBitmap(canvas.current, spraying.preview)
              }, 40)
            }
          }
        }}
        onPointerMove={move}
        onPointerUp={(event) => {
          clearInterval(sprayTimer.current)
          if (!gesture.current) return
          move(event)
          const current = gesture.current
          gesture.current = null
          event.currentTarget.releasePointerCapture(event.pointerId)
          if (current.kind === 'select') {
            const points = current.freeform ? current.points : [current.start, current.last]
            const from = { x: Math.min(...points.map((p) => p.x)), y: Math.min(...points.map((p) => p.y)) },
              to = { x: Math.max(...points.map((p) => p.x)), y: Math.max(...points.map((p) => p.y)) }
            const next = select(image, from, to, current.freeform ? points : undefined)
            setSelection(next)
            setOutline(next)
          } else {
            onCommit(current.preview)
            setSelection(null)
            setOutline(null)
          }
        }}
        onPointerCancel={() => {
          clearInterval(sprayTimer.current)
          gesture.current = null
          show(image)
          setOutline(selection)
        }}
      />
      {outline && (
        <div
          className="absolute pointer-events-none border border-dashed border-black"
          style={{
            left: outline.x * zoom,
            top: outline.y * zoom,
            width: outline.width * zoom,
            height: outline.height * zoom,
          }}
        />
      )}
    </div>
  )
}
