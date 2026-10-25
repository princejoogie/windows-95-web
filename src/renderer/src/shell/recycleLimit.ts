import { DRIVE_CAPACITY } from '../fs/fs'
import { fsStore } from '../fs/store'
import { folderOptions } from './folderOptions'

export function connectRecycleLimit(): () => void {
  const enforce = () => {
    const options = folderOptions.get()
    const setting = options.binIndependent ? options.binDrive : options.binGlobal
    fsStore.dispatch({ type: 'limitRecycleBin', bytes: Math.floor((DRIVE_CAPACITY * setting.percent) / 100) })
  }
  enforce()
  const stopFiles = fsStore.subscribe(enforce)
  const stopOptions = folderOptions.subscribe(enforce)
  return () => {
    stopFiles()
    stopOptions()
  }
}
