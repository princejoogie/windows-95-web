import { type ReactNode, useState } from 'react'
import { isProtected, pathOf } from '../fs/fs'
import { fs, useFs } from '../fs/store'
import type { Attributes, NodeId } from '../fs/types'
import { nodeIcon } from '../shell/nodeIcon'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Checkbox, TextBox } from './fields'
import { MessageBox } from './MessageBox'
import {
  attributesOf,
  bytesOf,
  contentsOf,
  dosNames,
  formatDay,
  formatSize,
  formatStamp,
  typeName,
} from './properties'
import { Accel } from './text'

/** The page frame of a property sheet, with its row of raised tabs. Only one page exists so far. */
function Sheet({ tabs, children }: { tabs: readonly string[]; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <div role="tablist" className="flex h-[20px] pl-[2px] items-end">
        {tabs.map((tab, index) => (
          <div
            key={tab}
            role="tab"
            tabIndex={index === 0 ? 0 : -1}
            aria-selected={index === 0}
            className={`relative px-[6px] bg-face shadow-[inset_1px_1px_#fff,inset_-1px_0_#000,inset_-2px_0_#808080]
              ${index === 0 ? 'z-10 -ml-[2px] h-[20px] pt-[3px] px-[8px]' : 'h-[18px] pt-[2px]'}`}
          >
            {tab}
          </div>
        ))}
      </div>
      <div className="bevel-window px-[12px] pt-[14px] pb-[12px]">{children}</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[16px] items-start">
      <span className="w-[86px] shrink-0">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  )
}

const Rule = () => <div className="my-[8px] h-[2px] border-t border-shadow border-b border-b-white" />

const FLAGS: readonly { key: keyof Attributes; label: string }[] = [
  { key: 'readOnly', label: 'Read-only' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'archive', label: 'Archive' },
  { key: 'system', label: 'System' },
]

/** File and folder Properties: the Windows 95 General tab, opened from a context menu or Alt+Enter. */
export function PropertiesSheet({ id, onClose }: { id: NodeId; onClose: () => void }) {
  const state = useFs((s) => s)
  const node = state.nodes[id]
  const [name, setName] = useState(node?.name ?? '')
  const [flags, setFlags] = useState(() => (node ? attributesOf(node) : null))
  const [error, setError] = useState<string | null>(null)
  if (!node || !flags) return null

  const original = attributesOf(node)
  const renamable = node.kind !== 'drive' && !isProtected(node.id)
  const changed = name !== node.name || FLAGS.some(({ key }) => flags[key] !== original[key])
  const icon = nodeIcon(node)
  const folder = node.kind === 'folder' || node.kind === 'drive'
  const created = node.created ?? node.modified

  const apply = (): boolean => {
    if (renamable && name !== node.name) {
      const problem = fs.rename(node.id, name)
      if (problem) {
        setError(problem)
        return false
      }
    }
    const { system: _system, ...editable } = flags
    fs.setAttributes(node.id, editable)
    return true
  }

  return (
    <>
      <Dialog title={`${node.name} Properties`} onClose={onClose} className="w-[362px]">
        <form
          className="flex flex-col gap-[8px] px-[6px] pt-[6px] pb-[6px]"
          onSubmit={(event) => {
            event.preventDefault()
            if (apply()) onClose()
          }}
        >
          <Sheet tabs={['General']}>
            <div className="flex items-center gap-[20px] mb-[2px]">
              <div className="relative size-8 shrink-0">
                <img src={icon.icon} alt="" className="size-8" />
                {icon.overlay && <img src={icon.overlay} alt="" className="absolute left-0 bottom-0" />}
              </div>
              {renamable ? (
                <TextBox
                  aria-label="Name"
                  className="flex-1 min-w-0"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              ) : (
                <span>{node.name}</span>
              )}
            </div>
            <Rule />
            <div className="flex flex-col gap-[6px]">
              <Row label="Type:">{typeName(node)}</Row>
              <Row label="Location:">{node.parent ? pathOf(state, node.parent) : 'My Computer'}</Row>
              <Row label="Size:">{formatSize(bytesOf(state, node))}</Row>
              {folder && (
                <Row label="Contains:">
                  {(() => {
                    const { files, folders } = contentsOf(state, node)
                    return `${files} Files, ${folders} Folders`
                  })()}
                </Row>
              )}
            </div>
            <Rule />
            <div className="flex flex-col gap-[6px]">
              {node.parent && (
                <Row label="MS-DOS name:">{dosNames(state, node.parent).get(node.id) ?? node.name}</Row>
              )}
              <Row label="Created:">{formatStamp(created)}</Row>
              {!folder && <Row label="Modified:">{formatStamp(node.modified)}</Row>}
              {!folder && <Row label="Accessed:">{formatDay(Math.max(created, node.modified))}</Row>}
            </div>
            <Rule />
            <div className="flex items-start">
              <span className="w-[86px] shrink-0 pt-[1px]">Attributes:</span>
              <div className="grid grid-cols-2 gap-x-[16px] gap-y-[6px]">
                {FLAGS.map(({ key, label }) => (
                  <Checkbox
                    key={key}
                    label={label}
                    checked={flags[key]}
                    disabled={key === 'system'}
                    onChange={(event) => setFlags({ ...flags, [key]: event.target.checked })}
                  />
                ))}
              </div>
            </div>
          </Sheet>
          <div className="flex justify-end gap-[6px]">
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
      {error && (
        <MessageBox
          title="Error Renaming File"
          icon="error"
          message={error}
          buttons={['OK']}
          onClose={() => setError(null)}
        />
      )}
    </>
  )
}
