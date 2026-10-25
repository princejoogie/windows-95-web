import { type ReactNode, useState } from 'react'
import { isProtected, pathOf } from '../fs/fs'
import { fs, useFs } from '../fs/store'
import type { Attributes, FsNode, NodeId } from '../fs/types'
import { useNaming } from '../shell/folderOptions'
import { nodeIcon } from '../shell/nodeIcon'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { DriveProperties } from './DriveProperties'
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
import { applyShortcut, ShortcutPage, shortcutDraft } from './ShortcutPage'
import { Tabs } from './Tabs'
import { Accel } from './text'

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

function Heading({ node, picture, children }: { node: FsNode; picture?: string; children: ReactNode }) {
  const icon = { ...nodeIcon(node), ...(picture ? { icon: picture } : {}) }
  return (
    <div className="flex items-center gap-[20px] mb-[2px]">
      <div className="relative size-8 shrink-0">
        <img src={icon.icon} alt="" className="size-8" />
        {icon.overlay && <img src={icon.overlay} alt="" className="absolute left-0 bottom-0" />}
      </div>
      {children}
    </div>
  )
}

/**
 * File and folder Properties, opened from a context menu or Alt+Enter. Every node has the General tab; a
 * shortcut adds its Shortcut tab. A recycled item shows where it came from and when it was deleted, and its
 * name and attributes are read-only.
 */
export function PropertiesSheet({ id, onClose }: { id: NodeId; onClose: () => void }) {
  const state = useFs((s) => s)
  const naming = useNaming()
  const node = state.nodes[id]
  const [name, setName] = useState(() => (node ? naming.label(node) : ''))
  const [flags, setFlags] = useState(() => (node ? attributesOf(node) : null))
  const [tab, setTab] = useState('General')
  const [shortcut, setShortcut] = useState(() => (node ? shortcutDraft(state, node) : null))
  const [error, setError] = useState<{ title: string; message: string } | null>(null)
  if (!node || !flags) return null
  if (node.kind === 'drive') return <DriveProperties node={node} state={state} onClose={onClose} />

  const recycled = state.recycled[node.id]
  const label = naming.label(node)
  const original = attributesOf(node)
  const renamable = !recycled && !isProtected(node.id)
  const changed =
    name !== label ||
    FLAGS.some(({ key }) => flags[key] !== original[key]) ||
    JSON.stringify(shortcut) !== JSON.stringify(shortcutDraft(state, node))
  const folder = node.kind === 'folder'
  const created = node.created ?? node.modified
  const tabs = node.kind === 'shortcut' ? ['General', 'Shortcut'] : ['General']

  const apply = (): boolean => {
    if (renamable && name !== label) {
      const problem = fs.rename(node.id, naming.rename(node, name))
      if (problem) {
        setError({ title: 'Error Renaming File', message: problem })
        return false
      }
    }
    if (shortcut) {
      const problem = applyShortcut(fs.get(), node, shortcut)
      if (problem) {
        setError({ title: 'Problem with Shortcut', message: problem })
        return false
      }
    }
    if (recycled) return true
    const { system: _system, ...editable } = flags
    fs.setAttributes(node.id, editable)
    return true
  }

  const general = (
    <>
      <Heading node={node}>
        {renamable ? (
          <TextBox
            aria-label="Name"
            className="flex-1 min-w-0"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        ) : (
          <span>{label}</span>
        )}
      </Heading>
      <Rule />
      <div className="flex flex-col gap-[6px]">
        {recycled && <Row label="Origin:">{pathOf(state, recycled.from)}</Row>}
        <Row label="Type:">{typeName(node)}</Row>
        {!recycled && <Row label="Location:">{node.parent ? pathOf(state, node.parent) : 'My Computer'}</Row>}
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
        {node.parent && !recycled && (
          <Row label="MS-DOS name:">{dosNames(state, node.parent).get(node.id) ?? node.name}</Row>
        )}
        {recycled && <Row label="Deleted:">{formatStamp(recycled.at)}</Row>}
        <Row label="Created:">{formatStamp(created)}</Row>
        {!folder && <Row label="Modified:">{formatStamp(node.modified)}</Row>}
        {!folder && !recycled && <Row label="Accessed:">{formatDay(Math.max(created, node.modified))}</Row>}
      </div>
      <Rule />
      <div className="flex items-start">
        <span className="w-[86px] shrink-0 pt-[1px]">Attributes:</span>
        <div className="grid grid-cols-2 gap-x-[16px] gap-y-[6px]">
          {FLAGS.map(({ key, label: flag }) => (
            <Checkbox
              key={key}
              label={flag}
              checked={flags[key]}
              disabled={key === 'system' || Boolean(recycled)}
              onChange={(event) => setFlags({ ...flags, [key]: event.target.checked })}
            />
          ))}
        </div>
      </div>
    </>
  )

  return (
    <>
      <Dialog title={`${label} Properties`} onClose={onClose} className="w-[362px]">
        <form
          className="flex flex-col gap-[8px] px-[6px] pt-[6px] pb-[6px]"
          onSubmit={(event) => {
            event.preventDefault()
            if (apply()) onClose()
          }}
        >
          <Tabs tabs={tabs} active={tab} onChange={setTab}>
            {tab === 'Shortcut' && shortcut ? (
              <ShortcutPage
                state={state}
                node={node}
                draft={shortcut}
                onChange={setShortcut}
                heading={(picture) => (
                  <Heading node={node} picture={picture}>
                    <span>{label}</span>
                  </Heading>
                )}
              />
            ) : (
              general
            )}
          </Tabs>
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
          title={error.title}
          icon="error"
          message={error.message}
          buttons={['OK']}
          onClose={() => setError(null)}
        />
      )}
    </>
  )
}
