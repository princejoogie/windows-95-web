import {
  type Bitmap,
  cut,
  erase,
  type Piece,
  type Point,
  place,
  type Rect,
  type Selection,
  type Transform,
  transform,
} from './bitmap'

/**
 * The selection. A `region` only marks pixels. Dragging, pasting, or transforming it makes it `floating`:
 * the piece rides above `base`, which already holds the hole the piece left, until it is dropped.
 */
export type Marquee =
  | { readonly kind: 'region'; readonly selection: Selection }
  | { readonly kind: 'floating'; readonly base: Bitmap; readonly piece: Piece; readonly at: Point }
export type Floating = Extract<Marquee, { kind: 'floating' }>

export function rectOf(marquee: Marquee): Rect {
  if (marquee.kind === 'region') {
    const { x, y, width, height } = marquee.selection
    return { x, y, width, height }
  }
  return { ...marquee.at, width: marquee.piece.width, height: marquee.piece.height }
}

export function contains(marquee: Marquee, point: Point): boolean {
  const rect = rectOf(marquee)
  return (
    point.x >= rect.x && point.y >= rect.y && point.x < rect.x + rect.width && point.y < rect.y + rect.height
  )
}

/** What the canvas shows: the picture with any floating piece drawn on it. */
export function picture(image: Bitmap, marquee: Marquee | null, transparent?: string): Bitmap {
  return marquee?.kind === 'floating' ? place(marquee.base, marquee.piece, marquee.at, transparent) : image
}

/**
 * Lifts a region off the picture, leaving the background behind. With `copy` (Ctrl+drag) the picture
 * keeps its pixels, and a piece that is already floating leaves a copy of itself where it is.
 */
export function lift(
  image: Bitmap,
  marquee: Marquee,
  background: string,
  copy = false,
  transparent?: string,
): Floating {
  if (marquee.kind === 'floating')
    return copy ? { ...marquee, base: place(marquee.base, marquee.piece, marquee.at, transparent) } : marquee
  const { selection } = marquee
  return {
    kind: 'floating',
    base: copy ? image : erase(image, selection, background),
    piece: cut(image, selection),
    at: { x: selection.x, y: selection.y },
  }
}

/** The pixels Copy puts on the clipboard. */
export function pieceOf(image: Bitmap, marquee: Marquee): Piece {
  return marquee.kind === 'floating' ? marquee.piece : cut(image, marquee.selection)
}

/** The picture after Clear Selection or Cut. */
export function cleared(image: Bitmap, marquee: Marquee, background: string): Bitmap {
  return marquee.kind === 'floating' ? marquee.base : erase(image, marquee.selection, background)
}

/** Flip, Rotate, Stretch, Skew, and Invert act on the selection when there is one. */
export function reshape(
  image: Bitmap,
  marquee: Marquee,
  background: string,
  change: (piece: Piece) => Piece,
): Floating {
  const floating = lift(image, marquee, background)
  return { ...floating, piece: change(floating.piece) }
}

export const turn = (kind: Transform) => (piece: Piece) => transform(piece, kind)
