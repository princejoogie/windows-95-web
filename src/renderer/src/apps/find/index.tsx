import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { extension, isInside, pathOf } from '../../fs/fs'
import { useFs } from '../../fs/store'
import { type NodeId, RECYCLED_DIR, ROOT } from '../../fs/types'
import { icons } from '../../icons'
import { useKeyDown } from '../../shell/context'
import { launch, openNode, windowsStore } from '../../shell/system'
import type { AppManifest, AppProps } from '../../shell/types'
import {
  AboutDialog,
  Accel,
  Button,
  Checkbox,
  Dialog,
  MessageBox,
  Radio,
  StatusBar,
  StatusPane,
  TextBox,
} from '../../ui'
import { CommandMenu, Tabs } from '../help/controls'
import '../help/help.css'
import { findIcon } from './icons'
import {
  defaultCriteria,
  resultOf,
  type SearchCriteria,
  type SearchResult,
  searchFiles,
  validateCriteria,
} from './search'
import './find.css'

const tabs = ['Name & Location', 'Date Modified', 'Advanced'] as const
type SearchState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running' | 'complete' | 'stopped'; readonly results: readonly SearchResult[] }
type SortColumn = 'name' | 'folder' | 'bytes' | 'type' | 'modified'
const columns: readonly { key: SortColumn; label: string; width: string }[] = [
  { key: 'name', label: 'Name', width: '28%' },
  { key: 'folder', label: 'In Folder', width: '25%' },
  { key: 'bytes', label: 'Size', width: '10%' },
  { key: 'type', label: 'Type', width: '17%' },
  { key: 'modified', label: 'Modified', width: '20%' },
]

function dateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function Find({ window: appWindow, args }: AppProps) {
  const state = useFs((value) => value)
  const folders = useMemo(
    () =>
      Object.values(state.nodes)
        .filter(
          (node) =>
            (node.kind === 'drive' || node.kind === 'folder') && !isInside(state, node.id, RECYCLED_DIR),
        )
        .sort((a, b) => pathOf(state, a.id).localeCompare(pathOf(state, b.id))),
    [state],
  )
  const [criteria, setCriteria] = useState<SearchCriteria>({
    ...defaultCriteria,
    folder: args.folder ?? ROOT,
  })
  const [tab, setTab] = useState<(typeof tabs)[number]>('Name & Location')
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' })
  const [selected, setSelected] = useState<ReadonlySet<NodeId>>(new Set())
  const [sort, setSort] = useState<{ column: SortColumn; descending: boolean }>({
    column: 'name',
    descending: false,
  })
  const [browse, setBrowse] = useState<NodeId | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [properties, setProperties] = useState<SearchResult | null>(null)
  const [about, setAbout] = useState(false)
  const [details, setDetails] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const collapsedHeight = useRef(238)
  const id = useId()
  const running = search.kind === 'running'
  const fileTypes = useMemo(
    () =>
      [
        ...new Set(
          Object.values(state.nodes).flatMap((node) =>
            node.kind === 'file' && extension(node.name) ? [extension(node.name)] : [],
          ),
        ),
      ].sort(),
    [state],
  )
  const results = useMemo(() => {
    if (search.kind === 'idle') return []
    const value = (result: SearchResult): string | number => {
      switch (sort.column) {
        case 'name':
          return result.node.name
        case 'modified':
          return result.node.modified
        default:
          return result[sort.column]
      }
    }
    return [...search.results].sort((a, b) => {
      const av = value(a)
      const bv = value(b)
      const order =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' })
      return (sort.descending ? -1 : 1) * order
    })
  }, [search, sort])
  const chosen = results.find((result) => selected.has(result.node.id))
  const update = (changes: Partial<SearchCriteria>) =>
    setCriteria((previous) => ({ ...previous, ...changes }))
  const stop = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    setSearch((previous) => (previous.kind === 'running' ? { ...previous, kind: 'stopped' } : previous))
  }
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )
  const resize = (expanded: boolean) => {
    const current = windowsStore.get().windows.find((window) => window.id === appWindow.id)
    if (!current?.size || current.maximized) return
    if (expanded && search.kind === 'idle') collapsedHeight.current = current.size.height
    const height = expanded
      ? Math.max(current.size.height, Math.min(460, innerHeight - current.position.y - 60))
      : collapsedHeight.current
    windowsStore.dispatch({
      type: 'resize',
      id: appWindow.id,
      position: current.position,
      size: { ...current.size, height },
    })
  }
  const start = () => {
    if (running) return
    const error = validateCriteria(criteria)
    if (error) {
      setMessage(error)
      return
    }
    if (!folders.some((folder) => folder.id === criteria.folder)) {
      setMessage('The selected folder is no longer available. Choose another folder.')
      return
    }
    resize(true)
    setSelected(new Set())
    setSearch({ kind: 'running', results: [] })
    const iterator = searchFiles(state, criteria)
    const found: SearchResult[] = []
    const step = () => {
      let finished = false
      for (let count = 0; count < 32; count++) {
        const next = iterator.next()
        if (next.done) {
          finished = true
          break
        }
        if (next.value) found.push(resultOf(state, next.value))
      }
      setSearch({ kind: finished ? 'complete' : 'running', results: [...found] })
      timer.current = finished ? null : setTimeout(step, 16)
    }
    timer.current = setTimeout(step, 16)
  }
  const reset = () => {
    stop()
    resize(false)
    setCriteria(defaultCriteria)
    setSearch({ kind: 'idle' })
    setSelected(new Set())
    setTab('Name & Location')
    requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>('[name=named]')?.focus())
  }
  const open = (result: SearchResult) => {
    if (!openNode(result.node.id))
      setMessage(
        'Windows cannot open this file. It may have been removed, or no program is associated with its type.',
      )
  }
  const copy = () => {
    const paths = results
      .filter((result) => selected.has(result.node.id))
      .map((result) => pathOf(state, result.node.id))
      .join('\r\n')
    void navigator.clipboard.writeText(paths).catch(() => setMessage('The Clipboard is not available.'))
  }
  useKeyDown((event) => {
    if (browse !== null || message || properties || about) return
    const letter = event.key.toLowerCase()
    if (event.key === 'F1') {
      event.preventDefault()
      launch('help', { book: 'find' })
    } else if (event.key === 'F5') {
      event.preventDefault()
      start()
    } else if (event.key === 'Escape' && running) {
      event.preventDefault()
      stop()
    } else if (event.altKey && letter === 'f') {
      event.preventDefault()
      start()
    } else if (event.altKey && letter === 's') {
      event.preventDefault()
      stop()
    } else if (event.altKey && letter === 'w') {
      event.preventDefault()
      reset()
    } else if (event.altKey && (letter === 'n' || letter === 'l')) {
      event.preventDefault()
      setTab('Name & Location')
      requestAnimationFrame(() =>
        root.current
          ?.querySelector<HTMLElement>(letter === 'n' ? '[name=named]' : '[name=location]')
          ?.focus(),
      )
    } else if (event.altKey && letter === 'b') {
      event.preventDefault()
      setBrowse(criteria.folder)
    } else if (event.key === 'F10' || (event.key === 'Alt' && !event.ctrlKey)) {
      event.preventDefault()
      root.current?.querySelector<HTMLButtonElement>('.classic-menu-button')?.focus()
    } else if (event.ctrlKey && letter === 'a' && !(event.target instanceof HTMLInputElement)) {
      event.preventDefault()
      setSelected(new Set(results.map((result) => result.node.id)))
    } else if (event.ctrlKey && letter === 'c' && !(event.target instanceof HTMLInputElement)) {
      event.preventDefault()
      copy()
    }
  })
  return (
    <div ref={root} className="find-app">
      <div role="menubar" className="flex h-[19px] shrink-0">
        <CommandMenu
          label="&File"
          commands={[
            {
              label: '&Open',
              action: () => {
                if (chosen) open(chosen)
              },
              disabled: !chosen,
            },
            {
              label: 'Open Containing &Folder',
              action: () => {
                if (chosen?.node.parent) openNode(chosen.node.parent)
              },
              disabled: !chosen,
            },
            { label: '&Properties', action: () => setProperties(chosen ?? null), disabled: !chosen },
            'separator',
            { label: '&Close', action: appWindow.close },
          ]}
        />
        <CommandMenu
          label="&Edit"
          commands={[
            { label: '&Copy', shortcut: 'Ctrl+C', action: copy, disabled: !chosen },
            {
              label: 'Select &All',
              shortcut: 'Ctrl+A',
              action: () => setSelected(new Set(results.map((result) => result.node.id))),
              disabled: !results.length,
            },
            {
              label: '&Invert Selection',
              action: () =>
                setSelected(
                  new Set(
                    results.filter((result) => !selected.has(result.node.id)).map((result) => result.node.id),
                  ),
                ),
              disabled: !results.length,
            },
          ]}
        />
        <CommandMenu
          label="&View"
          commands={[
            { label: '&List', checked: !details, action: () => setDetails(false) },
            { label: '&Details', checked: details, action: () => setDetails(true) },
            'separator',
            { label: '&Refresh', shortcut: 'F5', action: start, disabled: running },
          ]}
        />
        <CommandMenu
          label="&Options"
          commands={[
            {
              label: '&Case Sensitive',
              checked: criteria.caseSensitive,
              disabled: running,
              action: () => update({ caseSensitive: !criteria.caseSensitive }),
            },
          ]}
        />
        <CommandMenu
          label="&Help"
          commands={[
            { label: '&Help Topics', shortcut: 'F1', action: () => launch('help', { book: 'find' }) },
            'separator',
            { label: '&About Windows', action: () => setAbout(true) },
          ]}
        />
      </div>
      <form
        className="find-controls"
        onSubmit={(event) => {
          event.preventDefault()
          start()
        }}
      >
        <fieldset disabled={running} className="find-criteria">
          <Tabs items={tabs} value={tab} onChange={setTab} />
          <div role="tabpanel" aria-label={tab} className="classic-sheet">
            {tab === 'Name & Location' && (
              <>
                <div className="find-form-row">
                  <label htmlFor={`${id}-named`}>
                    <Accel label="&Named:" />
                  </label>
                  <TextBox
                    id={`${id}-named`}
                    name="named"
                    className="flex-1 min-w-0"
                    value={criteria.name}
                    onChange={(event) => update({ name: event.target.value })}
                  />
                </div>
                <div className="find-form-row">
                  <label htmlFor={`${id}-location`}>
                    <Accel label="&Look in:" />
                  </label>
                  <select
                    id={`${id}-location`}
                    name="location"
                    className="find-select flex-1"
                    value={criteria.folder}
                    onChange={(event) => {
                      const folder = folders.find((node) => node.id === event.target.value)
                      if (folder) update({ folder: folder.id })
                    }}
                  >
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {pathOf(state, folder.id)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-between pl-[78px] gap-2">
                  <Checkbox
                    label={<Accel label="Include &subfolders" />}
                    checked={criteria.recursive}
                    onChange={(event) => update({ recursive: event.target.checked })}
                  />
                  <Button onClick={() => setBrowse(criteria.folder)}>
                    <Accel label="&Browse..." />
                  </Button>
                </div>
              </>
            )}
            {tab === 'Date Modified' && (
              <div className="flex flex-col gap-3">
                <Radio
                  name={`${id}-dates`}
                  label="All files"
                  checked={criteria.modified.kind === 'all'}
                  onChange={() => update({ modified: { kind: 'all' } })}
                />
                <div className="flex items-center gap-2">
                  <Radio
                    name={`${id}-dates`}
                    label="Between"
                    checked={criteria.modified.kind === 'between'}
                    onChange={() =>
                      update({
                        modified: { kind: 'between', from: dateInput(new Date()), to: dateInput(new Date()) },
                      })
                    }
                  />
                  <TextBox
                    aria-label="Starting date"
                    className="w-[110px]"
                    placeholder="yyyy-mm-dd"
                    disabled={criteria.modified.kind !== 'between'}
                    value={criteria.modified.kind === 'between' ? criteria.modified.from : ''}
                    onChange={(event) => {
                      if (criteria.modified.kind === 'between')
                        update({ modified: { ...criteria.modified, from: event.target.value } })
                    }}
                  />
                  <span>and</span>
                  <TextBox
                    aria-label="Ending date"
                    className="w-[110px]"
                    placeholder="yyyy-mm-dd"
                    disabled={criteria.modified.kind !== 'between'}
                    value={criteria.modified.kind === 'between' ? criteria.modified.to : ''}
                    onChange={(event) => {
                      if (criteria.modified.kind === 'between')
                        update({ modified: { ...criteria.modified, to: event.target.value } })
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Radio
                    name={`${id}-dates`}
                    label="During the previous"
                    checked={criteria.modified.kind === 'previous'}
                    onChange={() => update({ modified: { kind: 'previous', count: 1, unit: 'months' } })}
                  />
                  <TextBox
                    aria-label="Previous count"
                    className="w-[45px]"
                    type="number"
                    min="0"
                    max="999"
                    disabled={criteria.modified.kind !== 'previous'}
                    value={
                      criteria.modified.kind === 'previous'
                        ? Number.isNaN(criteria.modified.count)
                          ? ''
                          : criteria.modified.count
                        : 1
                    }
                    onChange={(event) => {
                      if (criteria.modified.kind === 'previous')
                        update({ modified: { ...criteria.modified, count: event.target.valueAsNumber } })
                    }}
                  />
                  <select
                    aria-label="Previous unit"
                    className="find-select w-[85px]"
                    disabled={criteria.modified.kind !== 'previous'}
                    value={criteria.modified.kind === 'previous' ? criteria.modified.unit : 'months'}
                    onChange={(event) => {
                      if (
                        criteria.modified.kind === 'previous' &&
                        (event.target.value === 'days' || event.target.value === 'months')
                      )
                        update({ modified: { ...criteria.modified, unit: event.target.value } })
                    }}
                  >
                    <option value="months">month(s)</option>
                    <option value="days">day(s)</option>
                  </select>
                </div>
              </div>
            )}
            {tab === 'Advanced' && (
              <>
                <div className="find-form-row">
                  <label htmlFor={`${id}-type`}>Of type:</label>
                  <select
                    id={`${id}-type`}
                    className="find-select flex-1"
                    value={criteria.fileType}
                    onChange={(event) => update({ fileType: event.target.value })}
                  >
                    <option value="">All Files and Folders</option>
                    <option value="folder">File Folders</option>
                    <option value="program">Applications</option>
                    <option value="shortcut">Shortcuts</option>
                    {fileTypes.map((type) => (
                      <option key={type} value={`.${type}`}>
                        {type.toUpperCase()} files (*.{type})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="find-form-row">
                  <label htmlFor={`${id}-text`}>Containing text:</label>
                  <TextBox
                    id={`${id}-text`}
                    className="flex-1 min-w-0"
                    value={criteria.containing}
                    onChange={(event) => update({ containing: event.target.value })}
                  />
                </div>
                <div className="find-form-row">
                  <label htmlFor={`${id}-size`}>Size is:</label>
                  <select
                    id={`${id}-size`}
                    className="find-select w-[100px]"
                    value={criteria.size.kind}
                    onChange={(event) => {
                      if (event.target.value === 'any') update({ size: { kind: 'any' } })
                      else if (event.target.value === 'at-least' || event.target.value === 'at-most')
                        update({
                          size: {
                            kind: event.target.value,
                            kb: criteria.size.kind === 'any' ? 0 : criteria.size.kb,
                          },
                        })
                    }}
                  >
                    <option value="any">any size</option>
                    <option value="at-least">at least</option>
                    <option value="at-most">at most</option>
                  </select>
                  <TextBox
                    type="number"
                    min="0"
                    step="any"
                    aria-label="Size in KB"
                    className="w-[65px]"
                    disabled={criteria.size.kind === 'any'}
                    value={
                      criteria.size.kind === 'any'
                        ? 0
                        : Number.isNaN(criteria.size.kb)
                          ? ''
                          : criteria.size.kb
                    }
                    onChange={(event) => {
                      if (criteria.size.kind !== 'any')
                        update({ size: { ...criteria.size, kb: event.target.valueAsNumber } })
                    }}
                  />
                  <span>KB</span>
                </div>
              </>
            )}
          </div>
        </fieldset>
        <div className="find-actions">
          <Button type="submit" isDefault disabled={running}>
            <Accel label="&Find Now" />
          </Button>
          <Button disabled={!running} onClick={stop}>
            <Accel label="&Stop" />
          </Button>
          <Button onClick={reset}>
            <Accel label="Ne&w Search" />
          </Button>
          <div
            role="img"
            className="find-animation"
            data-searching={running}
            aria-label={running ? 'Searching' : 'Find files'}
          >
            <img
              src={findIcon}
              alt=""
              style={{ animationPlayState: appWindow.minimized ? 'paused' : 'running' }}
            />
          </div>
        </div>
      </form>
      {search.kind !== 'idle' && (
        <div className="find-results bevel-sunken">
          <table aria-label="Search results">
            <colgroup>
              {(details ? columns : columns.slice(0, 1)).map((column) => (
                <col key={column.key} style={{ width: details ? column.width : '100%' }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {(details ? columns : columns.slice(0, 1)).map((column) => (
                  <th
                    key={column.key}
                    aria-sort={
                      sort.column === column.key ? (sort.descending ? 'descending' : 'ascending') : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="bevel-raised"
                      onClick={() =>
                        setSort({
                          column: column.key,
                          descending: sort.column === column.key && !sort.descending,
                        })
                      }
                    >
                      {column.label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((result, index) => (
                <tr
                  key={result.node.id}
                  tabIndex={selected.has(result.node.id) || (selected.size === 0 && index === 0) ? 0 : -1}
                  aria-selected={selected.has(result.node.id)}
                  onFocus={() => {
                    if (selected.size === 0) setSelected(new Set([result.node.id]))
                  }}
                  onClick={(event) =>
                    setSelected((previous) => {
                      if (!event.ctrlKey) return new Set([result.node.id])
                      const next = new Set(previous)
                      if (next.has(result.node.id)) next.delete(result.node.id)
                      else next.add(result.node.id)
                      return next
                    })
                  }
                  onDoubleClick={() => open(result)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      open(result)
                    } else if (
                      event.key === 'ArrowDown' ||
                      event.key === 'ArrowUp' ||
                      event.key === 'Home' ||
                      event.key === 'End'
                    ) {
                      event.preventDefault()
                      const next =
                        event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? results.length - 1
                            : Math.max(
                                0,
                                Math.min(results.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)),
                              )
                      const nextResult = results[next]
                      if (nextResult) setSelected(new Set([nextResult.node.id]))
                      event.currentTarget.parentElement
                        ?.querySelectorAll<HTMLTableRowElement>('tr')
                        [next]?.focus()
                    }
                  }}
                >
                  <td>
                    <span className="flex items-center gap-1">
                      <img
                        src={
                          result.node.kind === 'folder'
                            ? icons.small.folderClosed
                            : result.node.kind === 'program'
                              ? icons.program
                              : icons.small.document
                        }
                        alt=""
                      />
                      {result.node.name}
                    </span>
                  </td>
                  {details && (
                    <>
                      <td title={result.folder}>{result.folder}</td>
                      <td>{result.node.kind === 'file' ? `${Math.ceil(result.bytes / 1024)} KB` : ''}</td>
                      <td>{result.type}</td>
                      <td title={new Date(result.node.modified).toLocaleString()}>
                        {new Date(result.node.modified).toLocaleDateString()}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <StatusBar className="mt-auto shrink-0">
        <StatusPane className="flex-1">
          <span role="status">
            {search.kind === 'idle'
              ? 'Ready'
              : `${results.length} file(s) found${running ? '. Searching...' : search.kind === 'stopped' ? '. Search stopped.' : '.'}`}
          </span>
        </StatusPane>
      </StatusBar>
      {browse !== null && (
        <Dialog title="Browse for Folder" onClose={() => setBrowse(null)} className="w-[330px]">
          <p className="p-3">Select the folder to search.</p>
          <select
            size={10}
            aria-label="Folders"
            className="mx-3 bg-white bevel-sunken p-2"
            value={browse}
            onChange={(event) => {
              const folder = folders.find((node) => node.id === event.target.value)
              if (folder) setBrowse(folder.id)
            }}
            onDoubleClick={() => {
              update({ folder: browse })
              setBrowse(null)
            }}
          >
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {pathOf(state, folder.id)}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2 p-3">
            <Button
              isDefault
              onClick={() => {
                update({ folder: browse })
                setBrowse(null)
              }}
            >
              OK
            </Button>
            <Button onClick={() => setBrowse(null)}>Cancel</Button>
          </div>
        </Dialog>
      )}
      {properties && (
        <Dialog
          title={`${properties.node.name} Properties`}
          onClose={() => setProperties(null)}
          className="w-[340px]"
        >
          <div className="p-4 flex flex-col gap-3">
            <p>{properties.node.name}</p>
            <hr />
            <p>Type: {properties.type}</p>
            <p>Location: {properties.folder}</p>
            <p>Size: {properties.bytes.toLocaleString()} bytes</p>
            <p>Modified: {new Date(properties.node.modified).toLocaleString()}</p>
          </div>
          <Button className="m-3 self-end" isDefault onClick={() => setProperties(null)}>
            OK
          </Button>
        </Dialog>
      )}
      {about && (
        <AboutDialog
          app="Windows 95"
          title="About Windows"
          icon={icons.windowsLogo}
          onClose={() => setAbout(false)}
        />
      )}
      {message && (
        <MessageBox
          title="Find: All Files"
          message={message}
          buttons={['OK']}
          onClose={() => setMessage(null)}
        />
      )}
    </div>
  )
}

export const app: AppManifest = {
  id: 'find',
  title: 'Find: All Files',
  icon: findIcon,
  exe: 'FIND.EXE',
  window: { kind: 'resizable', width: 590, height: 238, minWidth: 570, minHeight: 238 },
  component: Find,
}
