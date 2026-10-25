import { children } from '../../fs/fs'
import { fs } from '../../fs/store'
import { RECYCLED_DIR } from '../../fs/types'
import { icons } from '../../icons'
import { deletesForGood } from '../../shell/folderOptions'
import type { AppManifest, AppProps } from '../../shell/types'
import { FolderView } from '../explorer/FolderView'
import { RecycleBinProperties } from './Properties'

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
    order: 2,
    icon: (state) => (children(state, RECYCLED_DIR).length ? icons.binFull : icons.binEmpty),
    Properties: RecycleBinProperties,
    onDrop: (ids) => {
      const forGood = deletesForGood()
      for (const id of ids) {
        if (forGood) fs.purge(id)
        else fs.recycle(id)
      }
    },
  },
  window: { kind: 'resizable', width: 660, height: 300, minWidth: 300, minHeight: 180 },
  component: RecycleBin,
}
