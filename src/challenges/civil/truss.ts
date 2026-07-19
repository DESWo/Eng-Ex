/**
 * A tiny real truss solver (stiffness method).
 *
 * Every beam acts as an axial spring. We assemble the classic K u = f
 * system for the free joints, solve it, and read back each member's
 * axial force. Positive force = tension (stretched), negative =
 * compression (squeezed). If the structure is a mechanism (not enough
 * triangles), deflections explode and we report it as unstable.
 */

export interface TrussJoint {
  id: string
  x: number
  y: number
  /** Anchored to the ground (bank). Fixed joints cannot move. */
  fixed?: boolean
}

export interface SolveOutcome {
  status: 'ok' | 'unstable' | 'broken'
  /** member key -> axial force. Positive = tension, negative = compression. */
  forces: Record<string, number>
  /** member key -> |force| / capacity. 1 or more means it fails. */
  utilization: Record<string, number>
  /** The single worst member when status is "broken". */
  worst: { key: string; mode: 'tension' | 'compression' } | null
  /** joint id -> [dx, dy] movement in px, for drawing the collapse. */
  deflection: Record<string, [number, number]>
}

const EA = 6000 // beam stiffness. Bigger = stiffer bridge overall.
const UNSTABLE_DEFLECTION = 60 // px of movement that counts as "it folded"

export const memberKey = (a: string, b: string) => [a, b].sort().join('|')

export function memberLength(joints: TrussJoint[], key: string) {
  const [a, b] = key.split('|')
  const ja = joints.find((j) => j.id === a)!
  const jb = joints.find((j) => j.id === b)!
  return Math.hypot(jb.x - ja.x, jb.y - ja.y)
}

export function solveTruss(
  joints: TrussJoint[],
  memberKeys: string[],
  loadJointId: string,
  loadWeight: number,
  tensionCap: number,
  compressionCap: number,
): SolveOutcome {
  const jointById = new Map(joints.map((j) => [j.id, j]))

  // Only joints that actually touch a beam take part in the math.
  const usedIds = new Set<string>()
  for (const key of memberKeys) {
    const [a, b] = key.split('|')
    usedIds.add(a)
    usedIds.add(b)
  }
  const free = joints.filter((j) => !j.fixed && usedIds.has(j.id))
  const dofIndex = new Map(free.map((j, i) => [j.id, i * 2]))
  const n = free.length * 2

  const empty: SolveOutcome = { status: 'ok', forces: {}, utilization: {}, worst: null, deflection: {} }
  if (n === 0) return empty

  // Assemble the stiffness matrix.
  const K: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  const f = new Array<number>(n).fill(0)

  for (const key of memberKeys) {
    const [a, b] = key.split('|')
    const ja = jointById.get(a)!
    const jb = jointById.get(b)!
    const dx = jb.x - ja.x
    const dy = jb.y - ja.y
    const length = Math.hypot(dx, dy)
    const c = dx / length
    const s = dy / length
    const k = EA / length
    const local = [
      [c * c, c * s],
      [c * s, s * s],
    ]
    const dofA = dofIndex.get(a) ?? -1
    const dofB = dofIndex.get(b) ?? -1
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const v = k * local[i][j]
        if (dofA >= 0) K[dofA + i][dofA + j] += v
        if (dofB >= 0) K[dofB + i][dofB + j] += v
        if (dofA >= 0 && dofB >= 0) {
          K[dofA + i][dofB + j] -= v
          K[dofB + i][dofA + j] -= v
        }
      }
    }
  }

  // A whisper of grounding so mechanisms produce huge (finite) movement
  // instead of a divide-by-zero. Real rigidity dwarfs this.
  for (let i = 0; i < n; i++) K[i][i] += EA / 1e7

  const loadDof = dofIndex.get(loadJointId)
  if (loadDof !== undefined) f[loadDof + 1] = loadWeight // +y is down in SVG

  // Solve K u = f with Gaussian elimination (partial pivoting).
  const A = K.map((row, i) => [...row, f[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r
    }
    ;[A[col], A[pivot]] = [A[pivot], A[col]]
    const head = A[col][col]
    if (Math.abs(head) < 1e-12) continue
    for (let r = col + 1; r < n; r++) {
      const factor = A[r][col] / head
      if (factor === 0) continue
      for (let c2 = col; c2 <= n; c2++) A[r][c2] -= factor * A[col][c2]
    }
  }
  const u = new Array<number>(n).fill(0)
  for (let row = n - 1; row >= 0; row--) {
    let sum = A[row][n]
    for (let c2 = row + 1; c2 < n; c2++) sum -= A[row][c2] * u[c2]
    u[row] = Math.abs(A[row][row]) < 1e-12 ? 0 : sum / A[row][row]
  }

  const deflection: Record<string, [number, number]> = {}
  let maxMove = 0
  for (const j of free) {
    const d = dofIndex.get(j.id)!
    deflection[j.id] = [u[d], u[d + 1]]
    maxMove = Math.max(maxMove, Math.abs(u[d]), Math.abs(u[d + 1]))
  }

  // Member forces from joint movements.
  const forces: Record<string, number> = {}
  const utilization: Record<string, number> = {}
  let worst: SolveOutcome['worst'] = null
  let worstUtil = 1
  for (const key of memberKeys) {
    const [a, b] = key.split('|')
    const ja = jointById.get(a)!
    const jb = jointById.get(b)!
    const dx = jb.x - ja.x
    const dy = jb.y - ja.y
    const length = Math.hypot(dx, dy)
    const c = dx / length
    const s = dy / length
    const ua = deflection[a] ?? [0, 0]
    const ub = deflection[b] ?? [0, 0]
    const stretch = (ub[0] - ua[0]) * c + (ub[1] - ua[1]) * s
    const force = (EA / length) * stretch
    forces[key] = force
    const cap = force >= 0 ? tensionCap : compressionCap
    const util = Math.abs(force) / cap
    utilization[key] = util
    if (util >= worstUtil) {
      worstUtil = util
      worst = { key, mode: force >= 0 ? 'tension' : 'compression' }
    }
  }

  if (maxMove > UNSTABLE_DEFLECTION) {
    return { status: 'unstable', forces, utilization, worst: null, deflection }
  }
  if (worst) {
    return { status: 'broken', forces, utilization, worst, deflection }
  }
  return { status: 'ok', forces, utilization, worst: null, deflection }
}
