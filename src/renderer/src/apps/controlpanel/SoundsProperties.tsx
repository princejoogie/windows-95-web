import { useState } from 'react'
import { defaultSettings, type SoundEvent, soundEvents, soundNames } from '../../settings/model'
import { previewSound } from '../../settings/sounds'
import { Button } from '../../ui/Button'
import { ComboBox } from '../../ui/ComboBox'
import { GroupBox } from '../../ui/fields'
import { appletIcons } from './icons'
import { PropertySheet, useSettingsDraft } from './PropertySheet'

export function SoundsProperties({ onClose }: { onClose: () => void }) {
  const state = useSettingsDraft()
  const [event, setEvent] = useState<SoundEvent>('Asterisk')
  const [error, setError] = useState('')
  const sounds = state.draft.soundScheme
  return (
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
                <ComboBox
                  aria-label="Sound events"
                  value={event}
                  onChange={(value) => setEvent(soundEvents.find((name) => name === value) ?? 'Asterisk')}
                  options={soundEvents.map((name) => ({ key: name, label: name }))}
                />
              </div>
              <GroupBox label="Sound" className="mt-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-2 items-center flex-1">
                    Name:
                    <ComboBox
                      aria-label="Sound name"
                      className="flex-1"
                      value={sounds[event]}
                      onChange={(value) =>
                        state.change({
                          soundScheme: {
                            ...sounds,
                            [event]: soundNames.find((name) => name === value) ?? '(None)',
                          },
                        })
                      }
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
              </GroupBox>
              <div className="flex items-center gap-2 mt-3">
                Schemes:
                <ComboBox
                  aria-label="Sound scheme"
                  className="flex-1"
                  value={
                    Object.values(sounds).every((name) => name === '(None)')
                      ? 'No Sounds'
                      : JSON.stringify(sounds) === JSON.stringify(defaultSettings.soundScheme)
                        ? 'Windows Default'
                        : '(Modified)'
                  }
                  onChange={(value) => {
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
                  options={['Windows Default', 'No Sounds', '(Modified)'].map((name) => ({
                    key: name,
                    label: name,
                  }))}
                />
              </div>
              <p role="status" className="mt-2">
                {error}
              </p>
            </>
          ),
        },
      ]}
    />
  )
}
