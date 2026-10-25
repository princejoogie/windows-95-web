import { RECYCLED_DIR, ROOT } from '../../fs/types'
import { icons } from '../../icons'
import type { AppManifest, AppProps } from '../../shell/types'
import { FolderView } from './FolderView'

function Explorer({ args, window }: AppProps) {
  return (
    <FolderView
      initial={
        args.folder === RECYCLED_DIR ? { kind: 'recycle' } : { kind: 'folder', id: args.folder ?? ROOT }
      }
      window={window}
      exploring
    />
  )
}

export const app: AppManifest = {
  id: 'explorer',
  title: 'Windows Explorer',
  icon: icons.folderOpened,
  exe: 'EXPLORER.EXE',
  installDir: 'C:\\WINDOWS',
  startMenu: [],
  window: { kind: 'resizable', width: 680, height: 350, minWidth: 400, minHeight: 220 },
  component: Explorer,
}
