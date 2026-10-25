import { useEffect, useId, useState } from 'react'
import { locales } from '../../settings/model'
import type { AppManifest } from '../../shell/types'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Checkbox, GroupBox, TextBox } from '../../ui/fields'
import { appletIcons } from './icons'
import { PropertySheet, useSettingsDraft } from './PropertySheet'

export function KeyboardProperties({ onClose }: { onClose: () => void }) {
  const state = useSettingsDraft()
  const keyboard = state.draft.keyboard
  const id = useId()
  return (
    <PropertySheet
      title="Keyboard Properties"
      state={state}
      onClose={onClose}
      tabs={[
        {
          label: 'Speed',
          content: (
            <>
              <GroupBox label="Character repeat">
                <label className="block">
                  Repeat delay:
                  <input
                    aria-label="Repeat delay"
                    className="cp-slider"
                    type="range"
                    min={250}
                    max={1000}
                    step={250}
                    value={1250 - keyboard.repeatDelay}
                    onChange={(event) =>
                      state.change({
                        keyboard: { ...keyboard, repeatDelay: 1250 - event.currentTarget.valueAsNumber },
                      })
                    }
                  />
                </label>
                <div className="flex justify-between mb-3">
                  <span>Long</span>
                  <span>Short</span>
                </div>
                <label className="block">
                  Repeat rate:
                  <input
                    aria-label="Repeat rate"
                    className="cp-slider"
                    type="range"
                    min={2}
                    max={30}
                    value={keyboard.repeatRate}
                    onChange={(event) =>
                      state.change({
                        keyboard: { ...keyboard, repeatRate: event.currentTarget.valueAsNumber },
                      })
                    }
                  />
                </label>
                <div className="flex justify-between mb-3">
                  <span>Slow</span>
                  <span>Fast</span>
                </div>
                <label className="flex flex-col gap-2" htmlFor={id}>
                  Click here and hold down a key to test repeat rate:
                  <TextBox id={id} aria-label="Keyboard test" />
                </label>
              </GroupBox>
              <GroupBox label="Cursor blink rate" className="mt-4">
                <div className="flex gap-4 items-center">
                  <input
                    aria-label="Cursor blink rate"
                    className="cp-slider"
                    type="range"
                    min={0}
                    max={1200}
                    step={100}
                    value={1200 - keyboard.cursorBlink}
                    onChange={(event) =>
                      state.change({
                        keyboard: { ...keyboard, cursorBlink: 1200 - event.currentTarget.valueAsNumber },
                      })
                    }
                  />
                  <span className="bg-white p-2 bevel-sunken">
                    <span
                      className="cp-cursor block w-px h-[16px] bg-black"
                      style={{
                        animationDuration: `${keyboard.cursorBlink * 2}ms`,
                        animationName: keyboard.cursorBlink === 0 ? 'none' : 'cp-blink',
                      }}
                    />
                  </span>
                </div>
                <div className="flex justify-between mr-12">
                  <span>None</span>
                  <span>Fast</span>
                </div>
              </GroupBox>
            </>
          ),
        },
      ]}
    />
  )
}

export function RegionalProperties({ onClose }: { onClose: () => void }) {
  const state = useSettingsDraft()
  const regional = state.draft.regional
  const id = useId()
  return (
    <PropertySheet
      title="Regional Settings Properties"
      state={state}
      onClose={onClose}
      tabs={[
        {
          label: 'Regional Settings',
          content: (
            <>
              <div className="flex gap-4 mt-3 mb-5 items-center">
                <img src={appletIcons.regional} width={48} height={48} alt="" />
                <p>Select the language and country whose conventions you want to use.</p>
              </div>
              <select
                aria-label="Regional language"
                className="w-full"
                value={regional.locale}
                onChange={(event) =>
                  state.change({
                    regional: {
                      ...regional,
                      locale: locales.find((name) => name === event.target.value) ?? locales[0],
                    },
                  })
                }
              >
                {locales.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              <GroupBox label="Sample" className="mt-6">
                <p>{regional.locale}</p>
                <p className="mt-2">Currency: {regional.currency}1,234.56</p>
                <p className="mt-2">Short date: {regional.dateFormat}</p>
                <p className="mt-2">Time: {regional.time24 ? '13:05:00' : '1:05:00 PM'}</p>
              </GroupBox>
            </>
          ),
        },
        {
          label: 'Currency',
          content: (
            <>
              <GroupBox label="Currency" className="mt-3">
                <label className="flex gap-3 items-center" htmlFor={id}>
                  Currency symbol:
                  <TextBox
                    id={id}
                    aria-label="Currency symbol"
                    className="w-[90px]"
                    maxLength={8}
                    value={regional.currency}
                    onChange={(event) =>
                      state.change({ regional: { ...regional, currency: event.target.value } })
                    }
                  />
                </label>
              </GroupBox>
              <GroupBox label="Sample" className="mt-5">
                {regional.currency}1,234.56
              </GroupBox>
            </>
          ),
        },
        {
          label: 'Time',
          content: (
            <>
              <label className="flex flex-col gap-2 mt-3">
                Time style:
                <select
                  aria-label="Time style"
                  value={regional.time24 ? '24' : '12'}
                  onChange={(event) =>
                    state.change({ regional: { ...regional, time24: event.target.value === '24' } })
                  }
                >
                  <option value="12">h:mm:ss tt</option>
                  <option value="24">HH:mm:ss</option>
                </select>
              </label>
              <GroupBox label="Sample" className="mt-5">
                {regional.time24 ? '13:05:00' : '1:05:00 PM'}
              </GroupBox>
            </>
          ),
        },
        {
          label: 'Date',
          content: (
            <>
              <label className="flex flex-col gap-2 mt-3">
                Short date style:
                <select
                  aria-label="Short date style"
                  value={regional.dateFormat}
                  onChange={(event) =>
                    state.change({
                      regional: {
                        ...regional,
                        dateFormat:
                          event.target.value === 'dd/MM/yyyy'
                            ? 'dd/MM/yyyy'
                            : event.target.value === 'yyyy-MM-dd'
                              ? 'yyyy-MM-dd'
                              : 'M/d/yyyy',
                      },
                    })
                  }
                >
                  <option>M/d/yyyy</option>
                  <option>dd/MM/yyyy</option>
                  <option>yyyy-MM-dd</option>
                </select>
              </label>
              <GroupBox label="Sample" className="mt-5">
                {regional.dateFormat === 'dd/MM/yyyy'
                  ? '24/08/1995'
                  : regional.dateFormat === 'yyyy-MM-dd'
                    ? '1995-08-24'
                    : '8/24/1995'}
              </GroupBox>
            </>
          ),
        },
      ]}
    />
  )
}

export function AccessibilityProperties({ onClose }: { onClose: () => void }) {
  const state = useSettingsDraft()
  const access = state.draft.accessibility
  const toggle = (key: keyof typeof access, value: boolean) =>
    state.change({ accessibility: { ...access, [key]: value } })
  return (
    <PropertySheet
      title="Accessibility Properties"
      state={state}
      onClose={onClose}
      width={422}
      tabs={[
        {
          label: 'Keyboard',
          content: (
            <>
              <GroupBox label="StickyKeys" className="mt-2">
                <p className="mb-3">
                  Use StickyKeys if you want to use Shift, Ctrl, or Alt by pressing one key at a time.
                </p>
                <Checkbox
                  label="Use StickyKeys"
                  checked={access.stickyKeys}
                  onChange={(event) => toggle('stickyKeys', event.target.checked)}
                />
              </GroupBox>
              <GroupBox label="FilterKeys" className="mt-4">
                <p className="mb-3">Use FilterKeys to ignore brief or repeated keystrokes.</p>
                <Checkbox
                  label="Use FilterKeys"
                  checked={access.filterKeys}
                  onChange={(event) => toggle('filterKeys', event.target.checked)}
                />
              </GroupBox>
              <GroupBox label="ToggleKeys" className="mt-4">
                <p className="mb-3">Hear a tone when Caps Lock, Num Lock, or Scroll Lock changes.</p>
                <Checkbox
                  label="Use ToggleKeys"
                  checked={access.toggleKeys}
                  onChange={(event) => toggle('toggleKeys', event.target.checked)}
                />
              </GroupBox>
            </>
          ),
        },
        {
          label: 'Sound',
          content: (
            <GroupBox label="ShowSounds" className="mt-2">
              <p className="mb-3">Tell programs to display captions for the speech and sounds they make.</p>
              <Checkbox
                label="Use ShowSounds"
                checked={access.showSounds}
                onChange={(event) => toggle('showSounds', event.target.checked)}
              />
            </GroupBox>
          ),
        },
        {
          label: 'Display',
          content: (
            <GroupBox label="High Contrast" className="mt-2">
              <p className="mb-3">Use colors and fonts designed for easy reading.</p>
              <Checkbox
                label="Use High Contrast"
                checked={access.highContrast}
                onChange={(event) => toggle('highContrast', event.target.checked)}
              />
              <div className="bg-black text-white border border-white mt-4 p-5">
                High Contrast Black and White
              </div>
            </GroupBox>
          ),
        },
        {
          label: 'Mouse',
          content: (
            <GroupBox label="MouseKeys" className="mt-2">
              <p className="mb-3">Use the numeric keypad to control the mouse pointer.</p>
              <Checkbox
                label="Use MouseKeys"
                checked={access.mouseKeys}
                onChange={(event) => toggle('mouseKeys', event.target.checked)}
              />
            </GroupBox>
          ),
        },
      ]}
    />
  )
}

const devices = [
  { name: 'Computer', children: ['Windows 95 virtual computer'] },
  { name: 'Disk drives', children: ['Generic virtual IDE disk (C:)'] },
  { name: 'Display adapters', children: ['Windows 95 virtual display adapter'] },
  { name: 'Keyboards', children: ['Standard 101/102-Key keyboard'] },
  { name: 'Monitors', children: ['Plug and Play Monitor'] },
  { name: 'Mouse', children: ['Standard mouse'] },
  { name: 'Sound, video and game controllers', children: ['Web Audio compatible sound device'] },
  { name: 'System devices', children: ['System timer', 'Virtual system clock', 'Virtual file system'] },
]

export function SystemProperties({ onClose }: { onClose: () => void }) {
  const state = useSettingsDraft()
  const [device, setDevice] = useState<string | null>(null)
  const memory =
    'deviceMemory' in navigator && typeof navigator.deviceMemory === 'number'
      ? `${navigator.deviceMemory * 1024}.0 MB RAM`
      : '64.0 MB virtual RAM'
  return (
    <>
      <PropertySheet
        title="System Properties"
        state={state}
        onClose={onClose}
        width={416}
        tabs={[
          {
            label: 'General',
            content: (
              <div className="flex gap-7 pt-5">
                <div className="w-[110px] text-center mt-4">
                  <img src={appletIcons.system} width={88} height={88} alt="" className="mx-auto" />
                  <p className="font-bold text-[22px] mt-3 leading-[25px]">
                    Microsoft
                    <br />
                    Windows<span className="font-normal">95</span>
                  </p>
                </div>
                <div className="flex-1">
                  <p>System:</p>
                  <p className="mt-2">
                    Microsoft Windows 95
                    <br />
                    4.00.950
                    <br />
                    Copyright © 1981-1995
                    <br />
                    Microsoft Corp.
                  </p>
                  <p className="mt-5">Registered to:</p>
                  <p className="mt-2">
                    Windows 95 User
                    <br />
                    Offline Desktop
                  </p>
                  <p className="mt-5">Computer:</p>
                  <p className="mt-2">
                    Pentium(r) compatible
                    <br />
                    {memory}
                  </p>
                </div>
              </div>
            ),
          },
          {
            label: 'Device Manager',
            content: (
              <>
                <p className="mb-2">View devices by type</p>
                <div className="bg-white text-black bevel-sunken p-[6px] h-[266px] overflow-auto">
                  {devices.map((group) => (
                    <details key={group.name} open={group.name === 'Computer'}>
                      <summary className="h-[21px] cursor-default">{group.name}</summary>
                      <div className="ml-5 border-l border-dotted border-shadow pl-3">
                        {group.children.map((name) => (
                          <button
                            className="block text-left h-[22px] px-1 focus:bg-select focus:text-white outline-none"
                            key={name}
                            type="button"
                            onDoubleClick={() => setDevice(name)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') setDevice(name)
                            }}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </>
            ),
          },
        ]}
      />
      {device && (
        <Dialog title={`${device} Properties`} onClose={() => setDevice(null)} className="cp-dialog">
          <div className="w-[330px] p-3">
            <GroupBox label="Device status">
              <p>This device is working properly.</p>
              <p className="mt-3">This is a virtual device provided by the Windows 95 desktop.</p>
            </GroupBox>
            <div className="flex justify-end mt-3">
              <Button isDefault onClick={() => setDevice(null)}>
                OK
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  )
}

export function AddRemovePrograms({ onClose }: { onClose: () => void }) {
  const state = useSettingsDraft()
  const [apps, setApps] = useState<readonly AppManifest[]>([])
  const [selected, setSelected] = useState('')
  useEffect(() => {
    let active = true
    void import('../../shell/registry').then((registry) => {
      if (!active) return
      setApps(registry.apps)
      setSelected(registry.apps[0]?.id ?? '')
    })
    return () => {
      active = false
    }
  }, [])
  const selectedApp = apps.find((app) => app.id === selected)
  return (
    <PropertySheet
      title="Add/Remove Programs Properties"
      state={state}
      onClose={onClose}
      width={420}
      tabs={[
        {
          label: 'Install/Uninstall',
          content: (
            <>
              <p className="mb-3 mt-2">The following software is installed on your computer.</p>
              <select
                aria-label="Installed programs"
                size={10}
                className="w-full"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                {apps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.title}
                  </option>
                ))}
              </select>
              <GroupBox label="Program information" className="mt-3">
                <p>{selectedApp?.title}</p>
                <p className="mt-2">{selectedApp?.exe}</p>
                <p className="mt-2">Windows component</p>
              </GroupBox>
              <p className="mt-3">Windows components are included with this desktop.</p>
            </>
          ),
        },
      ]}
    />
  )
}

const fonts = [
  {
    name: 'MS Sans Serif',
    family: '"MS Sans Serif Bitmap", "MS Sans Serif", sans-serif',
    description: 'System dialog and menu font',
  },
  {
    name: 'Fixedsys',
    family: '"Fixedsys Bitmap", "Fixedsys", "Courier New", monospace',
    description: 'Fixed width system font',
  },
  { name: 'Arial', family: 'Arial, sans-serif', description: 'TrueType sans serif' },
  { name: 'Times New Roman', family: '"Times New Roman", serif', description: 'TrueType serif' },
  { name: 'Courier New', family: '"Courier New", monospace', description: 'TrueType fixed width' },
]

export function FontsFolder({ onClose }: { onClose: () => void }) {
  const [font, setFont] = useState<(typeof fonts)[number] | null>(null)
  return (
    <>
      <Dialog title="Fonts" onClose={onClose} className="cp-dialog">
        <div className="w-[420px] p-[3px]">
          <div className="cp-fonts bevel-sunken">
            {fonts.map((item) => (
              <button
                key={item.name}
                type="button"
                className="inline-flex w-[98px] h-[82px] flex-col items-center justify-center gap-1 align-top focus:bg-select focus:text-white outline-none"
                onDoubleClick={() => setFont(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') setFont(item)
                }}
              >
                <img src={appletIcons.fonts} width={32} height={32} alt="" />
                <span>{item.name}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-between items-center mt-2">
            <span>{fonts.length} font families</span>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </Dialog>
      {font && (
        <Dialog title={font.name} onClose={() => setFont(null)} className="cp-dialog">
          <div className="w-[435px] p-3">
            <p>{font.name}</p>
            <p className="my-2">{font.description}</p>
            <div
              className="bg-white text-black bevel-sunken p-3 h-[220px] overflow-auto"
              style={{ fontFamily: font.family }}
            >
              <p>
                abcdefghijklmnopqrstuvwxyz
                <br />
                ABCDEFGHIJKLMNOPQRSTUVWXYZ
                <br />
                1234567890 !@#$%^&*()
              </p>
              {[12, 18, 24, 32].map((size) => (
                <p key={size} className="mt-3" style={{ fontSize: size }}>
                  The quick brown fox jumps over the lazy dog.
                </p>
              ))}
            </div>
            <div className="flex justify-end mt-3">
              <Button onClick={() => setFont(null)}>Done</Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  )
}
