import { useMemo, useState } from 'react'
import type { NodeId } from '../../fs/types'
import { icons } from '../../icons'
import { pixelArt } from '../../icons/pixel'
import { useStore } from '../../lib/store'
import { type FolderOptions as Options, folderOptions as options } from '../../shell/folderOptions'
import { nodeIcon } from '../../shell/nodeIcon'
import { apps } from '../../shell/registry'
import { Button, Checkbox, Dialog, GroupBox, ListBox, MessageBox, Radio, Tabs } from '../../ui'
import { typeName } from '../../ui/properties'
import { Accel } from '../../ui/text'

const separateWindows = pixelArt([
  '..........................',
  '.bbbbbbbbbbbbbb...........',
  '.bwwwwwwwwwwwwb...........',
  '.bwwyywwwwwwwwb...........',
  '.bwwyywwwbbbbbbbbbbbbbb...',
  '.bwwwwwwwbwwwwwwwwwwwwb...',
  '.bwwwwwwwbwwyywwwwwwwwb...',
  '.bbbbbbbbbwwyywwbbbbbbbbbb',
  '.........bwwwwwwbwwwwwwwwb',
  '.........bwwwwwwbwwyywwwwb',
  '.........bbbbbbbbwwyywwwwb',
  '................bwwwwwwwwb',
  '................bwwwwwwwwb',
  '................bbbbbbbbbb',
])
const singleWindow = pixelArt([
  '..........................',
  '..bbbbbbbbbbbbbbbbbbbbbb..',
  '..bwwwwwwwwwwwwwwwwwwwwb..',
  '..bwwyywwwwyywwwwyywwwwb..',
  '..bwwyywwwwyywwwwyywwwwb..',
  '..bwwwwwwwwwwwwwwwwwwwwb..',
  '..bwwwwwwwwwwwwwwwwwwwwb..',
  '..bwwyywwwwyywwwwwwwwwwb..',
  '..bwwyywwwwyywwwwwwwwwwb..',
  '..bwwwwwwwwwwwwwwwwwwwwb..',
  '..bwwwwwwwwwwwwwwwwwwwwb..',
  '..bwwwwwwwwwwwwwwwwwwwwb..',
  '..bbbbbbbbbbbbbbbbbbbbbb..',
  '..........................',
])

/** Types Windows hides while Hide files of these types is chosen. */
const HIDDEN_TYPES = [
  'Application Extension',
  'Device driver',
  'System file',
  'Virtual device driver',
] as const

/** Names for the registered types that the Properties type line does not already name. */
const TYPE_NAMES: Readonly<Record<string, string>> = {
  dib: 'Bitmap Image',
  doc: 'WordPad Document',
  rtf: 'Rich Text Format',
  wri: 'Write Document',
  ini: 'Configuration Settings',
  log: 'Text Document',
  fnd: 'Saved Search',
}

interface FileType {
  readonly name: string
  readonly extensions: readonly string[]
  readonly opensWith: string
  readonly icon: string
}

function registeredTypes(): FileType[] {
  const types = new Map<string, FileType>()
  const add = (name: string, extension: string, opensWith: string, icon: string) => {
    const known = types.get(name)
    types.set(name, {
      name,
      extensions: known ? [...known.extensions, extension] : [extension],
      opensWith,
      icon,
    })
  }
  for (const app of apps)
    for (const extension of app.fileTypes ?? []) {
      const file = {
        kind: 'file',
        id: '' as NodeId,
        name: `x.${extension}`,
        parent: null,
        modified: 0,
        content: '',
      } as const
      add(
        TYPE_NAMES[extension] ?? typeName(file),
        extension.toUpperCase(),
        app.exe.replace(/\.exe$/i, '').toUpperCase(),
        nodeIcon(file).icon,
      )
    }
  add('Application', 'EXE', '', icons.program)
  return [...types.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function FolderPage({ draft, change }: { draft: Options; change: (next: Options) => void }) {
  return (
    <GroupBox label="Browsing options" className="flex flex-col gap-[14px] pt-[8px]">
      {[
        {
          picture: separateWindows,
          label: 'Browse folders using a &separate window for each folder.',
          same: false,
        },
        {
          picture: singleWindow,
          label: 'Browse folders by using a s&ingle window that changes as you open each folder.',
          same: true,
        },
      ].map((choice) => (
        <div key={choice.label} className="flex items-start gap-[12px]">
          <img
            src={choice.picture}
            alt=""
            className="w-[52px] h-[28px] pixelated shrink-0 bevel-sunken bg-white p-px"
          />
          <Radio
            name="browse"
            className="items-start"
            label={<Accel label={choice.label} />}
            checked={draft.sameWindow === choice.same}
            onChange={() => change({ ...draft, sameWindow: choice.same })}
          />
        </div>
      ))}
    </GroupBox>
  )
}

function ViewPage({ draft, change }: { draft: Options; change: (next: Options) => void }) {
  const [hot, setHot] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-[10px]">
      <GroupBox label="Hidden files" className="flex flex-col gap-[6px]">
        <Radio
          name="hidden"
          label={<Accel label="&Show all files" />}
          checked={draft.showHidden}
          onChange={() => change({ ...draft, showHidden: true })}
        />
        <Radio
          name="hidden"
          label={<Accel label="&Hide files of these types:" />}
          checked={!draft.showHidden}
          onChange={() => change({ ...draft, showHidden: false })}
        />
        <ListBox
          label="Hidden file types"
          className="ml-[18px] h-[70px]"
          items={HIDDEN_TYPES}
          value={hot as (typeof HIDDEN_TYPES)[number] | null}
          onChange={setHot}
        />
      </GroupBox>
      <Checkbox
        label={<Accel label="Display the &full MS-DOS path in the title bar" />}
        checked={draft.fullPath}
        onChange={(event) => change({ ...draft, fullPath: event.target.checked })}
      />
      <Checkbox
        label={<Accel label="Hide MS-DOS file &extensions for file types that are registered" />}
        checked={draft.hideExtensions}
        onChange={(event) => change({ ...draft, hideExtensions: event.target.checked })}
      />
      <Checkbox
        label={<Accel label="Include &description bar for right and left panes" />}
        checked={draft.descriptionBar}
        onChange={(event) => change({ ...draft, descriptionBar: event.target.checked })}
      />
    </div>
  )
}

function FileTypesPage() {
  const types = useMemo(registeredTypes, [])
  const [chosen, setChosen] = useState(types[0]?.name ?? null)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const type = types.find((entry) => entry.name === chosen)
  return (
    <div className="flex flex-col gap-[8px]">
      <span>Registered file types:</span>
      <div className="flex gap-[8px]">
        <ListBox
          label="Registered file types"
          className="flex-1 h-[120px]"
          items={types.map((entry) => entry.name)}
          value={chosen}
          onChange={setChosen}
          render={(name) => (
            <span className="flex items-center gap-[4px]">
              <img src={types.find((entry) => entry.name === name)?.icon} alt="" className="size-4" />
              {name}
            </span>
          )}
        />
        <div className="flex flex-col gap-[6px]">
          {['&New Type...', '&Remove', '&Edit...'].map((label) => (
            <Button key={label} onClick={() => setUnavailable(label.replace('&', '').replace('...', ''))}>
              <Accel label={label} />
            </Button>
          ))}
        </div>
      </div>
      <GroupBox label="File type details" className="flex gap-[12px] items-start">
        {type && <img src={type.icon} alt="" className="size-8 shrink-0" />}
        <div className="grid grid-cols-[76px_1fr] gap-y-[4px]">
          <span>Extension:</span>
          <span>{type?.extensions.join(' ')}</span>
          <span>Opens with:</span>
          <span>{type?.opensWith}</span>
        </div>
      </GroupBox>
      {unavailable && (
        <MessageBox
          title="File Types"
          icon="info"
          message={`${unavailable} is not available. The registered file types are part of this copy of Windows.`}
          buttons={['OK']}
          onClose={() => setUnavailable(null)}
        />
      )}
    </div>
  )
}

/** View > Options: the Folder, View, and File Types pages, which apply to every folder window. */
export function FolderOptions({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'Folder' | 'View' | 'File Types'>('Folder')
  const current = useStore(options, (state) => state)
  const [draft, setDraft] = useState<Options>(current)
  const changed = JSON.stringify(draft) !== JSON.stringify(current)
  const apply = () => options.dispatch(draft)
  return (
    <Dialog title="Options" onClose={onClose} className="w-[400px]">
      <form
        className="p-[6px]"
        onSubmit={(event) => {
          event.preventDefault()
          apply()
          onClose()
        }}
      >
        <Tabs tabs={['Folder', 'View', 'File Types'] as const} active={tab} onChange={setTab}>
          <div className="min-h-[260px]">
            {tab === 'Folder' ? (
              <FolderPage draft={draft} change={setDraft} />
            ) : tab === 'View' ? (
              <ViewPage draft={draft} change={setDraft} />
            ) : (
              <FileTypesPage />
            )}
          </div>
        </Tabs>
        <div className="flex justify-end gap-[6px] pt-[6px]">
          <Button type="submit" isDefault>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button disabled={!changed} onClick={apply}>
            <Accel label="&Apply" />
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
