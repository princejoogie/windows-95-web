import { useEffect, useRef } from 'react'

const letters: Record<string, string> = {
  A: '01110/10001/10001/11111/10001/10001/10001',
  B: '11110/10001/10001/11110/10001/10001/11110',
  C: '01111/10000/10000/10000/10000/10000/01111',
  D: '11110/10001/10001/10001/10001/10001/11110',
  E: '11111/10000/10000/11110/10000/10000/11111',
  F: '11111/10000/10000/11110/10000/10000/10000',
  G: '01111/10000/10000/10111/10001/10001/01111',
  H: '10001/10001/10001/11111/10001/10001/10001',
  I: '111/010/010/010/010/010/111',
  J: '00111/00010/00010/00010/10010/10010/01100',
  K: '10001/10010/10100/11000/10100/10010/10001',
  L: '10000/10000/10000/10000/10000/10000/11111',
  M: '10001/11011/10101/10101/10001/10001/10001',
  N: '10001/11001/10101/10011/10001/10001/10001',
  O: '01110/10001/10001/10001/10001/10001/01110',
  P: '11110/10001/10001/11110/10000/10000/10000',
  Q: '01110/10001/10001/10001/10101/10010/01101',
  R: '11110/10001/10001/11110/10100/10010/10001',
  S: '01111/10000/10000/01110/00001/00001/11110',
  T: '11111/00100/00100/00100/00100/00100/00100',
  U: '10001/10001/10001/10001/10001/10001/01110',
  V: '10001/10001/10001/10001/10001/01010/00100',
  W: '10001/10001/10001/10101/10101/10101/01010',
  X: '10001/10001/01010/00100/01010/10001/10001',
  Y: '10001/10001/01010/00100/00100/00100/00100',
  Z: '11111/00001/00010/00100/01000/10000/11111',
  '9': '01110/10001/10001/01111/00001/00001/01110',
  '5': '11111/10000/10000/11110/00001/00001/11110',
  '.': '0/0/0/0/0/1/1',
  "'": '1/1/0/0/0/0/0',
  ' ': '000/000/000/000/000/000/000',
}
function pixelText(
  context: CanvasRenderingContext2D,
  text: string,
  y: number,
  scale: number,
  color: string,
  left?: number,
) {
  const glyphs = [...text.toUpperCase()].map((char) => (letters[char] ?? letters[' '] ?? '').split('/'))
  const width = glyphs.reduce((sum, glyph) => sum + ((glyph[0]?.length ?? 0) + 1) * scale, 0)
  let x = left ?? (640 - width) / 2
  context.fillStyle = color
  for (const glyph of glyphs) {
    glyph.forEach((row, gy) => {
      ;[...row].forEach((pixel, gx) => {
        if (pixel === '1') context.fillRect(Math.round(x + gx * scale), y + gy * scale, scale, scale)
      })
    })
    x += ((glyph[0]?.length ?? 0) + 1) * scale
  }
}
function sky(context: CanvasRenderingContext2D) {
  const image = context.createImageData(640, 480)
  for (let y = 0; y < 480; y++)
    for (let x = 0; x < 640; x++) {
      const cloud = Math.sin(x / 52 + Math.sin(y / 33)) + Math.sin(y / 28) + Math.sin((x + y) / 80)
      const light = Math.max(0, Math.min(1, (cloud + y / 180 - 0.8) / 3))
      const level = Math.floor(light * 5 + ((x + y) % 2) / 2) / 5
      const i = (y * 640 + x) * 4
      image.data[i] = Math.round(32 + 218 * level)
      image.data[i + 1] = Math.round(64 + 186 * level)
      image.data[i + 2] = 255
      image.data[i + 3] = 255
    }
  context.putImageData(image, 0, 0)
  for (let y = 0; y < 88; y++)
    for (let x = 0; x < 100; x++) {
      const wave = Math.round(Math.sin(x / 20) * 6)
      if (x % 50 < 5 || y % 44 < 5) continue
      context.fillStyle = y < 44 ? (x < 50 ? '#ff0000' : '#00a800') : x < 50 ? '#0000a8' : '#ffff00'
      context.fillRect(285 + x, 100 + y + wave, 1, 1)
    }
  for (let x = 0; x < 9; x++)
    for (let y = 0; y < 8; y++) {
      if ((x + y) % 3 === 0) continue
      context.fillStyle = '#000000'
      context.fillRect(210 + x * 8, 101 + y * 10 + Math.round(Math.sin(x / 2) * 6), 5 + (x % 3), 6)
    }
  pixelText(context, 'Microsoft', 218, 2, '#000000', 168)
  pixelText(context, 'Windows 95', 242, 5, '#000000')
}

export function PowerScreens({
  power,
  onBoot,
}: {
  power: 'booting' | 'shutting-down' | 'restarting' | 'off'
  onBoot: () => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    let frame = 0
    const paint = () => {
      context.fillStyle = '#000000'
      context.fillRect(0, 0, 640, 480)
      if (power === 'off') {
        pixelText(context, "It's now safe to turn off", 204, 3, '#ff8000')
        pixelText(context, 'your computer.', 242, 3, '#ff8000')
      } else if (power === 'booting' && frame < 4)
        pixelText(context, 'Starting Windows 95...', 8, 2, '#c0c0c0', 8)
      else {
        sky(context)
        if (power !== 'booting') {
          pixelText(context, 'Please wait while your', 340, 2, '#000000')
          pixelText(context, 'computer shuts down.', 360, 2, '#000000')
        }
        for (let x = 0; x < 640; x++) {
          context.fillStyle =
            ['#000080', '#0000ff', '#8080ff', '#c0c0ff'][Math.floor((x + frame * 16) / 32) % 4] ?? '#000080'
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
      className="w-full h-full bg-black flex items-center justify-center outline-none"
      onClick={onBoot}
    >
      <span role="status" className="sr-only">
        {text}
      </span>
      <canvas
        ref={canvas}
        width="640"
        height="480"
        aria-label={text}
        className="w-full h-full object-contain pixelated"
      />
    </button>
  )
}
