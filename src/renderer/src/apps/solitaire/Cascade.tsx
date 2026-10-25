import { useEffect, useRef } from 'react'
import { cardImage } from './cards'
import { RANKS, SUITS } from './game'

interface FlyingCard {
  image: HTMLImageElement
  x: number
  y: number
  vx: number
  vy: number
}

export function Cascade({
  width,
  height,
  scale,
  active,
  onStop,
}: {
  width: number
  height: number
  scale: number
  active: boolean
  onStop: () => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const progress = useRef<{ emitted: number; next: number; cards: FlyingCard[] }>({
    emitted: 0,
    next: 0,
    cards: [],
  })
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context || !active) return
    context.imageSmoothingEnabled = false
    let frame = 0
    let last = 0
    const run = (now: number) => {
      const dt = last ? Math.min(2, (now - last) / (1000 / 60)) : 1
      last = now
      const state = progress.current
      state.next -= dt
      if (state.emitted < 52 && state.next <= 0) {
        const suit = SUITS[state.emitted % 4]
        const rank = RANKS[12 - Math.floor(state.emitted / 4)]
        if (suit && rank) {
          const image = new Image()
          image.src = cardImage({ suit, rank })
          const gap = (width - 24 * scale - 71 * scale) / 6
          state.cards.push({
            image,
            x: 12 * scale + (3 + (state.emitted % 4)) * gap,
            y: 12 * scale,
            vx: ((state.emitted % 3) + 2) * (state.emitted % 2 ? -1 : 1) * scale,
            vy: 0,
          })
        }
        state.emitted++
        state.next = 28
      }
      for (const card of state.cards) {
        card.x += card.vx * dt
        card.vy += 0.48 * scale * dt
        card.y += card.vy * dt
        if (card.y + 96 * scale >= height && card.vy > 0) {
          card.y = height - 96 * scale
          card.vy = -Math.max(5 * scale, card.vy * 0.78)
        }
        if (card.image.complete && card.image.naturalWidth)
          context.drawImage(card.image, card.x, card.y, 71 * scale, 96 * scale)
      }
      state.cards = state.cards.filter((card) => card.x > -80 * scale && card.x < width)
      frame = requestAnimationFrame(run)
    }
    frame = requestAnimationFrame(run)
    return () => cancelAnimationFrame(frame)
  }, [active, height, scale, width])
  return (
    <button
      type="button"
      className="absolute inset-0 z-30 cursor-default"
      aria-label="Stop winning animation"
      onClick={onStop}
    >
      <canvas ref={canvas} width={Math.round(width)} height={Math.round(height)} className="block" />
    </button>
  )
}
