import { useMemo } from 'react'
import { children } from '../fs/fs'
import { useFs } from '../fs/store'
import { icons } from '../icons'
import { type MenuEntry, MenuList } from '../ui/Menu'
import { useRecentDocuments } from './recent'
import { apps, smallIcon } from './registry'
import { startMenuFolder } from './startup'
import { launch, openNode } from './system'
import type { AppManifest } from './types'

interface Folder {
  readonly folders: Map<string, Folder>
  readonly apps: AppManifest[]
}
export function programsMenu(
  installed: readonly AppManifest[],
  startup: readonly MenuEntry[] = [],
): MenuEntry[] {
  const root: Folder = { folders: new Map(), apps: [] }
  for (const app of installed) {
    if (!app.startMenu) continue
    let folder = root
    for (const name of app.startMenu) {
      let next = folder.folders.get(name)
      if (!next) {
        next = { folders: new Map(), apps: [] }
        folder.folders.set(name, next)
      }
      folder = next
    }
    folder.apps.push(app)
  }
  const entries = (folder: Folder): MenuEntry[] => [
    ...[...folder.folders]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, sub]) => ({ label: name, icon: icons.small.folderClosed, items: entries(sub) })),
    ...folder.apps
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((app) => ({ label: app.title, icon: smallIcon(app), onSelect: () => launch(app.id) })),
  ]
  return [
    ...entries(root),
    {
      label: 'Start&Up',
      icon: icons.small.folderClosed,
      items: startup.length ? startup : [{ label: '(Empty)', disabled: true }],
    },
  ]
}

export function StartMenu({
  onClose,
  onRun,
  onShutDown,
  onApp,
  onProperties,
  small = false,
  style,
}: {
  onClose: () => void
  onRun: () => void
  onShutDown: () => void
  onApp: (id: string) => void
  onProperties: () => void
  small?: boolean
  style?: React.CSSProperties
}) {
  const state = useFs((s) => s)
  const recent = useRecentDocuments()
  const files = useMemo(
    () =>
      recent
        .flatMap((id) => {
          const node = state.nodes[id]
          return node?.kind === 'file' ? [node] : []
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state, recent],
  )
  const startupFolder = useMemo(() => startMenuFolder(), [])
  const startup = startupFolder
    ? children(state, startupFolder).map((node) => ({
        label: node.name,
        icon: icons.small.document,
        onSelect: () => openNode(node.id),
      }))
    : []
  const top: MenuEntry[] = [
    { label: '&Programs', icon: icons.start.programs, items: programsMenu(apps, startup) },
    {
      label: '&Documents',
      icon: icons.start.documents,
      items: files.length
        ? files.map((node) => ({
            label: node.name,
            icon: icons.small.document,
            onSelect: () => openNode(node.id),
          }))
        : [{ label: '(Empty)', disabled: true }],
    },
    {
      label: '&Settings',
      icon: icons.start.settings,
      items: [
        { label: '&Control Panel', onSelect: () => onApp('controlpanel') },
        { label: '&Printers', onSelect: () => onApp('printers') },
        { label: '&Taskbar...', onSelect: onProperties },
      ],
    },
    {
      label: '&Find',
      icon: icons.start.find,
      items: [
        { label: '&Files or Folders...', onSelect: () => onApp('find') },
        { label: '&Computer...', onSelect: () => onApp('findcomputer') },
        { label: '&On The Microsoft Network...', onSelect: () => onApp('msn') },
      ],
    },
    { label: '&Help', icon: icons.start.help, onSelect: () => onApp('help') },
    { label: '&Run...', icon: icons.start.run, onSelect: onRun },
    'separator',
    { label: 'Sh&ut Down...', icon: icons.start.shutDown, onSelect: onShutDown },
  ]
  return (
    <div
      className="absolute z-[9000] flex p-[3px] bg-face bevel-window"
      style={{ left: 2, bottom: 26, ...style }}
    >
      {!small && (
        <div className="flex w-[21px] bg-shadow items-end justify-center pb-[4px] mr-px">
          <span className="[writing-mode:vertical-rl] rotate-180 text-[18px] leading-none tracking-tight">
            <b className="text-face">Windows</b>
            <span className="text-white font-bold">95</span>
          </span>
        </div>
      )}
      <MenuList
        items={top}
        onClose={() => {
          onClose()
          document.querySelector<HTMLButtonElement>('[data-start-button]')?.focus()
        }}
        density={small ? 'start' : 'start-root'}
        label="Start menu"
        className="w-[150px] p-0! shadow-none!"
        style={{ position: 'relative' }}
      />
    </div>
  )
}
