// Builds the card-art contact sheets as HTML from the live cards.ts module.
// Usage: node scripts/verify/cardart.mjs [out dir]
// Then screenshot each page with agent-browser (see proof/cardart/README.md).
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const outDir = resolve(process.argv[2] ?? 'D:/codes/worktrees/windows-95-web/proof/cardart')
mkdirSync(outDir, { recursive: true })
const server = await createServer({
  configFile: resolve('vite.web.config.ts'),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const cards = await server.ssrLoadModule('/src/apps/solitaire/cards.ts')
const game = await server.ssrLoadModule('/src/apps/solitaire/game.ts')
await server.close()

const style = `
  body { margin: 0; padding: 8px; background: #008000; font: 11px sans-serif; color: white; }
  img { image-rendering: pixelated; display: block; }
  .row { display: flex; gap: 4px; margin-bottom: 4px; }
  .cell { text-align: center; overflow: hidden; white-space: nowrap; }
  h2 { font-size: 11px; margin: 8px 0 2px; }
`
const page = (title, body) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${style}</style></head><body>${body}</body></html>`
const img = (src, scale = 1, label = '') =>
  `<div class="cell" style="width:${71 * scale}px"><img src="${src}" width="${71 * scale}" height="${96 * scale}" alt="${label}">${label}</div>`

const suits = ['clubs', 'diamonds', 'hearts', 'spades']
const faces = suits
  .map(
    (suit) =>
      `<div class="row">${Array.from({ length: 13 }, (_, i) => img(cards.cardImage({ suit, rank: i + 1 }))).join('')}</div>`,
  )
  .join('')
const backs = `<div class="row">${cards.BACKS.map((back) => img(cards.backImage(back), 1, back)).join('')}</div>`
const frames = cards.ANIMATED_BACKS.map(
  (back) =>
    `<h2>${back}</h2><div class="row">${[0, 1, 2, 3].map((f) => img(cards.backImage(back, f), 1, `frame ${f}`)).join('')}</div>`,
).join('')
writeFileSync(
  resolve(outDir, 'sheet-faces.html'),
  page('52 faces at native 71x96', `<h2>52 faces, native resolution</h2>${faces}`),
)
writeFileSync(
  resolve(outDir, 'sheet-backs.html'),
  page('12 backs', `<h2>12 backs, native resolution</h2>${backs}<h2>Animation frames</h2>${frames}`),
)
for (const [rank, name] of [
  [11, 'jack'],
  [12, 'queen'],
  [13, 'king'],
]) {
  const body = `<div class="row">${suits.map((suit) => img(cards.cardImage({ suit, rank }), 4, `${name} of ${suit}`)).join('')}</div>`
  writeFileSync(resolve(outDir, `sheet-${name}s-4x.html`), page(`${name}s at 4x`, body))
}
const backs4x = cards.BACKS.map((_, i) =>
  i % 4 === 0
    ? `<div class="row">${cards.BACKS.slice(i, i + 4)
        .map((b) => img(cards.backImage(b), 4, b))
        .join('')}</div>`
    : '',
).join('')
writeFileSync(resolve(outDir, 'sheet-backs-4x.html'), page('backs at 4x', backs4x))
for (const suit of suits)
  for (const [rank, name] of [
    [11, 'jack'],
    [12, 'queen'],
    [13, 'king'],
  ])
    writeFileSync(
      resolve(outDir, `sheet-court-${name}-${suit}.html`),
      page(`${name} of ${suit} at 4x`, img(cards.cardImage({ suit, rank }), 4)),
    )
console.log('deck size', game.deck().length, 'distinct faces', new Set(game.deck().map(cards.cardImage)).size)
console.log('wrote sheets to', outDir)
