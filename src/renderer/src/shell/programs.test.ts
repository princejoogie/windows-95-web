import { expect, it } from 'vitest'
import { resolvePath, seed } from '../fs/fs'
import { programSpec } from './programs'

it('installs a program with no installDir in C:\\WINDOWS', () => {
  const spec = programSpec({ id: 'notepad', title: 'Notepad', exe: 'NOTEPAD.EXE' })
  expect(resolvePath(seed([spec], 0), 'C:\\WINDOWS\\NOTEPAD.EXE')).toMatchObject({
    kind: 'program',
    app: 'notepad',
  })
})
