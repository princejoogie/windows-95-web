import { useState } from 'react'
import { pixelArt } from '../../icons/pixel'
import { Button, Dialog, MessageBox } from '../../ui'
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

const fonts = [
  { name: 'Arial', family: 'Arial, sans-serif', file: 'ARIAL.TTF', size: '65,472', trueType: true },
  {
    name: 'Courier New',
    family: '"Courier New", monospace',
    file: 'COUR.TTF',
    size: '87,424',
    trueType: true,
  },
  {
    name: 'Fixedsys',
    family: '"Fixedsys Bitmap", monospace',
    file: 'VGAFIX.FON',
    size: '5,168',
    trueType: false,
  },
  {
    name: 'MS Sans Serif',
    family: '"MS Sans Serif Bitmap", sans-serif',
    file: 'SSERIFE.FON',
    size: '64,560',
    trueType: false,
  },
  {
    name: 'Times New Roman',
    family: '"Times New Roman", serif',
    file: 'TIMES.TTF',
    size: '83,584',
    trueType: true,
  },
]

function FontSample({ id, onClose }: { id: string; onClose: () => void }) {
  const font = fonts.find((item) => item.file === id)
  const [printing, setPrinting] = useState(false)
  if (!font) return null
  return (
    <>
      <Dialog title={`${font.name} (${font.trueType ? 'TrueType' : 'VGA res'})`} onClose={onClose}>
        <div className="w-[510px] p-2">
          <div className="flex justify-between mb-2">
            <Button onClick={onClose} isDefault>
              Done
            </Button>
            <Button onClick={() => setPrinting(true)}>Print</Button>
          </div>
          <div className="bg-white bevel-sunken p-2 h-[360px] overflow-auto">
            <p>Font name: {font.name}</p>
            <p>File size: {font.size} bytes</p>
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

registerShellFolder({
  id: 'fonts',
  title: 'Fonts',
  parent: { kind: 'shell', id: 'controlpanel' },
  countNoun: 'font',
  Dialog: FontSample,
  viewCommands: ['List Fonts By &Similarity', '&Hide Variations'],
  items: fonts.map((font) => ({
    key: font.file,
    label: font.name,
    icon: fontIcon(font.trueType),
    help: `${font.name} (${font.trueType ? 'TrueType' : 'VGA res'})`,
    action: { kind: 'dialog', id: font.file },
  })),
})
