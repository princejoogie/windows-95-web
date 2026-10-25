import { describe, expect, it } from 'vitest'
import { fsReducer, pathOf, seed } from '../../fs/fs'
import { DOCUMENTS_DIR, ROOT, WINDOWS_DIR } from '../../fs/types'
import { directory, freeBytes, VOLUME } from './directory'
import { BANNER, execute, newSession, prompt, VERSION } from './interpreter'
import { resolveDosPath, shortNames } from './paths'

const NOW = new Date(1995, 7, 24, 13, 5, 6).getTime()
function machine() {
  let state = seed(
    [
      {
        app: 'notepad',
        title: 'Notepad',
        exe: 'NOTEPAD.EXE',
        installDir: 'C:\\WINDOWS',
        desktopShortcut: false,
      },
      {
        app: 'calculator',
        title: 'Calculator',
        exe: 'CALC.EXE',
        installDir: 'C:\\WINDOWS',
        desktopShortcut: false,
      },
      {
        app: 'dosprompt',
        title: 'MS-DOS Prompt',
        exe: 'COMMAND.COM',
        installDir: 'C:\\WINDOWS',
        desktopShortcut: false,
      },
    ],
    NOW,
  )
  let session = newSession()
  return {
    run(line: string) {
      const result = execute(session, state, line, NOW)
      state = result.actions.reduce(fsReducer, state)
      session = result.session
      return result
    },
    get state() {
      return state
    },
    get session() {
      return session
    },
    node(path: string) {
      return resolveDosPath(state, session.cwd, path)
    },
  }
}

describe('COMMAND.COM', () => {
  it('starts with the Windows 95 banner and C:\\WINDOWS> prompt', () => {
    const dos = machine()
    expect(BANNER.slice(0, 2)).toEqual([
      'Microsoft(R) Windows 95',
      '   (C)Copyright Microsoft Corp 1981-1995.',
    ])
    expect(prompt(dos.session, dos.state, NOW)).toBe('C:\\WINDOWS>')
  })

  it('keeps execution pure and returns filesystem actions to the caller', () => {
    const dos = machine()
    const before = structuredClone(dos.state)
    const a = execute(dos.session, dos.state, 'MD TEST', NOW)
    const b = execute(dos.session, dos.state, 'MD TEST', NOW)
    expect(a).toEqual(b)
    expect(dos.state).toEqual(before)
    expect(resolveDosPath(dos.state, WINDOWS_DIR, 'TEST')).toBeUndefined()
    expect(resolveDosPath(a.actions.reduce(fsReducer, dos.state), WINDOWS_DIR, 'TEST')?.kind).toBe('folder')
  })

  it('creates, enters, writes, reads, deletes, and removes the same virtual files', () => {
    const dos = machine()
    expect(dos.run('MD TEST').output).toEqual([])
    dos.run('CD TEST')
    expect(pathOf(dos.state, dos.session.cwd)).toBe('C:\\WINDOWS\\TEST')
    dos.run('ECHO hi > A.TXT')
    expect(dos.node('A.TXT')).toMatchObject({ kind: 'file', content: 'hi\r\n' })
    expect(dos.run('TYPE A.TXT').output).toEqual(['hi', ''])
    dos.run('DEL A.TXT')
    expect(dos.node('A.TXT')).toBeUndefined()
    expect(Object.keys(dos.state.recycled)).toHaveLength(0)
    dos.run('CD..')
    dos.run('RD TEST')
    expect(dos.node('TEST')).toBeUndefined()
  })

  it('supports CHDIR, drive-relative and absolute paths, quotes, and 8.3 aliases', () => {
    const dos = machine()
    dos.run('CHDIR "C:\\My Documents"')
    expect(dos.session.cwd).toBe(DOCUMENTS_DIR)
    expect(dos.node('C:readme.txt')?.name).toBe('Readme.txt')
    dos.run('CD \\')
    expect(dos.session.cwd).toBe(ROOT)
    dos.run('CD MYDOCU~1')
    expect(dos.session.cwd).toBe(DOCUMENTS_DIR)
    dos.run('C:')
    expect(dos.session.cwd).toBe(DOCUMENTS_DIR)
    expect(dos.run('D:').output).toEqual(['Invalid drive specification'])
    expect(dos.run('CD').output).toEqual(['C:\\My Documents'])
    dos.run('CD C:\\..\\..\\WINDOWS')
    expect(dos.session.cwd).toBe(WINDOWS_DIR)
  })

  it('reserves existing short names and gives long names distinct aliases', () => {
    const dos = machine()
    dos.run('MD LONGFO~1')
    dos.run('MD "Long Folder One"')
    dos.run('MD "Long Folder Two"')
    const aliases = shortNames(dos.state, WINDOWS_DIR)
    expect(new Set(aliases.values()).size).toBe(aliases.size)
    expect(dos.node('LONGFO~1')?.name).toBe('LONGFO~1')
    expect(dos.node('LONGFO~2')?.name).toBe('Long Folder One')
    expect(dos.node('LONGFO~3')?.name).toBe('Long Folder Two')
  })

  it('formats DIR with volume, serial, short and long names, dates, and totals', () => {
    const dos = machine()
    dos.run('ECHO hi > A.TXT')
    const output = dos.run('DIR').output.join('\n')
    expect(output).toContain(VOLUME.join('\n'))
    expect(output).toContain(' Directory of C:\\WINDOWS')
    expect(output).toMatch(/DESKTOP\s+<DIR>\s+08-24-95\s+1:05p Desktop/)
    expect(output).toMatch(/A\s+TXT\s+4\s+08-24-95\s+1:05p A.TXT/)
    expect(output).toMatch(/4 file\(s\)\s+4 bytes/)
    expect(output).toContain(freeBytes(dos.state).toLocaleString('en-US'))
    expect(output).toContain('bytes free')
  })

  it('supports DIR /W /P /S, filename filters, and bad switches', () => {
    const dos = machine()
    const wide = dos.run('dir /w /p')
    expect(wide.paginate).toBe(true)
    expect(wide.output.join('\n')).toContain('[Desktop'.toUpperCase())
    expect(wide.output.join('\n')).not.toContain('<DIR>')
    const recursive = dos.run('DIR C:\\ /S')
    expect(recursive.output.join('\n')).toContain('Directory of C:\\My Documents')
    expect(recursive.output.join('\n')).toContain('Total files listed:')
    expect(dos.run('DIR *.COM').output.join('\n')).toContain('COMMAND')
    expect(dos.run('DIR *.COM').output.join('\n')).not.toContain('NOTEPAD')
    expect(dos.run('DIR /NOPE').output).toEqual(['Invalid switch'])
    expect(dos.run('DIR C:\\missing\\*').output).toEqual(['Invalid directory'])
    expect(directory(dos.state, ROOT, '*.XYZ', false, false)).toContain('File not found')
  })

  it('supports MKDIR and RMDIR and protects nonempty and current directories', () => {
    const dos = machine()
    dos.run('MKDIR TEST')
    dos.run('CD TEST')
    expect(dos.run('RD .').output).toEqual(['Invalid path, not directory, or directory not empty'])
    dos.run('ECHO x > X')
    dos.run('CD..')
    expect(dos.run('RD TEST').output).toEqual(['Invalid path, not directory, or directory not empty'])
    dos.run('ERASE TEST\\X')
    dos.run('RMDIR TEST')
    expect(dos.node('TEST')).toBeUndefined()
    expect(dos.run('MD NUL').output).toEqual(['Invalid filename'])
    expect(dos.run('MD MISSING\\CHILD').output).toEqual(['Invalid directory'])
  })

  it('confirms wildcard deletion, preserves directories, and matches question marks', () => {
    const dos = machine()
    dos.run('MD TEST')
    dos.run('CD TEST')
    dos.run('MD CHILD')
    dos.run('ECHO a > A.TXT')
    dos.run('ECHO b > B.TXT')
    dos.run('ECHO c > C')
    expect(dos.run('DEL *.TXT').session.pending.kind).toBe('delete')
    dos.run('N')
    expect(dos.node('A.TXT')).toBeDefined()
    dos.run('ERASE A.?XT')
    expect(dos.node('A.TXT')).toBeUndefined()
    dos.run('DEL *.*')
    dos.run('Y')
    expect(dos.node('B.TXT')).toBeUndefined()
    expect(dos.node('C')).toBeUndefined()
    expect(dos.node('CHILD')?.kind).toBe('folder')
  })

  it('renames, copies, overwrites, and moves files without losing content', () => {
    const dos = machine()
    dos.run('ECHO text > A.TXT')
    dos.run('REN A.TXT B.TXT')
    expect(dos.node('A.TXT')).toBeUndefined()
    expect(dos.run('COPY B.TXT C.TXT').output).toEqual(['        1 file(s) copied'])
    expect(dos.node('C.TXT')).toMatchObject({ content: 'text\r\n' })
    dos.run('ECHO changed > B.TXT')
    expect(dos.run('COPY B.TXT C.TXT').session.pending.kind).toBe('overwrite')
    dos.run('N')
    expect(dos.node('C.TXT')).toMatchObject({ content: 'text\r\n' })
    dos.run('COPY B.TXT C.TXT')
    dos.run('Y')
    expect(dos.node('C.TXT')).toMatchObject({ content: 'changed\r\n' })
    dos.run('MD TEST')
    dos.run('MOVE C.TXT TEST')
    expect(dos.node('C.TXT')).toBeUndefined()
    expect(dos.node('TEST\\C.TXT')).toMatchObject({ content: 'changed\r\n' })
    dos.run('RENAME TEST TEST2')
    dos.run('MOVE TEST2 TEST3')
    expect(dos.node('TEST3\\C.TXT')).toMatchObject({ content: 'changed\r\n' })
    expect(dos.run('COPY B.TXT B.TXT').output).toEqual(['File cannot be copied onto itself'])
  })

  it('copies multiple files and moves between directories with a new name', () => {
    const dos = machine()
    dos.run('MD TEST')
    dos.run('ECHO a > A.TXT')
    dos.run('ECHO b > B.TXT')
    expect(dos.run('COPY *.TXT TEST').output).toEqual(['        2 file(s) copied'])
    dos.run('MOVE TEST\\A.TXT C.TXT')
    expect(dos.node('TEST\\A.TXT')).toBeUndefined()
    expect(dos.node('C.TXT')).toMatchObject({ content: 'a\r\n' })
    expect(dos.run('MOVE TEST TEST\\CHILD').output).toEqual(['Access denied'])
    dos.run('ECHO newer > A.TXT')
    dos.run('COPY /Y A.TXT TEST\\B.TXT')
    expect(dos.node('TEST\\B.TXT')).toMatchObject({ content: 'newer\r\n' })
  })

  it('paginates MORE and pipes, redirects output, and appends without erasing', () => {
    const dos = machine()
    dos.run('ECHO hello > A.TXT')
    dos.run('ECHO world >> A.TXT')
    expect(dos.run('MORE A.TXT')).toMatchObject({ output: ['hello', 'world', ''], paginate: true })
    expect(dos.run('MORE < A.TXT').paginate).toBe(true)
    expect(dos.run('TYPE A.TXT | MORE').paginate).toBe(true)
    dos.run('DIR > DIR.TXT')
    expect(dos.node('DIR.TXT')).toMatchObject({
      content: expect.stringContaining('Directory of C:\\WINDOWS'),
    })
    expect(dos.run('ECHO "a > b"').output).toEqual(['"a > b"'])
    expect(dos.run('ECHO.Mixed Case').output).toEqual(['Mixed Case'])
    expect(dos.run('ECHO.').output).toEqual([''])
  })

  it('supports CLS VER VOL MEM and exact DOS error texts', () => {
    const dos = machine()
    expect(dos.run('CLS').clear).toBe(true)
    expect(dos.run('VER').output).toContain(VERSION)
    expect(dos.run('VOL C:').output).toEqual(VOLUME)
    expect(dos.run('VOL Z:').output).toEqual(['Invalid drive specification'])
    expect(dos.run('MEM').output.join('\n')).toContain('Conventional')
    expect(dos.run('unknown').output).toEqual(['Bad command or file name'])
    expect(dos.run('TYPE missing').output).toEqual(['File not found'])
    expect(dos.run('DEL missing').output).toEqual(['File not found'])
    expect(dos.run('CD missing').output).toEqual(['Invalid directory'])
    expect(dos.run('CD NOTEPAD.EXE').output).toEqual(['Invalid directory'])
  })

  it('supports DATE and TIME display, input, validation, and session-local clocks', () => {
    const dos = machine()
    expect(dos.run('DATE').session.pending.kind).toBe('date')
    expect(dos.run('02-30-1995').output).toContain('Invalid date')
    dos.run('08-25-95')
    expect(dos.run('DATE').output[0]).toContain('08-25-1995')
    dos.run('')
    expect(dos.run('TIME').session.pending.kind).toBe('time')
    expect(dos.run('25:00').output).toContain('Invalid time')
    dos.run('2:30p')
    expect(dos.run('TIME').output[0]).toContain('14:30:00')
    dos.run('')
    dos.run('DATE 01-01-2000')
    dos.run('TIME 09:12:34')
    expect(dos.run('DATE').output[0]).toContain('01-01-2000')
    expect(machine().session.clockOffset).toBe(0)
  })

  it('supports ECHO SET PATH PROMPT and environment substitution', () => {
    const dos = machine()
    dos.run('ECHO OFF')
    expect(dos.run('ECHO').output).toEqual(['ECHO is off'])
    dos.run('ECHO ON')
    expect(dos.run('ECHO').output).toEqual(['ECHO is on'])
    dos.run('SET GREETING=hello')
    expect(dos.run('ECHO %greeting%').output).toEqual(['hello'])
    expect(dos.run('SET').output).toContain('GREETING=hello')
    dos.run('SET GREETING=')
    expect(dos.session.env.GREETING).toBeUndefined()
    dos.run('PATH C:\\WINDOWS')
    expect(dos.run('PATH').output).toEqual(['PATH=C:\\WINDOWS'])
    dos.run('PROMPT [$p]$g$$')
    expect(prompt(dos.session, dos.state, NOW)).toBe('[C:\\WINDOWS]>$')
    dos.run('PROMPT')
    expect(prompt(dos.session, dos.state, NOW)).toBe('C:\\WINDOWS>')
    dos.run('PATH ;')
    expect(dos.run('PATH').output).toEqual(['No Path'])
    dos.run('CD \\')
    expect(dos.run('notepad').output).toEqual(['Bad command or file name'])
  })

  it('launches installed .EXE and .COM programs with a virtual file argument', () => {
    const dos = machine()
    const readme = dos.node('C:\\MYDOCU~1\\readme.txt')
    expect(readme).toBeDefined()
    expect(dos.run('notepad c:\\mydocu~1\\readme.txt').effects).toEqual([
      { kind: 'launch', app: 'notepad', args: { file: readme?.id } },
    ])
    expect(dos.run('NOTEPAD.EXE "C:\\My Documents\\Readme.txt"').effects).toEqual([
      { kind: 'launch', app: 'notepad', args: { file: readme?.id } },
    ])
    expect(dos.run('C:\\WINDOWS\\CALC.EXE').effects).toEqual([
      { kind: 'launch', app: 'calculator', args: {} },
    ])
    expect(dos.run('command').effects).toEqual([{ kind: 'launch', app: 'dosprompt', args: {} }])
    expect(dos.run('notepad missing.txt').output).toEqual(['File not found'])
  })

  it('copies installed programs and launches the copy from its new path', () => {
    const dos = machine()
    dos.run('COPY NOTEPAD.EXE C:\\NOTE.EXE')
    expect(dos.node('C:\\NOTE.EXE')).toMatchObject({ kind: 'program', app: 'notepad' })
    expect(dos.run('C:\\NOTE.EXE').effects).toEqual([{ kind: 'launch', app: 'notepad', args: {} }])
    dos.run('COPY /Y CALC.EXE C:\\NOTE.EXE')
    expect(dos.run('C:\\NOTE.EXE').effects).toEqual([{ kind: 'launch', app: 'calculator', args: {} }])
    expect(dos.node('NOTEPAD.EXE')).toMatchObject({ kind: 'program', app: 'notepad' })
  })

  it('supports START EDIT HELP /? and EXIT', () => {
    const dos = machine()
    expect(dos.run('START').effects).toEqual([
      { kind: 'launch', app: 'dosprompt', args: { folder: WINDOWS_DIR } },
    ])
    expect(dos.run('START calc').effects).toEqual([{ kind: 'launch', app: 'calculator', args: {} }])
    expect(dos.run('START C:\\').effects).toEqual([{ kind: 'open', id: ROOT }])
    expect(dos.run('EDIT NEW.TXT').effects).toEqual([
      { kind: 'launch', app: 'notepad', args: { file: dos.node('NEW.TXT')?.id } },
    ])
    expect(dos.node('NEW.TXT')).toMatchObject({ kind: 'file', content: '' })
    expect(dos.run('EDIT NEW.TXT').effects[0]).toMatchObject({ kind: 'launch', app: 'notepad' })
    expect(dos.run('EDIT').effects).toEqual([{ kind: 'launch', app: 'notepad', args: {} }])
    expect(dos.run('HELP').output.join('\n')).toContain('DIR')
    expect(dos.run('HELP CHDIR').output.join('\n')).toContain('parent directory')
    expect(dos.run('DIR/?').output.join('\n')).toContain('/P Pauses')
    expect(dos.run('EXIT').effects).toEqual([{ kind: 'exit' }])
  })
})
