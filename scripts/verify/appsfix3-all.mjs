import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = process.env.W95_PROOF_DIR ?? 'D:/codes/worktrees/windows-95-web/proof/appsfix3'
for (const suffix of [
  '',
  '-find',
  '-notepad',
  '-dos',
  '-help',
  '-accessories',
  '-paint',
  '-find-actions',
  '-shared-gaps',
]) {
  const name = `appsfix3${suffix}`
  const result = spawnSync(process.execPath, [`scripts/verify/${name}.mjs`], { encoding: 'utf8' })
  const log = `${result.stdout ?? ''}${result.stderr ?? ''}`
  writeFileSync(join(out, `${name}.log`), log)
  process.stdout.write(log)
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
