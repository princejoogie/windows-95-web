import { extension } from '../fs/fs'
import type { ProgramSpec } from '../fs/types'
import type { AppManifest } from './types'

const modules = import.meta.glob<{ app: AppManifest }>('../apps/*/index.tsx', { eager: true })

export const apps: readonly AppManifest[] = Object.values(modules)
  .map((module) => module.app)
  .sort((a, b) => a.title.localeCompare(b.title))

const byId = new Map(apps.map((app) => [app.id, app]))

export const getApp = (id: string): AppManifest | undefined => byId.get(id)

export const smallIcon = (app: AppManifest): string => app.smallIcon ?? app.icon

export const programSpecs: readonly ProgramSpec[] = apps.map((app) => ({
  app: app.id,
  title: app.title,
  exe: app.exe,
  installDir: app.installDir ?? 'C:WINDOWS',
  desktopShortcut: app.desktopShortcut ?? false,
}))

/** `calc`, `CALC.EXE`, and `calc.exe` all find Calculator. */
export function findAppByExe(name: string): AppManifest | undefined {
  const wanted = name
    .trim()
    .toLowerCase()
    .replace(/\.exe$/, '')
  return apps.find((app) => app.exe.toLowerCase().replace(/\.exe$/, '') === wanted)
}

export function appForFile(name: string): AppManifest | undefined {
  const ext = extension(name)
  return ext ? apps.find((app) => app.fileTypes?.includes(ext)) : undefined
}
