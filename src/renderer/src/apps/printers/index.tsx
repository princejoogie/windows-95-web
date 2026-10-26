import { useState } from 'react'
import { pixelArt } from '../../icons/pixel'
import type { AppManifest, AppProps } from '../../shell/types'
import { Radio } from '../../ui'
import { Wizard } from '../controlpanel/Wizard'
import { printerIcon } from '../explorer/art'
import { FolderView } from '../explorer/FolderView'
import { registerShellFolder, shellFolder } from '../explorer/shellFolders'

const addPrinterIcon = pixelArt(
  [
    '................',
    '...kkkkkkkk.....',
    '...kwwwwwwk..y..',
    '...kwwwwwwk.yyy.',
    '...kwwwwwwk..y..',
    '.kkkkkkkkkkkk...',
    '.ksssssssssskw..',
    '.ksggggggggskw..',
    '.ksgggggglgskw..',
    '.ksssssssssskw..',
    '.kkkkkkkkkkkkw..',
    '..kwwwwwwkw.....',
    '..kwwwwwwkw.....',
    '..kkkkkkkkw.....',
    '................',
    '................',
  ].flatMap((row) => {
    const scaled = [...row].map((p) => p + p).join('')
    return [scaled, scaled]
  }),
)

export function AddPrinterWizard({ onClose }: { onClose: () => void }) {
  const [local, setLocal] = useState(true)
  return (
    <Wizard
      title="Add Printer Wizard"
      onClose={onClose}
      pages={[
        <div key="welcome">
          <p>This wizard will help you install a printer.</p>
          <p className="mt-5">To begin installing your printer, click Next.</p>
        </div>,
        <div key="kind">
          <p>How is this printer attached to your computer?</p>
          <div className="flex flex-col gap-4 mt-6">
            <Radio
              name="printer-kind"
              label="Local printer"
              checked={local}
              onChange={() => setLocal(true)}
            />
            <Radio
              name="printer-kind"
              label="Network printer"
              checked={!local}
              onChange={() => setLocal(false)}
            />
          </div>
        </div>,
        <div key="ports">
          <p>
            {local
              ? 'No printer ports are available on this computer.'
              : 'No network printers are available on this computer.'}
          </p>
          <p className="mt-5">Setup cannot install a printer. No printers have been installed.</p>
          <p className="mt-5">Click Finish to close this wizard.</p>
        </div>,
      ]}
    />
  )
}

registerShellFolder({
  id: 'printers',
  title: 'Printers',
  parent: { kind: 'computer' },
  Dialog: AddPrinterWizard,
  items: [
    {
      key: 'add-printer',
      label: 'Add Printer',
      icon: addPrinterIcon,
      help: 'Installs a new printer.',
      action: { kind: 'dialog', id: 'add' },
    },
  ],
})

function Printers({ window, args }: AppProps) {
  const target = args.shellTarget
  const item =
    target?.kind === 'item'
      ? shellFolder('printers')?.items.find((item) => item.key === target.item)
      : undefined
  return (
    <FolderView
      initial={{ kind: 'shell', id: 'printers' }}
      initialDialog={item?.action.kind === 'dialog' ? item.action.id : undefined}
      window={window}
    />
  )
}

export const app: AppManifest = {
  id: 'printers',
  title: 'Printers',
  icon: printerIcon,
  exe: 'PRINTERS.EXE',
  window: { kind: 'resizable', width: 420, height: 300, minWidth: 240, minHeight: 180 },
  component: Printers,
}
