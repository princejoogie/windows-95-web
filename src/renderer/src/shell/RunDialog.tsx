import { useState } from 'react'
import { resolvePath } from '../fs/fs'
import { fs } from '../fs/store'
import { icons } from '../icons'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { TextBox } from '../ui/fields'
import { MessageBox } from '../ui/MessageBox'
import { findAppByExe } from './registry'
import { launch, openNode } from './system'

const HISTORY_KEY = 'w95.run.v1'

/** Start > Run. Accepts a program name such as `winmine` or a path such as `C:\My Documents`. */
export function RunDialog({ onClose }: { onClose: () => void }) {
  const [value, setValue] = useState(() => localStorage.getItem(HISTORY_KEY) ?? '')
  const [error, setError] = useState<string | null>(null)

  const run = () => {
    const command = value.trim()
    if (!command) return
    const node = resolvePath(fs.get(), command)
    const app = node ? undefined : findAppByExe(command.split('\').pop() ?? command)
    const ok = node ? openNode(node.id) : app ? launch(app.id) !== null : false
    if (!ok) {
      setError(
        `Cannot find the file '${command}' (or one of its components). Make sure the path and filename are correct and that all required libraries are available.`,
      )
      return
    }
    localStorage.setItem(HISTORY_KEY, command)
    onClose()
  }

  return (
    <>
      <Dialog title="Run" onClose={onClose} className="w-[347px]">
        <form
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
          <label className="flex items-center gap-[8px]">
            <span>
              <span className="underline">O</span>pen:
            </span>
            <TextBox
              // biome-ignore lint/a11y/noAutofocus: Run focuses its command line, as Windows does
              autoFocus
              className="flex-1"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onFocus={(event) => event.target.select()}
            />
          </label>
          <div className="flex justify-end gap-[6px]">
            <Button type="submit" isDefault disabled={!value.trim()}>
              OK
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </Dialog>
      {error && <MessageBox title={value.trim()} icon="error" message={error} buttons={['OK']} onClose={() => setError(null)} />}
    </>
  )
}
