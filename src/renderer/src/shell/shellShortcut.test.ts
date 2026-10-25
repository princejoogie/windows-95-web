import { describe, expect, it } from 'vitest'
import { emptyDrive, fsReducer } from '../fs/fs'
import { DESKTOP_DIR, DOCUMENTS_DIR, type NodeId, ROOT } from '../fs/types'
import { planShortcuts, resolveShortcut } from './clipboard'
import { parseShellShortcutAddress, shellShortcutAddress } from './shellShortcut'

describe('special-folder shortcuts', () => {
  it('persists and resolves typed applet, folder, and Entire Network targets', () => {
    const targets = [
      { kind: 'item', folder: 'controlpanel', item: 'display' },
      { kind: 'item', folder: 'network', item: 'entire-network' },
      { kind: 'folder', folder: 'fonts' },
    ] as const
    for (const target of targets) {
      const original = emptyDrive(0)
      const id = 'test-shell-shortcut' as NodeId
      const plan = planShortcuts(
        original,
        [{ kind: 'shell', target, label: 'Test' }],
        DESKTOP_DIR,
        1,
        () => id,
      )
      expect(plan.ok).toBe(true)
      if (!plan.ok) continue
      const created = plan.actions.reduce(fsReducer, original)
      const reloaded = JSON.parse(JSON.stringify(created))
      expect(resolveShortcut(reloaded, reloaded.nodes[id])).toEqual({ kind: 'shell', target })
      expect(reloaded.nodes[id].app).toBe(shellShortcutAddress(target))
    }
  })
  it('preserves ordinary app and file targets and rejects malformed shell addresses', () => {
    const original = emptyDrive(0)
    const id = 'test-normal-shortcut' as NodeId
    for (const target of [
      { kind: 'app', app: 'notepad', label: 'Notepad' },
      { kind: 'node', id: DOCUMENTS_DIR },
    ] as const) {
      const plan = planShortcuts(original, [target], ROOT, 1, () => id)
      if (!plan.ok) throw new Error(plan.message)
      const created = plan.actions.reduce(fsReducer, original)
      const node = created.nodes[id]
      expect(node && resolveShortcut(created, node)).toEqual(
        target.kind === 'app'
          ? { kind: 'app', app: 'notepad' }
          : { kind: 'node', node: created.nodes[DOCUMENTS_DIR] },
      )
    }
    for (const value of [
      'shell:unknown:display',
      'shell:controlpanel:%ZZ',
      'https://example.invalid',
      'shell:network:x:y',
    ])
      expect(parseShellShortcutAddress(value)).toBeNull()
  })
})
