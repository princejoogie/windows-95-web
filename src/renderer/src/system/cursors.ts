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
