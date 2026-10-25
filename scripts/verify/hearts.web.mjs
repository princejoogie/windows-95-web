// Historical proof from an earlier rebuild round. See scripts/verify/README.md.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const executable =
  process.env.W95_AGENT_BROWSER ??
  (process.platform === 'win32'
    ? join(process.env.APPDATA, 'npm/node_modules/agent-browser/bin/agent-browser-win32-x64.exe')
    : 'agent-browser')
const session = process.env.W95_BROWSER_SESSION ?? 'hearts-web'
const proof = resolve(process.argv[2] ?? 'D:/codes/worktrees/windows-95-web/proof/hearts')
mkdirSync(proof, { recursive: true })
function browser(...args) {
  return execFileSync(executable, ['--session', session, ...args], {
    encoding: 'utf8',
    timeout: 30000,
  }).trim()
}
browser('open', 'http://127.0.0.1:5471/?heartsSeed=95')
browser('wait', '[data-start-button]')
browser('click', '[data-start-button]')
browser('find', 'role', 'menuitem', 'click', '--name', 'Run...', '--exact')
browser('fill', '#run-command', 'MSHEARTS.EXE')
browser('press', 'Enter')
browser('wait', '[role="dialog"][aria-label="The Microsoft Hearts Network"]')
browser('check', 'input[accesskey="d"]')
browser('find', 'role', 'button', 'click', '--name', 'OK', '--exact')
browser('wait', '.hearts-card')
const output = browser(
  'eval',
  String.raw`
  (async () => {
    const { newGame } = await import('/src/apps/hearts/game.ts')
    const { help } = await import('/src/apps/hearts/help.ts')
    const expected = newGame(95).hands[0].map(card => card.suit + '-' + card.rank)
    const actual = Array.from(document.querySelectorAll('[data-card]')).map(node => node.dataset.card)
    const topics = help.contents.flatMap(entry => 'topics' in entry ? entry.topics : [entry])
    const ids = topics.map(topic => topic.id)
    const links = topics.flatMap(topic => Array.from(topic.body.matchAll(/\]\(([^)]+)\)/g), match => match[1]))
    return {
      seedMatches: JSON.stringify(actual) === JSON.stringify(expected),
      helpId: help.id,
      topicCount: topics.length,
      uniqueTopics: new Set(ids).size === ids.length,
      linksResolve: links.every(id => ids.includes(id)),
      coversRulesScoringCommandsStrategy: ['welcome', 'tricks', 'passing', 'scoring', 'moon', 'game', 'options', 'strategy'].every(id => ids.includes(id)),
      font: getComputedStyle(document.querySelector('.hearts')).fontFamily,
      color: getComputedStyle(document.querySelector('.hearts-table')).backgroundColor,
      cards: actual
    }
  })()
`,
  '--json',
)
const envelope = JSON.parse(output)
const result = envelope.data?.result ?? envelope.result ?? envelope
assert.equal(result.seedMatches, true, 'heartsSeed=95 renders the same seeded deal as the pure engine')
assert.equal(result.helpId, 'hearts')
assert.equal(result.uniqueTopics, true, 'Help topic ids are unique')
assert.equal(result.linksResolve, true, 'Every help link resolves to a topic')
assert.equal(
  result.coversRulesScoringCommandsStrategy,
  true,
  'The help book covers rules, scoring, menu commands, and strategy',
)
assert.equal(result.color, 'rgb(0, 128, 0)')
browser('screenshot', join(proof, 'web-seed-95.png'))
browser('press', 'F10')
const keyboard = JSON.parse(
  browser(
    'eval',
    `({ focusedMenu: Boolean(document.activeElement.closest('[role="menubar"]')), openMenu: Boolean(document.querySelector('[role="menu"]')) })`,
    '--json',
  ),
)
result.sharedMenuKeyboard = keyboard.data?.result ?? keyboard.result ?? keyboard
browser('screenshot', join(proof, 'menu-keyboard-current-base.png'))
writeFileSync(join(proof, 'web-results.json'), `${JSON.stringify(result, null, 2)}\n`)
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
