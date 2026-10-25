import { useState } from 'react'
import type { AccessibilityFeature, AccessibilityFeatures } from '../../settings/featureSettings'
import { Button, Checkbox, ComboBox, Dialog, GroupBox, Radio } from '../../ui'

export function AccessibilityFeatureDialog({
  feature,
  features,
  onOK,
  onClose,
}: {
  feature: AccessibilityFeature
  features: AccessibilityFeatures
  onOK: (features: AccessibilityFeatures) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(features)
  const change = <K extends AccessibilityFeature>(key: K, patch: Partial<AccessibilityFeatures[K]>) =>
    setDraft((current) => ({ ...current, [key]: { ...current[key], ...patch } }))
  const checkbox = (label: string, checked: boolean, update: (value: boolean) => void) => (
    <Checkbox
      label={label}
      checked={checked}
      onChange={(event) => update(event.target.checked)}
      className="my-2"
    />
  )
  const combo = (
    label: string,
    value: string,
    options: readonly string[],
    update: (value: string) => void,
  ) => (
    <div className="flex items-center justify-between gap-3 my-2">
      {label}:
      <ComboBox
        aria-label={label}
        className="w-[170px]"
        value={value}
        options={options.map((key) => ({ key, label: key }))}
        onChange={update}
      />
    </div>
  )
  const shortcut = (checked: boolean, update: (value: boolean) => void, help: string) => (
    <GroupBox label="Keyboard shortcut">
      {checkbox(`Use shortcut for ${feature}`, checked, update)}
      <p className="mt-3">{help}</p>
    </GroupBox>
  )
  const content = () => {
    switch (feature) {
      case 'StickyKeys': {
        const value = draft.StickyKeys
        return (
          <>
            {shortcut(
              value.shortcut,
              (shortcut) => change(feature, { shortcut }),
              'Press the SHIFT key five times to turn StickyKeys on or off.',
            )}
            <GroupBox label="Options" className="mt-3">
              {checkbox('Press modifier key twice to lock', value.lock, (lock) => change(feature, { lock }))}
              {checkbox(
                'Turn StickyKeys off if two keys are pressed at once',
                value.twoKeysOff,
                (twoKeysOff) => change(feature, { twoKeysOff }),
              )}
            </GroupBox>
            <GroupBox label="Notification" className="mt-3">
              {checkbox('Make sounds when modifier keys are pressed', value.sound, (sound) =>
                change(feature, { sound }),
              )}
              {checkbox('Display StickyKeys status on screen', value.status, (status) =>
                change(feature, { status }),
              )}
            </GroupBox>
          </>
        )
      }
      case 'FilterKeys': {
        const value = draft.FilterKeys
        return (
          <>
            {shortcut(
              value.shortcut,
              (shortcut) => change(feature, { shortcut }),
              'Hold down the RIGHT SHIFT key for eight seconds.',
            )}
            <GroupBox label="Filter options" className="mt-3">
              <Radio
                name="filter-mode"
                label="Ignore quick keystrokes and slow down the repeat rate"
                checked={value.mode === 'repeat'}
                onChange={() => change(feature, { mode: 'repeat' })}
              />
              <Radio
                name="filter-mode"
                label="Ignore repeated keystrokes"
                className="mt-2"
                checked={value.mode === 'bounce'}
                onChange={() => change(feature, { mode: 'bounce' })}
              />
              {value.mode === 'bounce' ? (
                combo(
                  'Ignore repeats for seconds',
                  String(value.bounceSeconds),
                  ['0.5', '0.7', '1', '1.5', '2'],
                  (value) => change(feature, { bounceSeconds: Number(value) }),
                )
              ) : (
                <>
                  {combo(
                    'Accept keys after seconds',
                    String(value.acceptSeconds),
                    ['0', '0.3', '0.5', '1', '1.5', '2'],
                    (value) => change(feature, { acceptSeconds: Number(value) }),
                  )}
                  {combo(
                    'Repeat delay seconds',
                    String(value.repeatDelay),
                    ['0.3', '0.5', '0.7', '1', '1.5', '2'],
                    (value) => change(feature, { repeatDelay: Number(value) }),
                  )}
                  {combo(
                    'Repeat rate seconds',
                    String(value.repeatSeconds),
                    ['0.3', '0.5', '0.7', '1', '1.5', '2'],
                    (value) => change(feature, { repeatSeconds: Number(value) }),
                  )}
                </>
              )}
            </GroupBox>
            {checkbox('Beep when keys are pressed or accepted', value.beep, (beep) =>
              change(feature, { beep }),
            )}
            {checkbox('Display FilterKeys status on screen', value.status, (status) =>
              change(feature, { status }),
            )}
          </>
        )
      }
      case 'ToggleKeys':
        return shortcut(
          draft.ToggleKeys.shortcut,
          (shortcut) => change(feature, { shortcut }),
          'Hold down the NUM LOCK key for five seconds to turn ToggleKeys on or off.',
        )
      case 'SoundSentry':
        return (
          <GroupBox label="Visual warning">
            <p className="mb-3">Choose the warning Windows displays when a sound occurs.</p>
            {combo(
              'Warning for windowed programs',
              draft.SoundSentry.effect,
              ['None', 'Flash active caption bar', 'Flash active window', 'Flash desktop'],
              (effect) => change(feature, { effect }),
            )}
          </GroupBox>
        )
      case 'High Contrast':
        return (
          <>
            {shortcut(
              draft[feature].shortcut,
              (shortcut) => change(feature, { shortcut }),
              'Press LEFT ALT + LEFT SHIFT + PRINT SCREEN.',
            )}
            <GroupBox label="Color scheme" className="mt-3">
              {combo(
                'High contrast scheme',
                draft[feature].scheme,
                ['High Contrast Black', 'High Contrast White', 'High Contrast #1', 'High Contrast #2'],
                (scheme) => change(feature, { scheme }),
              )}
            </GroupBox>
          </>
        )
      case 'MouseKeys': {
        const value = draft.MouseKeys
        return (
          <>
            {shortcut(
              value.shortcut,
              (shortcut) => change(feature, { shortcut }),
              'Press LEFT ALT + LEFT SHIFT + NUM LOCK.',
            )}
            <GroupBox label="Pointer speed" className="mt-3">
              {(['speed', 'acceleration'] as const).map((key) => (
                <label key={key} className="block mt-2">
                  {key === 'speed' ? 'Top speed' : 'Acceleration'}
                  <input
                    className="cp-slider"
                    aria-label={key === 'speed' ? 'MouseKeys top speed' : 'MouseKeys acceleration'}
                    type="range"
                    min={1}
                    max={10}
                    value={value[key]}
                    onChange={(event) => change(feature, { [key]: event.target.valueAsNumber })}
                  />
                </label>
              ))}
              {checkbox(
                'Hold down Ctrl to speed up and Shift to slow down',
                value.controlSpeed,
                (controlSpeed) => change(feature, { controlSpeed }),
              )}
            </GroupBox>
            {combo('Use MouseKeys when Num Lock is', value.numLock, ['On', 'Off'], (numLock) =>
              change(feature, { numLock: numLock === 'Off' ? 'Off' : 'On' }),
            )}
            {checkbox('Display MouseKeys status on screen', value.status, (status) =>
              change(feature, { status }),
            )}
          </>
        )
      }
      case 'SerialKeys':
        return (
          <GroupBox label="Serial input device">
            {combo('Serial port', draft.SerialKeys.port, ['COM1', 'COM2', 'COM3', 'COM4'], (port) =>
              change(feature, { port }),
            )}
            {combo(
              'Baud rate',
              draft.SerialKeys.baud,
              ['300', '1200', '2400', '4800', '9600', '19200'],
              (baud) => change(feature, { baud }),
            )}
            <p className="mt-3">
              No serial input device is connected. These settings are stored for the virtual computer.
            </p>
          </GroupBox>
        )
    }
  }
  return (
    <Dialog title={`Settings for ${feature}`} onClose={onClose}>
      <div className="p-3 w-[390px]">
        {content()}
        <div className="flex justify-end gap-2 mt-4">
          <Button
            isDefault
            onClick={() => {
              onOK(draft)
              onClose()
            }}
          >
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  )
}
