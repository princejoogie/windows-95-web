import { useEffect, useReducer, useRef, useState } from 'react'
import { createNode, fs, useFs } from '../../fs/store'
import { DOCUMENTS_DIR, type NodeId } from '../../fs/types'
import { useKeyDown } from '../../shell/context'
import { launch } from '../../shell/system'
import type { AppManifest, AppProps } from '../../shell/types'
import {
  AboutDialog,
  Button,
  Checkbox,
  FileDialog,
  type FileDialogResult,
  GroupBox,
  MenuBar,
  MessageBox,
  Radio,
  Separator,
  TextBox,
} from '../../ui'
import { type DocumentState, documentReducer, findText } from './document'
import { notepadIcon } from './icon'
import { ModelessDialog } from './ModelessDialog'
import { defaultPageSettings, PageSetup } from './PageSetup'
import { revealSelection } from './revealSelection'
import './notepad.css'

type PendingAction = 'new' | 'open' | 'close'
type Prompt =
  | { kind: 'confirm'; next: PendingAction }
  | { kind: 'file'; mode: 'open' | 'save'; next: PendingAction | null }
  | { kind: 'pageSetup' }
  | { kind: 'about' }
  | { kind: 'error'; message: string }

const FILTERS = [
  { label: 'Text Documents (*.txt)', extensions: ['txt'] },
  { label: 'All Files (*.*)', extensions: ['*'] },
]

function initialDocument(file: NodeId | undefined): DocumentState {
  const node = file ? fs.get().nodes[file] : undefined
  const text = node?.kind === 'file' ? node.content : ''
  return { file: node?.kind === 'file' ? node.id : null, text, saved: text, undo: [] }
}

export function Notepad({ window: windowApi, args }: AppProps) {
  const [document, dispatch] = useReducer(documentReducer, args.file, initialDocument)
  const file = useFs((state) => (document.file ? state.nodes[document.file] : undefined))
  const name = file?.name ?? 'Untitled'
  const dirty = document.text !== document.saved
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [wordWrap, setWordWrap] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [pageSettings, setPageSettings] = useState(defaultPageSettings)
  const [selectionLength, setSelectionLength] = useState(0)
  const [query, setQuery] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [direction, setDirection] = useState<'up' | 'down'>('down')
  const editor = useRef<HTMLTextAreaElement>(null)
  const closeResult = useRef<((closed: boolean) => void) | null>(null)
  const cancel = () => {
    setPrompt(null)
    closeResult.current?.(false)
    closeResult.current = null
  }
  useEffect(() => {
    editor.current?.focus()
  }, [])

  useEffect(() => windowApi.setTitle(`${name} - Notepad`), [windowApi, name])

  const act = (action: PendingAction) => {
    switch (action) {
      case 'new':
        dispatch({ type: 'load', file: null, text: '' })
        setPrompt(null)
        editor.current?.focus()
        break
      case 'open':
        setPrompt({ kind: 'file', mode: 'open', next: null })
        break
      case 'close':
        closeResult.current?.(true)
        closeResult.current = null
        windowApi.close()
        break
    }
  }

  const request = (next: PendingAction) => {
    if (dirty) setPrompt({ kind: 'confirm', next })
    else act(next)
  }

  useEffect(() =>
    windowApi.onCloseRequest(
      () =>
        new Promise<boolean>((resolve) => {
          closeResult.current = resolve
          request('close')
        }),
    ),
  )

  const save = (next: PendingAction | null = null) => {
    if (file?.kind !== 'file') {
      setPrompt({ kind: 'file', mode: 'save', next })
      return
    }
    fs.write(file.id, document.text)
    dispatch({ type: 'save', file: file.id })
    setPrompt(null)
    if (next) act(next)
  }

  const acceptFile = (result: FileDialogResult) => {
    if (prompt?.kind !== 'file') return
    if (prompt.mode === 'open') {
      const node = result.kind === 'existing' ? fs.get().nodes[result.id] : undefined
      if (node?.kind !== 'file') return
      dispatch({ type: 'load', file: node.id, text: node.content })
    } else {
      let id: NodeId
      if (result.kind === 'existing') {
        id = result.id
        fs.write(id, document.text)
      } else {
        const created = createNode(result.parent, result.name, { kind: 'file', content: document.text })
        if ('error' in created) {
          setPrompt({ kind: 'error', message: created.error })
          return
        }
        id = created.id
      }
      dispatch({ type: 'save', file: id })
    }
    const next = prompt.next
    setPrompt(null)
    if (next) act(next)
    else requestAnimationFrame(() => editor.current?.focus())
  }

  const replaceSelection = (text: string) => {
    const area = editor.current
    if (!area) return
    const start = area.selectionStart
    const end = area.selectionEnd
    dispatch({ type: 'edit', text: document.text.slice(0, start) + text + document.text.slice(end) })
    requestAnimationFrame(() => {
      area.focus()
      area.setSelectionRange(start + text.length, start + text.length)
    })
  }

  const clipboard = async (action: 'cut' | 'copy' | 'paste') => {
    const area = editor.current
    if (!area) return
    try {
      if (action === 'paste') replaceSelection(await navigator.clipboard.readText())
      else {
        await navigator.clipboard.writeText(document.text.slice(area.selectionStart, area.selectionEnd))
        if (action === 'cut') replaceSelection('')
      }
    } catch {
      setPrompt({
        kind: 'error',
        message: 'The clipboard is not available. Use the keyboard shortcuts to copy or paste text.',
      })
    }
  }

  const findNext = () => {
    if (!query) {
      setFindOpen(true)
      return
    }
    const area = editor.current
    if (!area) return
    const start = direction === 'down' ? area.selectionEnd : area.selectionStart - 1
    const index = findText(document.text, query, start, matchCase, direction)
    if (index === null) {
      setPrompt({ kind: 'error', message: `Cannot find "${query}"` })
      return
    }
    requestAnimationFrame(() => {
      if (!findOpen) area.focus()
      area.setSelectionRange(index, index + query.length)
      revealSelection(area)
      setSelectionLength(query.length)
    })
  }

  const timeDate = () => {
    const now = new Date()
    replaceSelection(
      `${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} ${now.toLocaleDateString('en-US')}`,
    )
  }

  useKeyDown((event) => {
    if (prompt || (event.target instanceof Element && event.target.closest('[role="dialog"]'))) return
    const key = event.key.toLowerCase()
    if (event.ctrlKey && ['n', 'o', 's', 'f', 'z'].includes(key)) {
      event.preventDefault()
      if (key === 'n') request('new')
      if (key === 'o') request('open')
      if (key === 's') event.shiftKey ? setPrompt({ kind: 'file', mode: 'save', next: null }) : save()
      if (key === 'f') setFindOpen(true)
      if (key === 'z') dispatch({ type: 'undo' })
    }
    if (event.key === 'F3') {
      event.preventDefault()
      findNext()
    }
    if (event.key === 'F5') {
      event.preventDefault()
      timeDate()
    }
  })

  return (
    <div className="h-full w-full flex flex-col">
      <MenuBar
        menus={[
          {
            label: '&File',
            items: [
              { label: '&New', shortcut: 'Ctrl+N', onSelect: () => request('new') },
              { label: '&Open...', shortcut: 'Ctrl+O', onSelect: () => request('open') },
              { label: '&Save', shortcut: 'Ctrl+S', onSelect: () => save() },
              { label: 'Save &As...', onSelect: () => setPrompt({ kind: 'file', mode: 'save', next: null }) },
              'separator',
              { label: 'Page Set&up...', onSelect: () => setPrompt({ kind: 'pageSetup' }) },
              {
                label: '&Print...',
                onSelect: () =>
                  setPrompt({
                    kind: 'error',
                    message:
                      'No printers are installed. To install a printer, choose Settings from the Start menu, click Printers, and then double-click Add Printer.',
                  }),
              },
              'separator',
              { label: 'E&xit', onSelect: () => request('close') },
            ],
          },
          {
            label: '&Edit',
            items: [
              {
                label: '&Undo',
                shortcut: 'Ctrl+Z',
                disabled: document.undo.length === 0,
                onSelect: () => dispatch({ type: 'undo' }),
              },
              'separator',
              {
                label: 'Cu&t',
                shortcut: 'Ctrl+X',
                disabled: selectionLength === 0,
                onSelect: () => void clipboard('cut'),
              },
              {
                label: '&Copy',
                shortcut: 'Ctrl+C',
                disabled: selectionLength === 0,
                onSelect: () => void clipboard('copy'),
              },
              { label: '&Paste', shortcut: 'Ctrl+V', onSelect: () => void clipboard('paste') },
              {
                label: 'De&lete',
                shortcut: 'Del',
                disabled: selectionLength === 0,
                onSelect: () => replaceSelection(''),
              },
              'separator',
              {
                label: 'Select &All',
                shortcut: 'Ctrl+A',
                onSelect: () => {
                  editor.current?.focus()
                  editor.current?.select()
                  setSelectionLength(document.text.length)
                },
              },
              { label: 'Time/&Date', shortcut: 'F5', onSelect: timeDate },
              'separator',
              { label: '&Word Wrap', checked: wordWrap, onSelect: () => setWordWrap((value) => !value) },
            ],
          },
          {
            label: '&Search',
            items: [
              { label: '&Find...', shortcut: 'Ctrl+F', onSelect: () => setFindOpen(true) },
              { label: 'Find &Next', shortcut: 'F3', onSelect: findNext },
            ],
          },
          {
            label: '&Help',
            items: [
              { label: '&Help Topics', onSelect: () => launch('help', { book: 'notepad' }) },
              'separator',
              { label: '&About Notepad', onSelect: () => setPrompt({ kind: 'about' }) },
            ],
          },
        ]}
      />
      <Separator className="shrink-0" />
      <textarea
        ref={editor}
        aria-label="Document text"
        className="notepad-editor"
        spellCheck={false}
        value={document.text}
        wrap={wordWrap ? 'soft' : 'off'}
        onChange={(event) => dispatch({ type: 'edit', text: event.target.value })}
        onSelect={(event) =>
          setSelectionLength(event.currentTarget.selectionEnd - event.currentTarget.selectionStart)
        }
      />
      {prompt?.kind === 'confirm' && (
        <MessageBox
          title="Notepad"
          icon="question"
          message={`The text in the ${name} file has changed.\nDo you want to save the changes?`}
          buttons={['Yes', 'No', 'Cancel']}
          onClose={(answer) => {
            if (answer === 'Yes') save(prompt.next)
            else if (answer === 'No') act(prompt.next)
            else cancel()
          }}
        />
      )}
      {prompt?.kind === 'file' && (
        <FileDialog
          mode={prompt.mode}
          initialFolder={file?.parent ?? DOCUMENTS_DIR}
          initialName={prompt.mode === 'save' ? (file?.name ?? 'Untitled.txt') : ''}
          filters={FILTERS}
          defaultExtension="txt"
          onSelect={acceptFile}
          onCancel={cancel}
        />
      )}
      {prompt?.kind === 'error' && (
        <MessageBox title="Notepad" icon="info" message={prompt.message} buttons={['OK']} onClose={cancel} />
      )}
      {findOpen && (
        <ModelessDialog
          title="Find"
          blocked={prompt !== null}
          onClose={() => {
            setFindOpen(false)
            editor.current?.focus()
          }}
          className="w-[395px]"
        >
          <form
            className="flex gap-[12px] p-[10px]"
            onKeyDown={(event) => {
              if (event.key === 'F3') {
                event.preventDefault()
                findNext()
              }
            }}
            onSubmit={(event) => {
              event.preventDefault()
              findNext()
            }}
          >
            <div className="flex-1 flex flex-col gap-[10px]">
              <label htmlFor={`find-${windowApi.id}`} className="flex items-center gap-[6px]">
                Find what:
                <TextBox
                  id={`find-${windowApi.id}`}
                  className="min-w-0 flex-1"
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <div className="flex items-end gap-[12px]">
                <Checkbox
                  label="Match case"
                  checked={matchCase}
                  onChange={(event) => setMatchCase(event.target.checked)}
                />
                <GroupBox label="Direction" className="flex gap-[12px]">
                  <Radio
                    label="Up"
                    name={`direction-${windowApi.id}`}
                    checked={direction === 'up'}
                    onChange={() => setDirection('up')}
                  />
                  <Radio
                    label="Down"
                    name={`direction-${windowApi.id}`}
                    checked={direction === 'down'}
                    onChange={() => setDirection('down')}
                  />
                </GroupBox>
              </div>
            </div>
            <div className="flex flex-col gap-[6px]">
              <Button type="submit" isDefault disabled={!query}>
                Find Next
              </Button>
              <Button
                onClick={() => {
                  setFindOpen(false)
                  editor.current?.focus()
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </ModelessDialog>
      )}
      {prompt?.kind === 'pageSetup' && (
        <PageSetup
          settings={pageSettings}
          onSave={(settings) => {
            setPageSettings(settings)
            setPrompt(null)
          }}
          onCancel={() => setPrompt(null)}
        />
      )}
      {prompt?.kind === 'about' && (
        <AboutDialog app="Notepad" icon={notepadIcon} onClose={() => setPrompt(null)} />
      )}
    </div>
  )
}

export const app: AppManifest = {
  id: 'notepad',
  title: 'Notepad',
  icon: notepadIcon,
  exe: 'NOTEPAD.EXE',
  startMenu: ['Accessories'],
  fileTypes: ['txt', 'bat', 'sys', 'ini', 'log'],
  window: { kind: 'resizable', width: 560, height: 380, minWidth: 240, minHeight: 120 },
  component: Notepad,
}
