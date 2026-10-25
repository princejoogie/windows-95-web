import { useCallback, useEffect, useRef, useState } from 'react'
import { createNode, fs, useFs } from '../../fs/store'
import { DOCUMENTS_DIR, type NodeId } from '../../fs/types'
import { useKeyDown } from '../../shell/context'
import type { AppManifest, AppProps } from '../../shell/types'
import {
  Button,
  FileDialog,
  type FileDialogResult,
  MenuBar,
  MessageBox,
  StatusBar,
  StatusPane,
} from '../../ui'
import {
  type Bitmap,
  type Brush,
  bitmap,
  type FillMode,
  type History,
  type Ink,
  type Point,
  remember,
  repeat,
  resize,
  transform,
  undo,
} from './bitmap'
import { decodeBitmap, drawBitmap, encodeBitmap, PaintCanvas } from './Canvas'
import { AttributesDialog, RotateDialog, TextDialog } from './dialogs'
import { paintIcon, palette, type Tool, tools } from './tools'

type Command = 'new' | 'open' | 'exit'
type PaintDialog =
  | { kind: 'file'; mode: 'open' | 'save'; next: Command | null }
  | { kind: 'confirm'; next: Command }
  | { kind: 'attributes' }
  | { kind: 'rotate' }
  | { kind: 'text'; at: Point }
  | { kind: 'message'; title: string; message: string }

function Paint({ window: windowApi, args }: AppProps) {
  const [history, setHistory] = useState<History>(() => ({ past: [], present: bitmap(440, 280), future: [] }))
  const [saved, setSaved] = useState(history.present)
  const [file, setFile] = useState<NodeId | null>(null)
  const node = useFs((state) => (file ? state.nodes[file] : undefined))
  const [tool, setTool] = useState<Tool>('pencil')
  const [ink, setInk] = useState<Ink>({
    foreground: '#000000',
    background: '#ffffff',
    width: 3,
    brush: 'round',
    fill: 'outline',
  })
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 })
  const [dialog, setDialog] = useState<PaintDialog | null>(null)
  const [loading, setLoading] = useState(false)
  const loadVersion = useRef(0)
  const image = history.present
  const dirty = image !== saved
  const name = node?.name ?? 'untitled'
  useEffect(() => {
    windowApi.setTitle(`${name} - Paint`)
  }, [name, windowApi.setTitle])
  const error = useCallback((message: string) => setDialog({ kind: 'message', title: 'Paint', message }), [])
  const commit = (next: Bitmap) => setHistory((current) => remember(current, next))
  const reset = useCallback((next: Bitmap, id: NodeId | null) => {
    setHistory({ past: [], present: next, future: [] })
    setSaved(next)
    setFile(id)
    setZoom(1)
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
        if (version === loadVersion.current) reset(next, id)
      } catch (cause) {
        if (version === loadVersion.current)
          error(cause instanceof Error ? cause.message : 'Paint cannot read this file.')
      } finally {
        if (version === loadVersion.current) setLoading(false)
      }
    },
    [error, reset],
  )
  const initialFile = args.file
  useEffect(() => {
    if (initialFile) void openFile(initialFile)
    return () => {
      loadVersion.current++
    }
  }, [initialFile, openFile])
  const run = (command: Command) => {
    if (command === 'exit') windowApi.close()
    else if (command === 'open') setDialog({ kind: 'file', mode: 'open', next: null })
    else {
      reset(bitmap(image.width, image.height), null)
      setDialog(null)
    }
  }
  const request = (command: Command) => (dirty ? setDialog({ kind: 'confirm', next: command }) : run(command))
  const save = (next: Command | null = null) => {
    if (file && fs.get().nodes[file]?.kind === 'file') {
      fs.write(file, encodeBitmap(image))
      setSaved(image)
      setDialog(null)
      if (next) run(next)
    } else setDialog({ kind: 'file', mode: 'save', next })
  }
  const choose = (choice: FileDialogResult) => {
    if (dialog?.kind !== 'file') return
    if (dialog.mode === 'open') {
      setDialog(null)
      if (choice.kind === 'existing') void openFile(choice.id)
      return
    }
    const content = encodeBitmap(image)
    if (choice.kind === 'existing') {
      fs.write(choice.id, content)
      setFile(choice.id)
    } else {
      const created = createNode(choice.parent, choice.name, { kind: 'file', content })
      if ('error' in created) {
        error(created.error)
        return
      }
      setFile(created.id)
    }
    setSaved(image)
    setDialog(null)
    if (dialog.next) run(dialog.next)
  }
  useKeyDown((event) => {
    if (
      dialog ||
      loading ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    )
      return
    if (!event.ctrlKey || event.altKey) return
    switch (event.key.toLowerCase()) {
      case 'z':
        event.preventDefault()
        setHistory(undo)
        break
      case 'y':
        event.preventDefault()
        setHistory(repeat)
        break
      case 's':
        event.preventDefault()
        save()
        break
      case 'o':
        event.preventDefault()
        request('open')
        break
      case 'n':
        event.preventDefault()
        request('new')
        break
    }
  })
  const shapeTool = tool === 'rectangle' || tool === 'ellipse' || tool === 'rounded'
  return (
    <div className="flex h-full w-full flex-col bg-face">
      <MenuBar
        menus={[
          {
            label: '&File',
            items: [
              { label: '&New', shortcut: 'Ctrl+N', onSelect: () => request('new') },
              { label: '&Open...', shortcut: 'Ctrl+O', onSelect: () => request('open') },
              { label: '&Save', shortcut: 'Ctrl+S', onSelect: () => save() },
              { label: 'Save &As...', onSelect: () => setDialog({ kind: 'file', mode: 'save', next: null }) },
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
                disabled: !history.past.length,
                onSelect: () => setHistory(undo),
              },
              {
                label: '&Repeat',
                shortcut: 'Ctrl+Y',
                disabled: !history.future.length,
                onSelect: () => setHistory(repeat),
              },
            ],
          },
          {
            label: '&View',
            items: [
              { label: '&Normal Size', checked: zoom === 1, onSelect: () => setZoom(1) },
              { label: '&Large Size', checked: zoom === 4, onSelect: () => setZoom(4) },
            ],
          },
          {
            label: '&Image',
            items: [
              { label: '&Flip/Rotate...', onSelect: () => setDialog({ kind: 'rotate' }) },
              { label: '&Invert Colors', onSelect: () => commit(transform(image, 'invert')) },
              { label: '&Attributes...', onSelect: () => setDialog({ kind: 'attributes' }) },
              {
                label: '&Clear Image',
                onSelect: () => commit(bitmap(image.width, image.height, ink.background)),
              },
            ],
          },
          {
            label: '&Help',
            items: [
              {
                label: '&About Paint',
                onSelect: () =>
                  setDialog({ kind: 'message', title: 'About Paint', message: 'Paint\nWindows 95' }),
              },
            ],
          },
        ]}
      />
      <div className="flex flex-1 min-h-0 border-t border-shadow">
        <div className="w-[58px] shrink-0 px-[3px] py-[3px] border-r border-shadow">
          <div className="grid grid-cols-2">
            {tools.map((entry) => (
              <Button
                key={entry.id}
                title={entry.label}
                aria-label={entry.label}
                aria-pressed={tool === entry.id}
                pressed={tool === entry.id}
                className="min-w-0! w-[25px]! h-[25px]! p-0!"
                onClick={() => setTool(entry.id)}
              >
                <img src={entry.icon} alt="" className="mx-auto size-4" />
              </Button>
            ))}
          </div>
          <div className="bevel-sunken mt-[5px] flex flex-col gap-[3px] p-[4px]">
            {tool === 'zoom' ? (
              [1, 2, 4, 8].map((value) => (
                <Button
                  key={value}
                  aria-label={`${value}x zoom`}
                  pressed={zoom === value}
                  className="min-w-0! px-0! h-[19px]!"
                  onClick={() => setZoom(value)}
                >
                  {value}x
                </Button>
              ))
            ) : (
              <>
                {[1, 3, 5, 8].map((width) => (
                  <Button
                    key={width}
                    aria-label={`Width ${width}`}
                    title={`Width ${width}`}
                    pressed={ink.width === width}
                    className="min-w-0! px-[3px]! h-[14px]!"
                    onClick={() => setInk({ ...ink, width })}
                  >
                    <span className="block bg-black" style={{ height: Math.min(width, 7) }} />
                  </Button>
                ))}
                {tool === 'brush' &&
                  (['round', 'square', 'diagonal'] satisfies Brush[]).map((brush) => (
                    <Button
                      key={brush}
                      aria-label={`${brush} brush`}
                      title={`${brush} brush`}
                      pressed={ink.brush === brush}
                      className="min-w-0! h-[18px]! px-0!"
                      onClick={() => setInk({ ...ink, brush })}
                    >
                      {brush === 'round' ? '●' : brush === 'square' ? '■' : '/'}
                    </Button>
                  ))}
                {shapeTool &&
                  (['outline', 'both', 'solid'] satisfies FillMode[]).map((fill) => (
                    <Button
                      key={fill}
                      aria-label={`${fill} shape`}
                      title={`${fill} shape`}
                      pressed={ink.fill === fill}
                      className="min-w-0! px-[5px]! h-[19px]!"
                      onClick={() => setInk({ ...ink, fill })}
                    >
                      <span
                        className="block h-[10px]"
                        style={{
                          border: fill === 'solid' ? 'none' : '1px solid black',
                          background:
                            fill === 'solid' ? 'black' : fill === 'both' ? ink.background : 'transparent',
                        }}
                      />
                    </Button>
                  ))}
              </>
            )}
          </div>
        </div>
        <div className="relative min-w-0 flex-1 overflow-auto bg-shadow p-[3px]" aria-busy={loading}>
          <PaintCanvas
            active={windowApi.focused && !windowApi.minimized && !dialog && !loading}
            image={image}
            tool={tool}
            ink={ink}
            zoom={zoom}
            onCommit={commit}
            onZoom={setZoom}
            onColor={(color, background) =>
              setInk({ ...ink, [background ? 'background' : 'foreground']: color })
            }
            onPosition={setPosition}
            onText={(at) => setDialog({ kind: 'text', at })}
          />
          {loading && (
            <div className="absolute inset-0 bg-face flex items-center justify-center">
              Opening picture...
            </div>
          )}
        </div>
      </div>
      <div className="flex h-[44px] shrink-0 items-center gap-[6px] border-t border-light px-[4px]">
        <div
          role="img"
          className="relative h-[32px] w-[34px] shrink-0 bevel-sunken dither"
          aria-label={`Foreground ${ink.foreground}, background ${ink.background}`}
        >
          <span
            className="absolute left-[13px] top-[12px] h-[17px] w-[17px] bevel-raised"
            style={{ backgroundColor: ink.background }}
          />
          <span
            className="absolute left-[5px] top-[4px] h-[17px] w-[17px] bevel-raised"
            style={{ backgroundColor: ink.foreground }}
          />
        </div>
        <div className="grid grid-cols-14 gap-px">
          {palette.map((color) => (
            <button
              type="button"
              key={color}
              title={color}
              aria-label={`Color ${color}`}
              className="size-[15px] bevel-sunken border border-shadow"
              style={{ backgroundColor: color }}
              onClick={() => setInk({ ...ink, foreground: color })}
              onContextMenu={(event) => {
                event.preventDefault()
                setInk({ ...ink, background: color })
              }}
            />
          ))}
        </div>
      </div>
      <StatusBar className="shrink-0">
        <StatusPane className="flex-1">{tools.find((entry) => entry.id === tool)?.label}</StatusPane>
        <StatusPane className="w-[100px]">
          {position.x}, {position.y}
        </StatusPane>
        <StatusPane className="w-[100px]">
          {image.width} x {image.height}
        </StatusPane>
      </StatusBar>
      {dialog?.kind === 'file' && (
        <FileDialog
          mode={dialog.mode}
          initialFolder={node?.parent ?? DOCUMENTS_DIR}
          initialName={dialog.mode === 'save' ? (node?.name ?? 'untitled.bmp') : ''}
          filters={[{ label: 'Bitmap Files (*.bmp)', extensions: ['bmp'] }]}
          defaultExtension="bmp"
          onSelect={choose}
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
          }}
        />
      )}
      {dialog?.kind === 'message' && (
        <MessageBox
          title={dialog.title}
          message={dialog.message}
          buttons={['OK']}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'attributes' && (
        <AttributesDialog
          image={image}
          onClose={() => setDialog(null)}
          onApply={(width, height) => {
            if (
              !Number.isInteger(width) ||
              !Number.isInteger(height) ||
              width < 1 ||
              height < 1 ||
              width > 2048 ||
              height > 2048
            )
              return
            commit(resize(image, width, height, ink.background))
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'rotate' && (
        <RotateDialog
          onClose={() => setDialog(null)}
          onApply={(kind) => {
            commit(transform(image, kind))
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'text' && (
        <TextDialog
          onClose={() => setDialog(null)}
          onApply={(text, size) => {
            const canvas = document.createElement('canvas')
            drawBitmap(canvas, image)
            const context = canvas.getContext('2d')
            if (context && text) {
              context.font = `${size}px "MS Sans Serif"`
              context.fillStyle = ink.foreground
              context.textBaseline = 'top'
              text.split('\n').forEach((line, index) => {
                context.fillText(line, dialog.at.x, dialog.at.y + index * (size + 2))
              })
              commit({
                width: image.width,
                height: image.height,
                pixels: context.getImageData(0, 0, image.width, image.height).data,
              })
            }
            setDialog(null)
          }}
        />
      )}
    </div>
  )
}

export const app: AppManifest = {
  id: 'paint',
  title: 'Paint',
  icon: paintIcon,
  exe: 'MSPAINT.EXE',
  startMenu: ['Accessories'],
  fileTypes: ['bmp'],
  window: { kind: 'resizable', width: 520, height: 400, minWidth: 360, minHeight: 300 },
  component: Paint,
}
