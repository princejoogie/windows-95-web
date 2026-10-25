import { describe, expect, it } from 'vitest'
import { parseCommand } from './runCommand'

describe('Run command lines', () => {
  it('keeps spaces in quoted executable and document paths', () => {
    expect(parseCommand('"C:\\Program Files\\Editor.exe" "C:\\My Documents\\Readme.txt"')).toEqual({
      target: 'C:\\Program Files\\Editor.exe',
      arguments: ['C:\\My Documents\\Readme.txt'],
    })
  })
  it('accepts bare programs and quoted direct documents', () => {
    expect(parseCommand('  notepad  ')).toEqual({ target: 'notepad', arguments: [] })
    expect(parseCommand('"C:\\My Documents\\Readme.txt"')).toEqual({
      target: 'C:\\My Documents\\Readme.txt',
      arguments: [],
    })
  })
  it('rejects empty and unterminated commands', () => {
    expect(parseCommand(' ')).toBeNull()
    expect(parseCommand('notepad "Readme.txt')).toBeNull()
  })
})
