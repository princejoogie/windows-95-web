import type { NodeId } from '../../fs/types'

export interface DocumentState {
  readonly file: NodeId | null
  readonly text: string
  readonly saved: string
  readonly undo: readonly string[]
}

type DocumentAction =
  | { type: 'load'; file: NodeId | null; text: string; stamp?: string }
  | { type: 'edit'; text: string }
  | { type: 'save'; file: NodeId }
  | { type: 'undo' }

export function loadDocument(file: NodeId | null, text: string, stamp?: string): DocumentState {
  const lineBreak = /\r\n|\r|\n/.exec(text)?.[0] ?? '\r\n'
  const loaded =
    file && stamp && /^\.LOG(?:\r\n|\r|\n|$)/.test(text) ? `${text}${lineBreak}${stamp}${lineBreak}` : text
  return { file, text: loaded, saved: text, undo: [] }
}

export function documentReducer(state: DocumentState, action: DocumentAction): DocumentState {
  switch (action.type) {
    case 'load':
      return loadDocument(action.file, action.text, action.stamp)
    case 'edit':
      return action.text === state.text
        ? state
        : { ...state, text: action.text, undo: [...state.undo.slice(-99), state.text] }
    case 'save':
      return { ...state, file: action.file, saved: state.text }
    case 'undo': {
      const text = state.undo.at(-1)
      return text === undefined ? state : { ...state, text, undo: state.undo.slice(0, -1) }
    }
  }
}

export function findText(
  text: string,
  query: string,
  start: number,
  matchCase: boolean,
  direction: 'up' | 'down',
): number | null {
  if (!query) return null
  const source = matchCase ? text : text.toLowerCase()
  const wanted = matchCase ? query : query.toLowerCase()
  const index =
    direction === 'down' ? source.indexOf(wanted, start) : start < 0 ? -1 : source.lastIndexOf(wanted, start)
  return index < 0 ? null : index
}
