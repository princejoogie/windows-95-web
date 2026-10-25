import { describe, expect, it } from 'vitest'
import type { MenuEntry } from './Menu'
import { highlightedHelp } from './menuHelp'

const file: MenuEntry[] = [
  { label: '&New', help: 'Creates a new document.' },
  'separator',
  { label: 'Plain' },
  { label: 'Send To', help: 'Sends the document.', items: [{ label: 'Floppy', help: 'Copies it to A:.' }] },
]

describe('menu help in the status bar', () => {
  it('is null while the menus are closed, so the app keeps its own text', () => {
    expect(highlightedHelp([file], { kind: 'closed' })).toBeNull()
  })
  it('shows the highlighted item, blank for an item without help or no highlight', () => {
    expect(highlightedHelp([file], { kind: 'open', title: 0, path: [0] })).toBe('Creates a new document.')
    expect(highlightedHelp([file], { kind: 'open', title: 0, path: [2] })).toBe('')
    expect(highlightedHelp([file], { kind: 'open', title: 0, path: [-1] })).toBe('')
    expect(highlightedHelp([file], { kind: 'bar-armed', title: 0 })).toBe('')
  })
  it('follows submenus, keeping the parent while nothing inside is highlighted', () => {
    expect(highlightedHelp([file], { kind: 'tracking', title: 0, path: [3, -1] })).toBe('Sends the document.')
    expect(highlightedHelp([file], { kind: 'tracking', title: 0, path: [3, 0] })).toBe('Copies it to A:.')
  })
})
