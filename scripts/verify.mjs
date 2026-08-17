/**
 * Run every scripts/verify-*.mjs and fail if any of them fails.
 *
 *   npm run verify
 *
 * A plain Node runner rather than shell syntax in package.json, so it behaves
 * identically on Windows, macOS, Linux, and CI. Each guard runs in its own
 * process because each ends with its own process.exit.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const guards = readdirSync(here)
  .filter((f) => /^verify-.*\.mjs$/.test(f))
  .sort()

if (guards.length === 0) {
  console.error('no scripts/verify-*.mjs found')
  process.exit(1)
}

const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(
    `Node ${process.versions.node} cannot run the guards: they import .ts sources directly,\n` +
      'which needs the built-in type stripping that landed in Node 22.18.',
  )
  process.exit(1)
}

let failed = 0
for (const guard of guards) {
  console.log(`--- ${guard}`)
  const run = spawnSync(process.execPath, [join(here, guard)], { stdio: 'inherit' })
  if (run.status !== 0) failed++
}

console.log(failed === 0 ? `\nAll ${guards.length} guards passed.` : `\n${failed} of ${guards.length} guards FAILED.`)
process.exit(failed === 0 ? 0 : 1)
