import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.resolve('@vitejs/plugin-react'))
const { parseSync } = require('@babel/core')

const options = {
  Month: 'months.map((label, index) => ({ key: String(index + 1), label }))',
  'Time zone': 'timeZones.map(name => ({ key: name, label: name }))',
  Pattern: "['(None)', ...patternNames].map(name => ({ key: name, label: name }))",
  Wallpaper: "['(None)', ...wallpaperNames].map(name => ({ key: name, label: name }))",
  'Screen saver': 'saverNames.map(name => ({ key: name, label: name }))',
  Scheme: 'schemeNames.map(name => ({ key: name, label: name }))',
  'Appearance item': 'appearanceItems.map(option => ({ key: option.color, label: option.label }))',
  'Regional language': 'locales.map(name => ({ key: name, label: name }))',
  'Time style': "[{ key: '12', label: 'h:mm:ss tt' }, { key: '24', label: 'HH:mm:ss' }]",
  'Short date style': "['M/d/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd'].map(name => ({ key: name, label: name }))",
  'Installed programs': 'apps.map(app => ({ key: app.id, label: app.title }))',
  'Sound events': 'soundEvents.map(name => ({ key: name, label: name }))',
  'Sound name': 'soundNames.map(name => ({ key: name, label: name }))',
  'Sound scheme': "['Windows Default', 'No Sounds', '(Modified)'].map(name => ({ key: name, label: name }))",
}

let count = 0
for (const name of ['DateTimeProperties', 'DisplayProperties', 'OtherApplets', 'SoundsProperties']) {
  const path = `src/renderer/src/apps/controlpanel/${name}.tsx`
  let source = readFileSync(path, 'utf8')
  const file = parseSync(source, {
    filename: path,
    parserOpts: { plugins: ['typescript', 'jsx'] },
    configFile: false,
    babelrc: false,
  })
  const text = (node) => source.slice(node.start, node.end)
  const replacements = []
  function visit(node) {
    if (
      node.type === 'JSXElement' &&
      node.openingElement.name.name === 'label' &&
      node.children.some(
        (child) => child.type === 'JSXElement' && child.openingElement.name.name === 'ComboBox',
      )
    ) {
      for (const tag of [node.openingElement.name, node.closingElement.name])
        replacements.push({ start: tag.start, end: tag.end, text: 'div' })
    }
    if (node.type === 'JSXElement' && node.openingElement.name.name === 'select') {
      const attributes = node.openingElement.attributes
      const label = attributes.find((attr) => attr.name?.name === 'aria-label')?.value?.value
      assert.ok(options[label], `Options for ${label}`)
      const converted = attributes
        .filter((attr) => attr.name?.name !== 'size')
        .map((attr) => {
          const key = attr.name?.name
          if (key === 'onChange') {
            const fn = attr.value.expression
            const param = fn.params[0].name
            const body = text(fn.body).replaceAll(`${param}.target.value`, 'value')
            return `onChange={(value) => ${body}}`
          }
          if (key === 'value' && label === 'Month') return 'value={String(parts.month)}'
          return text(attr)
        })
      replacements.push({
        start: node.start,
        end: node.end,
        text: `<ComboBox ${converted.join('\n')} options={${options[label]}} />`,
      })
      count++
    } else
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          for (const child of value) if (child?.type) visit(child)
        } else if (value?.type) visit(value)
      }
  }
  visit(file)
  for (const edit of replacements.sort((a, b) => b.start - a.start))
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end)
  if (replacements.length) {
    if (!source.includes('import { ComboBox }'))
      source = `import { ComboBox } from '../../ui/ComboBox'\n${source}`
    writeFileSync(path, source)
  }
}
console.log(`Migrated ${count} native selects. Run Biome on apps/controlpanel.`)
