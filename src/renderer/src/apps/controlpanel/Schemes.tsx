import { useId, useState } from 'react'
import { parseSettings, type Settings } from '../../settings/model'
import { Button, Dialog, TextBox } from '../../ui'

export function useSavedSchemes(kind: 'appearance' | 'sounds') {
  const key = `win95.schemes.${kind}.v1`
  const [saved, setSaved] = useState<Readonly<Record<string, Settings>>>(() => {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(key) ?? '{}')
      return raw && typeof raw === 'object' && !Array.isArray(raw)
        ? Object.fromEntries(Object.entries(raw).map(([name, value]) => [name, parseSettings(value)]))
        : {}
    } catch {
      return {}
    }
  })
  const write = (next: Readonly<Record<string, Settings>>) => {
    localStorage.setItem(key, JSON.stringify(next))
    setSaved(next)
  }
  return {
    saved,
    save: (name: string, settings: Settings) => write({ ...saved, [name]: settings }),
    remove: (name: string) =>
      write(Object.fromEntries(Object.entries(saved).filter(([key]) => key !== name))),
  }
}

export function SaveScheme({ onSave, onClose }: { onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const id = useId()
  return (
    <Dialog title="Save Scheme" onClose={onClose}>
      <form
        className="p-3 w-[300px]"
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) onSave(name.trim())
        }}
      >
        <label htmlFor={id} className="block">
          Save this scheme as:
          <TextBox
            id={id}
            aria-label="Scheme name"
            className="w-full mt-3"
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2 mt-4">
          <Button type="submit" isDefault disabled={!name.trim()}>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}
