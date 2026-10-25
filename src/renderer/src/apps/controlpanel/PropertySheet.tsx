import { type ReactNode, useState } from 'react'
import { changedSettings, type Settings } from '../../settings/model'
import { settingsStore } from '../../settings/store'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Tabs } from '../../ui/Tabs'

export function useSettingsDraft() {
  const [baseline, setBaseline] = useState(settingsStore.get)
  const [draft, setDraft] = useState(baseline)
  const dirty = JSON.stringify(baseline) !== JSON.stringify(draft)
  const change = (patch: Partial<Settings>) => setDraft((current) => ({ ...current, ...patch }))
  const apply = () => {
    settingsStore.dispatch({ type: 'apply', patch: changedSettings(baseline, draft) })
    setBaseline(draft)
  }
  return { draft, change, apply, dirty }
}

export type SettingsDraft = ReturnType<typeof useSettingsDraft>

export function PropertySheet({
  title,
  tabs,
  state,
  onClose,
  initialTab = 0,
  width = 404,
}: {
  title: string
  tabs: readonly { label: string; content: ReactNode }[]
  state: SettingsDraft
  onClose: () => void
  initialTab?: number
  width?: number
}) {
  const labels = tabs.map((item) => item.label)
  const [tab, setTab] = useState(labels[initialTab] ?? '')
  const save = () => {
    state.apply()
    onClose()
  }
  return (
    <Dialog title={title} onClose={onClose} className="cp-dialog">
      <form
        style={{ width }}
        className="cp-sheet"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
        onKeyDown={(event) => {
          if (!event.altKey || event.key.length !== 1) return
          const next = labels.find((label) => label[0]?.toLowerCase() === event.key.toLowerCase())
          if (!next) return
          event.preventDefault()
          setTab(next)
          event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[labels.indexOf(next)]?.focus()
        }}
      >
        <Tabs tabs={labels} active={tab} onChange={setTab} pageClassName="min-h-[326px] p-[12px]">
          {tabs.find((item) => item.label === tab)?.content}
        </Tabs>
        <div className="cp-actions">
          <Button type="submit" isDefault>
            OK
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button disabled={!state.dirty} onClick={state.apply}>
            Apply
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
