import { type KeyboardEvent, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { extension, uniqueName } from '../fs/fs'
import { createNode, fs, useFs } from '../fs/store'
import { DOCUMENTS_DIR, type FsNode, type NodeId } from '../fs/types'
import { icons } from '../icons'
import { typeAhead } from '../shell/desktopModel'
import { Button } from './Button'
import { ComboBox, type ComboOption } from './ComboBox'
import { Dialog } from './Dialog'
import { TextBox } from './fields'
import {
  chooseFile,
  DOCUMENTS,
  type FileDialogResult,
  type FileTypeFilter,
  type Pickable,
} from './fileChoice'
import { toolbarGlyphs } from './fileDialogArt'
import {
  folderOf,
  type ListEntry,
  listEntries,
  lookInRows,
  type Place,
  type PlaceRow,
  parentPlace,
  placeKey,
  placeOf,
} from './fileDialogModel'
import { MessageBox } from './MessageBox'
import { bytesOf, formatShortDate, typeName } from './properties'
import { Accel } from './text'
import { useWhatsThis } from './WhatsThis'

export type { FileDialogResult, FileTypeFilter, Pickable } from './fileChoice'

const ALL_FILES: FileTypeFilter = { label: 'All Files (*.*)', extensions: ['*'] }
const ROW = 16
const TYPE_AHEAD_MS = 1000

type View = 'list' | 'details'

export interface FileDialogProps {
  readonly mode: 'open' | 'save'
  readonly title?: string
  readonly initialFolder?: NodeId
  readonly initialName?: string
  readonly filters?: readonly FileTypeFilter[]
  /** Index into `filters` of the type selected when the dialog opens. */
  readonly initialFilter?: number
  readonly defaultExtension?: string
  /** Node kinds the list shows and the dialog returns. Run's Browse adds installed programs. */
  readonly pickable?: readonly Pickable[]
  readonly onSelect: (result: FileDialogResult, filter: FileTypeFilter) => void
  readonly onCancel: () => void
}

function nodeSmallIcon(node: FsNode, open = false): string {
  switch (node.kind) {
    case 'drive':
      return icons.small.drive
    case 'folder':
      return open ? icons.small.folderOpened : icons.small.folderClosed
    case 'file':
      return extension(node.name) === 'txt' ? icons.small.textDocument : icons.small.document
    default:
      return icons.small.program
  }
}

function rowIcon(row: PlaceRow, nodes: Readonly<Record<NodeId, FsNode>>): string {
  if (row.kind === 'desktop') return toolbarGlyphs.desktop
  if (row.kind === 'computer') return icons.small.myComputer
  const node = row.place.kind === 'folder' ? nodes[row.place.id] : undefined
  return node ? nodeSmallIcon(node, row.kind === 'folder') : icons.small.folderClosed
}

function entryIcon(entry: ListEntry): string {
  if (entry.node) return nodeSmallIcon(entry.node)
  return entry.kind === 'place' && entry.place.kind === 'computer'
    ? icons.small.myComputer
    : icons.small.folderClosed
}

/** Windows rounds sizes in Details up to whole kilobytes. */
const sizeCell = (bytes: number) => `${Math.max(1, Math.ceil(bytes / 1024))}KB`

/** The What's This text for each control. Reconstructed wording, in the style of Windows 95's common dialog help. */
const HELP = {
  open: {
    lookIn:
      'Shows the location of the current folder. To see how it fits in the hierarchy on your computer, click the arrow. To see the contents of another folder, click it in the list.',
    list: 'Lists the folders and files in the current folder. To open a folder, double-click it. To open a file, click it, and then click Open.',
    name: 'Type or select the name of the file you want to open.',
    type: 'Lists the types of files to display.',
    ok: 'Opens the selected file.',
  },
  save: {
    lookIn:
      'Shows the location where the file will be saved. To see how it fits in the hierarchy on your computer, click the arrow. To save in another folder, click it in the list.',
    list: 'Lists the folders and files in the current folder. To save in a folder, double-click it. To replace a file, click it, and then click Save.',
    name: 'Type a name for the file. You can use long filenames.',
    type: 'Lists the formats you can save this file in.',
    ok: 'Saves the file with the name you typed, in the folder shown in the Save in box.',
  },
} as const

const TOOL_HELP = {
  up: 'Moves up one level in the folder hierarchy.',
  newFolder: 'Creates a new folder in the current folder.',
  list: 'Displays the items in this folder as a list of names.',
  details: 'Displays the name, size, type, and modification date of each item in this folder.',
  cancel: 'Closes this dialog box without saving any changes you have made.',
} as const

function ToolButton({
  glyph,
  label,
  help,
  pressed,
  disabled,
  onClick,
}: {
  glyph: string
  label: string
  help: string
  pressed?: boolean | undefined
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      data-help={help}
      className="min-w-0! w-[23px]! h-[22px]! px-0! grid place-items-center"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      pressed={pressed ?? false}
      disabled={disabled}
      tabIndex={-1}
      onClick={onClick}
    >
      <img src={glyph} alt="" className={disabled ? 'opacity-40' : ''} />
    </Button>
  )
}

/** The Windows 95 Open and Save As dialog. */
export function FileDialog({
  mode,
  title = mode === 'open' ? 'Open' : 'Save As',
  initialFolder = DOCUMENTS_DIR,
  initialName = '',
  filters = [ALL_FILES],
  initialFilter = 0,
  defaultExtension = '',
  pickable = DOCUMENTS,
  onSelect,
  onCancel,
}: FileDialogProps) {
  const state = useFs((s) => s)
  const [place, setPlace] = useState<Place>(() => placeOf(initialFolder))
  const [name, setName] = useState(initialName)
  const [filterIndex, setFilterIndex] = useState(initialFilter)
  const [cursor, setCursor] = useState<string | null>(null)
  const [listFocused, setListFocused] = useState(false)
  const [view, setView] = useState<View>('list')
  const [renaming, setRenaming] = useState<NodeId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [overwrite, setOverwrite] = useState<Extract<FileDialogResult, { kind: 'existing' }> | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const id = useId()
  const filter = filters[filterIndex] ?? filters[0] ?? ALL_FILES
  const entries = useMemo(() => listEntries(state, place, filter, pickable), [state, place, filter, pickable])
  const rows = useMemo(() => lookInRows(state, place), [state, place])
  const lookIn: ComboOption[] = rows.map((row) => ({
    key: row.key,
    label: row.label,
    indent: row.indent,
    icon: rowIcon(row, state.nodes),
  }))
  const parent = parentPlace(state, place)
  const whatsThis = useWhatsThis()
  const help = HELP[mode]
  const at = entries.findIndex((entry) => entry.key === cursor)
  const current = entries[at]

  useLayoutEffect(() => {
    if (cursor)
      listRef.current
        ?.querySelector(`[data-entry="${CSS.escape(cursor)}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [cursor])

  const enter = (next: Place) => {
    setPlace(next)
    setCursor(null)
    setRenaming(null)
  }

  const submit = (input = name) => {
    const choice = chooseFile(fs.get(), folderOf(place), input, mode, defaultExtension, pickable)
    switch (choice.kind) {
      case 'folder':
        enter(placeOf(choice.id))
        setName('')
        break
      case 'error':
        setError(choice.message)
        break
      case 'existing':
        if (mode === 'save') setOverwrite(choice)
        else onSelect(choice, filter)
        break
      case 'new':
        onSelect(choice, filter)
        break
    }
  }

  const activate = (entry: ListEntry) => {
    if (entry.kind === 'place') enter(entry.place)
    else submit(entry.label)
  }

  const choose = (entry: ListEntry | undefined) => {
    if (!entry) return
    setCursor(entry.key)
    if (entry.kind === 'file') setName(entry.label)
  }

  const newFolder = () => {
    if (place.kind === 'computer') return
    const folder = folderOf(place)
    const result = createNode(folder, uniqueName(fs.get(), folder, 'New Folder'), { kind: 'folder' })
    if (!('id' in result)) return
    setCursor(result.id)
    setRenaming(result.id)
  }

  const finishRename = (node: FsNode, value: string | null) => {
    setRenaming(null)
    listRef.current?.focus()
    if (value === null || value === node.name) return
    const problem = fs.rename(node.id, value)
    if (problem) setError(problem)
  }

  /** Rows per column in List view, so Left and Right jump a whole column. */
  const perColumn = () => Math.max(1, Math.floor(((listRef.current?.clientHeight ?? ROW) - 4) / ROW))

  const onListKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (renaming) return
    const step: Partial<Record<string, number>> = {
      ArrowDown: 1,
      ArrowUp: -1,
      ArrowRight: view === 'list' ? perColumn() : 0,
      ArrowLeft: view === 'list' ? -perColumn() : 0,
    }
    const delta = step[event.key]
    if (delta !== undefined) {
      event.preventDefault()
      if (!delta) return
      const from = at < 0 ? (delta > 0 ? -1 : entries.length) : at
      choose(entries[Math.max(0, Math.min(from + delta, entries.length - 1))])
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      choose(event.key === 'Home' ? entries[0] : entries.at(-1))
      return
    }
    if (event.key === 'Enter' && current) {
      event.preventDefault()
      activate(current)
      return
    }
    if (event.key === 'Backspace') {
      event.preventDefault()
      if (parent) enter(parent)
      return
    }
    if (event.key === 'F2' && current?.node && current.node.kind !== 'drive') {
      event.preventDefault()
      setRenaming(current.node.id)
      return
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && event.key !== ' ') {
      const now = Date.now()
      const text = now - typed.current.at > TYPE_AHEAD_MS ? event.key : typed.current.text + event.key
      typed.current = { text, at: now }
      const next = typeAhead(entries, cursor, text)
      choose(entries.find((entry) => entry.key === next))
    }
  }

  const label = (entry: ListEntry) => {
    const lit = entry.key === cursor
    if (renaming && entry.node?.id === renaming) {
      const node = entry.node
      return (
        <input
          // biome-ignore lint/a11y/noAutofocus: a new folder starts in rename, as Windows does
          autoFocus
          defaultValue={node.name}
          className="h-[16px] px-[1px] bg-white border border-black outline-none select-text"
          onFocus={(event) => event.target.select()}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter') {
              event.preventDefault()
              finishRename(node, event.currentTarget.value)
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              event.nativeEvent.stopImmediatePropagation()
              finishRename(node, null)
            }
          }}
          onBlur={(event) => finishRename(node, event.currentTarget.value)}
        />
      )
    }
    return (
      <span
        className={`relative px-[1px] whitespace-nowrap ${lit ? (listFocused ? 'bg-select text-white' : 'bg-face') : ''}`}
      >
        {entry.label}
        {lit && listFocused && <span aria-hidden="true" className="dotted-frame" />}
      </span>
    )
  }

  const select = (entry: ListEntry) => (
    <div
      key={entry.key}
      role="option"
      tabIndex={-1}
      aria-selected={entry.key === cursor}
      data-entry={entry.key}
      className={`flex items-center h-[16px] gap-[2px] ${view === 'list' ? 'pr-[12px]' : ''}`}
      onMouseDown={(event) => {
        // The list keeps focus, so it survives this row unmounting when a folder opens.
        event.preventDefault()
        listRef.current?.focus()
        choose(entry)
      }}
      onDoubleClick={() => activate(entry)}
    >
      <img src={entryIcon(entry)} alt="" className="size-4 shrink-0" />
      {label(entry)}
    </div>
  )

  return (
    <>
      <Dialog title={title} onClose={onCancel} onHelp={whatsThis.arm} className="w-[430px]">
        <form
          className="relative flex flex-col gap-[6px] px-[8px] pt-[8px] pb-[10px]"
          onSubmit={(event) => {
            event.preventDefault()
            if (renaming) return
            if (current?.kind === 'place' && listFocused) enter(current.place)
            else if (current?.kind === 'place' && !name.trim()) enter(current.place)
            else submit()
          }}
        >
          <div className="flex items-center gap-[6px]">
            <label htmlFor={`${id}-folder`} className="w-[60px] shrink-0">
              <Accel label={mode === 'open' ? 'Look &in:' : 'Save &in:'} />
            </label>
            <ComboBox
              data-help={help.lookIn}
              id={`${id}-folder`}
              className="w-[200px]"
              options={lookIn}
              value={placeKey(place)}
              onChange={(key) => {
                const row = rows.find((candidate) => candidate.key === key)
                if (row) enter(row.place)
              }}
            />
            <div className="flex gap-[2px] ml-[4px]">
              <ToolButton
                glyph={toolbarGlyphs.up}
                label="Up One Level"
                help={TOOL_HELP.up}
                disabled={!parent}
                onClick={() => parent && enter(parent)}
              />
              <ToolButton
                glyph={toolbarGlyphs.newFolder}
                label="Create New Folder"
                help={TOOL_HELP.newFolder}
                disabled={place.kind === 'computer'}
                onClick={newFolder}
              />
              <span className="w-[4px]" />
              <ToolButton
                glyph={toolbarGlyphs.list}
                label="List"
                help={TOOL_HELP.list}
                pressed={view === 'list'}
                onClick={() => setView('list')}
              />
              <ToolButton
                glyph={toolbarGlyphs.details}
                label="Details"
                help={TOOL_HELP.details}
                pressed={view === 'details'}
                onClick={() => setView('details')}
              />
            </div>
          </div>
          <div
            ref={listRef}
            role="listbox"
            aria-label="Folder contents"
            data-help={help.list}
            tabIndex={0}
            className={`h-[136px] bg-white bevel-sunken p-[2px] outline-none ${view === 'list' ? 'overflow-x-auto overflow-y-hidden' : 'overflow-auto'}`}
            onFocus={(event) => {
              setListFocused(true)
              if (event.target === event.currentTarget && !cursor) choose(entries[0])
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setListFocused(false)
            }}
            onKeyDown={onListKey}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) setCursor(null)
            }}
          >
            {view === 'list' ? (
              <div className="flex flex-col flex-wrap content-start h-full">{entries.map(select)}</div>
            ) : (
              <div className="min-w-max">
                <div className="flex h-[17px] sticky top-0 z-10">
                  {[
                    ['Name', 'w-[170px]'],
                    ['Size', 'w-[60px] justify-end'],
                    ['Type', 'w-[110px]'],
                    ['Modified', 'w-[110px]'],
                  ].map(([heading, width]) => (
                    <div key={heading} className={`flex items-center px-[4px] bg-face bevel-raised ${width}`}>
                      {heading}
                    </div>
                  ))}
                </div>
                {entries.map((entry) => (
                  <div key={entry.key} className="flex">
                    <div className="w-[170px] px-[2px] overflow-hidden">{select(entry)}</div>
                    <div className="w-[60px] px-[4px] text-right">
                      {entry.node?.kind === 'file' ? sizeCell(bytesOf(state, entry.node)) : ''}
                    </div>
                    <div className="w-[110px] px-[4px] truncate">
                      {entry.node ? typeName(entry.node) : 'System Folder'}
                    </div>
                    <div className="w-[110px] px-[4px] truncate">
                      {entry.node ? formatShortDate(entry.node.modified) : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-[10px] mt-[2px]">
            <div className="flex-1 min-w-0 flex flex-col gap-[7px]">
              <div className="flex items-center gap-[6px]">
                <label htmlFor={`${id}-name`} className="w-[80px] shrink-0">
                  <Accel label="File &name:" />
                </label>
                <TextBox
                  data-help={help.name}
                  id={`${id}-name`}
                  autoFocus
                  className="flex-1 min-w-0"
                  value={name}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="flex items-center gap-[6px]">
                <label htmlFor={`${id}-type`} className="w-[80px] shrink-0">
                  <Accel label={mode === 'save' ? 'Save as &type:' : 'Files of &type:'} />
                </label>
                <ComboBox
                  data-help={help.type}
                  id={`${id}-type`}
                  className="flex-1 min-w-0"
                  options={filters.map((entry, index) => ({ key: String(index), label: entry.label }))}
                  value={String(filterIndex)}
                  onChange={(key) => {
                    setFilterIndex(Number(key))
                    setCursor(null)
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-[6px]">
              <Button type="submit" isDefault disabled={!name.trim() && !current} data-help={help.ok}>
                <Accel label={mode === 'open' ? '&Open' : '&Save'} />
              </Button>
              <Button onClick={onCancel} data-help={TOOL_HELP.cancel}>
                Cancel
              </Button>
            </div>
          </div>
          {whatsThis.layer}
        </form>
      </Dialog>
      {error && (
        <MessageBox
          title={title}
          icon="warning"
          message={error}
          buttons={['OK']}
          onClose={() => setError(null)}
        />
      )}
      {overwrite && (
        <MessageBox
          title={title}
          icon="warning"
          message={`${overwrite.name} already exists.\nDo you want to replace it?`}
          buttons={['Yes', 'No']}
          onClose={(answer) => {
            if (answer === 'Yes') onSelect(overwrite, filter)
            setOverwrite(null)
          }}
        />
      )}
    </>
  )
}
