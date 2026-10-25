import { useId, useState } from 'react'
import { Button, Checkbox, ComboBox, Dialog, GroupBox, MessageBox, Radio, TextBox } from '../../ui'
import { DeviceList } from './DeviceList'
import { PropertySheet, useSettingsDraft } from './PropertySheet'
import { Wizard } from './Wizard'

export function PasswordsProperties({ onClose }: { onClose: () => void }) {
  const id = useId()
  const state = useSettingsDraft()
  const settings = state.draft.passwords
  const [password, setPassword] = useState(false)
  const [message, setMessage] = useState(false)
  return (
    <>
      <PropertySheet
        title="Passwords Properties"
        width={430}
        state={state}
        onClose={onClose}
        tabs={[
          {
            label: 'Change Passwords',
            content: (
              <>
                <p className="mt-3 mb-5">To change your Windows password, click Change Windows Password.</p>
                <Button onClick={() => setPassword(true)}>Change Windows Password...</Button>
                <p className="mt-6 mb-3">To change other passwords, select the password and click Change.</p>
                <DeviceList
                  label="Other passwords"
                  items={[]}
                  value=""
                  onChange={() => {}}
                  className="h-[95px]"
                />
                <div className="text-right mt-2">
                  <Button disabled>Change...</Button>
                </div>
              </>
            ),
          },
          {
            label: 'Remote Administration',
            content: (
              <>
                <p className="my-4">You can allow other people to administer your computer remotely.</p>
                <Checkbox
                  label="Enable remote administration of this server"
                  checked={settings.remoteAdmin}
                  onChange={(e) =>
                    state.change({ passwords: { ...settings, remoteAdmin: e.target.checked } })
                  }
                />
                <GroupBox label="Remote administration" className="mt-5">
                  <p>No network server is available. Remote connections cannot be accepted.</p>
                  <Button className="mt-4" disabled>
                    Change Password...
                  </Button>
                </GroupBox>
              </>
            ),
          },
          {
            label: 'User Profiles',
            content: (
              <>
                <p className="mb-5">Windows can save each user's preferences and desktop settings.</p>
                <div className="flex flex-col gap-4">
                  <Radio
                    name="profiles"
                    label="All users of this computer use the same preferences and desktop settings."
                    checked={!settings.separateProfiles}
                    onChange={() => state.change({ passwords: { ...settings, separateProfiles: false } })}
                  />
                  <Radio
                    name="profiles"
                    label="Users can customize their preferences and desktop settings. Windows switches to your personal settings when you log in."
                    checked={settings.separateProfiles}
                    onChange={() => state.change({ passwords: { ...settings, separateProfiles: true } })}
                  />
                </div>
                <GroupBox label="User profile settings" className="mt-5">
                  <Checkbox
                    label="Include desktop icons and Network Neighborhood contents in user settings"
                    disabled={!settings.separateProfiles}
                    checked={settings.desktop}
                    onChange={(e) => state.change({ passwords: { ...settings, desktop: e.target.checked } })}
                  />
                  <Checkbox
                    className="mt-3"
                    label="Include Start menu and Programs groups in user settings"
                    disabled={!settings.separateProfiles}
                    checked={settings.startMenu}
                    onChange={(e) =>
                      state.change({ passwords: { ...settings, startMenu: e.target.checked } })
                    }
                  />
                </GroupBox>
              </>
            ),
          },
        ]}
      />
      {password && (
        <Dialog title="Change Windows Password" onClose={() => setPassword(false)}>
          <form
            className="p-3 w-[350px]"
            onSubmit={(e) => {
              e.preventDefault()
              setMessage(true)
            }}
          >
            <p className="mb-4">Type your old password, then type a new password.</p>
            {['Old password', 'New password', 'Confirm new password'].map((label) => (
              <label key={label} htmlFor={`${id}-${label}`} className="cp-form-row">
                {label}:
                <TextBox id={`${id}-${label}`} aria-label={label} type="password" autoComplete="off" />
              </label>
            ))}
            <div className="flex justify-end gap-2 mt-4">
              <Button type="submit" isDefault>
                OK
              </Button>
              <Button onClick={() => setPassword(false)}>Cancel</Button>
            </div>
          </form>
        </Dialog>
      )}
      {message && (
        <MessageBox
          title="Windows"
          icon="warning"
          message="Windows cannot change your password because no password provider is available."
          buttons={['OK']}
          onClose={() => setMessage(false)}
        />
      )}
    </>
  )
}

export function MultimediaProperties({ onClose }: { onClose: () => void }) {
  const id = useId()
  const state = useSettingsDraft()
  const settings = state.draft.multimedia
  const [details, setDetails] = useState(false)
  const volume = (kind: 'playbackVolume' | 'recordingVolume' | 'cdVolume') => (
    <>
      <input
        className="cp-slider"
        aria-label={
          kind === 'playbackVolume'
            ? 'Playback volume'
            : kind === 'recordingVolume'
              ? 'Recording volume'
              : 'CD volume'
        }
        type="range"
        min={0}
        max={100}
        value={settings[kind]}
        onChange={(e) => state.change({ multimedia: { ...settings, [kind]: e.currentTarget.valueAsNumber } })}
      />
      <div className="flex justify-between">
        <span>Low</span>
        <span>High</span>
      </div>
    </>
  )
  const device = (label: string, value: string) => (
    <label htmlFor={`${id}-${label}`} className="flex gap-2 items-center">
      Preferred device:
      <ComboBox
        aria-label={label}
        id={`${id}-${label}`}
        value={value}
        options={[{ key: value, label: value }]}
        onChange={() => {}}
        className="flex-1"
      />
    </label>
  )
  return (
    <>
      <PropertySheet
        title="Multimedia Properties"
        state={state}
        onClose={onClose}
        width={422}
        tabs={[
          {
            label: 'Audio',
            content: (
              <>
                <GroupBox label="Playback" className="mt-2">
                  {device('Playback device', 'Audio for Windows')}
                  {volume('playbackVolume')}
                </GroupBox>
                <GroupBox label="Recording" className="mt-4">
                  {device('Recording device', '(None)')}
                  {volume('recordingVolume')}
                </GroupBox>
                <Checkbox
                  className="mt-4"
                  label="Use only preferred devices"
                  checked={settings.preferredOnly}
                  onChange={(e) =>
                    state.change({ multimedia: { ...settings, preferredOnly: e.target.checked } })
                  }
                />
                <Checkbox className="mt-3" label="Show volume control on the taskbar" disabled />
              </>
            ),
          },
          {
            label: 'Video',
            content: (
              <>
                <GroupBox label="Video playback" className="mt-3">
                  <p className="mb-5">Show video in:</p>
                  <ComboBox
                    aria-label="Video window size"
                    value={settings.videoSize}
                    options={['Original size', 'Double size', 'Full screen'].map((label) => ({
                      key: label,
                      label,
                    }))}
                    onChange={(value) => state.change({ multimedia: { ...settings, videoSize: value } })}
                  />
                  <Checkbox className="mt-5" label="Show video controls" defaultChecked />
                </GroupBox>
              </>
            ),
          },
          {
            label: 'MIDI',
            content: (
              <>
                <GroupBox label="MIDI output" className="mt-3">
                  <Radio label="Single instrument" name="midi" defaultChecked />
                  <DeviceList
                    label="MIDI output devices"
                    items={['MIDI Mapper']}
                    value={settings.midi}
                    onChange={(midi) => state.change({ multimedia: { ...settings, midi } })}
                    className="h-[95px] mt-3"
                  />
                  <Button className="mt-3" onClick={() => setDetails(true)}>
                    Details...
                  </Button>
                </GroupBox>
                <p className="mt-4">No external MIDI instruments are connected.</p>
              </>
            ),
          },
          {
            label: 'CD Music',
            content: (
              <>
                <p className="my-4">Select the CD-ROM drive to play CD music.</p>
                {device('CD-ROM drive', '(No CD-ROM drive)')}
                <GroupBox label="CD music volume" className="mt-5">
                  {volume('cdVolume')}
                </GroupBox>
                <p className="mt-5">No audio compact disc is available.</p>
              </>
            ),
          },
          {
            label: 'Advanced',
            content: (
              <>
                <div
                  className="bevel-sunken bg-white p-2 h-[250px]"
                  role="tree"
                  aria-label="Multimedia devices"
                >
                  {[
                    'Audio Devices',
                    'MIDI Devices and Instruments',
                    'Mixer Devices',
                    'Line Input Devices',
                    'Video Compression Codecs',
                    'Audio Compression Codecs',
                    'Media Control Devices',
                  ].map((name) => (
                    <details key={name}>
                      <summary className="h-[25px]">{name}</summary>
                      <p className="pl-5">
                        {name === 'Audio Devices' ? 'Audio for Windows' : 'No devices installed.'}
                      </p>
                    </details>
                  ))}
                </div>
                <div className="text-right mt-3">
                  <Button onClick={() => setDetails(true)}>Properties</Button>
                </div>
              </>
            ),
          },
        ]}
      />
      {details && (
        <MessageBox
          title="Multimedia"
          message="Audio for Windows is available for sound playback. No other multimedia hardware is installed."
          buttons={['OK']}
          onClose={() => setDetails(false)}
        />
      )}
    </>
  )
}

export function ModemsProperties({ onClose }: { onClose: () => void }) {
  const id = useId()
  const state = useSettingsDraft()
  const [add, setAdd] = useState(false)
  const [dial, setDial] = useState(false)
  const settings = state.draft.dialing
  return (
    <>
      <PropertySheet
        title="Modems Properties"
        state={state}
        onClose={onClose}
        tabs={[
          {
            label: 'General',
            content: (
              <>
                <p className="mt-2 mb-3">The following modems are set up on this computer:</p>
                <DeviceList
                  label="Installed modems"
                  items={[]}
                  value=""
                  onChange={() => {}}
                  className="h-[160px]"
                />
                <div className="flex justify-end gap-2 mt-3">
                  <Button onClick={() => setAdd(true)}>Add...</Button>
                  <Button disabled>Remove</Button>
                  <Button disabled>Properties</Button>
                </div>
                <Button className="mt-5" onClick={() => setDial(true)}>
                  Dialing Properties...
                </Button>
              </>
            ),
          },
          {
            label: 'Diagnostics',
            content: (
              <>
                <p className="my-3">Select the port your modem is connected to.</p>
                <DeviceList
                  label="Modem ports"
                  items={[]}
                  value=""
                  onChange={() => {}}
                  className="h-[160px]"
                />
                <div className="text-right mt-3">
                  <Button disabled>More Info...</Button>
                </div>
              </>
            ),
          },
        ]}
      />
      {add && (
        <Wizard
          title="Install New Modem"
          onClose={() => setAdd(false)}
          pages={[
            <div key="start">
              <p>Windows will try to detect your modem.</p>
              <Checkbox className="mt-5" label="Don't detect my modem; I will select it from a list." />
            </div>,
            <div key="none">
              <p>Windows did not find any modems attached to your computer.</p>
              <p className="mt-5">
                No modem ports are available. Make sure your modem is connected, then run this wizard again.
              </p>
            </div>,
          ]}
        />
      )}
      {dial && (
        <Dialog title="Dialing Properties" onClose={() => setDial(false)}>
          <div className="p-3 w-[370px]">
            <GroupBox label="My Locations">
              <label htmlFor={`${id}-location`} className="block">
                I am dialing from:
                <TextBox
                  aria-label="Dialing location"
                  id={`${id}-location`}
                  className="w-full mt-2"
                  value={settings.location}
                  onChange={(e) => state.change({ dialing: { ...settings, location: e.target.value } })}
                />
              </label>
              <label htmlFor={`${id}-country`} className="block mt-4">
                I am in this country/region:
                <ComboBox
                  className="w-full mt-2"
                  aria-label="Dialing country"
                  id={`${id}-country`}
                  value={settings.country}
                  options={['United States of America (1)', 'United Kingdom (44)', 'Philippines (63)'].map(
                    (label) => ({ key: label, label }),
                  )}
                  onChange={(country) => state.change({ dialing: { ...settings, country } })}
                />
              </label>
              <label htmlFor={`${id}-area`} className="cp-form-row mt-4">
                Area code:
                <TextBox
                  aria-label="Area code"
                  id={`${id}-area`}
                  value={settings.areaCode}
                  onChange={(e) => state.change({ dialing: { ...settings, areaCode: e.target.value } })}
                />
              </label>
              <label htmlFor={`${id}-outside`} className="cp-form-row">
                To access an outside line, first dial:
                <TextBox
                  aria-label="Outside line"
                  id={`${id}-outside`}
                  value={settings.outside}
                  onChange={(e) => state.change({ dialing: { ...settings, outside: e.target.value } })}
                />
              </label>
            </GroupBox>
            <div className="flex gap-5 my-4">
              <Radio
                name="dial"
                label="Tone dialing"
                checked={settings.tone}
                onChange={() => state.change({ dialing: { ...settings, tone: true } })}
              />
              <Radio
                name="dial"
                label="Pulse dialing"
                checked={!settings.tone}
                onChange={() => state.change({ dialing: { ...settings, tone: false } })}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setDial(false)} isDefault>
                OK
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  )
}

export function HardwareWizard({ onClose }: { onClose: () => void }) {
  const [detect, setDetect] = useState(true)
  return (
    <Wizard
      title="Add New Hardware Wizard"
      onClose={onClose}
      pages={[
        <div key="welcome">
          <p>This wizard searches for new hardware and helps you install it.</p>
          <p className="mt-5">Before continuing, close any other programs you may be running.</p>
          <p className="mt-5">To begin, click Next.</p>
        </div>,
        <div key="detect">
          <p>Do you want Windows to search for your new hardware?</p>
          <div className="flex flex-col gap-4 mt-5">
            <Radio
              name="detect"
              label="Yes (Recommended)"
              checked={detect}
              onChange={() => setDetect(true)}
            />
            <Radio
              name="detect"
              label="No, I want to select the hardware from a list"
              checked={!detect}
              onChange={() => setDetect(false)}
            />
          </div>
        </div>,
        <div key="result">
          <p>
            {detect
              ? 'Windows did not find any new hardware on your computer.'
              : 'No additional hardware drivers are available on this computer.'}
          </p>
          <p className="mt-5">No hardware was installed. Click Finish to close this wizard.</p>
        </div>,
      ]}
    />
  )
}

export function JoystickProperties({ onClose }: { onClose: () => void }) {
  const state = useSettingsDraft()
  const joystick = state.draft.joystick
  return (
    <PropertySheet
      title="Joystick Properties"
      state={state}
      onClose={onClose}
      tabs={[
        {
          label: 'Joystick',
          content: (
            <>
              <GroupBox label="Joystick configuration" className="mt-3">
                <p className="block mb-2">Current joystick:</p>
                <ComboBox
                  aria-label="Current joystick"
                  value={joystick.type}
                  options={[
                    '(None)',
                    '2-axis, 2-button joystick',
                    '2-axis, 4-button joystick',
                    'Flight yoke',
                    'Gamepad',
                  ].map((label) => ({ key: label, label }))}
                  onChange={(type) => state.change({ joystick: { type } })}
                  className="w-full"
                />
                <p className="mt-5">
                  Status: {joystick.type === '(None)' ? 'No joystick selected' : 'Not connected'}
                </p>
                <div className="flex justify-end gap-2 mt-5">
                  <Button disabled>Calibrate...</Button>
                  <Button disabled>Test...</Button>
                </div>
              </GroupBox>
              <p className="mt-5">Connect a joystick to the game port before you calibrate or test it.</p>
            </>
          ),
        },
        {
          label: 'Advanced',
          content: (
            <GroupBox label="Port driver assignment" className="mt-3">
              <ComboBox
                aria-label="Joystick port"
                value="Game port joystick"
                options={[{ key: 'Game port joystick', label: 'Game port joystick' }]}
                onChange={() => {}}
              />
              <p className="mt-5">No game port is available.</p>
            </GroupBox>
          ),
        },
      ]}
    />
  )
}
