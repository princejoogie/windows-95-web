import { describe, expect, it } from 'vitest'
import { DOCUMENTS_DIR } from '../../fs/types'
import { type DocumentState, documentReducer, findText, loadDocument } from './document'

describe('Notepad document', () => {
  const empty: DocumentState = { file: null, text: '', saved: '', undo: [] }
  it('appends .LOG time only on load, preserves line breaks, and remains dirty until saved', () => {
    for (const eol of ['\r\n', '\n', '\r']) {
      const source = `.LOG${eol}previous`
      const loaded = loadDocument(DOCUMENTS_DIR, source, '1:05 PM 8/24/95')
      expect(loaded.text).toBe(`${source}${eol}1:05 PM 8/24/95${eol}`)
      expect(loaded.saved).toBe(source)
      expect(documentReducer(loaded, { type: 'save', file: DOCUMENTS_DIR }).saved).toBe(loaded.text)
    }
    expect(loadDocument(DOCUMENTS_DIR, '.LOG more', 'stamp').text).toBe('.LOG more')
    expect(loadDocument(null, '.LOG', 'stamp').text).toBe('.LOG')
  })
  it('tracks changes, undo, and the last saved contents', () => {
    const typed = documentReducer(empty, { type: 'edit', text: 'hello' })
    expect(typed.text).not.toBe(typed.saved)
    const saved = documentReducer(typed, { type: 'save', file: DOCUMENTS_DIR })
    expect(saved.text).toBe(saved.saved)
    const changed = documentReducer(saved, { type: 'edit', text: 'hello again' })
    expect(documentReducer(changed, { type: 'undo' })).toMatchObject({ text: 'hello', saved: 'hello' })
  })
  it('loading a file or creating a document resets undo and the dirty state', () => {
    const typed = documentReducer(empty, { type: 'edit', text: 'draft' })
    expect(documentReducer(typed, { type: 'load', file: null, text: '' })).toEqual(empty)
  })
  it('finds the next occurrence in either direction without wrapping', () => {
    expect(findText('One two ONE', 'one', 1, false, 'down')).toBe(8)
    expect(findText('One two ONE', 'One', 1, true, 'down')).toBeNull()
    expect(findText('One two ONE', 'one', 7, false, 'up')).toBe(0)
    expect(findText('One', 'one', -1, false, 'up')).toBeNull()
  })
})
