/**
 * Offline guard for Robot Arm (src/challenges/robotics/RobotArmChallenge.tsx).
 *
 *   node scripts/verify-ik.mjs
 *
 * The kinematics live inside the .tsx component, so unlike shear.ts there is
 * nothing importable. Everything below the divider is a LINE FOR LINE COPY of
 * the component, with the source line numbers named. Section 0 reads the
 * component text back and fails if a constant or a formula has drifted from the
 * copy, so the two cannot silently diverge.
 *
 * Three jobs:
 *
 * 1. Check the solver against geometry it does not own: forward kinematics fed
 *    back through the solver, the law of cosines on the base-elbow-hand
 *    triangle, and the two hand-derivable extremes at d = L1 + L2 and
 *    d = |L1 - L2|.
 *
 * 2. Check the levels still teach what they were tuned to teach. Level 3 stands
 *    on 0.64 px of clearance between the forearm and the box column, and level 5
 *    stands on the shoulder stop cutting off one elbow solution at prize 3.
 *    Neither is a number anyone will notice going wrong by playing.
 *
 * 3. Pin the four places where the game deliberately approximates geometry
 *    (section 5). Those checks pass on the CURRENT size of each gap, so a change
 *    that widens one trips this script.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'challenges', 'robotics', 'RobotArmChallenge.tsx')
// Normalized to LF so a Windows checkout (core.autocrlf) passes identically.
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

/* ------------------- the component, mirrored ------------------- */

// RobotArmChallenge.tsx lines 20-29.
const L1 = 95
const L2 = 85
const BASE_X = 400
const BASE_Y = 300
const REACH_TOLERANCE = 14
const SHOULDER_MIN = 5
const SHOULDER_MAX = 175
const ELBOW_MIN = 20
const ELBOW_MAX = 160

// Drag clamp, line 307. The claw cannot leave this box.
const AIM_MIN_X = 40
const AIM_MAX_X = 760
const AIM_MIN_Y = 20
const AIM_MAX_Y = BASE_Y + 6

// Workspace overlay drawn on level 4, lines 364-367.
const RING_OUTER = L1 + L2
const RING_HOLE = Math.abs(L1 - L2) + 30

/** forward(), line 50. */
function forward(shoulder, elbow) {
  const a1 = (shoulder * Math.PI) / 180
  const a2 = ((shoulder + elbow) * Math.PI) / 180
  const elbowX = BASE_X + L1 * Math.cos(a1)
  const elbowY = BASE_Y - L1 * Math.sin(a1)
  return { elbowX, elbowY, handX: elbowX + L2 * Math.cos(a2), handY: elbowY - L2 * Math.sin(a2) }
}

/** hitsShelf(), line 59. Seventeen samples per link. */
function hitsShelf(x1, y1, x2, y2, shelf) {
  if (!shelf) return false
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    const x = x1 + (x2 - x1) * t
    const y = y1 + (y2 - y1) * t
    if (Math.abs(x - shelf.x) <= 11 && y >= shelf.top && y <= BASE_Y + 12) return true
  }
  return false
}

/** solve(), line 75. */
function solve(targetX, targetY, elbowUp, limits, shelf) {
  const dx = targetX - BASE_X
  const dy = BASE_Y - targetY
  const reach = Math.hypot(dx, dy)
  const d = Math.max(Math.abs(L1 - L2) + 0.5, Math.min(L1 + L2 - 0.5, reach))

  const cosElbow = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2)
  const elbowMag = (Math.acos(Math.max(-1, Math.min(1, cosElbow))) * 180) / Math.PI
  const elbow = elbowUp ? elbowMag : -elbowMag

  const a2 = (elbow * Math.PI) / 180
  const shoulder =
    (Math.atan2(dy, dx) * 180) / Math.PI -
    (Math.atan2(L2 * Math.sin(a2), L1 + L2 * Math.cos(a2)) * 180) / Math.PI

  const k = forward(shoulder, elbow)
  const outOfLimits =
    limits &&
    (shoulder < SHOULDER_MIN ||
      shoulder > SHOULDER_MAX ||
      Math.abs(elbow) < ELBOW_MIN ||
      Math.abs(elbow) > ELBOW_MAX)
  const blocked =
    hitsShelf(BASE_X, BASE_Y, k.elbowX, k.elbowY, shelf) ||
    hitsShelf(k.elbowX, k.elbowY, k.handX, k.handY, shelf)

  return { shoulder, elbow, ...k, outOfLimits, blocked }
}

/** The grab test, lines 246-247: the claw closes on whatever is under it. */
const grabs = (pose, t) =>
  !pose.outOfLimits && !pose.blocked && Math.hypot(pose.handX - t.x, pose.handY - t.y) <= REACH_TOLERANCE

// LEVELS, line 124. Section 0 checks this against the file.
const LEVELS = [
  { n: 1, targets: [{ x: 270, y: 200 }], limits: false, flip: false, shelf: undefined },
  { n: 2, targets: [{ x: 450, y: 140 }], limits: true, flip: false, shelf: undefined },
  { n: 3, targets: [{ x: 298, y: 170 }], limits: true, flip: true, shelf: { x: 345, top: 200 } },
  { n: 4, targets: [{ x: 470, y: 160 }], limits: true, flip: true, shelf: { x: 345, top: 220 } },
  {
    n: 5,
    targets: [{ x: 300, y: 205 }, { x: 470, y: 150 }, { x: 545, y: 240 }],
    limits: true,
    flip: true,
    shelf: undefined,
  },
]
// Reset pose, lines 199 and 288.
const START_AIM = { x: 300, y: 250 }
const START_ELBOW_UP = true

/* ------------------- tools this script owns ------------------- */

const rad = (deg) => (deg * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI
/** Law of cosines: the hand distance for a given elbow bend. */
const spanFor = (elbowDeg) => Math.sqrt(L1 * L1 + L2 * L2 + 2 * L1 * L2 * Math.cos(rad(elbowDeg)))
/** Law of cosines the other way: the elbow bend for a given hand distance. */
const elbowFor = (d) => deg(Math.acos((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2)))
/** Angle between the upper arm and the base-to-hand line, for a given bend. */
const leadFor = (elbowDeg) => deg(Math.atan2(L2 * Math.sin(rad(elbowDeg)), L1 + L2 * Math.cos(rad(elbowDeg))))
/**
 * Exact segment against the box column, by Liang-Barsky clipping. No sampling.
 * Returns the chord length inside the column, 0 for a graze along its edge, and
 * -1 when the link is clear of it.
 */
function segmentCutsShelf(x1, y1, x2, y2, shelf) {
  const [xmin, xmax, ymin, ymax] = [shelf.x - 11, shelf.x + 11, shelf.top, BASE_Y + 12]
  const dx = x2 - x1
  const dy = y2 - y1
  let t0 = 0
  let t1 = 1
  const clip = (p, q) => {
    if (p === 0) return q >= 0
    const r = q / p
    if (p < 0) {
      if (r > t1) return false
      if (r > t0) t0 = r
    } else {
      if (r < t0) return false
      if (r < t1) t1 = r
    }
    return true
  }
  if (!(clip(-dx, x1 - xmin) && clip(dx, xmax - x1) && clip(-dy, y1 - ymin) && clip(dy, ymax - y1))) return -1
  return Math.hypot(dx, dy) * (t1 - t0)
}
const trulyBlocked = (p, shelf) =>
  !!shelf &&
  (segmentCutsShelf(BASE_X, BASE_Y, p.elbowX, p.elbowY, shelf) >= 0 ||
    segmentCutsShelf(p.elbowX, p.elbowY, p.handX, p.handY, shelf) >= 0)
/** Aim points on a grid inside one prize's grab tolerance. */
function grabDisc(t, step = 0.5) {
  const out = []
  for (let x = t.x - REACH_TOLERANCE; x <= t.x + REACH_TOLERANCE + 1e-9; x += step)
    for (let y = t.y - REACH_TOLERANCE; y <= t.y + REACH_TOLERANCE + 1e-9; y += step)
      if (Math.hypot(x - t.x, y - t.y) <= REACH_TOLERANCE) out.push({ x, y })
  return out
}

/* ------------------- 0. the copy above still matches the component ------------------- */

section('The mirrored copy still matches the component')
{
  const num = (name) => {
    const m = src.match(new RegExp(`^const ${name} = (-?[\\d.]+)`, 'm'))
    return m ? Number(m[1]) : NaN
  }
  const consts = { L1, L2, BASE_X, BASE_Y, REACH_TOLERANCE, SHOULDER_MIN, SHOULDER_MAX, ELBOW_MIN, ELBOW_MAX }
  const wrong = Object.entries(consts).filter(([k, v]) => num(k) !== v)
  check('the nine tuning constants are unchanged', wrong.length === 0, wrong.length ? wrong.map(([k, v]) => `${k}: file ${num(k)}, copy ${v}`).join('; ') : `L1 ${L1}, L2 ${L2}, elbow ${ELBOW_MIN}..${ELBOW_MAX} deg, shoulder ${SHOULDER_MIN}..${SHOULDER_MAX} deg`)

  const lines = [
    'const d = Math.max(Math.abs(L1 - L2) + 0.5, Math.min(L1 + L2 - 0.5, reach))',
    'const cosElbow = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2)',
    '(Math.atan2(L2 * Math.sin(a2), L1 + L2 * Math.cos(a2)) * 180) / Math.PI',
    'const elbowX = BASE_X + L1 * Math.cos(a1)',
    'const elbowY = BASE_Y - L1 * Math.sin(a1)',
    'return { elbowX, elbowY, handX: elbowX + L2 * Math.cos(a2), handY: elbowY - L2 * Math.sin(a2) }',
    'if (Math.abs(x - shelf.x) <= 11 && y >= shelf.top && y <= BASE_Y + 12) return true',
    'for (let i = 0; i <= 16; i++) {',
    'x: Math.max(40, Math.min(760, x)), y: Math.max(20, Math.min(BASE_Y + 6, y))',
    'r={L1 + L2}',
    'r={Math.abs(L1 - L2) + 30}',
  ]
  const missing = lines.filter((l) => !src.includes(l))
  check('all eleven mirrored formulas are still in the file', missing.length === 0, missing.length ? `missing: ${missing.join(' | ')}` : 'clamp, cosine rule, lead angle, forward kinematics, shelf test, drag box, workspace ring')

  const block = src.slice(src.indexOf('const LEVELS: ChallengeLevel<ArmSetup>[] = ['), src.indexOf('export function RobotArmChallenge'))
  const parsed = block
    .split(/\n {2}\{\n {4}n: /)
    .slice(1)
    .map((b) => {
      const setup = b.slice(b.indexOf('setup: {'))
      const targetText = setup.match(/targets: \[([\s\S]*?)\]/)[1]
      const shelfText = setup.match(/shelf: \{ x: (\d+), top: (\d+) \}/)
      return {
        n: Number(b.match(/^(\d+)/)[1]),
        targets: [...targetText.matchAll(/\{ x: (\d+), y: (\d+) \}/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) })),
        limits: /limits: true/.test(setup),
        flip: /flip: true/.test(setup),
        shelf: shelfText ? { x: Number(shelfText[1]), top: Number(shelfText[2]) } : undefined,
      }
    })
  const drifted = parsed.filter((p, i) => JSON.stringify(p) !== JSON.stringify(LEVELS[i]))
  check('the level table parses back the same five levels', parsed.length === LEVELS.length && drifted.length === 0, drifted.length ? drifted.map((p) => `level ${p.n} file ${JSON.stringify(p)} copy ${JSON.stringify(LEVELS[p.n - 1])}`).join('; ') : `${parsed.length} levels, ${parsed.reduce((a, l) => a + l.targets.length, 0)} prizes, ${parsed.filter((l) => l.shelf).length} with a shelf`)
  check('the reset pose is still the one the levels start from', src.includes(`setAim({ x: ${START_AIM.x}, y: ${START_AIM.y} })`) && src.includes('setElbowUp(true)'), `aim (${START_AIM.x}, ${START_AIM.y}), elbow ${START_ELBOW_UP ? 'up' : 'down'}`)
}

/* ------------------- 1. the solver, against outside geometry ------------------- */

section('Inverse kinematics against forward kinematics')
{
  // Drive the arm to a known pose, ask the solver to find that pose from the
  // hand position alone, and see whether it lands back on the point.
  let worstPoint = 0
  let worstAngle = 0
  let wrapped = 0
  let n = 0
  for (let s = -60; s <= 175; s += 5) {
    for (let mag = ELBOW_MIN; mag <= ELBOW_MAX; mag += 5) {
      for (const e of [mag, -mag]) {
        const k = forward(s, e)
        const p = solve(k.handX, k.handY, e > 0, false)
        worstPoint = Math.max(worstPoint, Math.hypot(p.handX - k.handX, p.handY - k.handY))
        const dShoulder = Math.abs(((p.shoulder - s) % 360 + 540) % 360 - 180)
        worstAngle = Math.max(worstAngle, Math.abs(p.elbow - e), Math.abs(dShoulder))
        if (Math.abs(p.shoulder - s) > 1e-6) wrapped++
        n++
      }
    }
  }
  check(`${n} known poses come back to the same point`, worstPoint < 1e-9, `worst gap ${worstPoint.toExponential(2)} px, against a ${REACH_TOLERANCE} px grab tolerance`)
  check('the recovered joint angles are the ones we started from, to within a full turn', worstAngle < 1e-9, `worst ${worstAngle.toExponential(2)} deg; ${wrapped} of ${n} come back a full turn out, see section 5`)
}
{
  // Triangle base-elbow-hand: the links are the sides, the elbow angle is the
  // bend at the corner. Cosine rule, done here without asking the solver.
  let worstLink = 0
  let worstCos = 0
  let n = 0
  for (let x = AIM_MIN_X; x <= AIM_MAX_X; x += 7) {
    for (let y = AIM_MIN_Y; y <= AIM_MAX_Y; y += 7) {
      for (const up of [true, false]) {
        const p = solve(x, y, up, false)
        const upper = Math.hypot(p.elbowX - BASE_X, p.elbowY - BASE_Y)
        const fore = Math.hypot(p.handX - p.elbowX, p.handY - p.elbowY)
        const span = Math.hypot(p.handX - BASE_X, p.handY - BASE_Y)
        worstLink = Math.max(worstLink, Math.abs(upper - L1), Math.abs(fore - L2))
        worstCos = Math.max(worstCos, Math.abs(span - spanFor(p.elbow)))
        n++
      }
    }
  }
  check('both links keep their length in every pose the solver returns', worstLink < 1e-9, `${n} poses, worst ${worstLink.toExponential(2)} px off ${L1} and ${L2} px`)
  check('the elbow angle satisfies the law of cosines on that triangle', worstCos < 1e-9, `d = sqrt(L1^2 + L2^2 + 2*L1*L2*cos(elbow)) holds to ${worstCos.toExponential(2)} px`)
}

section('Elbow up and elbow down')
{
  let worstHand = 0
  let worstMirror = 0
  let worstSep = 0
  let minSep = Infinity
  let n = 0
  for (let ang = 0; ang < 360; ang += 9) {
    for (let d = 40; d <= 175; d += 5) {
      const t = { x: BASE_X + d * Math.cos(rad(ang)), y: BASE_Y - d * Math.sin(rad(ang)) }
      const up = solve(t.x, t.y, true, false)
      const dn = solve(t.x, t.y, false, false)
      worstHand = Math.max(worstHand, Math.hypot(up.handX - t.x, up.handY - t.y), Math.hypot(dn.handX - t.x, dn.handY - t.y))
      // The two elbows are mirror images in the base-to-target line, so their
      // midpoint sits on that line: cross product of the two vectors is zero.
      const mx = (up.elbowX + dn.elbowX) / 2 - BASE_X
      const my = BASE_Y - (up.elbowY + dn.elbowY) / 2
      worstMirror = Math.max(worstMirror, Math.abs(mx * (BASE_Y - t.y) - my * (t.x - BASE_X)) / d)
      // Separation of the two elbow joints, by hand: 2 * L1 * sin(lead angle).
      const sep = Math.hypot(up.elbowX - dn.elbowX, up.elbowY - dn.elbowY)
      worstSep = Math.max(worstSep, Math.abs(sep - 2 * L1 * Math.sin(rad(leadFor(elbowFor(d))))))
      minSep = Math.min(minSep, sep)
      n++
    }
  }
  check('both configurations put the hand on the target', worstHand < 1e-9, `${n} targets, worst ${worstHand.toExponential(2)} px`)
  check('the two elbows are mirror images in the base-to-target line', worstMirror < 1e-9, `worst offset ${worstMirror.toExponential(2)} px`)
  check('the elbows sit 2*L1*sin(lead) apart, as drawn on paper', worstSep < 1e-9, `worst ${worstSep.toExponential(2)} px`)
  check('the two configurations are genuinely different poses away from full stretch', minSep > 25, `closest the two elbows ever come, over this grid, is ${minSep.toFixed(1)} px`)
}

section('The two extremes, by hand')
{
  // A target exactly L1 + L2 from the base can only be reached straight out.
  const ang = 40
  const t = { x: BASE_X + RING_OUTER * Math.cos(rad(ang)), y: BASE_Y - RING_OUTER * Math.sin(rad(ang)) }
  const up = solve(t.x, t.y, true, false)
  const dn = solve(t.x, t.y, false, false)
  const handGap = Math.hypot(up.handX - dn.handX, up.handY - dn.handY)
  const short = Math.hypot(up.handX - t.x, up.handY - t.y)
  check('at d = L1 + L2 the two solutions collapse onto one point', handGap < 1e-9, `elbow up and elbow down land ${handGap.toExponential(2)} px apart at d = ${RING_OUTER} px`)
  check('the arm gets there nearly straight', Math.abs(up.elbow) === elbowFor(L1 + L2 - 0.5) && Math.abs(up.elbow) < 9, `elbow ${up.elbow.toFixed(3)} deg, which is the cosine rule at the ${(L1 + L2 - 0.5).toFixed(1)} px clamp, not the 0 deg of a true full stretch`)
  check('the clamp costs exactly half a pixel of reach', Math.abs(short - 0.5) < 1e-9, `hand lands ${short.toFixed(3)} px short of the ring, well inside the ${REACH_TOLERANCE} px grab tolerance`)
  check('the shortfall is along the line to the target, not sideways', Math.abs(deg(Math.atan2(BASE_Y - up.handY, up.handX - BASE_X)) - ang) < 1e-9, `hand bearing ${deg(Math.atan2(BASE_Y - up.handY, up.handX - BASE_X)).toFixed(6)} deg against a target at ${ang} deg`)
}
{
  // A target at |L1 - L2| can only be reached folded right back.
  const t = { x: BASE_X + Math.abs(L1 - L2), y: BASE_Y }
  const up = solve(t.x, t.y, true, false)
  const fold = elbowFor(Math.abs(L1 - L2) + 0.5)
  check('at d = |L1 - L2| the arm has to fold back on itself', Math.abs(Math.abs(up.elbow) - fold) < 1e-9, `elbow ${up.elbow.toFixed(2)} deg, the cosine rule at the ${(Math.abs(L1 - L2) + 0.5).toFixed(1)} px clamp`)
  check('that fold is past the elbow stop, so levels 2 to 5 refuse it', fold > ELBOW_MAX, `${fold.toFixed(2)} deg against a ${ELBOW_MAX} deg stop`)
  let worst = 0
  for (let d = 33; d <= 177; d += 1) worst = Math.max(worst, Math.abs(spanFor(elbowFor(d)) - d))
  check('elbow bend and hand distance track each other over the whole workspace', worst < 1e-9, `cosine rule inverted and re-applied at 145 distances, worst ${worst.toExponential(2)} px`)
}

section('Targets the arm cannot reach')
{
  const far = { x: BASE_X + 300, y: BASE_Y }
  const p = solve(far.x, far.y, true, false)
  const span = Math.hypot(p.handX - BASE_X, p.handY - BASE_Y)
  check('a target past L1 + L2 does not become a wrong pose: the arm stops at its own ring', Math.abs(span - (L1 + L2 - 0.5)) < 1e-9, `hand sits ${span.toFixed(2)} px out, still a legal two-link pose, ${(300 - span).toFixed(1)} px short of the target`)
  check('and the grab misses, so nothing is silently awarded', !grabs(p, far), `${(300 - span).toFixed(1)} px off against a ${REACH_TOLERANCE} px tolerance`)
  const upLim = solve(far.x, far.y, true, true)
  const dnLim = solve(far.x, far.y, false, true)
  check('with the joint stops on, both configurations report out of limits', upLim.outOfLimits && dnLim.outOfLimits, `elbow ${upLim.elbow.toFixed(2)} deg against a ${ELBOW_MIN} deg minimum bend`)

  const dead = { x: BASE_X + 5, y: BASE_Y - 3 }
  const q = solve(dead.x, dead.y, true, true)
  const qSpan = Math.hypot(q.handX - BASE_X, q.handY - BASE_Y)
  check('a target inside the dead zone is refused rather than faked', q.outOfLimits && !grabs(q, dead), `hand parks ${qSpan.toFixed(2)} px out with the elbow at ${q.elbow.toFixed(1)} deg, ${Math.hypot(q.handX - dead.x, q.handY - dead.y).toFixed(1)} px off the target`)
  check('the dead zone is refused in both configurations', solve(dead.x, dead.y, false, true).outOfLimits)

  // The clamp must never touch a target the arm can actually reach.
  let bitten = 0
  let n = 0
  for (let x = AIM_MIN_X; x <= AIM_MAX_X; x += 3) {
    for (let y = AIM_MIN_Y; y <= AIM_MAX_Y; y += 3) {
      const d = Math.hypot(x - BASE_X, BASE_Y - y)
      if (d < Math.abs(L1 - L2) + 0.5 || d > L1 + L2 - 0.5) continue
      n++
      if (Math.hypot(solve(x, y, true, false).handX - x, solve(x, y, true, false).handY - y) > 1e-9) bitten++
    }
  }
  check('inside the ring the clamp never bites', bitten === 0, `${n} in-range points across the cabinet, all reached exactly`)
}

section('Joint stops')
{
  // The stops shrink the ring: the cosine rule at each stop gives the real edge.
  const outer = spanFor(ELBOW_MIN)
  const inner = spanFor(ELBOW_MAX)
  check('the stops define an annulus you can work out from the cosine rule', Math.abs(outer - 177.2739) < 1e-3 && Math.abs(inner - 32.7714) < 1e-3, `reachable span is ${inner.toFixed(2)} to ${outer.toFixed(2)} px, from elbow ${ELBOW_MAX} deg and ${ELBOW_MIN} deg`)
  let anyOutside = 0
  for (let ang = 0; ang < 360; ang += 3) {
    for (const d of [inner - 0.5, outer + 0.5]) {
      const t = { x: BASE_X + d * Math.cos(rad(ang)), y: BASE_Y - d * Math.sin(rad(ang)) }
      if (!solve(t.x, t.y, true, true).outOfLimits || !solve(t.x, t.y, false, true).outOfLimits) anyOutside++
    }
  }
  check('half a pixel outside that annulus, every pose is rejected', anyOutside === 0, '240 bearings tested just inside and just outside')

  // A point the geometry can reach but the shoulder cannot: low and to the right.
  const low = { x: BASE_X + 170, y: BASE_Y - 10 }
  const lowUp = solve(low.x, low.y, true, true)
  const lowDn = solve(low.x, low.y, false, true)
  const lowSpan = Math.hypot(low.x - BASE_X, BASE_Y - low.y)
  check('a point inside the ring is still refused when the shoulder cannot get under it', lowUp.outOfLimits, `(${low.x}, ${low.y}) is ${lowSpan.toFixed(1)} px out, inside the ${outer.toFixed(1)} px edge, but elbow up wants shoulder ${lowUp.shoulder.toFixed(1)} deg against a ${SHOULDER_MIN} deg stop`)
  check('the same point in the other configuration is legal, so one solution survives', !lowDn.outOfLimits && grabs(lowDn, low), `elbow down holds shoulder ${lowDn.shoulder.toFixed(1)} deg, elbow ${lowDn.elbow.toFixed(1)} deg`)
  check('turn the stops off and the rejected pose comes back', !solve(low.x, low.y, true, false).outOfLimits, 'level 1 runs with limits off, every later level with them on')
}

/* ------------------- 2. the levels ------------------- */

section('Every prize is reachable')
{
  for (const lv of LEVELS) {
    for (const [i, t] of lv.targets.entries()) {
      const up = solve(t.x, t.y, true, lv.limits, lv.shelf)
      const dn = solve(t.x, t.y, false, lv.limits, lv.shelf)
      const err = Math.min(Math.hypot(up.handX - t.x, up.handY - t.y), Math.hypot(dn.handX - t.x, dn.handY - t.y))
      const ways = [up, dn].filter((p) => grabs(p, t)).length
      const d = Math.hypot(t.x - BASE_X, BASE_Y - t.y)
      // Level 2 has no flip button, so it has to work in the starting configuration.
      const okConfig = lv.flip ? ways >= 1 : grabs(up, t)
      check(`level ${lv.n} prize ${i + 1} can actually be picked up`, err < 1e-9 && okConfig, `${d.toFixed(1)} px out, ${ways} of 2 configurations legal, hand error ${err.toExponential(1)} px`)
    }
  }
}

section('Level 2, the prize sits on the edge of the workspace')
{
  const lv = LEVELS[1]
  const t = lv.targets[0]
  const d = Math.hypot(t.x - BASE_X, BASE_Y - t.y)
  const edge = spanFor(ELBOW_MIN)
  check('the prize is just inside the reach the stops allow', d < edge && edge - d < 12, `${d.toFixed(2)} px out against a ${edge.toFixed(2)} px edge, ${(edge - d).toFixed(2)} px of margin`)
  // Ring area beyond the prize over ring area in total: how much of the arm's
  // own workspace is farther out than this prize.
  const beyond = (edge ** 2 - d ** 2) / (edge ** 2 - spanFor(ELBOW_MAX) ** 2)
  check('only a thin outer band of the workspace lies farther out than it', beyond < 0.15, `${(beyond * 100).toFixed(0)}% of the reachable ring is beyond this prize, and the elbow has to come within ${solve(t.x, t.y, true, false).elbow.toFixed(1)} deg of straight to touch it`)
  const p = solve(t.x, t.y, true, lv.limits)
  check('the default elbow-up pose holds it, which is all this level offers', grabs(p, t), `shoulder ${p.shoulder.toFixed(1)} deg, elbow ${p.elbow.toFixed(1)} deg, both inside the stops`)
}

section('Level 3, the box stack really does remove one configuration')
{
  const lv = LEVELS[2]
  const t = lv.targets[0]
  const up = solve(t.x, t.y, true, lv.limits, lv.shelf)
  const dn = solve(t.x, t.y, false, lv.limits, lv.shelf)
  const cut = Math.max(
    segmentCutsShelf(BASE_X, BASE_Y, dn.elbowX, dn.elbowY, lv.shelf),
    segmentCutsShelf(dn.elbowX, dn.elbowY, dn.handX, dn.handY, lv.shelf),
  )
  check('elbow down drives a link straight through the boxes', dn.blocked && cut > 20, `${cut.toFixed(1)} px of link inside a 22 px wide column`)
  check('elbow up clears them and takes the prize', grabs(up, t) && !up.blocked, `shoulder ${up.shoulder.toFixed(1)} deg, elbow ${up.elbow.toFixed(1)} deg`)
  check('elbow up is clear by exact geometry too, not just by the sampled test', !trulyBlocked(up, lv.shelf), 'checked with segment clipping instead of 17 samples')

  const disc = grabDisc(t)
  const upWins = disc.filter((a) => grabs(solve(a.x, a.y, true, lv.limits, lv.shelf), t)).length
  const dnWins = disc.filter((a) => grabs(solve(a.x, a.y, false, lv.limits, lv.shelf), t)).length
  check('there is NO aim point in the whole grab tolerance that works elbow down', dnWins === 0, `0 of ${disc.length} aim points inside ${REACH_TOLERANCE} px, against ${upWins} elbow up`)
  check('the elbow-up window is wide enough to hit by hand', upWins / disc.length > 0.4, `${((upWins / disc.length) * 100).toFixed(0)}% of the grab tolerance`)
}

section('Level 4, the shelf is scenery and the ring is the lesson')
{
  const lv = LEVELS[3]
  const t = lv.targets[0]
  const up = solve(t.x, t.y, true, lv.limits, lv.shelf)
  const dn = solve(t.x, t.y, false, lv.limits, lv.shelf)
  check('the prize is on the far side of the base from the boxes, so neither configuration fouls', grabs(up, t) && grabs(dn, t), `prize at x ${t.x}, boxes at x ${lv.shelf.x}, base at x ${BASE_X}`)
  check('the drawn ring is the true two-link reach', RING_OUTER === L1 + L2, `outer radius ${RING_OUTER} px`)
  check('the drawn hole is bigger than the true dead zone, so it never promises reach the arm lacks', RING_HOLE > spanFor(ELBOW_MAX), `hole ${RING_HOLE} px against a ${spanFor(ELBOW_MAX).toFixed(2)} px dead zone, ${(RING_HOLE - spanFor(ELBOW_MAX)).toFixed(2)} px conservative`)
}

section('Level 5, one elbow flip is forced')
{
  const lv = LEVELS[4]
  const start = { up: solve(START_AIM.x, START_AIM.y, true, lv.limits), dn: solve(START_AIM.x, START_AIM.y, false, lv.limits) }
  check('the pose the level starts in is legal elbow up only', !start.up.outOfLimits && start.dn.outOfLimits, `start elbow down wants shoulder ${start.dn.shoulder.toFixed(1)} deg against a ${SHOULDER_MAX} deg stop`)
  const third = lv.targets[2]
  const up3 = solve(third.x, third.y, true, lv.limits)
  const dn3 = solve(third.x, third.y, false, lv.limits)
  check('prize 3 is legal elbow down only', up3.outOfLimits && grabs(dn3, third), `elbow up wants shoulder ${up3.shoulder.toFixed(2)} deg, ${(SHOULDER_MIN - up3.shoulder).toFixed(2)} deg under the ${SHOULDER_MIN} deg stop`)
  const allUp = lv.targets.every((t) => grabs(solve(t.x, t.y, true, lv.limits), t))
  const allDown = lv.targets.every((t) => grabs(solve(t.x, t.y, false, lv.limits), t))
  check('neither configuration takes the start pose and all three prizes, so the par of 1 flip is a floor', !allUp && !(allDown && !start.dn.outOfLimits), `elbow up clears ${lv.targets.filter((t) => grabs(solve(t.x, t.y, true, lv.limits), t)).length} of 3 prizes, elbow down ${lv.targets.filter((t) => grabs(solve(t.x, t.y, false, lv.limits), t)).length} of 3 but not the start pose`)
  for (const [i, t] of lv.targets.entries()) {
    const disc = grabDisc(t)
    const anyUp = disc.filter((a) => grabs(solve(a.x, a.y, true, lv.limits), t)).length
    const anyDn = disc.filter((a) => grabs(solve(a.x, a.y, false, lv.limits), t)).length
    console.log(`        prize ${i + 1}: ${anyUp} of ${disc.length} aim points work elbow up, ${anyDn} elbow down`)
  }
}

/* ------------------- 3. where the game rounds off geometry ------------------- */

section('Known gaps, pinned at their current size')
{
  // (a) atan2 returns (-180, 180]. Subtracting the lead angle can push the
  //     shoulder below -180, and the limit test then rejects a pose the arm
  //     could actually hold. See solve(), lines 87-97.
  const strip = []
  for (let x = AIM_MIN_X; x <= AIM_MAX_X; x++) {
    for (let y = AIM_MIN_Y; y <= AIM_MAX_Y; y++) {
      for (const up of [true, false]) {
        const p = solve(x, y, up, true)
        const unwrapped = p.shoulder + 360
        if (p.outOfLimits && unwrapped >= SHOULDER_MIN && unwrapped <= SHOULDER_MAX && Math.abs(p.elbow) >= ELBOW_MIN && Math.abs(p.elbow) <= ELBOW_MAX)
          strip.push({ x, y, up, shoulder: p.shoulder })
      }
    }
  }
  const xs = strip.map((s) => s.x)
  const ys = strip.map((s) => s.y)
  const inBox = strip.every((s) => s.y > BASE_Y && s.up)
  check('KNOWN: the shoulder angle wraps past -180 and a holdable pose is refused', strip.length === 870 && inBox, `${strip.length} of ${(AIM_MAX_X - AIM_MIN_X + 1) * (AIM_MAX_Y - AIM_MIN_Y + 1) * 2} aim poses, all elbow up, x ${Math.min(...xs)}-${Math.max(...xs)}, y ${Math.min(...ys)}-${Math.max(...ys)}: a strip below the bench line, left of the base`)
  check('the wrap strip touches no prize and no level start pose', LEVELS.every((lv) => lv.targets.every((t) => t.y + REACH_TOLERANCE < Math.min(...ys))) && START_AIM.y + 0 < Math.min(...ys), `nearest prize edge is y ${Math.max(...LEVELS.flatMap((lv) => lv.targets.map((t) => t.y + REACH_TOLERANCE)))}, strip starts at y ${Math.min(...ys)}`)
  const wrapPose = strip[Math.floor(strip.length / 2)]
  console.log(`        worked example: drag to (${wrapPose.x}, ${wrapPose.y}) and the readout says shoulder ${wrapPose.shoulder.toFixed(0)} deg, out of limits, where ${(wrapPose.shoulder + 360).toFixed(0)} deg is the same arm and legal. The travel meter on level 5 counts that as a full extra turn.`)

  // (b) hitsShelf samples 17 points per link, so a link can clip a corner of
  //     the column between samples. Exact clipping says how much it misses.
  for (const shelf of LEVELS.filter((lv) => lv.shelf).map((lv) => lv.shelf)) {
    let missed = 0
    let worst = 0
    let phantom = 0
    for (let x = AIM_MIN_X; x <= AIM_MAX_X; x++) {
      for (let y = AIM_MIN_Y; y <= AIM_MAX_Y; y++) {
        for (const up of [true, false]) {
          const p = solve(x, y, up, true, shelf)
          const cuts = [
            segmentCutsShelf(BASE_X, BASE_Y, p.elbowX, p.elbowY, shelf),
            segmentCutsShelf(p.elbowX, p.elbowY, p.handX, p.handY, shelf),
          ]
          const real = cuts.some((c) => c >= 0)
          if (p.blocked && !real) phantom++
          if (real && !p.blocked) {
            missed++
            worst = Math.max(worst, ...cuts)
          }
        }
      }
    }
    check(`KNOWN: the sampled shelf test misses grazes on the shelf at top ${shelf.top}`, worst < 6 && phantom === 0, `${missed} poses on a 1 px grid where a link truly clips the column, worst ${worst.toFixed(2)} px of a 22 px column; ${phantom} poses blocked while clear, so the test errs toward letting a graze through and never toward a false block`)
  }

  // (c) The workspace ring on level 4 is drawn from link length alone, while
  //     the arm on that level runs with joint stops.
  check('KNOWN: the drawn ring claims reach the stops do not allow', RING_OUTER - spanFor(ELBOW_MIN) < 3, `outer ring ${RING_OUTER} px against a real edge of ${spanFor(ELBOW_MIN).toFixed(2)} px, ${(RING_OUTER - spanFor(ELBOW_MIN)).toFixed(2)} px of overclaim, under the ${REACH_TOLERANCE} px grab tolerance`)
  check('and the drawn hole hides reach the arm does have', RING_HOLE - spanFor(ELBOW_MAX) < 8, `hole ${RING_HOLE} px against a real dead zone of ${spanFor(ELBOW_MAX).toFixed(2)} px, ${(RING_HOLE - spanFor(ELBOW_MAX)).toFixed(2)} px hidden`)

  // (d) Level 5 prize 3 is elbow-down at its center, but the grab tolerance
  //     reaches a sliver where elbow up clears the shoulder stop.
  const lv = LEVELS[4]
  const third = lv.targets[2]
  let sliver = 0
  let best = -Infinity
  let bestAt = null
  for (const a of grabDisc(third, 0.1)) {
    const p = solve(a.x, a.y, true, lv.limits)
    if (p.shoulder > best) {
      best = p.shoulder
      bestAt = a
    }
    if (grabs(p, third)) sliver += 0.01
  }
  check('KNOWN: prize 3 has a sliver where elbow up is legal after all', sliver < 15, `${sliver.toFixed(1)} px2 of the ${(Math.PI * REACH_TOLERANCE ** 2).toFixed(0)} px2 grab tolerance, ${((100 * sliver) / (Math.PI * REACH_TOLERANCE ** 2)).toFixed(1)}%: shoulder peaks at ${best.toFixed(2)} deg near (${bestAt.x.toFixed(1)}, ${bestAt.y.toFixed(1)}), just over the ${SHOULDER_MIN} deg stop`)
  console.log('        so a zero-flip run of level 5 exists, against the one-flip floor claimed at line 176. It needs the claw parked up and right of the prize, inside a patch about 3 px across.')
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`)
process.exit(failures === 0 ? 0 : 1)
