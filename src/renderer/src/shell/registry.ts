import { extension } from '../fs/fs'
import type { ProgramSpec } from '../fs/types'
import { matchesProgramName, programSpec } from './programs'
import type { AppManifest } from './types'

const modules = import.meta.glob<{ app: AppManifest }>('../apps/*/index.tsx', { eager: true })

export const apps: readonly AppManifest[] = Object.values(modules)
  .map((module) => module.app)
  .sort((a, b) => a.title.localeCompare(b.title))

const byId = new Map(apps.map((app) => [app.id, app]))

export const getApp = (id: string): AppManifest | undefined => byId.get(id)

export const smallIcon = (app: AppManifest): string => app.smallIcon ?? app.icon

export const programSpecs: readonly ProgramSpec[] = apps.map(programSpec)

/** `calc`, `CALC.EXE`, and `calc.exe` all find Calculator. */
export function findAppByExe(name: string): AppManifest | undefined {
  return apps.find((app) => matchesProgramName(app.exe, name))
}

export function appForFile(name: string): AppManifest | undefined {
  const ext = extension(name)
  return ext ? apps.find((app) => app.fileTypes?.includes(ext)) : undefined
}
