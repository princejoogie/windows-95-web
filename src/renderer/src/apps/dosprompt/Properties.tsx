import { useState } from 'react'
import { Button, Checkbox, Dialog, GroupBox, Radio } from '../../ui'
import { dosSmallIcon } from './icons'

export const FONTS = [
  { label: '8 x 12', width: 8, height: 12, size: 12 },
  { label: '8 x 16', width: 8, height: 16, size: 16 },
  { label: '10 x 18', width: 10, height: 18, size: 18 },
] as const

export interface Settings {
  readonly font: number
  readonly blink: boolean
  readonly toolbar: boolean
}

export function Properties({
  settings,
  onApply,
  onClose,
}: {
  settings: Settings
  onApply: (settings: Settings, full: boolean) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(settings)
  const [tab, setTab] = useState('Font')
  const [full, setFull] = useState(false)
  return (
    <Dialog title="MS-DOS Prompt Properties" icon={dosSmallIcon} onClose={onClose} className="w-[340px]">
      <div className="p-[8px]">
        <div
          role="tablist"
          aria-label="Properties"
          className="flex"
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault()
              const next = tab === 'Font' ? 'Screen' : 'Font'
              setTab(next)
              event.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus()
            }
          }}
        >
          {['Font', 'Screen'].map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              data-tab={name}
              aria-selected={tab === name}
              tabIndex={tab === name ? 0 : -1}
              className={`px-[10px] h-[22px] bevel-raised ${tab === name ? 'relative top-px bg-face' : ''}`}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          aria-label={tab}
          className="bevel-raised p-[12px] h-[196px] flex flex-col gap-[12px]"
        >
          {tab === 'Font' ? (
            <>
              <GroupBox label="Font size" className="flex flex-col gap-[6px]">
                {FONTS.map((font, index) => (
                  <Radio
                    key={font.label}
                    name="dos-font"
                    label={font.label}
                    checked={draft.font === index}
                    onChange={() => setDraft({ ...draft, font: index })}
                  />
                ))}
              </GroupBox>
              <div
                className="bg-black text-[#c0c0c0] p-[8px] font-mono"
                style={{ fontSize: FONTS[draft.font]?.size }}
              >
                C:\WINDOWS&gt;_
              </div>
            </>
          ) : (
            <>
              <GroupBox label="Usage" className="flex flex-col gap-[8px]">
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
        </div>
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
