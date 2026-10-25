import { useState } from 'react'
import '../../settings/apply'
import type { AppManifest, AppProps } from '../../shell/types'
import { StatusBar, StatusPane } from '../../ui/fields'
import { ContextMenu, MenuBar } from '../../ui/Menu'
import { MessageBox } from '../../ui/MessageBox'
import { DateTimeProperties } from './DateTimeProperties'
import { DisplayProperties } from './DisplayProperties'
import { appletIcons } from './icons'
import { MouseProperties } from './MouseProperties'
import {
  AccessibilityProperties,
  AddRemovePrograms,
  FontsFolder,
  KeyboardProperties,
  RegionalProperties,
  SystemProperties,
} from './OtherApplets'
import { SoundsProperties } from './SoundsProperties'
import './controlpanel.css'

export { ScreenSaverHost } from '../../settings/ScreenSaverHost'
export { useSettings } from '../../settings/store'
export { DateTimeProperties } from './DateTimeProperties'
export { DisplayProperties } from './DisplayProperties'
export { MouseProperties } from './MouseProperties'

const applets = [
  {
    id: 'accessibility',
    label: 'Accessibility Options',
    icon: appletIcons.accessibility,
    component: AccessibilityProperties,
  },
  { id: 'programs', label: 'Add/Remove Programs', icon: appletIcons.programs, component: AddRemovePrograms },
  { id: 'datetime', label: 'Date/Time', icon: appletIcons.datetime, component: DateTimeProperties },
  { id: 'display', label: 'Display', icon: appletIcons.display, component: DisplayProperties },
  { id: 'fonts', label: 'Fonts', icon: appletIcons.fonts, component: FontsFolder },
  { id: 'keyboard', label: 'Keyboard', icon: appletIcons.keyboard, component: KeyboardProperties },
  { id: 'mouse', label: 'Mouse', icon: appletIcons.mouse, component: MouseProperties },
  { id: 'regional', label: 'Regional Settings', icon: appletIcons.regional, component: RegionalProperties },
  { id: 'sounds', label: 'Sounds', icon: appletIcons.sounds, component: SoundsProperties },
  { id: 'system', label: 'System', icon: appletIcons.system, component: SystemProperties },
] as const
type AppletId = (typeof applets)[number]['id']

export function ControlPanel({ window: api }: AppProps) {
  const [selected, setSelected] = useState<AppletId>('accessibility')
  const [open, setOpen] = useState<AppletId | null>(null)
  const [about, setAbout] = useState(false)
  const [status, setStatus] = useState(true)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const current = applets.find((applet) => applet.id === open)
  const Applet = current?.component
  const openSelected = () => setOpen(selected)
  return (
    <div className="cp-folder flex h-full w-full flex-col bg-face">
      <MenuBar
        menus={[
          {
            label: '&File',
            items: [
              { label: '&Open', bold: true, onSelect: openSelected },
              'separator',
              { label: '&Close', onSelect: api.close },
            ],
          },
          {
            label: '&Edit',
            items: [
              { label: 'Select &All', disabled: true },
              { label: '&Invert Selection', disabled: true },
            ],
          },
          {
            label: '&View',
            items: [
              { label: '&Large Icons', checked: true },
              'separator',
              { label: 'Status &Bar', checked: status, onSelect: () => setStatus(!status) },
              { label: '&Refresh', onSelect: () => setSelected('accessibility') },
            ],
          },
          {
            label: '&Help',
            items: [
              { label: '&Help Topics', onSelect: () => setAbout(true) },
              'separator',
              { label: '&About Control Panel', onSelect: () => setAbout(true) },
            ],
          },
        ]}
      />
      <div
        role="listbox"
        aria-label="Control Panel applets"
        className="cp-icons bevel-sunken"
        tabIndex={0}
        onContextMenu={(event) => {
          event.preventDefault()
          setMenu({ x: event.clientX, y: event.clientY })
        }}
        onKeyDown={(event) => {
          if (open) return
          if (event.key === 'Enter') {
            event.preventDefault()
            openSelected()
            return
          }
          const index = applets.findIndex((applet) => applet.id === selected)
          const columns = Math.max(1, Math.floor(event.currentTarget.clientWidth / 94))
          const next =
            event.key === 'ArrowRight'
              ? index + 1
              : event.key === 'ArrowLeft'
                ? index - 1
                : event.key === 'ArrowDown'
                  ? index + columns
                  : event.key === 'ArrowUp'
                    ? index - columns
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? applets.length - 1
                        : null
          if (next === null) return
          event.preventDefault()
          const applet = applets[Math.max(0, Math.min(applets.length - 1, next))]
          if (applet) {
            setSelected(applet.id)
            event.currentTarget.querySelector<HTMLElement>(`[data-applet="${applet.id}"]`)?.focus()
          }
        }}
      >
        {applets.map((applet) => (
          <div
            role="option"
            tabIndex={selected === applet.id ? 0 : -1}
            aria-selected={selected === applet.id}
            aria-label={applet.label}
            key={applet.id}
            data-applet={applet.id}
            className="cp-icon"
            onClick={() => setSelected(applet.id)}
            onDoubleClick={() => {
              setSelected(applet.id)
              setOpen(applet.id)
            }}
            onKeyDown={(event) => {
              const match = applets.find((item) =>
                item.label.toLowerCase().startsWith(event.key.toLowerCase()),
              )
              if (event.key.length === 1 && !event.altKey && !event.ctrlKey && match) {
                setSelected(match.id)
                event.currentTarget.parentElement
                  ?.querySelector<HTMLElement>(`[data-applet="${match.id}"]`)
                  ?.focus()
              }
            }}
          >
            <img src={applet.icon} alt="" draggable={false} />
            <span>{applet.label}</span>
          </div>
        ))}
      </div>
      {status && (
        <StatusBar>
          <StatusPane className="flex-1">10 object(s)</StatusPane>
        </StatusBar>
      )}
      {Applet && <Applet onClose={() => setOpen(null)} />}
      {menu && (
        <ContextMenu
          at={menu}
          onClose={() => setMenu(null)}
          items={[
            { label: '&Open', bold: true, onSelect: openSelected },
            'separator',
            { label: 'P&roperties', onSelect: openSelected },
          ]}
        />
      )}
      {about && (
        <MessageBox
          title="About Control Panel"
          icon="info"
          message={
            'Control Panel\nMicrosoft Windows 95\nVersion 4.00.950\n\nUse the icons in Control Panel to change the appearance and behavior of Windows.'
          }
          buttons={['OK']}
          onClose={() => setAbout(false)}
        />
      )}
    </div>
  )
}

export const app: AppManifest = {
  id: 'controlpanel',
  title: 'Control Panel',
  icon: appletIcons.controlpanel,
  exe: 'CONTROL.EXE',
  window: { kind: 'resizable', width: 546, height: 328, minWidth: 320, minHeight: 240 },
  component: ControlPanel,
}
