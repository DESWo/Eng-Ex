/**
 * Content integrity guard for the data layer that wires all 36 games together.
 *
 *   node scripts/verify-content.mjs
 *
 * The other verify scripts each defend one simulation. This one defends the
 * wiring: every challenge id a discipline names must resolve in the challenge
 * registry and vice versa, every DIY diagram id must resolve in the diagram
 * registry, the level arc must actually be five levels in every game file, and
 * every accent color must have a text color that clears WCAG AA, because
 * `.on-accent` puts real copy on those surfaces.
 *
 * disciplines.ts and registry.ts import cleanly under Node's type stripping
 * (their only value imports are lucide-react and react). The DIY diagram
 * registry and the challenge components are .tsx, which Node will not parse,
 * so those are checked textually.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { disciplines } from '../src/data/disciplines.ts'
import { challengeRegistry } from '../src/challenges/registry.ts'

const here = dirname(fileURLToPath(import.meta.url))
const read = (rel) => readFileSync(join(here, '..', rel), 'utf8').replace(/\r\n/g, '\n')

let failures = 0
function check(label, ok, detail = '') {
  if (ok) console.log(`  ok    ${label}${detail ? `  (${detail})` : ''}`)
  else {
    console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`)
    failures++
  }
}
function section(name) {
  console.log(`\n${name}`)
}

/* ------------------- shape ------------------- */

section('Shape: twelve fields, three games each')
{
  check('there are exactly 12 disciplines', disciplines.length === 12, `${disciplines.length}`)
  const badCount = disciplines.filter((d) => d.challenges.length !== 3)
  check('every discipline has exactly 3 challenges', badCount.length === 0, badCount.length ? badCount.map((d) => `${d.slug}: ${d.challenges.length}`).join(', ') : '36 games total')

  const slugs = disciplines.map((d) => d.slug)
  check('no duplicate slugs', new Set(slugs).size === slugs.length, slugs.join(', '))

  const ids = disciplines.flatMap((d) => d.challenges.map((c) => c.id))
  check('no duplicate challenge ids across fields', new Set(ids).size === ids.length, `${ids.length} unique ids`)

  const core = disciplines.filter((d) => d.tier !== 'more')
  check('exactly 3 core fields', core.length === 3, core.map((d) => d.slug).join(', '))
  const coreSlugs = new Set(core.map((d) => d.slug))
  const badParent = disciplines.filter((d) => d.tier === 'more' && !coreSlugs.has(d.parent))
  check('every branch field names a core parent', badParent.length === 0, badParent.length ? badParent.map((d) => `${d.slug} -> ${d.parent}`).join(', ') : 'nine branches over three roots')
}

/* ------------------- registry agreement ------------------- */

section('Registry agreement: data <-> code')
{
  const dataIds = disciplines.flatMap((d) => d.challenges.map((c) => c.id))
  const registryIds = Object.keys(challengeRegistry)

  const missing = dataIds.filter((id) => !challengeRegistry[id])
  check('every challenge a discipline names exists in the registry', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : `${dataIds.length} ids all resolve`)

  const orphaned = registryIds.filter((id) => !dataIds.includes(id))
  check('every registered challenge is named by a discipline', orphaned.length === 0, orphaned.length ? `orphaned: ${orphaned.join(', ')}` : `${registryIds.length} registrations all reachable`)

  const badShape = registryIds.filter((id) => typeof challengeRegistry[id].preload !== 'function' || !challengeRegistry[id].Component)
  check('every registration carries a component and a preload', badShape.length === 0, badShape.join(', '))
}

section('Registry agreement: DIY diagrams')
{
  // diy/index.ts is plain enough to scan: quoted or bare keys, one per line.
  const diySrc = read('src/components/diy/index.ts')
  const body = diySrc.slice(diySrc.indexOf('diyDiagramRegistry'))
  const keys = [...body.matchAll(/^\s*'?([a-z][a-z0-9-]*)'?:\s*[A-Z]/gm)].map((m) => m[1])
  check('the diagram registry parses', keys.length > 0, `${keys.length} diagrams: ${keys.join(', ')}`)

  const wanted = disciplines.filter((d) => d.diy.diagram).map((d) => ({ slug: d.slug, id: d.diy.diagram }))
  const missing = wanted.filter((w) => !keys.includes(w.id))
  check('every diy.diagram id resolves in the diagram registry', missing.length === 0, missing.length ? missing.map((w) => `${w.slug} -> ${w.id}`).join(', ') : `${wanted.length} of 12 fields have a diagram`)

  const unused = keys.filter((k) => !wanted.some((w) => w.id === k))
  check('every diagram in the registry is used by a field', unused.length === 0, unused.length ? `unused: ${unused.join(', ')}` : 'no dead diagrams')
}

/* ------------------- the level arc ------------------- */

section('The level arc: five levels in every game file')
{
  // The registry's dynamic imports name each game's file. Scan each for the
  // level markers n: 1 .. n: 5 that the ChallengeLevel type requires.
  const regSrc = read('src/challenges/registry.ts')
  const files = [...regSrc.matchAll(/import\('@\/(challenges\/[^']+)'\)/g)].map((m) => `src/${m[1]}.tsx`)
  check('the registry names 36 game files', files.length === 36, `${files.length}`)

  const bad = []
  for (const file of files) {
    const src = read(file)
    const ns = new Set([...src.matchAll(/\bn:\s*([1-5])\s*,/g)].map((m) => Number(m[1])))
    if (!(ns.has(1) && ns.has(2) && ns.has(3) && ns.has(4) && ns.has(5))) bad.push(`${file} has levels ${[...ns].sort().join(',') || 'none'}`)
  }
  check('every game file defines levels 1 through 5', bad.length === 0, bad.length ? bad.join('; ') : '36 files x 5 levels')
}

/* ------------------- accents and contrast ------------------- */

section('Accents: valid hex, and a text color that clears WCAG AA')
{
  const badHex = disciplines.filter((d) => !/^#[0-9a-f]{6}$/i.test(d.accent))
  check('every accent is a six-digit hex color', badHex.length === 0, badHex.map((d) => `${d.slug}: ${d.accent}`).join(', ') || disciplines.map((d) => d.accent).join(' '))

  // Replicates src/lib/accent.ts exactly: relative luminance per WCAG, 4.5:1
  // threshold, white when white passes, the app ink otherwise.
  const luminance = (hex) => {
    const channel = (i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  }
  const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  const INK = luminance('#1c1917')

  const failing = []
  let whiteWins = 0
  for (const d of disciplines) {
    const L = luminance(d.accent)
    const white = contrast(1.0, L)
    const ink = contrast(INK, L)
    if (white >= 4.5) whiteWins++
    const chosen = white >= 4.5 ? white : ink
    if (chosen < 4.5) failing.push(`${d.slug} ${d.accent}: best is ${chosen.toFixed(2)}:1`)
  }
  check('every accent has a text color meeting AA 4.5:1', failing.length === 0, failing.join(', ') || `white passes on ${whiteWins}, the app ink covers the rest`)

  // accent.ts documents the split. Hold the comment to the arithmetic.
  const accentSrc = read('src/lib/accent.ts')
  check('the accent.ts comment counts the split correctly', accentSrc.includes('Nine of the twelve') && whiteWins === 3, `white passes on ${whiteWins} of 12, so nine need the ink`)
}

/* ------------------- copy invariants ------------------- */

section('Copy: the claims pages make about the content')
{
  // The landing page says every field is open; nothing in the code may gate.
  const gridSrc = read('src/components/landing/DisciplineGrid.tsx')
  check('the landing grid renders every discipline ungated', gridSrc.includes('Every field is open from the first visit'), 'the claim is in the copy; this suite proves the counts behind it')

  const teaserless = disciplines.filter((d) => !d.intro.challengeTeaser?.trim())
  check('every field has a challenge teaser', teaserless.length === 0, teaserless.map((d) => d.slug).join(', ') || 'all 12')

  const emptyDiy = disciplines.filter((d) => d.diy.materials.length === 0 || d.diy.steps.length === 0 || !d.diy.safety?.trim())
  check('every DIY project has materials, steps and a safety note', emptyDiy.length === 0, emptyDiy.map((d) => d.slug).join(', ') || 'all 12')

  const badWhy = disciplines.flatMap((d) => d.challenges.filter((c) => c.why.length === 0).map((c) => `${d.slug}/${c.id}`))
  check('every challenge explains why it works', badWhy.length === 0, badWhy.join(', ') || '36 of 36 carry why-cards')

  const noJob = disciplines.flatMap((d) => d.challenges.filter((c) => !c.realJob?.trim()).map((c) => `${d.slug}/${c.id}`))
  check('every challenge names the real job behind it', noJob.length === 0, noJob.join(', ') || 'all 36')
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`)
process.exit(failures === 0 ? 0 : 1)
