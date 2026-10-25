import { useEffect, useMemo, useState } from 'react'
import { DESKTOP_DIR, type FsState, ROOT } from '../../fs/types'
import { icons } from '../../icons'
import { getApp } from '../../shell/registry'
import type { Point } from '../../shell/types'
import { floppyIcon, printerIcon, smallFolder } from './art'
import type { Location } from './model'
import { expandTo, folderTree, TREE_DESKTOP, type TreeEntry, treeRows } from './tree'

export function treeIcon(entry: Pick<TreeEntry, 'key'>): string {
  switch (entry.key) {
    case TREE_DESKTOP:
      return icons.windowsLogo
    case 'computer':
      return icons.myComputer
    case 'c':
      return icons.small.drive
    case 'floppy':
      return floppyIcon
    case 'network':
      return getApp('network')?.icon ?? icons.myComputer
    case 'recycle':
      return icons.binEmpty
    case 'controlpanel':
      return getApp('controlpanel')?.icon ?? icons.program
    case 'printers':
      return printerIcon
    default:
      return smallFolder
  }
}

export function FolderTree({
  state,
  location,
  onChoose,
  onContext,
}: {
  state: FsState
  location: Location
  onChoose: (entry: TreeEntry) => void
  onContext: (entry: TreeEntry, at: Point) => void
}) {
  const root = useMemo(() => folderTree(state), [state])
  const active =
    location.kind === 'folder' ? (location.id === DESKTOP_DIR ? TREE_DESKTOP : location.id) : location.kind
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set([TREE_DESKTOP, 'computer', ROOT]))
  useEffect(() => setExpanded((old) => expandTo(root, active, old)), [root, active])
  const rows = treeRows(root, expanded)
  const toggle = (key: string) =>
    setExpanded((old) => {
      const next = new Set(old)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  return (
    <div role="tree" aria-label="All Folders" className="explorer-tree bevel-sunken">
      {rows.map((row, index) => (
        <div
          key={row.key}
          role="treeitem"
          aria-level={row.depth + 1}
          aria-expanded={row.children.length ? expanded.has(row.key) : undefined}
          aria-selected={active === row.key}
          tabIndex={active === row.key ? 0 : -1}
          className="explorer-tree-row"
          style={{ paddingLeft: 16 }}
          data-tree-key={row.key}
          data-node-id={row.location?.kind === 'folder' ? row.location.id : undefined}
          onClick={() => onChoose(row)}
          onContextMenu={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onContext(row, { x: event.clientX, y: event.clientY })
          }}
          onDoubleClick={() => row.children.length && toggle(row.key)}
          onKeyDown={(event) => {
            event.stopPropagation()
            const next = (offset: number) => {
              const entry = rows[index + offset]
              if (!entry) return
              onChoose(entry)
              event.currentTarget.parentElement
                ?.querySelectorAll<HTMLElement>('[role="treeitem"]')
                [index + offset]?.focus()
            }
            if (event.key === 'ArrowDown') next(1)
            else if (event.key === 'ArrowUp') next(-1)
            else if (event.key === 'ArrowRight') {
              if (row.children.length && !expanded.has(row.key)) toggle(row.key)
              else if (row.children.length) next(1)
            } else if (event.key === 'ArrowLeft') {
              if (expanded.has(row.key)) toggle(row.key)
              else {
                const parent = rows.slice(0, index).findLast((entry) => entry.depth < row.depth)
                if (parent) {
                  onChoose(parent)
                  event.currentTarget.parentElement
                    ?.querySelectorAll<HTMLElement>('[role="treeitem"]')
                    [rows.indexOf(parent)]?.focus()
                }
              }
            } else if (event.key === 'Enter') onChoose(row)
            else return
            event.preventDefault()
          }}
        >
          {row.lines.map((line, depth) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: each position is a fixed ancestor level with no state
              key={`${row.key}-level-${depth}`}
              className={`explorer-tree-indent ${line ? 'line' : ''}`}
            />
          ))}
          {row.depth > 0 && (
            <span
              style={{ left: row.depth * 16 + 8 }}
              className={`explorer-tree-joint ${row.last ? 'last' : ''}`}
            />
          )}
          {row.children.length > 0 && (
            <button
              type="button"
              className="explorer-tree-expander"
              style={{ left: row.depth * 16 + 4 }}
              aria-label={`${expanded.has(row.key) ? 'Collapse' : 'Expand'} ${row.label}`}
              onClick={(event) => {
                event.stopPropagation()
                toggle(row.key)
              }}
            >
              {expanded.has(row.key) ? '−' : '+'}
            </button>
          )}
          <img src={treeIcon(row)} alt="" draggable={false} />
          <span className={active === row.key ? 'selected' : ''}>{row.label}</span>
        </div>
      ))}
    </div>
  )
}
