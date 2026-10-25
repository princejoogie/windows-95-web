import { uniqueName } from '../fs/fs'
import { createNode, fs } from '../fs/store'
import { type NodeId, WINDOWS_DIR } from '../fs/types'
import { withWaitCursor } from '../system/cursors'
import type { BackgroundSettings } from './backgrounds'
import { settingsStore } from './store'

export async function setPaintWallpaper({
  content,
  mode,
  file,
}: {
  content: string
  mode: BackgroundSettings['wallpaperMode']
  file: NodeId | null
}): Promise<void> {
  await withWaitCursor(async () => {
    const image = new Image()
    image.src = content
    await image.decode()
    const state = fs.get()
    const saved = file ? state.nodes[file] : undefined
    const current = settingsStore.get().wallpaper
    const previous = Object.values(state.nodes).find((node) => node.id === current)
    const matching = [saved, previous].find((node) => node?.kind === 'file' && node.content === content)
    let id = matching?.id
    if (!id) {
      const name = uniqueName(state, WINDOWS_DIR, 'Paint Wallpaper.bmp')
      const result = createNode(WINDOWS_DIR, name, { kind: 'file', content })
      if ('error' in result) throw new Error(result.error)
      id = result.id
    }
    settingsStore.dispatch({ type: 'apply', patch: { wallpaper: id, wallpaperMode: mode } })
  })
}
