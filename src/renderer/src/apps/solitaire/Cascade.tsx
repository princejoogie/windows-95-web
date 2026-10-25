import { useEffect, useRef } from 'react'
import { cardImage } from './cards'
import { FOUNDATION_SLOTS, type Foundations } from './game'

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
  foundations,
  active,
  onStop,
}: {
  width: number
  height: number
  foundations: Foundations
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
        const pile = FOUNDATION_SLOTS[state.emitted % 4]
        const card = pile === undefined ? undefined : foundations[pile][12 - Math.floor(state.emitted / 4)]
        if (card) {
          const image = new Image()
          image.src = cardImage(card)
          const gap = (width - 24 - 71) / 6
          state.cards.push({
            image,
            x: Math.round(12 + (3 + (state.emitted % 4)) * gap),
            y: 12,
            vx: ((state.emitted % 3) + 2) * (state.emitted % 2 ? -1 : 1),
            vy: 0,
          })
        }
        state.emitted++
        state.next = 28
      }
      for (const card of state.cards) {
        card.x += card.vx * dt
        card.vy += 0.48 * dt
        card.y += card.vy * dt
        if (card.y + 96 >= height && card.vy > 0) {
          card.y = height - 96
          card.vy = -Math.max(5, card.vy * 0.78)
        }
        if (card.image.complete && card.image.naturalWidth)
          context.drawImage(card.image, Math.round(card.x), Math.round(card.y), 71, 96)
      }
      state.cards = state.cards.filter((card) => card.x > -80 && card.x < width)
      frame = requestAnimationFrame(run)
    }
    frame = requestAnimationFrame(run)
    return () => cancelAnimationFrame(frame)
  }, [active, foundations, height, width])
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
