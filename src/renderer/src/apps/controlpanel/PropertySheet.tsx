import { type ReactNode, useId, useState } from 'react'
import { changedSettings, type Settings } from '../../settings/model'
import { settingsStore } from '../../settings/store'
import { Button, Dialog } from '../../ui'

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
  const [tab, setTab] = useState(initialTab)
  const id = useId()
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
          if (event.ctrlKey && event.key === 'Tab') {
            event.preventDefault()
            const next = (tab + (event.shiftKey ? tabs.length - 1 : 1)) % tabs.length
            setTab(next)
            document.getElementById(`${id}-tab-${next}`)?.focus()
          }
          if (event.altKey && event.key.length === 1) {
            const next = tabs.findIndex((item) => item.label[0]?.toLowerCase() === event.key.toLowerCase())
            if (next < 0) return
            event.preventDefault()
            setTab(next)
            document.getElementById(`${id}-tab-${next}`)?.focus()
          }
        }}
      >
        <div role="tablist" aria-label={`${title} tabs`} className="cp-tabs">
          {tabs.map((item, index) => (
            <button
              key={item.label}
              type="button"
              role="tab"
              id={`${id}-tab-${index}`}
              aria-controls={`${id}-panel-${index}`}
              aria-selected={tab === index}
              tabIndex={tab === index ? 0 : -1}
              onClick={() => setTab(index)}
              onKeyDown={(event) => {
                const next =
                  event.key === 'ArrowRight'
                    ? (tab + 1) % tabs.length
                    : event.key === 'ArrowLeft'
                      ? (tab + tabs.length - 1) % tabs.length
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? tabs.length - 1
                          : null
                if (next === null) return
                event.preventDefault()
                setTab(next)
                document.getElementById(`${id}-tab-${next}`)?.focus()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`${id}-panel-${tab}`}
          aria-labelledby={`${id}-tab-${tab}`}
          className="cp-page"
        >
          {tabs[tab]?.content}
        </div>
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
