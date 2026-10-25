import type { FsNode } from '../fs/types'
import { icons } from '../icons'
import type { MenuEntry } from '../ui/Menu'
import { getApp } from './registry'

export type ArrangeBy = 'name' | 'type' | 'size' | 'date'

/** Everything a desktop menu can do. The desktop binds each to the item or spot it was opened on. */
export interface DesktopActions {
  readonly open: () => void
  readonly explore: () => void
  readonly find: () => void
  readonly cut: () => void
  readonly copy: () => void
  readonly paste: () => void
  readonly pasteShortcut: () => void
  readonly createShortcut: () => void
  readonly remove: () => void
  readonly undo: () => void
  readonly rename: () => void
  readonly properties: () => void
  readonly sendToDocuments: () => void
  readonly sendToDesktop: () => void
  readonly emptyRecycleBin: () => void
  readonly arrange: (by: ArrangeBy) => void
  readonly toggleAutoArrange: () => void
  readonly lineUp: () => void
  readonly newFolder: () => void
  readonly newShortcut: () => void
  readonly newTextDocument: () => void
  readonly newBitmapDocument?: () => void
  readonly newWordpadDocument?: () => void
  readonly desktopProperties: () => void
}

export interface MenuFacts {
  readonly canPaste: boolean
  readonly autoArrange: boolean
  readonly binEmpty: boolean
  readonly canFind: boolean
  /** Rename and Properties work on one item at a time. */
  readonly single: boolean
  /** False for C:, WINDOWS, and the other folders Windows won't let you move or delete. */
  readonly mutable: boolean
  readonly hasProperties: boolean
  /** The newest undoable operation's menu label, or null when there is none. */
  readonly undo: string | null
}

type Build = (facts: MenuFacts, act: DesktopActions) => MenuEntry[]

/** The menu on empty desktop. */
export const backgroundMenu: Build = (facts, act) => [
  {
    label: 'Arrange &Icons',
    items: [
      { label: 'by &Name', onSelect: () => act.arrange('name') },
      { label: 'by &Type', onSelect: () => act.arrange('type') },
      { label: 'by Si&ze', onSelect: () => act.arrange('size') },
      { label: 'by &Date', onSelect: () => act.arrange('date') },
      'separator',
      { label: '&Auto Arrange', checked: facts.autoArrange, onSelect: act.toggleAutoArrange },
    ],
  },
  { label: 'Line &up Icons', disabled: facts.autoArrange, onSelect: act.lineUp },
  'separator',
  { label: '&Paste', disabled: !facts.canPaste, onSelect: act.paste },
  { label: 'Paste &Shortcut', disabled: !facts.canPaste, onSelect: act.pasteShortcut },
  { label: facts.undo ?? '&Undo', disabled: !facts.undo, onSelect: act.undo },
  'separator',
  {
    label: 'Ne&w',
    items: [
      { label: '&Folder', icon: icons.small.folderClosed, onSelect: act.newFolder },
      { label: '&Shortcut', onSelect: act.newShortcut },
      'separator',
      { label: 'Text Document', icon: icons.small.textDocument, onSelect: act.newTextDocument },
      ...(act.newBitmapDocument
        ? [
            {
              label: 'Bitmap Image',
              icon: getApp('paint')?.smallIcon ?? icons.small.document,
              onSelect: act.newBitmapDocument,
            },
          ]
        : []),
      ...(act.newWordpadDocument
        ? [
            {
              label: 'WordPad Document',
              icon: getApp('wordpad')?.smallIcon ?? icons.small.document,
              onSelect: act.newWordpadDocument,
            },
          ]
        : []),
    ],
  },
  'separator',
  { label: 'P&roperties', onSelect: act.desktopProperties },
]

const open = (act: DesktopActions): MenuEntry => ({ label: '&Open', bold: true, onSelect: act.open })
const explore = (act: DesktopActions): MenuEntry => ({ label: '&Explore', onSelect: act.explore })
const find = (facts: MenuFacts, act: DesktopActions, label = '&Find...'): MenuEntry => ({
  label,
  disabled: !facts.canFind,
  onSelect: act.find,
})
const mapDrives: MenuEntry[] = [
  { label: 'Map &Network Drive...', disabled: true },
  { label: 'Dis&connect Network Drive...', disabled: true },
]
const properties = (facts: MenuFacts, act: DesktopActions, enabled = facts.hasProperties): MenuEntry => ({
  label: 'P&roperties',
  disabled: !enabled || !facts.single,
  onSelect: act.properties,
})

/** Shell icons each have their own menu, keyed by app id. */
const SHELL_MENUS: Readonly<Record<string, Build>> = {
  mycomputer: (facts, act) => [
    open(act),
    explore(act),
    find(facts, act),
    'separator',
    ...mapDrives,
    'separator',
    { label: 'Create &Shortcut', onSelect: act.createShortcut },
    { label: 'Rena&me', disabled: !facts.single, onSelect: act.rename },
    'separator',
    properties(facts, act),
  ],
  network: (facts, act) => [
    open(act),
    explore(act),
    find(facts, act, 'F&ind Computer...'),
    'separator',
    ...mapDrives,
    'separator',
    { label: 'Create &Shortcut', onSelect: act.createShortcut },
    { label: 'Rena&me', disabled: !facts.single, onSelect: act.rename },
    'separator',
    properties(facts, act),
  ],
  recyclebin: (facts, act) => [
    open(act),
    explore(act),
    { label: 'Empty Recycle &Bin', disabled: facts.binEmpty, onSelect: act.emptyRecycleBin },
    'separator',
    { label: 'Create &Shortcut', onSelect: act.createShortcut },
    'separator',
    properties(facts, act),
  ],
}

const shellDefault: Build = (facts, act) => [
  open(act),
  'separator',
  { label: 'Create &Shortcut', onSelect: act.createShortcut },
  { label: 'Rena&me', disabled: !facts.single, onSelect: act.rename },
]

export function shellMenu(appId: string, facts: MenuFacts, act: DesktopActions): MenuEntry[] {
  return (SHELL_MENUS[appId] ?? shellDefault)(facts, act)
}

/** The menu on a file, folder, program, or shortcut. */
export function nodeMenu(node: FsNode, facts: MenuFacts, act: DesktopActions): MenuEntry[] {
  const folder = node.kind === 'folder' || node.kind === 'drive'
  return [
    open(act),
    ...(folder ? [explore(act), find(facts, act)] : []),
    ...(node.kind === 'file' ? [{ label: '&Print', disabled: true }] : []),
    'separator',
    {
      label: 'Se&nd To',
      items: [
        { label: 'Desktop as Shortcut', onSelect: act.sendToDesktop },
        { label: 'My Documents', onSelect: act.sendToDocuments },
      ],
    },
    'separator',
    { label: 'Cu&t', disabled: !facts.mutable, onSelect: act.cut },
    { label: '&Copy', onSelect: act.copy },
    ...(folder ? [{ label: '&Paste', disabled: !facts.canPaste, onSelect: act.paste }] : []),
    'separator',
    { label: 'Create &Shortcut', onSelect: act.createShortcut },
    { label: '&Delete', disabled: !facts.mutable, onSelect: act.remove },
    { label: 'Rena&me', disabled: !facts.mutable || !facts.single, onSelect: act.rename },
    'separator',
    properties(facts, act),
  ]
}
