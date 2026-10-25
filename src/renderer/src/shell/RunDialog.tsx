import { useEffect, useRef, useState } from 'react'
import { pathOf, resolvePath } from '../fs/fs'
import { fs } from '../fs/store'
import { WINDOWS_DIR } from '../fs/types'
import { icons } from '../icons'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { FileDialog, type FileTypeFilter } from '../ui/FileDialog'
import { TextBox } from '../ui/fields'
import { MenuList } from '../ui/Menu'
import { MessageBox } from '../ui/MessageBox'
import { shellEvents } from './events'
import { findAppByExe } from './registry'
import { launch, openNode } from './system'

const HISTORY_KEY = 'w95.run.v1'
const BROWSE_FILTERS: readonly FileTypeFilter[] = [
  { label: 'Programs', extensions: ['exe', 'pif', 'com', 'bat'] },
  { label: 'All Files (*.*)', extensions: ['*'] },
]
function history(): string[] {
  const raw = localStorage.getItem(HISTORY_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 26)
      : []
  } catch {
    return [raw]
  }
}

/** Start > Run. Accepts a program name such as `winmine` or a path such as `C:\My Documents`. */
export function RunDialog({ onClose }: { onClose: () => void }) {
  const [recent] = useState(history)
  const [value, setValue] = useState(() => recent[0] ?? '')
  const [drop, setDrop] = useState(false)
  const [browse, setBrowse] = useState(false)
  const [picked, setPicked] = useState(0)
  const form = useRef<HTMLFormElement>(null)
  // Runs after Browse has handed focus back to its opener, so OK ends up focused, as in Windows 95.
  useEffect(() => {
    if (picked) form.current?.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus()
  }, [picked])
  const [error, setError] = useState<string | null>(null)

  const run = () => {
    const command = value.trim()
    if (!command) return
    const node = resolvePath(fs.get(), command)
    const app = node ? undefined : findAppByExe(command.split('\\').pop() ?? command)
    const ok = node ? openNode(node.id) : app ? launch(app.id) !== null : false
    if (!ok) {
      shellEvents.emit('error')
      setError(
        `Cannot find the file '${command}' (or one of its components). Make sure the path and filename are correct and that all required libraries are available.`,
      )
      return
    }
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(
        [command, ...recent.filter((item) => item.toLowerCase() !== command.toLowerCase())].slice(0, 26),
      ),
    )
    onClose()
  }

  return (
    <Dialog title="Run" onClose={onClose} initialPosition={{ left: 4, bottom: 4 }} className="w-[347px]">
      <form
        ref={form}
        className="flex flex-col gap-[10px] p-[10px]"
        onSubmit={(event) => {
          event.preventDefault()
          run()
        }}
      >
        <div className="flex items-start gap-[12px]">
          <img src={icons.start.run} alt="" className="size-8" />
          <p>Type the name of a program, folder, or document, and Windows will open it for you.</p>
        </div>
        <label htmlFor="run-command" className="flex items-center gap-[8px]">
          <span>
            <span className="underline">O</span>pen:
          </span>
          <span className="relative flex flex-1 min-w-0">
            <TextBox
              id="run-command"
              autoFocus
              className="flex-1"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onFocus={(event) => event.target.select()}
              onKeyDown={(event) => {
                if (event.key === 'F4' || (event.altKey && event.key === 'ArrowDown')) {
                  event.preventDefault()
                  setDrop((value) => !value)
                }
              }}
            />
            <button
              type="button"
              aria-label="Recent commands"
              className="w-[16px] bevel-raised bg-face"
              onClick={() => setDrop((value) => !value)}
            >
              <svg width="7" height="4" viewBox="0 0 7 4">
                <title>Open history</title>
                <path d="M0 0h7L3.5 4z" />
              </svg>
            </button>
            {drop && (
              <MenuList
                items={
                  recent.length
                    ? recent.map((item) => ({ label: item, onSelect: () => setValue(item) }))
                    : [{ label: '(Empty)', disabled: true }]
                }
                onClose={() => setDrop(false)}
                className="w-full"
                style={{ left: 0, top: '100%' }}
              />
            )}
          </span>
        </label>
        <div className="flex justify-end gap-[6px]">
          <Button type="submit" isDefault disabled={!value.trim()}>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={() => setBrowse(true)}>Browse...</Button>
        </div>
      </form>
      {browse && (
        <FileDialog
          mode="open"
          title="Browse"
          initialFolder={WINDOWS_DIR}
          filters={BROWSE_FILTERS}
          pickable={['file', 'program']}
          onCancel={() => setBrowse(false)}
          onSelect={(result) => {
            if (result.kind === 'existing') setValue(pathOf(fs.get(), result.id))
            setBrowse(false)
            setPicked((count) => count + 1)
          }}
        />
      )}
      {error && (
        <MessageBox
          title={value.trim()}
          icon="error"
          message={error}
          buttons={['OK']}
          onClose={() => setError(null)}
        />
      )}
    </Dialog>
  )
}
