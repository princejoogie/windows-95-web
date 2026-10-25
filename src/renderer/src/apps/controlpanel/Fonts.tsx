import { useState } from 'react'
import { ensureFonts, fontCatalog, fontMedia, installFont, useFonts } from '../../fonts/catalog'
import { children, pathOf } from '../../fs/fs'
import { useFs } from '../../fs/store'
import { type NodeId, ROOT, WINDOWS_DIR } from '../../fs/types'
import { pixelArt } from '../../icons/pixel'
import { Button, Checkbox, ComboBox, Dialog, ListBox, MessageBox } from '../../ui'
import { registerShellFolder } from '../explorer/shellFolders'

const fontIcon = (trueType: boolean) =>
  pixelArt(
    [
      '....kkkkkkkkk...',
      '....kwwwwwwwkk..',
      '....kwwwwwwwkwk.',
      '....kwwwwwwwkkk.',
      '....kwwwwwwwwwk.',
      '....kwwwwwwwwwk.',
      ...(trueType
        ? [
            '.BBBBBBBwwBBBwk.',
            '....BwwwBwwBwwk.',
            '....BwwwwBwBwwk.',
            '....BwwwwwBBwwk.',
            '....BwwwwwBBwwk.',
            '....BwwwwwwBwwk.',
          ]
        : [
            '....kwwBBwwwwwk.',
            '....kwBwwBwwwwk.',
            '....kwBBBBwwwwk.',
            '....kwBwwBwwwwk.',
            '....kwBwwBwwwwk.',
            '....kwwwwwwwwwk.',
          ]),
      '....kwwwwwwwwwk.',
      '....kwwwwwwwwwk.',
      '....kkkkkkkkkkk.',
      '................',
    ].flatMap((row) => {
      const line = [...row].map((p) => p + p).join('')
      return [line, line]
    }),
  )

function AddFonts({ onClose }: { onClose: () => void }) {
  const state = useFs((state) => state)
  const [folder, setFolder] = useState<NodeId>(WINDOWS_DIR)
  const [drive, setDrive] = useState('C:')
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [copy, setCopy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const available =
    drive === 'C:'
      ? [
          ...(folder === WINDOWS_DIR
            ? fontMedia.map((font) => ({
                key: `media:${font.id}`,
                file: font.file,
                source: { kind: 'bundled' as const, id: font.id },
              }))
            : []),
          ...children(state, folder).flatMap((node) =>
            node.kind === 'file' && /\.(ttf|otf|fon)$/i.test(node.name)
              ? [{ key: node.id, file: node.name, source: { kind: 'link' as const, node: node.id } }]
              : [],
          ),
        ]
      : []
  const folders = children(state, folder).filter((node) => node.kind === 'folder')
  const install = async () => {
    setBusy(true)
    try {
      for (const file of available.filter((file) => selected.has(file.key)))
        await installFont({ file: file.file, source: file.source, copy })
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The font could not be installed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Dialog title="Add Fonts" onClose={onClose}>
        <div className="p-3 w-[440px]">
          <p className="mb-1">List of fonts:</p>
          <div
            role="listbox"
            aria-label="Font files"
            aria-multiselectable="true"
            className="bevel-sunken bg-white h-[116px] overflow-auto p-[2px]"
          >
            {available.map((file) => (
              <button
                key={file.key}
                type="button"
                role="option"
                aria-selected={selected.has(file.key)}
                className={`block w-full text-left px-1 ${selected.has(file.key) ? 'bg-select text-white' : ''}`}
                onClick={() =>
                  setSelected((before) => {
                    const next = new Set(before)
                    if (next.has(file.key)) next.delete(file.key)
                    else next.add(file.key)
                    return next
                  })
                }
              >
                {file.file}
              </button>
            ))}
            {!available.length && (
              <p className="p-1">
                {drive === 'C:'
                  ? 'No font files were found in this folder.'
                  : 'The device is not ready. No installation media is available.'}
              </p>
            )}
          </div>
          <div className="flex justify-end mt-2">
            <Button
              onClick={() => setSelected(new Set(available.map((file) => file.key)))}
              disabled={busy || !available.length}
            >
              Select All
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <p>Folders:</p>
              <p className="truncate my-1">{drive === 'C:' ? pathOf(state, folder) : `${drive}\\`}</p>
              <ListBox
                label="Font folders"
                items={
                  drive === 'C:'
                    ? [state.nodes[folder]?.parent ?? folder, ...folders.map((node) => node.id)]
                    : []
                }
                value={null}
                onChange={(id) => {
                  setFolder(id)
                  setSelected(new Set())
                }}
                render={(id) =>
                  id === state.nodes[folder]?.parent || id === folder ? '..' : (state.nodes[id]?.name ?? '')
                }
                className="h-[100px]"
              />
            </div>
            <div>
              <p className="mb-1">Drives:</p>
              <ComboBox
                aria-label="Font drive"
                value={drive}
                options={['A:', 'C:', 'D:'].map((key) => ({
                  key,
                  label: key === 'C:' ? 'C: Local Disk' : key === 'A:' ? 'A: Floppy' : 'D: CD-ROM',
                }))}
                onChange={(value) => {
                  setDrive(value)
                  setFolder(ROOT)
                  setSelected(new Set())
                }}
              />
              <p className="mt-3">Select a folder containing TrueType or OpenType font files.</p>
            </div>
          </div>
          <Checkbox
            label="Copy fonts to Fonts folder"
            checked={copy}
            onChange={(event) => setCopy(event.target.checked)}
            className="mt-3"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button isDefault disabled={busy || !selected.size} onClick={() => void install()}>
              OK
            </Button>
            <Button disabled={busy} onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
      {error && (
        <MessageBox
          title="Add Fonts"
          icon="error"
          message={error}
          buttons={['OK']}
          onClose={() => setError(null)}
        />
      )}
    </>
  )
}

function FontSample({ id, onClose }: { id: string; onClose: () => void }) {
  const fonts = useFonts()
  const font = fonts.find((item) => item.id === id)
  const [printing, setPrinting] = useState(false)
  if (id === 'install') return <AddFonts onClose={onClose} />
  if (!font) return null
  return (
    <>
      <Dialog title={`${font.name} (${font.format})`} onClose={onClose}>
        <div className="w-[510px] p-2">
          <div className="flex justify-between mb-2">
            <Button onClick={onClose} isDefault>
              Done
            </Button>
            <Button onClick={() => setPrinting(true)}>Print</Button>
          </div>
          <div className="bg-white bevel-sunken p-2 h-[360px] overflow-auto">
            <p>Font name: {font.name}</p>
            <p>File size: {font.byteLength.toLocaleString('en-US')} bytes</p>
            <p>Filename: {font.file}</p>
            <hr className="my-2" />
            <div style={{ fontFamily: font.family }}>
              <p>abcdefghijklmnopqrstuvwxyz</p>
              <p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
              <p>1234567890 !@#$%^&amp;*()</p>
              {[12, 18, 24, 36, 48, 60, 72].map((size) => (
                <div key={size} className="flex gap-2 whitespace-nowrap items-baseline">
                  <span className="text-[11px] w-4 shrink-0">{size}</span>
                  <span style={{ fontSize: `${size}pt` }}>The quick brown fox jumps over the lazy dog.</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Dialog>
      {printing && (
        <MessageBox
          title="Fonts"
          message="No printers are installed. Open the Printers folder to add a printer."
          buttons={['OK']}
          onClose={() => setPrinting(false)}
        />
      )}
    </>
  )
}

const updateFonts = () =>
  registerShellFolder({
    id: 'fonts',
    title: 'Fonts',
    parent: { kind: 'shell', id: 'controlpanel' },
    countNoun: 'font',
    Dialog: FontSample,
    fileCommands: [{ label: '&Install New Font...', action: { kind: 'dialog', id: 'install' } }],
    viewCommands: ['List Fonts By &Similarity', '&Hide Variations'],
    items: fontCatalog.get().map((font) => ({
      key: font.id,
      label: font.name,
      icon: fontIcon(true),
      help: `${font.name} (${font.format})`,
      action: { kind: 'dialog', id: font.id },
    })),
  })
updateFonts()
fontCatalog.subscribe(updateFonts)
void ensureFonts()
