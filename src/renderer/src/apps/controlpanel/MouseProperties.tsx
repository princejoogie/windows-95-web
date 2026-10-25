import { useRef, useState } from 'react'
import { Button, ComboBox, ListBox } from '../../ui'
import { Checkbox, GroupBox, Radio } from '../../ui/fields'
import { appletIcons } from './icons'
import { DeviceGeneral } from './OtherApplets'
import { PropertySheet, useSettingsDraft } from './PropertySheet'

const pointerFiles = import.meta.glob<string>('../../assets/system/*.cur', {
  query: '?url',
  import: 'default',
  eager: true,
})
const pointers = [
  { name: 'Normal Select', file: 'arrow_r' },
  { name: 'Help Select', file: 'help_r' },
  { name: 'Working in Background', file: 'busy_r' },
  { name: 'Busy', file: 'wait_r' },
  { name: 'Text Select', file: 'beam_r' },
  { name: 'Unavailable', file: 'no_r' },
  { name: 'Vertical Resize', file: 'size4_r' },
  { name: 'Horizontal Resize', file: 'size3_r' },
  { name: 'Diagonal Resize 1', file: 'size1_r' },
  { name: 'Diagonal Resize 2', file: 'size2_r' },
  { name: 'Move', file: 'move_r' },
]

export function MouseProperties({ onClose }: { onClose: () => void }) {
  const state = useSettingsDraft()
  const { draft, change } = state
  const lastClick = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [pointer, setPointer] = useState('Normal Select')
  const mouse = draft.mouse
  return (
    <PropertySheet
      title="Mouse Properties"
      state={state}
      onClose={onClose}
      tabs={[
        {
          label: 'Buttons',
          content: (
            <>
              <GroupBox label="Button configuration" className="mb-4">
                <div className="flex gap-4 items-center">
                  <img src={appletIcons.mouse} width={48} height={48} alt="" />
                  <div className="flex flex-col gap-3">
                    <Radio
                      name="hand"
                      label="Right-handed"
                      checked={!mouse.swapped}
                      onChange={() => change({ mouse: { ...mouse, swapped: false } })}
                    />
                    <Radio
                      name="hand"
                      label="Left-handed"
                      checked={mouse.swapped}
                      onChange={() => change({ mouse: { ...mouse, swapped: true } })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <p>
                    Left Button:
                    <br />
                    {mouse.swapped ? 'Context Menu, Special Drag' : 'Normal Select, Normal Drag'}
                  </p>
                  <p>
                    Right Button:
                    <br />
                    {mouse.swapped ? 'Normal Select, Normal Drag' : 'Context Menu, Special Drag'}
                  </p>
                </div>
              </GroupBox>
              <GroupBox label="Double-click speed">
                <p>Double-click the jack-in-the-box to test your setting.</p>
                <div className="flex gap-5 items-center mt-3">
                  <div className="flex-1">
                    <input
                      aria-label="Double-click speed"
                      className="cp-slider"
                      type="range"
                      min={100}
                      max={900}
                      step={50}
                      value={1000 - mouse.doubleClickMs}
                      onChange={(event) =>
                        change({
                          mouse: { ...mouse, doubleClickMs: 1000 - event.currentTarget.valueAsNumber },
                        })
                      }
                    />
                    <div className="flex justify-between">
                      <span>Slow</span>
                      <span>Fast</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Jack-in-the-box double-click test"
                    aria-pressed={open}
                    className="relative w-[96px] h-[106px] bg-white bevel-sunken"
                    onClick={() => {
                      const now = performance.now()
                      if (lastClick.current !== null && now - lastClick.current <= mouse.doubleClickMs) {
                        setOpen(!open)
                        lastClick.current = null
                      } else lastClick.current = now
                    }}
                  >
                    {open && (
                      <span className="absolute left-[28px] top-[7px] text-[24px] text-[#800000]">
                        ★
                        <span className="block text-[14px] leading-[7px] text-black">
                          ╲╱
                          <br />
                          ╱╲
                        </span>
                      </span>
                    )}
                    <span className="absolute left-[27px] bottom-[12px] w-[42px] h-[34px] border-2 border-black bg-[#ffff00] text-[#ff0000] text-[24px] leading-[29px]">
                      ★
                    </span>
                    <span
                      className={`absolute left-[27px] w-[42px] h-[7px] border border-black bg-[#ff0000] ${open ? 'bottom-[48px] -rotate-12' : 'bottom-[45px]'}`}
                    />
                  </button>
                </div>
              </GroupBox>
            </>
          ),
        },
        {
          label: 'Pointers',
          content: (
            <>
              <p className="mb-2 mt-2">Scheme:</p>
              <div className="flex gap-2">
                <ComboBox
                  aria-label="Pointer scheme"
                  value="(None)"
                  options={[{ key: '(None)', label: '(None)' }]}
                  onChange={() => {}}
                  className="flex-1"
                />
                <Button disabled>Save As...</Button>
                <Button disabled>Delete</Button>
              </div>
              <p className="mt-4 mb-2">Customize:</p>
              <ListBox
                label="Mouse pointers"
                items={pointers.map((item) => item.name)}
                value={pointer}
                onChange={setPointer}
                className="h-[175px]"
                render={(name) => (
                  <span className="flex justify-between items-center h-[16px]">
                    <span>{name}</span>
                    <img
                      src={
                        pointerFiles[
                          `../../assets/system/${pointers.find((item) => item.name === name)?.file}.cur`
                        ]
                      }
                      alt=""
                      width={16}
                      height={16}
                      className="pixelated"
                    />
                  </span>
                )}
              />
              <div className="flex justify-end gap-2 mt-3">
                <Button disabled>Use Default</Button>
                <Button disabled>Browse...</Button>
              </div>
            </>
          ),
        },
        {
          label: 'Motion',
          content: (
            <>
              <GroupBox label="Pointer speed" className="mt-3">
                <p>Move the slider to adjust how fast the pointer moves.</p>
                <input
                  aria-label="Pointer speed"
                  className="cp-slider"
                  type="range"
                  min={1}
                  max={10}
                  value={mouse.motion}
                  onChange={(event) =>
                    change({ mouse: { ...mouse, motion: event.currentTarget.valueAsNumber } })
                  }
                />
                <div className="flex justify-between">
                  <span>Slow</span>
                  <span>Fast</span>
                </div>
              </GroupBox>
              <GroupBox label="Pointer trail" className="mt-5">
                <Checkbox
                  label="Show pointer trails"
                  checked={mouse.trails}
                  onChange={(event) => change({ mouse: { ...mouse, trails: event.target.checked } })}
                />
              </GroupBox>
            </>
          ),
        },
        {
          label: 'General',
          content: <DeviceGeneral name="Standard mouse" manufacturer="(Standard mouse types)" />,
        },
      ]}
    />
  )
}
