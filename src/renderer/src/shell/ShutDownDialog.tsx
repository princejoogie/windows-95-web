import { useState } from 'react'
import { icons } from '../icons'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Radio } from '../ui/fields'

export type ShutDownChoice = 'shutdown' | 'restart' | 'dos' | 'logoff'

const CHOICES: { value: ShutDownChoice; label: string }[] = [
  { value: 'shutdown', label: 'Shut down the computer?' },
  { value: 'restart', label: 'Restart the computer?' },
  { value: 'dos', label: 'Restart the computer in MS-DOS mode?' },
  { value: 'logoff', label: 'Close all programs and log on as a different user?' },
]

export function ShutDownDialog({
  onChoose,
  onClose,
  onHelp,
}: {
  onChoose: (choice: ShutDownChoice) => void
  onClose: () => void
  onHelp: () => void
}) {
  const [choice, setChoice] = useState<ShutDownChoice>('shutdown')
  return (
    <Dialog title="Shut Down Windows" onClose={onClose} dim className="w-[390px]">
      <form
        className="flex gap-[14px] p-[12px]"
        onKeyDown={(event) => {
          if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
          event.preventDefault()
          const index = CHOICES.findIndex((option) => option.value === choice)
          const next =
            CHOICES[
              (index + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : CHOICES.length - 1)) %
                CHOICES.length
            ]
          if (next) {
            setChoice(next.value)
            event.currentTarget.querySelector<HTMLInputElement>(`input[value="${next.value}"]`)?.focus()
          }
        }}
        onSubmit={(event) => {
          event.preventDefault()
          onChoose(choice)
        }}
      >
        <img src={icons.start.shutDown} alt="" className="size-8" />
        <div className="flex flex-col gap-[8px] flex-1">
          <p>Are you sure you want to:</p>
          {CHOICES.map((option) => (
            <Radio
              key={option.value}
              name="shutdown"
              value={option.value}
              tabIndex={choice === option.value ? 0 : -1}
              label={option.label}
              checked={choice === option.value}
              onChange={() => setChoice(option.value)}
            />
          ))}
          <div className="flex gap-[6px] pt-[6px]">
            <Button type="submit" isDefault autoFocus>
              Yes
            </Button>
            <Button onClick={onClose}>No</Button>
            <Button onClick={onHelp}>Help</Button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
