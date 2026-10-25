import { resolve } from 'node:path'
import { createServer } from 'vite'

const server = await createServer({
  configFile: resolve('vite.web.config.ts'),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const court = await server.ssrLoadModule('/src/apps/solitaire/court.ts')
console.log(court.validateTemplates().join('\n') || 'templates ok')
await server.close()
