/**
 * Offline guard for Shake Proof (src/challenges/civil/QuakeChallenge.tsx).
 *
 *   node scripts/verify-quake.mjs
 *
 * Node strips the types off shear.ts on import, so this runs with no build step
 * and no dependency. Two jobs:
 *
 * 1. Check the solver against numbers from outside itself: the closed-form
 *    periods of a uniform shear building, and the textbook resonant amplitude
 *    of a single oscillator. If those drift, the physics is wrong.
 *
 * 2. Check that every level still teaches what it was tuned to teach. Each of
 *    these is a property of a constant at the top of shear.ts or of the level
 *    table below, which means the next person to nudge one can silently destroy
 *    a lesson. Level 3 stands on 16 layouts out of 2338; that is not a number
 *    anyone will notice going wrong by playing.
 *
 * The level setups below MIRROR `LEVEL_SETUPS` at the top of
 * QuakeChallenge.tsx. Change one, change the other, then re-run this.
 */

import {
  DRIFT_CAP,
  OPEN_LOBBY,
  H_LOBBY,
  H_STOREY,
  MAX_PER_STOREY,
  ZETA,
  analyze,
  groundRecord,
  runDesign,
  sdofPeak,
} from '../src/challenges/civil/shear.ts'

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

/* ------------------- the level table, mirrored from the game ------------------- */

const uniform = (n) => ({ heights: Array(n).fill(H_STOREY), open: Array(n).fill(1) })
const LOBBY_6 = {
  heights: [H_LOBBY, H_STOREY, H_STOREY, H_STOREY, H_STOREY, H_STOREY],
  open: [OPEN_LOBBY, 1, 1, 1, 1, 1],
}
const BRACE_COST = 20000
const BEARING_COST = 220000

const LEVELS = [
  { n: 1, building: uniform(4), rack: 12, site: { Tg: 0.9, pga: 0.42, zg: 0.6 }, bearings: false, budget: null, gates: {} },
  { n: 2, building: uniform(5), rack: 4, site: { Tg: 1.0, pga: 0.36, zg: 0.6 }, bearings: false, budget: null, gates: {} },
  { n: 3, building: LOBBY_6, rack: 9, site: { Tg: 1.2, pga: 0.5, zg: 0.6 }, bearings: false, budget: null, gates: {} },
  { n: 4, building: LOBBY_6, rack: 14, site: { Tg: 0.45, pga: 0.46, zg: 0.35 }, bearings: true, budget: 300000, gates: { moat: 0.3, joltCap: 60 } },
  { n: 5, building: LOBBY_6, rack: 14, site: { Tg: 0.55, pga: 0.5, zg: 0.35 }, bearings: true, budget: null, gates: { moat: 0.3 } },
]
const PARS = { spend: 240000, jolt: 35, travel: 22 }

const recordFor = (lv) => groundRecord(lv.site)
const costOf = (braces, isolated) =>
  braces.reduce((a, b) => a + b, 0) * BRACE_COST + (isolated ? BEARING_COST : 0)

/** Every legal layout for a level: 0..3 braces per story, rack and budget respected. */
function designs(lv) {
  const n = lv.building.heights.length
  const out = []
  const d = new Array(n).fill(0)
  const walk = (i, left) => {
    if (i === n) {
      for (const isolated of lv.bearings ? [false, true] : [false]) {
        if (lv.budget !== null && costOf(d, isolated) > lv.budget) continue
        out.push({ braces: d.slice(), isolated })
      }
      return
    }
    for (let v = 0; v <= Math.min(MAX_PER_STOREY, left); v++) {
      d[i] = v
      walk(i + 1, left - v)
    }
    d[i] = 0
  }
  walk(0, lv.rack)
  return out
}

const runAll = (lv) => {
  const rec = recordFor(lv)
  return designs(lv).map((design) => ({
    design,
    out: runDesign(lv.building, design, rec, lv.gates),
    spend: costOf(design.braces, design.isolated),
  }))
}
const one = (lv, braces, isolated = false) =>
  runDesign(lv.building, { braces, isolated }, recordFor(lv), lv.gates)

/* ------------------- 1. the model, against outside numbers ------------------- */

section('Model correctness')
{
  const N = 6
  const k = 150000
  const m = 300
  const a = analyze(
    Array.from({ length: N }, () => ({ k, m, h: H_STOREY })),
    groundRecord({ Tg: 1, pga: 0.1 }),
  )
  // Closed form for a uniform shear building, from any structural dynamics text.
  let worst = 0
  for (let r = 1; r <= N; r++) {
    const w = 2 * Math.sqrt(k / m) * Math.sin(((2 * r - 1) * Math.PI) / (2 * (2 * N + 1)))
    worst = Math.max(worst, Math.abs(a.periods[r - 1] - (2 * Math.PI) / w) / ((2 * Math.PI) / w))
  }
  check('all six modal periods match the closed form', worst < 1e-9, `worst relative error ${worst.toExponential(2)}`)
}
{
  // A 1-DOF system driven at its own frequency settles at A / (2 zeta w^2).
  const dt = 0.005
  const n = Math.round(60 / dt)
  const a = new Float64Array(n)
  for (let i = 0; i < n; i++) a[i] = Math.sin(2 * Math.PI * i * dt)
  const peak = sdofPeak(1.0, ZETA, { a, d: a, dt, n })
  const theory = 1 / (2 * ZETA * (2 * Math.PI) ** 2)
  const rel = Math.abs(peak - theory) / theory
  check('resonant 1-DOF amplitude matches theory', rel < 0.005, `${peak.toFixed(4)} m against ${theory.toFixed(4)} m, ${(rel * 100).toFixed(3)}% off`)
}
{
  const lv = LEVELS[4]
  const rec = recordFor(lv)
  const runs = 400
  const t0 = performance.now()
  for (let i = 0; i < runs; i++) {
    runDesign(lv.building, { braces: [3, 2, 2, 1, 1, 0], isolated: i % 2 === 0 }, rec, lv.gates)
  }
  const ms = (performance.now() - t0) / runs
  check('one design analysis costs under 1 ms', ms < 1.0, `${ms.toFixed(3)} ms, so it can run on every drag`)
}

/* ------------------- 2. level invariants ------------------- */

section('Level 1, braces stop the lean')
{
  const lv = LEVELS[0]
  const all = runAll(lv)
  const stand = all.filter((r) => r.out.stands).length
  check('224 of 256 layouts stand', all.length === 256 && stand === 224, `${stand} of ${all.length}`)
  const bare = one(lv, [0, 0, 0, 0])
  check('the bare frame fails at story 1', !bare.stands && bare.fail.story === 1, `${bare.worstLean.toFixed(1)} mm/m`)
  const top = one(lv, [0, 0, 1, 1])
  check('two braces up top still fails at story 1', !top.stands && top.fail.story === 1, `${top.worstLean.toFixed(1)} mm/m`)
  const low = one(lv, [1, 0, 0, 0])
  check('one brace low is enough', low.stands, `worst ${low.worstLean.toFixed(1)} mm/m`)
}

section('Level 2, the bottom carries the shove')
{
  const lv = LEVELS[1]
  const all = runAll(lv)
  const wins = all.filter((r) => r.out.stands)
  check('21 of 121 layouts stand', all.length === 121 && wins.length === 21, `${wins.length} of ${all.length}`)
  const everyWinnerBracesTheBottom = wins.every((r) => r.design.braces[0] >= 1 && r.design.braces[1] >= 1)
  check('every winner braces story 1 AND story 2', everyWinnerBracesTheBottom)
  const top = one(lv, [0, 0, 0, 2, 2])
  check('the top-loaded layout fails at story 1', !top.stands && top.fail.story === 1, `${top.fail.value.toFixed(1)} mm/m`)
}

section('Level 3, the glass lobby (the twist)')
{
  const lv = LEVELS[2]
  const all = runAll(lv)
  const wins = all.filter((r) => r.out.stands)
  check('2338 layouts, exactly 16 stand', all.length === 2338 && wins.length === 16, `${wins.length} of ${all.length}, ${((wins.length / all.length) * 100).toFixed(2)}%`)
  const bare = one(lv, [0, 0, 0, 0, 0, 0])
  check('the bare frame fails at the lobby', !bare.stands && bare.fail.story === 1, `${bare.fail.value.toFixed(1)} mm/m`)
  const even = one(lv, [2, 2, 2, 1, 1, 1])
  check('spreading braces evenly fails AT STORY 1', !even.stands && even.fail.story === 1, `${even.fail.value.toFixed(1)} mm/m`)
  const dump = one(lv, [3, 3, 3, 0, 0, 0])
  check('dumping them all at the base fails AT STORY 4', !dump.stands && dump.fail.story === 4, `${dump.fail.value.toFixed(1)} mm/m, one story above the cliff`)
  const graded = one(lv, [3, 2, 2, 1, 1, 0])
  check('the graded layout stands with room to spare', graded.stands && graded.worstLean <= 14, `worst ${graded.worstLean.toFixed(1)} mm/m, period ${graded.T1.toFixed(2)} s`)
  // The one sentence a student can hold: feed the soft story more than its share.
  const tapered = all.filter(
    (r) =>
      r.design.braces.reduce((a, b) => a + b, 0) === lv.rack &&
      r.design.braces.every((v, i) => i === 0 || v <= r.design.braces[i - 1]),
  )
  const taperedWins = tapered.filter((r) => r.out.stands).length
  check('reasoning beats the odds: most full-rack tapered layouts stand', tapered.length > 0 && taperedWins / tapered.length >= 0.5, `${taperedWins} of ${tapered.length} decreasing full-rack layouts stand, against 16 of 2338 overall`)
}

section('Level 4, bearings are not a get out')
{
  const lv = LEVELS[3]
  const all = runAll(lv)
  const wins = all.filter((r) => r.out.stands)
  check('4216 legal designs, exactly 83 pass', all.length === 4216 && wins.length === 83, `${wins.length} of ${all.length}, ${((wins.length / all.length) * 100).toFixed(1)}%`)
  check('no fixed-base design passes', wins.every((r) => r.design.isolated))
  check('every passing design braces the lobby', wins.every((r) => r.design.braces[0] >= 1))
  const bought = one(lv, [0, 0, 0, 0, 0, 0], true)
  check('bearings alone fail on DRIFT, not on the moat', !bought.stands && bought.fail.kind === 'drift' && bought.fail.story === 1, `lobby tears at ${bought.fail.value.toFixed(1)} mm/m with the bearings under it, period ${bought.T1.toFixed(2)} s`)
  const full = one(lv, [3, 3, 2, 2, 2, 2])
  check('the full fixed-base rack stands but is too rough', !full.stands && full.fail.kind === 'jolt', `${full.worstLean.toFixed(1)} mm/m lean but ${full.worstJolt.toFixed(0)} %g`)
  const champ3 = one(lv, [3, 2, 2, 1, 1, 0])
  check('the level 3 champion is too rough here', !champ3.stands && champ3.fail.kind === 'jolt', `${champ3.worstJolt.toFixed(0)} %g against a 60 %g scanner`)
  const cheap = one(lv, [1, 0, 0, 0, 0, 0], true)
  check('bearings plus one lobby brace pass', cheap.stands, `$240k, period ${cheap.T1.toFixed(2)} s, ${cheap.worstLean.toFixed(1)} mm/m, ${cheap.worstJolt.toFixed(0)} %g, bearings slide ${cheap.bearingTravel.toFixed(0)} cm`)
}

section('Level 5, sign off the hospital')
{
  const lv = LEVELS[4]
  const all = runAll(lv)
  const wins = all.filter((r) => r.out.stands)
  const iso = wins.filter((r) => r.design.isolated).length
  check('3775 of 8024 designs stand', all.length === 8024 && wins.length === 3775, `${wins.length} of ${all.length}: ${iso} isolated, ${wins.length - iso} fixed base`)

  const scores = wins.map((r) => ({
    key: `${r.design.braces.join('')}${r.design.isolated ? 'i' : 'f'}`,
    design: r.design,
    spend: r.spend,
    jolt: r.out.worstJolt,
    travel: r.out.travel,
  }))
  const met = (s) => [s.spend <= PARS.spend, s.jolt <= PARS.jolt, s.travel <= PARS.travel]
  const counts = [0, 0, 0]
  let two = 0
  let three = 0
  for (const s of scores) {
    const m = met(s)
    m.forEach((v, i) => { if (v) counts[i]++ })
    const hit = m.filter(Boolean).length
    if (hit === 2) two++
    if (hit === 3) three++
  }
  check('NO design meets all three pars', three === 0, `checked all ${all.length} designs; ${two} meet exactly two`)
  check('each par is individually reachable', counts.every((c) => c >= 400 && c <= 1300), `cost ${counts[0]}, jolt ${counts[1]}, travel ${counts[2]} of ${wins.length} winners`)

  const best = (k) => scores.reduce((a, b) => (b[k] < a[k] ? b : a))
  const champs = ['spend', 'jolt', 'travel'].map(best)
  check('the three champions are three different designs', new Set(champs.map((c) => c.key)).size === 3)
  for (const [i, k] of ['spend', 'jolt', 'travel'].entries()) {
    const c = champs[i]
    console.log(`        min ${k}: [${c.design.braces.join(',')}]${c.design.isolated ? ' on bearings' : ' fixed base'}  $${(c.spend / 1000).toFixed(0)}k, ${c.jolt.toFixed(0)} %g, ${c.travel.toFixed(1)} cm`)
  }
}

section('Display honesty')
{
  // Linear elasticity gets loud past the limit, so the game clamps its readout.
  const bare = one(LEVELS[2], [0, 0, 0, 0, 0, 0])
  check('the worst failure is past the display clamp, so the clamp is load-bearing', bare.worstLean > 2 * DRIFT_CAP * 1000, `${bare.worstLean.toFixed(0)} mm/m against a ${(DRIFT_CAP * 1000).toFixed(0)} mm/m limit`)
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`)
process.exit(failures === 0 ? 0 : 1)
