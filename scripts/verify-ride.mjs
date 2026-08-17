/**
 * Offline guard for Smooth Ride (src/challenges/mechanical/SuspensionChallenge.tsx).
 *
 *   node scripts/verify-ride.mjs
 *
 * The vibration model lives inside the .tsx component, so unlike shear.ts it
 * cannot be imported. The formulas below are REPLICATED from the component,
 * every one of them tagged with the source line it came from, and the first
 * section re-reads the component text to prove the replica has not drifted.
 * Change the component, change this file, then re-run.
 *
 * Three jobs:
 *
 * 1. Check the model against numbers from outside itself: fn = sqrt(k/m)/2pi
 *    and zeta = c/(2 sqrt(km)) done by hand, and the closed-form values of
 *    base-excitation transmissibility at r = 0, r = 1, r = sqrt(2), the
 *    resonant peak, and r -> infinity.
 *
 * 2. Check that every level still teaches what it was tuned to teach: the
 *    intended winner wins, and the tempting wrong answer loses. Level 3 stands
 *    on a 0.12% frequency coincidence between a spring constant and a road
 *    speed, which nobody will notice going wrong by playing.
 *
 * 3. Pin the two facts the whole level arc is built on, because both are easy
 *    to break with a "harmless" retune: transmissibility is >= 1 everywhere
 *    below r = sqrt(2), and above it every extra damper makes isolation worse.
 *
 * History: this game used to compute the magnification factor
 * 1/sqrt((1-r^2)^2 + (2 zeta r)^2), which is the response to a force applied to
 * the body, not to a road shaking the wheels. Levels 4 and 5 were retuned when
 * that was corrected; see section 4.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '../src/challenges/mechanical/SuspensionChallenge.tsx')
// Normalized to LF: a Windows checkout (core.autocrlf) would otherwise fail
// every character-for-character source check below for no real reason.
const src = readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n')

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

/* ------------------- the model, mirrored from the component ------------------- */

/** SPRINGS, lines 19-24. */
const SPRINGS = { soft: 30000, medium: 60000, firm: 100000, stiff: 160000 }
const SPRING_IDS = ['soft', 'medium', 'firm', 'stiff']
const DAMPER_C = 2000 // line 28
const MAX_DAMPERS = 3 // line 29
const TRAVEL = 0.16 // line 30
const G = 9.81 // line 32
const PEAK_OFF_SCALE = 9.99 // the clamp on an undamped spike

/** naturalHz. */
const naturalHz = (k, m) => Math.sqrt(k / m) / (2 * Math.PI)
/** zetaOf. */
const zetaOf = (k, m, dampers) => (DAMPER_C * dampers) / (2 * Math.sqrt(k * m))
/** transmissibilityAt: displacement transmissibility for base excitation. */
const transmissibilityAt = (k, m, dampers, roadHz) => {
  const r = roadHz / naturalHz(k, m)
  const zeta = zetaOf(k, m, dampers)
  return Math.sqrt(1 + (2 * zeta * r) ** 2) / Math.sqrt((1 - r * r) ** 2 + (2 * zeta * r) ** 2)
}
/** peakTransmissibility: the height of the spike, by closed form. */
const peakTransmissibility = (k, m, dampers) => {
  const zeta = zetaOf(k, m, dampers)
  if (zeta <= 0) return PEAK_OFF_SCALE
  const rSq = (Math.sqrt(1 + 8 * zeta * zeta) - 1) / (4 * zeta * zeta)
  const twoZetaRSq = 4 * zeta * zeta * rSq
  const peak = Math.sqrt(1 + twoZetaRSq) / Math.sqrt((1 - rSq) ** 2 + twoZetaRSq)
  return Math.min(PEAK_OFF_SCALE, peak)
}
/** sagOf and harshnessOf. */
const sagOf = (k, m) => (m * G) / k
const harshnessOf = (k, m) => Math.sqrt(k / m)

/** The level table, mirrored from LEVELS. */
const LEVELS = [
  { n: 1, mass: 700, maxHarsh: 10, roadHz: null, maxAmp: 99, sagMatters: false },
  { n: 2, mass: 1200, maxHarsh: 10, roadHz: null, maxAmp: 99, sagMatters: true },
  { n: 3, mass: 700, maxHarsh: null, roadHz: 1.9, maxAmp: 0.8, sagMatters: false },
  { n: 4, mass: 700, maxHarsh: null, roadHz: 1.7, maxAmp: 0.75, sagMatters: false },
  { n: 5, mass: 1200, maxHarsh: null, roadHz: 3.0, maxAmp: 0.9, sagMatters: true },
]
/** Level 5 metrics. */
const PARS = { shake: 32, margin: 50, peak: 300 }

/** The pass rule. */
function evaluate(lv, id, dampers) {
  const k = SPRINGS[id]
  const sag = sagOf(k, lv.mass)
  const bottomsOut = lv.sagMatters && sag > TRAVEL
  const harsh = harshnessOf(k, lv.mass)
  const tooHarsh = lv.maxHarsh !== null && harsh > lv.maxHarsh
  const amp = lv.roadHz !== null ? transmissibilityAt(k, lv.mass, dampers, lv.roadHz) : 0
  const shaken = lv.roadHz !== null && amp > lv.maxAmp
  return {
    id, dampers, sag, harsh, amp, bottomsOut, tooHarsh, shaken,
    peak: peakTransmissibility(k, lv.mass, dampers),
    marginMm: Math.max(0, (TRAVEL - sag) * 1000),
    r: lv.roadHz !== null ? lv.roadHz / naturalHz(k, lv.mass) : null,
    passes: !bottomsOut && !tooHarsh && !shaken,
  }
}
/** Every setup a student can build: 4 springs x 0..3 dampers. */
const grid = (lv) =>
  SPRING_IDS.flatMap((id) =>
    Array.from({ length: MAX_DAMPERS + 1 }, (_, d) => evaluate(lv, id, d)),
  )
const winners = (lv) => grid(lv).filter((s) => s.passes)
const name = (s) => `${s.id}+${s.dampers}`

/** The function this game USED to implement, for the regression check only. */
const magnification = (k, m, dampers, roadHz) => {
  const r = roadHz / naturalHz(k, m)
  const zeta = zetaOf(k, m, dampers)
  return 1 / Math.sqrt((1 - r * r) ** 2 + (2 * zeta * r) ** 2)
}

/* ------------------- 1. the replica still matches the component ------------------- */

section('Replica matches the component')
{
  const ks = [...src.matchAll(/\bk: (\d+),/g)].map((m) => Number(m[1]))
  check('the four spring rates are unchanged', String(ks) === String(SPRING_IDS.map((i) => SPRINGS[i])), `soft/medium/firm/stiff = ${ks.join(', ')} N/m`)

  const scalars = [
    ['DAMPER_C', DAMPER_C], ['MAX_DAMPERS', MAX_DAMPERS], ['TRAVEL', TRAVEL], ['G', G],
    ['PEAK_OFF_SCALE', PEAK_OFF_SCALE],
  ]
  const badScalar = scalars.find(([k, v]) => !new RegExp(`const ${k} = ${v}\\b`).test(src))
  check('DAMPER_C, MAX_DAMPERS, TRAVEL, G and PEAK_OFF_SCALE are unchanged', !badScalar, badScalar ? `${badScalar[0]} moved` : '2000 N·s/m, 3, 0.16 m, 9.81 m/s², 9.99')

  const formulas = [
    ['naturalHz', 'Math.sqrt(k / m) / (2 * Math.PI)'],
    ['zetaOf', '(DAMPER_C * dampers) / (2 * Math.sqrt(k * m))'],
    ['r', 'const r = roadHz / naturalHz(k, m)'],
    ['transmissibilityAt', 'return Math.sqrt(1 + (2 * zeta * r) ** 2) / Math.sqrt((1 - r * r) ** 2 + (2 * zeta * r) ** 2)'],
    ['peak r^2', 'const rSq = (Math.sqrt(1 + 8 * zeta * zeta) - 1) / (4 * zeta * zeta)'],
    ['peak height', 'const peak = Math.sqrt(1 + twoZetaRSq) / Math.sqrt((1 - rSq) ** 2 + twoZetaRSq)'],
    ['sagOf', 'const sagOf = (k: number, m: number) => (m * G) / k'],
    ['harshnessOf', 'const harshnessOf = (k: number, m: number) => Math.sqrt(k / m)'],
    ['pass rule', 'const passes = !bottomsOut && !tooHarsh && !shaken'],
  ]
  const badFormula = formulas.find(([, text]) => !src.includes(text))
  check('all nine formulas are character-for-character what this file replicates', !badFormula, badFormula ? `${badFormula[0]} changed` : formulas.map(([n]) => n).join(', '))

  // The old force-response formula must not come back.
  check('the magnification-factor numerator is gone', !src.includes('return 1 / Math.sqrt((1 - r * r) ** 2'), 'no bare 1/sqrt(...) response left in the file')

  const setups = [...src.matchAll(/setup: \{([^}]*)\}/g)].map((m) => m[1])
  const num = (t, key) => {
    const hit = t.match(new RegExp(`${key}: (null|[\\d.]+)`))
    return hit ? (hit[1] === 'null' ? null : Number(hit[1])) : undefined
  }
  const mirrored = setups.map((t, i) => ({
    n: i + 1,
    mass: num(t, 'mass'), maxHarsh: num(t, 'maxHarsh'), roadHz: num(t, 'roadHz'),
    maxAmp: num(t, 'maxAmp'), sagMatters: /sagMatters: true/.test(t),
  }))
  check('all five level setups are unchanged', JSON.stringify(mirrored) === JSON.stringify(LEVELS), `masses ${mirrored.map((l) => l.mass).join('/')} kg, roads ${mirrored.map((l) => l.roadHz ?? '-').join('/')} Hz`)

  const targets = [...src.matchAll(/target: ([\d.]+)/g)].map((m) => Number(m[1]))
  check('the level 5 pars are unchanged', String(targets) === String([PARS.shake, PARS.margin, PARS.peak]), `shake ${targets[0]}%, margin ${targets[1]} mm, peak ${targets[2]}%`)
  check('the level 5 metric ids are shake, margin and peak', /id: 'shake'[\s\S]*id: 'margin'[\s\S]*id: 'peak'/.test(src), 'the retired `dampers` metric is not scored any more')
}

/* ------------------- 2. the model against outside numbers ------------------- */

section('Natural frequency against hand arithmetic')
{
  // fn = sqrt(k/m)/(2 pi). At 1200 kg every ratio is a clean number:
  //   soft   30000/1200 = 25      -> sqrt = 5          -> 5/6.283185 = 0.795775 Hz
  //   medium 60000/1200 = 50      -> sqrt = 7.0710678  -> 1.125395 Hz
  //   firm  100000/1200 = 83.3333 -> sqrt = 9.1287093  -> 1.452879 Hz
  //   stiff 160000/1200 = 133.333 -> sqrt = 11.547005  -> 1.837763 Hz
  const HAND_1200 = { soft: 0.795775, medium: 1.125395, firm: 1.452879, stiff: 1.837763 }
  // At 700 kg (30000/700 = 300/7 = 42.857143, sqrt = 6.5465367, /2pi = 1.041914):
  const HAND_700 = { soft: 1.041914, medium: 1.473488, firm: 1.902265, stiff: 2.406197 }
  for (const [m, hand] of [[700, HAND_700], [1200, HAND_1200]]) {
    const worst = SPRING_IDS.reduce((a, id) => Math.max(a, Math.abs(naturalHz(SPRINGS[id], m) - hand[id])), 0)
    check(`all four natural frequencies at ${m} kg match hand arithmetic`, worst < 5e-7, `${SPRING_IDS.map((id) => `${id} ${hand[id].toFixed(4)}`).join(', ')} Hz, worst error ${worst.toExponential(1)}`)
  }
  const ratio = naturalHz(120000, 700) / naturalHz(30000, 700)
  check('quadrupling k doubles fn, as sqrt(k) demands', Math.abs(ratio - 2) < 1e-12, `${ratio.toFixed(12)}`)
  const massRatio = naturalHz(60000, 2800) / naturalHz(60000, 700)
  check('quadrupling m halves fn', Math.abs(massRatio - 0.5) < 1e-12, `${massRatio.toFixed(12)}`)
  const worstH = SPRING_IDS.reduce((a, id) => Math.max(a, Math.abs(harshnessOf(SPRINGS[id], 700) - 2 * Math.PI * naturalHz(SPRINGS[id], 700))), 0)
  check('the "harshness" number is exactly the natural frequency in rad/s', worstH < 1e-9, `so the level 1 and 2 cap of 10 means 10 rad/s = ${(10 / (2 * Math.PI)).toFixed(4)} Hz`)
  const sag = sagOf(100000, 1200)
  const fromSag = Math.sqrt(G / sag) / (2 * Math.PI)
  check('sag and frequency agree: fn = sqrt(g/sag)/2pi', Math.abs(fromSag - naturalHz(100000, 1200)) < 1e-12, `117.7 mm of sag on the firm spring gives ${fromSag.toFixed(6)} Hz`)
}

section('Damping ratio against hand arithmetic')
{
  // Soft at 1200 kg: sqrt(30000*1200) = 6000 exactly, so zeta = 2000d/12000 = d/6.
  for (let d = 0; d <= MAX_DAMPERS; d++) {
    const z = zetaOf(SPRINGS.soft, 1200, d)
    check(`soft spring at 1200 kg with ${d} damper(s) gives zeta = ${d}/6`, Math.abs(z - d / 6) < 1e-15, `${z.toFixed(6)}, critical damping 12000 N·s/m`)
  }
  const HAND_FIRM_700 = [0, 0.119523, 0.239046, 0.358569]
  const worst = HAND_FIRM_700.reduce((a, v, d) => Math.max(a, Math.abs(zetaOf(SPRINGS.firm, 700, d) - v)), 0)
  check('firm spring at 700 kg matches hand arithmetic for 0..3 dampers', worst < 5e-7, `zeta = ${HAND_FIRM_700.map((v) => v.toFixed(4)).join(', ')}`)
  const all = [700, 1200].flatMap((m) => SPRING_IDS.map((id) => zetaOf(SPRINGS[id], m, MAX_DAMPERS)))
  check('every reachable setup is underdamped (zeta < 1)', Math.max(...all) < 1, `heaviest damping in the game is zeta = ${Math.max(...all).toFixed(4)}, soft spring loaded with 3 dampers`)
}

section('Transmissibility against closed form')
{
  // r = 0: a road that never bumps carries the body along with it, exactly.
  const still = transmissibilityAt(SPRINGS.medium, 700, 2, 0)
  check('at r = 0 transmissibility is exactly 1', still === 1, `${still}`)

  // r = 1: (1 - r^2) vanishes, leaving sqrt(1 + (2 zeta)^2) / (2 zeta).
  let worstQ = 0
  for (const m of [700, 1200]) for (const id of SPRING_IDS) for (let d = 1; d <= 3; d++) {
    const z = zetaOf(SPRINGS[id], m, d)
    const got = transmissibilityAt(SPRINGS[id], m, d, naturalHz(SPRINGS[id], m))
    const want = Math.sqrt(1 + (2 * z) ** 2) / (2 * z)
    worstQ = Math.max(worstQ, Math.abs(got - want) / got)
  }
  check('at r = 1 every damped setup equals sqrt(1 + 4 zeta^2) / (2 zeta)', worstQ < 1e-12, `24 setups, worst relative error ${worstQ.toExponential(1)}`)

  // The invariant the whole level arc rests on: T = 1 at r = sqrt(2), for ANY
  // damping ratio. This is what makes sqrt(2) the isolation threshold.
  const atCross = [0, 0.05, 0.1, 0.3, 0.5, 0.9].map((z) =>
    Math.sqrt(1 + (2 * z * Math.SQRT2) ** 2) / Math.sqrt((1 - 2) ** 2 + (2 * z * Math.SQRT2) ** 2))
  check('T = 1 exactly at r = sqrt(2), whatever the damping', atCross.every((t) => Math.abs(t - 1) < 1e-12), `zeta 0 to 0.9 all give T = 1.000000000000`)

  // Below the crossover isolation is impossible: T >= 1 everywhere.
  let minBelow = Infinity
  for (let r = 0; r <= Math.SQRT2; r += 0.001) {
    for (const z of [0, 0.05, 0.2, 0.5, 0.9]) {
      const t = Math.sqrt(1 + (2 * z * r) ** 2) / Math.sqrt((1 - r * r) ** 2 + (2 * z * r) ** 2)
      minBelow = Math.min(minBelow, t)
    }
  }
  check('below r = sqrt(2) transmissibility never drops under 1', minBelow >= 1 - 1e-12, `lowest sampled value is ${minBelow.toFixed(12)}`)

  // Above the crossover, damping HURTS. Monotonically, at every r > sqrt(2).
  let violations = 0
  for (let r = 1.45; r <= 6; r += 0.01) {
    const ts = [0.05, 0.2, 0.5, 0.9].map((z) =>
      Math.sqrt(1 + (2 * z * r) ** 2) / Math.sqrt((1 - r * r) ** 2 + (2 * z * r) ** 2))
    for (let i = 1; i < ts.length; i++) if (ts[i] <= ts[i - 1]) violations++
  }
  check('above r = sqrt(2) more damping always transmits MORE', violations === 0, 'checked zeta 0.05 -> 0.9 at every r from 1.45 to 6')

  // Undamped, away from r = 1, the numerator is 1 and this is the bare curve.
  let worstU = 0
  for (const r of [0.25, 0.5, 2, 3, 10]) {
    const got = transmissibilityAt(SPRINGS.firm, 700, 0, r * naturalHz(SPRINGS.firm, 700))
    worstU = Math.max(worstU, Math.abs(got - 1 / Math.abs(1 - r * r)) / got)
  }
  check('undamped T equals 1/|1 - r^2| at r = 0.25, 0.5, 2, 3, 10', worstU < 1e-12, `worst relative error ${worstU.toExponential(1)}`)

  // The damped tail dies as 2 zeta / r, NOT as 1/r^2: the damper is a solid
  // path from wheel to body and never stops carrying road.
  const fnFirm = naturalHz(SPRINGS.firm, 700)
  const z2 = zetaOf(SPRINGS.firm, 700, 2)
  const tail = transmissibilityAt(SPRINGS.firm, 700, 2, 1000 * fnFirm) * 1000
  check('the damped tail decays as 2 zeta / r, not 1/r^2', Math.abs(tail - 2 * z2) / (2 * z2) < 2e-3, `r * T = ${tail.toFixed(5)} at r = 1000, against 2 zeta = ${(2 * z2).toFixed(5)}`)

  // The peak sits at r^2 = (sqrt(1+8 zeta^2) - 1) / (4 zeta^2). Sweep the same
  // function the game plots and confirm the closed form the code uses.
  const k = SPRINGS.medium, m = 700, d = 2
  const zeta = zetaOf(k, m, d)
  let best = { r: 0, a: 0 }
  for (let i = 1; i <= 400000; i++) {
    const r = i / 100000
    const a = transmissibilityAt(k, m, d, r * naturalHz(k, m))
    if (a > best.a) best = { r, a }
  }
  const rPeak = Math.sqrt((Math.sqrt(1 + 8 * zeta * zeta) - 1) / (4 * zeta * zeta))
  check('the swept peak matches the closed form peakTransmissibility uses', Math.abs(best.r - rPeak) < 2e-4 && Math.abs(best.a - peakTransmissibility(k, m, d)) / best.a < 1e-6, `swept ${best.a.toFixed(5)} at r = ${best.r.toFixed(5)}, closed form ${peakTransmissibility(k, m, d).toFixed(5)} at r = ${rPeak.toFixed(5)}`)
  // Both response curves peak below r = 1 once damped, but not at the same
  // place: T peaks at (sqrt(1+8z^2)-1)/(4z^2), M at 1 - 2z^2, and the first is
  // always the larger. Distinguishes the formulas without depending on r > 1.
  const rPeakM = Math.sqrt(1 - 2 * zeta * zeta)
  check('the T peak sits between the M peak and r = 1', rPeak > rPeakM && rPeak < 1, `T peaks at r = ${rPeak.toFixed(5)}, M at ${rPeakM.toFixed(5)}, at zeta = ${zeta.toFixed(4)}`)
}

section('Undamped resonance')
{
  const fnFirm = naturalHz(SPRINGS.firm, 700)
  const blow = transmissibilityAt(SPRINGS.firm, 700, 0, fnFirm)
  check('exact undamped resonance returns Infinity, not NaN and not a throw', blow === Infinity, `sqrt(1)/sqrt(0 + 0) = ${blow}`)
  check('the curve clamps it', Math.min(4, blow) === 4 && src.includes('Math.min(4, transmissibilityAt(spring.k, round.mass, dampers, f))'), 'the plotted curve is capped at 4')
  check('the body-bounce animation clamps it', Math.min(26, blow * 12) === 26 && src.includes('Math.min(26, amp * 12)'), 'the drawn bounce is capped at 26 px')
  check('the verdict copy has an Infinity branch', src.includes("amp > 4 ? 'violently'"), 'says "violently" instead of printing Infinity')
  // The scorecard must never be handed Infinity: JSON.stringify turns it into
  // null, which would erase a saved best on the next read.
  const peaks = [700, 1200].flatMap((m) => SPRING_IDS.flatMap((id) => [0, 1, 2, 3].map((d) => peakTransmissibility(SPRINGS[id], m, d))))
  check('every reported spike is finite, so a saved best survives JSON', peaks.every(Number.isFinite), `undamped spikes report the ${PEAK_OFF_SCALE} clamp; highest real spike is ${Math.max(...peaks.filter((p) => p < PEAK_OFF_SCALE)).toFixed(2)}`)
  check('an undamped spike is reported as the clamp, not as Infinity', peakTransmissibility(SPRINGS.firm, 700, 0) === PEAK_OFF_SCALE, `${PEAK_OFF_SCALE} (${PEAK_OFF_SCALE * 100}% on the scorecard)`)
  const worst = LEVELS.filter((l) => l.roadHz !== null).flatMap(grid).map((s) => s.amp)
  check('no reachable setup in any level is infinite', worst.every(Number.isFinite), `the loudest anywhere is ${Math.max(...worst).toFixed(1)}, firm spring on the level 3 road`)
}

/* ------------------- 3. level invariants ------------------- */

section('Level 1, soft springs soak the pothole')
{
  const lv = LEVELS[0]
  const wins = winners(lv).map((s) => s.id)
  check('exactly soft and medium pass', String([...new Set(wins)]) === 'soft,medium', `harshness 6.55 and 9.26 rad/s against a cap of 10`)
  const stiff = evaluate(lv, 'stiff', 0)
  check('the setup the level OPENS on fails', !stiff.passes && stiff.tooHarsh, `stiff starts selected at ${stiff.harsh.toFixed(2)} rad/s, 51% over the cap`)
  const firm = evaluate(lv, 'firm', 0)
  check('firm fails too, so the student must go soft, not one notch', !firm.passes, `${firm.harsh.toFixed(2)} rad/s`)
  check('dampers cannot rescue a harsh spring', grid(lv).filter((s) => s.id === 'stiff').every((s) => !s.passes), 'no road frequency on this level, so damping is not in the pass rule at all')
}

section('Level 2, cargo eats the travel')
{
  const lv = LEVELS[1]
  const wins = [...new Set(winners(lv).map((s) => s.id))]
  check('exactly one spring passes: firm', String(wins) === 'firm', `sag ${(sagOf(SPRINGS.firm, 1200) * 1000).toFixed(1)} mm of ${TRAVEL * 1000} mm travel, harshness ${harshnessOf(SPRINGS.firm, 1200).toFixed(2)} rad/s`)
  const soft = evaluate(lv, 'soft', 0)
  const medium = evaluate(lv, 'medium', 0)
  check("level 1's winners now bottom out", soft.bottomsOut && medium.bottomsOut, `1200*9.81/k gives ${(soft.sag * 1000).toFixed(0)} mm and ${(medium.sag * 1000).toFixed(0)} mm against ${TRAVEL * 1000} mm of travel`)
  const stiff = evaluate(lv, 'stiff', 0)
  check('going stiffer instead is still too harsh', !stiff.passes && stiff.tooHarsh && !stiff.bottomsOut, `${stiff.harsh.toFixed(2)} rad/s, so the answer is bracketed from both sides`)
  const kMin = (1200 * G) / TRAVEL
  const kMax = 10 * 10 * 1200
  check('hand-derived window is 73575 <= k <= 120000 N/m and only firm is in it', Math.abs(kMin - 73575) < 1e-9 && kMax === 120000 && SPRING_IDS.filter((id) => SPRINGS[id] >= kMin && SPRINGS[id] <= kMax).join() === 'firm', `${kMin.toFixed(0)} to ${kMax} N/m, firm is 100000`)
}

section('Level 3, the washboard road (the resonance lesson)')
{
  const lv = LEVELS[2]
  const fnFirm = naturalHz(SPRINGS.firm, lv.mass)
  const detune = Math.abs(fnFirm - lv.roadHz) / lv.roadHz
  check("the level 2 winner's natural frequency sits on the level 3 road frequency", detune < 0.002, `firm on the empty van bounces at ${fnFirm.toFixed(4)} Hz, the road drums at ${lv.roadHz} Hz, r = ${(lv.roadHz / fnFirm).toFixed(5)}, ${(detune * 100).toFixed(2)}% apart`)
  const firm0 = evaluate(lv, 'firm', 0)
  check('the level 2 winner shakes itself apart here', !firm0.passes && firm0.shaken, `response ${firm0.amp.toFixed(0)}x against a limit of ${lv.maxAmp}, that is ${(firm0.amp / lv.maxAmp).toFixed(0)} times over`)
  check('no amount of damping saves the firm spring', grid(lv).filter((s) => s.id === 'firm').every((s) => !s.passes), `3 dampers only pull it to ${evaluate(lv, 'firm', 3).amp.toFixed(2)}, still over ${lv.maxAmp}`)
  const soft0 = evaluate(lv, 'soft', 0)
  check('softening genuinely detunes it, with no dampers at all', soft0.passes, `soft bounces at ${naturalHz(SPRINGS.soft, lv.mass).toFixed(3)} Hz so r = ${soft0.r.toFixed(3)}, T ${soft0.amp.toFixed(3)}, a ${(firm0.amp / soft0.amp).toFixed(0)}x improvement on one part change`)
  const stiff = grid(lv).filter((s) => s.id === 'stiff')
  check('stiffening instead fails at every damper count', stiff.every((s) => !s.passes), `r = ${stiff[0].r.toFixed(3)} is still under sqrt(2), T ${stiff[0].amp.toFixed(2)} up to ${stiff[3].amp.toFixed(2)}`)
  const wins = winners(lv)
  check('4 of the 16 setups pass, all of them soft', wins.length === 4 && wins.every((s) => s.id === 'soft'), `${wins.map(name).join(', ')}`)
  check('every winner sits past the isolation threshold (r > sqrt(2))', wins.every((s) => s.r > Math.SQRT2), `r = ${wins[0].r.toFixed(3)} against sqrt(2) = ${Math.SQRT2.toFixed(3)}`)
  // The level can be won without touching the dampers, which is the point:
  // detuning is the fix here, not damping.
  check('the level is winnable on the spring change alone', soft0.passes, 'soft with zero dampers passes, so the lesson is detune, not damp')
}

section('Level 4, read the response curve')
{
  const lv = LEVELS[3]
  const wins = winners(lv)
  check('2 of the 16 setups pass, both of them soft', wins.length === 2 && wins.every((s) => s.id === 'soft'), `${wins.map(name).join(', ')}`)
  const soft = [0, 1, 2, 3].map((d) => evaluate(lv, 'soft', d))
  check('the soft spring is past the crossover here', soft[0].r > Math.SQRT2, `r = ${soft[0].r.toFixed(3)}, so this level lives in the isolation region`)
  // The whole lesson: out here dampers are a cost, and the level 3 answer that
  // used them now fails.
  check('every extra damper makes it worse, monotonically', soft[0].amp < soft[1].amp && soft[1].amp < soft[2].amp && soft[2].amp < soft[3].amp, `T = ${soft.map((s) => s.amp.toFixed(3)).join(' -> ')} for 0 -> 3 dampers`)
  check('a level 3 winner carrying dampers now FAILS', evaluate(LEVELS[2], 'soft', 2).passes && !soft[2].passes, `soft+2 cleared level 3 at T ${evaluate(LEVELS[2], 'soft', 2).amp.toFixed(3)} and fails here at ${soft[2].amp.toFixed(3)} against a ${lv.maxAmp} limit`)
  check('taking the dampers off is what wins it', soft[0].passes && soft[1].passes, `soft+0 at ${soft[0].amp.toFixed(3)} and soft+1 at ${soft[1].amp.toFixed(3)}, both under ${lv.maxAmp}`)
  // No other spring is close, so the answer is unambiguous.
  const others = grid(lv).filter((s) => s.id !== 'soft')
  check('no other spring gets near the limit', others.every((s) => s.amp > 1), `best non-soft setup is ${Math.min(...others.map((s) => s.amp)).toFixed(2)}, still above 1`)
  const marked = lv.roadHz >= 0.4 && lv.roadHz <= 4.0
  check('the road marker lands inside the plotted window', marked && src.includes('const f = 0.4 + (i / 80) * 3.6'), `curve spans 0.4 to 4.0 Hz, marker at ${lv.roadHz} Hz`)
  // The curve the student reads must actually show the crossing they are told
  // to look for: damped curves sitting above the bare one, right of sqrt(2).
  const fnSoft = naturalHz(SPRINGS.soft, lv.mass)
  const rightOfCross = 1.6 * fnSoft
  check('the plotted curves really do cross over, as the copy claims', transmissibilityAt(SPRINGS.soft, lv.mass, 3, rightOfCross) > transmissibilityAt(SPRINGS.soft, lv.mass, 0, rightOfCross) && rightOfCross <= 4.0, `at ${rightOfCross.toFixed(2)} Hz (r = 1.6) the 3-damper curve reads ${transmissibilityAt(SPRINGS.soft, lv.mass, 3, rightOfCross).toFixed(3)} against ${transmissibilityAt(SPRINGS.soft, lv.mass, 0, rightOfCross).toFixed(3)} bare, and both are on screen`)
}

section('Level 5, sign off the suspension')
{
  const lv = LEVELS[4]
  const wins = winners(lv)
  check('8 of the 16 setups pass', wins.length === 8, `${wins.map(name).join(', ')}`)
  check('the load rule alone kills soft and medium', grid(lv).filter((s) => s.id === 'soft' || s.id === 'medium').every((s) => s.bottomsOut), `sag ${(sagOf(SPRINGS.soft, 1200) * 1000).toFixed(0)} mm and ${(sagOf(SPRINGS.medium, 1200) * 1000).toFixed(0)} mm against ${TRAVEL * 1000} mm`)
  check('both surviving springs pass at every damper count', wins.filter((s) => s.id === 'firm').length === 4 && wins.filter((s) => s.id === 'stiff').length === 4, `firm ${(evaluate(lv, 'firm', 0).amp * 100).toFixed(0)}-${(evaluate(lv, 'firm', 3).amp * 100).toFixed(0)}%, stiff ${(evaluate(lv, 'stiff', 0).amp * 100).toFixed(0)}-${(evaluate(lv, 'stiff', 3).amp * 100).toFixed(0)}%, all under the ${lv.maxAmp * 100}% limit`)
  check('both are past the crossover, so dampers only cost them at cruise', wins.every((s) => s.r > Math.SQRT2), `firm r = ${evaluate(lv, 'firm', 0).r.toFixed(2)}, stiff r = ${evaluate(lv, 'stiff', 0).r.toFixed(2)}`)

  // The three pars must genuinely fight each other.
  const met = (s) => [s.amp * 100 <= PARS.shake, s.marginMm >= PARS.margin, s.peak * 100 <= PARS.peak]
  const hits = wins.map((s) => met(s).filter(Boolean).length)
  check('NO winning setup meets all three pars', Math.max(...hits) === 2, `best any setup manages is ${Math.max(...hits)} of 3; ${hits.filter((h) => h === 2).length} setup(s) reach two`)
  const counts = [0, 1, 2].map((i) => wins.filter((s) => met(s)[i]).length)
  check('each par is individually reachable', counts.every((c) => c > 0), `shake ${counts[0]}, margin ${counts[1]}, peak ${counts[2]} of ${wins.length} winners`)
  const best = (key, dir) => wins.reduce((a, b) => (dir * (b[key] - a[key]) < 0 ? b : a))
  const champs = [best('amp', 1), best('marginMm', -1), best('peak', 1)]
  check('the three par winners are three different setups', new Set(champs.map(name)).size === 3, `quietest ${name(champs[0])}, most margin ${name(champs[1])}, flattest spike ${name(champs[2])}`)

  // The trade has to run in both directions or it is not a trade.
  check('quieter at cruise means a worse spike', best('amp', 1).peak > best('peak', 1).peak, `the quietest setup spikes at ${(best('amp', 1).peak * 100).toFixed(0)}%, the flattest at ${(best('peak', 1).peak * 100).toFixed(0)}%`)
  check('more load margin means noisier at cruise', best('marginMm', -1).amp > best('amp', 1).amp, `the stiff spring keeps ${best('marginMm', -1).marginMm.toFixed(0)} mm but rides at ${(best('marginMm', -1).amp * 100).toFixed(0)}% against ${(best('amp', 1).amp * 100).toFixed(0)}%`)

  for (const [i, label] of ['quietest at cruise', 'most load margin', 'flattest spike'].entries()) {
    const c = champs[i]
    console.log(`        ${label}: ${name(c)}  cruise ${(c.amp * 100).toFixed(0)}%, margin ${c.marginMm.toFixed(0)} mm, spike ${c.peak >= PEAK_OFF_SCALE ? 'off scale' : `${(c.peak * 100).toFixed(0)}%`}`)
  }

  // The tuning comment in the source states the grid result. Hold it to it.
  check('the tuning comment in the source still tells the truth', Math.round(evaluate(lv, 'firm', 0).amp * 100) === 31 && Math.round(evaluate(lv, 'firm', 3).amp * 100) === 44 && Math.round(evaluate(lv, 'firm', 0).marginMm) === 42 && Math.round(evaluate(lv, 'stiff', 0).amp * 100) === 60 && Math.round(evaluate(lv, 'stiff', 3).amp * 100) === 68 && Math.round(evaluate(lv, 'stiff', 0).marginMm) === 86, 'the comment claims firm 31-44% / 42 mm and stiff 60-68% / 86 mm; both reproduce')
}

/* ------------------- 4. the old bug stays fixed ------------------- */

section('Regression: the magnification factor does not come back')
{
  // The retired formula and the current one agree below the crossover and part
  // company above it. These checks fail loudly if someone reverts the numerator.
  const k = SPRINGS.soft, m = LEVELS[3].mass, road = LEVELS[3].roadHz
  const nowT = [0, 1, 2, 3].map((d) => transmissibilityAt(k, m, d, road))
  const oldM = [0, 1, 2, 3].map((d) => magnification(k, m, d, road))
  check('the two functions still disagree on level 4, in opposite directions', nowT[3] > nowT[0] && oldM[3] < oldM[0], `T rises ${nowT[0].toFixed(3)} -> ${nowT[3].toFixed(3)} with dampers; the old M fell ${oldM[0].toFixed(3)} -> ${oldM[3].toFixed(3)}`)
  // The old formula passed a damped setup AND rewarded stacking more dampers
  // on it, while the true physics punishes every one added out here. Both
  // halves are falsifiable: revert the numerator and nowT stops rising;
  // loosen the level and oldM[1] stops passing.
  check('under the OLD formula level 4 would teach the opposite lesson', oldM[1] <= LEVELS[3].maxAmp && oldM[3] < oldM[1] && nowT[1] > nowT[0], `the old model passed soft+1 at ${oldM[1].toFixed(3)} and said 3 dampers were even quieter (${oldM[3].toFixed(3)}); the truth is each damper adds shake (T ${nowT[0].toFixed(3)} -> ${nowT[1].toFixed(3)}), so the level now requires taking them off`)
  // Undamped, the two are identical, so any check that passes at zeta = 0
  // proves nothing about which formula is in place.
  check('with no dampers the two are identical, so zeta = 0 proves nothing', Math.abs(nowT[0] - oldM[0]) < 1e-12, `both read ${nowT[0].toFixed(6)}; only a damped setup can tell them apart`)
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`)
process.exit(failures === 0 ? 0 : 1)
