import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { pathOf } from '../../fs/fs'
import { createNode, fs, useFs } from '../../fs/store'
import { DOCUMENTS_DIR, type NodeId } from '../../fs/types'
import { setPaintWallpaper } from '../../settings/wallpaper'
import { useKeyDown } from '../../shell/context'
import { launch } from '../../shell/system'
import type { AppManifest, AppProps } from '../../shell/types'
import {
  FileDialog,
  type FileDialogResult,
  type FileTypeFilter,
  MenuBar,
  type MenuBarMenu,
  type MenuEntry,
  MessageBox,
  StatusBar,
  StatusPane,
} from '../../ui'
import {
  type Bitmap,
  bitmap,
  type Depth,
  type History,
  type Piece,
  type Point,
  place,
  quantize,
  remember,
  repeat,
  resize,
  selectAll,
  skew,
  skewSize,
  stretch,
  transform,
  undo,
} from './bitmap'
import { decodeBitmap, drawBitmap, encodeBitmap, PaintCanvas } from './Canvas'
import { clipboardPiece, copyPiece, useClipboard } from './clipboard'
import { formatPalette, parsePalette } from './colors'
import {
  AboutDialog,
  AttributesDialog,
  CustomZoomDialog,
  EditColorsDialog,
  FlipRotateDialog,
  StretchSkewDialog,
} from './dialogs'
import { cleared, type Marquee, picture, pieceOf, rectOf, reshape, turn } from './marquee'
import { FontsToolbar, Thumbnail } from './panels'
import { ToolBox } from './ToolBox'
import { defaultTextStyle, type TextStyle } from './text'
import { defaultOptions, palette as defaultPalette, type Options, paintIcon, type Tool } from './tools'

const NEW_SIZE = { width: 440, height: 280 }
const IDLE_HELP = 'For Help, click Help Topics on the Help Menu.'
const NO_PRINTER =
  'Before you can perform printer-related tasks such as page setup or printing a document, you need to install a printer. Do you want to install a printer now?'
const OPEN_FILTERS: readonly FileTypeFilter[] = [
  { label: 'Bitmap Files (*.bmp;*.dib)', extensions: ['bmp', 'dib'] },
  { label: 'All Files (*.*)', extensions: ['*'] },
]
const SAVE_TYPES: readonly (FileTypeFilter & { depth: Depth })[] = [
  { label: 'Monochrome Bitmap (*.bmp;*.dib)', extensions: ['bmp', 'dib'], depth: 1 },
  { label: '16 Color Bitmap (*.bmp;*.dib)', extensions: ['bmp', 'dib'], depth: 4 },
  { label: '256 Color Bitmap (*.bmp;*.dib)', extensions: ['bmp', 'dib'], depth: 8 },
  { label: '24-bit Bitmap (*.bmp;*.dib)', extensions: ['bmp', 'dib'], depth: 24 },
]
const PALETTE_FILTERS: readonly FileTypeFilter[] = [{ label: 'Palette (*.pal)', extensions: ['pal'] }]
const RECENT_KEY = 'w95.paint.recent'

/** The last four pictures opened or saved, as Paint lists them on the File menu. */
function useRecent() {
  const [recent, setRecent] = useState<NodeId[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as NodeId[]
    } catch {
      return []
    }
  })
  const add = useCallback((id: NodeId) => {
    setRecent((current) => {
      const next = [id, ...current.filter((entry) => entry !== id)].slice(0, 4)
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      return next
    })
  }, [])
  return [recent, add] as const
}

/** Status bar help for each menu command, keyed by its label without the accelerator. */
const MENU_HELP: Record<string, string> = {
  New: 'Creates a new document.',
  'Open...': 'Opens an existing document.',
  Save: 'Saves the active document.',
  'Save As...': 'Saves the active document with a new name.',
  'Print Preview': 'Displays full pages.',
  'Page Setup...': 'Changes the page layout.',
  'Print...': 'Prints the active document.',
  'Send...': 'Sends a picture by using electronic mail.',
  'Set As Wallpaper (Tiled)': 'Tiles this bitmap as the desktop wallpaper.',
  'Set As Wallpaper (Centered)': 'Centers this bitmap as the desktop wallpaper.',
  Exit: 'Quits Paint.',
  Undo: 'Undoes the last action.',
  Repeat: 'Redoes the previously undone action.',
  Cut: 'Cuts the selection and puts it on the Clipboard.',
  Copy: 'Copies the selection and puts it on the Clipboard.',
  Paste: 'Inserts the contents of the Clipboard.',
  'Clear Selection': 'Deletes the selection.',
  'Select All': 'Selects everything.',
  'Copy To...': 'Copies the selection to a file.',
  'Paste From...': 'Pastes a file into the selection.',
  'Tool Box': 'Shows or hides the tool box.',
  'Color Box': 'Shows or hides the color box.',
  'Status Bar': 'Shows or hides the status bar.',
  Zoom: 'Enlarges the picture.',
  'Normal Size': 'Zooms the picture to 100%.',
  'Large Size': 'Zooms the picture to 400%.',
  'Custom...': 'Zooms the picture.',
  'Show Grid': 'Shows or hides the grid.',
  'Show Thumbnail': 'Shows or hides the thumbnail view of the picture.',
  'View Bitmap': 'Displays the entire picture.',
  'Text Toolbar': 'Shows or hides the text toolbar.',
  'Flip/Rotate...': 'Flips or rotates the picture or a selection.',
  'Stretch/Skew...': 'Stretches or skews the picture or a selection.',
  'Invert Colors': 'Inverts the colors of the picture or a selection.',
  'Attributes...': 'Changes the attributes of the picture.',
  'Clear Image': 'Clears the picture or selection.',
  'Edit Colors...': 'Creates a new color.',
  'Get Colors...': 'Uses a previously saved palette of colors.',
  'Save Colors...': 'Saves the current palette of colors to a file.',
  'Draw Opaque': 'Makes the current selection either opaque or transparent.',
  'Help Topics': 'Lists Help topics.',
  'About Paint': 'Displays program information, version number, and copyright.',
}
const MENU_LABELS = Object.keys(MENU_HELP).sort((a, b) => b.length - a.length)
function menuHelp(text: string): string | null {
  if (/^\d /.test(text)) return 'Opens this document.'
  const label = MENU_LABELS.find((entry) => text.startsWith(entry))
  return label ? (MENU_HELP[label] ?? null) : null
}

type Command = 'new' | 'open' | 'exit'
type Transfer = 'copyTo' | 'pasteFrom' | 'getColors' | 'saveColors'
type PaintDialog =
  | { kind: 'file'; mode: 'open' | 'save'; next: Command | null }
  | { kind: 'confirm'; next: Command }
  | { kind: 'transfer'; purpose: Transfer }
  | { kind: 'enlarge'; piece: Piece }
  | { kind: 'attributes' }
  | { kind: 'rotate' }
  | { kind: 'stretch' }
  | { kind: 'zoom' }
  | { kind: 'colors'; index: number }
  | { kind: 'printer' }
  | { kind: 'about' }
  | { kind: 'message'; title: string; message: string }

function Paint({ window: windowApi, args }: AppProps) {
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: bitmap(NEW_SIZE.width, NEW_SIZE.height),
    future: [],
  }))
  const [saved, setSaved] = useState(history.present)
  const [file, setFile] = useState<NodeId | null>(null)
  const node = useFs((state) => (file ? state.nodes[file] : undefined))
  const fsState = useFs((state) => state)
  const [tool, setTool] = useState<Tool>('pencil')
  const previousTool = useRef<Tool>('pencil')
  const [colors, setColors] = useState({ foreground: '#000000', background: '#ffffff' })
  const [colorBox, setColorBox] = useState<string[]>(defaultPalette)
  const [options, setOptions] = useState<Options>(defaultOptions)
  const [textStyle, setTextStyle] = useState<TextStyle>(defaultTextStyle)
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const [zoom, setZoomLevel] = useState(1)
  const zoomFocus = useRef<Point | null>(null)
  const [panels, setPanels] = useState({
    toolBox: true,
    colorBox: true,
    statusBar: true,
    textToolbar: true,
    grid: false,
    thumbnail: false,
  })
  const [viewBitmap, setViewBitmap] = useState(false)
  const [depth, setDepth] = useState<Depth>(24)
  const [help, setHelp] = useState<string | null>(null)
  const [position, setPosition] = useState<Point | null>(null)
  const [dragSize, setDragSize] = useState<{ width: number; height: number } | null>(null)
  const [dialog, setDialog] = useState<PaintDialog | null>(null)
  const [loading, setLoading] = useState(false)
  const [recent, addRecent] = useRecent()
  const clipboard = useClipboard()
  const scroller = useRef<HTMLDivElement>(null)
  const menuBar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = menuBar.current
    if (!element) return
    const observer = new MutationObserver(() => {
      if (!element.querySelector('[role="menu"]')) setHelp(null)
    })
    observer.observe(element, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  const loadVersion = useRef(0)
  const closeResult = useRef<((closed: boolean) => void) | null>(null)
  const cancelClose = () => {
    setDialog(null)
    closeResult.current?.(false)
    closeResult.current = null
  }
  const image = history.present
  const transparent = options.opaque ? undefined : colors.background
  const shown = useMemo(() => picture(image, marquee, transparent), [image, marquee, transparent])
  const dirty = shown !== saved
  const name = node?.name ?? 'untitled'
  useEffect(() => {
    windowApi.setTitle(`${name} - Paint`)
  }, [name, windowApi.setTitle])
  const error = useCallback((message: string) => setDialog({ kind: 'message', title: 'Paint', message }), [])
  const commit = (next: Bitmap) => setHistory((current) => remember(current, next))
  /** Drops any floating selection into the picture and returns the result. */
  const flatten = (): Bitmap => {
    if (marquee) setMarquee(null)
    if (marquee?.kind === 'floating') commit(shown)
    return shown
  }
  const setZoom = (next: number, focus?: Point) => {
    zoomFocus.current = focus ?? null
    setZoomLevel(next)
  }
  useLayoutEffect(() => {
    const element = scroller.current,
      focus = zoomFocus.current
    if (!element || !focus) return
    zoomFocus.current = null
    element.scrollLeft = focus.x * zoom - element.clientWidth / 2
    element.scrollTop = focus.y * zoom - element.clientHeight / 2
  }, [zoom])
  const chooseTool = (next: Tool) => {
    if (marquee) flatten()
    if (next === 'picker' && tool !== 'picker') previousTool.current = tool
    setTool(next)
  }
  const reset = useCallback((next: Bitmap, id: NodeId | null) => {
    setHistory({ past: [], present: next, future: [] })
    setSaved(next)
    setFile(id)
    setMarquee(null)
    setZoomLevel(1)
  }, [])
  const openFile = useCallback(
    async (id: NodeId) => {
      const current = fs.get().nodes[id]
      if (current?.kind !== 'file') {
        error('This file no longer exists.')
        return
      }
      const version = ++loadVersion.current
      setLoading(true)
      try {
        const next = await decodeBitmap(current.content)
        if (version === loadVersion.current) {
          reset(next, id)
          addRecent(id)
        }
      } catch (cause) {
        if (version === loadVersion.current)
          error(cause instanceof Error ? cause.message : 'Paint cannot read this file.')
      } finally {
        if (version === loadVersion.current) setLoading(false)
      }
    },
    [error, reset, addRecent],
  )
  const initialFile = args.file
  useEffect(() => {
    if (initialFile) void openFile(initialFile)
    return () => {
      loadVersion.current++
    }
  }, [initialFile, openFile])
  const run = (command: Command) => {
    if (command === 'exit') {
      closeResult.current?.(true)
      closeResult.current = null
      windowApi.close()
    } else if (command === 'open') setDialog({ kind: 'file', mode: 'open', next: null })
    else {
      reset(bitmap(image.width, image.height), null)
      setDialog(null)
    }
  }
  const request = (command: Command) => (dirty ? setDialog({ kind: 'confirm', next: command }) : run(command))
  useEffect(() =>
    windowApi.onCloseRequest(
      () =>
        new Promise<boolean>((resolve) => {
          closeResult.current = resolve
          request('exit')
        }),
    ),
  )
  const save = (next: Command | null = null) => {
    if (file && fs.get().nodes[file]?.kind === 'file') {
      const content = quantize(flatten(), depth)
      if (content !== shown) commit(content)
      fs.write(file, encodeBitmap(content))
      setSaved(content)
      addRecent(file)
      setDialog(null)
      if (next) run(next)
    } else setDialog({ kind: 'file', mode: 'save', next })
  }
  const choose = (choice: FileDialogResult, filter?: FileTypeFilter) => {
    if (dialog?.kind !== 'file') return
    if (dialog.mode === 'open') {
      setDialog(null)
      if (choice.kind === 'existing') void openFile(choice.id)
      return
    }
    const chosen = SAVE_TYPES.find((type) => type.label === filter?.label)?.depth ?? depth
    const flat = quantize(flatten(), chosen)
    const content = encodeBitmap(flat)
    let id: NodeId
    if (choice.kind === 'existing') {
      fs.write(choice.id, content)
      id = choice.id
    } else {
      const created = createNode(choice.parent, choice.name, { kind: 'file', content })
      if ('error' in created) {
        error(created.error)
        return
      }
      id = created.id
    }
    setFile(id)
    addRecent(id)
    setDepth(chosen)
    if (flat !== image) commit(flat)
    setSaved(flat)
    setDialog(null)
    if (dialog.next) run(dialog.next)
  }

  const viewOrigin = (): Point => ({
    x: Math.floor((scroller.current?.scrollLeft ?? 0) / zoom),
    y: Math.floor((scroller.current?.scrollTop ?? 0) / zoom),
  })
  const float = (piece: Piece, base: Bitmap) => {
    if (tool !== 'select' && tool !== 'freeSelect') setTool('select')
    setMarquee({ kind: 'floating', base, piece, at: viewOrigin() })
  }
  const pastePiece = (piece: Piece) => {
    const base = flatten()
    if (piece.width > base.width || piece.height > base.height) setDialog({ kind: 'enlarge', piece })
    else float(piece, base)
  }
  const edit = {
    undo() {
      if (marquee?.kind === 'floating') setMarquee(null)
      else {
        setMarquee(null)
        setHistory(undo)
      }
    },
    repeat() {
      setMarquee(null)
      setHistory(repeat)
    },
    copy() {
      if (marquee) copyPiece(pieceOf(image, marquee))
    },
    cut() {
      if (!marquee) return
      copyPiece(pieceOf(image, marquee))
      edit.clear()
    },
    clear() {
      if (!marquee) return
      commit(cleared(image, marquee, colors.background))
      setMarquee(null)
    },
    paste() {
      const piece = clipboardPiece()
      if (piece) pastePiece(piece)
    },
    selectAll() {
      const base = flatten()
      setTool(tool === 'freeSelect' ? 'freeSelect' : 'select')
      setMarquee({ kind: 'region', selection: selectAll(base) })
    },
  }
  /** Image commands change the selection when there is one, and the whole picture otherwise. */
  const change = (whole: (image: Bitmap) => Bitmap, piece: (piece: Piece) => Piece) => {
    if (marquee) setMarquee(reshape(image, marquee, colors.background, piece))
    else commit(whole(image))
  }

  const transfer = (purpose: Transfer, choice: FileDialogResult) => {
    setDialog(null)
    if (purpose === 'pasteFrom' || purpose === 'getColors') {
      const current = choice.kind === 'existing' ? fs.get().nodes[choice.id] : undefined
      if (current?.kind !== 'file') return
      if (purpose === 'getColors') {
        const colorsRead = parsePalette(current.content)
        if (!colorsRead) error('This is not a valid palette file.')
        else
          setColorBox(
            Array.from(
              { length: defaultPalette.length },
              (_, i) => colorsRead[i] ?? defaultPalette[i] ?? '#ffffff',
            ),
          )
        return
      }
      decodeBitmap(current.content).then(pastePiece, (cause) =>
        error(cause instanceof Error ? cause.message : 'Paint cannot read this file.'),
      )
      return
    }
    let content: string
    if (purpose === 'saveColors') content = formatPalette(colorBox)
    else {
      if (!marquee) return
      const piece = pieceOf(image, marquee)
      content = encodeBitmap(
        place(bitmap(piece.width, piece.height, colors.background), piece, { x: 0, y: 0 }),
      )
    }
    if (choice.kind === 'existing') fs.write(choice.id, content)
    else {
      const created = createNode(choice.parent, choice.name, { kind: 'file', content })
      if ('error' in created) error(created.error)
    }
  }

  useKeyDown((event) => {
    if (
      dialog ||
      loading ||
      viewBitmap ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    )
      return
    if (event.key === 'Delete' && marquee) {
      event.preventDefault()
      edit.clear()
      return
    }
    if (event.key === 'F4' && !event.altKey) {
      event.preventDefault()
      edit.repeat()
      return
    }
    if (!event.ctrlKey || event.altKey) return
    const shortcuts: Record<string, () => void> = {
      z: edit.undo,
      y: edit.repeat,
      x: edit.cut,
      c: edit.copy,
      v: edit.paste,
      l: edit.selectAll,
      s: () => save(),
      o: () => request('open'),
      n: () => (event.shiftKey ? clearImage() : request('new')),
      p: () => setDialog({ kind: 'printer' }),
      t: () => setPanels((p) => ({ ...p, toolBox: !p.toolBox })),
      a: () => setPanels((p) => ({ ...p, colorBox: !p.colorBox })),
      f: () => {
        flatten()
        setViewBitmap(true)
      },
      g: () => zoom >= 4 && setPanels((p) => ({ ...p, grid: !p.grid })),
      r: () => setDialog({ kind: 'rotate' }),
      w: () => setDialog({ kind: 'stretch' }),
      i: () => change((whole) => transform(whole, 'invert'), turn('invert')),
      e: () => setDialog({ kind: 'attributes' }),
      pageup: () => setZoom(1),
      pagedown: () => setZoom(4),
    }
    const action = shortcuts[event.key.toLowerCase()]
    if (!action) return
    event.preventDefault()
    action()
  })

  const recentEntries: MenuEntry[] = recent
    .filter((id) => fsState.nodes[id]?.kind === 'file')
    .map((id, index) => ({
      label: `&${index + 1} ${pathOf(fsState, id)}`,
      onSelect: () => (dirty ? setDialog({ kind: 'confirm', next: 'open' }) : void openFile(id)),
    }))
  const clearImage = () => {
    setMarquee(null)
    commit(bitmap(image.width, image.height, colors.background))
  }
  const selected = marquee !== null
  const menus: MenuBarMenu[] = [
    {
      label: '&File',
      items: [
        { label: '&New', shortcut: 'Ctrl+N', onSelect: () => request('new') },
        { label: '&Open...', shortcut: 'Ctrl+O', onSelect: () => request('open') },
        { label: '&Save', shortcut: 'Ctrl+S', onSelect: () => save() },
        { label: 'Save &As...', onSelect: () => setDialog({ kind: 'file', mode: 'save', next: null }) },
        'separator',
        { label: 'Print Pre&view', onSelect: () => setDialog({ kind: 'printer' }) },
        { label: 'Page Se&tup...', onSelect: () => setDialog({ kind: 'printer' }) },
        { label: '&Print...', shortcut: 'Ctrl+P', onSelect: () => setDialog({ kind: 'printer' }) },
        'separator',
        { label: 'S&end...', disabled: true },
        'separator',
        {
          label: 'Set As &Wallpaper (Tiled)',
          onSelect: () =>
            void setPaintWallpaper({ content: encodeBitmap(shown), mode: 'tile', file }).catch((cause) =>
              error(String(cause)),
            ),
        },
        {
          label: 'Set As Wa&llpaper (Centered)',
          onSelect: () =>
            void setPaintWallpaper({ content: encodeBitmap(shown), mode: 'center', file }).catch((cause) =>
              error(String(cause)),
            ),
        },
        'separator',
        ...(recentEntries.length ? recentEntries : [{ label: 'Recent File', disabled: true }]),
        'separator',
        { label: 'E&xit', onSelect: () => request('exit') },
      ],
    },
    {
      label: '&Edit',
      items: [
        {
          label: '&Undo',
          shortcut: 'Ctrl+Z',
          disabled: !history.past.length && marquee?.kind !== 'floating',
          onSelect: edit.undo,
        },
        { label: '&Repeat', shortcut: 'F4', disabled: !history.future.length, onSelect: edit.repeat },
        'separator',
        { label: 'Cu&t', shortcut: 'Ctrl+X', disabled: !selected, onSelect: edit.cut },
        { label: '&Copy', shortcut: 'Ctrl+C', disabled: !selected, onSelect: edit.copy },
        { label: '&Paste', shortcut: 'Ctrl+V', disabled: !clipboard, onSelect: edit.paste },
        { label: 'C&lear Selection', shortcut: 'Del', disabled: !selected, onSelect: edit.clear },
        { label: 'Select &All', shortcut: 'Ctrl+L', onSelect: edit.selectAll },
        'separator',
        {
          label: 'C&opy To...',
          disabled: !selected,
          onSelect: () => setDialog({ kind: 'transfer', purpose: 'copyTo' }),
        },
        { label: 'Paste &From...', onSelect: () => setDialog({ kind: 'transfer', purpose: 'pasteFrom' }) },
      ],
    },
    {
      label: '&View',
      items: [
        {
          label: '&Tool Box',
          shortcut: 'Ctrl+T',
          checked: panels.toolBox,
          onSelect: () => setPanels({ ...panels, toolBox: !panels.toolBox }),
        },
        {
          label: '&Color Box',
          shortcut: 'Ctrl+A',
          checked: panels.colorBox,
          onSelect: () => setPanels({ ...panels, colorBox: !panels.colorBox }),
        },
        {
          label: '&Status Bar',
          checked: panels.statusBar,
          onSelect: () => setPanels({ ...panels, statusBar: !panels.statusBar }),
        },
        'separator',
        {
          label: '&Zoom',
          items: [
            { label: '&Normal Size', shortcut: 'Ctrl+PgUp', checked: zoom === 1, onSelect: () => setZoom(1) },
            { label: '&Large Size', shortcut: 'Ctrl+PgDn', checked: zoom === 4, onSelect: () => setZoom(4) },
            { label: 'C&ustom...', onSelect: () => setDialog({ kind: 'zoom' }) },
            'separator',
            {
              label: 'Show &Grid',
              shortcut: 'Ctrl+G',
              checked: panels.grid,
              disabled: zoom < 4,
              onSelect: () => setPanels({ ...panels, grid: !panels.grid }),
            },
            {
              label: 'Show T&humbnail',
              checked: panels.thumbnail,
              disabled: zoom === 1,
              onSelect: () => setPanels({ ...panels, thumbnail: !panels.thumbnail }),
            },
          ],
        },
        {
          label: '&View Bitmap',
          shortcut: 'Ctrl+F',
          onSelect: () => {
            flatten()
            setViewBitmap(true)
          },
        },
        {
          label: 'Te&xt Toolbar',
          checked: panels.textToolbar,
          onSelect: () => setPanels({ ...panels, textToolbar: !panels.textToolbar }),
        },
      ],
    },
    {
      label: '&Image',
      items: [
        { label: '&Flip/Rotate...', shortcut: 'Ctrl+R', onSelect: () => setDialog({ kind: 'rotate' }) },
        { label: '&Stretch/Skew...', shortcut: 'Ctrl+W', onSelect: () => setDialog({ kind: 'stretch' }) },
        {
          label: '&Invert Colors',
          shortcut: 'Ctrl+I',
          onSelect: () => change((whole) => transform(whole, 'invert'), turn('invert')),
        },
        { label: '&Attributes...', shortcut: 'Ctrl+E', onSelect: () => setDialog({ kind: 'attributes' }) },
        {
          label: '&Clear Image',
          shortcut: 'Ctrl+Shft+N',
          onSelect: clearImage,
        },
      ],
    },
    {
      label: '&Options',
      items: [
        {
          label: '&Edit Colors...',
          onSelect: () =>
            setDialog({ kind: 'colors', index: Math.max(0, colorBox.indexOf(colors.foreground)) }),
        },
        { label: '&Get Colors...', onSelect: () => setDialog({ kind: 'transfer', purpose: 'getColors' }) },
        { label: '&Save Colors...', onSelect: () => setDialog({ kind: 'transfer', purpose: 'saveColors' }) },
        {
          label: '&Draw Opaque',
          checked: options.opaque,
          onSelect: () => setOptions({ ...options, opaque: !options.opaque }),
        },
      ],
    },
    {
      label: '&Help',
      items: [
        { label: '&Help Topics', onSelect: () => launch('help', { book: 'paint' }) },
        'separator',
        { label: '&About Paint', onSelect: () => setDialog({ kind: 'about' }) },
      ],
    },
  ]
  const size = dragSize ?? (marquee ? rectOf(marquee) : null)
  return (
    <div className="relative flex h-full w-full flex-col bg-face">
      <div
        ref={menuBar}
        className="contents"
        onPointerOver={(event) => {
          const item = (event.target as HTMLElement).closest('[role="menuitem"]')
          if (item) setHelp(menuHelp(item.textContent ?? ''))
        }}
        onPointerOut={(event) => {
          if ((event.target as HTMLElement).closest('[role="menuitem"]')) setHelp(null)
        }}
      >
        <MenuBar menus={menus} />
      </div>
      <div className="flex flex-1 min-h-0">
        {panels.toolBox && (
          <ToolBox
            tool={tool}
            options={options}
            zoom={zoom}
            onTool={chooseTool}
            onOptions={setOptions}
            onZoom={(level) => setZoom(level)}
            onHelp={setHelp}
          />
        )}
        <div
          ref={scroller}
          className="relative min-w-0 flex-1 overflow-auto bg-shadow p-[3px] bevel-sunken"
          aria-busy={loading}
        >
          <PaintCanvas
            active={windowApi.focused && !windowApi.minimized && !dialog && !loading && !viewBitmap}
            image={shown}
            marquee={marquee}
            tool={tool}
            colors={colors}
            options={options}
            zoom={zoom}
            grid={panels.grid}
            textStyle={textStyle}
            scroller={scroller}
            onCommit={commit}
            onMarquee={setMarquee}
            onDrop={flatten}
            onZoom={setZoom}
            onColor={(color, background) => {
              setColors({ ...colors, [background ? 'background' : 'foreground']: color })
              setTool(previousTool.current)
            }}
            onPosition={setPosition}
            onSize={setDragSize}
          />
          {loading && (
            <div className="absolute inset-0 bg-face flex items-center justify-center">
              Opening picture...
            </div>
          )}
        </div>
      </div>
      {panels.colorBox && (
        <div className="flex h-[44px] shrink-0 items-center gap-[6px] px-[4px]" data-paint="colorbox">
          <div
            role="img"
            className="relative h-[32px] w-[34px] shrink-0 bevel-sunken dither"
            aria-label={`Foreground ${colors.foreground}, background ${colors.background}`}
          >
            <span
              className="absolute left-[13px] top-[12px] h-[17px] w-[17px] bevel-raised"
              style={{ backgroundColor: colors.background }}
            />
            <span
              className="absolute left-[5px] top-[4px] h-[17px] w-[17px] bevel-raised"
              style={{ backgroundColor: colors.foreground }}
            />
          </div>
          <div className="grid grid-cols-14 gap-px">
            {colorBox.map((color, index) => (
              <button
                type="button"
                // biome-ignore lint/suspicious/noArrayIndexKey: color box slots are positional
                key={index}
                aria-label={`Color ${color}`}
                className="size-[15px] bevel-sunken border border-shadow"
                style={{ backgroundColor: color }}
                onClick={() => setColors({ ...colors, foreground: color })}
                onDoubleClick={() => setDialog({ kind: 'colors', index })}
                onContextMenu={(event) => {
                  event.preventDefault()
                  setColors({ ...colors, background: color })
                }}
              />
            ))}
          </div>
        </div>
      )}
      {panels.statusBar && (
        <StatusBar className="shrink-0">
          <StatusPane className="flex-1">{help ?? IDLE_HELP}</StatusPane>
          <StatusPane className="w-[100px]">{position ? `${position.x},${position.y}` : ''}</StatusPane>
          <StatusPane className="w-[100px]">{size ? `${size.width}x${size.height}` : ''}</StatusPane>
        </StatusBar>
      )}
      {panels.textToolbar && tool === 'text' && (
        <FontsToolbar
          style={textStyle}
          onStyle={setTextStyle}
          onClose={() => setPanels({ ...panels, textToolbar: false })}
        />
      )}
      {panels.thumbnail && zoom > 1 && (
        <Thumbnail
          image={shown}
          zoom={zoom}
          scroller={scroller}
          onClose={() => setPanels({ ...panels, thumbnail: false })}
        />
      )}
      {viewBitmap && <ViewBitmap image={shown} onClose={() => setViewBitmap(false)} />}
      {dialog?.kind === 'file' && (
        <FileDialog
          mode={dialog.mode}
          initialFolder={node?.parent ?? DOCUMENTS_DIR}
          initialName={dialog.mode === 'save' ? (node?.name ?? 'untitled.bmp') : ''}
          filters={
            dialog.mode === 'open'
              ? OPEN_FILTERS
              : [...SAVE_TYPES].sort((a, b) => Number(b.depth === depth) - Number(a.depth === depth))
          }
          defaultExtension="bmp"
          onSelect={choose}
          onCancel={cancelClose}
        />
      )}
      {dialog?.kind === 'transfer' && (
        <FileDialog
          mode={dialog.purpose === 'copyTo' || dialog.purpose === 'saveColors' ? 'save' : 'open'}
          title={
            {
              copyTo: 'Copy To',
              pasteFrom: 'Paste From',
              getColors: 'Get Colors',
              saveColors: 'Save Colors',
            }[dialog.purpose]
          }
          initialFolder={node?.parent ?? DOCUMENTS_DIR}
          initialName={
            dialog.purpose === 'copyTo'
              ? 'untitled.bmp'
              : dialog.purpose === 'saveColors'
                ? 'untitled.pal'
                : ''
          }
          filters={
            dialog.purpose === 'getColors' || dialog.purpose === 'saveColors'
              ? PALETTE_FILTERS
              : dialog.purpose === 'copyTo'
                ? SAVE_TYPES.slice(3)
                : OPEN_FILTERS
          }
          defaultExtension={dialog.purpose === 'getColors' || dialog.purpose === 'saveColors' ? 'pal' : 'bmp'}
          onSelect={(choice) => transfer(dialog.purpose, choice)}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'confirm' && (
        <MessageBox
          title="Paint"
          icon="warning"
          message={`Save changes to ${name}?`}
          buttons={['Yes', 'No', 'Cancel']}
          onClose={(answer) => {
            const next = dialog.next
            setDialog(null)
            if (answer === 'Yes') save(next)
            if (answer === 'No') run(next)
            if (answer === 'Cancel') cancelClose()
          }}
        />
      )}
      {dialog?.kind === 'enlarge' && (
        <MessageBox
          title="Paint"
          icon="question"
          message={
            'The image in the clipboard is larger than the bitmap.\nWould you like the bitmap enlarged?'
          }
          buttons={['Yes', 'No', 'Cancel']}
          onClose={(answer) => {
            const piece = dialog.piece
            setDialog(null)
            if (answer === 'cancel' || answer === 'Cancel') return
            const base =
              answer === 'Yes'
                ? resize(
                    image,
                    Math.max(image.width, piece.width),
                    Math.max(image.height, piece.height),
                    colors.background,
                  )
                : image
            if (base !== image) commit(base)
            float(piece, base)
          }}
        />
      )}
      {dialog?.kind === 'printer' && (
        <MessageBox
          title="Paint"
          icon="question"
          message={NO_PRINTER}
          buttons={['Yes', 'No']}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'message' && (
        <MessageBox title={dialog.title} message={dialog.message} buttons={['OK']} onClose={cancelClose} />
      )}
      {dialog?.kind === 'about' && <AboutDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'attributes' && (
        <AttributesDialog
          width={image.width}
          height={image.height}
          saved={node ? formatSaved(node.modified) : null}
          bytes={node?.kind === 'file' ? new TextEncoder().encode(node.content).length : null}
          monochrome={depth === 1}
          defaults={NEW_SIZE}
          onClose={() => setDialog(null)}
          onApply={(width, height, monochrome) => {
            const base = flatten()
            const sized =
              width === base.width && height === base.height
                ? base
                : resize(base, width, height, colors.background)
            commit(monochrome ? quantize(sized, 1) : sized)
            if (monochrome) setDepth(1)
            else if (depth === 1) setDepth(24)
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'rotate' && (
        <FlipRotateDialog
          onClose={() => setDialog(null)}
          onApply={(kind) => {
            change((whole) => transform(whole, kind), turn(kind))
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'stretch' && (
        <StretchSkewDialog
          onClose={() => setDialog(null)}
          onApply={(scale, slant) => {
            const target = marquee ? rectOf(marquee) : image
            const stretched = {
              width: Math.max(1, Math.round((target.width * scale.horizontal) / 100)),
              height: Math.max(1, Math.round((target.height * scale.vertical) / 100)),
            }
            const final = skewSize(stretched.width, stretched.height, slant.horizontal, slant.vertical)
            if (final.width > 2048 || final.height > 2048) {
              error('The picture would be too large. Choose a smaller stretch or skew.')
              return
            }
            change(
              (whole) =>
                skew(
                  stretch(whole, scale.horizontal, scale.vertical),
                  slant.horizontal,
                  slant.vertical,
                  colors.background,
                ),
              (piece) =>
                skew(stretch(piece, scale.horizontal, scale.vertical), slant.horizontal, slant.vertical),
            )
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'zoom' && (
        <CustomZoomDialog
          zoom={zoom}
          onClose={() => setDialog(null)}
          onApply={(level) => {
            setZoom(level)
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'colors' && (
        <EditColorsDialog
          color={colorBox[dialog.index] ?? colors.foreground}
          onClose={() => setDialog(null)}
          onApply={(color) => {
            setColorBox(colorBox.map((entry, index) => (index === dialog.index ? color : entry)))
            setColors({ ...colors, foreground: color })
            setDialog(null)
          }}
        />
      )}
    </div>
  )
}

const formatSaved = (at: number) =>
  new Date(at)
    .toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
    })
    .replace(',', '')

/** View Bitmap: the picture alone on the screen until a click or a key. */
function ViewBitmap({ image, onClose }: { image: Bitmap; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvas.current) drawBitmap(canvas.current, image)
    const close = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', close, true)
    return () => document.removeEventListener('keydown', close, true)
  }, [image, onClose])
  return createPortal(
    <div
      role="presentation"
      data-paint="view-bitmap"
      className="fixed inset-0 z-[20000] bg-shadow"
      onPointerDown={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <canvas ref={canvas} aria-label="View Bitmap" className="block pixelated" />
    </div>,
    document.body,
  )
}

export const app: AppManifest = {
  id: 'paint',
  title: 'Paint',
  icon: paintIcon,
  exe: 'MSPAINT.EXE',
  startMenu: ['Accessories'],
  fileTypes: ['bmp', 'dib'],
  window: { kind: 'resizable', width: 520, height: 400, minWidth: 360, minHeight: 300 },
  component: Paint,
}
