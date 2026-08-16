/**
 * Offline guard for Bridge Builder (src/challenges/civil/BridgeChallenge.tsx).
 *
 *   node scripts/verify-truss.mjs
 *
 * Node strips the types off truss.ts on import, so this runs with no build step
 * and no dependency. Two jobs:
 *
 * 1. Check the solver against numbers from outside itself. Every force claimed
 *    below is derived with a pencil by the method of joints, the method of
 *    sections, or the force method, and written here as an exact fraction of the
 *    truck weight P. Self-consistency would prove nothing, so nothing here is
 *    compared against a value the solver produced earlier.
 *
 * 2. Check that every level is still winnable the way it was meant to be, and
 *    still refuses the naive answer. Level 1 hangs on exactly one missing
 *    diagonal; level 2 on a budget that only one depth fits; levels 3 to 5 on
 *    steel bought only where it is needed.
 *
 * The geometry rules, the material table and the level setups below MIRROR
 * BridgeChallenge.tsx, which cannot be imported (it is a component). The
 * "Mirrored constants" section re-reads that file and fails if any of them has
 * drifted, so the mirror cannot rot silently.
 */

import { readFileSync } from 'node:fs'
import { memberKey, solveTruss } from '../src/challenges/civil/truss.ts'

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

/* ------------------- the sheet rules, mirrored from the game ------------------- */

const GRID = 40
const ROAD_Y = 240
const LEFT_X = 160
const RIGHT_X = 640
const MIN_X = 80
const MAX_X = 720
const MIN_Y = 80
const MAX_Y = 320
const MAX_LEN = 130
const PX_PER_M = 20
const MATERIALS = {
  wood: { cost: 5, tension: 22, compression: 14 },
  steel: { cost: 12, tension: 50, compression: 38 },
}
const LEVELS = [
  { n: 1, load: 6, budget: null, steel: false, maxDeflection: null },
  { n: 2, load: 10, budget: 10000, steel: false, maxDeflection: null },
  { n: 3, load: 16, budget: 14000, steel: true, maxDeflection: null },
  { n: 4, load: 14, budget: 13800, steel: true, maxDeflection: null },
  { n: 5, load: 20, budget: 21000, steel: true, maxDeflection: 15 },
]
const PARS = { cost: 16000, sagcm: 10, spare: 20 }

/* ------------------- span plumbing ------------------- */

const jid = (x, y) => `j${x}_${y}`
const isAnchor = (j) => j.y === ROAD_Y && (j.x === LEFT_X || j.x === RIGHT_X)

/**
 * Build a span from grid points and the beams between them, refusing anything
 * the sheet would refuse. A point is anchored when its third slot says so, or,
 * when that slot is left off, when it sits on a bank.
 */
function span(points, links, { legal = true } = {}) {
  const joints = points.map(([x, y, fixed]) => ({
    id: jid(x, y),
    x,
    y,
    ...((fixed === undefined ? y === ROAD_Y && (x === LEFT_X || x === RIGHT_X) : fixed) ? { fixed: true } : {}),
  }))
  const byId = new Map(joints.map((j) => [j.id, j]))
  const members = [...new Set(links.map(([a, b]) => memberKey(joints[a].id, joints[b].id)))]
  if (legal) {
    for (const j of joints) {
      if (j.x % GRID || j.y % GRID) throw new Error(`joint ${j.id} is off the ${GRID} px grid`)
      if (j.x < MIN_X || j.x > MAX_X || j.y < MIN_Y || j.y > MAX_Y) throw new Error(`joint ${j.id} is off the sheet`)
    }
    for (const k of members) {
      const L = length(byId, k)
      if (L > MAX_LEN + 1e-9) throw new Error(`beam ${k} is ${L.toFixed(1)} px, past the ${MAX_LEN} px reach`)
    }
  }
  return { joints, byId, members }
}
function length(byId, key) {
  const [a, b] = key.split('|')
  return Math.hypot(byId.get(b).x - byId.get(a).x, byId.get(b).y - byId.get(a).y)
}
/** Unit vector from a towards b. */
function dir(byId, key) {
  const [a, b] = key.split('|')
  const L = length(byId, key)
  return [(byId.get(b).x - byId.get(a).x) / L, (byId.get(b).y - byId.get(a).y) / L]
}
const wood = (sp) => Object.fromEntries(sp.members.map((k) => [k, 'wood']))
const capsFrom = (mats) => (k) => MATERIALS[mats[k] ?? 'wood']
const HUGE = () => ({ tension: 1e9, compression: 1e9 })

/**
 * Mirrors runTest in BridgeChallenge.tsx lines 491-527: solve once per road
 * joint as the truck crosses, keep the worst utilization each member ever sees,
 * keep the largest joint movement anywhere, and turn that movement into cm.
 */
function crossing(sp, mats, load) {
  const capsFor = capsFrom(mats)
  const utilization = {}
  let failedAt = null
  let peakMove = 0
  let peakJoint = null
  for (const j of roadPath(sp)) {
    if (isAnchor(j)) continue
    const r = solveTruss(sp.joints, sp.members, j.id, load, capsFor)
    for (const [k, u] of Object.entries(r.utilization)) {
      if (u > (utilization[k] ?? 0)) utilization[k] = u
    }
    for (const [id, [dx, dy]] of Object.entries(r.deflection)) {
      const move = Math.hypot(dx, dy)
      if (move > peakMove) {
        peakMove = move
        peakJoint = id
      }
    }
    if (r.status !== 'ok' && failedAt === null) failedAt = j.id
  }
  return {
    failedAt,
    peakJoint,
    peakSag: Math.round((peakMove / PX_PER_M) * 100),
    spare: Math.round((1 - Math.max(0, ...Object.values(utilization))) * 100),
    utilization,
  }
}
/** Mirrors the roadPath memo, BridgeChallenge.tsx lines 269-292. */
function roadPath(sp) {
  const adj = new Map()
  for (const key of sp.members) {
    const [a, b] = key.split('|')
    if (sp.byId.get(a).y !== ROAD_Y || sp.byId.get(b).y !== ROAD_Y) continue
    adj.set(a, [...(adj.get(a) ?? []), b])
    adj.set(b, [...(adj.get(b) ?? []), a])
  }
  const start = jid(LEFT_X, ROAD_Y)
  const seen = new Set([start])
  const queue = [start]
  while (queue.length) {
    for (const next of adj.get(queue.pop()) ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  if (!seen.has(jid(RIGHT_X, ROAD_Y))) return []
  return sp.joints.filter((j) => seen.has(j.id) && j.y === ROAD_Y).sort((a, b) => a.x - b.x)
}
/** Mirrors the cost memo, BridgeChallenge.tsx lines 256-258. */
const costOf = (sp, mats) =>
  Math.round(sp.members.reduce((sum, k) => sum + length(sp.byId, k) * MATERIALS[mats[k] ?? 'wood'].cost, 0))

/** The rule a student follows: steel on the beams wood cannot carry, wood everywhere else. */
function steelWhereNeeded(sp, load) {
  const mats = wood(sp)
  for (let pass = 0; pass < 12; pass++) {
    const r = crossing(sp, mats, load)
    if (r.failedAt === null) return { mats, r }
    let changed = false
    for (const k of sp.members) {
      if (mats[k] === 'wood' && (r.utilization[k] ?? 0) >= 1) {
        mats[k] = 'steel'
        changed = true
      }
    }
    if (!changed) return { mats, r }
  }
  return { mats, r: crossing(sp, mats, load) }
}

/* ------------------- span shapes a student can actually draw ------------------- */

/** Warren: 80 px panels, top joints at mid-panel, depth d px. */
function warren(d) {
  const points = []
  const bottom = []
  const top = []
  for (let x = LEFT_X; x <= RIGHT_X; x += 80) bottom.push(points.push([x, ROAD_Y]) - 1)
  for (let x = LEFT_X + 40; x < RIGHT_X; x += 80) top.push(points.push([x, ROAD_Y - d]) - 1)
  const links = []
  for (let i = 0; i < bottom.length - 1; i++) links.push([bottom[i], bottom[i + 1]])
  for (let i = 0; i < top.length - 1; i++) links.push([top[i], top[i + 1]])
  for (let i = 0; i < top.length; i++) links.push([bottom[i], top[i]], [top[i], bottom[i + 1]])
  return span(points, links)
}
/** Pratt, Howe or X bracing with inclined end posts: top chord inset one panel. */
function chorded(d, kind) {
  const points = []
  const bottom = []
  const top = []
  for (let x = LEFT_X; x <= RIGHT_X; x += 80) bottom.push(points.push([x, ROAD_Y]) - 1)
  for (let x = LEFT_X + 80; x <= RIGHT_X - 80; x += 80) top.push(points.push([x, ROAD_Y - d]) - 1)
  const links = []
  for (let i = 0; i < bottom.length - 1; i++) links.push([bottom[i], bottom[i + 1]])
  for (let i = 0; i < top.length - 1; i++) links.push([top[i], top[i + 1]])
  links.push([bottom[0], top[0]], [top.at(-1), bottom.at(-1)])
  for (let i = 0; i < top.length; i++) links.push([bottom[i + 1], top[i]])
  const mid = (LEFT_X + RIGHT_X) / 2
  for (let i = 0; i < top.length - 1; i++) {
    const left = points[top[i]][0] < mid
    if (kind === 'x') links.push([bottom[i + 1], top[i + 1]], [top[i], bottom[i + 2]])
    else if (kind === 'pratt') links.push(left ? [top[i], bottom[i + 2]] : [bottom[i + 1], top[i + 1]])
    else links.push(left ? [bottom[i + 1], top[i + 1]] : [top[i], bottom[i + 2]])
  }
  return span(points, links)
}
/** Pratt or Howe with the top chord carried right out over both banks. */
function fullTop(d, kind) {
  const points = []
  const bottom = []
  const top = []
  for (let x = LEFT_X; x <= RIGHT_X; x += 80) {
    bottom.push(points.push([x, ROAD_Y]) - 1)
    top.push(points.push([x, ROAD_Y - d]) - 1)
  }
  const links = []
  for (let i = 0; i < bottom.length - 1; i++) links.push([bottom[i], bottom[i + 1]], [top[i], top[i + 1]])
  for (let i = 0; i < bottom.length; i++) links.push([bottom[i], top[i]])
  const mid = bottom.length / 2
  for (let i = 0; i < bottom.length - 1; i++) {
    if (kind === 'pratt') links.push(i < mid - 0.5 ? [top[i], bottom[i + 1]] : [bottom[i], top[i + 1]])
    else links.push(i < mid - 0.5 ? [bottom[i], top[i + 1]] : [top[i], bottom[i + 1]])
  }
  return span(points, links)
}

/** Every legal shape this script knows how to draw, for the sweeps below. */
const FAMILY = [
  ['warren 2 m deep', warren(40)],
  ['warren 4 m deep', warren(80)],
  ['warren 6 m deep', warren(120)],
  ['pratt 2 m deep', chorded(40, 'pratt')],
  ['pratt 4 m deep', chorded(80, 'pratt')],
  ['howe 2 m deep', chorded(40, 'howe')],
  ['howe 4 m deep', chorded(80, 'howe')],
  ['X-braced 2 m deep', chorded(40, 'x')],
  ['X-braced 4 m deep', chorded(80, 'x')],
  ['pratt 2 m, chord over the banks', fullTop(40, 'pratt')],
  ['pratt 4 m, chord over the banks', fullTop(80, 'pratt')],
  ['howe 2 m, chord over the banks', fullTop(40, 'howe')],
  ['howe 4 m, chord over the banks', fullTop(80, 'howe')],
]

/* ------------------- 1. the solver, against textbook statics ------------------- */

/**
 * A four panel Warren truss, half-panel 60 px by depth 80 px, so every diagonal
 * is a 3-4-5 triangle 100 px long. The left bank is a pin. The right bank is a
 * roller, built the only way this solver allows one: a short vertical bar down
 * to ground, which restrains the joint vertically and not at all horizontally,
 * and whose own axial force IS the vertical reaction. 15 members and 8 free
 * joint pairs make it statically determinate, so the method of joints closes
 * without any reference to stiffness.
 */
const TEXT = (() => {
  const points = [
    [160, 240, true], [280, 240], [400, 240], [520, 240], [640, 240, false],
    [220, 160], [340, 160], [460, 160], [580, 160],
    [640, 280, true],
  ]
  const A = [0, 1, 2, 3, 4]
  const T = [5, 6, 7, 8]
  const links = []
  for (let i = 0; i < 4; i++) links.push([A[i], A[i + 1]])
  for (let i = 0; i < 3; i++) links.push([T[i], T[i + 1]])
  for (let i = 0; i < 4; i++) links.push([A[i], T[i]], [T[i], A[i + 1]])
  links.push([A[4], 9])
  const sp = span(points, links, { legal: false })
  const id = (i) => sp.joints[i].id
  return { sp, A: A.map(id), T: T.map(id), roller: id(9) }
})()

/**
 * Hand answers for TEXT with the truck at mid-span, as multiples of P.
 * Joint by joint from the left pin (reaction P/2 up, diagonals at 0.6/0.8):
 *   A0:  0.8 F(A0-T0) + P/2 = 0            -> A0-T0 = -5P/8, A0-A1 = +3P/8
 *   T0:  the two diagonals cancel vertically -> T0-A1 = +5P/8, T0-T1 = -3P/4
 *   A1:  diagonals cancel again             -> A1-T1 = -5P/8, A1-A2 = +9P/8
 *   T1:                                     -> T1-A2 = +5P/8, T1-T2 = -3P/2
 * and the right half mirrors it. The roller bar carries the right reaction, P/2,
 * squashed rather than stretched because the span leans down onto it.
 */
const HAND = new Map([
  [memberKey(TEXT.A[0], TEXT.A[1]), 3 / 8],
  [memberKey(TEXT.A[1], TEXT.A[2]), 9 / 8],
  [memberKey(TEXT.A[2], TEXT.A[3]), 9 / 8],
  [memberKey(TEXT.A[3], TEXT.A[4]), 3 / 8],
  [memberKey(TEXT.T[0], TEXT.T[1]), -3 / 4],
  [memberKey(TEXT.T[1], TEXT.T[2]), -3 / 2],
  [memberKey(TEXT.T[2], TEXT.T[3]), -3 / 4],
  [memberKey(TEXT.A[0], TEXT.T[0]), -5 / 8],
  [memberKey(TEXT.T[0], TEXT.A[1]), 5 / 8],
  [memberKey(TEXT.A[1], TEXT.T[1]), -5 / 8],
  [memberKey(TEXT.T[1], TEXT.A[2]), 5 / 8],
  [memberKey(TEXT.A[2], TEXT.T[2]), 5 / 8],
  [memberKey(TEXT.T[2], TEXT.A[3]), -5 / 8],
  [memberKey(TEXT.A[3], TEXT.T[3]), 5 / 8],
  [memberKey(TEXT.T[3], TEXT.A[4]), -5 / 8],
  [memberKey(TEXT.A[4], TEXT.roller), -1 / 2],
])

const P = 16

section('The solver against textbook statics')
{
  const out = solveTruss(TEXT.sp.joints, TEXT.sp.members, TEXT.A[2], P, HUGE)
  let worst = 0
  let worstKey = null
  for (const [key, want] of HAND) {
    const err = Math.abs(out.forces[key] / P - want)
    if (err > worst) {
      worst = err
      worstKey = key
    }
  }
  // truss.ts line 107 adds EA/1e7 to every diagonal to keep mechanisms finite.
  // That tiny spring to ground is the whole of the error below.
  check(
    'all 16 member forces match the method of joints',
    worst < 2e-3,
    `worst gap ${worst.toExponential(2)} P on ${worstKey}, from the EA/1e7 grounding spring`,
  )
  const show = [
    ['bottom chord at mid-span', memberKey(TEXT.A[1], TEXT.A[2])],
    ['top chord at mid-span', memberKey(TEXT.T[1], TEXT.T[2])],
    ['end diagonal', memberKey(TEXT.A[0], TEXT.T[0])],
  ]
  for (const [what, key] of show) {
    console.log(`        ${what}: solver ${(out.forces[key] / P).toFixed(5)} P, hand ${HAND.get(key).toFixed(5)} P`)
  }

  // Joint equilibrium: the beams pulling on a free joint plus the truck must cancel.
  let residual = 0
  const sum = {}
  for (const j of TEXT.sp.joints) if (!j.fixed) sum[j.id] = [0, 0]
  for (const key of TEXT.sp.members) {
    const [a, b] = key.split('|')
    const [c, s] = dir(TEXT.sp.byId, key)
    const F = out.forces[key]
    if (sum[a]) {
      sum[a][0] += F * c
      sum[a][1] += F * s
    }
    if (sum[b]) {
      sum[b][0] -= F * c
      sum[b][1] -= F * s
    }
  }
  sum[TEXT.A[2]][1] += P
  for (const [, r] of Object.entries(sum)) residual = Math.max(residual, Math.abs(r[0]), Math.abs(r[1]))
  check(
    'every free joint balances in x and in y',
    residual / P < 2e-3,
    `worst out-of-balance ${(residual / P).toExponential(2)} P across ${Object.keys(sum).length} joints`,
  )

  // Reactions: the beams meeting a bank, read backwards.
  const reaction = [0, 0]
  for (const key of TEXT.sp.members) {
    const [a, b] = key.split('|')
    const [c, s] = dir(TEXT.sp.byId, key)
    const F = out.forces[key]
    if (TEXT.sp.byId.get(a).fixed) {
      reaction[0] -= F * c
      reaction[1] -= F * s
    }
    if (TEXT.sp.byId.get(b).fixed) {
      reaction[0] += F * c
      reaction[1] += F * s
    }
  }
  check(
    'the two banks carry the whole truck and nothing sideways',
    Math.abs(reaction[1] + P) / P < 2e-3 && Math.abs(reaction[0]) / P < 2e-3,
    `banks push up ${(-reaction[1]).toFixed(4)} against a ${P} t truck, sideways ${reaction[0].toExponential(2)}`,
  )

  const pairs = [
    [memberKey(TEXT.A[0], TEXT.A[1]), memberKey(TEXT.A[3], TEXT.A[4])],
    [memberKey(TEXT.A[1], TEXT.A[2]), memberKey(TEXT.A[2], TEXT.A[3])],
    [memberKey(TEXT.T[0], TEXT.T[1]), memberKey(TEXT.T[2], TEXT.T[3])],
    [memberKey(TEXT.A[0], TEXT.T[0]), memberKey(TEXT.T[3], TEXT.A[4])],
    [memberKey(TEXT.T[0], TEXT.A[1]), memberKey(TEXT.A[3], TEXT.T[3])],
  ]
  const skew = Math.max(...pairs.map(([l, r]) => Math.abs(out.forces[l] - out.forces[r]) / P))
  check(
    'a symmetric truss under a symmetric load answers symmetrically',
    skew < 2e-3,
    `worst left-to-right difference ${skew.toExponential(2)} P over 5 mirrored pairs`,
  )

  const bottom = [0, 1, 2, 3].map((i) => out.forces[memberKey(TEXT.A[i], TEXT.A[i + 1])])
  const top = [0, 1, 2].map((i) => out.forces[memberKey(TEXT.T[i], TEXT.T[i + 1])])
  check(
    'the deck chord pulls and the top chord pushes',
    bottom.every((f) => f > 0) && top.every((f) => f < 0),
    `deck +${Math.min(...bottom).toFixed(2)} to +${Math.max(...bottom).toFixed(2)} t, top ${Math.min(...top).toFixed(2)} to ${Math.max(...top).toFixed(2)} t`,
  )
}

/* ------------------- 2. the moving load ------------------- */

section('The moving load')
{
  // The reaction influence line of a simply supported span is a straight line:
  // a truck a fraction a of the way across throws a of its weight on the far bank.
  let worst = 0
  for (let i = 1; i <= 3; i++) {
    const out = solveTruss(TEXT.sp.joints, TEXT.sp.members, TEXT.A[i], P, HUGE)
    const got = out.forces[memberKey(TEXT.A[4], TEXT.roller)] / P
    worst = Math.max(worst, Math.abs(got + i / 4))
  }
  check(
    'the far reaction rises in a straight line as the truck crosses',
    worst < 2e-3,
    `quarter points read -0.25, -0.50, -0.75 P, worst gap ${worst.toExponential(2)} P`,
  )

  // Shear, not moment, sizes an end diagonal, so it peaks with the truck near the
  // far end and not at mid-span. Truck on the first panel point: R = 3P/4, and
  // 0.8 F + 3P/4 = 0 gives -15P/16, one and a half times the mid-span answer.
  const near = solveTruss(TEXT.sp.joints, TEXT.sp.members, TEXT.A[1], P, HUGE)
  const mid = solveTruss(TEXT.sp.joints, TEXT.sp.members, TEXT.A[2], P, HUGE)
  const key = memberKey(TEXT.A[0], TEXT.T[0])
  check(
    'the end diagonal peaks off mid-span, at -15/16 P',
    Math.abs(near.forces[key] / P + 15 / 16) < 2e-3,
    `${(near.forces[key] / P).toFixed(5)} P with the truck at the quarter point against ${(mid.forces[key] / P).toFixed(5)} P at mid-span`,
  )

  // The game keeps the worst force each member ever sees. Prove that keeping
  // only one truck position would let a member through under-sized.
  const sp = warren(80)
  const { mats } = steelWhereNeeded(sp, LEVELS[3].load)
  const capsFor = capsFrom(mats)
  const worstOver = {}
  for (const j of roadPath(sp)) {
    if (isAnchor(j)) continue
    const r = solveTruss(sp.joints, sp.members, j.id, LEVELS[3].load, capsFor)
    for (const k of sp.members) {
      if (Math.abs(r.forces[k]) > Math.abs(worstOver[k] ?? 0)) worstOver[k] = r.forces[k]
    }
  }
  const center = solveTruss(sp.joints, sp.members, jid(400, ROAD_Y), LEVELS[3].load, capsFor)
  const everyPositionCovered = sp.members.every((k) => Math.abs(worstOver[k]) >= Math.abs(center.forces[k]) - 1e-9)
  check(
    'the crossing keeps the worst of every truck position',
    everyPositionCovered,
    `${sp.members.length} members, none worse at mid-span than the kept maximum`,
  )
  let gap = 0
  let gapKey = null
  for (const k of sp.members) {
    const ratio = Math.abs(worstOver[k]) - Math.abs(center.forces[k])
    if (ratio > gap) {
      gap = ratio
      gapKey = k
    }
  }
  check(
    'and parking the truck at mid-span would badly under-read one of them',
    gap > 1,
    `${gapKey} carries ${Math.abs(worstOver[gapKey]).toFixed(2)} t somewhere in the crossing and ${Math.abs(center.forces[gapKey]).toFixed(2)} t at mid-span`,
  )
}

/* ------------------- 3. linear elasticity ------------------- */

section('Linear elasticity')
{
  const sp = warren(80)
  const one = solveTruss(sp.joints, sp.members, jid(400, ROAD_Y), 7, HUGE)
  const two = solveTruss(sp.joints, sp.members, jid(400, ROAD_Y), 14, HUGE)
  const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b))
  const forceErr = Math.max(...sp.members.map((k) => rel(two.forces[k], 2 * one.forces[k])))
  const moveErr = Math.max(
    ...Object.keys(one.deflection).flatMap((id) => [0, 1].map((c) => rel(two.deflection[id][c], 2 * one.deflection[id][c]))),
  )
  check('doubling the truck doubles every member force', forceErr < 1e-9, `worst relative error ${forceErr.toExponential(2)}`)
  check('doubling the truck doubles every deflection', moveErr < 1e-9, `worst relative error ${moveErr.toExponential(2)}`)

  const odd = solveTruss(sp.joints, sp.members, jid(400, ROAD_Y), 7 * 3.7, HUGE)
  const oddErr = Math.max(...sp.members.map((k) => rel(odd.forces[k], 3.7 * one.forces[k])))
  check(
    'and any other factor scales the same way, so the solver is linear',
    oddErr < 1e-9,
    `3.7x the load, worst relative error ${oddErr.toExponential(2)}`,
  )
}

/* ------------------- 4. mechanisms ------------------- */

section('Mechanisms')
{
  // Two square panels, deck below, verticals and a top chord, no diagonals.
  const points = [
    [200, 240], [280, 240], [360, 240],
    [200, 160], [280, 160], [360, 160],
  ]
  const squares = [[0, 1], [1, 2], [3, 4], [4, 5], [0, 3], [1, 4], [2, 5]]
  const sp = span([[200, 240, true], [280, 240], [360, 240, true], ...points.slice(3)], squares, { legal: false })
  const bare = solveTruss(sp.joints, sp.members, jid(280, ROAD_Y), 10, HUGE)
  const move = Math.max(...Object.values(bare.deflection).map(([dx, dy]) => Math.hypot(dx, dy)))
  check(
    'square panels with no diagonal fold instead of holding',
    bare.status === 'unstable',
    `status "${bare.status}", the deck joint travels ${move.toFixed(0)} px against a 60 px cutoff`,
  )
  const braced = span(
    [[200, 240, true], [280, 240], [360, 240, true], ...points.slice(3)],
    [...squares, [0, 4], [4, 2]],
    { legal: false },
  )
  const fixed = solveTruss(braced.joints, braced.members, jid(280, ROAD_Y), 10, HUGE)
  const fixedMove = Math.max(...Object.values(fixed.deflection).map(([dx, dy]) => Math.hypot(dx, dy)))
  // Both diagonals run at 45 degrees, so each takes half the load through a
  // vertical component of F/sqrt(2): F = -5*sqrt(2) = -7.071 t, squashed.
  const diag = fixed.forces[memberKey(jid(280, 160), jid(200, 240))]
  check(
    'the same two panels triangulated stand up',
    fixed.status === 'ok' && fixedMove < 1,
    `status "${fixed.status}", worst movement ${fixedMove.toFixed(3)} px`,
  )
  check(
    'and each 45 degree brace takes half the load, so -5*sqrt(2) t',
    Math.abs(diag + 5 * Math.SQRT2) < 2e-3,
    `${diag.toFixed(4)} t against ${(-5 * Math.SQRT2).toFixed(4)} t by hand`,
  )
  // Worth knowing before trusting the flag: the folding mode has to be one the
  // truck can actually push on.
  const post = span([[200, 240, true], [320, 240, true], [200, 120], [320, 120]], [[0, 2], [2, 3], [3, 1]], { legal: false })
  const orth = solveTruss(post.joints, post.members, jid(200, 120), 10, HUGE)
  console.log(
    `        note: one bare square loaded straight down a column returns "${orth.status}", because that load cannot move the folding mode`,
  )
}

/* ------------------- 5. both banks are pinned ------------------- */

section('Both banks are pinned, so the span is a tied arch')
{
  // The game fixes both anchors in x and y (BridgeChallenge.tsx lines 174-175),
  // which is one restraint more than a simply supported truss. Force method:
  // release the horizontal thrust X, whose unit-load field is 1 in every deck
  // member and 0 everywhere else. Then
  //   X = -sum(N0 N1 L) / sum(N1 N1 L) = -(3/8+9/8+9/8+3/8)(120) / 480 = -3P/4
  // and X lands only on the deck, leaving the rest of the truss untouched.
  const points = [
    [160, 240, true], [280, 240], [400, 240], [520, 240], [640, 240, true],
    [220, 160], [340, 160], [460, 160], [580, 160],
  ]
  const A = [0, 1, 2, 3, 4]
  const T = [5, 6, 7, 8]
  const links = []
  for (let i = 0; i < 4; i++) links.push([A[i], A[i + 1]])
  for (let i = 0; i < 3; i++) links.push([T[i], T[i + 1]])
  for (let i = 0; i < 4; i++) links.push([A[i], T[i]], [T[i], A[i + 1]])
  const sp = span(points, links, { legal: false })
  const id = (i) => sp.joints[i].id
  const out = solveTruss(sp.joints, sp.members, id(A[2]), P, HUGE)
  const isDeck = (k) => {
    const [a, b] = k.split('|')
    return sp.byId.get(a).y === ROAD_Y && sp.byId.get(b).y === ROAD_Y
  }
  let worst = 0
  for (const k of sp.members) {
    const want = HAND.get(k) + (isDeck(k) ? -3 / 4 : 0)
    worst = Math.max(worst, Math.abs(out.forces[k] / P - want))
  }
  check(
    'every member matches the force method with X = -3/4 P',
    worst < 2e-3,
    `worst gap ${worst.toExponential(2)} P over ${sp.members.length} members`,
  )
  const bank = out.forces[memberKey(id(A[0]), id(A[1]))] / P
  const center = out.forces[memberKey(id(A[1]), id(A[2]))] / P
  check(
    'so the deck beside each bank is squashed, not stretched',
    bank < 0 && center > 0,
    `${bank.toFixed(4)} P at the bank and ${center.toFixed(4)} P at mid-span, where a simply supported span would read +0.375 and +1.125`,
  )
  console.log('        the banks are rock, not bearings, so the deck ties an arch and carries a third of the textbook pull')
}

/* ------------------- 6. mirrored constants ------------------- */

section('Mirrored constants, re-read from BridgeChallenge.tsx')
{
  const src = readFileSync(new URL('../src/challenges/civil/BridgeChallenge.tsx', import.meta.url), 'utf8')
  const mirrors = (label, re) => check(label, re.test(src), String(re))
  mirrors(
    'the sheet geometry',
    /const GRID = 40[\s\S]{0,400}const ROAD_Y = 240[\s\S]{0,80}const LEFT_X = 160[\s\S]{0,40}const RIGHT_X = 640[\s\S]{0,40}const MIN_X = 80[\s\S]{0,40}const MAX_X = 720[\s\S]{0,40}const MIN_Y = 80[\s\S]{0,40}const MAX_Y = 320[\s\S]{0,40}const MAX_LEN = 130/,
  )
  mirrors('20 px to the meter', /const PX_PER_M = 20\b/)
  mirrors('wood costs 5 and holds 22 pulled, 14 squashed', /wood:\s*\{[^}]*cost:\s*5,\s*tension:\s*22,\s*compression:\s*14/)
  mirrors('steel costs 12 and holds 50 pulled, 38 squashed', /steel:\s*\{[^}]*cost:\s*12,\s*tension:\s*50,\s*compression:\s*38/)
  mirrors('level 1 is 6 t with free timber', /load:\s*6,\s*budget:\s*null,\s*materials:\s*\['wood'\]/)
  mirrors('level 2 is 10 t on \\$10,000 of timber', /load:\s*10,\s*budget:\s*10000,\s*materials:\s*\['wood'\]/)
  mirrors('level 3 is 16 t on \\$14,000 with steel unlocked', /load:\s*16,\s*budget:\s*14000,\s*materials:\s*\['wood',\s*'steel'\]/)
  mirrors('level 4 is 14 t on \\$13,800', /load:\s*14,\s*budget:\s*13800,\s*materials:\s*\['wood',\s*'steel'\]/)
  mirrors('level 5 is 20 t on \\$21,000 with a 15 cm sag rule', /load:\s*20,\s*budget:\s*21000,[^}]*maxDeflection:\s*15/)
  mirrors(
    'the level 5 pars are $16,000, 10 cm and 20 %',
    /id: 'cost',[^}]*target: 16000[\s\S]{0,120}id: 'sagcm',[^}]*target: 10[\s\S]{0,120}id: 'spare',[^}]*target: 20/,
  )
  mirrors('cost is length in px times the rate', /lengthOf\(b\.key\) \* MATERIALS\[b\.material\]\.cost/)
  mirrors('sag is the worst joint movement turned into cm', /Math\.round\(\(peakMove \/ PX_PER_M\) \* 100\)/)
  mirrors('spare strength is one minus the worst utilization', /Math\.round\(\(1 - Math\.max\(0, \.\.\.Object\.values\(utilization\)\)\) \* 100\)/)
  mirrors('the truck is re-solved at every road joint', /for \(const id of roadPath\)[\s\S]{0,200}solveTruss\(joints, beamKeys, id, round\.load, capsFor\)/)
  mirrors('both banks are fixed', /ANCHOR_L[^\n]*fixed: true[\s\S]{0,120}ANCHOR_R[^\n]*fixed: true/)
  mirrors('level 1 opens one diagonal short', /\/\* \[7, 1\] missing \*\//)
}

/* ------------------- 7. the levels ------------------- */

/** The span level 1 hands the student, straight out of STARTER_NODES and STARTER_LINKS. */
const STARTER_POINTS = [
  [160, 240], [240, 240], [320, 240], [400, 240], [480, 240], [560, 240], [640, 240],
  [200, 160], [280, 160], [360, 160], [440, 160], [520, 160], [600, 160],
]
const STARTER_LINKS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
  [7, 8], [8, 9], [9, 10], [10, 11], [11, 12],
  [0, 7], /* [7, 1] missing */ [1, 8], [8, 2], [2, 9], [9, 3],
  [3, 10], [10, 4], [4, 11], [11, 5], [5, 12], [12, 6],
]

section('Level 1, one diagonal short')
{
  const lv = LEVELS[0]
  const opened = span(STARTER_POINTS, STARTER_LINKS)
  const bare = crossing(opened, wood(opened), lv.load)
  check(
    'the span as it opens folds at every truck position',
    bare.failedAt === jid(240, ROAD_Y) && bare.peakSag > 1000,
    `first fold under the truck at ${bare.failedAt}, deck reads ${bare.peakSag} cm`,
  )
  // Every legal beam a student could draw between the joints already on the sheet.
  const candidates = []
  for (let i = 0; i < opened.joints.length; i++) {
    for (let j = i + 1; j < opened.joints.length; j++) {
      const key = memberKey(opened.joints[i].id, opened.joints[j].id)
      if (opened.members.includes(key)) continue
      if (length(opened.byId, key) <= MAX_LEN) candidates.push([i, j, key])
    }
  }
  const fixers = candidates.filter(([i, j]) => {
    const trial = span(STARTER_POINTS, [...STARTER_LINKS, [i, j]])
    return crossing(trial, wood(trial), lv.load).failedAt === null
  })
  check(
    'exactly one beam is both in reach and missing, and it is the fix',
    candidates.length === 1 && fixers.length === 1 && fixers[0][2] === memberKey(jid(200, 160), jid(240, ROAD_Y)),
    `${candidates.length} in reach, ${fixers.length} of them fix it: ${fixers[0]?.[2] ?? 'none'}`,
  )
  // Building more truss away from the gap is the wrong instinct, so prove it fails.
  const elsewhere = span(
    [...STARTER_POINTS, [200, 80]],
    [...STARTER_LINKS, [7, 13], [13, 8]],
  )
  check(
    'adding a fresh triangle away from the gap does not help',
    crossing(elsewhere, wood(elsewhere), lv.load).failedAt !== null,
    'two more beams over the left bank, still folds at the same joint',
  )
  const done = span(STARTER_POINTS, [...STARTER_LINKS, [7, 1]])
  const r = crossing(done, wood(done), lv.load)
  check(
    'closing the gap carries the van across',
    r.failedAt === null,
    `$${costOf(done, wood(done)).toLocaleString('en-US')} of timber, ${r.spare}% strength spare, deck dips ${r.peakSag} cm`,
  )
  // Method of sections on that finished Warren, truck at mid-span. Cut just past
  // a bottom joint x and take moments about it: the diagonal and the deck member
  // through the cut have no lever, so F(top) * 80 = -R * (x - 160) with R = P/2.
  const capsFor = capsFrom(wood(done))
  const out = solveTruss(done.joints, done.members, jid(400, ROAD_Y), lv.load, capsFor)
  let worst = 0
  const hand = []
  for (const [left, right, x] of [[200, 280, 240], [280, 360, 320], [360, 440, 400], [440, 520, 480], [520, 600, 560]]) {
    const want = (-(lv.load / 2) * (Math.min(x, 800 - x) - 160)) / 80
    hand.push(want)
    worst = Math.max(worst, Math.abs(out.forces[memberKey(jid(left, 160), jid(right, 160))] - want))
  }
  check(
    'and its top chord matches the method of sections at every panel',
    worst < 2e-2,
    `${hand.join(', ')} t by hand for a ${lv.load} t van, worst gap ${worst.toExponential(2)} t`,
  )
}

section('Level 2, the same bridge now has a price')
{
  const lv = LEVELS[1]
  const winner = chorded(80, 'howe')
  const mats = wood(winner)
  const r = crossing(winner, mats, lv.load)
  const cost = costOf(winner, mats)
  check(
    'a 4 m deep Howe truss carries the semi inside the budget',
    r.failedAt === null && cost <= lv.budget,
    `$${cost.toLocaleString('en-US')} of $${lv.budget.toLocaleString('en-US')}, ${r.spare}% spare, ${r.peakSag} cm sag`,
  )
  const champ1 = span(STARTER_POINTS, [...STARTER_LINKS, [7, 1]])
  const champ1Cost = costOf(champ1, wood(champ1))
  const champ1Run = crossing(champ1, wood(champ1), lv.load)
  check(
    'the level 1 span is affordable here and still snaps',
    champ1Cost <= lv.budget && champ1Run.failedAt !== null,
    `$${champ1Cost.toLocaleString('en-US')} is inside the cap but it breaks at ${champ1Run.failedAt}, ${champ1Run.spare}% spare`,
  )
  const deep = warren(120)
  const deepCost = costOf(deep, wood(deep))
  const deepRun = crossing(deep, wood(deep), lv.load)
  check(
    'and the 6 m deep span carries it easily and prices itself out',
    deepRun.failedAt === null && deepCost > lv.budget,
    `${deepRun.spare}% spare but $${deepCost.toLocaleString('en-US')}, $${(deepCost - lv.budget).toLocaleString('en-US')} over`,
  )
  const shallow = warren(40)
  const shallowRun = crossing(shallow, wood(shallow), lv.load)
  check(
    'the cheapest shallow span is the trap',
    costOf(shallow, wood(shallow)) < lv.budget && shallowRun.failedAt !== null,
    `$${costOf(shallow, wood(shallow)).toLocaleString('en-US')} and it breaks at ${shallowRun.failedAt}`,
  )
}

section('Level 3, steel only where it earns its price')
{
  const lv = LEVELS[2]
  const sp = warren(80)
  const { mats, r } = steelWhereNeeded(sp, lv.load)
  const cost = costOf(sp, mats)
  const steel = Object.values(mats).filter((m) => m === 'steel').length
  check(
    'a 4 m Warren with steel on the hardest working beams passes',
    r.failedAt === null && cost <= lv.budget,
    `${steel} steel of ${sp.members.length}, $${cost.toLocaleString('en-US')} of $${lv.budget.toLocaleString('en-US')}, ${r.spare}% spare`,
  )
  const allWood = FAMILY.filter(([, s]) => crossing(s, wood(s), lv.load).failedAt === null)
  check(
    'no all-timber span in this sweep carries 16 t at all',
    allWood.length === 0,
    `${FAMILY.length} shapes tried, every one breaks`,
  )
  const allSteel = FAMILY.map(([name, s]) => {
    const m = Object.fromEntries(s.members.map((k) => [k, 'steel']))
    return { name, cost: costOf(s, m), ok: crossing(s, m, lv.load).failedAt === null }
  }).filter((d) => d.ok)
  const cheapest = Math.min(...allSteel.map((d) => d.cost))
  check(
    'and every all-steel span that carries it busts the budget',
    allSteel.length > 0 && cheapest > lv.budget,
    `${allSteel.length} all-steel shapes hold, the cheapest is $${cheapest.toLocaleString('en-US')} against a $${lv.budget.toLocaleString('en-US')} cap`,
  )
}

section('Level 4, push and pull')
{
  const lv = LEVELS[3]
  const sp = warren(80)
  const { mats, r } = steelWhereNeeded(sp, lv.load)
  const cost = costOf(sp, mats)
  check(
    'the mixed 4 m Warren passes with room over',
    r.failedAt === null && cost <= lv.budget,
    `${Object.values(mats).filter((m) => m === 'steel').length} steel, $${cost.toLocaleString('en-US')} of $${lv.budget.toLocaleString('en-US')}, ${r.spare}% spare`,
  )
  // The force view is the point of this level, so the signs it draws must be right.
  const out = solveTruss(sp.joints, sp.members, jid(400, ROAD_Y), lv.load, capsFrom(mats))
  const top = sp.members.filter((k) => {
    const [a, b] = k.split('|')
    return sp.byId.get(a).y !== ROAD_Y && sp.byId.get(b).y !== ROAD_Y
  })
  check(
    'with the truck at mid-span every top chord beam is in compression',
    top.every((k) => out.forces[k] < 0),
    `${top.length} beams, from ${Math.max(...top.map((k) => out.forces[k])).toFixed(2)} to ${Math.min(...top.map((k) => out.forces[k])).toFixed(2)} t`,
  )
  const worstTop = Math.min(...top.map((k) => out.forces[k]))
  check(
    'and the busiest of them reads exactly the moment over the depth',
    Math.abs(worstTop + ((lv.load / 2) * 240) / 80) < 2e-2,
    `${worstTop.toFixed(4)} t against (7 t x 240 px) / 80 px = ${(-((lv.load / 2) * 240) / 80).toFixed(4)} t`,
  )
  check(
    'the deck pulls at mid-span and pushes at the banks',
    out.forces[memberKey(jid(320, ROAD_Y), jid(400, ROAD_Y))] > 0 &&
      out.forces[memberKey(jid(160, ROAD_Y), jid(240, ROAD_Y))] < 0,
    `${out.forces[memberKey(jid(320, ROAD_Y), jid(400, ROAD_Y))].toFixed(2)} t at mid-span, ${out.forces[memberKey(jid(160, ROAD_Y), jid(240, ROAD_Y))].toFixed(2)} t at the bank, because both banks are pinned`,
  )
}

section('Level 5, strong is not the same as stiff')
{
  const lv = LEVELS[4]
  const sp = warren(80)
  const { mats, r } = steelWhereNeeded(sp, lv.load)
  const cost = costOf(sp, mats)
  check(
    'the 4 m Warren carries the hauler, fits the budget and holds the sag rule',
    r.failedAt === null && cost <= lv.budget && r.peakSag <= lv.maxDeflection,
    `$${cost.toLocaleString('en-US')} of $${lv.budget.toLocaleString('en-US')}, ${r.spare}% spare, ${r.peakSag} cm against a ${lv.maxDeflection} cm limit`,
  )
  // The whole lesson of the level: a span that holds and is still rejected.
  const bouncy = fullTop(80, 'pratt')
  const soft = steelWhereNeeded(bouncy, lv.load)
  const softCost = costOf(bouncy, soft.mats)
  check(
    'a Pratt span that holds the load on budget is still refused for sagging',
    soft.r.failedAt === null && softCost <= lv.budget && soft.r.peakSag > lv.maxDeflection,
    `nothing breaks, ${soft.r.spare}% spare, $${softCost.toLocaleString('en-US')} of $${lv.budget.toLocaleString('en-US')}, but ${soft.r.peakSag} cm of dip against ${lv.maxDeflection} cm`,
  )
  check(
    'steel cannot buy its way out, because depth is what buys stiffness',
    crossing(bouncy, Object.fromEntries(bouncy.members.map((k) => [k, 'steel'])), lv.load).peakSag === soft.r.peakSag,
    `the same span in all steel still dips ${soft.r.peakSag} cm, since EA is one number in truss.ts for both materials`,
  )

  const scored = []
  for (const [name, shape] of FAMILY) {
    const { mats: m, r: run } = steelWhereNeeded(shape, lv.load)
    const c = costOf(shape, m)
    if (run.failedAt !== null || c > lv.budget || run.peakSag > lv.maxDeflection) continue
    scored.push({ name, cost: c, sagcm: run.peakSag, spare: run.spare })
  }
  const met = (s) => [s.cost <= PARS.cost, s.sagcm <= PARS.sagcm, s.spare >= PARS.spare]
  const hits = scored.map((s) => met(s).filter(Boolean).length)
  check(
    'several shapes sign off, so the level is winnable',
    scored.length >= 4,
    `${scored.length} of ${FAMILY.length} shapes carry it, fit the budget and hold the sag rule`,
  )
  check(
    'and none of them takes all three pars',
    hits.length > 0 && Math.max(...hits) === 2,
    `best is ${Math.max(...hits)} of 3 pars, matching the design note in BridgeChallenge.tsx`,
  )
  for (const s of scored) {
    const m = met(s)
    console.log(
      `        ${s.name.padEnd(32)} $${String(s.cost).padStart(6)}${m[0] ? '*' : ' '} ${String(s.sagcm).padStart(2)} cm${m[1] ? '*' : ' '} ${String(s.spare).padStart(2)}%${m[2] ? '*' : ' '}`,
    )
  }
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`)
process.exit(failures === 0 ? 0 : 1)
