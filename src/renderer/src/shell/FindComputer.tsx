import { useId, useState } from 'react'
import { ROOT } from '../fs/types'
import { icons } from '../icons'
import { useSettings } from '../settings/store'
import { Button, ComboBox, MenuBar, StatusBar, StatusPane, TextBox } from '../ui'
import { Accel } from '../ui/text'
import { launch } from './system'
import type { AppManifest, AppProps } from './types'

function FindComputer({ window }: AppProps) {
  const network = useSettings((settings) => settings.network)
  const [name, setName] = useState('')
  const [result, setResult] = useState<boolean | null>(null)
  const id = useId()
  const search = () => {
    const pattern = name
      .trim()
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replaceAll('*', '.*')
      .replaceAll('?', '.')
    setResult(new RegExp(pattern ? `^${pattern}$` : '.*', 'i').test(network.computer))
  }
  const open = () => launch('mycomputer', { folder: ROOT })
  return (
    <div className="h-full flex flex-col">
      <MenuBar
        menus={[
          {
            label: '&File',
            items: [
              { label: '&Open', disabled: !result, onSelect: open },
              'separator',
              { label: '&Close', onSelect: window.close },
            ],
          },
          {
            label: '&Help',
            items: [{ label: '&Help Topics', onSelect: () => launch('help', { book: 'windows' }) }],
          },
        ]}
      />
      <form
        className="p-[10px] flex gap-[12px]"
        onSubmit={(event) => {
          event.preventDefault()
          search()
        }}
      >
        <div className="flex-1 flex flex-col gap-[8px]">
          <label htmlFor={`${id}-name`} className="flex gap-[8px] items-center">
            <span className="w-[48px]">
              <Accel label="&Named:" />
            </span>
            <TextBox
              id={`${id}-name`}
              aria-label="Computer name"
              autoFocus
              className="flex-1"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label htmlFor={`${id}-where`} className="flex gap-[8px] items-center">
            <span className="w-[48px]">
              <Accel label="&Look in:" />
            </span>
            <ComboBox
              id={`${id}-where`}
              aria-label="Look in"
              className="flex-1"
              value="network"
              options={[{ key: 'network', label: 'Entire Network', icon: icons.small.myComputer }]}
              onChange={() => {}}
            />
          </label>
        </div>
        <div className="flex flex-col gap-[6px]">
          <Button type="submit" isDefault>
            <Accel label="&Find Now" />
          </Button>
          <Button
            onClick={() => {
              setName('')
              setResult(null)
            }}
          >
            <Accel label="Ne&w Search" />
          </Button>
        </div>
      </form>
      <div
        className="bg-white bevel-sunken mx-[3px] flex-1 min-h-0 overflow-auto"
        role="listbox"
        aria-label="Computers found"
      >
        <div className="flex h-[18px] bg-face">
          {['Name', 'Location', 'Comment'].map((label) => (
            <div key={label} className="w-1/3 bevel-raised px-[4px]">
              {label}
            </div>
          ))}
        </div>
        {result && (
          <button
            type="button"
            data-computer-result
            className="flex items-center gap-[4px] w-full px-[4px] h-[22px] text-left focus:bg-select focus:text-white outline-none"
            onDoubleClick={open}
            onKeyDown={(event) => {
              if (event.key === 'Enter') open()
            }}
          >
            <span className="w-1/3 flex items-center gap-[4px]">
              <img src={icons.small.myComputer} alt="" className="size-4" />
              {network.computer}
            </span>
            <span className="w-1/3">{network.workgroup}</span>
            <span>{network.description}</span>
          </button>
        )}
      </div>
      <StatusBar>
        <StatusPane className="flex-1">
          {result === null ? 'To start searching, click Find Now.' : `${result ? 1 : 0} computer(s) found.`}
        </StatusPane>
      </StatusBar>
    </div>
  )
}

export const computerSearchApp: AppManifest = {
  id: 'findcomputer',
  title: 'Find: Computer',
  exe: 'FINDCOMP.EXE',
  icon: icons.start.find,
  window: { kind: 'resizable', width: 520, height: 300, minWidth: 390, minHeight: 220 },
  component: FindComputer,
}
