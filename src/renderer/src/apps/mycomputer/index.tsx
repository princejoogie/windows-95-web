import { icons } from '../../icons'
import type { AppManifest, AppProps } from '../../shell/types'
import { FolderView } from '../explorer/FolderView'

function MyComputer({ window }: AppProps) {
  return <FolderView initial={{ kind: 'computer' }} window={window} />
}

export const app: AppManifest = {
  id: 'mycomputer',
  title: 'My Computer',
  icon: icons.myComputer,
  exe: 'MYCOMP.EXE',
  installDir: 'C:\\WINDOWS',
  desktop: { order: 0 },
  window: { kind: 'resizable', width: 420, height: 300, minWidth: 240, minHeight: 180 },
  component: MyComputer,
}
