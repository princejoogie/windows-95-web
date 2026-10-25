import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const [suit, rank, scale = '8'] = process.argv.slice(2)
const server = await createServer({
  configFile: resolve('vite.web.config.ts'),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const cards = await server.ssrLoadModule('/src/apps/solitaire/cards.ts')
await server.close()
const src = rank === 'back' ? cards.backImage(suit, 0) : cards.cardImage({ suit, rank: Number(rank) })
writeFileSync(
  'D:/codes/worktrees/windows-95-web/proof/cardart/sheet-one.html',
  `<body style="margin:0;background:#008000"><img style="image-rendering:pixelated" src="${src}" width="${71 * scale}" height="${96 * scale}"></body>`,
)
