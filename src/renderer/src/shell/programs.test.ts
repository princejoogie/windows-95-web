import { expect, it } from 'vitest'
import { resolvePath, seed } from '../fs/fs'
import { matchesProgramName, programSpec } from './programs'

it('resolves COM and EXE names without confusing explicit extensions', () => {
  expect(matchesProgramName('COMMAND.COM', 'command')).toBe(true)
  expect(matchesProgramName('COMMAND.COM', 'command.com')).toBe(true)
  expect(matchesProgramName('COMMAND.COM', 'command.exe')).toBe(false)
  expect(matchesProgramName('NOTEPAD.EXE', 'notepad')).toBe(true)
})

it('installs a program with no installDir in C:\\WINDOWS', () => {
  const spec = programSpec({ id: 'notepad', title: 'Notepad', exe: 'NOTEPAD.EXE' })
  expect(resolvePath(seed([spec], 0), 'C:\\WINDOWS\\NOTEPAD.EXE')).toMatchObject({
    kind: 'program',
    app: 'notepad',
  })
})
