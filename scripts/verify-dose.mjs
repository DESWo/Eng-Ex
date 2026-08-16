/**
 * Offline guard for The Right Dose (src/challenges/chemical/TitrationChallenge.tsx).
 *
 *   node scripts/verify-dose.mjs
 *
 * The chemistry lives inside the .tsx and cannot be imported, so `pHof` below is
 * a line-for-line replica of TitrationChallenge.tsx:33-39 and the constants are
 * a replica of lines 18-22. Section 0 reads the component as text and fails if
 * any of that drifts, which is the only thing keeping the replica honest.
 *
 * Three jobs:
 *
 * 1. Check the curve against chemistry from outside itself: Henderson-Hasselbalch
 *    worked from mole ratios, the weak-acid initial pH, the hydrolysis pH at
 *    equivalence, the pH of the excess strong base alone, and a full
 *    charge-balance solution that makes none of those approximations.
 *
 * 2. Check the cliff, which is the entire lesson: how much a mL is worth in the
 *    buffer region against what it is worth at the equivalence point.
 *
 * 3. Check every level band is still a window a student can actually hit with
 *    the 10 / 5 / 1 mL pours the game offers, and that the naive coarse pour
 *    stops working exactly where the level design says it should.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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
function note(text) {
  console.log(`        ${text}`)
}

/* ------------------- the model, mirrored from the game ------------------- */

// TitrationChallenge.tsx:18-22
const V_EQ = 50
const PKA = 5
const BASE_CONC = 0.1
const FLASK_VOL = 50
const MAX_BASE = 70

// TitrationChallenge.tsx:33-39, replicated verbatim.
const pHof = (baseAdded) => {
  if (baseAdded <= 0) return 0.5 * (PKA - Math.log10(BASE_CONC))
  if (baseAdded < V_EQ) return PKA + Math.log10(baseAdded / (V_EQ - baseAdded))
  if (Math.abs(baseAdded - V_EQ) < 1e-9) return 8.7
  const oh = (BASE_CONC * (baseAdded - V_EQ)) / 1000 / ((FLASK_VOL + baseAdded) / 1000)
  return Math.min(13.5, 14 + Math.log10(oh))
}

// TitrationChallenge.tsx:56,64,72,80,88
const BANDS = [
  [4.5, 7],
  [5, 6.5],
  [5.5, 6.3],
  [5.8, 6.4],
  [6, 6.6],
]
// TitrationChallenge.tsx:286-288
const POURS = [10, 5, 1]
// TitrationChallenge.tsx:95-97, in order: offset, reagent, pours
const L5_TARGETS = [1, 46, 6]

/* ------------------- the independent reference ------------------- */

const Ka = 10 ** -PKA
const Kw = 1e-14

/**
 * pH from charge balance + mass balance + Kw, no approximations at all:
 *   [Na+] + [H+] = [OH-] + [A-],  [A-] = C_A Ka / (Ka + [H+])
 * This is what a chemist would solve numerically. It knows nothing about the
 * three-branch shortcut the game uses, so agreeing with it is real evidence.
 */
function exactPH(V) {
  const tot = FLASK_VOL + V
  const Na = (BASE_CONC * V) / tot
  const CA = (BASE_CONC * V_EQ) / tot
  const f = (H) => Na + H - Kw / H - (CA * Ka) / (Ka + H)
  let lo = 1e-15
  let hi = 1
  for (let i = 0; i < 200; i++) {
    const mid = Math.sqrt(lo * hi)
    if (f(mid) > 0) hi = mid
    else lo = mid
  }
  return -Math.log10(Math.sqrt(lo * hi))
}

/** Volume of base that puts the buffer region at a given pH, by inverting H-H. */
const vAt = (p) => {
  const r = 10 ** (p - PKA)
  return (V_EQ * r) / (1 + r)
}
/** Fewest pours to reach v mL with the 10 / 5 / 1 buttons. Greedy is optimal here. */
const minPours = (v) => Math.floor(v / 10) + Math.floor((v % 10) / 5) + (v % 5)
const inBand = (v, band) => pHof(v) >= band[0] && pHof(v) <= band[1]
const reachable = Array.from({ length: MAX_BASE + 1 }, (_, v) => v)

/* ------------------- 0. the replica still matches the component ------------------- */

section('Source agreement')
{
  const src = readFileSync(
    fileURLToPath(new URL('../src/challenges/chemical/TitrationChallenge.tsx', import.meta.url)),
    'utf8',
  )
  const num = (name) => {
    const m = src.match(new RegExp(`const ${name} = (-?[\\d.]+)`))
    return m ? Number(m[1]) : NaN
  }
  const consts = [
    ['V_EQ', V_EQ],
    ['PKA', PKA],
    ['BASE_CONC', BASE_CONC],
    ['FLASK_VOL', FLASK_VOL],
    ['MAX_BASE', MAX_BASE],
  ]
  const drifted = consts.filter(([n, v]) => num(n) !== v)
  check(
    'the five tuning constants match this file',
    drifted.length === 0,
    drifted.length ? `drifted: ${drifted.map(([n, v]) => `${n} ${v} -> ${num(n)}`).join(', ')}` : consts.map(([n, v]) => `${n}=${v}`).join(' '),
  )

  const branches = [
    '0.5 * (PKA - Math.log10(BASE_CONC))',
    'PKA + Math.log10(baseAdded / (V_EQ - baseAdded))',
    'if (Math.abs(baseAdded - V_EQ) < 1e-9) return 8.7',
    '(BASE_CONC * (baseAdded - V_EQ)) / 1000 / ((FLASK_VOL + baseAdded) / 1000)',
    'Math.min(13.5, 14 + Math.log10(oh))',
  ]
  const missing = branches.filter((b) => !src.includes(b))
  check(
    'all four pHof branches are still the ones replicated here',
    missing.length === 0,
    missing.length ? `missing: ${missing.join(' | ')}` : 'initial, buffer, equivalence, excess base',
  )

  const bands = [...src.matchAll(/band: \[([\d.]+), ([\d.]+)\]/g)].map((m) => [Number(m[1]), Number(m[2])])
  check(
    'the five level bands match this file',
    JSON.stringify(bands) === JSON.stringify(BANDS),
    bands.map((b) => `${b[0]}-${b[1]}`).join(', '),
  )

  const pours = [...src.matchAll(/pour\((\d+)\)/g)].map((m) => Number(m[1]))
  check('the pour buttons are still 10 / 5 / 1 mL', JSON.stringify(pours) === JSON.stringify(POURS), `${pours.join(', ')} mL`)

  const targets = [...src.matchAll(/target: (\d+)/g)].map((m) => Number(m[1]))
  check(
    'the level 5 pars match this file',
    JSON.stringify(targets) === JSON.stringify(L5_TARGETS),
    `offset par ${targets[0]}, reagent par ${targets[1]} mL, pours par ${targets[2]}`,
  )
}

/* ------------------- 1. the curve, against outside chemistry ------------------- */

section('Chemistry')
{
  // The one number every titration lab writeup contains: at half equivalence the
  // acid is half neutralised, [A-] = [HA], so the log term vanishes and pH = pKa.
  const half = V_EQ / 2
  const err = Math.abs(pHof(half) - PKA)
  check('at half equivalence the pH is exactly the pKa', err < 1e-12, `pH ${pHof(half).toFixed(6)} at ${half} mL against pKa ${PKA}`)
}
{
  // Henderson-Hasselbalch worked from the stoichiometry rather than from the
  // game's algebra: mmol base poured is mmol A- made, the rest of the original
  // 5 mmol of acid is still HA, and the shared volume cancels out of the ratio.
  const nAcid0 = BASE_CONC * V_EQ // mmol of HA in the flask at the start
  let worst = 0
  let worstV = 0
  for (const V of [5, 10, 15, 20, 25, 30, 35, 40, 45, 48]) {
    const nA = BASE_CONC * V
    const nHA = nAcid0 - nA
    const hand = PKA + Math.log10(nA / nHA)
    const d = Math.abs(pHof(V) - hand)
    if (d > worst) {
      worst = d
      worstV = V
    }
  }
  check('ten hand-worked buffer points match the model', worst < 1e-12, `worst ${worst.toExponential(1)} pH at ${worstV} mL`)
  note(`5 mmol of acid in ${FLASK_VOL} mL is ${(nAcid0 / FLASK_VOL).toFixed(2)} M, so 25 mL of base is exactly half of it`)
}
{
  // The weak acid alone: x^2/(C-x) = Ka, dropped to x = sqrt(Ka C), which is
  // pH = 0.5 (pKa - log C). The model can only use BASE_CONC as C because the
  // burette and the flask happen to be the same size and the same molarity.
  check('the flask acid is 0.1 M only because V_EQ equals FLASK_VOL', V_EQ === FLASK_VOL, `C_acid = BASE_CONC * V_EQ / FLASK_VOL = ${((BASE_CONC * V_EQ) / FLASK_VOL).toFixed(3)} M; change either and the initial pH goes wrong silently`)
  const hand = 0.5 * (PKA - Math.log10(BASE_CONC))
  check('the initial pH is the weak-acid formula', Math.abs(pHof(0) - hand) < 1e-12, `pH ${pHof(0).toFixed(4)}, from 0.5 * (${PKA} - log10 ${BASE_CONC})`)
  const ex = exactPH(0)
  check('and it survives the exact quadratic', Math.abs(pHof(0) - ex) < 0.01, `${pHof(0).toFixed(4)} against ${ex.toFixed(4)} with no approximation, ${Math.abs(pHof(0) - ex).toFixed(4)} pH apart`)
}
{
  // Equivalence: nothing left but the conjugate base A- hydrolysing.
  // Kb = Kw/Ka, [OH-] = sqrt(Kb C), C = 5 mmol in 100 mL.
  const C = (BASE_CONC * V_EQ) / (FLASK_VOL + V_EQ)
  const Kb = Kw / Ka
  const hand = 14 + Math.log10(Math.sqrt(Kb * C))
  check('the equivalence point is basic, not neutral', pHof(V_EQ) > 7, `pH ${pHof(V_EQ).toFixed(2)} at ${V_EQ} mL, because ${C.toFixed(3)} M acetate-like A- hydrolyses`)
  const gap = Math.abs(pHof(V_EQ) - hand)
  check('the hardcoded equivalence pH is within 0.2 of the hydrolysis value', gap < 0.2, `${pHof(V_EQ).toFixed(2)} hardcoded against ${hand.toFixed(4)} derived, ${gap.toFixed(4)} pH low`)
  note(`the 8.7 literal is the one value in the model that is not derived; the chemistry says ${hand.toFixed(2)}`)
}
{
  // Past equivalence the A- is a spectator and it is just diluted NaOH.
  const past = [51, 55, 60, 65, MAX_BASE]
  const worst = Math.max(
    ...past.map((V) => Math.abs(pHof(V) - (14 + Math.log10((BASE_CONC * (V - V_EQ)) / (FLASK_VOL + V))))),
  )
  const endOH = ((BASE_CONC * (MAX_BASE - V_EQ)) / (FLASK_VOL + MAX_BASE)) * 1000
  check('past equivalence the pH is the excess strong base alone', worst < 1e-12, `worst ${worst.toExponential(1)} pH over ${past.join(', ')} mL; at ${MAX_BASE} mL that is ${endOH.toFixed(2)} mM OH- and pH ${pHof(MAX_BASE).toFixed(2)}`)
}
{
  // The three-branch shortcut against the full charge balance, everywhere a
  // level band lives (the lowest band edge is 12.01 mL) and everywhere past it.
  const lowest = vAt(Math.min(...BANDS.map((b) => b[0])))
  let worst = 0
  let worstV = 0
  for (const V of reachable) {
    if (V < lowest || V === V_EQ) continue
    const d = Math.abs(pHof(V) - exactPH(V))
    if (d > worst) {
      worst = d
      worstV = V
    }
  }
  check('across the banded region the model is within 0.001 pH of the exact solution', worst < 0.001, `worst ${worst.toFixed(5)} pH at ${worstV} mL, over every reachable mL from ${Math.ceil(lowest)} to ${MAX_BASE}`)

  let early = 0
  let earlyV = 0
  for (let V = 1; V <= 3; V++) {
    const d = Math.abs(pHof(V) - exactPH(V))
    if (d > early) {
      early = d
      earlyV = V
    }
  }
  check('the first few mL are the loose part, and no band reaches there', early < 0.1 && early > 0.01 && vAt(Math.min(...BANDS.map((b) => b[0]))) > 3, `H-H is ${early.toFixed(3)} pH low at ${earlyV} mL where self-dissociation still matters; the lowest band starts at ${lowest.toFixed(2)} mL`)
}

/* ------------------- 2. the cliff ------------------- */

section('The cliff, which is the whole lesson')
{
  const stepsUp = reachable.every((v) => v === 0 || pHof(v) > pHof(v - 1))
  check('pH rises at every one of the 70 mL steps', stepsUp)
  // The curve the game draws samples every 0.5 mL (TitrationChallenge.tsx:189).
  let plotOk = true
  for (let i = 1; i <= MAX_BASE * 2; i++) if (pHof(i / 2) <= pHof((i - 1) / 2)) plotOk = false
  check('and at every 0.5 mL sample of the plotted curve', plotOk, `${MAX_BASE * 2 + 1} points`)
  // H-H is unbounded, so on paper it overtakes the 8.7 literal just before the
  // equivalence point. Worth knowing where, because it is a real discontinuity.
  const cross = vAt(8.7)
  check('the H-H branch only overtakes 8.7 inside the last 0.01 mL, which no pour or plot sample can land on', V_EQ - cross < 0.01 && V_EQ - cross > 0, `crossover at ${cross.toFixed(5)} mL, ${((V_EQ - cross) * 1000).toFixed(1)} uL short of equivalence, against a ${Math.min(...POURS)} mL finest pour`)
}
{
  // d(pH)/dV in the buffer region, differentiated by hand:
  //   pH = pKa + log10(V / (Veq - V))  ->  (1/ln10)(1/V + 1/(Veq - V))
  const V = V_EQ / 2
  const hand = (1 / Math.LN10) * (1 / V + 1 / (V_EQ - V))
  const h = 1e-4
  const model = (pHof(V + h) - pHof(V - h)) / (2 * h)
  check('the buffer slope matches the hand derivative', Math.abs(model - hand) / hand < 1e-8, `${model.toFixed(6)} against ${hand.toFixed(6)} pH per mL at ${V} mL`)

  const mid = pHof(26) - pHof(25)
  const cliff = pHof(50) - pHof(49)
  const ratio = cliff / mid
  check('one mL at the cliff is worth over 50 mL-at-the-midpoint', ratio > 50, `${mid.toFixed(4)} pH per mL at ${V_EQ / 2} mL against ${cliff.toFixed(4)} on the ${V_EQ - 1} to ${V_EQ} mL pour, ${ratio.toFixed(0)}x`)
  note(`the same 1 mL pour is worth ${(pHof(1) - pHof(0)).toFixed(2)} pH at the start, ${mid.toFixed(2)} in the buffer, ${(pHof(49) - pHof(48)).toFixed(2)} at 48 mL and ${cliff.toFixed(2)} at the cliff`)
}

/* ------------------- 3. level bands ------------------- */

section('Level bands, in mL and in pours')
{
  const widths = []
  BANDS.forEach((band, i) => {
    const lo = vAt(band[0])
    const hi = vAt(band[1])
    widths.push(hi - lo)
    const hits = reachable.filter((v) => inBand(v, band))
    // The window must hold at least three 1 mL pours, otherwise a student who is
    // one pour out has no way back into it.
    check(
      `level ${i + 1} band ${band[0]}-${band[1]} is ${(hi - lo).toFixed(2)} mL wide and holds ${hits.length} pours`,
      hits.length >= 3,
      `${lo.toFixed(3)} to ${hi.toFixed(3)} mL, landings ${hits[0]}-${hits[hits.length - 1]} mL, cheapest win ${minPours(hits[0])} pours`,
    )
    // Approaching from below with the finest pour must step INTO the window, not
    // over it. This is what makes the level winnable at all.
    const below = hits[0] - 1
    check(`  and the last 1 mL pour steps into it, not over it`, inBand(below + 1, band) && !inBand(below, band), `${below} mL reads pH ${pHof(below).toFixed(2)}, ${below + 1} mL reads ${pHof(below + 1).toFixed(2)}`)
  })
  const tightening = widths.every((w, i) => i === 0 || w < widths[i - 1])
  check('the windows tighten every level', tightening, widths.map((w) => `${w.toFixed(1)}`).join(' -> ') + ' mL')
}

section('Where the naive pour stops working')
{
  const coarseHits = (band, step) => reachable.filter((v) => v % step === 0 && inBand(v, band))
  // Levels 1-3: pouring nothing but 10 mL still wins, which is the point of
  // levels 1-3. Level 4 needs the 5, level 5 needs the 1.
  ;[0, 1, 2].forEach((i) => {
    const hits = coarseHits(BANDS[i], 10)
    check(`level ${i + 1} is winnable on 10 mL pours alone`, hits.length > 0, `${hits.join(', ')} mL lands in ${BANDS[i][0]}-${BANDS[i][1]}`)
  })
  const l4tens = coarseHits(BANDS[3], 10)
  const l4fives = coarseHits(BANDS[3], 5)
  check('level 4 kills the 10 mL pour and forces the 5', l4tens.length === 0 && l4fives.length > 0, `40 mL reads pH ${pHof(40).toFixed(2)} (short), 50 mL reads ${pHof(50).toFixed(2)} (past neutral), 45 mL reads ${pHof(45).toFixed(2)} (in)`)
  const l5fives = coarseHits(BANDS[4], 5)
  check('level 5 kills the 5 mL pour too, so it can only be won on 1 mL pours', l5fives.length === 0, `45 mL reads pH ${pHof(45).toFixed(2)}, below the ${BANDS[4][0]} floor, and the next 5 mL pour lands on ${pHof(50).toFixed(2)}`)
  const l5hits = reachable.filter((v) => inBand(v, BANDS[4]))
  check('exactly 46, 47 and 48 mL win level 5, as the source comment claims', JSON.stringify(l5hits) === JSON.stringify([46, 47, 48]), `${l5hits.join(', ')} mL, at pH ${l5hits.map((v) => pHof(v).toFixed(2)).join(', ')}`)
  // The band tops out below neutral on every level, which is what lets the
  // overshoot message at TitrationChallenge.tsx:158-161 split acid from alkali.
  check('no band reaches past neutral', BANDS.every((b) => b[1] <= 7), `tops at ${BANDS.map((b) => b[1]).join(', ')}`)
}

section('Level 5 pars, three ways to be right')
{
  const band = BANDS[4]
  const mid = (band[0] + band[1]) / 2
  const plays = reachable
    .filter((v) => inBand(v, band))
    .map((v) => ({
      v,
      offset: Math.round(Math.abs(pHof(v) - mid) * 10),
      reagent: v,
      pours: minPours(v),
    }))
  const met = (p) => [p.offset <= L5_TARGETS[0], p.reagent <= L5_TARGETS[1], p.pours <= L5_TARGETS[2]]
  const three = plays.filter((p) => met(p).every(Boolean)).length
  check('NO winning play meets all three pars', three === 0, `checked all ${plays.length} winning volumes`)
  const counts = [0, 1, 2].map((i) => plays.filter((p) => met(p)[i]).length)
  check('each par is individually reachable', counts.every((c) => c >= 1), `offset ${counts[0]}, reagent ${counts[1]}, pours ${counts[2]} of ${plays.length} plays`)
  check('the cheapest and the most centred are different plays', plays[0].reagent < plays[1].reagent && plays[0].offset > plays[1].offset, `${plays[0].v} mL is leanest at ${plays[0].offset} tenths off centre, ${plays[1].v} mL is centred at ${plays[1].offset} but costs ${plays[1].pours} pours`)
  for (const p of plays) note(`${p.v} mL: pH ${pHof(p.v).toFixed(3)}, ${p.offset} tenth${p.offset === 1 ? '' : 's'} off ${mid}, ${p.pours} pours`)
}

section('Display honesty')
{
  // The 13.5 ceiling in pHof exists for a burette that can never be poured.
  const maxPH = pHof(MAX_BASE)
  check('the 13.5 clamp never binds, unlike the drift clamp in the quake game', maxPH < 13.5, `${MAX_BASE} mL is the whole burette and it only reaches pH ${maxPH.toFixed(2)}`)
  // The meter and the plot both divide pH by 14 (lines 188, 267).
  check('every reachable pH fits the 0-14 axis the meter and the plot assume', reachable.every((v) => pHof(v) >= 0 && pHof(v) <= 14), `${pHof(0).toFixed(2)} to ${maxPH.toFixed(2)}`)
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`)
process.exit(failures === 0 ? 0 : 1)
