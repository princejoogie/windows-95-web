import type { ProgramSpec } from '../fs/types'
import type { AppManifest } from './types'

export function programSpec(
  app: Pick<AppManifest, 'id' | 'title' | 'exe' | 'installDir' | 'desktopShortcut'>,
): ProgramSpec {
  return {
    app: app.id,
    title: app.title,
    exe: app.exe,
    installDir: app.installDir ?? 'C:\\WINDOWS',
    desktopShortcut: app.desktopShortcut ?? false,
  }
}
