import { useEffect, useMemo, useRef, useState } from 'react'
import { children } from '../fs/fs'
import { useFs } from '../fs/store'
import { DOCUMENTS_DIR } from '../fs/types'
import { icons } from '../icons'
import { type MenuEntry, MenuList } from '../ui/Menu'
import { Accel } from '../ui/text'
import { apps, getApp, smallIcon } from './registry'
import { launch, openNode } from './system'
import type { AppManifest } from './types'

const SUBMENU_DELAY_MS = 300

interface Folder {
  readonly folders: Map<string, Folder>
  readonly apps: AppManifest[]
}

/** Builds Start > Programs from each app's `startMenu` path. Folders sort before programs. */
export function programsMenu(installed: readonly AppManifest[]): MenuEntry[] {
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
      .map(([name, sub]) => ({ label: name, icon: icons.folderClosed, items: entries(sub) })),
    ...folder.apps
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((app) => ({ label: app.title, icon: smallIcon(app), onSelect: () => launch(app.id) })),
  ]
  const list = entries(root)
  return list.length ? list : [{ label: '(Empty)', disabled: true }]
}

interface TopItem {
  readonly label: string
  readonly icon: string
  readonly items?: readonly MenuEntry[]
  readonly onSelect?: () => void
}

interface StartMenuProps {
  onClose: () => void
  onRun: () => void
  onShutDown: () => void
}

export function StartMenu({ onClose, onRun, onShutDown }: StartMenuProps) {
  const [hot, setHot] = useState<number | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const state = useFs((s) => s)
  const files = useMemo(
    () =>
      children(state, DOCUMENTS_DIR)
        .filter((node) => node.kind === 'file')
        .slice(0, 15),
    [state],
  )
  const appEntry = (id: string, label: string): MenuEntry[] => {
    const app = getApp(id)
    return app ? [{ label, icon: smallIcon(app), onSelect: () => launch(id) }] : []
  }

  const settings = appEntry('controlpanel', '&Control Panel')
  const find = appEntry('find', '&Files or Folders...')
  const help = getApp('help')

  const top: (TopItem | 'separator')[] = [
    { label: '&Programs', icon: icons.start.programs, items: programsMenu(apps) },
    {
      label: '&Documents',
      icon: icons.start.documents,
      items: files.length
        ? files.map((node) => ({ label: node.name, icon: icons.document, onSelect: () => openNode(node.id) }))
        : [{ label: '(Empty)', disabled: true }],
    },
    ...(settings.length ? [{ label: '&Settings', icon: icons.start.settings, items: settings }] : []),
    ...(find.length ? [{ label: '&Find', icon: icons.start.find, items: find }] : []),
    ...(help ? [{ label: '&Help', icon: icons.start.help, onSelect: () => launch(help.id) }] : []),
    { label: '&Run...', icon: icons.start.run, onSelect: onRun },
    'separator',
    { label: 'Sh&ut Down...', icon: icons.start.shutDown, onSelect: onShutDown },
  ]

  const hover = (index: number, item: TopItem) => {
    setHot(index)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(item.items ? index : null), SUBMENU_DELAY_MS)
  }

  return (
    <div
      role="menu"
      aria-label="Start menu"
      className="absolute left-[2px] bottom-[26px] z-[9000] flex p-[3px] bg-face bevel-window"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex w-[21px] bg-shadow items-end justify-center pb-[4px] mr-px">
        <span className="[writing-mode:vertical-rl] rotate-180 text-[18px] leading-none tracking-tight">
          <b className="text-face">Windows</b>
          <span className="text-white font-bold">95</span>
        </span>
      </div>
      <div className="flex flex-col w-[150px]">
        {top.map((item, index) => {
          if (item === 'separator') {
            return (
              <div
                key="shutdown-separator"
                className="my-[1px] h-[2px] border-t border-shadow border-b border-b-white"
              />
            )
          }
          const lit = hot === index
          return (
            <div key={item.label} className="relative">
              <button
                type="button"
                role="menuitem"
                aria-haspopup={item.items ? 'menu' : undefined}
                className={`flex w-full text-left outline-none items-center h-[32px] pr-[6px] gap-[8px] pl-[4px] ${lit ? 'bg-select text-white' : ''}`}
                onPointerEnter={() => hover(index, item)}
                onClick={() => {
                  if (item.items) {
                    clearTimeout(timer.current)
                    setOpen(index)
                    return
                  }
                  onClose()
                  item.onSelect?.()
                }}
              >
                <img src={item.icon} alt="" className="size-8" />
                <span className="flex-1">
                  <Accel label={item.label} />
                </span>
                {item.items && (
                  <svg
                    aria-hidden="true"
                    width="4"
                    height="7"
                    viewBox="0 0 4 7"
                    shapeRendering="crispEdges"
                    className="fill-current"
                  >
                    <path d="M0 0h1v1h1v1h1v1h1v1H3v1H2v1H1v1H0z" />
                  </svg>
                )}
              </button>
              {item.items && open === index && (
                <MenuList
                  items={item.items}
                  onClose={onClose}
                  style={{ left: '100%', top: 0 }}
                  className="ml-[-2px]"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
