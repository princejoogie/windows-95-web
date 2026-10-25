import { fsStore } from '../fs/store'
import type { FsNode, NodeId } from '../fs/types'
import { createStore, useStore } from '../lib/store'
import { resolveShortcut } from './clipboard'
import { shellEvents } from './events'
import { rememberDocument } from './recent'
import { appForFile, getApp } from './registry'
import type { LaunchArgs, WindowId } from './types'
import { emptyWindows, type WindowsState, windowsReducer } from './windows'

export const windowsStore = createStore(windowsReducer, emptyWindows)
let previous = emptyWindows
windowsStore.subscribe(() => {
  const next = windowsStore.get()
  for (const window of next.windows) {
    const before = previous.windows.find((entry) => entry.id === window.id)
    if (!before) shellEvents.emit('open')
    else {
      if (before.minimized !== window.minimized) shellEvents.emit(window.minimized ? 'minimize' : 'restore')
      if (before.maximized !== window.maximized) shellEvents.emit(window.maximized ? 'maximize' : 'restore')
    }
  }
  for (const window of previous.windows)
    if (!next.windows.some((entry) => entry.id === window.id)) shellEvents.emit('close')
  previous = next
})

export function useWindows<T>(select: (state: WindowsState) => T): T {
  return useStore(windowsStore, select)
}

/** Opens a new window for an app. Returns `null` when no such app is installed. */
export function launch(appId: string, args: LaunchArgs = {}): WindowId | null {
  const app = getApp(appId)
  if (!app) return null
  const spec = app.window
  const size = spec.kind === 'resizable' ? { width: spec.width, height: spec.height } : null
  windowsStore.dispatch({ type: 'open', appId, title: app.title, args, size })
  return windowsStore.get().windows.at(-1)?.id ?? null
}

/** The app a node opens with, and the arguments it gets. */
export function opener(node: FsNode): { appId: string; args: LaunchArgs } | null {
  switch (node.kind) {
    case 'program':
      return { appId: node.app, args: {} }
    case 'shortcut': {
      const target = resolveShortcut(fsStore.get(), node)
      if (!target) return null
      return target.kind === 'app' ? { appId: target.app, args: {} } : opener(target.node)
    }
    case 'drive':
    case 'folder':
      return getApp('explorer') ? { appId: 'explorer', args: { folder: node.id } } : null
    case 'file': {
      const app = appForFile(node.name)
      return app ? { appId: app.id, args: { file: node.id } } : null
    }
  }
}

/** Double-click semantics for any file system node. Returns `false` when nothing can open it. */
export function openNode(id: NodeId): boolean {
  const node = fsStore.get().nodes[id]
  const target = node && opener(node)
  const opened = target ? launch(target.appId, target.args) !== null : false
  if (opened && target?.args.file) rememberDocument(target.args.file)
  return opened
}
