import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PALETTE } from '../icons/pixel'
import type { Settings } from './model'
import { useSettings } from './store'

type SaverSettings = Settings['screenSaver']
const colors = [PALETTE.r, PALETTE.l, PALETTE.b, PALETTE.y, PALETTE.c, PALETTE.m, PALETTE.w]

function wave(time: number, phase: number): number {
  return (Math.sin(time + phase) + 1) / 2
}

function flag(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const gap = Math.max(1, size / 12)
  const half = size / 2 - gap
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x - 1, y - 1, size + 2, size + 2)
  for (const [dx, dy, color] of [
    [0, 0, PALETTE.r],
    [1, 0, PALETTE.l],
    [0, 1, PALETTE.b],
    [1, 1, PALETTE.y],
  ] as const) {
    ctx.fillStyle = color
    ctx.fillRect(x + dx * (half + gap), y + dy * (half + gap), half, half)
  }
}

export function drawScreenSaver(
  ctx: CanvasRenderingContext2D,
  settings: SaverSettings,
  elapsed: number,
  width: number,
  height: number,
): void {
  const time = (elapsed * settings.speed) / 3000
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)
  switch (settings.name) {
    case '(None)':
    case 'Blank Screen':
      return
    case 'Flying Windows': {
      for (let i = 0; i < 30; i++) {
        const depth = ((time / 5 + i / 30) % 1) + 0.05
        const radius = depth * Math.max(width, height)
        const angle = i * 2.39996
        const size = 3 + (depth * width) / 16
        flag(
          ctx,
          width / 2 + Math.cos(angle) * radius - size / 2,
          height / 2 + Math.sin(angle) * radius - size / 2,
          size,
        )
      }
      return
    }
    case 'Starfield Simulation': {
      for (let i = 0; i < 180; i++) {
        const depth = ((i * 0.071 + time / 6) % 1) + 0.03
        const angle = i * 2.39996
        const spread = ((i % 17) + 2) / 19
        const x = width / 2 + Math.cos(angle) * depth * width * spread
        const y = height / 2 + Math.sin(angle) * depth * height * spread
        ctx.fillStyle = i % 4 === 0 ? '#808080' : '#ffffff'
        ctx.fillRect(Math.floor(x), Math.floor(y), depth > 0.7 ? 2 : 1, depth > 0.7 ? 2 : 1)
      }
      return
    }
    case 'Mystify Your Mind': {
      for (let trail = 0; trail < 9; trail++) {
        ctx.strokeStyle = colors[Math.floor(time / 4 + trail / 3) % colors.length] ?? '#ffffff'
        ctx.beginPath()
        for (let i = 0; i < 5; i++) {
          const t = time - trail * 0.055
          const x = 6 + wave(t * (0.3 + i * 0.1), i * 2) * (width - 12)
          const y = 6 + wave(t * (0.4 + i * 0.07), i * 3 + 1) * (height - 12)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.stroke()
      }
      return
    }
    case 'Curves and Colors': {
      for (let i = 0; i < 24; i++) {
        const t = time - i * 0.035
        ctx.strokeStyle = colors[Math.floor(i / 4 + time / 5) % colors.length] ?? '#ffffff'
        ctx.beginPath()
        ctx.moveTo(wave(t * 0.8, 0) * width, wave(t, 1) * height)
        ctx.bezierCurveTo(
          wave(t, 3) * width,
          wave(t * 0.6, 4) * height,
          wave(t * 0.7, 5) * width,
          wave(t * 0.9, 6) * height,
          wave(t * 0.5, 2) * width,
          wave(t * 0.4, 7) * height,
        )
        ctx.stroke()
      }
      return
    }
    case 'Scrolling Marquee': {
      const size = Math.max(12, Math.floor(width / 24))
      ctx.font = `bold ${size}px "MS Sans Serif", sans-serif`
      ctx.fillStyle = '#ffffff'
      const textWidth = ctx.measureText(settings.marquee).width
      const x = width - (((time * width) / 9) % (width + textWidth))
      ctx.fillText(settings.marquee, x, height / 2 + size / 2)
      return
    }
  }
}

export function SaverCanvas({ settings, className = '' }: { settings: SaverSettings; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const start = performance.now()
    let frame = 0
    const draw = (now: number) => {
      const width = Math.max(1, Math.round(canvas.clientWidth))
      const height = Math.max(1, Math.round(canvas.clientHeight))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      drawScreenSaver(ctx, settings, now - start, width, height)
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [settings])
  return <canvas ref={ref} aria-label={`${settings.name} screen saver`} className={className} />
}

export function ScreenSaverPreview({ settings, onClose }: { settings: SaverSettings; onClose: () => void }) {
  useEffect(() => {
    const previous = document.activeElement
    const started = performance.now()
    const dismiss = (event: Event) => {
      if (event.type === 'pointermove' && performance.now() - started < 150) return
      event.preventDefault()
      event.stopImmediatePropagation()
      onClose()
    }
    const events = ['keydown', 'pointermove', 'pointerdown', 'wheel'] as const
    for (const name of events) document.addEventListener(name, dismiss, { capture: true, passive: false })
    return () => {
      for (const name of events) document.removeEventListener(name, dismiss, true)
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [onClose])
  return createPortal(
    <div
      role="presentation"
      data-screen-saver={settings.name}
      className="fixed inset-0 z-[2147483647] bg-black cursor-none"
    >
      <SaverCanvas settings={settings} className="block w-full h-full" />
    </div>,
    document.body,
  )
}

export function saverIsDue(settings: SaverSettings, lastActivity: number, now: number): boolean {
  return settings.name !== '(None)' && now - lastActivity >= settings.waitMinutes * 60000
}

export function ScreenSaverHost() {
  const settings = useSettings((value) => value.screenSaver)
  const [active, setActive] = useState(false)
  useEffect(() => {
    setActive(false)
    if (settings.name === '(None)') return
    let lastActivity = Date.now()
    let timer: ReturnType<typeof setTimeout>
    const check = () => {
      const now = Date.now()
      if (saverIsDue(settings, lastActivity, now)) setActive(true)
      else timer = setTimeout(check, Math.max(1, settings.waitMinutes * 60000 - (now - lastActivity)))
    }
    const reset = () => {
      lastActivity = Date.now()
      setActive(false)
      clearTimeout(timer)
      timer = setTimeout(check, settings.waitMinutes * 60000)
    }
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const
    for (const name of events) document.addEventListener(name, reset, true)
    reset()
    return () => {
      clearTimeout(timer)
      for (const name of events) document.removeEventListener(name, reset, true)
    }
  }, [settings])
  return active ? <ScreenSaverPreview settings={settings} onClose={() => setActive(false)} /> : null
}
