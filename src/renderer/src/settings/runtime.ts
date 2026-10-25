import { fsStore } from '../fs/store'
import { applySettings } from './apply'
import { loadSettings, settingsStore } from './store'

settingsStore.dispatch({ type: 'apply', patch: loadSettings(Object.values(fsStore.get().nodes)) })

const update = () =>
  applySettings(settingsStore.get(), document.documentElement.style, Object.values(fsStore.get().nodes))
update()
settingsStore.subscribe(update)
fsStore.subscribe(update)
