import { useEffect, useId, useRef, useState } from 'react'
import { DRIVE_CAPACITY, driveUsed, volumeLabelError } from '../fs/fs'
import { fs } from '../fs/store'
import type { FsNode, FsState } from '../fs/types'
import { icons } from '../icons'
import { pixelArt } from '../icons/pixel'
import { driveName } from '../shell/naming'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { drivePie, PIE_COLORS } from './drivePie'
import { GroupBox, TextBox } from './fields'
import { MessageBox } from './MessageBox'
import { formatSize } from './properties'
import { Tabs } from './Tabs'
import { Accel } from './text'

const PIE = { width: 120, height: 64, depth: 10 }

function Pie({ used }: { used: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    const image = context.createImageData(PIE.width, PIE.height)
    drivePie(PIE.width, PIE.height, PIE.depth, used).forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell === 'none') return
        const hex = PIE_COLORS[cell]
        const at = (y * PIE.width + x) * 4
        image.data.set(
          [
            Number.parseInt(hex.slice(1, 3), 16),
            Number.parseInt(hex.slice(3, 5), 16),
            Number.parseInt(hex.slice(5, 7), 16),
            255,
          ],
          at,
        )
      })
    })
    context.putImageData(image, 0, 0)
  }, [used])
  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={`Used space ${Math.round(used * 100)} percent`}
      width={PIE.width}
      height={PIE.height}
      className="pixelated"
    />
  )
}

const Rule = () => <div className="my-[8px] h-[2px] border-t border-shadow border-b border-b-white" />

function Space({ swatch, label, bytes }: { swatch?: string; label: string; bytes: number }) {
  return (
    <div className="flex items-center h-[16px]">
      <span className="w-[16px] shrink-0">
        {swatch && <span className="block size-[11px] border border-black" style={{ background: swatch }} />}
      </span>
      <span className="w-[80px] shrink-0">{label}</span>
      <span className="w-[130px] shrink-0 text-right">{bytes.toLocaleString('en-US')} bytes</span>
      <span className="flex-1 text-right">{formatSize(bytes).split(' (')[0]}</span>
    </div>
  )
}

const TOOLS = [
  {
    group: 'Error-checking status',
    text: 'Windows was unable to determine when you last checked this drive for errors.',
    button: '&Check Now...',
    tool: 'ScanDisk',
    icon: pixelArt([
      '................',
      '..kkkkkkkkkk....',
      '..kwwwwwwwwk....',
      '..kwggggggwk....',
      '..kwwwwwwwwk....',
      '..kwgggkkkkk....',
      '..kwwwkwwwwk....',
      '..kwggkwbbbwk...',
      '..kwwkwbbbbbwk..',
      '..kkkkwbbbbbwk..',
      '......kwbbbwk...',
      '.......kwwwkk...',
      '........kkk.kk..',
      '.............kk.',
      '..............kk',
      '................',
    ]),
  },
  {
    group: 'Backup status',
    text: 'Windows was unable to determine when you last backed up files on this drive.',
    button: '&Backup Now...',
    tool: 'Backup',
    icon: pixelArt([
      '................',
      '................',
      '.kkkkkkkkkkkkkk.',
      '.kssssssssssssk.',
      '.kskkkkkkkkkksk.',
      '.kskwwkggkwwksk.',
      '.kskwwkggkwwksk.',
      '.kskkkkkkkkkksk.',
      '.kssssssssssssk.',
      '.ksskkkkkkkkssk.',
      '.ksskssssssk.sk.',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
      '................',
      '................',
    ]),
  },
  {
    group: 'Defragmentation status',
    text: 'Windows was unable to determine when you last defragmented this drive.',
    button: '&Defragment Now...',
    tool: 'Disk Defragmenter',
    icon: pixelArt([
      '................',
      '.kkkkkkkkkkkkkk.',
      '.kbbrrbbwwbbrrk.',
      '.kbbrrbbwwbbrrk.',
      '.kwwbbrrbbwwbbk.',
      '.kwwbbrrbbwwbbk.',
      '.kbbwwbbrrbbwwk.',
      '.kbbwwbbrrbbwwk.',
      '.kkkkkkkkkkkkkk.',
      '................',
      '....kkkkkkkk....',
      '....kssssssk....',
      '....kkkkkkkk....',
      '................',
      '................',
      '................',
    ]),
  },
] as const

/**
 * A drive's Properties: General with the volume label, used and free space, and the usage pie; Tools with
 * error-checking, backup, and defragmentation status.
 */
export function DriveProperties({
  node,
  state,
  onClose,
}: {
  node: FsNode
  state: FsState
  onClose: () => void
}) {
  const stored = node.kind === 'drive' ? (node.label ?? '') : ''
  const [label, setLabel] = useState(stored)
  const [tab, setTab] = useState<'General' | 'Tools'>('General')
  const labelId = useId()
  const [message, setMessage] = useState<{ title: string; text: string; icon: 'error' | 'info' } | null>(null)
  const title = `${driveName(node)} Properties`
  const used = driveUsed(state)
  const changed = label.trim().toUpperCase() !== stored
  const apply = (): boolean => {
    if (!changed) return true
    const problem = volumeLabelError(label)
    if (problem) {
      setMessage({ title, text: problem, icon: 'error' })
      return false
    }
    fs.setLabel(node.id, label)
    return true
  }
  return (
    <>
      <Dialog title={title} onClose={onClose} className="w-[362px]">
        <form
          className="flex flex-col gap-[8px] p-[6px]"
          onSubmit={(event) => {
            event.preventDefault()
            if (apply()) onClose()
          }}
        >
          <Tabs tabs={['General', 'Tools'] as const} active={tab} onChange={setTab}>
            {tab === 'General' ? (
              <div className="flex flex-col min-h-[300px]">
                <div className="flex items-center gap-[20px]">
                  <img src={icons.drive} alt="" className="size-8" />
                  <div className="flex flex-col gap-[6px] flex-1">
                    <div className="flex items-center">
                      <label htmlFor={labelId} className="w-[54px] shrink-0">
                        <Accel label="&Label:" />
                      </label>
                      <TextBox
                        id={labelId}
                        className="flex-1 min-w-0"
                        maxLength={11}
                        value={label}
                        onChange={(event) => setLabel(event.target.value)}
                      />
                    </div>
                    <div className="flex">
                      <span className="w-[54px] shrink-0">Type:</span>
                      <span>Local Disk</span>
                    </div>
                  </div>
                </div>
                <Rule />
                <div className="flex flex-col gap-[6px]">
                  <Space swatch={PIE_COLORS.used} label="Used space:" bytes={used} />
                  <Space swatch={PIE_COLORS.free} label="Free space:" bytes={DRIVE_CAPACITY - used} />
                </div>
                <Rule />
                <Space label="Capacity:" bytes={DRIVE_CAPACITY} />
                <div className="flex flex-col items-center gap-[6px] mt-[14px]">
                  <Pie used={used / DRIVE_CAPACITY} />
                  <span>Drive {node.name.replace(':', '')}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-[10px] min-h-[300px]">
                {TOOLS.map((tool) => (
                  <GroupBox key={tool.group} label={tool.group}>
                    <div className="flex gap-[12px] pt-[4px]">
                      <img src={tool.icon} alt="" className="size-8 pixelated shrink-0" />
                      <div className="flex flex-col gap-[8px] flex-1">
                        <span>{tool.text}</span>
                        <Button
                          className="self-end w-[110px]"
                          onClick={() =>
                            setMessage({
                              title: tool.tool,
                              text: `${tool.tool} is not installed on this computer. To install it, use Add/Remove Programs in Control Panel.`,
                              icon: 'info',
                            })
                          }
                        >
                          <Accel label={tool.button} />
                        </Button>
                      </div>
                    </div>
                  </GroupBox>
                ))}
              </div>
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
      {message && (
        <MessageBox
          title={message.title}
          icon={message.icon}
          message={message.text}
          buttons={['OK']}
          onClose={() => setMessage(null)}
        />
      )}
    </>
  )
}
