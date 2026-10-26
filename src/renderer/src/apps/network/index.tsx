import { useId, useState } from 'react'
import type { AppManifest, AppProps } from '../../shell/types'
import { Button, Checkbox, ComboBox, Dialog, MessageBox, TextBox } from '../../ui'
import { NetworkProperties } from '../controlpanel/NetworkProperties'
import { FolderView } from '../explorer/FolderView'
import { registerShellFolder, shellFolder } from '../explorer/shellFolders'
import { entireNetworkIcon, networkIcon, networkSmallIcon } from './art'

function NetworkDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const field = useId()
  const [failed, setFailed] = useState(false)
  if (id === 'properties') return <NetworkProperties onClose={onClose} />
  if (id === 'map')
    return (
      <>
        <Dialog title="Map Network Drive" onClose={onClose}>
          <form
            className="p-3 w-[350px]"
            onSubmit={(event) => {
              event.preventDefault()
              setFailed(true)
            }}
          >
            {id === 'map' && (
              <label htmlFor={`${field}-drive`} className="flex gap-3 items-center mb-3">
                Drive:
                <ComboBox
                  aria-label="Network drive"
                  id={`${field}-drive`}
                  value="Z:"
                  onChange={() => {}}
                  options={[{ key: 'Z:', label: 'Z:' }]}
                />
              </label>
            )}
            <label htmlFor={`${field}-name`} className="flex gap-3 items-center">
              Path:
              <TextBox id={`${field}-name`} aria-label="Network path" className="flex-1" />
            </label>
            {id === 'map' && <Checkbox label="Reconnect at logon" className="mt-4" defaultChecked />}
            <div className="flex justify-end gap-2 mt-4">
              <Button type="submit" isDefault>
                OK
              </Button>
              <Button onClick={onClose}>Cancel</Button>
            </div>
          </form>
        </Dialog>
        {failed && (
          <MessageBox
            title="Map Network Drive"
            icon="error"
            message="The network is not accessible."
            buttons={['OK']}
            onClose={() => setFailed(false)}
          />
        )}
      </>
    )
  return (
    <MessageBox
      title="Network Neighborhood"
      icon="error"
      message={
        id === 'browse'
          ? "Unable to browse the network.\n\nThe network is not accessible. For more information, look in the Help Index at the topic 'Network Troubleshooter'."
          : 'The network is not accessible.'
      }
      buttons={['OK']}
      onClose={onClose}
    />
  )
}

registerShellFolder({
  id: 'network',
  title: 'Network Neighborhood',
  parent: { kind: 'computer' },
  Dialog: NetworkDialog,
  properties: { kind: 'dialog', id: 'properties' },
  fileMutations: false,
  contextCommands: [
    { label: '&Explore', action: { kind: 'dialog', id: 'browse' } },
    { label: '&Find Computer...', action: { kind: 'app', id: 'findcomputer' } },
  ],
  fileCommands: [
    { label: '&Explore', action: { kind: 'dialog', id: 'browse' } },
    { label: '&Find Computer...', action: { kind: 'app', id: 'findcomputer' } },
    'separator',
    { label: '&Map Network Drive...', action: { kind: 'dialog', id: 'map' } },
    { label: '&Disconnect Network Drive...', action: { kind: 'dialog', id: 'disconnect' } },
  ],
  items: [
    {
      key: 'entire-network',
      label: 'Entire Network',
      icon: entireNetworkIcon,
      help: 'Displays the entire network.',
      action: { kind: 'dialog', id: 'browse' },
    },
  ],
})

function NetworkNeighborhood({ window, args }: AppProps) {
  const target = args.shellTarget
  const item =
    target?.kind === 'item'
      ? shellFolder('network')?.items.find((item) => item.key === target.item)
      : undefined
  return (
    <FolderView
      initial={{ kind: 'shell', id: 'network' }}
      initialDialog={item?.action.kind === 'dialog' ? item.action.id : undefined}
      window={window}
    />
  )
}

export const app: AppManifest = {
  id: 'network',
  title: 'Network Neighborhood',
  icon: networkIcon,
  smallIcon: networkSmallIcon,
  exe: 'NETHOOD.EXE',
  installDir: 'C:\\WINDOWS',
  desktop: { order: 1, Properties: NetworkProperties },
  window: { kind: 'resizable', width: 420, height: 300, minWidth: 240, minHeight: 180 },
  component: NetworkNeighborhood,
}
