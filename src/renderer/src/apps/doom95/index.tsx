import type { AppManifest } from '../../shell/types'
import { Doom95 } from './Doom95'
import { icon, smallIcon } from './icons'

export const app: AppManifest = {
  id: 'doom95',
  title: 'Doom 95',
  icon,
  smallIcon,
  exe: 'DOOM95.EXE',
  installDir: 'C:\\DOOM',
  startMenu: ['Doom 95'],
  desktopShortcut: true,
  window: { kind: 'resizable', width: 640, height: 400, minWidth: 320, minHeight: 200 },
  component: Doom95,
}
