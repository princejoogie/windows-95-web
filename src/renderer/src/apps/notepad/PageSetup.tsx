import { useId, useState } from 'react'
import { Button, Dialog, GroupBox, Radio, TextBox } from '../../ui'

export interface PageSettings {
  paper: string
  orientation: 'portrait' | 'landscape'
  margins: { left: string; right: string; top: string; bottom: string }
  header: string
  footer: string
}

export const defaultPageSettings: PageSettings = {
  paper: 'Letter',
  orientation: 'portrait',
  margins: { left: '0.75', right: '0.75', top: '1', bottom: '1' },
  header: '&f',
  footer: 'Page &p',
}

export function PageSetup({
  settings,
  onSave,
  onCancel,
}: {
  settings: PageSettings
  onSave: (settings: PageSettings) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(settings)
  const id = useId()
  return (
    <Dialog title="Page Setup" onClose={onCancel} className="w-[395px]">
      <form
        className="flex flex-col gap-[10px] p-[12px]"
        onSubmit={(event) => {
          event.preventDefault()
          onSave(draft)
        }}
      >
        <GroupBox label="Paper">
          <div className="grid grid-cols-[50px_1fr] gap-[6px] items-center">
            <label htmlFor={`${id}-paper`}>Size:</label>
            <select
              id={`${id}-paper`}
              className="bevel-sunken bg-white h-[21px]"
              value={draft.paper}
              onChange={(event) => setDraft({ ...draft, paper: event.target.value })}
            >
              {['Letter', 'Legal', 'A4', 'A5', 'B5'].map((paper) => (
                <option key={paper}>{paper}</option>
              ))}
            </select>
            <label htmlFor={`${id}-source`}>Source:</label>
            <select id={`${id}-source`} disabled className="bevel-sunken h-[21px]">
              <option>Automatically Select</option>
            </select>
          </div>
        </GroupBox>
        <div className="flex gap-[12px]">
          <GroupBox label="Orientation" className="w-[110px] flex flex-col gap-[8px]">
            <Radio
              label="Portrait"
              name={`${id}-orientation`}
              checked={draft.orientation === 'portrait'}
              onChange={() => setDraft({ ...draft, orientation: 'portrait' })}
            />
            <Radio
              label="Landscape"
              name={`${id}-orientation`}
              checked={draft.orientation === 'landscape'}
              onChange={() => setDraft({ ...draft, orientation: 'landscape' })}
            />
          </GroupBox>
          <GroupBox label="Margins (inches)" className="flex-1 grid grid-cols-2 gap-[6px]">
            {(['left', 'right', 'top', 'bottom'] as const).map((side) => (
              <label key={side} htmlFor={`${id}-${side}`} className="flex items-center gap-[4px] capitalize">
                {side}:
                <TextBox
                  id={`${id}-${side}`}
                  aria-label={`${side} margin`}
                  type="number"
                  min="0"
                  max="20"
                  step="0.01"
                  required
                  className="w-[48px]"
                  value={draft.margins[side]}
                  onChange={(event) =>
                    setDraft({ ...draft, margins: { ...draft.margins, [side]: event.target.value } })
                  }
                />
              </label>
            ))}
          </GroupBox>
        </div>
        <label htmlFor={`${id}-header`} className="flex items-center gap-[10px]">
          Header:
          <TextBox
            id={`${id}-header`}
            className="flex-1"
            value={draft.header}
            onChange={(event) => setDraft({ ...draft, header: event.target.value })}
          />
        </label>
        <label htmlFor={`${id}-footer`} className="flex items-center gap-[10px]">
          Footer:
          <TextBox
            id={`${id}-footer`}
            className="flex-1"
            value={draft.footer}
            onChange={(event) => setDraft({ ...draft, footer: event.target.value })}
          />
        </label>
        <div className="flex justify-end gap-[6px]">
          <Button isDefault type="submit">
            OK
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}
