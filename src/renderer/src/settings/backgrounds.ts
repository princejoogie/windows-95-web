import type { FsNode, NodeId } from '../fs/types'
import { pixelArt } from '../icons/pixel'

export const patterns = {
  Bricks: [0xff, 0x08, 0x08, 0x08, 0xff, 0x80, 0x80, 0x80],
  Buttons: [0x00, 0x7e, 0x42, 0x5a, 0x5a, 0x42, 0x7e, 0x00],
  'Cargo Net': [0x80, 0x41, 0x22, 0x14, 0x08, 0x14, 0x22, 0x41],
  Circuits: [0x18, 0x24, 0x42, 0x81, 0x81, 0x42, 0x24, 0x18],
  Cobblestones: [0x77, 0x89, 0x8f, 0x8f, 0x77, 0x98, 0xf8, 0xf8],
  Colosseum: [0xff, 0x00, 0x7e, 0x42, 0x42, 0x42, 0x42, 0xff],
  Daisies: [0x00, 0x36, 0x36, 0x08, 0x36, 0x36, 0x00, 0x00],
  Dizzy: [0x7e, 0x42, 0x5e, 0x52, 0x72, 0x02, 0x7e, 0x00],
  'Field Effect': [0x11, 0x22, 0x44, 0x88, 0x11, 0x22, 0x44, 0x88],
  Key: [0x00, 0x7e, 0x40, 0x5e, 0x52, 0x52, 0x72, 0x00],
  'Live Wire': [0x00, 0x20, 0x50, 0x88, 0x05, 0x02, 0x00, 0x00],
  Plaid: [0xff, 0x55, 0xff, 0x55, 0xff, 0x55, 0xff, 0x55],
  Paisley: [0x00, 0x18, 0x24, 0x52, 0x4a, 0x24, 0x18, 0x00],
  Rounder: [0x3c, 0x42, 0x81, 0x81, 0x81, 0x81, 0x42, 0x3c],
  Scales: [0x22, 0x41, 0x80, 0x00, 0x88, 0x14, 0x22, 0x41],
  Stone: [0xff, 0x80, 0x80, 0x80, 0xff, 0x08, 0x08, 0x08],
  Thatches: [0xf0, 0xe1, 0xc3, 0x87, 0x0f, 0x1e, 0x3c, 0x78],
  Tulip: [0x00, 0x2a, 0x3e, 0x1c, 0x08, 0x2a, 0x1c, 0x08],
  Waffle: [0xff, 0x88, 0x88, 0x88, 0xff, 0x88, 0x88, 0x88],
  Weave: [0xaa, 0x55, 0xaa, 0x55, 0xff, 0x55, 0xff, 0x55],
} satisfies Record<string, readonly number[]>

export type PatternName = keyof typeof patterns
export const patternNames = Object.keys(patterns).filter((name): name is PatternName => name in patterns)

export function patternImage(name: PatternName, foreground = '#000000'): string {
  return pixelArt(
    patterns[name].map((row) => Array.from({ length: 8 }, (_, x) => (row & (128 >> x) ? 'x' : '.')).join('')),
    { x: foreground },
  )
}

const tiles = {
  Clouds: ['wwwwwwss', 'wwwwssss', 'wwssssss', 'ssssssww', 'sssswwww', 'sswwwwww', 'wwwwwwww', 'wwwwwwww'],
  Houndstooth: [
    'kkwwkkww',
    'kkwwkkww',
    'wwkkwwkk',
    'wkkkwwkk',
    'kkwwkkww',
    'kkwwwkww',
    'wwkkwwkk',
    'wwkkwwkk',
  ],
  Rivets: ['gssssssg', 'swwwwwws', 'swwwwwws', 'swwggwws', 'swwgkwws', 'swwwwwws', 'swwwwwws', 'gssssssg'],
  Waves: ['CCCCCCCC', 'CCCccCCC', 'CCcCCcCC', 'CcCCCCcC', 'cCCCCCCc', 'CCCCCCCC', 'CCCCCCCC', 'CCCCCCCC'],
}

function setupWallpaper(): string {
  const width = 320
  const height = 200
  const rows = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      if (x > 78 && x < 244 && y > 53 && y < 142) {
        const fx = x - 100 + Math.floor((y - 60) / 9)
        const fy = y - 64
        if (fx >= 0 && fx < 112 && fy >= 0 && fy < 64 && fx % 58 < 52 && fy % 34 < 28) {
          return fy < 34 ? (fx < 58 ? 'r' : 'L') : fx < 58 ? 'b' : 'y'
        }
        if (fx < 0 && fx > -30 && fy >= 0 && fy < 64 && (x + y) % 6 < 3) return 'k'
      }
      return '.'
    }).join(''),
  )
  const foreground = decodeURIComponent(pixelArt(rows).split(',')[1] ?? '')
  const background =
    '<defs><pattern id="setup" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#008080"/><path d="M0 0h4v4H0zM4 4h4v4H4z" fill="#000080"/></pattern></defs><rect width="320" height="200" fill="url(#setup)"/>'
  return `data:image/svg+xml,${encodeURIComponent(foreground.replace('shape-rendering="crispEdges">', `shape-rendering="crispEdges">${background}`))}`
}

export const wallpapers: Record<WallpaperName, { image: string; width: number; height: number }> = {
  Setup: { image: setupWallpaper(), width: 320, height: 200 },
  Clouds: { image: pixelArt(tiles.Clouds), width: 8, height: 8 },
  Houndstooth: { image: pixelArt(tiles.Houndstooth), width: 8, height: 8 },
  Rivets: { image: pixelArt(tiles.Rivets), width: 8, height: 8 },
  Waves: { image: pixelArt(tiles.Waves), width: 8, height: 8 },
}
export const wallpaperNames = ['Setup', 'Clouds', 'Houndstooth', 'Rivets', 'Waves'] as const
export type WallpaperName = (typeof wallpaperNames)[number]

export interface BackgroundSettings {
  desktopColor: string
  pattern: PatternName | null
  wallpaper: WallpaperName | NodeId | null
  wallpaperMode: 'center' | 'tile'
}

export function desktopBackground(
  settings: BackgroundSettings,
  nodes: readonly FsNode[] = [],
): Record<string, string> {
  const pattern = settings.pattern ? `url("${patternImage(settings.pattern)}")` : 'none'
  const builtin = wallpaperNames.find((name) => name === settings.wallpaper)
  const wallpaper = builtin ? wallpapers[builtin] : fileWallpaperImage(settings.wallpaper, nodes)
  return {
    '--desktop-image': wallpaper ? `url("${wallpaper.image}"), ${pattern}` : pattern,
    '--desktop-repeat': wallpaper
      ? `${settings.wallpaperMode === 'tile' ? 'repeat' : 'no-repeat'}, repeat`
      : 'repeat',
    '--desktop-position': wallpaper ? 'center center, left top' : 'left top',
    '--desktop-size': wallpaper ? `${wallpaper.width}px ${wallpaper.height}px, 8px 8px` : '8px 8px',
  }
}

export function wallpaperNode(value: unknown, nodes: readonly FsNode[]) {
  return nodes.find(
    (node) => node.id === value && node.kind === 'file' && node.content.startsWith('data:image/png;base64,'),
  )
}

function fileWallpaperImage(
  value: unknown,
  nodes: readonly FsNode[],
): { image: string; width: number; height: number } | null {
  const node = wallpaperNode(value, nodes)
  if (node?.kind !== 'file') return null
  try {
    const bytes = Uint8Array.from(atob(node.content.slice(22, 54)), (char) => char.charCodeAt(0))
    const header = new DataView(bytes.buffer)
    if (header.getUint32(0) !== 0x89504e47 || header.getUint32(12) !== 0x49484452) return null
    const width = header.getUint32(16)
    const height = header.getUint32(20)
    return width && height ? { image: node.content, width, height } : null
  } catch {
    return null
  }
}
