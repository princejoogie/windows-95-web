import '../../settings/apply'
import type { AppManifest, AppProps } from '../../shell/types'
import { printerIcon } from '../explorer/art'
import { FolderView } from '../explorer/FolderView'
import { registerShellFolder, type ShellItem } from '../explorer/shellFolders'
import { DateTimeProperties } from './DateTimeProperties'
import { DisplayProperties } from './DisplayProperties'
import './Fonts'
import { appletIcons } from './icons'
import { MouseProperties } from './MouseProperties'
import {
  AccessibilityProperties,
  AddRemovePrograms,
  KeyboardProperties,
  RegionalProperties,
  SystemProperties,
} from './OtherApplets'
import { SoundsProperties } from './SoundsProperties'
import './controlpanel.css'

export { ScreenSaverHost } from '../../settings/ScreenSaverHost'
export { useSettings } from '../../settings/store'
export { DateTimeProperties } from './DateTimeProperties'
export { DisplayProperties } from './DisplayProperties'
export { MouseProperties } from './MouseProperties'

const applets = [
  {
    id: 'accessibility',
    label: 'Accessibility Options',
    icon: appletIcons.accessibility,
    help: 'Changes accessibility options for your system.',
    component: AccessibilityProperties,
  },
  {
    id: 'programs',
    label: 'Add/Remove Programs',
    icon: appletIcons.programs,
    help: 'Sets up programs and creates a startup disk.',
    component: AddRemovePrograms,
  },
  {
    id: 'datetime',
    label: 'Date/Time',
    icon: appletIcons.datetime,
    help: 'Changes the date, time, and time zone.',
    component: DateTimeProperties,
  },
  {
    id: 'display',
    label: 'Display',
    icon: appletIcons.display,
    help: 'Changes settings for your display.',
    component: DisplayProperties,
  },
  {
    id: 'keyboard',
    label: 'Keyboard',
    icon: appletIcons.keyboard,
    help: 'Changes settings for your keyboard.',
    component: KeyboardProperties,
  },
  {
    id: 'mouse',
    label: 'Mouse',
    icon: appletIcons.mouse,
    help: 'Changes settings for your mouse.',
    component: MouseProperties,
  },
  {
    id: 'regional',
    label: 'Regional Settings',
    icon: appletIcons.regional,
    help: 'Changes how numbers, currencies, dates, and times are displayed.',
    component: RegionalProperties,
  },
  {
    id: 'sounds',
    label: 'Sounds',
    icon: appletIcons.sounds,
    help: 'Changes which sounds are played for Windows events.',
    component: SoundsProperties,
  },
  {
    id: 'system',
    label: 'System',
    icon: appletIcons.system,
    help: 'Provides system information and changes advanced settings.',
    component: SystemProperties,
  },
]

function AppletDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const Applet = applets.find((item) => item.id === id)?.component
  return Applet ? <Applet onClose={onClose} /> : null
}

registerShellFolder({
  id: 'controlpanel',
  title: 'Control Panel',
  parent: { kind: 'computer' },
  Dialog: AppletDialog,
  items: (
    [
      ...applets.map((item) => ({
        key: item.id,
        label: item.label,
        icon: item.icon,
        help: item.help,
        action: { kind: 'dialog' as const, id: item.id },
      })),
      {
        key: 'fonts',
        label: 'Fonts',
        icon: appletIcons.fonts,
        help: 'Displays, adds, and removes fonts on your computer.',
        action: { kind: 'folder', id: 'fonts' },
      },
      {
        key: 'printers',
        label: 'Printers',
        icon: printerIcon,
        help: 'Adds, removes, and changes settings for printers.',
        action: { kind: 'app', id: 'printers' },
      },
    ] satisfies ShellItem[]
  ).sort((a, b) => a.label.localeCompare(b.label)),
})

export function ControlPanel({ window }: AppProps) {
  return <FolderView initial={{ kind: 'shell', id: 'controlpanel' }} window={window} />
}

export const app: AppManifest = {
  id: 'controlpanel',
  title: 'Control Panel',
  icon: appletIcons.controlpanel,
  exe: 'CONTROL.EXE',
  window: { kind: 'resizable', width: 546, height: 328, minWidth: 320, minHeight: 240 },
  component: ControlPanel,
}
