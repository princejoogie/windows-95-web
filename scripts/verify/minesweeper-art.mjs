import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const proofDir = process.argv[2] ?? 'D:/codes/worktrees/windows-95-web/proof/minesfix'
mkdirSync(proofDir, { recursive: true })
const server = await createServer({ configFile: false, server: { middlewareMode: true } })
try {
  const { artwork } = await server.ssrLoadModule('/src/renderer/src/apps/minesweeper/art.ts')
  const { help } = await server.ssrLoadModule('/src/renderer/src/apps/minesweeper/help.ts')
  const topics = help.contents.flatMap((entry) => ('topics' in entry ? entry.topics : [entry]))
  const ids = new Set(topics.map((topic) => topic.id))
  assert.equal(ids.size, topics.length, 'Unique Help topic ids')
  for (const topic of topics) {
    for (const link of topic.body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g))
      assert(ids.has(link[1]), `Help link ${link[1]} resolves`)
    assert(topic.title && topic.body && topic.keywords.length, `Help topic ${topic.id} has text and keywords`)
  }
  writeFileSync(resolve(proofDir, 'help-book.json'), `${JSON.stringify(help, null, 2)}\n`)
  const panels = []
  let count = 0
  for (const [mode, art] of Object.entries(artwork)) {
    const entries = [
      ...art.numbers.map((src, i) => ({ name: String(i + 1), src, width: 16, height: 16 })),
      ...['mine', 'exploded', 'wrong', 'flag', 'question'].map((name) => ({
        name,
        src: art[name],
        width: 16,
        height: 16,
      })),
      ...Object.entries(art.faces).map(([name, src]) => ({ name, src, width: 17, height: 17 })),
      ...Object.entries(art.digits).map(([name, src]) => ({
        name: `LED ${name}`,
        src,
        width: 13,
        height: 23,
      })),
    ]
    for (const entry of entries) {
      const svg = decodeURIComponent(entry.src.split(',')[1])
      assert(
        svg.includes(`width="${entry.width}" height="${entry.height}"`),
        `${mode} ${entry.name} has native dimensions`,
      )
      assert(!/<(?:text|polygon|path|circle)\b/.test(svg), `${mode} ${entry.name} uses pixel runs`)
      for (const rect of svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="1"/g)) {
        assert(
          Number(rect[1]) + Number(rect[3]) <= entry.width && Number(rect[2]) < entry.height,
          `${mode} ${entry.name} stays in its bitmap`,
        )
      }
      count++
    }
    panels.push(
      `<section><h2>${mode}</h2><div class="sprites">${entries.map((entry) => `<figure><div><img src="${entry.src}" width="${entry.width}" height="${entry.height}"><img src="${entry.src}" width="${entry.width * 3}" height="${entry.height * 3}"></div><figcaption>${entry.name}</figcaption></figure>`).join('')}</div></section>`,
    )
  }
  writeFileSync(
    resolve(proofDir, 'sprite-atlas.html'),
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>Minesweeper sprite verification</title><style>body{margin:20px;background:#c0c0c0;color:#000;font:14px monospace}h1{font-size:20px}h2{font-size:16px}.sprites{display:grid;grid-template-columns:repeat(7,120px);gap:8px}figure{margin:0;padding:8px;border:1px solid #808080}figure div{height:72px;display:flex;align-items:center;gap:8px}img{image-rendering:pixelated}figcaption{margin-top:8px}</style><h1>Minesweeper sprite verification</h1><p>Native size and 3× pixel enlargement. These are implementation assets, not a retail comparison.</p>${panels.join('')}</html>`,
  )
  console.log(`PASS ${count} pixel sprites have native dimensions and integer pixel runs.`)
  console.log(`PASS ${topics.length} local Help topics have unique ids and valid internal links.`)
} finally {
  await server.close()
}
