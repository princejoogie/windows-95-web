import base from '../../electron.vite.config.ts'

export default {
  ...base,
  renderer: { ...base.renderer, server: { port: 5520, strictPort: true } },
}
