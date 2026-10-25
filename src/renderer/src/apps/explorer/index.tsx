import { ROOT } from '../../fs/types'
import { icons } from '../../icons'
import type { AppManifest, AppProps } from '../../shell/types'
import { FolderView } from './FolderView'

function Explorer({ args, window }: AppProps) {
  return <FolderView initial={{ kind: 'folder', id: args.folder ?? ROOT }} window={window} />
}

export const app: AppManifest = {
  id: 'explorer',
  title: 'Windows Explorer',
  icon: icons.folderOpened,
  exe: 'EXPLORER.EXE',
  installDir: 'C:\\WINDOWS',
  startMenu: [],
  window: { kind: 'resizable', width: 420, height: 300, minWidth: 240, minHeight: 180 },
  component: Explorer,
}
