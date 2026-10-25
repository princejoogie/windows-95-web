import { useId, useState } from 'react'
import { Button, Dialog, Radio, TextArea, TextBox } from '../../ui'
import type { Bitmap, transform } from './bitmap'

export function AttributesDialog({
  image,
  onApply,
  onClose,
}: {
  image: Bitmap
  onApply: (width: number, height: number) => void
  onClose: () => void
}) {
  const [width, setWidth] = useState(image.width)
  const [height, setHeight] = useState(image.height)
  const id = useId()
  return (
    <Dialog title="Attributes" onClose={onClose} className="w-[270px]">
      <form
        className="flex flex-col gap-3 p-3"
        onSubmit={(event) => {
          event.preventDefault()
          onApply(width, height)
        }}
      >
        <p>Units: Pixels</p>
        <label htmlFor={`${id}-width`} className="flex items-center justify-between">
          Width:{' '}
          <TextBox
            id={`${id}-width`}
            aria-label="Width"
            type="number"
            min={1}
            max={2048}
            required
            value={width}
            className="w-[120px]"
            onChange={(event) => setWidth(Number(event.target.value))}
          />
        </label>
        <label htmlFor={`${id}-height`} className="flex items-center justify-between">
          Height:{' '}
          <TextBox
            id={`${id}-height`}
            aria-label="Height"
            type="number"
            min={1}
            max={2048}
            required
            value={height}
            className="w-[120px]"
            onChange={(event) => setHeight(Number(event.target.value))}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="submit" isDefault>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}

type Transform = Parameters<typeof transform>[1]
export function RotateDialog({
  onApply,
  onClose,
}: {
  onApply: (kind: Transform) => void
  onClose: () => void
}) {
  const [kind, setKind] = useState<Transform>('horizontal')
  const choices: readonly [Transform, string][] = [
    ['horizontal', 'Flip horizontal'],
    ['vertical', 'Flip vertical'],
    ['90', 'Rotate by angle 90°'],
    ['180', 'Rotate by angle 180°'],
    ['270', 'Rotate by angle 270°'],
  ]
  return (
    <Dialog title="Flip and Rotate" onClose={onClose} className="w-[280px]">
      <form
        className="flex flex-col gap-3 p-3"
        onSubmit={(event) => {
          event.preventDefault()
          onApply(kind)
        }}
      >
        {choices.map(([value, label]) => (
          <Radio
            key={value}
            label={label}
            name="paint-rotation"
            checked={kind === value}
            onChange={() => setKind(value)}
          />
        ))}
        <div className="flex justify-end gap-2">
          <Button type="submit" isDefault>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}
export function TextDialog({
  onApply,
  onClose,
}: {
  onApply: (text: string, size: number) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [size, setSize] = useState(16)
  const id = useId()
  return (
    <Dialog title="Text" onClose={onClose} className="w-[300px]">
      <form
        className="flex flex-col gap-3 p-3"
        onSubmit={(event) => {
          event.preventDefault()
          onApply(text, size)
        }}
      >
        <TextArea
          aria-label="Text to draw"
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="h-[100px]"
        />
        <label htmlFor={`${id}-size`} className="flex items-center gap-2">
          Size:{' '}
          <TextBox
            id={`${id}-size`}
            aria-label="Font size"
            type="number"
            min={6}
            max={96}
            required
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="submit" isDefault>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}
