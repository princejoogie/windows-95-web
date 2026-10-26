import sansUrl from '../assets/fonts/micross.ttf?url'
import { isInside } from '../fs/fs'
import { fsStore } from '../fs/store'
import { type NodeId, RECYCLED_DIR } from '../fs/types'
import { createStore, useStore } from '../lib/store'
import { type FontMetadata, fontBytes, fontData, inspectFont } from './sfnt'

type FontSource =
  | { readonly kind: 'bundled'; readonly id: string }
  | { readonly kind: 'copy'; readonly data: string }
  | { readonly kind: 'link'; readonly node: NodeId }
export interface InstalledFont extends FontMetadata {
  readonly id: string
  readonly family: string
  readonly file: string
  readonly source: FontSource
}
export interface FontMedia {
  readonly id: string
  readonly file: string
  readonly url: string
  readonly preinstalled: boolean
}
const system = import.meta.glob('../assets/system/*.ttf', { eager: true, query: '?url', import: 'default' })
const media: FontMedia[] = [{ id: 'micross', file: 'MICROSS.TTF', url: sansUrl, preinstalled: false }]
for (const [path, url] of Object.entries(system)) {
  if (typeof url === 'string' && (path.endsWith('/ms-sans-serif-8.ttf') || path.endsWith('/fixedsys-12.ttf')))
    media.push({
      id: path.includes('fixedsys') ? 'fixedsys' : 'ms-sans-serif',
      file: path.includes('fixedsys') ? 'VGAFIX.TTF' : 'SSERIFE.TTF',
      url,
      preinstalled: true,
    })
}
export const fontMedia: readonly FontMedia[] = media
export const FONT_CATALOG_KEY = 'win95.fonts.v1'
export const fontCatalog = createStore(
  (_: readonly InstalledFont[], next: readonly InstalledFont[]) => next,
  [],
)
const faces = new Map<string, FontFace>()
let loading: Promise<void> | undefined

async function sourceBytes(source: FontSource): Promise<Uint8Array<ArrayBuffer>> {
  if (source.kind === 'copy') return fontBytes(source.data)
  if (source.kind === 'link') {
    const state = fsStore.get()
    const node = state.nodes[source.node]
    if (node?.kind !== 'file' || isInside(state, node.id, RECYCLED_DIR))
      throw new Error('The font source file is unavailable.')
    return fontBytes(node.content)
  }
  const bundled = fontMedia.find((entry) => entry.id === source.id)
  if (!bundled) throw new Error('The font installation media is unavailable.')
  const response = await fetch(bundled.url)
  if (!response.ok) throw new Error('The font installation media is unavailable.')
  return new Uint8Array(await response.arrayBuffer())
}

async function loadFont(id: string, file: string, source: FontSource): Promise<InstalledFont> {
  const bytes = await sourceBytes(source)
  const metadata = inspectFont(bytes)
  const family = metadata.name
  const face = await new FontFace(family, bytes).load()
  const previous = faces.get(id)
  if (previous) document.fonts.delete(previous)
  document.fonts.add(face)
  faces.set(id, face)
  return { ...metadata, id, family, file, source }
}

function savedSources(): { id: string; file: string; source: FontSource }[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(FONT_CATALOG_KEY) ?? '[]')
    if (!Array.isArray(saved)) return []
    return saved.flatMap<{ id: string; file: string; source: FontSource }>((item: unknown) => {
      if (
        !item ||
        typeof item !== 'object' ||
        !('id' in item) ||
        typeof item.id !== 'string' ||
        !/^[a-zA-Z0-9-]+$/.test(item.id) ||
        !('file' in item) ||
        typeof item.file !== 'string' ||
        !('source' in item) ||
        !item.source ||
        typeof item.source !== 'object'
      )
        return []
      const source = item.source
      if ('kind' in source && source.kind === 'bundled' && 'id' in source && typeof source.id === 'string')
        return [{ id: item.id, file: item.file, source: { kind: 'bundled' as const, id: source.id } }]
      if ('kind' in source && source.kind === 'copy' && 'data' in source && typeof source.data === 'string')
        return [{ id: item.id, file: item.file, source: { kind: 'copy' as const, data: source.data } }]
      if ('kind' in source && source.kind === 'link' && 'node' in source && typeof source.node === 'string') {
        const node = Object.values(fsStore.get().nodes).find((node) => node.id === source.node)
        return node
          ? [{ id: item.id, file: item.file, source: { kind: 'link' as const, node: node.id } }]
          : []
      }
      return []
    })
  } catch {
    return []
  }
}

export function ensureFonts(): Promise<void> {
  loading ??= (async () => {
    const defaults = fontMedia
      .filter((entry) => entry.preinstalled)
      .map((entry) => ({
        id: entry.id,
        file: entry.file,
        source: { kind: 'bundled' as const, id: entry.id },
      }))
    const available = await Promise.allSettled(
      [...defaults, ...savedSources()].map((entry) => loadFont(entry.id, entry.file, entry.source)),
    )
    fontCatalog.dispatch(available.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])))
  })()
  return loading
}

export function useFonts(): readonly InstalledFont[] {
  void ensureFonts()
  return useStore(fontCatalog, (fonts) => fonts)
}
export function useFontChoices(existing: readonly string[]): readonly string[] {
  const installed = useFonts()
  return [...new Set([...existing, ...installed.map((font) => font.name)])]
}

export async function installFont(input: {
  file: string
  source: { kind: 'bundled'; id: string } | { kind: 'link'; node: NodeId }
  copy: boolean
}): Promise<void> {
  await ensureFonts()
  if (!/\.(ttf|otf)$/i.test(input.file))
    throw new Error('Only TrueType (.ttf) and OpenType (.otf) files are supported. No font was installed.')
  const bytes = await sourceBytes(input.source)
  const metadata = inspectFont(bytes)
  if (fontCatalog.get().some((font) => font.name.toLowerCase() === metadata.name.toLowerCase()))
    throw new Error(`${metadata.name} is already installed.`)
  const source: FontSource = input.copy ? { kind: 'copy', data: fontData(bytes) } : input.source
  const font = await loadFont(crypto.randomUUID(), input.file, source)
  const next = [...fontCatalog.get(), font].sort((a, b) => a.name.localeCompare(b.name))
  try {
    localStorage.setItem(
      FONT_CATALOG_KEY,
      JSON.stringify(
        next.filter((entry) => !fontMedia.some((media) => media.id === entry.id && media.preinstalled)),
      ),
    )
  } catch {
    const face = faces.get(font.id)
    if (face) document.fonts.delete(face)
    throw new Error('There is not enough storage to install this font. No font was installed.')
  }
  fontCatalog.dispatch(next)
}

export const fontFamily = (fonts: readonly InstalledFont[], name: string): string =>
  fonts.find((font) => font.name === name)?.family ?? name
