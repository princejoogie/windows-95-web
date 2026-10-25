import { extension } from '../fs/fs'
import type { ProgramSpec } from '../fs/types'
import { computerSearchApp } from './FindComputer'
import { matchesProgramName, programSpec } from './programs'
import type { AppManifest } from './types'

const modules = import.meta.glob<{ app: AppManifest }>('../apps/*/index.tsx', { eager: true })

export const apps: readonly AppManifest[] = [
  ...Object.values(modules).map((module) => module.app),
  computerSearchApp,
].sort((a, b) => a.title.localeCompare(b.title))

const byId = new Map(apps.map((app) => [app.id, app]))
const helpModules = import.meta.glob<{ help: { readonly id: string } }>('../apps/*/help.ts', { eager: true })
const appHelp = new Map(
  Object.entries(helpModules).map(([path, module]) => [path.split('/').at(-2), module.help.id]),
)
export const helpBookForApp = (appId: string): string | undefined => appHelp.get(appId)

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
