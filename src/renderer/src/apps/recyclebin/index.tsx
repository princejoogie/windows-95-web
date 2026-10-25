import { children } from '../../fs/fs'
import { fs } from '../../fs/store'
import { RECYCLED_DIR } from '../../fs/types'
import { icons } from '../../icons'
import type { AppManifest, AppProps } from '../../shell/types'
import { FolderView } from '../explorer/FolderView'

function RecycleBin({ window }: AppProps) {
  return <FolderView initial={{ kind: 'recycle' }} window={window} />
}

export const app: AppManifest = {
  id: 'recyclebin',
  title: 'Recycle Bin',
  icon: icons.binEmpty,
  exe: 'RECYCLE.EXE',
  installDir: 'C:\\WINDOWS',
  desktop: {
    order: 1,
    icon: (state) => (children(state, RECYCLED_DIR).length ? icons.binFull : icons.binEmpty),
    onDrop: (ids) => {
      for (const id of ids) fs.recycle(id)
    },
  },
  window: { kind: 'resizable', width: 520, height: 300, minWidth: 240, minHeight: 180 },
  component: RecycleBin,
}
