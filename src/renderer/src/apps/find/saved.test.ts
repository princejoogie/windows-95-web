import { describe, expect, it } from 'vitest'
import { emptyDrive } from '../../fs/fs'
import { DOCUMENTS_DIR } from '../../fs/types'
import { readSearch } from './saved'
import { defaultCriteria } from './search'

describe('saved searches', () => {
  const state = emptyDrive(0)
  it('restores filters and optionally saved results', () => {
    const criteria = { ...defaultCriteria, name: '*.txt', folder: DOCUMENTS_DIR }
    expect(readSearch(JSON.stringify({ criteria, results: null }), state)).toEqual({
      criteria,
      results: null,
    })
    expect(
      readSearch(JSON.stringify({ criteria, results: [DOCUMENTS_DIR, 'missing'] }), state)?.results,
    ).toEqual([DOCUMENTS_DIR])
  })
  it('rejects malformed searches, missing folders and invalid filters', () => {
    expect(readSearch('{', state)).toBeNull()
    expect(readSearch('{}', state)).toBeNull()
    for (const changes of [
      { folder: 'missing' },
      { recursive: 'yes' },
      { modified: { kind: 'previous', count: -1, unit: 'days' } },
      { size: { kind: 'at-least', kb: -1 } },
    ]) {
      expect(
        readSearch(JSON.stringify({ criteria: { ...defaultCriteria, ...changes }, results: null }), state),
      ).toBeNull()
    }
  })
})
