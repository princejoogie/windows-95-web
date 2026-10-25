import { useEffect, useState } from 'react'
import { defaultSettings, type SoundEvent, soundEvents, soundNames } from '../../settings/model'
import { previewSound } from '../../settings/sounds'
import { Dialog, FileDialog, ListBox } from '../../ui'
import { Button } from '../../ui/Button'
import { ComboBox } from '../../ui/ComboBox'
import { GroupBox } from '../../ui/fields'
import { appletIcons } from './icons'
import { PropertySheet, useSettingsDraft } from './PropertySheet'
import { SaveScheme, useSavedSchemes } from './Schemes'

export function SoundsProperties({ onClose }: { onClose: () => void }) {
  const state = useSettingsDraft()
  const [event, setEvent] = useState<SoundEvent>('Asterisk')
  const [error, setError] = useState('')
  const sounds = state.draft.soundScheme
  const savedSchemes = useSavedSchemes('sounds')
  const [scheme, setScheme] = useState('Windows Default')
  const [save, setSave] = useState(false)
  const [browse, setBrowse] = useState(false)
  const [details, setDetails] = useState(false)
  const [expanded, setExpanded] = useState(true)
  return (
    <>
      <PropertySheet
        title="Sounds Properties"
        state={state}
        onClose={onClose}
        tabs={[
          {
            label: 'Sounds',
            content: (
              <>
                <div className="flex gap-3 items-center mb-3">
                  <img src={appletIcons.sounds} width={32} height={32} alt="" />
                  <p>Select an event, then choose the sound to play.</p>
                </div>
                <div className="flex flex-col gap-1">
                  Events:
                  <div className="bevel-sunken bg-white h-[140px] overflow-auto p-1">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      className="flex items-center gap-1"
                      onClick={() => setExpanded(!expanded)}
                    >
                      <span className="border border-shadow w-[9px] h-[9px] leading-[6px]">
                        {expanded ? '-' : '+'}
                      </span>
                      <img src={appletIcons.sounds} alt="" width={16} height={16} />
                      Windows
                    </button>
                    {expanded && (
                      <ListBox
                        label="Sound events"
                        className="ml-3 shadow-none!"
                        value={event}
                        onChange={(value) =>
                          setEvent(soundEvents.find((name) => name === value) ?? 'Asterisk')
                        }
                        items={soundEvents}
                        render={(name) => (
                          <span className="flex gap-2 items-center">
                            <span className="w-[8px] h-[16px] border-l border-b border-dotted border-shadow" />
                            <img src={appletIcons.sounds} alt="" width={16} height={16} />
                            {name}
                          </span>
                        )}
                      />
                    )}
                  </div>
                </div>
                <GroupBox label="Sound" className="mt-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-2 items-center flex-1">
                      Name:
                      <ComboBox
                        aria-label="Sound name"
                        className="flex-1"
                        value={sounds[event]}
                        onChange={(value) => {
                          setScheme('(Modified)')
                          state.change({
                            soundScheme: {
                              ...sounds,
                              [event]: soundNames.find((name) => name === value) ?? '(None)',
                            },
                          })
                        }}
                        options={soundNames.map((name) => ({ key: name, label: name }))}
                      />
                    </div>
                    <Button
                      aria-label="Preview sound"
                      className="min-w-[28px]! px-1!"
                      disabled={sounds[event] === '(None)'}
                      onClick={() => {
                        setError('')
                        void previewSound(sounds[event]).then((result) =>
                          setError(
                            result
                              ? `Playing ${sounds[event]}.`
                              : 'The sound is unavailable or the audio device is not ready.',
                          ),
                        )
                      }}
                    >
                      ▶
                    </Button>
                  </div>
                  <div className="flex justify-end gap-2 mt-3">
                    <Button onClick={() => setBrowse(true)}>Browse...</Button>
                    <Button disabled={sounds[event] === '(None)'} onClick={() => setDetails(true)}>
                      Details...
                    </Button>
                  </div>
                </GroupBox>
                <div className="flex items-center gap-2 mt-3">
                  Schemes:
                  <ComboBox
                    aria-label="Sound scheme"
                    className="flex-1"
                    value={scheme}
                    onChange={(value) => {
                      setScheme(value)
                      const saved = savedSchemes.saved[value]
                      if (saved) {
                        state.change({ soundScheme: saved.soundScheme })
                        return
                      }
                      if (value === 'Windows Default')
                        state.change({ soundScheme: defaultSettings.soundScheme })
                      if (value === 'No Sounds')
                        state.change({
                          soundScheme: {
                            ...sounds,
                            ...Object.fromEntries(soundEvents.map((name) => [name, '(None)'])),
                          },
                        })
                    }}
                    options={[
                      ...new Set([
                        'Windows Default',
                        'No Sounds',
                        '(Modified)',
                        ...Object.keys(savedSchemes.saved),
                      ]),
                    ].map((name) => ({
                      key: name,
                      label: name,
                    }))}
                  />
                  <Button onClick={() => setSave(true)}>Save As...</Button>
                  <Button
                    disabled={!savedSchemes.saved[scheme]}
                    onClick={() => {
                      savedSchemes.remove(scheme)
                      setScheme('(Modified)')
                    }}
                  >
                    Delete
                  </Button>
                </div>
                <p role="status" className="mt-2">
                  {error}
                </p>
              </>
            ),
          },
        ]}
      />
      {save && (
        <SaveScheme
          onClose={() => setSave(false)}
          onSave={(name) => {
            savedSchemes.save(name, state.draft)
            setScheme(name)
            setSave(false)
          }}
        />
      )}
      {browse && (
        <FileDialog
          title="Browse"
          mode="open"
          filters={[{ label: 'Sounds (*.wav)', extensions: ['wav'] }]}
          onCancel={() => setBrowse(false)}
          onSelect={(result) => {
            const sound = soundNames.find(
              (sound) => `${sound}.wav`.toLowerCase() === result.name.toLowerCase(),
            )
            if (sound) {
              state.change({ soundScheme: { ...sounds, [event]: sound } })
              setScheme('(Modified)')
            } else setError('This sound file is not available.')
            setBrowse(false)
          }}
        />
      )}
      {details && <SoundDetails sound={sounds[event]} onClose={() => setDetails(false)} />}
    </>
  )
}

const soundFiles = import.meta.glob<string>('../../assets/system/*.wav', {
  query: '?url',
  import: 'default',
  eager: true,
})
function SoundDetails({ sound, onClose }: { sound: string; onClose: () => void }) {
  const [info, setInfo] = useState('Reading sound information...')
  useEffect(() => {
    let active = true
    const url = soundFiles[`../../assets/system/${sound}.wav`]
    if (!url) {
      setInfo('The sound file is not available.')
      return
    }
    void fetch(url)
      .then((response) => response.arrayBuffer())
      .then((bytes) => {
        if (!active) return
        const wave = new DataView(bytes)
        setInfo(
          `File: ${sound}.wav\nSize: ${bytes.byteLength.toLocaleString('en-US')} bytes\nAudio format: PCM\nSample rate: ${wave.getUint32(24, true).toLocaleString('en-US')} Hz\nChannels: ${wave.getUint16(22, true)}\nBits per sample: ${wave.getUint16(34, true)}`,
        )
      })
      .catch(() => {
        if (active) setInfo('The sound file is not available.')
      })
    return () => {
      active = false
    }
  }, [sound])
  return (
    <Dialog title="Sound Details" onClose={onClose}>
      <div className="p-3 w-[300px]">
        <p className="whitespace-pre-line">{info}</p>
        <div className="text-right mt-4">
          <Button isDefault onClick={onClose}>
            OK
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
