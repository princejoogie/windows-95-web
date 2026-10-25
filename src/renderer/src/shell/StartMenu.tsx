import { useMemo } from 'react'
import { children, isInside } from '../fs/fs'
import { useFs } from '../fs/store'
import { type FsState, type NodeId, RECYCLED_DIR } from '../fs/types'
import { icons } from '../icons'
import { pixelArt } from '../icons/pixel'
import { type MenuEntry, MenuList } from '../ui/Menu'
import { isHidden } from '../ui/properties'
import { nodeIcon } from './nodeIcon'
import { useRecentDocuments } from './recent'
import { getApp, smallIcon } from './registry'
import { startMenuFolder } from './startup'
import { openNode } from './system'

const taskbarIcon = pixelArt([
  '................',
  '.kkkkkkkkkkkkkk.',
  '.kwwwwwwwwwwwwk.',
  '.kwBBBBBBBBBBwk.',
  '.kwsssssssssswk.',
  '.kwsssssssssswk.',
  '.kwsssssssssswk.',
  '.kwsssssssssswk.',
  '.kwsssssssssswk.',
  '.kwsssssssssswk.',
  '.kwwwwwwwwwwwwk.',
  '.kskwwkgwwwwkwk.',
  '.kskllkgsssskgk.',
  '.kssssssssssssk.',
  '.kkkkkkkkkkkkkk.',
  '................',
])

export function programsMenu(state: FsState, folder: NodeId): MenuEntry[] {
  const entries = children(state, folder)
    .filter((node) => !isHidden(node))
    .sort((a, b) => Number(b.kind === 'folder') - Number(a.kind === 'folder') || a.name.localeCompare(b.name))
  return entries.length
    ? entries.map((node) => {
        if (node.kind === 'folder')
          return {
            label: node.name === 'StartUp' ? 'Start&Up' : node.name,
            icon: icons.small.folderClosed,
            items: programsMenu(state, node.id),
          }
        const app =
          (node.kind === 'program' || node.kind === 'shortcut') && node.app ? getApp(node.app) : undefined
        return {
          label: node.name,
          icon: app ? smallIcon(app) : nodeIcon(node).icon,
          onSelect: () => openNode(node.id),
        }
      })
    : [{ label: '(Empty)', disabled: true }]
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
          return node?.kind === 'file' && !isInside(state, node.id, RECYCLED_DIR) ? [node] : []
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state, recent],
  )
  const programs = useMemo(() => startMenuFolder(['Start Menu', 'Programs']), [])
  const iconFor = (id: string) => {
    const app = getApp(id)
    return app ? smallIcon(app) : icons.small.program
  }
  const top: MenuEntry[] = [
    {
      label: '&Programs',
      icon: icons.start.programs,
      items: programs ? programsMenu(state, programs) : [{ label: '(Empty)', disabled: true }],
    },
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
        { label: '&Control Panel', icon: iconFor('controlpanel'), onSelect: () => onApp('controlpanel') },
        { label: '&Printers', icon: iconFor('printers'), onSelect: () => onApp('printers') },
        { label: '&Taskbar...', icon: taskbarIcon, onSelect: onProperties },
      ],
    },
    {
      label: '&Find',
      icon: icons.start.find,
      items: [
        { label: '&Files or Folders...', icon: iconFor('find'), onSelect: () => onApp('find') },
        { label: '&Computer...', icon: iconFor('network'), onSelect: () => onApp('findcomputer') },
        {
          label: '&On The Microsoft Network...',
          icon: icons.small.windowsLogo,
          onSelect: () => onApp('msn'),
        },
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
