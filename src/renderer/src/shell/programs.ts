import type { ProgramSpec } from '../fs/types'
import type { AppManifest } from './types'

export function matchesProgramName(exe: string, input: string): boolean {
  const wanted = input.trim().toLowerCase()
  return /\.(exe|com)$/.test(wanted)
    ? exe.toLowerCase() === wanted
    : exe.toLowerCase().replace(/\.(exe|com)$/, '') === wanted
}

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
