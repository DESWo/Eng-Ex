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
 *    and zeta = c/(2 sqrt(km)) done by hand, and the closed-form values of the
 *    response at r = 0, r = 1, the resonant peak, and r -> infinity.
 *
 * 2. Check that every level still teaches what it was tuned to teach: the
 *    intended winner wins, and the tempting wrong answer loses. Level 3 stands
 *    on a 0.12% frequency coincidence between a spring constant and a road
 *    speed, which nobody will notice going wrong by playing.
 *
 * 3. Say plainly WHICH function the code implements. The comment at line 40
 *    calls it transmissibility. It is not. See the last section.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '../src/challenges/mechanical/SuspensionChallenge.tsx')
const src = readFileSync(SRC, 'utf8')

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

/** naturalHz, line 34. */
const naturalHz = (k, m) => Math.sqrt(k / m) / (2 * Math.PI)
/** the zeta line inside ampAt, line 43. */
const zetaOf = (k, m, dampers) => (DAMPER_C * dampers) / (2 * Math.sqrt(k * m))
/** ampAt, lines 41-45. The name in the source comment is wrong, see last section. */
const ampAt = (k, m, dampers, roadHz) => {
  const r = roadHz / naturalHz(k, m)
  const zeta = zetaOf(k, m, dampers)
  return 1 / Math.sqrt((1 - r * r) ** 2 + (2 * zeta * r) ** 2)
}
/** sagOf and harshnessOf, lines 47-48. */
const sagOf = (k, m) => (m * G) / k
const harshnessOf = (k, m) => Math.sqrt(k / m)

/** The level table, mirrored from LEVELS at lines 68-123. */
const LEVELS = [
  { n: 1, mass: 700, maxHarsh: 10, roadHz: null, maxAmp: 99, sagMatters: false },
  { n: 2, mass: 1200, maxHarsh: 10, roadHz: null, maxAmp: 99, sagMatters: true },
  { n: 3, mass: 700, maxHarsh: null, roadHz: 1.9, maxAmp: 0.8, sagMatters: false },
  { n: 4, mass: 700, maxHarsh: null, roadHz: 1.55, maxAmp: 0.8, sagMatters: false },
  { n: 5, mass: 1200, maxHarsh: null, roadHz: 2.6, maxAmp: 0.9, sagMatters: true },
]
/** Level 5 metrics, lines 118-120. */
const PARS = { shake: 44, margin: 60, dampers: 1 }

/** The pass rule, lines 156-163. */
function evaluate(lv, id, dampers) {
  const k = SPRINGS[id]
  const sag = sagOf(k, lv.mass)
  const bottomsOut = lv.sagMatters && sag > TRAVEL
  const harsh = harshnessOf(k, lv.mass)
  const tooHarsh = lv.maxHarsh !== null && harsh > lv.maxHarsh
  const amp = lv.roadHz !== null ? ampAt(k, lv.mass, dampers, lv.roadHz) : 0
  const shaken = lv.roadHz !== null && amp > lv.maxAmp
  return {
    id, dampers, sag, harsh, amp, bottomsOut, tooHarsh, shaken,
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

/** True base-excitation transmissibility, for the last section only. */
const trueT = (k, m, dampers, roadHz) => {
  const r = roadHz / naturalHz(k, m)
  const zeta = zetaOf(k, m, dampers)
  return Math.sqrt(1 + (2 * zeta * r) ** 2) / Math.sqrt((1 - r * r) ** 2 + (2 * zeta * r) ** 2)
}

/* ------------------- 1. the replica still matches the component ------------------- */

section('Replica matches the component')
{
  const ks = [...src.matchAll(/\bk: (\d+),/g)].map((m) => Number(m[1]))
  check('the four spring rates are unchanged', String(ks) === String(SPRING_IDS.map((i) => SPRINGS[i])), `soft/medium/firm/stiff = ${ks.join(', ')} N/m`)

  const scalars = [
    ['DAMPER_C', DAMPER_C], ['MAX_DAMPERS', MAX_DAMPERS], ['TRAVEL', TRAVEL], ['G', G],
  ]
  const badScalar = scalars.find(([k, v]) => !new RegExp(`const ${k} = ${v}\\b`).test(src))
  check('DAMPER_C, MAX_DAMPERS, TRAVEL and G are unchanged', !badScalar, badScalar ? `${badScalar[0]} moved` : '2000 N·s/m, 3, 0.16 m, 9.81 m/s²')

  const formulas = [
    ['naturalHz', 'Math.sqrt(k / m) / (2 * Math.PI)'],
    ['r', 'const r = roadHz / naturalHz(k, m)'],
    ['zeta', 'const zeta = (DAMPER_C * dampers) / (2 * Math.sqrt(k * m))'],
    ['ampAt', 'return 1 / Math.sqrt((1 - r * r) ** 2 + (2 * zeta * r) ** 2)'],
    ['sagOf', 'const sagOf = (k: number, m: number) => (m * G) / k'],
    ['harshnessOf', 'const harshnessOf = (k: number, m: number) => Math.sqrt(k / m)'],
    ['pass rule', 'const passes = !bottomsOut && !tooHarsh && !shaken'],
  ]
  const badFormula = formulas.find(([, text]) => !src.includes(text))
  check('all seven formulas are character-for-character what this file replicates', !badFormula, badFormula ? `${badFormula[0]} changed` : 'naturalHz, r, zeta, ampAt, sagOf, harshnessOf, pass rule')

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
  check('the level 5 pars are unchanged', String(targets) === String([PARS.shake, PARS.margin, PARS.dampers]), `shake ${targets[0]}%, margin ${targets[1]} mm, dampers ${targets[2]}`)
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
  // Halving stiffness drops fn by sqrt(2); quadrupling doubles it. No constants involved.
  const ratio = naturalHz(120000, 700) / naturalHz(30000, 700)
  check('quadrupling k doubles fn, as sqrt(k) demands', Math.abs(ratio - 2) < 1e-12, `${ratio.toFixed(12)}`)
  const massRatio = naturalHz(60000, 2800) / naturalHz(60000, 700)
  check('quadrupling m halves fn', Math.abs(massRatio - 0.5) < 1e-12, `${massRatio.toFixed(12)}`)
  // harshnessOf is the natural frequency in rad/s wearing a different name.
  const worstH = SPRING_IDS.reduce((a, id) => Math.max(a, Math.abs(harshnessOf(SPRINGS[id], 700) - 2 * Math.PI * naturalHz(SPRINGS[id], 700))), 0)
  check('the "harshness" number is exactly the natural frequency in rad/s', worstH < 1e-9, `so the level 1 and 2 cap of 10 means 10 rad/s = ${(10 / (2 * Math.PI)).toFixed(4)} Hz`)
  // Static sag is the textbook one: x = mg/k, and fn = sqrt(g/x)/(2 pi) follows.
  const sag = sagOf(100000, 1200)
  const fromSag = Math.sqrt(G / sag) / (2 * Math.PI)
  check('sag and frequency agree: fn = sqrt(g/sag)/2pi', Math.abs(fromSag - naturalHz(100000, 1200)) < 1e-12, `117.7 mm of sag on the firm spring gives ${fromSag.toFixed(6)} Hz`)
}

section('Damping ratio against hand arithmetic')
{
  // zeta = c / (2 sqrt(km)), c = 2000 N·s/m per damper.
  // Soft at 1200 kg: sqrt(30000*1200) = sqrt(3.6e7) = 6000 exactly, so the
  // critical damping is 12000 N·s/m and zeta = 2000d/12000 = d/6 exactly.
  for (let d = 0; d <= MAX_DAMPERS; d++) {
    const z = zetaOf(SPRINGS.soft, 1200, d)
    check(`soft spring at 1200 kg with ${d} damper(s) gives zeta = ${d}/6`, Math.abs(z - d / 6) < 1e-15, `${z.toFixed(6)}, critical damping 12000 N·s/m`)
  }
  // Firm at 700 kg: sqrt(1e5*700) = sqrt(7e7) = 8366.6003, 2x = 16733.201,
  // so one damper is 2000/16733.201 = 0.1195229.
  const HAND_FIRM_700 = [0, 0.119523, 0.239046, 0.358569]
  const worst = HAND_FIRM_700.reduce((a, v, d) => Math.max(a, Math.abs(zetaOf(SPRINGS.firm, 700, d) - v)), 0)
  check('firm spring at 700 kg matches hand arithmetic for 0..3 dampers', worst < 5e-7, `zeta = ${HAND_FIRM_700.map((v) => v.toFixed(4)).join(', ')}`)
  // Every setup a student can build is underdamped, which is why any of this
  // has a resonance at all.
  const all = [700, 1200].flatMap((m) => SPRING_IDS.map((id) => zetaOf(SPRINGS[id], m, MAX_DAMPERS)))
  check('every reachable setup is underdamped (zeta < 1)', Math.max(...all) < 1, `heaviest damping in the game is zeta = ${Math.max(...all).toFixed(4)}, soft spring loaded with 3 dampers`)
}

section('Response against closed form')
{
  // r = 0: a road that never bumps moves the body by exactly its own amount.
  const still = ampAt(SPRINGS.medium, 700, 2, 0)
  check('at r = 0 the response is exactly 1', still === 1, `${still}`)

  // r = 1: the (1 - r^2) term vanishes and only 2*zeta*r survives, so the
  // closed form is 1/(2 zeta). Soft at 1200 kg with 3 dampers is zeta = 1/2,
  // so this must be exactly 1.
  const fnSoft = naturalHz(SPRINGS.soft, 1200)
  const atRes = ampAt(SPRINGS.soft, 1200, 3, fnSoft)
  check('at r = 1 with zeta = 1/2 the response is exactly 1', Math.abs(atRes - 1) < 1e-12, `${atRes.toFixed(12)}, the closed form 1/(2 zeta)`)
  let worstQ = 0
  for (const m of [700, 1200]) for (const id of SPRING_IDS) for (let d = 1; d <= 3; d++) {
    const got = ampAt(SPRINGS[id], m, d, naturalHz(SPRINGS[id], m))
    worstQ = Math.max(worstQ, Math.abs(got - 1 / (2 * zetaOf(SPRINGS[id], m, d))) / got)
  }
  check('at r = 1 every damped setup equals 1/(2 zeta)', worstQ < 1e-12, `24 setups, worst relative error ${worstQ.toExponential(1)}`)

  // Undamped, away from r = 1, the closed form is the bare 1/|1 - r^2|.
  let worstU = 0
  for (const r of [0.25, 0.5, 2, 3, 10]) {
    const got = ampAt(SPRINGS.firm, 700, 0, r * naturalHz(SPRINGS.firm, 700))
    worstU = Math.max(worstU, Math.abs(got - 1 / Math.abs(1 - r * r)) / got)
  }
  check('undamped response equals 1/|1 - r^2| at r = 0.25, 0.5, 2, 3, 10', worstU < 1e-12, `worst relative error ${worstU.toExponential(1)}`)

  // Large r: the mass cannot follow, so the response dies as 1/r^2.
  const fnFirm = naturalHz(SPRINGS.firm, 700)
  const far = ampAt(SPRINGS.firm, 700, 2, 10000 * fnFirm)
  check('the response tends to zero at large r', far < 1e-7, `${far.toExponential(2)} at r = 10000`)
  const decay = ampAt(SPRINGS.firm, 700, 2, 100 * fnFirm) * 100 ** 2
  check('the tail decays as 1/r^2', Math.abs(decay - 1) < 2e-3, `r^2 * response = ${decay.toFixed(5)} at r = 100`)

  // The peak is NOT at r = 1 once damped: it sits at r = sqrt(1 - 2 zeta^2)
  // with height 1/(2 zeta sqrt(1 - zeta^2)). Textbook, and checkable by
  // sweeping the same function the game plots.
  const k = SPRINGS.medium, m = 700, d = 2
  const zeta = zetaOf(k, m, d)
  let best = { r: 0, a: 0 }
  for (let i = 1; i <= 400000; i++) {
    const r = i / 100000
    const a = ampAt(k, m, d, r * naturalHz(k, m))
    if (a > best.a) best = { r, a }
  }
  const rPeak = Math.sqrt(1 - 2 * zeta * zeta)
  const aPeak = 1 / (2 * zeta * Math.sqrt(1 - zeta * zeta))
  check('the peak sits at r = sqrt(1 - 2 zeta^2) with height 1/(2 zeta sqrt(1 - zeta^2))', Math.abs(best.r - rPeak) < 2e-4 && Math.abs(best.a - aPeak) / aPeak < 1e-6, `swept peak ${best.a.toFixed(5)} at r = ${best.r.toFixed(5)}, closed form ${aPeak.toFixed(5)} at r = ${rPeak.toFixed(5)}`)
}

section('Undamped resonance')
{
  // r = 1 with no dampers divides by zero. JS gives Infinity, not a throw and
  // not NaN, and the two places the number reaches the screen both clamp it.
  const fnFirm = naturalHz(SPRINGS.firm, 700)
  const blow = ampAt(SPRINGS.firm, 700, 0, fnFirm)
  check('exact undamped resonance returns Infinity, not NaN and not a throw', blow === Infinity, `1/sqrt(0 + 0) = ${blow}`)
  check('the curve clamps it', Math.min(4, blow) === 4 && src.includes('Math.min(4, ampAt(spring.k, round.mass, dampers, f))'), 'line 235 caps the plotted curve at 4')
  check('the body-bounce animation clamps it', Math.min(26, blow * 12) === 26 && src.includes('Math.min(26, amp * 12)'), 'line 226 caps the drawn bounce at 26 px')
  check('the verdict copy has an Infinity branch', src.includes("amp > 4 ? 'violently'"), 'line 410 says "violently" instead of printing Infinity')
  // No level actually lands on exact resonance, so Infinity is unreachable in
  // play. Level 3 gets closest and stays finite.
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
  check('the setup the level OPENS on fails', !stiff.passes && stiff.tooHarsh, `stiff starts selected (line 130) at ${stiff.harsh.toFixed(2)} rad/s, 51% over the cap`)
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
  // The squeeze is a two-line inequality: mg/k <= 0.16 and sqrt(k/m) <= 10.
  const kMin = (1200 * G) / TRAVEL
  const kMax = 10 * 10 * 1200
  check('hand-derived window is 73575 <= k <= 120000 N/m and only firm is in it', Math.abs(kMin - 73575) < 1e-9 && kMax === 120000 && SPRING_IDS.filter((id) => SPRINGS[id] >= kMin && SPRINGS[id] <= kMax).join() === 'firm', `${kMin.toFixed(0)} to ${kMax} N/m, firm is 100000`)
}

section('Level 3, the washboard road (the resonance lesson)')
{
  const lv = LEVELS[2]
  // The whole level is one coincidence: the level 2 winner's natural frequency
  // and this road's drumming are the same number to 0.12%.
  const fnFirm = naturalHz(SPRINGS.firm, lv.mass)
  const detune = Math.abs(fnFirm - lv.roadHz) / lv.roadHz
  check("the level 2 winner's natural frequency sits on the level 3 road frequency", detune < 0.002, `firm on the empty van bounces at ${fnFirm.toFixed(4)} Hz, the road drums at ${lv.roadHz} Hz, r = ${(lv.roadHz / fnFirm).toFixed(5)}, ${(detune * 100).toFixed(2)}% apart`)
  const firm0 = evaluate(lv, 'firm', 0)
  check('the level 2 winner shakes itself apart here', !firm0.passes && firm0.shaken, `response ${firm0.amp.toFixed(0)}x against a limit of ${lv.maxAmp}, that is ${(firm0.amp / lv.maxAmp).toFixed(0)} times over`)
  check('no amount of damping saves the firm spring', grid(lv).filter((s) => s.id === 'firm').every((s) => !s.passes), `3 dampers only pull it to ${evaluate(lv, 'firm', 3).amp.toFixed(2)}, still over ${lv.maxAmp}`)
  // Softening detunes; stiffening does not go far enough.
  const soft0 = evaluate(lv, 'soft', 0)
  check('softening genuinely detunes it, with no dampers at all', soft0.passes, `soft bounces at ${naturalHz(SPRINGS.soft, lv.mass).toFixed(3)} Hz so r = ${soft0.r.toFixed(3)}, response ${soft0.amp.toFixed(3)}, a ${(firm0.amp / soft0.amp).toFixed(0)}x improvement on one part change`)
  const stiff = grid(lv).filter((s) => s.id === 'stiff')
  check('stiffening instead fails at every damper count', stiff.every((s) => !s.passes), `r = ${stiff[0].r.toFixed(3)} is still under 1, response ${stiff[0].amp.toFixed(2)} down to ${stiff[3].amp.toFixed(2)}`)
  const wins = winners(lv)
  check('5 of the 16 setups pass', wins.length === 5, `${wins.map(name).join(', ')}`)
  check('every winner sits above resonance (r > 1)', wins.every((s) => s.r > 1), `r from ${Math.min(...wins.map((s) => s.r)).toFixed(2)} to ${Math.max(...wins.map((s) => s.r)).toFixed(2)}`)
}

section('Level 4, read the response curve')
{
  const lv = LEVELS[3]
  // The spike moved: at 1.55 Hz it is the MEDIUM spring that resonates now.
  const fnMed = naturalHz(SPRINGS.medium, lv.mass)
  const med0 = evaluate(lv, 'medium', 0)
  check('the resonant spring changed from firm to medium when the road slowed', Math.abs(fnMed - lv.roadHz) / lv.roadHz < 0.06 && med0.amp > 9, `medium bounces at ${fnMed.toFixed(4)} Hz against a ${lv.roadHz} Hz road, r = ${med0.r.toFixed(4)}, response ${med0.amp.toFixed(2)}`)
  const wins = winners(lv)
  check('3 of the 16 setups pass, all of them soft', wins.length === 3 && wins.every((s) => s.id === 'soft'), `${wins.map(name).join(', ')}`)
  const soft0 = evaluate(lv, 'soft', 0)
  check('the level 3 answer (soft, no dampers) now FAILS, narrowly', !soft0.passes && soft0.shaken, `${soft0.amp.toFixed(4)} against a limit of ${lv.maxAmp}, only ${((soft0.amp / lv.maxAmp - 1) * 100).toFixed(1)}% over, so the level really does need the dampers it teaches`)
  const soft1 = evaluate(lv, 'soft', 1)
  check('one damper is enough, which is what the curve is meant to show', soft1.passes, `${soft1.amp.toFixed(4)}, and 3 dampers reach ${evaluate(lv, 'soft', 3).amp.toFixed(4)}`)
  // The plotted window is 0.4 to 4.0 Hz (line 233), and the marker is the road.
  const marked = lv.roadHz >= 0.4 && lv.roadHz <= 4.0
  check("the road marker lands inside the plotted window", marked && src.includes('const f = 0.4 + (i / 80) * 3.6'), `curve spans 0.4 to 4.0 Hz, marker at ${lv.roadHz} Hz`)
  // Line 481 tells the student dampers "cannot move the resonance". The peak
  // of the plotted curve is at r = sqrt(1 - 2 zeta^2), which does move.
  const zeta3 = zetaOf(SPRINGS.soft, lv.mass, 3)
  const peakShift = 1 - Math.sqrt(1 - 2 * zeta3 * zeta3)
  check('but the plotted peak DOES move with damper count (copy issue, not a bug)', peakShift > 0.05, `soft + 3 dampers is zeta ${zeta3.toFixed(3)}, so the peak slides from r = 1 to r = ${Math.sqrt(1 - 2 * zeta3 * zeta3).toFixed(3)} (${(peakShift * 100).toFixed(0)}%), i.e. ${(Math.sqrt(1 - 2 * zeta3 * zeta3) * naturalHz(SPRINGS.soft, lv.mass)).toFixed(3)} Hz, left of the plotted window; the UNDAMPED frequency on the badge is what does not move`)
}

section('Level 5, sign off the suspension')
{
  const lv = LEVELS[4]
  const wins = winners(lv)
  check('5 of the 16 setups pass', wins.length === 5, `${wins.map(name).join(', ')}`)
  check('the load rule alone kills soft and medium', grid(lv).filter((s) => s.id === 'soft' || s.id === 'medium').every((s) => s.bottomsOut), `sag ${(sagOf(SPRINGS.soft, 1200) * 1000).toFixed(0)} mm and ${(sagOf(SPRINGS.medium, 1200) * 1000).toFixed(0)} mm against ${TRAVEL * 1000} mm`)
  check('firm passes at any damper count, stiff only with all three', wins.filter((s) => s.id === 'firm').length === 4 && wins.filter((s) => s.id === 'stiff').map((s) => s.dampers).join() === '3', `firm shake ${(evaluate(lv, 'firm', 3).amp * 100).toFixed(0)} to ${(evaluate(lv, 'firm', 0).amp * 100).toFixed(0)}%, stiff needs 3 dampers to reach ${(evaluate(lv, 'stiff', 3).amp * 100).toFixed(0)}% (2 dampers is ${(evaluate(lv, 'stiff', 2).amp * 100).toFixed(1)}%, over the ${lv.maxAmp * 100}% limit)`)

  // The sign-off only means something if no setup sweeps the pars.
  const met = (s) => [s.amp * 100 <= PARS.shake, s.marginMm >= PARS.margin, s.dampers <= PARS.dampers]
  const hits = wins.map((s) => met(s).filter(Boolean).length)
  check('NO winning setup meets more than one par', Math.max(...hits) === 1, `checked all ${wins.length} winners; ${hits.filter((h) => h === 1).length} meet exactly one`)
  const counts = [0, 1, 2].map((i) => wins.filter((s) => met(s)[i]).length)
  check('each par is individually reachable', counts.every((c) => c > 0), `shake ${counts[0]}, margin ${counts[1]}, dampers ${counts[2]} of ${wins.length} winners`)
  const best = (key, dir) => wins.reduce((a, b) => (dir * (b[key] - a[key]) < 0 ? b : a))
  const champs = [best('amp', 1), best('marginMm', -1), best('dampers', 1)]
  check('the three par winners are three different setups', new Set(champs.map(name)).size === 3, `quietest ${name(champs[0])}, most margin ${name(champs[1])}, fewest parts ${name(champs[2])}`)
  for (const [i, label] of ['quietest', 'most load margin', 'fewest parts'].entries()) {
    const c = champs[i]
    console.log(`        ${label}: ${name(c)}  shake ${(c.amp * 100).toFixed(0)}%, margin ${c.marginMm.toFixed(0)} mm, ${c.dampers} damper(s)`)
  }
  // The comment at lines 111-117 states the grid result. Hold it to it.
  check('the tuning comment in the source still tells the truth', /shake 41 to 45%[\s\S]*margin 42 mm[\s\S]*shake\s*\/\/\s*85%|shake 41 to 45%/.test(src) && Math.round(evaluate(lv, 'firm', 3).amp * 100) === 41 && Math.round(evaluate(lv, 'firm', 0).amp * 100) === 45 && Math.round(evaluate(lv, 'firm', 0).marginMm) === 42 && Math.round(evaluate(lv, 'stiff', 3).amp * 100) === 85 && Math.round(evaluate(lv, 'stiff', 3).marginMm) === 86, 'lines 111-117 claim firm 41-45% / 42 mm and stiff+3 at 85% / 86 mm; both reproduce')
}

/* ------------------- 4. which function is this, really ------------------- */

section('What the code implements (documented difference, NOT a failure)')
{
  // The comment at line 40 says "Classic single degree-of-freedom
  // transmissibility". The returned expression is the MAGNIFICATION FACTOR
  //     M(r) = 1 / sqrt((1-r^2)^2 + (2 zeta r)^2)
  // which is force-to-displacement amplification. Base-excitation
  // transmissibility, the thing that describes a road shaking a car body, is
  //     T(r) = sqrt(1 + (2 zeta r)^2) / sqrt((1-r^2)^2 + (2 zeta r)^2)
  // The missing numerator is the damper's own force path from the wheel into
  // the body, and it changes the physics above r = sqrt(2).
  check('the source calls it transmissibility', src.includes('Classic single degree-of-freedom transmissibility'), 'line 40')
  check('the implemented numerator is 1, so it is the magnification factor', src.includes('return 1 / Math.sqrt((1 - r * r) ** 2 + (2 * zeta * r) ** 2)') && !src.includes('Math.sqrt(1 + (2 * zeta * r)'), 'line 44 has no sqrt(1 + (2 zeta r)^2) numerator')

  // Consequence 1: true T is exactly 1 at r = sqrt(2) for every damping ratio.
  // The implemented M is not, and falls with damping instead.
  const r2 = Math.SQRT2
  const Ts = [0, 0.1, 0.3, 0.5].map((z) => Math.sqrt(1 + (2 * z * r2) ** 2) / Math.sqrt((1 - 2) ** 2 + (2 * z * r2) ** 2))
  const Ms = [0, 0.1, 0.3, 0.5].map((z) => 1 / Math.sqrt((1 - 2) ** 2 + (2 * z * r2) ** 2))
  check('true transmissibility crosses 1 at r = sqrt(2) for ANY damping', Ts.every((t) => Math.abs(t - 1) < 1e-12), `zeta 0/0.1/0.3/0.5 all give T = 1.000000`)
  check('the implemented function does not, it drops with damping there', Math.abs(Ms[0] - 1) < 1e-12 && Ms[3] < 0.6, `M = ${Ms.map((v) => v.toFixed(3)).join(', ')} for the same four damping ratios`)

  // Consequence 2: above r = sqrt(2), real damping HURTS isolation. The
  // implemented function says the opposite, monotonically.
  const rHigh = 3
  const Thi = [0.1, 0.5].map((z) => Math.sqrt(1 + (2 * z * rHigh) ** 2) / Math.sqrt((1 - 9) ** 2 + (2 * z * rHigh) ** 2))
  const Mhi = [0.1, 0.5].map((z) => 1 / Math.sqrt((1 - 9) ** 2 + (2 * z * rHigh) ** 2))
  check('above sqrt(2) real damping makes isolation WORSE', Thi[1] > Thi[0], `at r = 3, T goes ${Thi[0].toFixed(3)} -> ${Thi[1].toFixed(3)} as zeta goes 0.1 -> 0.5`)
  check('the implemented function says damping always helps', Mhi[1] < Mhi[0], `at r = 3, M goes ${Mhi[0].toFixed(3)} -> ${Mhi[1].toFixed(3)} over the same range`)

  // Consequence 3, in the game. Level 4 and level 5 both put their winners
  // above r = sqrt(2)... or right on it, which is where the two functions
  // disagree most about what the student learns.
  const l4 = evaluate(LEVELS[3], 'soft', 1)
  const l4T = trueT(SPRINGS.soft, LEVELS[3].mass, 1, LEVELS[3].roadHz)
  check('level 4 winners sit above the crossover, where the two disagree', l4.r > Math.SQRT2, `soft is at r = ${l4.r.toFixed(3)}; the game scores soft+1 at ${l4.amp.toFixed(3)} (pass), true transmissibility is ${l4T.toFixed(3)} (would fail the ${LEVELS[3].maxAmp} limit)`)
  const l4All = grid(LEVELS[3]).map((s) => trueT(SPRINGS[s.id], LEVELS[3].mass, s.dampers, LEVELS[3].roadHz))
  check('under true transmissibility level 4 would have NO winner', Math.min(...l4All) > LEVELS[3].maxAmp, `best of all 16 setups is ${Math.min(...l4All).toFixed(3)} against a ${LEVELS[3].maxAmp} limit; do not "fix" this, it retunes the level`)
  const l5stiff = [0, 1, 2, 3].map((d) => trueT(SPRINGS.stiff, LEVELS[4].mass, d, LEVELS[4].roadHz))
  check('level 5 puts the stiff spring almost exactly on r = sqrt(2)', Math.abs(evaluate(LEVELS[4], 'stiff', 3).r - Math.SQRT2) < 0.001, `r = ${evaluate(LEVELS[4], 'stiff', 3).r.toFixed(5)} against sqrt(2) = ${Math.SQRT2.toFixed(5)}`)
  check('so its damper sweep is the clearest disagreement in the game', l5stiff.every((t) => Math.abs(t - 1) < 0.002), `true T stays ${l5stiff[0].toFixed(3)} to ${l5stiff[3].toFixed(3)} for 0..3 dampers (damping does nothing at the crossover), while the game reports ${(evaluate(LEVELS[4], 'stiff', 0).amp * 100).toFixed(1)}% falling to ${(evaluate(LEVELS[4], 'stiff', 3).amp * 100).toFixed(1)}%, which is what makes stiff+3 the level 5 load-margin winner`)
  const l5firmT = trueT(SPRINGS.firm, LEVELS[4].mass, 3, LEVELS[4].roadHz)
  check('the level 5 "more dampers, quieter" par is a consequence of the missing numerator', evaluate(LEVELS[4], 'firm', 3).amp < evaluate(LEVELS[4], 'firm', 0).amp && l5firmT > trueT(SPRINGS.firm, LEVELS[4].mass, 0, LEVELS[4].roadHz), `firm at r = ${evaluate(LEVELS[4], 'firm', 0).r.toFixed(2)}: game says 45% -> 41% as dampers go 0 -> 3, true T says ${(trueT(SPRINGS.firm, LEVELS[4].mass, 0, LEVELS[4].roadHz) * 100).toFixed(0)}% -> ${(l5firmT * 100).toFixed(0)}%`)
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`)
process.exit(failures === 0 ? 0 : 1)
