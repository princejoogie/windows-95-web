import { useEffect, useState } from 'react'
import type { AppManifest, AppProps } from '../../shell/types'
import { MenuBar, MessageBox, StatusBar, StatusPane } from '../../ui'
import '../explorer/explorer.css'
import { entireNetworkIcon, networkIcon, networkSmallIcon } from './art'

type Place = 'neighborhood' | 'entire'

const TITLES: Record<Place, string> = { neighborhood: 'Network Neighborhood', entire: 'Entire Network' }

/**
 * Network Neighborhood. This computer has no network, so the only thing in it is Entire Network, and that
 * folder is empty.
 */
function NetworkNeighborhood({ window }: AppProps) {
  const [place, setPlace] = useState<Place>('neighborhood')
  const [selected, setSelected] = useState(false)
  const [status, setStatus] = useState(true)
  const [about, setAbout] = useState(false)
  const items = place === 'neighborhood' ? [{ label: 'Entire Network', icon: entireNetworkIcon }] : []

  useEffect(() => window.setTitle(TITLES[place]), [place, window])

  const open = () => {
    setPlace('entire')
    setSelected(false)
  }

  return (
    <div className="explorer h-full w-full flex flex-col">
      <MenuBar
        menus={[
          {
            label: '&File',
            items: [
              { label: '&Open', bold: true, disabled: !selected, onSelect: open },
              'separator',
              { label: '&Close', onSelect: window.close },
            ],
          },
          {
            label: '&Edit',
            items: [
              { label: 'Select &All', shortcut: 'Ctrl+A', onSelect: () => setSelected(items.length > 0) },
            ],
          },
          {
            label: '&View',
            items: [
              {
                label: '&Up One Level',
                disabled: place === 'neighborhood',
                onSelect: () => setPlace('neighborhood'),
              },
              'separator',
              { label: 'Status &Bar', checked: status, onSelect: () => setStatus(!status) },
            ],
          },
          { label: '&Help', items: [{ label: '&About Windows 95', onSelect: () => setAbout(true) }] },
        ]}
      />
      <div className="explorer-files explorer-large bevel-sunken">
        <div
          role="listbox"
          aria-label={`${TITLES[place]} contents`}
          tabIndex={0}
          className="explorer-items"
          onPointerDown={(event) => event.target === event.currentTarget && setSelected(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && selected) open()
            if (event.key === 'Backspace') setPlace('neighborhood')
            if (event.key.startsWith('Arrow') && items.length) setSelected(true)
          }}
        >
          {items.map((item) => (
            <div
              key={item.label}
              role="option"
              aria-label={item.label}
              aria-selected={selected}
              tabIndex={-1}
              className={`explorer-item ${selected ? 'selected' : ''}`}
              onPointerDown={() => setSelected(true)}
              onDoubleClick={open}
            >
              <span className="explorer-icon">
                <img src={item.icon} alt="" draggable={false} />
              </span>
              <span className="explorer-name">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      {status && (
        <StatusBar className="shrink-0">
          <StatusPane className="flex-1">{items.length} object(s)</StatusPane>
        </StatusBar>
      )}
      {about && (
        <MessageBox
          title="About Windows 95"
          icon="info"
          message={'Microsoft Windows 95\nNetwork Neighborhood'}
          buttons={['OK']}
          onClose={() => setAbout(false)}
        />
      )}
    </div>
  )
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
