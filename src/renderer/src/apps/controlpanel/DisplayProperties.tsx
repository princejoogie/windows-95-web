import { type ReactNode, useEffect, useId, useState } from 'react'
import { useFs } from '../../fs/store'
import { PALETTE } from '../../icons/pixel'
import {
  desktopBackground,
  patternNames,
  patterns,
  wallpaperNames,
  wallpaperNode,
} from '../../settings/backgrounds'
import { type Settings, saverNames } from '../../settings/model'
import { SaverCanvas, ScreenSaverPreview } from '../../settings/ScreenSaverHost'
import {
  appearanceColors,
  schemeNames,
  schemes,
  standardColors,
  type ThemeColor,
} from '../../settings/schemes'
import { registerDesktopProperties } from '../../shell/Desktop'
import { FileDialog, MessageBox } from '../../ui'
import { Button } from '../../ui/Button'
import { ComboBox } from '../../ui/ComboBox'
import { Dialog } from '../../ui/Dialog'
import { GroupBox, Radio, TextBox } from '../../ui/fields'
import { PropertySheet, useSettingsDraft } from './PropertySheet'
import { SaveScheme, useSavedSchemes } from './Schemes'

function Monitor({ children }: { children: ReactNode }) {
  return (
    <div className="cp-monitor" role="img" aria-label="Monitor preview">
      <div className="cp-monitor-case">
        <div className="cp-monitor-screen">{children}</div>
      </div>
      <div className="cp-monitor-neck" />
      <div className="cp-monitor-foot" />
    </div>
  )
}

export function DesktopDisplayProperties() {
  const [open, setOpen] = useState(false)
  useEffect(() => registerDesktopProperties(() => setOpen(true)), [])
  return open ? <DisplayProperties onClose={() => setOpen(false)} /> : null
}

export function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (color: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(value)
  useEffect(() => setCustom(value), [value])
  const id = useId()
  return (
    <span className="relative inline-block">
      <Button
        aria-label={label}
        aria-expanded={open}
        className="min-w-[55px]! px-[5px]!"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-[5px]">
          <span
            className="inline-block h-[11px] w-[26px] border border-black"
            style={{ backgroundColor: value }}
          />
          ▾
        </span>
      </Button>
      {open && (
        <Dialog title="Color" onClose={() => setOpen(false)} className="cp-dialog">
          <div className="p-3 w-[232px]">
            <p className="mb-2">Basic colors:</p>
            <div className="grid grid-cols-8 gap-[6px] mb-3">
              {Object.values(PALETTE).map((color) => (
                <button
                  type="button"
                  key={color}
                  aria-label={`Color ${color}`}
                  className="size-[20px] border border-black focus-dots"
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    onChange(color)
                    setOpen(false)
                  }}
                />
              ))}
            </div>
            <label className="flex gap-2 items-center" htmlFor={id}>
              Color value:
              <TextBox
                id={id}
                aria-label="Custom color value"
                className="w-[94px]"
                value={custom}
                maxLength={7}
                onChange={(event) => setCustom(event.target.value)}
              />
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                isDefault
                disabled={!/^#[0-9a-f]{6}$/i.test(custom)}
                onClick={() => {
                  onChange(custom)
                  setOpen(false)
                }}
              >
                OK
              </Button>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        </Dialog>
      )}
    </span>
  )
}

function DesktopPreview({ settings }: { settings: Settings }) {
  const state = useFs((state) => state)
  const bg = desktopBackground(settings, Object.values(state.nodes))
  return (
    <div
      className="absolute left-0 top-0 origin-top-left"
      style={{
        width: '200%',
        height: '200%',
        transform: 'scale(0.5)',
        backgroundColor: settings.desktopColor,
        backgroundImage: bg['--desktop-image'],
        backgroundRepeat: bg['--desktop-repeat'],
        backgroundPosition: bg['--desktop-position'],
        backgroundSize: bg['--desktop-size'],
      }}
    />
  )
}

function AppearanceSample({ settings }: { settings: Settings }) {
  const colors = appearanceColors(settings.appearance)
  return (
    <div
      className="cp-sample"
      role="img"
      aria-label="Appearance sample"
      style={{ background: settings.desktopColor, color: colors.text }}
    >
      <div
        className="cp-sample-window absolute left-[10px] top-[10px] w-[255px] h-[87px]"
        style={{ background: colors.face }}
      >
        <div
          className="font-bold px-[3px] h-[18px]"
          style={{ background: colors['title-inactive'], color: colors['inactive-text'] }}
        >
          Inactive Window
        </div>
      </div>
      <div
        className="cp-sample-window absolute left-[24px] top-[35px] w-[266px] h-[95px]"
        style={{ background: colors.face }}
      >
        <div
          className="font-bold px-[3px] h-[18px] flex justify-between items-center"
          style={{ background: colors.title, color: colors['title-text'] }}
        >
          Active Window<span className="text-black text-[9px] bg-[#c0c0c0] px-1">×</span>
        </div>
        <div className="px-1 py-[2px]">
          Normal&nbsp;&nbsp;{' '}
          <span className="px-1" style={{ background: colors.select, color: colors['select-text'] }}>
            Selected
          </span>
          &nbsp;&nbsp; <span style={{ color: colors.shadow }}>Disabled</span>
        </div>
        <div
          className="mx-[2px] p-1 h-[42px]"
          style={{
            background: colors.window,
            color: colors['window-text'],
            border: `1px solid ${colors.shadow}`,
          }}
        >
          Window Text
        </div>
      </div>
      <div
        className="cp-sample-window absolute left-[112px] top-[81px] w-[203px] h-[65px]"
        style={{ background: colors.face }}
      >
        <div
          className="font-bold px-[3px] h-[18px]"
          style={{ background: colors.title, color: colors['title-text'] }}
        >
          Message Box
        </div>
        <div className="flex items-center justify-around py-[5px]">
          <span>Message Text</span>
          <span
            className="px-5 py-[2px]"
            style={{ boxShadow: `inset 1px 1px ${colors.hilight}, inset -1px -1px ${colors.dark}` }}
          >
            OK
          </span>
        </div>
      </div>
    </div>
  )
}

const appearanceItems: readonly { label: string; color: ThemeColor }[] = [
  { label: '3D Objects', color: 'face' },
  { label: 'Active Title Bar', color: 'title' },
  { label: 'Active Title Text', color: 'title-text' },
  { label: 'Application Background', color: 'window' },
  { label: 'Inactive Title Bar', color: 'title-inactive' },
  { label: 'Inactive Title Text', color: 'inactive-text' },
  { label: 'Selected Items', color: 'select' },
  { label: 'Selected Text', color: 'select-text' },
  { label: 'Window', color: 'window' },
  { label: 'Window Text', color: 'window-text' },
  { label: 'Menu Text', color: 'text' },
  { label: '3D Shadow', color: 'shadow' },
]

export function DisplayProperties({ onClose, initialTab = 0 }: { onClose: () => void; initialTab?: number }) {
  const nodes = useFs((state) => state.nodes)
  const state = useSettingsDraft()
  const { draft, change } = state
  const [preview, setPreview] = useState(false)
  const [saverSettings, setSaverSettings] = useState(false)
  const [saverDraft, setSaverDraft] = useState(draft.screenSaver)
  const [item, setItem] = useState<ThemeColor>('face')
  const savedSchemes = useSavedSchemes('appearance')
  const [scheme, setScheme] = useState<string>(draft.appearance.scheme)
  const [savingScheme, setSavingScheme] = useState(false)
  const [browse, setBrowse] = useState(false)
  const [pattern, setPattern] = useState<number[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const colors = appearanceColors(draft.appearance)
  const id = useId()
  return (
    <>
      <PropertySheet
        title="Display Properties"
        onClose={onClose}
        state={state}
        initialTab={initialTab}
        tabs={[
          {
            label: 'Background',
            content: (
              <>
                <Monitor>
                  <DesktopPreview settings={draft} />
                </Monitor>
                <div className="grid grid-cols-2 gap-[10px]">
                  <div className="flex flex-col gap-1">
                    Pattern:
                    <ComboBox
                      aria-label="Pattern"
                      value={draft.pattern ?? '(None)'}
                      onChange={(value) =>
                        change({
                          pattern: patternNames.find((name) => name === value) ?? null,
                          customPattern: null,
                        })
                      }
                      options={['(None)', ...patternNames].map((name) => ({ key: name, label: name }))}
                    />
                    <Button
                      disabled={!draft.pattern}
                      onClick={() =>
                        setPattern([...(draft.customPattern ?? patterns[draft.pattern ?? 'Bricks'])])
                      }
                    >
                      Edit Pattern...
                    </Button>
                  </div>
                  <div className="flex flex-col gap-1">
                    Wallpaper:
                    <ComboBox
                      aria-label="Wallpaper"
                      value={draft.wallpaper ?? '(None)'}
                      onChange={(value) =>
                        change({
                          wallpaper:
                            wallpaperNames.find((name) => name === value) ??
                            wallpaperNode(value, Object.values(nodes))?.id ??
                            null,
                        })
                      }
                      options={[
                        ...['(None)', ...wallpaperNames].map((name) => ({ key: name, label: name })),
                        ...Object.values(nodes)
                          .filter(
                            (node) =>
                              node.kind === 'file' && node.content.startsWith('data:image/png;base64,'),
                          )
                          .map((node) => ({ key: node.id, label: node.name })),
                      ]}
                    />
                    <Button onClick={() => setBrowse(true)}>Browse...</Button>
                  </div>
                </div>
                <div className="mt-[10px] flex items-center justify-between">
                  <GroupBox label="Display" className="flex gap-3 py-[5px]!">
                    <Radio
                      name="wallpaper-mode"
                      label="Center"
                      checked={draft.wallpaperMode === 'center'}
                      onChange={() => change({ wallpaperMode: 'center' })}
                    />
                    <Radio
                      name="wallpaper-mode"
                      label="Tile"
                      checked={draft.wallpaperMode === 'tile'}
                      onChange={() => change({ wallpaperMode: 'tile' })}
                    />
                  </GroupBox>
                </div>
              </>
            ),
          },
          {
            label: 'Screen Saver',
            content: (
              <>
                <Monitor>
                  {draft.screenSaver.name === '(None)' ? (
                    <DesktopPreview settings={draft} />
                  ) : (
                    <SaverCanvas settings={draft.screenSaver} className="w-full h-full block" />
                  )}
                </Monitor>
                <GroupBox label="Screen Saver" className="mt-3">
                  <ComboBox
                    aria-label="Screen saver"
                    className="w-full"
                    value={draft.screenSaver.name}
                    onChange={(value) =>
                      change({
                        screenSaver: {
                          ...draft.screenSaver,
                          name: saverNames.find((name) => name === value) ?? '(None)',
                        },
                      })
                    }
                    options={saverNames.map((name) => ({ key: name, label: name }))}
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      disabled={
                        draft.screenSaver.name === '(None)' || draft.screenSaver.name === 'Blank Screen'
                      }
                      onClick={() => {
                        setSaverDraft(draft.screenSaver)
                        setSaverSettings(true)
                      }}
                    >
                      Settings...
                    </Button>
                    <Button disabled={draft.screenSaver.name === '(None)'} onClick={() => setPreview(true)}>
                      Preview
                    </Button>
                  </div>
                  <label className="flex gap-[6px] items-center mt-3" htmlFor={`${id}-wait`}>
                    Wait:
                    <TextBox
                      id={`${id}-wait`}
                      aria-label="Wait minutes"
                      type="number"
                      min={1}
                      max={120}
                      className="w-[52px]"
                      value={draft.screenSaver.waitMinutes}
                      onChange={(event) =>
                        change({
                          screenSaver: {
                            ...draft.screenSaver,
                            waitMinutes: Math.max(1, Math.min(120, event.currentTarget.valueAsNumber || 1)),
                          },
                        })
                      }
                    />
                    minutes
                  </label>
                </GroupBox>
                <p className="mt-3">
                  The screen saver starts when your computer has been idle for the specified time.
                </p>
              </>
            ),
          },
          {
            label: 'Appearance',
            content: (
              <>
                <AppearanceSample settings={draft} />
                <div className="flex flex-col mt-3 gap-1">
                  Scheme:
                  <div className="flex gap-2">
                    <ComboBox
                      aria-label="Scheme"
                      className="flex-1"
                      value={scheme}
                      onChange={(value) => {
                        setScheme(value)
                        const saved = savedSchemes.saved[value]
                        if (saved) {
                          change({ appearance: saved.appearance, desktopColor: saved.desktopColor })
                          return
                        }
                        const scheme = schemeNames.find((name) => name === value) ?? 'Windows Standard'
                        change({ appearance: { scheme, colors: {} }, desktopColor: schemes[scheme].desktop })
                      }}
                      options={[...new Set([...schemeNames, ...Object.keys(savedSchemes.saved)])].map(
                        (name) => ({
                          key: name,
                          label: name,
                        }),
                      )}
                    />
                    <Button onClick={() => setSavingScheme(true)}>Save As...</Button>
                    <Button
                      disabled={!savedSchemes.saved[scheme]}
                      onClick={() => {
                        savedSchemes.remove(scheme)
                        setScheme(draft.appearance.scheme)
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="flex items-end gap-3 mt-3">
                  <div className="flex flex-col gap-1 flex-1">
                    Item:
                    <ComboBox
                      aria-label="Appearance item"
                      value={item}
                      onChange={(value) =>
                        setItem(appearanceItems.find((option) => option.color === value)?.color ?? 'face')
                      }
                      options={appearanceItems.map((option) => ({ key: option.color, label: option.label }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    Size:
                    <TextBox
                      aria-label="Item size"
                      disabled
                      type="number"
                      defaultValue={18}
                      min={8}
                      max={72}
                      className="w-[45px]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    Color:
                    <ColorPicker
                      label="Item color"
                      value={colors[item] ?? standardColors[item]}
                      onChange={(color) =>
                        change({
                          appearance: {
                            ...draft.appearance,
                            colors: { ...draft.appearance.colors, [item]: color },
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-end gap-2 mt-3">
                  <div className="flex flex-col gap-1 flex-1">
                    Font:
                    <ComboBox
                      aria-label="Appearance font"
                      value="MS Sans Serif"
                      options={[{ key: 'MS Sans Serif', label: 'MS Sans Serif' }]}
                      onChange={() => {}}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    Size:
                    <TextBox
                      aria-label="Font size"
                      disabled
                      type="number"
                      defaultValue={8}
                      min={6}
                      max={72}
                      className="w-[40px]"
                    />
                  </div>
                  <ColorPicker
                    label="Font color"
                    value={colors.text}
                    onChange={(color) =>
                      change({
                        appearance: {
                          ...draft.appearance,
                          colors: { ...draft.appearance.colors, text: color },
                        },
                      })
                    }
                  />
                  <Button aria-label="Bold font" disabled className="min-w-[23px]! px-1! font-bold">
                    B
                  </Button>
                  <Button aria-label="Italic font" disabled className="min-w-[23px]! px-1! italic">
                    I
                  </Button>
                </div>
              </>
            ),
          },
          {
            label: 'Settings',
            content: (
              <>
                <Monitor>
                  <DesktopPreview settings={draft} />
                </Monitor>
                <GroupBox label="Color palette" className="mt-4">
                  <ComboBox
                    aria-label="Color palette"
                    value="16 Color"
                    options={[{ key: '16 Color', label: '16 Color' }]}
                    onChange={() => {}}
                    className="w-full"
                  />
                  <div className="flex mt-2 h-[14px] border border-black">
                    {Object.values(PALETTE).map((color) => (
                      <span key={color} className="flex-1" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                </GroupBox>
                <GroupBox label="Desktop area" className="mt-4">
                  <input
                    aria-label="Desktop area"
                    type="range"
                    min={0}
                    max={0}
                    value={0}
                    disabled
                    className="cp-slider"
                  />
                  <div className="flex justify-between">
                    <span>Less</span>
                    <span>More</span>
                  </div>
                  <p>
                    {innerWidth} by {innerHeight} pixels
                  </p>
                </GroupBox>
                <div className="flex items-end gap-2 mt-3">
                  <div className="flex-1">
                    Font size:
                    <ComboBox
                      aria-label="Display font size"
                      value="Small Fonts"
                      options={[{ key: 'Small Fonts', label: 'Small Fonts' }]}
                      onChange={() => {}}
                    />
                  </div>
                  <Button
                    onClick={() =>
                      setNotice(
                        'Display adapter: Standard Display Adapter (VGA)\nMonitor type: Plug and Play Monitor\n\nNo alternate display drivers are available.',
                      )
                    }
                  >
                    Change Display Type...
                  </Button>
                </div>
              </>
            ),
          },
        ]}
      />
      {browse && (
        <FileDialog
          mode="open"
          title="Browse"
          filters={[{ label: 'Bitmap Files (*.bmp)', extensions: ['bmp'] }]}
          onCancel={() => setBrowse(false)}
          onSelect={(result) => {
            const file =
              result.kind === 'existing' ? wallpaperNode(result.id, Object.values(nodes)) : undefined
            if (file) change({ wallpaper: file.id })
            else setNotice('This file is not a valid bitmap.')
            setBrowse(false)
          }}
        />
      )}
      {savingScheme && (
        <SaveScheme
          onClose={() => setSavingScheme(false)}
          onSave={(name) => {
            savedSchemes.save(name, draft)
            setScheme(name)
            setSavingScheme(false)
          }}
        />
      )}
      {notice && (
        <MessageBox
          title="Display Properties"
          message={notice}
          buttons={['OK']}
          onClose={() => setNotice(null)}
        />
      )}
      {pattern && (
        <Dialog title="Pattern Editor" onClose={() => setPattern(null)}>
          <div className="p-3 w-[300px]">
            <p className="mb-3">Click a square to change the pattern.</p>
            <div className="flex gap-6">
              <div className="grid grid-cols-8 border border-black">
                {pattern.flatMap((row, y) =>
                  Array.from({ length: 8 }, (_, x) => (
                    <button
                      type="button"
                      key={`pixel-${x.toString()}-${y.toString()}`}
                      aria-label={`Pattern pixel ${x + 1},${y + 1}`}
                      aria-pressed={Boolean(row & (128 >> x))}
                      className="size-[18px] border border-shadow"
                      style={{ background: row & (128 >> x) ? '#000000' : '#ffffff' }}
                      onClick={() =>
                        setPattern(pattern.map((value, index) => (index === y ? value ^ (128 >> x) : value)))
                      }
                    />
                  )),
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                isDefault
                onClick={() => {
                  change({ customPattern: pattern })
                  setPattern(null)
                }}
              >
                OK
              </Button>
              <Button onClick={() => setPattern(null)}>Cancel</Button>
            </div>
          </div>
        </Dialog>
      )}
      {preview && <ScreenSaverPreview settings={draft.screenSaver} onClose={() => setPreview(false)} />}
      {saverSettings && (
        <Dialog
          title={`${saverDraft.name} Settings`}
          onClose={() => setSaverSettings(false)}
          className="cp-dialog"
        >
          <div className="w-[300px] p-3">
            {saverDraft.name === 'Scrolling Marquee' && (
              <label className="flex flex-col gap-1 mb-3" htmlFor={`${id}-marquee`}>
                Text:
                <TextBox
                  id={`${id}-marquee`}
                  aria-label="Marquee text"
                  value={saverDraft.marquee}
                  maxLength={128}
                  onChange={(event) => setSaverDraft({ ...saverDraft, marquee: event.target.value })}
                />
              </label>
            )}
            <label className="block">
              Speed:
              <input
                aria-label="Screen saver speed"
                type="range"
                min={1}
                max={10}
                className="cp-slider"
                value={saverDraft.speed}
                onChange={(event) =>
                  setSaverDraft({ ...saverDraft, speed: event.currentTarget.valueAsNumber })
                }
              />
            </label>
            <div className="flex justify-between">
              <span>Slow</span>
              <span>Fast</span>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                isDefault
                onClick={() => {
                  change({ screenSaver: saverDraft })
                  setSaverSettings(false)
                }}
              >
                OK
              </Button>
              <Button onClick={() => setSaverSettings(false)}>Cancel</Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  )
}
