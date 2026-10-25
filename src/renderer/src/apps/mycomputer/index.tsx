import { icons } from '../../icons'
import type { AppManifest, AppProps } from '../../shell/types'
import { SystemProperties } from '../controlpanel/OtherApplets'
import { FolderView } from '../explorer/FolderView'

function MyComputer({ args, window }: AppProps) {
  return (
    <FolderView
      initial={args.folder ? { kind: 'folder', id: args.folder } : { kind: 'computer' }}
      window={window}
      select={args.select}
    />
  )
}

export const app: AppManifest = {
  id: 'mycomputer',
  title: 'My Computer',
  icon: icons.myComputer,
  exe: 'MYCOMP.EXE',
  installDir: 'C:\\WINDOWS',
  desktop: { order: 0, Properties: SystemProperties },
  window: { kind: 'resizable', width: 420, height: 300, minWidth: 240, minHeight: 180 },
  component: MyComputer,
}
