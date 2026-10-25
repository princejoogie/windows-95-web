import {
  children,
  type FsAction,
  findChild,
  fsReducer,
  isInside,
  isProtected,
  pathOf,
  validateName,
} from '../../fs/fs'
import { type FsNode, type FsState, type NodeId, WINDOWS_DIR } from '../../fs/types'
import type { LaunchArgs } from '../../shell/types'
import { directory, VOLUME } from './directory'
import { destination, matches, resolveDosPath, tokens } from './paths'

export const BANNER = ['Microsoft(R) Windows 95', '   (C)Copyright Microsoft Corp 1981-1995.', '']
export const VERSION = 'Windows 95. [Version 4.00.950]'
export type Pending =
  | { kind: 'ready' }
  | { kind: 'date' }
  | { kind: 'time' }
  | { kind: 'delete'; ids: readonly NodeId[] }
  | { kind: 'overwrite'; actions: readonly FsAction[]; output: readonly string[] }

export interface Session {
  readonly cwd: NodeId
  readonly env: Readonly<Record<string, string>>
  readonly echo: boolean
  readonly clockOffset: number
  readonly pending: Pending
}

export type Effect =
  | { kind: 'launch'; app: string; args: LaunchArgs }
  | { kind: 'open'; id: NodeId }
  | { kind: 'exit' }
export interface CommandResult {
  readonly session: Session
  readonly actions: readonly FsAction[]
  readonly effects: readonly Effect[]
  readonly output: readonly string[]
  readonly clear: boolean
  readonly paginate: boolean
}

export const newSession = (cwd: NodeId = WINDOWS_DIR): Session => ({
  cwd,
  env: {
    COMSPEC: 'C:\\WINDOWS\\COMMAND.COM',
    PATH: 'C:\\WINDOWS;C:\\WINDOWS\\COMMAND',
    PROMPT: '$p$g',
    TEMP: 'C:\\WINDOWS\\TEMP',
  },
  echo: true,
  clockOffset: 0,
  pending: { kind: 'ready' },
})

export function prompt(session: Session, state: FsState, now: number): string {
  const clock = new Date(now + session.clockOffset)
  const codes: Readonly<Record<string, string>> = {
    p: pathOf(state, session.cwd),
    g: '>',
    l: '<',
    b: '|',
    q: '=',
    n: 'C',
    d: clock.toLocaleDateString('en-US'),
    t: clock.toLocaleTimeString('en-US', { hour12: false }),
    v: VERSION,
    _: '\n',
    $: '$',
    e: '\x1b',
    h: '\b',
  }
  return (session.env.PROMPT || '$p$g').replace(
    /\$(.)/g,
    (_, code: string) => codes[code.toLowerCase()] ?? '',
  )
}

const HELP: Readonly<Record<string, string>> = {
  CD: 'CD [path]\nCD .. changes to the parent directory. CHDIR is an alias.',
  CLS: 'CLS\nClears the screen.',
  COPY: 'COPY [/Y] source [destination]\nCopies files. Use quotes around names that contain spaces.',
  DATE: 'DATE [mm-dd-yyyy]\nDisplays or sets the date for this MS-DOS session.',
  DEL: 'DEL filename\nDeletes files permanently. * and ? select matching names. ERASE is an alias.',
  DIR: 'DIR [path] [filename] [/P] [/W] [/S]\n/P Pauses after each screen. /W Uses wide format. /S Includes subdirectories.',
  ECHO: 'ECHO [ON | OFF]\nECHO [message]\nECHO. prints a blank line. > writes a file and >> appends.',
  EDIT: 'EDIT [filename]\nOpens a text file in Notepad.',
  EXIT: 'EXIT\nCloses the MS-DOS Prompt window.',
  HELP: 'HELP [command]\nDisplays help for MS-DOS commands.',
  MD: 'MD path\nCreates a directory. MKDIR is an alias.',
  MEM: 'MEM\nDisplays the virtual machine memory configuration.',
  MORE: 'MORE [filename]\nDisplays one screen at a time. Also accepts command | MORE or MORE < file.',
  MOVE: 'MOVE [/Y] source destination\nMoves files or renames a directory.',
  PATH: 'PATH [path;...]\nPATH ; clears the executable search path.',
  PROMPT:
    'PROMPT [text]\n$P Path  $G >  $L <  $B |  $Q =  $N Drive\n$D Date  $T Time  $V Version  $_ New line  $$ Dollar sign',
  RD: 'RD path\nRemoves an empty directory. RMDIR is an alias.',
  REN: 'REN filename newname\nRenames a file or directory. RENAME is an alias.',
  SET: 'SET [variable=[string]]\nDisplays, sets, or removes an environment variable.',
  START: 'START [program] [file]\nStarts a program or opens a file or directory in a new window.',
  TIME: 'TIME hh:mm:ss\nDisplays or sets the time for this MS-DOS session. The argument is optional.',
  TYPE: 'TYPE filename\nDisplays a text file.',
  VER: 'VER\nDisplays the Windows version.',
  VOL: 'VOL [drive]\nDisplays the disk volume label and serial number.',
}
const ALIASES: Readonly<Record<string, string>> = {
  CHDIR: 'CD',
  MKDIR: 'MD',
  RMDIR: 'RD',
  ERASE: 'DEL',
  RENAME: 'REN',
}

function validDosId(id: string): id is NodeId {
  return /^dos:\d+:\d+$/.test(id)
}
function nextId(state: FsState, now: number): NodeId {
  for (let n = 0; ; n++) {
    const candidate = `dos:${Math.max(0, Math.floor(now))}:${n}`
    if (validDosId(candidate) && !state.nodes[candidate]) return candidate
  }
}

function nameError(state: FsState, parent: NodeId, name: string, self?: NodeId): string | null {
  if (
    !name ||
    name === '.' ||
    name === '..' ||
    /[. ]$/.test(name) ||
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i.test(name)
  )
    return 'Invalid filename'
  return validateName(state, parent, name, self) ? 'Duplicate file name or file not found' : null
}

function unquotedIndex(line: string, character: string): number {
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted
    else if (!quoted && line[i] === character) return i
  }
  return -1
}

export function execute(session: Session, filesystem: FsState, input: string, now: number): CommandResult {
  let state = filesystem
  let next = session
  const actions: FsAction[] = []
  const effects: Effect[] = []
  let output: string[] = []
  let clear = false
  let paginate = false
  const result = (): CommandResult => ({ session: next, actions, effects, output, clear, paginate })
  const write = (action: FsAction) => {
    state = fsReducer(state, action)
    actions.push(action)
  }
  const fail = (message: string) => {
    output.push(message)
  }
  const setEnv = (key: string, value: string) => {
    const env = { ...next.env }
    if (value) env[key] = value
    else delete env[key]
    next = { ...next, env }
  }
  const setClock = (kind: 'date' | 'time', value: string): boolean => {
    const clock = new Date(now + next.clockOffset)
    if (kind === 'date') {
      const match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/.exec(value)
      if (!match) return false
      const month = Number(match[1])
      const day = Number(match[2])
      let year = Number(match[3])
      if (year < 100) year += year < 80 ? 2000 : 1900
      const date = new Date(year, month - 1, day, clock.getHours(), clock.getMinutes(), clock.getSeconds())
      if (year < 1980 || year > 2099 || date.getMonth() !== month - 1 || date.getDate() !== day) return false
      next = { ...next, clockOffset: date.getTime() - now }
    } else {
      const match = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,2}))?)?\s*([ap](?:m)?)?$/i.exec(value)
      if (!match) return false
      let hour = Number(match[1])
      const minute = Number(match[2])
      const second = Number(match[3] ?? 0)
      if (match[5]) {
        if (hour < 1 || hour > 12) return false
        hour = (hour % 12) + (match[5].toLowerCase().startsWith('p') ? 12 : 0)
      }
      if (hour > 23 || minute > 59 || second > 59) return false
      clock.setHours(hour, minute, second, Number((match[4] ?? '0').padEnd(2, '0')) * 10)
      next = { ...next, clockOffset: clock.getTime() - now }
    }
    return true
  }

  if (session.pending.kind !== 'ready') {
    const pending = session.pending
    next = { ...next, pending: { kind: 'ready' } }
    const value = input.trim()
    if (pending.kind === 'date' || pending.kind === 'time') {
      if (value && !setClock(pending.kind, value)) {
        fail(`Invalid ${pending.kind}`)
        next = { ...next, pending }
        output.push(pending.kind === 'date' ? 'Enter new date (mm-dd-yy):' : 'Enter new time:')
      }
    } else if (/^y(es)?$/i.test(value)) {
      if (pending.kind === 'delete')
        for (const id of pending.ids) if (!isProtected(id)) write({ type: 'purge', id })
      if (pending.kind === 'overwrite') {
        for (const action of pending.actions) write(action)
        output.push(...pending.output)
      }
    } else if (value && !/^n(o)?$/i.test(value)) {
      next = { ...next, pending }
      output.push('Please answer Y or N.')
    }
    return result()
  }

  let line = input
    .trim()
    .replace(/^@/, '')
    .replace(/%([^%]+)%/g, (_, key: string) => next.env[key.toUpperCase()] ?? '')
  if (!line) return result()
  const pipe = unquotedIndex(line, '|')
  if (pipe >= 0) {
    if (
      line
        .slice(pipe + 1)
        .trim()
        .toUpperCase() !== 'MORE'
    ) {
      fail('Bad command or file name')
      return result()
    }
    paginate = true
    line = line.slice(0, pipe).trimEnd()
  }
  const redirectAt = unquotedIndex(line, '>')
  const redirection =
    redirectAt >= 0
      ? {
          append: line[redirectAt + 1] === '>',
          path: tokens(line.slice(redirectAt + (line[redirectAt + 1] === '>' ? 2 : 1)))[0] ?? '',
        }
      : null
  if (redirection) line = line.slice(0, redirectAt).trimEnd()
  const head = /^("[^"]+"|[^\s/]+)(.*)$/.exec(line)
  let command = (head?.[1] ?? '').replace(/^"|"$/g, '').toUpperCase()
  let tail = (head?.[2] ?? '').trim()
  if (/^CD\.\.?$/.test(command) || command === 'CD\\') {
    tail = command.slice(2)
    command = 'CD'
  }
  if (command.startsWith('ECHO.')) {
    tail = line.slice(5)
    command = 'ECHO.'
  }
  command = ALIASES[command] ?? command
  const args = tokens(tail)
  const path = args[0] ?? ''
  if (args.includes('/?')) {
    output.push(...(HELP[command] ?? 'Bad command or file name').split('\n'))
    return result()
  }
  const createFile = (target: { parent: NodeId; name: string }, content: string): NodeId => {
    const id = nextId(state, now)
    write({
      type: 'create',
      node: { kind: 'file', id, name: target.name, parent: target.parent, content, modified: now },
    })
    return id
  }
  const program = (name: string): FsNode | undefined => {
    const directories = [pathOf(state, next.cwd), ...(next.env.PATH ?? '').split(';').filter(Boolean)]
    const candidates = /[\\/:]/.test(name) ? [name] : directories.map((dir) => `${dir}\\${name}`)
    for (const candidate of candidates)
      for (const suffix of /\.(com|exe)$/i.test(candidate) ? [''] : ['.COM', '.EXE', '']) {
        const node = resolveDosPath(state, next.cwd, candidate + suffix)
        if (node?.kind === 'program') return node
      }
    return undefined
  }
  const launchProgram = (name: string, argument: string): boolean => {
    const node = program(name)
    if (node?.kind !== 'program') return false
    const file = argument ? resolveDosPath(state, next.cwd, argument) : undefined
    if (argument && !file) {
      fail('File not found')
      return true
    }
    effects.push({
      kind: 'launch',
      app: node.app,
      args: file
        ? file.kind === 'folder' || file.kind === 'drive'
          ? { folder: file.id }
          : { file: file.id }
        : {},
    })
    return true
  }

  switch (command) {
    case 'CD': {
      if (!path) {
        output.push(pathOf(state, next.cwd))
        break
      }
      const target = resolveDosPath(state, next.cwd, args.join(' '))
      if (!target || (target.kind !== 'folder' && target.kind !== 'drive')) fail('Invalid directory')
      else next = { ...next, cwd: target.id }
      break
    }
    case 'DIR': {
      const flags = args.filter((arg) => arg.startsWith('/')).map((arg) => arg.toUpperCase())
      if (flags.some((flag) => !['/W', '/P', '/S'].includes(flag))) {
        fail('Invalid switch')
        break
      }
      const search = args.filter((arg) => !arg.startsWith('/')).join(' ') || '.'
      const node = resolveDosPath(state, next.cwd, search)
      const target =
        node && (node.kind === 'folder' || node.kind === 'drive')
          ? { parent: node.id, name: '*.*' }
          : destination(state, next.cwd, search)
      if (!target) fail('Invalid directory')
      else {
        output.push(
          ...directory(state, target.parent, target.name, flags.includes('/W'), flags.includes('/S')),
        )
        paginate ||= flags.includes('/P')
      }
      break
    }
    case 'MD': {
      const target = destination(state, next.cwd, path)
      if (!target) {
        fail('Invalid directory')
        break
      }
      const error = nameError(state, target.parent, target.name)
      if (error) fail(error)
      else
        write({
          type: 'create',
          node: {
            kind: 'folder',
            id: nextId(state, now),
            parent: target.parent,
            name: target.name,
            modified: now,
          },
        })
      break
    }
    case 'RD': {
      const node = resolveDosPath(state, next.cwd, path)
      if (!path || !node || node.kind !== 'folder') fail('Invalid directory')
      else if (children(state, node.id).length || isProtected(node.id) || isInside(state, next.cwd, node.id))
        fail('Invalid path, not directory, or directory not empty')
      else write({ type: 'purge', id: node.id })
      break
    }
    case 'DEL': {
      const found = path
        ? matches(state, next.cwd, path).filter(
            (node) => node.kind === 'file' || node.kind === 'program' || node.kind === 'shortcut',
          )
        : []
      if (!found.length) fail('File not found')
      else if (/\*/.test(path)) {
        next = { ...next, pending: { kind: 'delete', ids: found.map((node) => node.id) } }
        output.push(`${path}, Are you sure (Y/N)?`)
      } else for (const node of found) write({ type: 'purge', id: node.id })
      break
    }
    case 'REN': {
      const node = resolveDosPath(state, next.cwd, path)
      const name = args[1] ?? ''
      if (!node?.parent || !path) fail('File not found')
      else if (isProtected(node.id)) fail('Access denied')
      else {
        const error = nameError(state, node.parent, name, node.id)
        if (error) fail(error)
        else write({ type: 'rename', id: node.id, name, at: now })
      }
      break
    }
    case 'COPY':
    case 'MOVE': {
      const values = args.filter((arg) => !/^\/-?y$/i.test(arg))
      const source = values[0] ?? ''
      const dest = values[1] ?? (command === 'COPY' ? '.' : '')
      const found = source
        ? matches(state, next.cwd, source).filter(
            (node) => command === 'MOVE' || (node.kind !== 'folder' && node.kind !== 'drive'),
          )
        : []
      if (!found.length) {
        fail('File not found')
        break
      }
      if (!dest) {
        fail('Required parameter missing')
        break
      }
      const targetNode = resolveDosPath(state, next.cwd, dest)
      const folder =
        targetNode && (targetNode.kind === 'folder' || targetNode.kind === 'drive') ? targetNode : null
      if (found.length > 1 && !folder) {
        fail('The destination must be a directory')
        break
      }
      const planned: FsAction[] = []
      let overwrite = false
      let error = ''
      let staged = state
      const plan = (action: FsAction) => {
        planned.push(action)
        staged = fsReducer(staged, action)
      }
      for (const node of found) {
        const target = folder ? { parent: folder.id, name: node.name } : destination(staged, next.cwd, dest)
        if (!target) {
          error = 'Invalid directory'
          break
        }
        const existing = findChild(staged, target.parent, target.name)
        if (existing?.id === node.id) {
          error = 'File cannot be copied onto itself'
          break
        }
        if (
          node.kind === 'drive' ||
          (command === 'MOVE' && (isProtected(node.id) || isInside(staged, target.parent, node.id)))
        ) {
          error = 'Access denied'
          break
        }
        const invalid = nameError(staged, target.parent, target.name, existing?.id)
        if (invalid) {
          error = invalid
          break
        }
        if (existing && (existing.kind === 'folder' || existing.kind === 'drive' || node.kind === 'folder')) {
          error = 'Access denied'
          break
        }
        overwrite ||= Boolean(existing)
        if (command === 'COPY') {
          if (existing?.kind === 'file' && node.kind === 'file')
            plan({ type: 'write', id: existing.id, content: node.content, at: now })
          else {
            if (existing) plan({ type: 'purge', id: existing.id })
            plan({
              type: 'create',
              node: {
                ...node,
                id: nextId(staged, now),
                parent: target.parent,
                name: target.name,
                modified: now,
              },
            })
          }
        } else {
          if (existing) plan({ type: 'purge', id: existing.id })
          let movingName = node.name
          if (node.parent !== target.parent) {
            if (node.parent && findChild(staged, target.parent, movingName)) {
              let suffix = 0
              do {
                movingName = `DOSMOVE${suffix++}.TMP`
              } while (
                findChild(staged, target.parent, movingName) ||
                findChild(staged, node.parent, movingName)
              )
              plan({ type: 'rename', id: node.id, name: movingName, at: now })
            }
            plan({ type: 'move', id: node.id, parent: target.parent, at: now })
          }
          if (movingName !== target.name) plan({ type: 'rename', id: node.id, name: target.name, at: now })
        }
      }
      if (error) {
        fail(error)
        break
      }
      const summary = [
        `${String(found.length).padStart(9)} file(s) ${command === 'COPY' ? 'copied' : 'moved'}`,
      ]
      if (overwrite && !args.some((arg) => arg.toUpperCase() === '/Y')) {
        next = { ...next, pending: { kind: 'overwrite', actions: planned, output: summary } }
        output.push(`Overwrite ${dest} (Yes/No)?`)
      } else {
        for (const action of planned) write(action)
        output.push(...summary)
      }
      break
    }
    case 'TYPE':
    case 'MORE': {
      const filePath = command === 'MORE' && path === '<' ? (args[1] ?? '') : path
      const node = resolveDosPath(state, next.cwd, filePath)
      if (!filePath || node?.kind !== 'file') fail('File not found')
      else {
        output.push(...node.content.replace(/\r\n/g, '\n').split('\n'))
        paginate ||= command === 'MORE'
      }
      break
    }
    case 'CLS':
      clear = true
      break
    case 'VER':
      output.push('', VERSION)
      break
    case 'VOL':
      if (path && !/^c:$/i.test(path)) fail('Invalid drive specification')
      else output.push(...VOLUME)
      break
    case 'MEM':
      output.push(
        'Memory Type        Total       Used       Free',
        '----------------  --------   --------   --------',
        'Conventional          640K        64K       576K',
        'Upper                   0K         0K         0K',
        'Reserved              384K       384K         0K',
        'Extended (XMS)     15,360K     3,072K    12,288K',
        '----------------  --------   --------   --------',
        'Total memory       16,384K     3,520K    12,864K',
        '',
        'Largest executable program size       576K (589,824 bytes)',
        'Largest free upper memory block         0K (0 bytes)',
        'MS-DOS is resident in the high memory area.',
      )
      break
    case 'DATE':
    case 'TIME': {
      const kind = command === 'DATE' ? 'date' : 'time'
      if (tail && setClock(kind, tail)) break
      const clock = new Date(now + next.clockOffset)
      if (tail) fail(`Invalid ${kind}`)
      else
        output.push(
          kind === 'date'
            ? `Current date is ${clock.toLocaleDateString('en-US', { weekday: 'short' })} ${String(clock.getMonth() + 1).padStart(2, '0')}-${String(clock.getDate()).padStart(2, '0')}-${clock.getFullYear()}`
            : `Current time is ${clock.toLocaleTimeString('en-US', { hour12: false })}.${String(Math.floor(clock.getMilliseconds() / 10)).padStart(2, '0')}`,
        )
      next = { ...next, pending: { kind } }
      output.push(kind === 'date' ? 'Enter new date (mm-dd-yy):' : 'Enter new time:')
      break
    }
    case 'ECHO.':
      output.push(tail)
      break
    case 'ECHO':
      if (/^(on|off)$/i.test(tail)) next = { ...next, echo: tail.toUpperCase() === 'ON' }
      else output.push(tail || `ECHO is ${next.echo ? 'on' : 'off'}`)
      break
    case 'SET': {
      if (!tail)
        output.push(
          ...Object.entries(next.env)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`),
        )
      else {
        const equals = tail.indexOf('=')
        if (equals < 1) fail('Syntax error')
        else setEnv(tail.slice(0, equals).trim().toUpperCase(), tail.slice(equals + 1))
      }
      break
    }
    case 'PATH':
      if (!tail) output.push(next.env.PATH ? `PATH=${next.env.PATH}` : 'No Path')
      else setEnv('PATH', tail === ';' ? '' : tail.replace(/^=\s*/, ''))
      break
    case 'PROMPT':
      setEnv('PROMPT', tail || '$p$g')
      break
    case 'HELP':
      output.push(
        ...(path
          ? (HELP[ALIASES[path.toUpperCase()] ?? path.toUpperCase()] ??
            'Help not available for this command.')
          : Object.entries(HELP)
              .map(([name, help]) => `${name.padEnd(9)}${help.split('\n')[1] ?? ''}`)
              .join('\n')
        ).split('\n'),
      )
      paginate = true
      break
    case 'EXIT':
      effects.push({ kind: 'exit' })
      break
    case 'START':
      if (!path) effects.push({ kind: 'launch', app: 'dosprompt', args: { folder: next.cwd } })
      else if (!launchProgram(path, args.slice(1).join(' '))) {
        const node = resolveDosPath(state, next.cwd, args.join(' '))
        if (node) effects.push({ kind: 'open', id: node.id })
        else fail('Bad command or file name')
      }
      break
    case 'EDIT': {
      if (!path) {
        effects.push({ kind: 'launch', app: 'notepad', args: {} })
        break
      }
      const node = resolveDosPath(state, next.cwd, path)
      if (node?.kind === 'file') effects.push({ kind: 'launch', app: 'notepad', args: { file: node.id } })
      else if (node) fail('Access denied')
      else {
        const target = destination(state, next.cwd, path)
        if (!target) fail('Invalid directory')
        else {
          const error = nameError(state, target.parent, target.name)
          if (error) fail(error)
          else effects.push({ kind: 'launch', app: 'notepad', args: { file: createFile(target, '') } })
        }
      }
      break
    }
    default:
      if (/^[A-Z]:$/.test(command)) {
        if (command !== 'C:') fail('Invalid drive specification')
      } else if (!launchProgram(command, args.join(' '))) fail('Bad command or file name')
  }
  if (redirection) {
    const target = destination(state, next.cwd, redirection.path)
    if (!target) output = ['Invalid directory']
    else {
      const existing = findChild(state, target.parent, target.name)
      const error = nameError(state, target.parent, target.name, existing?.id)
      if (error) output = [error]
      else if (existing && existing.kind !== 'file') output = ['Access denied']
      else {
        const content =
          (redirection.append && existing?.kind === 'file' ? existing.content : '') +
          (output.length ? `${output.join('\r\n')}\r\n` : '')
        if (existing) write({ type: 'write', id: existing.id, content, at: now })
        else createFile(target, content)
        output = []
        paginate = false
      }
    }
  }
  return result()
}
