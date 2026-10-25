import { useId, useMemo, useState } from 'react'
import { children, isInside, pathOf } from '../fs/fs'
import { fs, useFs } from '../fs/store'
import { DOCUMENTS_DIR, type NodeId, RECYCLED_DIR, ROOT } from '../fs/types'
import { icons } from '../icons'
import { nodeIcon } from '../shell/nodeIcon'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { TextBox } from './fields'
import { chooseFile, type FileDialogResult, type FileTypeFilter, matchesFileType } from './fileChoice'
import { MessageBox } from './MessageBox'

export type { FileDialogResult, FileTypeFilter } from './fileChoice'

const ALL_FILES: readonly FileTypeFilter[] = [{ label: 'All Files (*.*)', extensions: ['*'] }]

export interface FileDialogProps {
  readonly mode: 'open' | 'save'
  readonly title?: string
  readonly initialFolder?: NodeId
  readonly initialName?: string
  readonly filters?: readonly FileTypeFilter[]
  readonly defaultExtension?: string
  readonly onSelect: (result: FileDialogResult) => void
  readonly onCancel: () => void
}

export function FileDialog({
  mode,
  title = mode === 'open' ? 'Open' : 'Save As',
  initialFolder = DOCUMENTS_DIR,
  initialName = '',
  filters = ALL_FILES,
  defaultExtension = '',
  onSelect,
  onCancel,
}: FileDialogProps) {
  const state = useFs((s) => s)
  const [folder, setFolder] = useState(initialFolder)
  const [name, setName] = useState(initialName)
  const [filterIndex, setFilterIndex] = useState(0)
  const [selected, setSelected] = useState<NodeId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [overwrite, setOverwrite] = useState<Extract<FileDialogResult, { kind: 'existing' }> | null>(null)
  const id = useId()
  const filter = filters[filterIndex] ?? ALL_FILES[0]
  const contents = useMemo(
    () =>
      children(state, folder).filter(
        (node) =>
          node.kind === 'folder' || (node.kind === 'file' && filter && matchesFileType(node.name, filter)),
      ),
    [state, folder, filter],
  )
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

  const enterFolder = (next: NodeId) => {
    setFolder(next)
    setSelected(null)
  }

  const submit = (input = name) => {
    const choice = chooseFile(fs.get(), folder, input, mode, defaultExtension)
    switch (choice.kind) {
      case 'folder':
        enterFolder(choice.id)
        setName('')
        break
      case 'error':
        setError(choice.message)
        break
      case 'existing':
        if (mode === 'save') setOverwrite(choice)
        else onSelect(choice)
        break
      case 'new':
        onSelect(choice)
        break
    }
  }

  return (
    <>
      <Dialog title={title} onClose={onCancel} className="w-[450px] max-w-full">
        <form
          className="flex flex-col gap-[8px] p-[10px]"
          onSubmit={(event) => {
            event.preventDefault()
            const node = selected ? state.nodes[selected] : undefined
            if (node?.kind === 'folder') enterFolder(node.id)
            else submit()
          }}
        >
          <div className="flex items-center gap-[8px]">
            <label htmlFor={`${id}-folder`} className="w-[65px]">
              {mode === 'open' ? 'Look in:' : 'Save in:'}
            </label>
            <select
              id={`${id}-folder`}
              value={folder}
              className="h-[22px] flex-1 min-w-0 bg-white bevel-sunken px-[3px]"
              onChange={(event) => {
                const next = folders.find((node) => node.id === event.target.value)
                if (next) enterFolder(next.id)
              }}
            >
              {folders.map((node) => (
                <option key={node.id} value={node.id}>
                  {pathOf(state, node.id)}
                </option>
              ))}
            </select>
            <Button
              className="min-w-[28px] px-[4px]"
              title="Up one level"
              aria-label="Up one level"
              disabled={folder === ROOT}
              onClick={() => enterFolder(state.nodes[folder]?.parent ?? ROOT)}
            >
              <img src={icons.folderOpened} alt="" className="size-4 inline-block" />
              <span aria-hidden="true">↑</span>
            </Button>
          </div>
          <div
            role="listbox"
            aria-label="Folder contents"
            className="h-[180px] overflow-auto bg-white bevel-sunken p-[3px]"
          >
            {contents.map((node) => (
              <button
                key={node.id}
                type="button"
                role="option"
                aria-selected={selected === node.id}
                className={`flex items-center gap-[4px] w-full h-[20px] px-[2px] text-left outline-none focus-visible:outline-dotted focus-visible:outline-1 ${selected === node.id ? 'bg-select text-white' : ''}`}
                onClick={() => {
                  setSelected(node.id)
                  if (node.kind === 'file') setName(node.name)
                }}
                onDoubleClick={() => (node.kind === 'folder' ? enterFolder(node.id) : submit(node.name))}
              >
                <img src={nodeIcon(node).icon} alt="" className="size-4" />
                <span>{node.name}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-[10px]">
            <div className="flex-1 min-w-0 flex flex-col gap-[8px]">
              <label htmlFor={`${id}-name`} className="flex items-center gap-[8px]">
                <span className="w-[65px] shrink-0">File name:</span>
                <TextBox
                  id={`${id}-name`}
                  autoFocus
                  className="flex-1 min-w-0"
                  value={name}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => {
                    setName(event.target.value)
                    setSelected(null)
                  }}
                />
              </label>
              <label htmlFor={`${id}-type`} className="flex items-center gap-[8px]">
                <span className="w-[65px] shrink-0">Files of type:</span>
                <select
                  id={`${id}-type`}
                  value={filterIndex}
                  className="h-[21px] flex-1 min-w-0 bg-white bevel-sunken px-[3px]"
                  onChange={(event) => setFilterIndex(Number(event.target.value))}
                >
                  {filters.map((entry, index) => (
                    <option key={entry.label} value={index}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-col gap-[6px]">
              <Button type="submit" isDefault disabled={!name.trim() && !selected}>
                {mode === 'open' ? 'Open' : 'Save'}
              </Button>
              <Button onClick={onCancel}>Cancel</Button>
            </div>
          </div>
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
            if (answer === 'Yes') onSelect(overwrite)
            setOverwrite(null)
          }}
        />
      )}
    </>
  )
}
