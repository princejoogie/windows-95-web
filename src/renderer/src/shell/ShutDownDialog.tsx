import { useState } from 'react'
import { icons } from '../icons'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Radio } from '../ui/fields'

export type ShutDownChoice = 'shutdown' | 'restart'

const CHOICES: { value: ShutDownChoice; label: string }[] = [
  { value: 'shutdown', label: 'Shut down the computer?' },
  { value: 'restart', label: 'Restart the computer?' },
]

export function ShutDownDialog({ onChoose, onClose }: { onChoose: (choice: ShutDownChoice) => void; onClose: () => void }) {
  const [choice, setChoice] = useState<ShutDownChoice>('shutdown')
  return (
    <Dialog title="Shut Down Windows" onClose={onClose} dim className="w-[335px]">
      <form
        className="flex gap-[14px] p-[12px]"
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
          </div>
        </div>
      </form>
    </Dialog>
  )
}
