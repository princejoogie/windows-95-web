import { useSyncExternalStore } from 'react'
import type { Piece } from './bitmap'
import { drawBitmap } from './Canvas'

let held: Piece | null = null
const listeners = new Set<() => void>()

/** Every Paint window shares one clipboard. A copy also goes to the system clipboard as a PNG. */
export function copyPiece(piece: Piece) {
  held = piece
  for (const listener of listeners) listener()
  const canvas = document.createElement('canvas')
  drawBitmap(canvas, piece)
  canvas.toBlob((blob) => {
    if (!blob || typeof ClipboardItem === 'undefined') return
    navigator.clipboard?.write([new ClipboardItem({ 'image/png': blob })]).catch(() => undefined)
  }, 'image/png')
}

export const clipboardPiece = () => held

export function useClipboard(): Piece | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => held,
  )
}
