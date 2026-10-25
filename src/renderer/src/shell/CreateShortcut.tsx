import { useState } from 'react'
import { pathOf, resolvePath } from '../fs/fs'
import { fs } from '../fs/store'
import { DESKTOP_DIR } from '../fs/types'
import { icons } from '../icons'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { FileDialog } from '../ui/FileDialog'
import { TextBox } from '../ui/fields'
import { MessageBox } from '../ui/MessageBox'
import { Accel } from '../ui/text'
import type { ShortcutTarget } from './clipboard'
import { findAppByExe } from './registry'

/** What a command line names: a path on C:, or a program name such as `calc`. */
function parseCommand(command: string): { target: ShortcutTarget; label: string } | null {
  const text = command.trim().replace(/^"(.*)"$/, '$1')
  const node = resolvePath(fs.get(), text)
  if (node) return { target: { kind: 'node', id: node.id }, label: node.name }
  const app = findAppByExe(text.split('\\').pop() ?? text)
  return app ? { target: { kind: 'app', app: app.id, label: app.title }, label: app.title } : null
}

/** New > Shortcut: the two-page Create Shortcut wizard. */
export function CreateShortcut({
  onFinish,
  onClose,
}: {
  onFinish: (target: ShortcutTarget, name: string) => string | null
  onClose: () => void
}) {
  const [page, setPage] = useState<'command' | 'name'>('command')
  const [command, setCommand] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [browsing, setBrowsing] = useState(false)
  const parsed = page === 'name' ? parseCommand(command) : null

  const next = () => {
    const found = parseCommand(command)
    if (!found) {
      setError(
        `The file '${command.trim()}' specified in the Command line box was not found. Make sure the path and filename are correct.`,
      )
      return
    }
    setName(found.label)
    setPage('name')
  }

  const finish = () => {
    if (!parsed) return
    const problem = onFinish(parsed.target, name)
    if (problem) setError(problem)
    else onClose()
  }

  return (
    <>
      <Dialog
        title={page === 'command' ? 'Create Shortcut' : 'Select a Title for the Program'}
        onClose={onClose}
        className="w-[470px]"
      >
        <form
          className="flex flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            if (page === 'command') next()
            else finish()
          }}
        >
          <div className="flex gap-[14px] h-[250px] px-[10px] pt-[10px]">
            <div className="w-[150px] shrink-0 grid place-items-center bg-desktop bevel-sunken">
              <div className="relative size-8">
                <img src={icons.program} alt="" className="size-8" />
                <img src={icons.shortcutArrow} alt="" className="absolute left-0 bottom-0" />
              </div>
            </div>
            {page === 'command' ? (
              <div className="flex flex-col gap-[12px] flex-1 min-w-0">
                <p>
                  Type the location and name of the item you want to create a shortcut to. Or, search for the
                  item by clicking Browse.
                </p>
                <div className="flex flex-col gap-[4px]">
                  <label htmlFor="shortcut-command">
                    <Accel label="&Command line:" />
                  </label>
                  <TextBox
                    id="shortcut-command"
                    autoFocus
                    value={command}
                    onChange={(event) => setCommand(event.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setBrowsing(true)}>
                    <Accel label="B&rowse..." />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-[12px] flex-1 min-w-0">
                <label htmlFor="shortcut-name">
                  <Accel label="&Select a name for the shortcut:" />
                </label>
                <TextBox
                  id="shortcut-name"
                  autoFocus
                  value={name}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            )}
          </div>
          <div className="mx-[10px] mt-[10px] h-[2px] border-t border-shadow border-b border-b-white" />
          <div className="flex justify-end gap-0 p-[10px]">
            <Button disabled={page === 'command'} onClick={() => setPage('command')}>
              <Accel label="< &Back" />
            </Button>
            <Button type="submit" isDefault disabled={page === 'command' ? !command.trim() : !name.trim()}>
              {page === 'command' ? <Accel label="&Next >" /> : 'Finish'}
            </Button>
            <Button className="ml-[8px]" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
      {browsing && (
        <FileDialog
          mode="open"
          title="Browse"
          initialFolder={DESKTOP_DIR}
          onCancel={() => setBrowsing(false)}
          onSelect={(result) => {
            setBrowsing(false)
            const parent = pathOf(fs.get(), result.parent)
            setCommand(`${parent.endsWith('\\') ? parent : `${parent}\\`}${result.name}`)
          }}
        />
      )}
      {error && (
        <MessageBox
          title="Create Shortcut"
          icon="warning"
          message={error}
          buttons={['OK']}
          onClose={() => setError(null)}
        />
      )}
    </>
  )
}
