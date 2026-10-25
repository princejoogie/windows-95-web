import type { AppManifest, AppProps } from '../../shell/types'
import { MessageBox } from '../../ui'
import { FolderView } from '../explorer/FolderView'
import { registerShellFolder } from '../explorer/shellFolders'
import { entireNetworkIcon, networkIcon, networkSmallIcon } from './art'

function NetworkDialog({ id, onClose }: { id: string; onClose: () => void }) {
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
  fileCommands: [
    { label: '&Explore', action: { kind: 'dialog', id: 'browse' } },
    { label: '&Find Computer...', action: { kind: 'dialog', id: 'find' } },
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

function NetworkNeighborhood({ window }: AppProps) {
  return <FolderView initial={{ kind: 'shell', id: 'network' }} window={window} />
}

export const app: AppManifest = {
  id: 'network',
  title: 'Network Neighborhood',
  icon: networkIcon,
  smallIcon: networkSmallIcon,
  exe: 'NETHOOD.EXE',
  installDir: 'C:\\WINDOWS',
  desktop: { order: 1 },
  window: { kind: 'resizable', width: 420, height: 300, minWidth: 240, minHeight: 180 },
  component: NetworkNeighborhood,
}
