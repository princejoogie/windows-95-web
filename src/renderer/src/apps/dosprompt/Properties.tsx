import { useId, useState } from 'react'
import { Button, Checkbox, ComboBox, Dialog, GroupBox, ListBox, Radio, Tabs, TextBox } from '../../ui'
import { dosSmallIcon } from './icons'

export const FONTS = [
  { label: '8 x 12', width: 8, height: 12, size: 12 },
  { label: '8 x 16', width: 8, height: 16, size: 16 },
  { label: '10 x 18', width: 10, height: 18, size: 18 },
  { label: 'Auto', width: 8, height: 16, size: 16 },
] as const

export interface Settings {
  readonly font: number
  readonly blink: boolean
  readonly toolbar: boolean
}

const tabs = ['Program', 'Font', 'Memory', 'Screen', 'Misc'] as const

export function Properties({
  settings,
  initialTab,
  onApply,
  onClose,
}: {
  settings: Settings
  initialTab: 'Program' | 'Font'
  onApply: (settings: Settings, full: boolean) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(settings)
  const [tab, setTab] = useState<(typeof tabs)[number]>(initialTab)
  const [full, setFull] = useState(false)
  const id = useId()
  const auto = [{ key: 'auto', label: 'Auto' }]
  return (
    <Dialog title="MS-DOS Prompt Properties" icon={dosSmallIcon} onClose={onClose} className="w-[390px]">
      <div className="p-[8px]">
        <Tabs
          tabs={tabs}
          active={tab}
          onChange={setTab}
          pageClassName="bevel-raised p-[12px] h-[252px] flex flex-col gap-[12px]"
        >
          {tab === 'Program' && (
            <>
              <div className="flex items-center gap-3">
                <img src={dosSmallIcon} alt="" className="size-8" />
                <TextBox aria-label="Program name" value="MS-DOS Prompt" readOnly className="flex-1" />
              </div>
              <label htmlFor={`${id}-command`} className="flex gap-2 items-center">
                Cmd line:
                <TextBox
                  id={`${id}-command`}
                  value={'C:\\WINDOWS\\COMMAND.COM'}
                  readOnly
                  className="flex-1"
                />
              </label>
              <label htmlFor={`${id}-working`} className="flex gap-2 items-center">
                Working:
                <TextBox id={`${id}-working`} value={'C:\\WINDOWS'} readOnly className="flex-1" />
              </label>
              <label htmlFor={`${id}-batch`} className="flex gap-2 items-center">
                Batch file:
                <TextBox id={`${id}-batch`} value="" readOnly className="flex-1" />
              </label>
              <Checkbox label="Close on exit" checked readOnly />
              <div className="flex justify-end gap-2">
                <Button disabled>Change Icon...</Button>
                <Button disabled>Advanced...</Button>
              </div>
            </>
          )}
          {tab === 'Font' && (
            <>
              <div className="flex gap-3">
                <GroupBox label="Font size" className="w-[110px]">
                  <ListBox
                    label="Font size"
                    className="h-[90px]"
                    items={[3, 0, 1, 2]}
                    value={draft.font}
                    onChange={(font) => setDraft({ ...draft, font })}
                    render={(font) => FONTS[font]?.label}
                  />
                </GroupBox>
                <GroupBox label="Window preview" className="flex-1">
                  <div className="bevel-window bg-face p-[3px] h-[90px]">
                    <div className="h-[10px] bg-title" />
                    <div className="bg-black text-white h-[65px] p-1 font-mono text-[8px]">
                      Microsoft Windows 95
                      <br />
                      C:\WINDOWS&gt;_
                    </div>
                  </div>
                </GroupBox>
              </div>
              <GroupBox label="Font preview">
                <div
                  className="bg-black text-[#c0c0c0] p-2 font-mono h-[54px]"
                  style={{ fontSize: FONTS[draft.font]?.size }}
                >
                  C:\WINDOWS&gt;_
                  <br />
                  AaBbYyZz 0123456789
                </div>
              </GroupBox>
            </>
          )}
          {tab === 'Memory' &&
            [
              'Conventional memory',
              'Expanded (EMS) memory',
              'Extended (XMS) memory',
              'MS-DOS protected-mode (DPMI) memory',
            ].map((label) => (
              <GroupBox key={label} label={label} className="flex items-center gap-3 py-1!">
                <span>Total:</span>
                <ComboBox
                  aria-label={label}
                  className="w-[105px]"
                  value="auto"
                  options={auto}
                  onChange={() => undefined}
                />
              </GroupBox>
            ))}
          {tab === 'Screen' && (
            <>
              <GroupBox label="Usage" className="flex flex-col gap-2">
                <Radio name="dos-screen" label="Window" checked={!full} onChange={() => setFull(false)} />
                <Radio name="dos-screen" label="Full-screen" checked={full} onChange={() => setFull(true)} />
              </GroupBox>
              <Checkbox
                label="Display toolbar"
                checked={draft.toolbar}
                onChange={(event) => setDraft({ ...draft, toolbar: event.target.checked })}
              />
              <Checkbox
                label="Blinking cursor"
                checked={draft.blink}
                onChange={(event) => setDraft({ ...draft, blink: event.target.checked })}
              />
            </>
          )}
          {tab === 'Misc' && (
            <>
              <GroupBox label="Foreground">
                <Checkbox label="Allow screen saver" checked readOnly />
              </GroupBox>
              <GroupBox label="Background">
                <Checkbox label="Always suspend" checked={false} readOnly />
              </GroupBox>
              <GroupBox label="Termination">
                <Checkbox label="Warn if still active" checked readOnly />
              </GroupBox>
              <GroupBox label="Other">
                <Checkbox label="Fast pasting" checked readOnly />
              </GroupBox>
            </>
          )}
        </Tabs>
        <div className="flex justify-end gap-[6px] pt-[10px]">
          <Button
            isDefault
            onClick={() => {
              onApply(draft, full)
              onClose()
            }}
          >
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={() => onApply(draft, full)}>Apply</Button>
        </div>
      </div>
    </Dialog>
  )
}
