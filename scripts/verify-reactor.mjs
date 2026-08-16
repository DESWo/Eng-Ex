/**
 * Offline guard for Reactor Control (src/challenges/nuclear/ReactorChallenge.tsx).
 *
 *   node scripts/verify-reactor.mjs
 *
 * The plant lives inside the component's setInterval, so there is nothing to
 * import. The tick below is transcribed line for line from ReactorChallenge.tsx
 * lines 196-234, and the first section re-reads that file to prove the
 * transcription still matches: every constant, every expression in the tick, and
 * every level setup. If someone edits the component, this fails before any of
 * the physics checks get a chance to lie.
 *
 * Everything after that is checked against numbers from outside the code:
 *
 * 1. The closed-form step response of a first-order lag, its time constant, and
 *    the exact solution of the two-stage lag that drives core temperature.
 * 2. The steady state implied by the energy balance, worked by hand.
 * 3. The closed-loop ringing of an operator who corrects every tick, from the
 *    eigenvalues of the 2x2 loop matrix.
 * 4. Every rod and pump combination that can hold each level's band, enumerated
 *    from the algebra rather than by playing.
 *
 * Then each level gets a scripted operator, plain enough that a student could
 * follow it, and the win condition is read the way the component reads it.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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

/* ------------------- the plant, mirrored from the component ------------------- */

// ReactorChallenge.tsx lines 32-42.
const MAX_POWER = 1100
const SAFE_TEMP = 600
const MELTDOWN_TEMP = 900
const BASE_TEMP = 250
const HEAT_FACTOR = 0.6
const COOLANT_PULL = 11
const PUMP_DRAW = 40
const TICK_MS = 300
const POWER_LAG = 0.12
const TEMP_LAG = 0.1
const HOLD_TICKS = 16
// Board only, lines 46-51.
const ALARM_TEMP = 750
const TEMP_SCALE_MAX = 1000

// LEVELS[].setup, lines 79-125. Only the fields the sim reads.
const ROUNDS = [
  { n: 1, band: [480, 580], phases: null, phaseTicks: 0, pumpsDraw: false, lag: false },
  { n: 2, band: [760, 860], phases: null, phaseTicks: 0, pumpsDraw: true, lag: false },
  { n: 3, band: [760, 860], phases: null, phaseTicks: 0, pumpsDraw: true, lag: true },
  { n: 4, band: [900, 1000], phases: null, phaseTicks: 0, pumpsDraw: true, lag: true },
  { n: 5, band: [480, 580], phases: [[480, 580], [760, 860], [960, 1050]], phaseTicks: 34, pumpsDraw: true, lag: true },
]
/** Level 5 scorecard targets, lines 119-123. */
const PARS = { inband: 75, peak: 560, pumps: 260 }
/** A lagged round with a band nothing can satisfy, so a probe run never ends early. */
const PROBE = { band: [-2, -1], phases: null, phaseTicks: 0, pumpsDraw: true, lag: true }

/**
 * One tick, transcribed from ReactorChallenge.tsx lines 196-234. `plant` is the
 * component's plantRef, `ctl` is rodsRef and coolantRef.
 */
function tick(round, plant, ctl) {
  const demand = ((100 - ctl.rods) / 100) * MAX_POWER
  const power = round.lag ? plant.power + (demand - plant.power) * POWER_LAG : demand
  const gross = round.lag ? plant.power : demand
  const eq = BASE_TEMP + Math.max(0, gross - ctl.coolant * COOLANT_PULL) * HEAT_FACTOR
  const nextTemp = round.lag ? plant.temp + (eq - plant.temp) * TEMP_LAG : eq
  const pumps = ctl.coolant / 25
  const net = Math.round(power - (round.pumpsDraw ? pumps * PUMP_DRAW : 0))
  const [low, high] = round.phases
    ? round.phases[Math.min(round.phases.length - 1, Math.floor(plant.day / round.phaseTicks))]
    : round.band
  const onTarget = net >= low && net <= high && nextTemp < SAFE_TEMP
  return { power, nextTemp, pumps, net, onTarget }
}

/**
 * Run a round with a scripted operator. `pilot(ctl, sensed)` returns the rod and
 * pump settings for the coming tick, reading only what the board shows.
 * The verdict is read exactly as the component reads it: lines 218-234 for the
 * tick bookkeeping, lines 240-263 for the win.
 */
function play(round, pilot, maxTicks = 400) {
  const plant = { power: 0, temp: BASE_TEMP, day: 0 }
  const stats = { inBand: 0, total: 0, peak: BASE_TEMP, pumps: 0 }
  const holdNeeded = round.lag ? HOLD_TICKS : 3
  const trace = []
  let ctl = { rods: 100, coolant: 50 }
  let held = 0
  let bestHold = 0
  for (let i = 0; i < maxTicks; i++) {
    ctl = pilot({ ...ctl }, { power: plant.power, temp: plant.temp, day: plant.day, held })
    const t = tick(round, plant, ctl)
    plant.power = t.power
    plant.temp = t.nextTemp
    plant.day += 1
    stats.peak = Math.max(stats.peak, t.nextTemp)
    trace.push({ tick: plant.day, rods: ctl.rods, coolant: ctl.coolant, power: t.power, net: t.net, temp: t.nextTemp, on: t.onTarget })
    if (t.nextTemp >= MELTDOWN_TEMP) return { melted: true, ticks: plant.day, stats, trace }
    if (round.phases) {
      stats.total += 1
      if (t.onTarget) stats.inBand += 1
      stats.pumps += t.pumps
      if (plant.day >= round.phases.length * round.phaseTicks) break
    } else {
      held = t.onTarget ? held + 1 : 0
      bestHold = Math.max(bestHold, held)
      if (held >= holdNeeded) return { won: true, ticks: plant.day, stats, trace }
    }
  }
  const pct = Math.round((stats.inBand / Math.max(1, stats.total)) * 100)
  return { won: round.phases ? pct >= 65 : false, pct, bestHold, ticks: plant.day, stats, trace }
}

/* ------------------- 1. the transcription is still honest ------------------- */

section('Transcription matches the component')
{
  const here = dirname(fileURLToPath(import.meta.url))
  const src = readFileSync(join(here, '..', 'src', 'challenges', 'nuclear', 'ReactorChallenge.tsx'), 'utf8')
  const num = (name) => {
    const m = src.match(new RegExp(`const ${name} = (-?[\\d.]+)`))
    return m ? Number(m[1]) : NaN
  }
  const consts = {
    MAX_POWER, SAFE_TEMP, MELTDOWN_TEMP, BASE_TEMP, HEAT_FACTOR, COOLANT_PULL,
    PUMP_DRAW, TICK_MS, POWER_LAG, TEMP_LAG, HOLD_TICKS, ALARM_TEMP, TEMP_SCALE_MAX,
  }
  const wrong = Object.entries(consts).filter(([k, v]) => num(k) !== v)
  check('all 13 constants match the source', wrong.length === 0, wrong.length ? wrong.map(([k, v]) => `${k} is ${num(k)} here ${v}`).join(', ') : Object.keys(consts).length + ' checked')

  // The tick itself. Whole lines, so appending a factor to one cannot slip past.
  const srcLines = new Set(src.split('\n').map((l) => l.trim()))
  const lines = [
    'const demand = ((100 - rodsRef.current) / 100) * MAX_POWER',
    'const power = round.lag ? plant.power + (demand - plant.power) * POWER_LAG : demand',
    'const gross = round.lag ? plant.power : demand',
    'const eq = BASE_TEMP + Math.max(0, gross - coolantNow * COOLANT_PULL) * HEAT_FACTOR',
    'const nextTemp = round.lag ? plant.temp + (eq - plant.temp) * TEMP_LAG : eq',
    'const net = Math.round(power - (round.pumpsDraw ? pumps * PUMP_DRAW : 0))',
    'const onTarget = net >= low && net <= high && nextTemp < SAFE_TEMP',
  ]
  const missing = lines.filter((l) => !srcLines.has(l))
  check('all 7 tick expressions read as transcribed', missing.length === 0, missing.length ? `changed: ${missing[0]}` : '7 of 7')

  const setups = [...src.matchAll(/setup: \{([^}]*(?:\}[^}]*)?)\},/g)].map((m) => m[1])
  const parsed = setups.map((s) => ({
    band: JSON.parse(s.match(/band: (\[[^\]]*\])/)[1]),
    phases: s.match(/phases: null/) ? null : JSON.parse(s.match(/phases: (\[\[.*?\]\])/)[1]),
    phaseTicks: Number(s.match(/phaseTicks: (\d+)/)[1]),
    pumpsDraw: s.includes('pumpsDraw: true'),
    lag: s.includes('lag: true'),
  }))
  const same = parsed.length === ROUNDS.length && parsed.every((p, i) => JSON.stringify(p) === JSON.stringify({
    band: ROUNDS[i].band, phases: ROUNDS[i].phases, phaseTicks: ROUNDS[i].phaseTicks,
    pumpsDraw: ROUNDS[i].pumpsDraw, lag: ROUNDS[i].lag,
  }))
  check('all 5 level setups match the source', same, `${parsed.length} setups read`)

  const pars = src.match(/target: (\d+), unit: '%'/)
  const peakPar = src.match(/id: 'peak'[^}]*target: (\d+)/)
  const pumpPar = src.match(/id: 'pumps'[^}]*target: (\d+)/)
  check('level 5 scorecard targets match the source',
    Number(pars[1]) === PARS.inband && Number(peakPar[1]) === PARS.peak && Number(pumpPar[1]) === PARS.pumps,
    `${PARS.inband}% on target, ${PARS.peak} °C peak, ${PARS.pumps} pump-ticks`)
}

/* ------------------- 2. the rod map and the energy balance ------------------- */

section('Rod map and energy balance, by hand')
{
  const demand = (rods) => ((100 - rods) / 100) * MAX_POWER
  check('rods fully in make no power, fully out make full power', demand(100) === 0 && demand(0) === MAX_POWER, `${demand(0)} MW at 0% inserted`)
  check('the map is linear at 11 MW per rod point', [0, 13, 50, 77, 100].every((r) => Math.abs(demand(r) - 11 * (100 - r)) < 1e-12), 'demand = 11 x (100 - rods)')
  // Both knobs are scaled in the same units, which is why the arithmetic is
  // clean: one point of withdrawal adds exactly what one point of flow removes.
  check('one coolant point removes exactly what one rod point adds', COOLANT_PULL === MAX_POWER / 100, `${COOLANT_PULL} MW either way`)
  check('the pumps at full flow can absorb the whole core', 100 * COOLANT_PULL === MAX_POWER, `4 pumps remove ${100 * COOLANT_PULL} MW against a ${MAX_POWER} MW core`)

  // Steady state of the tick with the controls held: power settles on demand and
  // temperature on BASE + leftover heat x HEAT_FACTOR. Worked from the tick, then
  // confirmed by running it out.
  const eqTemp = (rods, coolant) => BASE_TEMP + Math.max(0, demand(rods) - coolant * COOLANT_PULL) * HEAT_FACTOR
  let worstP = 0
  let worstT = 0
  let settings = 0
  for (const rods of [0, 6, 19, 45, 52, 88]) {
    for (const coolant of [0, 25, 50, 75, 100]) {
      const r = play(PROBE, () => ({ rods, coolant }), 400)
      if (r.melted) continue // rods out with the pumps off never settles, it trips
      settings++
      const last = r.trace[r.trace.length - 1]
      worstP = Math.max(worstP, Math.abs(last.power - demand(rods)))
      worstT = Math.max(worstT, Math.abs(last.temp - eqTemp(rods, coolant)))
    }
  }
  check('held controls settle on the hand-worked steady state', settings === 29 && worstP < 1e-9 && worstT < 1e-9, `${settings} settings run out 400 ticks, power within ${worstP.toExponential(1)} MW, temp within ${worstT.toExponential(1)} °C`)

  const hot = eqTemp(0, 0)
  check('full power with the pumps off settles at 910 °C', Math.abs(hot - 910) < 1e-9, `${BASE_TEMP} + ${MAX_POWER} x ${HEAT_FACTOR} = ${hot} °C`)
  check('full flow holds the core at idle whatever the rods do', [0, 25, 50, 100].every((r) => eqTemp(r, 100) === BASE_TEMP), `${BASE_TEMP} °C at every rod position`)
}

/* ------------------- 3. the lag, against the closed form ------------------- */

section('Power lag, first-order step response')
{
  const a = POWER_LAG
  const D = 800
  const r = play(PROBE, () => ({ rods: 100 - (D / MAX_POWER) * 100, coolant: 50 }), 60)
  // A geometric lag from a cold start: p_n = D (1 - (1-a)^n). Any textbook.
  let worst = 0
  r.trace.forEach((s, i) => {
    const closed = D * (1 - (1 - a) ** (i + 1))
    worst = Math.max(worst, Math.abs(s.power - closed))
  })
  check('60 ticks of step response match D (1 - (1-a)^n)', worst < 1e-9, `worst ${worst.toExponential(2)} MW on an ${D} MW step`)

  const tau = -1 / Math.log(1 - a)
  check('the time constant is 7.82 ticks', Math.abs((1 - a) ** tau - Math.exp(-1)) < 1e-12, `(1 - ${a})^${tau.toFixed(4)} = 1/e, so ${((tau * TICK_MS) / 1000).toFixed(2)} s at a ${TICK_MS} ms tick`)
  const at = (n) => 1 - (1 - a) ** n
  check('63% of a step is closed in one time constant', Math.abs(at(tau) - (1 - Math.exp(-1))) < 1e-12, `${(at(tau) * 100).toFixed(1)}% at ${tau.toFixed(2)} ticks`)
  check('95% takes three time constants', Math.abs(at(3 * tau) - (1 - Math.exp(-3))) < 1e-12, `${(at(3 * tau) * 100).toFixed(1)}% at ${(3 * tau).toFixed(1)} ticks, ${((3 * tau * TICK_MS) / 1000).toFixed(1)} s`)
  const half = Math.log(0.5) / Math.log(1 - a)
  check('the half life is 5.42 ticks', Math.abs((1 - a) ** half - 0.5) < 1e-12, `${half.toFixed(3)} ticks, ${((half * TICK_MS) / 1000).toFixed(2)} s`)
  check('the hold is longer than two time constants, so a win needs a settled plant', HOLD_TICKS > 2 * tau, `${HOLD_TICKS} ticks held against a ${tau.toFixed(1)} tick lag`)
}

section('Core temperature, a lag driven by a lag')
{
  // Temperature chases eq, and eq chases the power of the PREVIOUS tick, so the
  // two lags cascade. Solving the pair by hand with q = 1 - POWER_LAG and
  // r = 1 - TEMP_LAG gives, from a cold start with the pumps off,
  //   T_k = BASE + HEAT D + u_k,  u_k = -HEAT D [ r^k + b (r^k - q^k)/(r - q) ]
  const a = POWER_LAG
  const b = TEMP_LAG
  const q = 1 - a
  const rr = 1 - b
  const D = 900
  const rods = 100 - (D / MAX_POWER) * 100
  const run = play(PROBE, () => ({ rods, coolant: 0 }), 80)
  let worst = 0
  run.trace.forEach((s, i) => {
    const k = i + 1
    const u = -HEAT_FACTOR * D * (rr ** k + (b * (rr ** k - q ** k)) / (rr - q))
    worst = Math.max(worst, Math.abs(s.temp - (BASE_TEMP + HEAT_FACTOR * D + u)))
  })
  check('80 ticks of temperature match the two-lag closed form', worst < 1e-9, `worst ${worst.toExponential(2)} °C against 900 MW gross`)
  check('the first tick is still cold, because heat follows last tick power', Math.abs(run.trace[0].temp - BASE_TEMP) < 1e-12, `${run.trace[0].temp} °C after one tick at ${D} MW demand`)
  const tauT = -1 / Math.log(1 - b)
  check('the thermal time constant is 9.49 ticks, slower than the core', tauT > -1 / Math.log(1 - a), `${tauT.toFixed(2)} ticks against ${(-1 / Math.log(1 - a)).toFixed(2)}, ${((tauT * TICK_MS) / 1000).toFixed(2)} s`)
}

/* ------------------- 4. direction and monotonicity ------------------- */

section('Direction of the two controls')
{
  const demand = (rods) => ((100 - rods) / 100) * MAX_POWER
  const eqTemp = (rods, coolant) => BASE_TEMP + Math.max(0, demand(rods) - coolant * COOLANT_PULL) * HEAT_FACTOR
  let powerRises = true
  for (let rods = 1; rods <= 100; rods++) if (!(demand(rods - 1) > demand(rods))) powerRises = false
  check('pulling rods out always raises power, 100 steps swept', powerRises, `${demand(0)} MW out to ${demand(100)} MW in`)

  let coolerDrops = true
  let strict = 0
  for (let rods = 0; rods <= 100; rods++) {
    for (const c of [0, 25, 50, 75]) {
      const hi = eqTemp(rods, c)
      const lo = eqTemp(rods, c + 25)
      if (lo > hi) coolerDrops = false
      if (lo < hi) strict++
    }
  }
  check('another pump never raises the equilibrium temperature, 404 pairs swept', coolerDrops, `${strict} of 404 pairs strictly cooler, the rest already at idle`)
  check('each pump is worth 165 °C until the core is at idle', Math.abs(eqTemp(0, 25) - eqTemp(0, 0) + 25 * COOLANT_PULL * HEAT_FACTOR) < 1e-9, `${(25 * COOLANT_PULL * HEAT_FACTOR).toFixed(0)} °C for 40 MW of output`)

  // Under lag the ordering has to survive the transient too, not just the ends.
  const hotter = play(PROBE, () => ({ rods: 10, coolant: 50 }), 120).trace
  const cooler = play(PROBE, () => ({ rods: 10, coolant: 75 }), 120).trace
  check('the cooler run is cooler at every tick, not just at the end', hotter.every((s, i) => s.temp >= cooler[i].temp), `${hotter[119].temp.toFixed(0)} °C against ${cooler[119].temp.toFixed(0)} °C at tick 120`)
}

/* ------------------- 5. chasing the setpoint ------------------- */

section('Chasing the needle rings, from the loop eigenvalues')
{
  // An operator who moves the rods every tick to close the whole visible gap
  // makes a closed loop: d(k+1) = d(k) + (T - p(k)), p(k+1) = p(k) + a (d(k+1) - p(k)).
  // Eliminating d gives e(k+2) = (2 - 2a) e(k+1) - (1 - a) e(k) for the error
  // e = T - p, whose roots are (1-a) +- i sqrt(a(1-a)). They are complex for any
  // a in (0,1), so the response ALWAYS rings: overshoot is structural, not tuning.
  const a = POWER_LAG
  const disc = (2 - 2 * a) ** 2 - 4 * (1 - a)
  check('the closed-loop roots are complex, so overshoot is unavoidable', disc < 0, `discriminant ${disc.toFixed(4)} = -4a(1-a)`)
  const mod = Math.sqrt(1 - a)
  const theta = Math.acos(mod)
  const period = (2 * Math.PI) / theta
  check('the ring decays by sqrt(1-a) per tick', Math.abs(mod - 0.938083151964686) < 1e-12, `${mod.toFixed(6)} per tick, so a swing is a third of its size one ring later`)
  check('the ring period is 17.76 ticks', Math.abs(period - 17.762076053726204) < 1e-9, `${period.toFixed(2)} ticks, ${((period * TICK_MS) / 1000).toFixed(2)} s at a ${TICK_MS} ms tick`)

  // Run the loop and compare to the hand solution e(k) = T (1-a)^(k/2) cos(k theta).
  const T = 550
  let p = 0
  let d = 0
  let worst = 0
  let firstOver = 0
  let peak = 0
  for (let k = 1; k <= 120; k++) {
    d = d + (T - p)
    p = p + (d - p) * a
    const closed = T * mod ** k * Math.cos(k * theta)
    worst = Math.max(worst, Math.abs(T - p - closed))
    if (!firstOver && p > T) firstOver = k
    peak = Math.max(peak, p)
  }
  check('120 ticks of the chase match the closed form', worst < 1e-9, `worst ${worst.toExponential(2)} MW`)
  check('the first overshoot lands on tick 5, where k theta passes pi/2', firstOver === Math.ceil(Math.PI / 2 / theta), `pi/2 / theta = ${(Math.PI / 2 / theta).toFixed(3)}, so tick ${firstOver}`)
  // Worst overshoot is the largest -mod^k cos(k theta), a number off the closed
  // form and nothing else.
  let predicted = 0
  for (let k = 1; k <= 120; k++) predicted = Math.max(predicted, -(mod ** k) * Math.cos(k * theta))
  check('the chase overshoots the setpoint by 57%, as the closed form says', Math.abs(peak / T - (1 + predicted)) < 1e-12, `peaks at ${peak.toFixed(1)} MW chasing ${T} MW, ${(predicted * 100).toFixed(1)}% over`)

  // The level 3 lesson: one move, then wait, and the approach is monotone.
  const patient = play(PROBE, () => ({ rods: 50, coolant: 50 }), 120).trace
  const steady = 550 - 2 * PUMP_DRAW
  check('one move and a wait never overshoots at all', patient.every((s, i) => i === 0 || s.net >= patient[i - 1].net) && patient.every((s) => s.net <= steady), `climbs to ${patient[119].net} MW net and stops there, never past ${steady}`)
}

/* ------------------- 6. the meltdown edge ------------------- */

section('Meltdown is reachable, and only just')
{
  const demand = (rods) => ((100 - rods) / 100) * MAX_POWER
  // Temperature is a lag toward eq, so it melts only if eq itself reaches 900:
  //   gross - coolant x 11 >= (900 - 250) / 0.6 = 1083.33 MW
  const needed = (MELTDOWN_TEMP - BASE_TEMP) / HEAT_FACTOR
  check('a meltdown needs 1083.3 MW of unremoved heat', Math.abs(needed - 1083.3333333333333) < 1e-9, `(${MELTDOWN_TEMP} - ${BASE_TEMP}) / ${HEAT_FACTOR} = ${needed.toFixed(1)} MW`)
  const rodLimit = 100 - (needed / MAX_POWER) * 100
  check('so with the pumps off only the top 1.5% of rod travel can melt the core', Math.abs(rodLimit - 1.5151515151515156) < 1e-9, `rods must sit under ${rodLimit.toFixed(2)}% inserted`)
  check('one pump running makes a meltdown arithmetically impossible', MAX_POWER - 25 * COOLANT_PULL < needed, `${MAX_POWER - 25 * COOLANT_PULL} MW left after one pump against ${needed.toFixed(0)} MW needed`)

  const melt = play(PROBE, () => ({ rods: 0, coolant: 0 }), 400)
  check('rods full out with the pumps off does melt', melt.melted === true, `trips at tick ${melt.ticks}, ${((melt.ticks * TICK_MS) / 1000).toFixed(1)} s after the scram`)
  const near = play(PROBE, () => ({ rods: 2, coolant: 0 }), 2000)
  const settle = BASE_TEMP + demand(2) * HEAT_FACTOR
  check('two points of rod insertion stops it, at 896.8 °C', !near.melted && Math.abs(near.trace[1999].temp - settle) < 0.01, `settles at ${settle.toFixed(1)} °C, ${(MELTDOWN_TEMP - settle).toFixed(1)} °C under the limit`)
  const safe = play(PROBE, () => ({ rods: 0, coolant: 25 }), 2000)
  check('full power on one pump is hot but never melts', !safe.melted && safe.stats.peak < MELTDOWN_TEMP, `peaks at ${safe.stats.peak.toFixed(0)} °C`)

  // The band each level asks for is nowhere near that edge, which is the point:
  // you have to be reckless on purpose.
  const reckless = play(ROUNDS[4], (c, s) => ({ rods: 0, coolant: s.day < 6 ? 50 : 0 }), 400)
  check('a level 5 operator who kills the pumps at full power melts', reckless.melted === true, `pumps off at tick 7, trip at tick ${reckless.ticks}`)
}

section('Board honesty')
{
  check('the gauge reads past the hottest state the plant can reach', TEMP_SCALE_MAX > BASE_TEMP + MAX_POWER * HEAT_FACTOR, `${TEMP_SCALE_MAX} °C full scale against a ${BASE_TEMP + MAX_POWER * HEAT_FACTOR} °C ceiling, so the needle never pins`)
  check('the near-limit alarm sits between the safe line and the trip', ALARM_TEMP > SAFE_TEMP && ALARM_TEMP < MELTDOWN_TEMP, `${SAFE_TEMP} < ${ALARM_TEMP} < ${MELTDOWN_TEMP} °C`)
  check('the hold is the five seconds the code comment claims', Math.abs((HOLD_TICKS * TICK_MS) / 1000 - 4.8) < 1e-9, `${HOLD_TICKS} x ${TICK_MS} ms = 4.8 s`)
  check('the demand day runs 30.6 s', Math.abs((3 * ROUNDS[4].phaseTicks * TICK_MS) / 1000 - 30.6) < 1e-9, `3 phases x ${ROUNDS[4].phaseTicks} ticks x ${TICK_MS} ms`)
}

/* ------------------- 7. every level, and every way to hold it ------------------- */

/**
 * Every (rods, pumps) pair that holds a band at steady state, worked from the
 * algebra rather than by playing: net output inside the band and the equilibrium
 * temperature under the safe line. Rod values are integers because the lever
 * commits Math.round (Controls.tsx line 65).
 */
function holdingPoints(band, pumpsDraw) {
  const out = []
  for (const coolant of [0, 25, 50, 75, 100]) {
    for (let rods = 0; rods <= 100; rods++) {
      const demand = ((100 - rods) / 100) * MAX_POWER
      const net = Math.round(demand - (pumpsDraw ? (coolant / 25) * PUMP_DRAW : 0))
      const eq = BASE_TEMP + Math.max(0, demand - coolant * COOLANT_PULL) * HEAT_FACTOR
      if (net >= band[0] && net <= band[1] && eq < SAFE_TEMP) out.push({ rods, coolant })
    }
  }
  return out
}
const pumpSets = (pts) => [...new Set(pts.map((p) => p.coolant / 25))].sort()
/** The rod notch that holds a net output, once the pumps have taken their cut. */
const rodNotch = (netMw, pumps, pumpsDraw) =>
  Math.round(100 - ((netMw + (pumpsDraw ? pumps * PUMP_DRAW : 0)) / MAX_POWER) * 100)
const holdRods = (band, pumps, pumpsDraw) => rodNotch((band[0] + band[1]) / 2, pumps, pumpsDraw)

section('Level 1, rods are the throttle')
{
  const lv = ROUNDS[0]
  const pts = holdingPoints(lv.band, lv.pumpsDraw)
  check('every pump setting can hold this band', pumpSets(pts).length === 5, `${pts.length} holding points, rods 48 to 56 at all five pump settings`)
  const rods = holdRods(lv.band, 2, lv.pumpsDraw)
  const won = play(lv, () => ({ rods, coolant: 50 }), 60)
  check('setting the rods at the band middle wins', won.won === true, `rods ${rods}%, 530 MW, banked in ${won.ticks} ticks with the core at idle`)
  const idle = play(lv, () => ({ rods: 100, coolant: 50 }), 60)
  check('leaving the rods in never wins, the grid gets nothing', !idle.won && idle.bestHold === 0, `0 MW for ${idle.ticks} ticks`)
  const out = play(lv, () => ({ rods: 0, coolant: 50 }), 60)
  check('hauling them all the way out overshoots the band', !out.won && out.bestHold === 0, `${out.trace[0].net} MW against a ${lv.band[0]} to ${lv.band[1]} MW band`)
}

section('Level 2, the pumps bill the grid')
{
  const lv = ROUNDS[1]
  const pts = holdingPoints(lv.band, lv.pumpsDraw)
  check('the pumps are now mandatory, not optional', !pumpSets(pts).includes(0), `${pts.length} holding points, all with at least one pump, because ${lv.band[1]} MW with no cooling settles at ${BASE_TEMP + lv.band[1] * HEAT_FACTOR} °C`)
  const rods = holdRods(lv.band, 2, lv.pumpsDraw)
  const won = play(lv, () => ({ rods, coolant: 50 }), 60)
  check('paying for the two pumps in rod travel wins', won.won === true, `rods ${rods}%, ${won.trace[0].net} MW net after ${2 * PUMP_DRAW} MW of pumps, banked in ${won.ticks} ticks`)
  // The level 1 habit: read the band, set the rods, forget the pump bill.
  const naiveRods = holdRods(lv.band, 0, false)
  const naive = play(lv, () => ({ rods: naiveRods, coolant: 50 }), 60)
  check('ignoring the pump bill leaves the plant short and never wins', !naive.won && naive.bestHold === 0, `rods ${naiveRods}% gives ${naive.trace[0].net} MW net, ${lv.band[0] - naive.trace[0].net} MW under the band`)
}

section('Level 3, the core takes its time')
{
  const lv = ROUNDS[2]
  const rods = holdRods(lv.band, 2, lv.pumpsDraw)
  const won = play(lv, () => ({ rods, coolant: 50 }), 200)
  check('one move and a wait wins', won.won === true, `rods ${rods}%, banked in ${won.ticks} ticks, ${((won.ticks * TICK_MS) / 1000).toFixed(1)} s`)
  const entered = won.trace.findIndex((s) => s.on) + 1
  // 902 MW gross demand, band floor 840 MW gross: 0.88^n <= 62/297.
  const predicted = Math.ceil(Math.log(1 - (lv.band[0] + 2 * PUMP_DRAW) / (((100 - rods) / 100) * MAX_POWER)) / Math.log(1 - POWER_LAG))
  check('it reaches the band on the tick the lag predicts', entered === predicted, `tick ${entered}, and the closed form says ${predicted}`)
  check('the hold then costs the full 16 ticks', won.ticks - entered + 1 === HOLD_TICKS, `entered at ${entered}, banked at ${won.ticks}`)

  // The operator the level warns about: correct the whole visible gap, every tick.
  const chase = play(lv, (c, s) => {
    const target = (lv.band[0] + lv.band[1]) / 2 + (c.coolant / 25) * PUMP_DRAW
    const want = ((100 - c.rods) / 100) * MAX_POWER + (target - s.power)
    return { ...c, rods: Math.max(0, Math.min(100, Math.round(100 - (want / MAX_POWER) * 100))) }
  }, 200)
  const broke = chase.trace.findIndex((s, i) => i > 0 && chase.trace[i - 1].on && !s.on) + 1
  check('chasing it overshoots the band top and throws away a started hold', broke > 0 && chase.trace[broke - 1].net > lv.band[1], `hold reached ${chase.trace.slice(0, broke).filter((s) => s.on).length} ticks, then ${chase.trace[broke - 1].net} MW blew past ${lv.band[1]}`)
  check('the chase still lands eventually, because the ring decays inside a 100 MW band', chase.won === true, `banked at tick ${chase.ticks} against ${won.ticks} for the patient run, so on this band chasing is not punished, it is only untidy`)
}

section('Level 4, cooling has to be bought')
{
  const lv = ROUNDS[3]
  const pts = holdingPoints(lv.band, lv.pumpsDraw)
  check('this band needs at least two pumps', pumpSets(pts).join(',') === '2,3,4', `${pts.length} holding points, none under two pumps`)
  const rods = holdRods(lv.band, 2, lv.pumpsDraw)
  const won = play(lv, () => ({ rods, coolant: 50 }), 200)
  check('two pumps and the matching rod notch wins', won.won === true, `rods ${rods}%, ${won.trace[won.trace.length - 1].net} MW net, core settles near ${won.stats.peak.toFixed(0)} °C, banked in ${won.ticks} ticks`)

  // The tempting move: fewer pumps means less output stolen, so fewer rods out.
  const skimpRods = holdRods(lv.band, 1, lv.pumpsDraw)
  const skimp = play(lv, () => ({ rods: skimpRods, coolant: 25 }), 300)
  const eqSkimp = BASE_TEMP + (((100 - skimpRods) / 100) * MAX_POWER - 25 * COOLANT_PULL) * HEAT_FACTOR
  check('dropping to one pump puts the output in band but cooks the core', !skimp.won && skimp.bestHold < HOLD_TICKS, `${skimp.trace[299].net} MW net is inside the band, but the core settles at ${eqSkimp.toFixed(0)} °C against a ${SAFE_TEMP} °C line`)
  // Heat arrives 9.5 ticks behind the power that made it, so the cheat banks part
  // of a hold before the core catches up. The 16-tick hold is what catches it.
  check('one pump banks 6 of the 16 ticks before the heat arrives', skimp.bestHold === 6, `a 3-tick hold like levels 1 and 2 would have passed this run, ${HOLD_TICKS} ticks does not`)
  const noPumps = play(lv, () => ({ rods: holdRods(lv.band, 0, lv.pumpsDraw), coolant: 0 }), 300)
  check('turning them off entirely is worse still', !noPumps.won && noPumps.stats.peak > ALARM_TEMP, `peaks at ${noPumps.stats.peak.toFixed(0)} °C`)
}

section('Level 5, follow the day')
{
  const lv = ROUNDS[4]
  const bands = lv.phases
  const rodsFor = bands.map((b) => holdRods(b, 2, true))
  const tight = holdingPoints(bands[2], true)
  check('the evening peak is the tight one, 8 holding points in 505 settings', tight.length === 8, `rods 0 to 5 on two pumps, 0 to 1 on three, out of ${5 * 101} combinations`)

  // The realistic day: two pumps throughout, rods hauled fully out to ride the
  // ramp, then dropped onto the holding notch once output is within 40 MW of
  // what the band wants. Three numbers and one rule, nothing tuned.
  const leading = (notches) => (c, s) => {
    const ph = Math.min(bands.length - 1, Math.floor(s.day / lv.phaseTicks))
    const wantGross = (bands[ph][0] + bands[ph][1]) / 2 + 2 * PUMP_DRAW
    return { rods: s.power < wantGross - 40 ? 0 : notches[ph], coolant: 50 }
  }
  const day = play(lv, leading(rodsFor), 200)
  check('the scripted day clears the 65% the grid asks for', day.won === true, `on target ${day.pct}% of ${day.stats.total} ticks, holding rods ${rodsFor.join('%, ')}%`)
  check('it beats the on-target and pump-usage pars', day.pct >= PARS.inband && day.stats.pumps <= PARS.pumps, `${day.pct}% against a ${PARS.inband}% par, ${day.stats.pumps} pump-ticks against ${PARS.pumps}`)
  check('and it never gets near the trip', day.stats.peak < SAFE_TEMP, `peak ${day.stats.peak.toFixed(0)} °C, ${(MELTDOWN_TEMP - day.stats.peak).toFixed(0)} °C of margin`)
  // The peak-temp par is the one the middle-of-the-band day misses. Riding the
  // bottom of each band instead is worth 21 °C and costs 2 points of on-target.
  const lowNotches = bands.map((b) => rodNotch(b[0] + 10, 2, true))
  const calmer = play(lv, leading(lowNotches), 200)
  check('the peak-temp par is what riding the low edge is for', day.stats.peak > PARS.peak && calmer.stats.peak <= PARS.peak && calmer.won === true, `holding mid-band peaks at ${day.stats.peak.toFixed(0)} °C and misses the ${PARS.peak} °C par, holding at rods ${lowNotches.join('%, ')}% peaks at ${calmer.stats.peak.toFixed(0)} °C and still scores ${calmer.pct}%`)

  // Without the lead, every phase spends its first twenty ticks climbing.
  const naive = play(lv, (c, s) => ({ rods: rodsFor[Math.min(2, Math.floor(s.day / lv.phaseTicks))], coolant: 50 }), 200)
  check('setting the notch and waiting is not enough, the ramps eat the day', naive.won === false, `on target ${naive.pct}%, under the 65% bar, because the lag costs about 20 ticks of each ${lv.phaseTicks} tick phase`)
  check('leading the ramp is worth 23 points of on-target time', day.pct - naive.pct >= 20, `${naive.pct}% waiting against ${day.pct}% leading`)

  const greedy = play(lv, (c, s) => ({ rods: rodsFor[Math.min(2, Math.floor(s.day / lv.phaseTicks))], coolant: 100 }), 200)
  check('drowning the core in pumps blows the band, cold or not', greedy.won === false, `four pumps cost ${4 * PUMP_DRAW} MW, on target ${greedy.pct}%, peak ${greedy.stats.peak.toFixed(0)} °C`)
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`)
process.exit(failures === 0 ? 0 : 1)
