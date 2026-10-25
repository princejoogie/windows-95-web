import { useEffect, useRef } from 'react'

const WIDTH = 640
const HEIGHT = 480
type Splash = 'booting' | 'shutting-down' | 'restarting' | 'off'

function clouds(context: CanvasRenderingContext2D) {
  const image = context.createImageData(WIDTH, HEIGHT)
  const banks = [
    [-30, 350, 130, 54],
    [80, 337, 74, 42],
    [152, 376, 100, 66],
    [240, 424, 124, 78],
    [360, 443, 150, 64],
    [510, 401, 130, 68],
    [643, 337, 112, 47],
    [27, 59, 89, 27],
    [95, 32, 70, 32],
    [590, 91, 106, 33],
    [480, 73, 80, 20],
    [348, 200, 100, 18],
  ]
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      let density = 0
      for (const [cx = 0, cy = 0, rx = 1, ry = 1] of banks) {
        const distance = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
        if (distance < 8) density += Math.exp(-distance * 1.8)
      }
      const detail = Math.sin(x * 0.079 + Math.sin(y * 0.09)) * Math.sin(y * 0.12 + x * 0.04) * 0.06
      const cover = Math.min(1, Math.max(0, (density + detail - 0.1) * 1.75))
      const base = [67 + y * 0.15, 112 + y * 0.12, 204 + y * 0.05]
      const offset = (y * WIDTH + x) * 4
      for (let channel = 0; channel < 3; channel++)
        image.data[offset + channel] = Math.round(
          (base[channel] ?? 0) * (1 - cover) + (244 + channel * 4) * cover,
        )
      image.data[offset + 3] = 255
    }
  context.putImageData(image, 0, 0)
}

function flag(context: CanvasRenderingContext2D) {
  const colors = ['#ef260d', '#21a72f', '#173fd0', '#ffd223']
  for (let y = 0; y < 124; y++)
    for (let x = 0; x < 184; x++) {
      const tail = x < 54
      if (tail && (x % 12 > 6 || y % 14 > 8 || x / 54 < ((y * 13 + Math.floor(x / 12) * 17) % 11) / 14))
        continue
      const wave = Math.sin(x / 35) * 10
      const dx = 227 + x + Math.round(y * 0.21)
      const dy = 91 + y + Math.round(wave - x * 0.16)
      const col = x < 119 ? 0 : 1
      const row = y < 61 ? 0 : 1
      const border =
        tail || x < 62 || x > 177 || (x > 112 && x < 124) || y < 7 || y > 116 || (y > 55 && y < 68)
      context.fillStyle = border ? '#000000' : (colors[row * 2 + col] ?? '#000000')
      context.fillRect(dx, dy, 2, 2)
    }
}

function centered(context: CanvasRenderingContext2D, text: string, y: number) {
  context.fillText(text, Math.round((WIDTH - context.measureText(text).width) / 2), y)
}

function splash(context: CanvasRenderingContext2D) {
  clouds(context)
  flag(context)
  context.fillStyle = '#000000'
  context.textBaseline = 'alphabetic'
  context.font = '25px Arial, sans-serif'
  context.fillText('Microsoft', 113, 260)
  context.font = 'bold 68px Arial, sans-serif'
  context.fillText('Windows', 106, 325)
  const width = context.measureText('Windows').width
  context.font = '68px Arial, sans-serif'
  context.fillText('95', Math.round(111 + width), 325)
  context.font = '12px Arial, sans-serif'
  context.fillText('Microsoft Corporation', 422, 443)
}

export function PowerScreens({ power, onBoot }: { power: Splash; onBoot: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    const background = document.createElement('canvas')
    background.width = WIDTH
    background.height = HEIGHT
    const art = background.getContext('2d')
    if (!art) return
    splash(art)
    let frame = 0
    const paint = () => {
      context.fillStyle = '#000000'
      context.fillRect(0, 0, WIDTH, HEIGHT)
      if (power === 'off') {
        context.fillStyle = '#ff8000'
        context.font = 'bold 26px "MS Sans Serif Bitmap 12pt", "MS Sans Serif Bitmap", sans-serif'
        context.textBaseline = 'alphabetic'
        centered(context, "It's now safe to turn off", 221)
        centered(context, 'your computer.', 257)
      } else if (power === 'booting' && frame < 4) {
        context.fillStyle = '#c0c0c0'
        context.font = '12px "Fixedsys Bitmap", monospace'
        context.textBaseline = 'top'
        context.fillText('Starting Windows 95...', 8, 8)
      } else {
        context.drawImage(background, 0, 0)
        if (power !== 'booting') {
          context.fillStyle = '#000000'
          context.font = 'bold 16px "MS Sans Serif Bitmap 12pt", sans-serif'
          context.textBaseline = 'alphabetic'
          centered(context, 'Please wait while your', 375)
          centered(context, 'computer shuts down.', 397)
        }
        for (let x = 0; x < WIDTH; x++) {
          const wave = (Math.sin((x - frame * 14) / 35) + 1) / 2
          context.fillStyle = `rgb(${Math.round(wave * 160)},${Math.round(32 + wave * 160)},${Math.round(128 + wave * 127)})`
          context.fillRect(x, 472, 1, 8)
        }
      }
      frame++
    }
    paint()
    const timer = setInterval(paint, 80)
    return () => clearInterval(timer)
  }, [power])
  const text =
    power === 'off'
      ? "It's now safe to turn off your computer."
      : power === 'booting'
        ? 'Starting Windows 95...'
        : 'Please wait while your computer shuts down.'
  return (
    <button
      type="button"
      data-power-screen={power}
      className="w-full h-full bg-black flex items-center justify-center outline-none"
      onClick={onBoot}
    >
      <span role="status" className="sr-only">
        {text}
      </span>
      <canvas ref={canvas} width={WIDTH} height={HEIGHT} className="w-full h-full object-contain pixelated" />
    </button>
  )
}
