export const cursors = {
  arrow: 'var(--cursor-default, default)',
  busy: 'var(--cursor-progress, progress)',
  wait: 'var(--cursor-wait, wait)',
  text: 'var(--cursor-text, text)',
  move: 'var(--cursor-move, move)',
  no: 'var(--cursor-not-allowed, not-allowed)',
  help: 'var(--cursor-help, help)',
  ns: 'var(--cursor-ns-resize, ns-resize)',
  ew: 'var(--cursor-ew-resize, ew-resize)',
  nwse: 'var(--cursor-nwse-resize, nwse-resize)',
  nesw: 'var(--cursor-nesw-resize, nesw-resize)',
} as const

export const cursorClassNames = {
  busy: 'system-cursor-busy',
  wait: 'system-cursor-wait',
  move: 'system-cursor-move',
  no: 'system-cursor-no',
  help: 'system-cursor-help',
  ns: 'system-cursor-ns',
  ew: 'system-cursor-ew',
  nwse: 'system-cursor-nwse',
  nesw: 'system-cursor-nesw',
} as const

const activeCursors = new Map<symbol, 'busy' | 'wait'>()

export function beginSystemCursor(cursor: 'busy' | 'wait'): () => void {
  const token = Symbol(cursor)
  const update = () => {
    const values = [...activeCursors.values()]
    const current = values.includes('wait') ? 'wait' : values.at(-1)
    if (current) document.documentElement.dataset.systemCursor = current
    else delete document.documentElement.dataset.systemCursor
  }
  activeCursors.set(token, cursor)
  update()
  return () => {
    activeCursors.delete(token)
    update()
  }
}

export async function withWaitCursor<T>(operation: () => Promise<T>): Promise<T> {
  const done = beginSystemCursor('wait')
  try {
    return await operation()
  } finally {
    done()
  }
}
