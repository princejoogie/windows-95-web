import { useId, useState } from 'react'
import { locales } from '../../settings/model'
import { apps } from '../../shell/registry'
import { ListBox, MessageBox } from '../../ui'
import { Button } from '../../ui/Button'
import { ComboBox } from '../../ui/ComboBox'
import { Dialog } from '../../ui/Dialog'
import { Checkbox, GroupBox, Radio, TextBox } from '../../ui/fields'
import { appletIcons } from './icons'
import { PropertySheet, useSettingsDraft } from './PropertySheet'
import { WorldMap } from './WorldMap'

export function DeviceGeneral({ name, manufacturer }: { name: string; manufacturer: string }) {
  return (
    <>
      <p className="mt-3 mb-5">{name}</p>
      <p>Manufacturer: {manufacturer}</p>
      <p className="mt-3">Hardware version: Not available</p>
      <GroupBox label="Device status" className="mt-5">
        <p>This device is working properly.</p>
      </GroupBox>
      <GroupBox label="Device usage" className="mt-5">
        <Checkbox label="Original Configuration (current)" defaultChecked />
      </GroupBox>
    </>
  )
}

export function KeyboardProperties({ onClose }: { onClose: () => void }) {
  const state = useSettingsDraft()
  const keyboard = state.draft.keyboard
  const id = useId()
  const [notice, setNotice] = useState(false)
  const [hotkey, setHotkey] = useState('Left Alt+Shift')
  return (
    <>
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
          {
            label: 'Language',
            content: (
              <>
                <p className="mb-3">Installed keyboard languages and layouts:</p>
                <ListBox
                  label="Keyboard languages"
                  items={['English (United States)']}
                  value="English (United States)"
                  onChange={() => {}}
                  className="h-[110px]"
                />
                <div className="flex justify-end gap-2 mt-3">
                  <Button onClick={() => setNotice(true)}>Add...</Button>
                  <Button disabled>Remove</Button>
                  <Button onClick={() => setNotice(true)}>Properties</Button>
                </div>
                <GroupBox label="Switch languages" className="mt-5">
                  <div className="flex flex-col gap-3">
                    {['Left Alt+Shift', 'Ctrl+Shift', 'None'].map((label) => (
                      <Radio
                        key={label}
                        name="language-hotkey"
                        label={label}
                        checked={hotkey === label}
                        onChange={() => setHotkey(label)}
                      />
                    ))}
                  </div>
                </GroupBox>
                <Checkbox label="Enable indicator on taskbar" className="mt-4" disabled />
              </>
            ),
          },
          {
            label: 'General',
            content: (
              <DeviceGeneral
                name="Standard 101/102-Key or Microsoft Natural Keyboard"
                manufacturer="(Standard keyboard types)"
              />
            ),
          },
        ]}
      />
      {notice && (
        <MessageBox
          title="Keyboard"
          message="The United States keyboard layout is installed. No additional keyboard layouts are available."
          buttons={['OK']}
          onClose={() => setNotice(false)}
        />
      )}
    </>
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
              <WorldMap />
              <p className="my-3">Select the language and country whose conventions you want to use.</p>
              <ComboBox
                aria-label="Regional language"
                className="w-full"
                value={regional.locale}
                onChange={(value) =>
                  state.change({
                    regional: {
                      ...regional,
                      locale: locales.find((name) => name === value) ?? locales[0],
                    },
                  })
                }
                options={locales.map((name) => ({ key: name, label: name }))}
              />
              <GroupBox label="Sample" className="mt-3">
                <p>{regional.locale}</p>
                <p className="mt-2">Currency: {regional.currency}1,234.56</p>
                <p className="mt-2">Short date: {regional.dateFormat}</p>
                <p className="mt-2">Time: {regional.time24 ? '13:05:00' : '1:05:00 PM'}</p>
              </GroupBox>
            </>
          ),
        },
        {
          label: 'Number',
          content: (
            <>
              <GroupBox label="Sample" className="mt-2">
                <p>Positive: 123,456,789.00</p>
                <p className="mt-2">Negative: -123,456,789.00</p>
              </GroupBox>
              <div className="grid grid-cols-[140px_1fr] gap-3 mt-5">
                {[
                  ['Decimal symbol', '.'],
                  ['No. of digits after decimal', '2'],
                  ['Digit grouping symbol', ','],
                  ['No. of digits in group', '3'],
                  ['Negative sign symbol', '-'],
                  ['Negative number format', '-1.1'],
                  ['Display leading zeroes', '0.7'],
                  ['Measurement system', 'U.S.'],
                  ['List separator', ','],
                ].map(([label = '', value = '']) => (
                  <div key={label} className="contents">
                    <span>{label}:</span>
                    <ComboBox
                      aria-label={label}
                      value={value}
                      options={[{ key: value, label: value }]}
                      onChange={() => {}}
                    />
                  </div>
                ))}
              </div>
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
              <div className="flex flex-col gap-2 mt-3">
                Time style:
                <ComboBox
                  aria-label="Time style"
                  value={regional.time24 ? '24' : '12'}
                  onChange={(value) => state.change({ regional: { ...regional, time24: value === '24' } })}
                  options={[
                    { key: '12', label: 'h:mm:ss tt' },
                    { key: '24', label: 'HH:mm:ss' },
                  ]}
                />
              </div>
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
              <div className="flex flex-col gap-2 mt-3">
                Short date style:
                <ComboBox
                  aria-label="Short date style"
                  value={regional.dateFormat}
                  onChange={(value) =>
                    state.change({
                      regional: {
                        ...regional,
                        dateFormat:
                          value === 'dd/MM/yyyy'
                            ? 'dd/MM/yyyy'
                            : value === 'yyyy-MM-dd'
                              ? 'yyyy-MM-dd'
                              : 'M/d/yyyy',
                      },
                    })
                  }
                  options={['M/d/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd'].map((name) => ({
                    key: name,
                    label: name,
                  }))}
                />
              </div>
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
  const [setting, setSetting] = useState<string | null>(null)
  const settingsButton = (name: string) => (
    <Button aria-label={`${name} Settings`} className="float-right" onClick={() => setSetting(name)}>
      Settings...
    </Button>
  )
  const toggle = (key: keyof typeof access, value: boolean) =>
    state.change({ accessibility: { ...access, [key]: value } })
  return (
    <>
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
                  {settingsButton('StickyKeys')}
                </GroupBox>
                <GroupBox label="FilterKeys" className="mt-4">
                  <p className="mb-3">Use FilterKeys to ignore brief or repeated keystrokes.</p>
                  <Checkbox
                    label="Use FilterKeys"
                    checked={access.filterKeys}
                    onChange={(event) => toggle('filterKeys', event.target.checked)}
                  />
                  {settingsButton('FilterKeys')}
                </GroupBox>
                <GroupBox label="ToggleKeys" className="mt-4">
                  <p className="mb-3">Hear a tone when Caps Lock, Num Lock, or Scroll Lock changes.</p>
                  <Checkbox
                    label="Use ToggleKeys"
                    checked={access.toggleKeys}
                    onChange={(event) => toggle('toggleKeys', event.target.checked)}
                  />
                  {settingsButton('ToggleKeys')}
                </GroupBox>
              </>
            ),
          },
          {
            label: 'Sound',
            content: (
              <>
                <GroupBox label="SoundSentry" className="mt-2">
                  <p className="mb-3">
                    Use SoundSentry if you want Windows to generate visual warnings when your system makes a
                    sound.
                  </p>
                  <Checkbox label="Use SoundSentry" />
                  {settingsButton('SoundSentry')}
                </GroupBox>
                <GroupBox label="ShowSounds" className="mt-4">
                  <p className="mb-3">
                    Tell programs to display captions for the speech and sounds they make.
                  </p>
                  <Checkbox
                    label="Use ShowSounds"
                    checked={access.showSounds}
                    onChange={(event) => toggle('showSounds', event.target.checked)}
                  />
                  {settingsButton('ShowSounds')}
                </GroupBox>
              </>
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
                {settingsButton('High Contrast')}
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
                {settingsButton('MouseKeys')}
              </GroupBox>
            ),
          },
          {
            label: 'General',
            content: (
              <>
                <GroupBox label="Automatic reset" className="mt-2">
                  <Checkbox label="Turn off accessibility features after idle for:" />
                  <ComboBox
                    aria-label="Accessibility idle time"
                    value="5 minutes"
                    options={['5 minutes', '10 minutes', '15 minutes', '20 minutes', '30 minutes'].map(
                      (label) => ({ key: label, label }),
                    )}
                    onChange={() => {}}
                    className="mt-3 w-[150px]"
                  />
                </GroupBox>
                <GroupBox label="Notification" className="mt-4">
                  <Checkbox label="Give warning message when turning a feature on" defaultChecked />
                  <Checkbox
                    label="Make a sound when turning a feature on or off"
                    defaultChecked
                    className="mt-3"
                  />
                </GroupBox>
                <GroupBox label="SerialKeys" className="mt-4">
                  <p className="mb-3">Use an alternative input device connected to a serial port.</p>
                  <Checkbox label="Use SerialKeys" />
                  {settingsButton('SerialKeys')}
                </GroupBox>
              </>
            ),
          },
        ]}
      />
      {setting && (
        <Dialog title={`Settings for ${setting}`} onClose={() => setSetting(null)}>
          <div className="p-3 w-[340px]">
            <GroupBox label="Keyboard shortcut">
              <Checkbox label={`Use shortcut for ${setting}`} defaultChecked />
              <p className="mt-3">
                {setting === 'StickyKeys'
                  ? 'Press the SHIFT key five times to turn StickyKeys on or off.'
                  : setting === 'MouseKeys'
                    ? 'Press LEFT ALT + LEFT SHIFT + NUM LOCK to turn MouseKeys on or off.'
                    : 'Use the keyboard shortcut to turn this feature on or off.'}
              </p>
            </GroupBox>
            <GroupBox label="Options" className="mt-4">
              <Checkbox label="Make sounds when modifier keys are pressed" defaultChecked />
              <Checkbox label="Display status on screen" defaultChecked className="mt-3" />
            </GroupBox>
            <div className="flex justify-end gap-2 mt-4">
              <Button isDefault onClick={() => setSetting(null)}>
                OK
              </Button>
              <Button onClick={() => setSetting(null)}>Cancel</Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
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
  const [performance, setPerformance] = useState<string | null>(null)
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
                    &nbsp;
                  </p>
                  <p className="mt-5">Computer:</p>
                  <p className="mt-2">
                    Pentium(r)
                    <br />
                    16.0MB RAM
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
          {
            label: 'Hardware Profiles',
            content: (
              <>
                <p className="mb-4">
                  You can set up hardware profiles for different hardware configurations.
                </p>
                <ListBox
                  label="Hardware profiles"
                  items={['Original Configuration (current)']}
                  value="Original Configuration (current)"
                  onChange={() => {}}
                  className="h-[150px]"
                />
                <div className="flex justify-end gap-2 mt-3">
                  <Button onClick={() => setPerformance('Hardware Profiles')}>Copy...</Button>
                  <Button onClick={() => setPerformance('Hardware Profiles')}>Rename...</Button>
                  <Button disabled>Delete</Button>
                </div>
                <p className="mt-5">When Windows starts, use the original configuration.</p>
              </>
            ),
          },
          {
            label: 'Performance',
            content: (
              <>
                <div className="grid grid-cols-[110px_1fr] gap-y-3 mt-3">
                  <span>Memory:</span>
                  <span>16.0MB of RAM</span>
                  <span>System resources:</span>
                  <span>85% free</span>
                  <span>File system:</span>
                  <span>32-bit</span>
                  <span>Virtual memory:</span>
                  <span>32-bit</span>
                  <span>Disk compression:</span>
                  <span>Not installed</span>
                  <span>PC Cards:</span>
                  <span>No PC Card sockets are installed</span>
                </div>
                <GroupBox label="Performance status" className="mt-5">
                  Your system is configured for optimal performance.
                </GroupBox>
                <GroupBox label="Advanced settings" className="mt-4">
                  <div className="flex justify-between">
                    {['File System...', 'Graphics...', 'Virtual Memory...'].map((label) => (
                      <Button key={label} onClick={() => setPerformance(label.slice(0, -3))}>
                        {label}
                      </Button>
                    ))}
                  </div>
                </GroupBox>
              </>
            ),
          },
        ]}
      />
      {performance && (
        <MessageBox
          title={performance}
          message="These settings are managed by Windows. No alternate hardware configuration is available."
          buttons={['OK']}
          onClose={() => setPerformance(null)}
        />
      )}
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
  const [selected, setSelected] = useState(apps[0]?.id ?? '')
  const [notice, setNotice] = useState<string | null>(null)
  const [component, setComponent] = useState('Accessories')
  const selectedApp = apps.find((app) => app.id === selected)
  return (
    <>
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
                <div className="flex gap-4 items-center mb-3 mt-2">
                  <p>To install a new program from a floppy disk or CD-ROM drive, click Install.</p>
                  <Button
                    onClick={() =>
                      setNotice('No setup program was found. Insert the installation disk and try again.')
                    }
                  >
                    Install...
                  </Button>
                </div>
                <p className="mb-2">The following software is installed on your computer.</p>
                <ListBox
                  label="Installed programs"
                  className="w-full h-[110px]"
                  value={selected}
                  onChange={(value) => setSelected(value)}
                  items={apps.map((app) => app.id)}
                  render={(id) => apps.find((app) => app.id === id)?.title ?? id}
                />
                <div className="text-right mt-3">
                  <Button
                    disabled={!selectedApp}
                    onClick={() =>
                      setNotice(
                        `${selectedApp?.title ?? 'This program'} is a Windows component. Use the Windows Setup tab to view Windows components.`,
                      )
                    }
                  >
                    Add/Remove...
                  </Button>
                </div>
              </>
            ),
          },
          {
            label: 'Windows Setup',
            content: (
              <>
                <p className="mb-3 mt-2">To add or remove a component, select it and click Details.</p>
                <ListBox
                  label="Windows components"
                  items={[
                    'Accessories',
                    'Accessibility Options',
                    'Communications',
                    'Disk Tools',
                    'Games',
                    'Multimedia',
                    'Screen Savers',
                  ]}
                  value={component}
                  onChange={setComponent}
                  render={(name) => (
                    <span className="flex gap-2">
                      <span>☑</span>
                      <span>{name}</span>
                    </span>
                  )}
                  className="h-[150px]"
                />
                <div className="flex justify-between mt-3">
                  <span>Space required: 0.0MB</span>
                  <Button
                    onClick={() =>
                      setNotice(
                        `${component} is installed. No Windows Setup disks are available to change components.`,
                      )
                    }
                  >
                    Details...
                  </Button>
                </div>
                <p className="mt-4">Space available on disk: 511.0MB</p>
              </>
            ),
          },
          {
            label: 'Startup Disk',
            content: (
              <>
                <div className="flex gap-4 items-center mt-5">
                  <img src={appletIcons.programs} width={48} height={48} alt="" />
                  <p>A startup disk can be used to start your computer if Windows does not start.</p>
                </div>
                <p className="my-5">Insert a disk into drive A:, and then click Create Disk.</p>
                <Button
                  onClick={() => setNotice('The device is not ready. No floppy disk drive is available.')}
                >
                  Create Disk...
                </Button>
              </>
            ),
          },
        ]}
      />
      {notice && (
        <MessageBox
          title="Add/Remove Programs"
          message={notice}
          buttons={['OK']}
          onClose={() => setNotice(null)}
        />
      )}
    </>
  )
}
