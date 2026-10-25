import { createPortal } from 'react-dom'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}
export function Outline({ rect }: { rect: Rect }) {
  return createPortal(
    <div
      data-outline
      className="fixed z-[11000] pointer-events-none mix-blend-difference bg-[repeating-conic-gradient(#fff_0_25%,transparent_0_50%)] bg-size-[2px_2px]"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        clipPath:
          'polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, 4px 4px, 4px calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 4px, 4px 4px)',
      }}
    />,
    document.body,
  )
}
