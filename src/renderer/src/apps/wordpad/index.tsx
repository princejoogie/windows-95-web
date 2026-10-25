import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { pathOf } from '../../fs/fs'
import { createNode, fs, useFs } from '../../fs/store'
import { DOCUMENTS_DIR, type NodeId } from '../../fs/types'
import { useKeyDown } from '../../shell/context'
import { rememberDocument } from '../../shell/recent'
import { launch } from '../../shell/system'
import type { AppManifest, AppProps } from '../../shell/types'
import {
  AboutDialog,
  Button,
  FileDialog,
  type FileDialogResult,
  MenuBar,
  type MenuEntry,
  MessageBox,
  StatusBar,
  StatusPane,
} from '../../ui'
import {
  DateTimeDialog,
  FindDialog,
  type FindState,
  FontDialog,
  NewDialog,
  OptionsDialog,
  PageSetupDialog,
  ParagraphDialog,
  PasteSpecialDialog,
  PrintDialog,
  TabsDialog,
} from './dialogs'
import {
  applyParagraphStyle,
  applyRunStyle,
  DEFAULT_SELECTION,
  findInEditor,
  insertHtml,
  insertText,
  readSelection,
  replaceAllInEditor,
  replaceInEditor,
  SelectionKeeper,
  type SelectionState,
  setAlignment,
  setColor,
  setFontName,
  setFontSize,
  toggle,
  toggleBullets,
} from './editor'
import { readDocument, renderDocument } from './html'
import { wordpadIcon, wordpadSmallIcon } from './icons'
import {
  type Alignment,
  DEFAULT_PARAGRAPH,
  DEFAULT_RUN,
  type Document,
  emptyDocument,
  fromPlainText,
  plainText,
  sameRunStyle,
  twipsToPixels,
} from './model'
import {
  DEFAULT_PAGE,
  type DocumentType,
  displayName,
  documentTypeFor,
  extensionFor,
  loadOptions,
  type Options,
  type PageSetup,
  pageArea,
  saveOptions,
} from './options'
import { Ruler } from './Ruler'
import { isRtf, parseRtf, writeRtf } from './rtf'
import { FormatBar, Toolbar } from './Toolbar'
import './wordpad.css'

type Command =
  | { kind: 'new' }
  | { kind: 'create'; type: DocumentType }
  | { kind: 'open' }
  | { kind: 'openFile'; id: NodeId }
  | { kind: 'exit' }

type SaveTarget = { kind: 'existing'; id: NodeId } | { kind: 'new'; parent: NodeId; name: string }

type WordPadDialog =
  | { kind: 'new' }
  | { kind: 'confirm'; next: Command }
  | { kind: 'file'; mode: 'open' | 'save'; next: Command | null }
  | { kind: 'textOnly'; target: SaveTarget; next: Command | null }
  | { kind: 'print' }
  | { kind: 'printFile' }
  | { kind: 'pageSetup' }
  | { kind: 'find'; replace: boolean }
  | { kind: 'pasteSpecial' }
  | { kind: 'dateTime' }
  | { kind: 'font' }
  | { kind: 'paragraph' }
  | { kind: 'tabs' }
  | { kind: 'options' }
  | { kind: 'about' }
  | { kind: 'message'; title: string; message: string; icon: 'info' | 'warning' | 'error' }

const OPEN_FILTERS = [
  { label: 'Word for Windows 6.0 (*.doc)', extensions: ['doc'] },
  { label: 'Windows Write (*.wri)', extensions: ['wri'] },
  { label: 'Rich Text Format (*.rtf)', extensions: ['rtf'] },
  { label: 'Text Documents (*.txt)', extensions: ['txt'] },
  { label: 'All Documents (*.*)', extensions: ['*'] },
]
const SAVE_FILTERS = [
  { label: 'Word for Windows 6.0', extensions: ['doc'] },
  { label: 'Rich Text Format', extensions: ['rtf'] },
  { label: 'Text Document', extensions: ['txt'] },
  { label: 'Text Document - MS-DOS Format', extensions: ['txt'] },
]
const PRINT_FILTERS = [{ label: 'Printer Files (*.prn)', extensions: ['prn'] }]
const RECENT_KEY = 'w95.wordpad.recent'
const GUTTER = 8

const hasFormatting = (doc: Document): boolean =>
  doc.paragraphs.some(
    (p) =>
      p.align !== DEFAULT_PARAGRAPH.align ||
      p.left !== 0 ||
      p.right !== 0 ||
      p.first !== 0 ||
      p.tabs.length > 0 ||
      p.bullet ||
      p.runs.some((run) => !sameRunStyle(run, DEFAULT_RUN)),
  )

function readRecent(): NodeId[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is NodeId => typeof id === 'string') : []
  } catch {
    return []
  }
}

function parseContent(content: string): Document {
  return isRtf(content) ? parseRtf(content) : fromPlainText(content)
}

function serialize(doc: Document, type: DocumentType): string {
  return type === 'text' ? plainText(doc) : writeRtf(doc)
}

export function WordPad({ window: windowApi, args }: AppProps) {
  const editor = useRef<HTMLDivElement>(null)
  const keeper = useMemo(() => new SelectionKeeper(() => editor.current), [])
  const [file, setFile] = useState<NodeId | null>(null)
  const [docType, setDocType] = useState<DocumentType>('word6')
  const [dirty, setDirty] = useState(false)
  const [options, setOptions] = useState<Options>(loadOptions)
  const [page, setPage] = useState<PageSetup>(DEFAULT_PAGE)
  const [selection, setSelection] = useState<SelectionState>(DEFAULT_SELECTION)
  const [hasSelection, setHasSelection] = useState(false)
  const [dialog, setDialog] = useState<WordPadDialog | null>(null)
  const [preview, setPreview] = useState(false)
  const [previewStatus, setPreviewStatus] = useState('Page 1')
  const [find, setFind] = useState<FindState>({
    query: '',
    replacement: '',
    matchCase: false,
    wholeWord: false,
  })
  const [recent, setRecent] = useState<NodeId[]>(readRecent)
  const [locks, setLocks] = useState({ caps: false, num: true, scroll: false })
  const closeResult = useRef<((closed: boolean) => void) | null>(null)
  const node = useFs((state) => (file ? state.nodes[file] : undefined))
  const fsState = useFs((state) => state)
  const view = options.types[docType]
  const area = pageArea(page)
  const name = node?.kind === 'file' ? displayName(node.name) : 'Document'

  useEffect(() => windowApi.setTitle(`${name} - WordPad`), [windowApi, name])

  const refreshSelection = useCallback(() => {
    const root = editor.current
    if (!root) return
    const current = document.getSelection()
    if (!current || current.rangeCount === 0 || !root.contains(current.getRangeAt(0).commonAncestorContainer))
      return
    keeper.remember()
    setSelection((previous) => readSelection(root, previous))
    setHasSelection(!current.isCollapsed)
  }, [keeper])

  useEffect(() => {
    document.addEventListener('selectionchange', refreshSelection)
    return () => document.removeEventListener('selectionchange', refreshSelection)
  }, [refreshSelection])

  const load = useCallback(
    (doc: Document, id: NodeId | null, type: DocumentType) => {
      const root = editor.current
      if (!root) return
      root.innerHTML = renderDocument(doc)
      setFile(id)
      setDocType(type)
      setDirty(false)
      setSelection(DEFAULT_SELECTION)
      setHasSelection(false)
      requestAnimationFrame(() => {
        root.focus()
        const range = document.createRange()
        range.setStart(root, 0)
        range.collapse(true)
        const current = document.getSelection()
        current?.removeAllRanges()
        current?.addRange(range)
        refreshSelection()
      })
    },
    [refreshSelection],
  )

  const remember = useCallback((id: NodeId) => {
    rememberDocument(id)
    setRecent((current) => {
      const next = [id, ...current.filter((other) => other !== id)].slice(0, 4)
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const message = useCallback(
    (text: string, icon: 'info' | 'warning' | 'error' = 'info') =>
      setDialog({ kind: 'message', title: 'WordPad', message: text, icon }),
    [],
  )

  const openFile = useCallback(
    (id: NodeId) => {
      const target = fs.get().nodes[id]
      if (target?.kind !== 'file') {
        message('The file no longer exists.', 'warning')
        return
      }
      load(parseContent(target.content), id, documentTypeFor(target.name))
      remember(id)
    },
    [load, message, remember],
  )

  const initialFile = args.file
  useEffect(() => {
    document.execCommand('styleWithCSS', false, 'true')
    if (initialFile) openFile(initialFile)
    else load(emptyDocument(), null, 'word6')
  }, [initialFile, load, openFile])

  /** Closes any dialog and hands focus and the selection back to the document. */
  const closeDialog = () => {
    setDialog(null)
    closeResult.current?.(false)
    closeResult.current = null
    requestAnimationFrame(() => keeper.restore())
  }

  const currentDocument = (): Document => (editor.current ? readDocument(editor.current) : emptyDocument())

  const run = (command: Command) => {
    setDialog(null)
    switch (command.kind) {
      case 'new':
        setDialog({ kind: 'new' })
        break
      case 'create':
        load(emptyDocument(), null, command.type)
        break
      case 'open':
        setDialog({ kind: 'file', mode: 'open', next: null })
        break
      case 'openFile':
        openFile(command.id)
        break
      case 'exit':
        closeResult.current?.(true)
        closeResult.current = null
        windowApi.close()
        break
    }
  }

  const request = (command: Command) => (dirty ? setDialog({ kind: 'confirm', next: command }) : run(command))

  useEffect(() =>
    windowApi.onCloseRequest(
      () =>
        new Promise<boolean>((resolve) => {
          closeResult.current = resolve
          request({ kind: 'exit' })
        }),
    ),
  )

  const writeTo = (target: SaveTarget, type: DocumentType, next: Command | null) => {
    const content = serialize(currentDocument(), type)
    let id: NodeId
    if (target.kind === 'existing') {
      id = target.id
      fs.write(id, content)
    } else {
      const created = createNode(target.parent, target.name, { kind: 'file', content })
      if ('error' in created) {
        message(created.error, 'warning')
        return
      }
      id = created.id
    }
    setFile(id)
    setDocType(type)
    setDirty(false)
    remember(id)
    setDialog(null)
    if (next) run(next)
    else requestAnimationFrame(() => keeper.restore())
  }

  const saveTo = (target: SaveTarget, next: Command | null) => {
    const targetName = target.kind === 'existing' ? (fs.get().nodes[target.id]?.name ?? '') : target.name
    const type = documentTypeFor(targetName)
    if (type === 'text' && hasFormatting(currentDocument())) setDialog({ kind: 'textOnly', target, next })
    else writeTo(target, type, next)
  }

  const save = (next: Command | null = null) => {
    if (node?.kind === 'file') saveTo({ kind: 'existing', id: node.id }, next)
    else setDialog({ kind: 'file', mode: 'save', next })
  }

  const acceptFile = (result: FileDialogResult) => {
    if (dialog?.kind === 'printFile') {
      const content = plainText(currentDocument())
      if (result.kind === 'existing') fs.write(result.id, content)
      else {
        const created = createNode(result.parent, result.name, { kind: 'file', content })
        if ('error' in created) {
          message(created.error, 'warning')
          return
        }
      }
      setDialog(null)
      return
    }
    if (dialog?.kind !== 'file') return
    if (dialog.mode === 'open') {
      setDialog(null)
      if (result.kind === 'existing') openFile(result.id)
      return
    }
    saveTo(result.kind === 'existing' ? { kind: 'existing', id: result.id } : result, dialog.next)
  }

  /** Runs an editing command against the remembered selection, then refreshes the bars. */
  const edit = (action: () => void) => {
    keeper.restore()
    action()
    setDirty(true)
    refreshSelection()
  }

  const paste = async (kind: 'rich' | 'text') => {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        if (kind === 'rich' && item.types.includes('text/html')) {
          const html = await (await item.getType('text/html')).text()
          edit(() => insertHtml(html))
          return
        }
        if (item.types.includes('text/plain')) {
          const text = await (await item.getType('text/plain')).text()
          edit(() => insertText(text))
          return
        }
      }
    } catch {
      try {
        const text = await navigator.clipboard.readText()
        edit(() => insertText(text))
      } catch {
        message('The Clipboard is not available. Press Ctrl+V to paste.', 'warning')
      }
    }
  }

  const findNext = () => {
    const root = editor.current
    if (!root || !find.query) {
      setDialog({ kind: 'find', replace: false })
      return
    }
    if (!findInEditor(root, find.query, find)) message('WordPad has finished searching the document.')
    else refreshSelection()
  }

  const replace = () => {
    const root = editor.current
    if (!root) return
    if (!replaceInEditor(root, find.query, find.replacement, find)) {
      setDirty(true)
      message('WordPad has finished searching the document.')
    } else setDirty(true)
  }

  const replaceAll = () => {
    const root = editor.current
    if (!root) return
    const count = replaceAllInEditor(root, find.query, find.replacement, find)
    if (count) setDirty(true)
    message(
      count
        ? `Replaced ${count} occurrence${count === 1 ? '' : 's'}.`
        : 'WordPad has finished searching the document.',
    )
  }

  const updateOptions = (next: Options) => {
    setOptions(next)
    saveOptions(next)
  }
  const toggleView = (key: 'toolbar' | 'formatBar' | 'ruler' | 'statusBar') =>
    updateOptions({ ...options, types: { ...options.types, [docType]: { ...view, [key]: !view[key] } } })

  const printToFile = () => setDialog({ kind: 'printFile' })

  useKeyDown((event) => {
    const key = event.key.toLowerCase()
    setLocks({
      caps: event.getModifierState('CapsLock'),
      num: event.getModifierState('NumLock'),
      scroll: event.getModifierState('ScrollLock'),
    })
    if (dialog) return
    if (event.altKey && event.key === 'F4') {
      event.preventDefault()
      request({ kind: 'exit' })
      return
    }
    if (event.key === 'F1') {
      event.preventDefault()
      launch('help', { book: 'wordpad' })
      return
    }
    if (preview) return
    if (event.key === 'F3') {
      event.preventDefault()
      findNext()
      return
    }
    if (!event.ctrlKey || event.altKey) return
    const shortcuts: Record<string, () => void> = {
      n: () => request({ kind: 'new' }),
      o: () => request({ kind: 'open' }),
      s: () => save(),
      p: () => setDialog({ kind: 'print' }),
      f: () => setDialog({ kind: 'find', replace: false }),
      h: () => setDialog({ kind: 'find', replace: true }),
      b: () => edit(() => toggle('bold')),
      i: () => edit(() => toggle('italic')),
      u: () => edit(() => toggle('underline')),
      l: () => edit(() => editor.current && setAlignment(editor.current, 'left')),
      e: () => edit(() => editor.current && setAlignment(editor.current, 'center')),
      r: () => edit(() => editor.current && setAlignment(editor.current, 'right')),
    }
    const action = shortcuts[key]
    if (action) {
      event.preventDefault()
      action()
    }
  })

  const recentItems: MenuEntry[] = recent
    .filter((id) => fsState.nodes[id]?.kind === 'file')
    .map((id, index) => ({
      label: `&${index + 1} ${pathOf(fsState, id)}`,
      onSelect: () => request({ kind: 'openFile', id }),
    }))

  const menus = [
    {
      label: '&File',
      items: [
        { label: '&New...', shortcut: 'Ctrl+N', onSelect: () => request({ kind: 'new' }) },
        { label: '&Open...', shortcut: 'Ctrl+O', onSelect: () => request({ kind: 'open' }) },
        { label: '&Save', shortcut: 'Ctrl+S', onSelect: () => save() },
        { label: 'Save &As...', onSelect: () => setDialog({ kind: 'file', mode: 'save', next: null }) },
        'separator',
        { label: '&Print...', shortcut: 'Ctrl+P', onSelect: () => setDialog({ kind: 'print' }) },
        { label: 'Print Pre&view', onSelect: () => setPreview(true) },
        { label: 'Page Set&up...', onSelect: () => setDialog({ kind: 'pageSetup' }) },
        'separator',
        ...(recentItems.length ? [...recentItems, 'separator' as const] : []),
        {
          label: 'Sen&d...',
          onSelect: () =>
            message('There is no e-mail program installed to perform the requested action.', 'warning'),
        },
        'separator',
        { label: 'E&xit', onSelect: () => request({ kind: 'exit' }) },
      ] satisfies MenuEntry[],
    },
    {
      label: '&Edit',
      items: [
        { label: '&Undo', shortcut: 'Ctrl+Z', onSelect: () => edit(() => document.execCommand('undo')) },
        'separator',
        {
          label: 'Cu&t',
          shortcut: 'Ctrl+X',
          disabled: !hasSelection,
          onSelect: () => edit(() => document.execCommand('cut')),
        },
        {
          label: '&Copy',
          shortcut: 'Ctrl+C',
          disabled: !hasSelection,
          onSelect: () => edit(() => document.execCommand('copy')),
        },
        { label: '&Paste', shortcut: 'Ctrl+V', onSelect: () => void paste('rich') },
        { label: 'Paste &Special...', onSelect: () => setDialog({ kind: 'pasteSpecial' }) },
        {
          label: 'Cle&ar',
          shortcut: 'Del',
          disabled: !hasSelection,
          onSelect: () => edit(() => document.execCommand('delete')),
        },
        {
          label: 'Select A&ll',
          shortcut: 'Ctrl+A',
          onSelect: () => edit(() => document.execCommand('selectAll')),
        },
        'separator',
        {
          label: '&Find...',
          shortcut: 'Ctrl+F',
          onSelect: () => setDialog({ kind: 'find', replace: false }),
        },
        { label: 'Find &Next', shortcut: 'F3', onSelect: findNext },
        {
          label: 'R&eplace...',
          shortcut: 'Ctrl+H',
          onSelect: () => setDialog({ kind: 'find', replace: true }),
        },
        'separator',
        { label: 'Lin&ks...', disabled: true },
        { label: 'Object Propert&ies', shortcut: 'Alt+Enter', disabled: true },
        { label: '&Object', disabled: true },
      ] satisfies MenuEntry[],
    },
    {
      label: '&View',
      items: [
        { label: '&Toolbar', checked: view.toolbar, onSelect: () => toggleView('toolbar') },
        { label: '&Format Bar', checked: view.formatBar, onSelect: () => toggleView('formatBar') },
        { label: '&Ruler', checked: view.ruler, onSelect: () => toggleView('ruler') },
        { label: '&Status Bar', checked: view.statusBar, onSelect: () => toggleView('statusBar') },
        'separator',
        { label: '&Options...', onSelect: () => setDialog({ kind: 'options' }) },
      ] satisfies MenuEntry[],
    },
    {
      label: '&Insert',
      items: [
        { label: '&Date and Time...', onSelect: () => setDialog({ kind: 'dateTime' }) },
        {
          label: '&Object...',
          onSelect: () => message('No object types are registered on this computer.', 'warning'),
        },
      ] satisfies MenuEntry[],
    },
    {
      label: 'F&ormat',
      items: [
        { label: '&Font...', onSelect: () => setDialog({ kind: 'font' }) },
        {
          label: '&Bullet Style',
          checked: selection.bullet,
          onSelect: () => edit(() => editor.current && toggleBullets(editor.current, !selection.bullet)),
        },
        { label: '&Paragraph...', onSelect: () => setDialog({ kind: 'paragraph' }) },
        { label: '&Tabs...', onSelect: () => setDialog({ kind: 'tabs' }) },
      ] satisfies MenuEntry[],
    },
    {
      label: '&Help',
      items: [
        { label: '&Help Topics', onSelect: () => launch('help', { book: 'wordpad' }) },
        'separator',
        { label: '&About WordPad', onSelect: () => setDialog({ kind: 'about' }) },
      ] satisfies MenuEntry[],
    },
  ]

  const pageStyle =
    view.wordWrap === 'ruler'
      ? { width: twipsToPixels(area.width) + GUTTER, whiteSpace: 'pre-wrap' as const }
      : view.wordWrap === 'none'
        ? { minWidth: '100%', width: 'max-content', whiteSpace: 'pre' as const }
        : { whiteSpace: 'pre-wrap' as const }

  return (
    <div className="flex h-full w-full flex-col bg-face">
      <MenuBar menus={menus} />
      {preview && (
        <PrintPreview
          doc={currentDocument()}
          page={page}
          onClose={() => {
            setPreview(false)
            requestAnimationFrame(() => keeper.restore())
          }}
          onPrint={() => setDialog({ kind: 'print' })}
          onStatus={setPreviewStatus}
        />
      )}
      {!preview && view.toolbar && (
        <Toolbar
          hasSelection={hasSelection}
          actions={{
            onNew: () => request({ kind: 'new' }),
            onOpen: () => request({ kind: 'open' }),
            onSave: () => save(),
            onPrint: () => setDialog({ kind: 'print' }),
            onPreview: () => setPreview(true),
            onFind: () => setDialog({ kind: 'find', replace: false }),
            onCut: () => edit(() => document.execCommand('cut')),
            onCopy: () => edit(() => document.execCommand('copy')),
            onPaste: () => void paste('rich'),
            onUndo: () => edit(() => document.execCommand('undo')),
            onDateTime: () => setDialog({ kind: 'dateTime' }),
          }}
        />
      )}
      {!preview && view.formatBar && (
        <FormatBar
          state={selection}
          actions={{
            onBeforeFocusSteal: () => keeper.remember(),
            onFont: (font) => edit(() => setFontName(font)),
            onSize: (size) => edit(() => editor.current && setFontSize(editor.current, size)),
            onToggle: (command) => edit(() => toggle(command)),
            onColor: (color) => edit(() => setColor(color)),
            onAlign: (align: Alignment) => edit(() => editor.current && setAlignment(editor.current, align)),
            onBullets: () => edit(() => editor.current && toggleBullets(editor.current, !selection.bullet)),
          }}
        />
      )}
      {!preview && view.ruler && (
        <Ruler
          widthTwips={view.wordWrap === 'ruler' ? area.width : null}
          gutter={GUTTER}
          paragraph={selection}
          units={options.units}
          onChange={(patch) => edit(() => editor.current && applyParagraphStyle(editor.current, patch))}
        />
      )}
      {/* The editor stays mounted under Print Preview so the document survives the round trip. */}
      <div className={`relative min-h-0 flex-1 overflow-auto bg-white ${preview ? 'hidden' : ''}`}>
        {/* biome-ignore lint/a11y/useSemanticElements: rich text needs a contentEditable surface, which no form element offers */}
        <div
          ref={editor}
          role="textbox"
          aria-multiline="true"
          aria-label="Document"
          tabIndex={0}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          className="wordpad-page min-h-full"
          style={{ ...pageStyle, paddingLeft: GUTTER, paddingTop: 4, paddingBottom: 4, paddingRight: 4 }}
          onInput={() => {
            setDirty(true)
            refreshSelection()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Tab') {
              event.preventDefault()
              insertText('\t')
            }
          }}
          onFocus={() => document.execCommand('styleWithCSS', false, 'true')}
        />
      </div>
      {view.statusBar && (
        <StatusBar>
          <StatusPane className="flex-1">{preview ? previewStatus : 'For Help, press F1'}</StatusPane>
          <StatusPane className="w-[36px] text-center">{locks.caps ? 'CAP' : ''}</StatusPane>
          <StatusPane className="w-[36px] text-center">{locks.num ? 'NUM' : ''}</StatusPane>
          <StatusPane className="w-[40px] text-center">{locks.scroll ? 'SCRL' : ''}</StatusPane>
        </StatusBar>
      )}
      {dialog?.kind === 'new' && (
        <NewDialog onSelect={(type) => run({ kind: 'create', type })} onClose={closeDialog} />
      )}
      {dialog?.kind === 'confirm' && (
        <MessageBox
          title="WordPad"
          icon="question"
          message={`Save changes to ${name}?`}
          buttons={['Yes', 'No', 'Cancel']}
          onClose={(answer) => {
            if (answer === 'Yes') save(dialog.next)
            else if (answer === 'No') run(dialog.next)
            else closeDialog()
          }}
        />
      )}
      {dialog?.kind === 'textOnly' && (
        <MessageBox
          title="WordPad"
          icon="warning"
          message="You are about to save the document in a Text-Only format, which will remove all formatting. Are you sure you want to do this?"
          buttons={['Yes', 'No']}
          onClose={(answer) => {
            if (answer === 'Yes') writeTo(dialog.target, 'text', dialog.next)
            else closeDialog()
          }}
        />
      )}
      {dialog?.kind === 'file' && (
        <FileDialog
          mode={dialog.mode}
          initialFolder={node?.parent ?? DOCUMENTS_DIR}
          initialName={dialog.mode === 'save' ? (node?.name ?? `Document.${extensionFor(docType)}`) : ''}
          filters={dialog.mode === 'open' ? OPEN_FILTERS : SAVE_FILTERS}
          defaultExtension={extensionFor(docType)}
          onSelect={acceptFile}
          onCancel={closeDialog}
        />
      )}
      {dialog?.kind === 'printFile' && (
        <FileDialog
          mode="save"
          title="Print To File"
          initialFolder={node?.parent ?? DOCUMENTS_DIR}
          initialName={`${name}.prn`}
          filters={PRINT_FILTERS}
          defaultExtension="prn"
          onSelect={acceptFile}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'print' && <PrintDialog onPrint={printToFile} onClose={closeDialog} />}
      {dialog?.kind === 'pageSetup' && (
        <PageSetupDialog
          page={page}
          units={options.units}
          onApply={(next) => {
            setPage(next)
            setDialog(null)
          }}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'find' && (
        <FindDialog
          replace={dialog.replace}
          state={find}
          onChange={setFind}
          onFindNext={findNext}
          onReplace={replace}
          onReplaceAll={replaceAll}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'pasteSpecial' && (
        <PasteSpecialDialog
          onPaste={(kind) => {
            setDialog(null)
            void paste(kind)
          }}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'dateTime' && (
        <DateTimeDialog
          onInsert={(text) => {
            setDialog(null)
            requestAnimationFrame(() => edit(() => insertText(text)))
          }}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'font' && (
        <FontDialog
          current={selection}
          onApply={(style) => {
            setDialog(null)
            requestAnimationFrame(() =>
              edit(() => editor.current && applyRunStyle(editor.current, style, selection)),
            )
          }}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'paragraph' && (
        <ParagraphDialog
          paragraph={selection}
          units={options.units}
          onApply={(patch) => {
            setDialog(null)
            requestAnimationFrame(() =>
              edit(() => editor.current && applyParagraphStyle(editor.current, patch)),
            )
          }}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'tabs' && (
        <TabsDialog
          tabs={selection.tabs}
          units={options.units}
          onApply={(tabs) => {
            setDialog(null)
            requestAnimationFrame(() =>
              edit(() => editor.current && applyParagraphStyle(editor.current, { tabs })),
            )
          }}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'options' && (
        <OptionsDialog
          options={options}
          initialType={docType}
          onApply={(next) => {
            updateOptions(next)
            setDialog(null)
          }}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'about' && <AboutDialog app="WordPad" icon={wordpadIcon} onClose={closeDialog} />}
      {dialog?.kind === 'message' && (
        <MessageBox
          title={dialog.title}
          icon={dialog.icon}
          message={dialog.message}
          buttons={['OK']}
          onClose={closeDialog}
        />
      )}
    </div>
  )
}

const PREVIEW_ZOOMS = [0.35, 0.6, 1]

/** Print Preview: the document laid out on paper, with the page controls WordPad has above it. */
function PrintPreview({
  doc,
  page,
  onClose,
  onPrint,
  onStatus,
}: {
  doc: Document
  page: PageSetup
  onClose: () => void
  onPrint: () => void
  /** The status bar text, such as `Page 1` or `Pages 1-2`. */
  onStatus: (text: string) => void
}) {
  const area = pageArea(page)
  const [zoom, setZoom] = useState(0)
  const [twoPage, setTwoPage] = useState(false)
  const [current, setCurrent] = useState(0)
  const [pages, setPages] = useState(1)
  const measure = useRef<HTMLDivElement>(null)
  const html = useMemo(() => renderDocument(doc), [doc])
  const paperWidth = twipsToPixels(area.paperWidth)
  const paperHeight = twipsToPixels(area.paperHeight)
  const textHeight = twipsToPixels(area.height)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the measured height changes with the rendered html
  useEffect(() => {
    const height = measure.current?.scrollHeight ?? 0
    setPages(Math.max(1, Math.ceil(height / textHeight)))
  }, [html, textHeight])
  const scale = PREVIEW_ZOOMS[zoom] ?? 0.35
  const shown = twoPage ? [current, current + 1].filter((p) => p < pages) : [current]
  useEffect(() => {
    onStatus(shown.length > 1 ? `Pages ${current + 1}-${current + 2}` : `Page ${current + 1}`)
  }, [onStatus, shown.length, current])
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 gap-[4px] border-b border-shadow p-[4px]">
        <Button onClick={onPrint}>
          <span className="underline">P</span>rint...
        </Button>
        <Button
          disabled={current + (twoPage ? 2 : 1) >= pages}
          onClick={() => setCurrent((c) => c + (twoPage ? 2 : 1))}
        >
          <span className="underline">N</span>ext Page
        </Button>
        <Button
          disabled={current === 0}
          onClick={() => setCurrent((c) => Math.max(0, c - (twoPage ? 2 : 1)))}
        >
          Pre<span className="underline">v</span> Page
        </Button>
        <Button onClick={() => setTwoPage((t) => !t)}>
          {twoPage ? (
            <>
              <span className="underline">O</span>ne Page
            </>
          ) : (
            <>
              <span className="underline">T</span>wo Page
            </>
          )}
        </Button>
        <Button disabled={zoom >= PREVIEW_ZOOMS.length - 1} onClick={() => setZoom((z) => z + 1)}>
          Zoom <span className="underline">I</span>n
        </Button>
        <Button disabled={zoom === 0} onClick={() => setZoom((z) => z - 1)}>
          Zoom <span className="underline">O</span>ut
        </Button>
        <Button onClick={onClose}>
          <span className="underline">C</span>lose
        </Button>
      </div>
      <div
        className="relative min-h-0 flex-1 overflow-auto bg-shadow p-[12px]"
        aria-label="Print preview"
        role="img"
      >
        <div className="flex justify-center gap-[12px]">
          {shown.map((index) => (
            <div
              key={index}
              className="relative shrink-0 overflow-hidden bg-white shadow-[2px_2px_#000]"
              style={{ width: paperWidth * scale, height: paperHeight * scale }}
            >
              <div
                className="wordpad-page absolute overflow-hidden"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: '0 0',
                  left: twipsToPixels(page.left) * scale,
                  top: twipsToPixels(page.top) * scale,
                  width: twipsToPixels(area.width),
                  height: textHeight,
                  whiteSpace: 'pre-wrap',
                }}
              >
                <div
                  style={{ marginTop: -index * textHeight }}
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: the HTML is rendered from the typed document model
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            </div>
          ))}
        </div>
        <div
          ref={measure}
          aria-hidden="true"
          className="wordpad-page pointer-events-none absolute left-0 top-0 opacity-0"
          style={{ width: twipsToPixels(area.width), whiteSpace: 'pre-wrap' }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the HTML is rendered from the typed document model
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}

export const app: AppManifest = {
  id: 'wordpad',
  title: 'WordPad',
  icon: wordpadIcon,
  smallIcon: wordpadSmallIcon,
  exe: 'WORDPAD.EXE',
  startMenu: ['Accessories'],
  fileTypes: ['doc', 'rtf', 'wri'],
  window: { kind: 'resizable', width: 640, height: 420, minWidth: 320, minHeight: 160 },
  component: WordPad,
}
