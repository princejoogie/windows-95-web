import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { extension, isInside, isProtected, pathOf, uniqueName } from '../../fs/fs'
import { createNode, fs, fsStore, fsTimestamp, newNodeId, useFs } from '../../fs/store'
import { DESKTOP_DIR, DOCUMENTS_DIR, type NodeId, RECYCLED_DIR, ROOT } from '../../fs/types'
import { icons } from '../../icons'
import { formatDateTime, wallClockDate } from '../../settings/clock'
import { getClockDate, useSettings } from '../../settings/store'
import { clipboard, planPaste, planShortcuts } from '../../shell/clipboard'
import { useKeyDown } from '../../shell/context'
import { DeleteConfirmation } from '../../shell/DeleteConfirmation'
import { useNaming } from '../../shell/folderOptions'
import { nodeIcon } from '../../shell/nodeIcon'
import { launch, openNode, windowsStore } from '../../shell/system'
import type { AppManifest, AppProps } from '../../shell/types'
import { remember } from '../../shell/undo'
import {
  AboutDialog,
  Accel,
  Button,
  Checkbox,
  ComboBox,
  ContextMenu,
  Dialog,
  ListBox,
  MenuBar,
  MessageBox,
  PropertiesSheet,
  Radio,
  StatusBar,
  StatusPane,
  Tabs,
  TextBox,
} from '../../ui'
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
import { readSearch } from './saved'

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
  const settings = useSettings()
  const state = useFs((value) => value)
  const [saved] = useState(() => {
    const node = args.file ? fs.get().nodes[args.file] : undefined
    return node?.kind === 'file' ? readSearch(node.content, fs.get()) : null
  })
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
  const [criteria, setCriteria] = useState<SearchCriteria>(
    saved?.criteria ?? {
      ...defaultCriteria,
      folder: args.folder ?? ROOT,
    },
  )
  const [tab, setTab] = useState<(typeof tabs)[number]>('Name & Location')
  const [search, setSearch] = useState<SearchState>(
    saved?.results
      ? {
          kind: 'complete',
          results: saved.results.flatMap((id) => (state.nodes[id] ? [resultOf(state, state.nodes[id])] : [])),
        }
      : { kind: 'idle' },
  )
  const [selected, setSelected] = useState<ReadonlySet<NodeId>>(new Set())
  const [sort, setSort] = useState<{ column: SortColumn; descending: boolean }>({
    column: 'name',
    descending: false,
  })
  const [browse, setBrowse] = useState<NodeId | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [properties, setProperties] = useState<SearchResult | null>(null)
  const [about, setAbout] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [saveResults, setSaveResults] = useState(saved?.results !== null && saved !== null)
  const [context, setContext] = useState<{ x: number; y: number; result: SearchResult } | null>(null)
  const [deleting, setDeleting] = useState<SearchResult | null>(null)
  const [renaming, setRenaming] = useState<SearchResult | null>(null)
  const [renameText, setRenameText] = useState('')
  const [details, setDetails] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const initialFocus = useRef(false)
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
    return search.results
      .flatMap((result) => {
        const node = state.nodes[result.node.id]
        return node && !isInside(state, node.id, RECYCLED_DIR) ? [resultOf(state, node)] : []
      })
      .sort((a, b) => {
        const av = value(a)
        const bv = value(b)
        const order =
          typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' })
        return (sort.descending ? -1 : 1) * order
      })
  }, [search, sort, state])
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
  const resize = useCallback(
    (expanded: boolean) => {
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
    },
    [appWindow.id, search.kind],
  )
  useEffect(() => {
    if (!appWindow.focused || initialFocus.current) return
    initialFocus.current = true
    root.current?.querySelector<HTMLInputElement>('[name=named]')?.focus()
    if (saved) {
      appWindow.setTitle(saved.criteria.name ? `Find: Files named ${saved.criteria.name}` : 'Find: All Files')
      if (saved.results) resize(true)
    }
  }, [appWindow, saved, resize])
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
    appWindow.setTitle(criteria.name ? `Find: Files named ${criteria.name}` : 'Find: All Files')
    setSelected(new Set())
    setSearch({ kind: 'running', results: [] })
    const iterator = searchFiles(state, criteria, getClockDate().getTime())
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
    appWindow.setTitle('Find: All Files')
    requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>('[name=named]')?.focus())
  }
  const open = (result: SearchResult) => {
    if (!openNode(result.node.id))
      setMessage(
        'Windows cannot open this file. It may have been removed, or no program is associated with its type.',
      )
  }
  const copy = () => clipboard.dispatch({ op: 'copy', ids: [...selected] })
  const containingFolder = (result: SearchResult) => {
    if (result.node.parent) launch('mycomputer', { folder: result.node.parent, select: result.node.id })
  }
  const newSearch = () => setConfirmReset(true)
  const shortcut = (result: SearchResult, parent: NodeId) => {
    const plan = planShortcuts(
      fs.get(),
      [{ kind: 'node', id: result.node.id }],
      parent,
      fsTimestamp(),
      newNodeId,
    )
    if (plan.ok) plan.actions.forEach(fsStore.dispatch)
    else setMessage(plan.message)
  }
  const sendToDocuments = (result: SearchResult) => {
    const plan = planPaste(
      fs.get(),
      { op: 'copy', ids: [result.node.id] },
      DOCUMENTS_DIR,
      fsTimestamp(),
      newNodeId,
    )
    if (plan.ok) plan.actions.forEach(fsStore.dispatch)
    else setMessage(plan.message)
  }
  const naming = useNaming()
  const lookIn = [
    { key: DOCUMENTS_DIR, label: 'Document Folders', icon: icons.small.folderClosed },
    { key: 'computer', label: 'My Computer', icon: icons.myComputer },
    { key: 'floppy', label: '3½ Floppy (A:)', icon: icons.drive, indent: 1 },
    { key: ROOT, label: '(C:)', icon: icons.drive, indent: 1 },
    { key: DESKTOP_DIR, label: 'Desktop', icon: icons.small.folderClosed },
    ...folders
      .filter(
        (folder) => ![ROOT, DOCUMENTS_DIR, DESKTOP_DIR].includes(folder.id) && folder.id === criteria.folder,
      )
      .map((folder) => ({ key: folder.id, label: folder.name, icon: icons.small.folderClosed, indent: 2 })),
  ]
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
    } else if (event.altKey && letter === 's') {
      event.preventDefault()
      stop()
    } else if (event.altKey && letter === 'w') {
      event.preventDefault()
      newSearch()
    } else if (event.altKey && (letter === 'n' || letter === 'l')) {
      event.preventDefault()
      setTab('Name & Location')
      requestAnimationFrame(() =>
        root.current
          ?.querySelector<HTMLElement>(letter === 'n' ? '[name=named]' : '[aria-label="Look in"]')
          ?.focus(),
      )
    } else if (event.altKey && letter === 'b') {
      event.preventDefault()
      setBrowse(criteria.folder)
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
      <MenuBar
        menus={[
          {
            label: '&File',
            items: [
              {
                label: '&Open',
                onSelect: () => {
                  if (chosen) open(chosen)
                },
                disabled: !chosen,
              },
              {
                label: 'Open Containing &Folder',
                onSelect: () => {
                  if (chosen) containingFolder(chosen)
                },
                disabled: !chosen,
              },
              { label: '&Properties', onSelect: () => setProperties(chosen ?? null), disabled: !chosen },
              {
                label: '&Save Search',
                onSelect: () => {
                  const saved = createNode(
                    DESKTOP_DIR,
                    uniqueName(fs.get(), DESKTOP_DIR, 'Saved Search.fnd'),
                    {
                      kind: 'file',
                      content: JSON.stringify({
                        criteria,
                        results: saveResults ? results.map((result) => result.node.id) : null,
                      }),
                    },
                  )
                  if ('error' in saved) setMessage(saved.error)
                },
              },
              'separator',
              { label: '&Close', onSelect: appWindow.close },
            ],
          },
          {
            label: '&Edit',
            items: [
              { label: '&Copy', shortcut: 'Ctrl+C', onSelect: copy, disabled: !chosen },
              {
                label: 'Select &All',
                shortcut: 'Ctrl+A',
                onSelect: () => setSelected(new Set(results.map((result) => result.node.id))),
                disabled: !results.length,
              },
              {
                label: '&Invert Selection',
                onSelect: () =>
                  setSelected(
                    new Set(
                      results
                        .filter((result) => !selected.has(result.node.id))
                        .map((result) => result.node.id),
                    ),
                  ),
                disabled: !results.length,
              },
            ],
          },
          {
            label: '&View',
            items: [
              { label: '&List', checked: !details, onSelect: () => setDetails(false) },
              { label: '&Details', checked: details, onSelect: () => setDetails(true) },
              'separator',
              { label: '&Refresh', shortcut: 'F5', onSelect: start, disabled: running },
            ],
          },
          {
            label: '&Options',
            items: [
              { label: '&Save Results', checked: saveResults, onSelect: () => setSaveResults(!saveResults) },
              {
                label: '&Case Sensitive',
                checked: criteria.caseSensitive,
                disabled: running,
                onSelect: () => update({ caseSensitive: !criteria.caseSensitive }),
              },
            ],
          },
          {
            label: '&Help',
            items: [
              { label: '&Help Topics', shortcut: 'F1', onSelect: () => launch('help', { book: 'find' }) },
              'separator',
              { label: '&About Windows 95', onSelect: () => setAbout(true) },
            ],
          },
        ]}
      />
      <form
        className="find-controls"
        onSubmit={(event) => {
          event.preventDefault()
          start()
        }}
      >
        <fieldset disabled={running} className="find-criteria">
          <Tabs tabs={tabs} active={tab} onChange={setTab} pageClassName="h-[160px] px-[12px] py-[13px]">
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
                  <ComboBox
                    id={`${id}-location`}
                    aria-label="Look in"
                    className="flex-1 min-w-0"
                    options={lookIn}
                    value={criteria.folder}
                    onChange={(key) => {
                      if (running) return
                      if (key === 'floppy') {
                        setMessage('A:\\ is not accessible.\n\nThe device is not ready.')
                        return
                      }
                      const folder = folders.find((node) => node.id === (key === 'computer' ? ROOT : key))
                      if (folder) update({ folder: folder.id })
                    }}
                  />
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
                        modified: {
                          kind: 'between',
                          from: dateInput(wallClockDate(settings)),
                          to: dateInput(wallClockDate(settings)),
                        },
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
                  <ComboBox
                    aria-label="Previous unit"
                    className="w-[85px]"
                    options={[
                      { key: 'months', label: 'month(s)' },
                      { key: 'days', label: 'day(s)' },
                    ]}
                    value={criteria.modified.kind === 'previous' ? criteria.modified.unit : 'months'}
                    onChange={(key) => {
                      if (
                        criteria.modified.kind === 'previous' &&
                        !running &&
                        (key === 'days' || key === 'months')
                      )
                        update({ modified: { ...criteria.modified, unit: key } })
                    }}
                  />
                </div>
              </div>
            )}
            {tab === 'Advanced' && (
              <>
                <div className="find-form-row">
                  <label htmlFor={`${id}-type`}>Of type:</label>
                  <ComboBox
                    id={`${id}-type`}
                    aria-label="Of type"
                    className="flex-1 min-w-0"
                    value={criteria.fileType}
                    onChange={(key) => {
                      if (!running) update({ fileType: key })
                    }}
                    options={[
                      { key: '', label: 'All Files and Folders' },
                      { key: 'folder', label: 'File Folders' },
                      { key: 'program', label: 'Applications' },
                      { key: 'shortcut', label: 'Shortcuts' },
                      ...fileTypes.map((type) => ({
                        key: `.${type}`,
                        label: `${type.toUpperCase()} files (*.${type})`,
                      })),
                    ]}
                  />
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
                  <ComboBox
                    id={`${id}-size`}
                    aria-label="Size is"
                    className="w-[100px]"
                    value={criteria.size.kind}
                    onChange={(key) => {
                      if (running) return
                      if (key === 'any') update({ size: { kind: 'any' } })
                      else if (key === 'at-least' || key === 'at-most')
                        update({
                          size: {
                            kind: key,
                            kb: criteria.size.kind === 'any' ? 0 : criteria.size.kb,
                          },
                        })
                    }}
                    options={[
                      { key: 'any', label: 'any size' },
                      { key: 'at-least', label: 'at least' },
                      { key: 'at-most', label: 'at most' },
                    ]}
                  />
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
          </Tabs>
        </fieldset>
        <div className="find-actions">
          <Button type="submit" isDefault disabled={running}>
            <Accel label="&Find Now" />
          </Button>
          <Button disabled={!running} onClick={stop}>
            <Accel label="&Stop" />
          </Button>
          <Button onClick={newSearch}>
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
                  onContextMenu={(event) => {
                    event.preventDefault()
                    setSelected(new Set([result.node.id]))
                    setContext({ x: event.clientX, y: event.clientY, result })
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'F10' && event.shiftKey) {
                      event.preventDefault()
                      const rect = event.currentTarget.getBoundingClientRect()
                      setContext({ x: rect.left + 20, y: rect.bottom, result })
                    } else if (event.key === 'Enter') {
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
                      <img src={nodeIcon(result.node).icon} alt="" />
                      {naming.label(result.node)}
                    </span>
                  </td>
                  {details && (
                    <>
                      <td title={result.folder}>{result.folder}</td>
                      <td>{result.node.kind === 'file' ? `${Math.ceil(result.bytes / 1024)} KB` : ''}</td>
                      <td>{result.type}</td>
                      <td title={formatDateTime(settings, result.node.modified)}>
                        {formatDateTime(settings, result.node.modified)}
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
          <ListBox
            label="Folders"
            className="mx-3 h-[160px]"
            value={browse}
            onChange={setBrowse}
            onPick={(folder) => {
              update({ folder })
              setBrowse(null)
            }}
            items={folders.map((folder) => folder.id)}
            render={(folder) => pathOf(state, folder)}
          />
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
      {properties && <PropertiesSheet id={properties.node.id} onClose={() => setProperties(null)} />}
      {about && (
        <AboutDialog
          app="Windows 95"
          title="About Windows 95"
          icon={icons.windowsLogo}
          onClose={() => setAbout(false)}
        />
      )}
      {confirmReset && (
        <MessageBox
          title="Find: All Files"
          message="This will clear your current search."
          buttons={['OK', 'Cancel']}
          onClose={(answer) => {
            setConfirmReset(false)
            if (answer === 'OK') reset()
          }}
        />
      )}
      {context && (
        <ContextMenu
          at={context}
          onClose={() => setContext(null)}
          items={[
            { label: '&Open', bold: true, onSelect: () => open(context.result) },
            { label: 'Open Containing &Folder', onSelect: () => containingFolder(context.result) },
            'separator',
            {
              label: 'Se&nd To',
              items: [
                { label: 'My &Documents', onSelect: () => sendToDocuments(context.result) },
                {
                  label: '&Desktop (create shortcut)',
                  onSelect: () => shortcut(context.result, DESKTOP_DIR),
                },
              ],
            },
            'separator',
            {
              label: 'Cu&t',
              disabled: isProtected(context.result.node.id),
              onSelect: () => clipboard.dispatch({ op: 'cut', ids: [context.result.node.id] }),
            },
            { label: '&Copy', onSelect: copy },
            'separator',
            {
              label: 'Create &Shortcut',
              onSelect: () => shortcut(context.result, context.result.node.parent ?? DESKTOP_DIR),
            },
            {
              label: '&Delete',
              disabled: isProtected(context.result.node.id),
              onSelect: () => setDeleting(context.result),
            },
            {
              label: '&Rename',
              disabled: isProtected(context.result.node.id),
              onSelect: () => {
                setRenameText(naming.label(context.result.node))
                setRenaming(context.result)
              },
            },
            'separator',
            { label: 'P&roperties', onSelect: () => setProperties(context.result) },
          ]}
        />
      )}
      {deleting && (
        <DeleteConfirmation
          nodes={[deleting.node]}
          permanent={false}
          onAnswer={(yes) => {
            if (yes) {
              const before = fs.get()
              fs.recycle(deleting.node.id)
              remember(before, fs.get(), 'Delete')
            }
            setDeleting(null)
          }}
        />
      )}
      {renaming && (
        <Dialog title="Rename" onClose={() => setRenaming(null)} className="w-[300px]">
          <form
            className="p-3 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              const before = fs.get()
              const error = fs.rename(renaming.node.id, naming.rename(renaming.node, renameText))
              if (error) setMessage(error)
              else {
                remember(before, fs.get(), 'Rename')
                setRenaming(null)
              }
            }}
          >
            <TextBox
              aria-label="New name"
              value={renameText}
              onChange={(event) => setRenameText(event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="submit" isDefault>
                OK
              </Button>
              <Button onClick={() => setRenaming(null)}>Cancel</Button>
            </div>
          </form>
        </Dialog>
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
  fileTypes: ['fnd'],
  window: { kind: 'resizable', width: 590, height: 238, minWidth: 570, minHeight: 238 },
  component: Find,
}
