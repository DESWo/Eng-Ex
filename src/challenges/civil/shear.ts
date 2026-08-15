/**
 * A real shear-building earthquake solver (multi-degree-of-freedom time history).
 *
 * One lateral displacement per floor. Floors are rigid, columns bend between
 * them, so each storey behaves as a spring of stiffness k_i. We build M, C and K,
 * shake the base with a seeded synthetic ground record, and integrate
 *
 *     M u'' + C u' + K u = -M 1 a_g(t)
 *
 * with Newmark average acceleration. Out come the natural periods, the peak
 * inter-storey drift of every storey, the peak acceleration every floor feels,
 * and the whole displacement history so the game can replay the shake frame by
 * frame at real speed.
 *
 * Units throughout: mass in tonnes, stiffness in kN/m, length in metres,
 * acceleration in m/s². Those three are self-consistent, so sqrt(k/m) is
 * already radians per second with no conversion factor.
 *
 * Limits of the model:
 * 1. Linear elastic. Past roughly double DRIFT_CAP the numbers describe a
 *    building that has already failed, so the game clamps its display at
 *    40 mm/m and says so.
 * 2. WHICH of the three bays on a storey carries a brace does not matter here,
 *    only how many do. Bay position would need torsion and a 3D model.
 * 3. No behaviour factor q. Capacities are checked against the elastic
 *    response, which is how hospitals and isolated buildings are designed.
 *
 * Do not extend this to twenty storeys. The shear-building assumption (rigid
 * floors, columns in flexure) is right for six storeys and wrong for a slender
 * tower, where overall bending of the whole building dominates and floors no
 * longer stay level.
 */

export const G = 9.81

/* ------------------- tuning knobs (edit freely) ------------------- */
export const H_STOREY = 3.4 // normal storey height, m
export const H_LOBBY = 5.0 // double-height lobby, m
export const BAY = 6.0 // bay width, m
export const M_FLOOR = 60 // mass per floor, t
export const M_BASE = 70 // isolated base slab, t
export const K_BARE = 28000 // bare frame storey stiffness at H_STOREY, kN/m
export const K_BRACE = 26000 // one X-brace at H_STOREY, kN/m
export const K_ISO = 4200 // bearing layer stiffness, kN/m
export const ZETA = 0.05 // structural damping
export const ZETA_ISO = 0.18 // bearing damping
export const DRIFT_CAP = 0.02 // 20 mm of sideways slip per metre of height
export const OPEN_LOBBY = 0.75 // a glazed lobby has no infill stiffness
export const DT = 0.02 // integration step, s
export const DUR = 20 // record length, s
export const SEED = 12345 // fixed, so a design that passes always passes
export const ZG_DEFAULT = 0.6 // broadband rock, versus 0.25-0.35 for a valley

/** Most braces one storey can hold: the frame is three bays wide. */
export const MAX_PER_STOREY = 3

/* ------------------- storey stiffness, from geometry ------------------- */

const H_STOREY_DIAG = Math.hypot(BAY, H_STOREY)

/** Columns bend, so a taller storey is softer as the cube of its height. */
export const frameFactor = (h: number) => (H_STOREY / h) ** 3

/**
 * An X-brace is an axial member: its lateral stiffness is EA cos²θ / L, which
 * over a fixed bay width falls off as the cube of the diagonal length.
 */
export const braceFactor = (h: number) => (H_STOREY_DIAG / Math.hypot(BAY, h)) ** 3

/**
 * Storey stiffness in kN/m. `open` is 1 for a normal infilled storey and
 * OPEN_LOBBY for a glazed one with no walls to help.
 *
 * The two numbers that make the lobby the weak storey, both straight out of the
 * geometry above rather than hand-tuned: the 5 m glazed lobby sits at
 * frameFactor(5) * 0.75 = 0.3144 * 0.75 = 0.236 of a normal storey's stiffness,
 * and a brace there delivers braceFactor(5) = 0.688 of what it delivers upstairs.
 */
export const storeyStiffness = (h: number, open: number, braces: number) =>
  K_BARE * frameFactor(h) * open + braces * K_BRACE * braceFactor(h)

/* ------------------- ground motion: Kanai-Tajimi, seeded ------------------- */

function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Box-Muller Gaussian noise from the seeded stream. */
function gaussSeq(n: number, seed: number) {
  const r = lcg(seed)
  const out = new Float64Array(n)
  for (let i = 0; i < n; i += 2) {
    const u1 = Math.max(1e-12, r())
    const u2 = r()
    const m = Math.sqrt(-2 * Math.log(u1))
    out[i] = m * Math.cos(2 * Math.PI * u2)
    if (i + 1 < n) out[i + 1] = m * Math.sin(2 * Math.PI * u2)
  }
  return out
}

export interface GroundOptions {
  /** The rhythm the ground shakes at, in seconds per beat. */
  Tg: number
  /** Peak ground acceleration, in g. */
  pga: number
  dur?: number
  dt?: number
  seed?: number
  /** Site bandwidth: 0.6 is a broadband rock jumble, 0.3 a valley ringing at one note. */
  zg?: number
}

export interface GroundRecord {
  /** Ground acceleration, m/s². */
  a: Float64Array
  /** Ground displacement, m. Baseline-corrected, for drawing only. */
  d: Float64Array
  dt: number
  n: number
}

/**
 * Kanai-Tajimi filtered noise: white noise through a second-order filter tuned
 * to the site's own rhythm, under a quadratic-rise / plateau / decay envelope,
 * then scaled so the peak matches the level's PGA.
 *
 * The seed is fixed, so the same design always meets the same earthquake and a
 * layout that passed once passes forever.
 */
export function groundRecord({
  Tg,
  pga,
  dur = DUR,
  dt = DT,
  seed = SEED,
  zg = ZG_DEFAULT,
}: GroundOptions): GroundRecord {
  const n = Math.round(dur / dt)
  const w = gaussSeq(n, seed)
  const wg = (2 * Math.PI) / Tg
  let x = 0
  let v = 0
  const a = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const t = i * dt
    const env = t < 2 ? (t / 2) ** 2 : t < 10 ? 1 : Math.exp(-0.32 * (t - 10))
    const acc = -w[i] * env - 2 * zg * wg * v - wg * wg * x
    v += acc * dt
    x += v * dt
    a[i] = -(2 * zg * wg * v + wg * wg * x)
  }
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(a[i]))
  const s = (pga * G) / peak
  for (let i = 0; i < n; i++) a[i] *= s

  // Ground displacement for the animated ground band only. Double integration
  // of a synthetic accelerogram drifts away, so it gets the same leaky
  // high-pass a real strong-motion record gets before anyone plots it. It is
  // never fed back into the structure, which is driven by acceleration.
  const decay = Math.exp(-2 * Math.PI * 0.15 * dt)
  const d = new Float64Array(n)
  let gv = 0
  let gd = 0
  for (let i = 0; i < n; i++) {
    gv = (gv + a[i] * dt) * decay
    gd = (gd + gv * dt) * decay
    d[i] = gd
  }
  return { a, d, dt, n }
}

/* ------------------- eigen: Jacobi on a symmetric matrix ------------------- */

export interface EigenPair {
  lam: number
  vec: number[]
}

export function jacobiEigen(Ain: number[][], iters = 100): EigenPair[] {
  const n = Ain.length
  const A = Ain.map((r) => r.slice())
  const V: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  )
  for (let sweep = 0; sweep < iters; sweep++) {
    let off = 0
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2
    if (off < 1e-18) break
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-15) continue
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q])
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < n; k++) {
          const akp = A[k][p]
          const akq = A[k][q]
          A[k][p] = c * akp - s * akq
          A[k][q] = s * akp + c * akq
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k]
          const aqk = A[q][k]
          A[p][k] = c * apk - s * aqk
          A[q][k] = s * apk + c * aqk
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p]
          const vkq = V[k][q]
          V[k][p] = c * vkp - s * vkq
          V[k][q] = s * vkp + c * vkq
        }
      }
  }
  const pairs = A.map((r, i) => ({ lam: r[i], vec: V.map((row) => row[i]) }))
  pairs.sort((x, y) => x.lam - y.lam)
  return pairs
}

/* ------------------- the time history ------------------- */

export interface Storey {
  /** Storey stiffness below this floor, kN/m. */
  k: number
  /** Mass lumped at this floor, t. */
  m: number
  /** Storey height, m. Drift is measured per metre of it. */
  h: number
}

export interface Analysis {
  /** First natural period, s: how long the building takes to sway once. */
  T1: number
  periods: number[]
  /** First mode shape, normalised to 1 at the roof. */
  mode1: number[]
  /** Peak inter-storey drift ratio per storey (metres of slip per metre of height). */
  drift: number[]
  /** Peak total floor acceleration per floor, in g. */
  accel: number[]
  /** Peak displacement of the lowest degree of freedom, m. */
  peakBase: number
  /** Peak roof displacement relative to the ground, m. */
  peakRoof: number
  /** Displacement of every degree of freedom at every step, m. */
  history: Float64Array[]
  /** Step at which the largest displacement anywhere in the building happens. */
  peakStep: number
  /** First step at which any storey passed DRIFT_CAP, or -1. */
  failStep: number
  /** Which storey crossed DRIFT_CAP first (0-based index), or -1. */
  failIndex: number
}

/**
 * Shake one building. `storeys` runs bottom-up; `extraC0` is an explicit
 * dashpot added at the lowest degree of freedom, which is how the isolation
 * bearings get their own damping without smearing it over the whole frame.
 *
 * The effective stiffness matrix is constant and tridiagonal, so it is
 * LU-factorised once and every step is a Thomas solve: O(N) per step, which is
 * what lets the game re-run the whole earthquake on every single drag.
 */
export function analyze(
  storeys: Storey[],
  rec: GroundRecord,
  zeta = ZETA,
  extraC0 = 0,
  /**
   * Drift limit per degree of freedom. The isolation layer is passed Infinity,
   * because a bearing sliding is the bearing working, not the building tearing.
   */
  caps: number[] = storeys.map(() => DRIFT_CAP),
): Analysis {
  const N = storeys.length
  const m = storeys.map((s) => s.m)
  const k = storeys.map((s) => s.k)

  // K is tridiagonal: each storey spring ties one floor to the one below it.
  const K = Array.from({ length: N }, () => new Float64Array(N))
  for (let i = 0; i < N; i++) {
    K[i][i] = k[i] + (i + 1 < N ? k[i + 1] : 0)
    if (i + 1 < N) {
      K[i][i + 1] = -k[i + 1]
      K[i + 1][i] = -k[i + 1]
    }
  }

  // Modes from the symmetric standard form M^-1/2 K M^-1/2.
  const rs = m.map((x) => 1 / Math.sqrt(x))
  const A = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => K[i][j] * rs[i] * rs[j]),
  )
  const eig = jacobiEigen(A)
  const w = eig.map((e) => Math.sqrt(Math.max(1e-9, e.lam)))
  const periods = w.map((x) => (2 * Math.PI) / x)
  const phi1 = eig[0].vec.map((v, i) => v * rs[i])
  const mx = Math.max(...phi1.map(Math.abs))
  const mode1 = phi1.map((v) => (v / mx) * Math.sign(phi1[N - 1]))

  // Rayleigh damping pinned to `zeta` on the first two modes.
  const w1 = w[0]
  const w2 = w[Math.min(1, N - 1)]
  const a0 = (2 * zeta * w1 * w2) / (w1 + w2)
  const a1 = (2 * zeta) / (w1 + w2)
  const C = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => a1 * K[i][j] + (i === j ? a0 * m[i] : 0)),
  )
  C[0][0] += extraC0

  const dt = rec.dt
  const beta = 0.25
  const gamma = 0.5
  const lo = new Float64Array(N)
  const di = new Float64Array(N)
  const up = new Float64Array(N)
  for (let i = 0; i < N; i++) {
    const keff = (j: number) =>
      K[i][j] + (gamma / (beta * dt)) * C[i][j] + (i === j ? m[i] / (beta * dt * dt) : 0)
    di[i] = keff(i)
    if (i > 0) lo[i] = keff(i - 1)
    if (i < N - 1) up[i] = keff(i + 1)
  }
  // Tridiagonal LU, computed once and reused for all 1000 steps.
  const cp = new Float64Array(N)
  const dpDiag = new Float64Array(N)
  dpDiag[0] = di[0]
  for (let i = 1; i < N; i++) {
    cp[i] = lo[i] / dpDiag[i - 1]
    dpDiag[i] = di[i] - cp[i] * up[i - 1]
  }
  const y = new Float64Array(N)
  const xs = new Float64Array(N)
  const solve = (rhs: Float64Array) => {
    y[0] = rhs[0]
    for (let i = 1; i < N; i++) y[i] = rhs[i] - cp[i] * y[i - 1]
    xs[N - 1] = y[N - 1] / dpDiag[N - 1]
    for (let i = N - 2; i >= 0; i--) xs[i] = (y[i] - up[i] * xs[i + 1]) / dpDiag[i]
    return xs
  }

  const u = new Float64Array(N)
  const v = new Float64Array(N)
  const acc = new Float64Array(N)
  const anB = new Float64Array(N)
  const vnB = new Float64Array(N)
  const peakDrift = new Float64Array(N)
  const peakAcc = new Float64Array(N)
  const rhs = new Float64Array(N)
  const history = Array.from({ length: N }, () => new Float64Array(rec.n))
  let peakBase = 0
  let peakRoof = 0
  let peakAny = 0
  let peakStep = 0
  let failStep = -1
  let failIndex = -1

  for (let s = 0; s < rec.n; s++) {
    const ag = rec.a[s]
    for (let i = 0; i < N; i++) {
      const mterm =
        m[i] * (u[i] / (beta * dt * dt) + v[i] / (beta * dt) + (1 / (2 * beta) - 1) * acc[i])
      let cterm = 0
      for (let j = 0; j < N; j++) {
        cterm +=
          C[i][j] *
          ((gamma / (beta * dt)) * u[j] +
            (gamma / beta - 1) * v[j] +
            dt * (gamma / (2 * beta) - 1) * acc[j])
      }
      rhs[i] = -m[i] * ag + mterm + cterm
    }
    const un = solve(rhs)
    for (let i = 0; i < N; i++) {
      anB[i] = (un[i] - u[i]) / (beta * dt * dt) - v[i] / (beta * dt) - (1 / (2 * beta) - 1) * acc[i]
      vnB[i] = v[i] + dt * ((1 - gamma) * acc[i] + gamma * anB[i])
    }
    u.set(un)
    v.set(vnB)
    acc.set(anB)

    for (let i = 0; i < N; i++) {
      history[i][s] = u[i]
      const d = Math.abs(u[i] - (i > 0 ? u[i - 1] : 0)) / storeys[i].h
      if (d > peakDrift[i]) peakDrift[i] = d
      // The storey that goes is whichever crosses the limit FIRST in time, not
      // whichever is worst by the end. That is what lets soft-storey and
      // stiffness-cliff collapses pick different floors.
      if (failStep < 0 && d > caps[i]) {
        failStep = s
        failIndex = i
      }
      const at = Math.abs(acc[i] + ag) / G
      if (at > peakAcc[i]) peakAcc[i] = at
      const mag = Math.abs(u[i])
      if (mag > peakAny) {
        peakAny = mag
        peakStep = s
      }
    }
    peakBase = Math.max(peakBase, Math.abs(u[0]))
    peakRoof = Math.max(peakRoof, Math.abs(u[N - 1]))
  }

  return {
    T1: periods[0],
    periods,
    mode1,
    drift: Array.from(peakDrift),
    accel: Array.from(peakAcc),
    peakBase,
    peakRoof,
    history,
    peakStep,
    failStep,
    failIndex,
  }
}

/* ------------------- one design, start to verdict ------------------- */

export interface Building {
  /** Storey heights bottom-up, m. */
  heights: number[]
  /** Infill factor per storey: 1 normal, OPEN_LOBBY for the glazed lobby. */
  open: number[]
}

export interface Design {
  /** Braces installed on each storey, bottom-up, 0 to MAX_PER_STOREY. */
  braces: number[]
  isolated: boolean
}

export interface Gates {
  /** Bearing trench width, m. Isolated buildings only. */
  moat?: number
  /** Peak floor acceleration allowed, in %g. */
  joltCap?: number
}

export type FailKind = 'drift' | 'jolt' | 'moat'

export interface Failure {
  kind: FailKind
  /** 1-based storey that tore, for a drift failure. 0 otherwise. */
  storey: number
  /** mm/m for drift, %g for jolt, cm for moat. */
  value: number
  /** Limit it broke, in the same units. */
  limit: number
}

export interface Outcome {
  stands: boolean
  fail: Failure | null
  T1: number
  periods: number[]
  /** Peak drift per storey in mm/m, the bearing layer already sliced off. */
  lean: number[]
  /** Peak floor acceleration per storey in %g, the bearing layer sliced off. */
  jolt: number[]
  /** The worst storey lean, mm/m. */
  worstLean: number
  /** 1-based storey holding worstLean. */
  worstStorey: number
  /** The worst floor jolt, %g. */
  worstJolt: number
  /** How far the building moves, cm: peak roof displacement. */
  travel: number
  /** Bearing travel, cm. Zero on a fixed base. */
  bearingTravel: number
  totalMass: number
  /** Displacement history of every floor, plus the base slab when isolated. */
  history: Float64Array[]
  isolated: boolean
  peakStep: number
  failStep: number
  /** 0-based index into `lean` of the storey that tore, or -1. */
  failIndex: number
}

/** Assemble the storey list for a design, base slab first when isolated. */
export function storeysFor(building: Building, design: Design): Storey[] {
  const frame: Storey[] = building.heights.map((h, i) => ({
    k: storeyStiffness(h, building.open[i], design.braces[i] ?? 0),
    m: M_FLOOR,
    h,
  }))
  return design.isolated ? [{ k: K_ISO, m: M_BASE, h: H_STOREY }, ...frame] : frame
}

/**
 * Run one design against one site and return the verdict.
 * Failure order matters: a storey tearing is reported ahead of a jolt or moat
 * failure, never the other way round.
 */
export function runDesign(
  building: Building,
  design: Design,
  rec: GroundRecord,
  gates: Gates = {},
): Outcome {
  const storeys = storeysFor(building, design)
  const iso = design.isolated
  const extraC0 = iso ? 2 * ZETA_ISO * Math.sqrt(K_ISO * storeys.reduce((t, s) => t + s.m, 0)) : 0
  const caps = storeys.map((_, i) => (iso && i === 0 ? Infinity : DRIFT_CAP))
  const a = analyze(storeys, rec, ZETA, extraC0, caps)

  // The student is told about the storeys, not about the bearing layer.
  const lean = (iso ? a.drift.slice(1) : a.drift).map((d) => d * 1000)
  const jolt = (iso ? a.accel.slice(1) : a.accel).map((g) => g * 100)
  let worstLean = 0
  let worstStorey = 1
  lean.forEach((v, i) => {
    if (v > worstLean) {
      worstLean = v
      worstStorey = i + 1
    }
  })
  const worstJolt = Math.max(...jolt)
  const bearingTravel = iso ? a.peakBase * 100 : 0
  const travel = a.peakRoof * 100

  const failIndex = a.failIndex >= 0 ? (iso ? a.failIndex - 1 : a.failIndex) : -1
  let fail: Failure | null = null
  if (failIndex >= 0) {
    fail = { kind: 'drift', storey: failIndex + 1, value: lean[failIndex], limit: DRIFT_CAP * 1000 }
  }
  if (!fail && iso && gates.moat !== undefined && a.peakBase > gates.moat) {
    fail = { kind: 'moat', storey: 0, value: bearingTravel, limit: gates.moat * 100 }
  }
  if (!fail && gates.joltCap !== undefined && worstJolt > gates.joltCap) {
    fail = { kind: 'jolt', storey: 0, value: worstJolt, limit: gates.joltCap }
  }

  return {
    stands: fail === null,
    fail,
    T1: a.T1,
    periods: a.periods,
    lean,
    jolt,
    worstLean,
    worstStorey,
    worstJolt,
    travel,
    bearingTravel,
    totalMass: storeys.reduce((t, s) => t + s.m, 0),
    history: a.history,
    isolated: iso,
    peakStep: a.peakStep,
    failStep: a.failStep,
    failIndex,
  }
}

/* ------------------- response spectrum ------------------- */

/**
 * Peak displacement of a single oscillator of period T shaken by this record,
 * integrated with exactly the same Newmark scheme the building uses. Nothing
 * here comes from a code formula, so the level 4 spectrum panel can never
 * disagree with the verdict the building got.
 */
export function sdofPeak(T: number, zeta: number, rec: GroundRecord) {
  const w = (2 * Math.PI) / T
  const dt = rec.dt
  const beta = 0.25
  const gamma = 0.5
  const c = 2 * zeta * w
  const kk = w * w
  const keff = kk + (gamma / (beta * dt)) * c + 1 / (beta * dt * dt)
  let u = 0
  let v = 0
  let acc = 0
  let peak = 0
  for (let s = 0; s < rec.n; s++) {
    const p =
      -rec.a[s] +
      (u / (beta * dt * dt) + v / (beta * dt) + (1 / (2 * beta) - 1) * acc) +
      c * ((gamma / (beta * dt)) * u + (gamma / beta - 1) * v + dt * (gamma / (2 * beta) - 1) * acc)
    const un = p / keff
    const an = (un - u) / (beta * dt * dt) - v / (beta * dt) - (1 / (2 * beta) - 1) * acc
    v = v + dt * ((1 - gamma) * acc + gamma * an)
    acc = an
    u = un
    peak = Math.max(peak, Math.abs(u))
  }
  return peak
}

export interface Spectrum {
  T: number[]
  /** Peak displacement in cm at each period. */
  Sd: number[]
  /** Pseudo-acceleration in %g at each period, which is just Sd * omega^2. */
  Sa: number[]
}

/**
 * The response spectrum of one record: 50 log-spaced periods at 5% damping,
 * each one a full Newmark run of the same integrator the building uses. Both
 * curves come out of the same peak displacement, because pseudo-acceleration
 * is exactly omega^2 times it. Nothing here is a code formula, so the panel
 * cannot disagree with the verdict the building got.
 *
 * The two curves oppose each other: a slow building is pushed GENTLY (low Sa,
 * why floors go quiet on bearings) and TRAVELS FAR (high Sd, why it needs a
 * moat).
 */
export function spectrum(rec: GroundRecord, points = 50, tMin = 0.1, tMax = 3.0): Spectrum {
  const T: number[] = []
  const Sd: number[] = []
  const Sa: number[] = []
  for (let i = 0; i < points; i++) {
    const t = tMin * (tMax / tMin) ** (i / (points - 1))
    const peak = sdofPeak(t, ZETA, rec)
    T.push(t)
    Sd.push(peak * 100)
    Sa.push((peak * ((2 * Math.PI) / t) ** 2 * 100) / G)
  }
  return { T, Sd, Sa }
}
