/**
 * A small DC circuit simulator (nodal analysis).
 *
 * Wires and closed switches merge terminals into "nets". The battery holds one
 * net at V and another at 0. Every bulb/buzzer is a resistor between two nets,
 * and we solve for the node voltages, which gives the current through each part.
 *
 * That is what makes series vs parallel matter: two bulbs in series each get
 * half the voltage and glow dim, while parallel branches each get the full
 * voltage and glow bright.
 */

export interface SimPart {
  id: string
  /** Resistance in ohms. */
  resistance: number
  /** Current (amps) it needs to be running at full. */
  ratedCurrent: number
}

export interface SimResult {
  /** True when + and - are joined with no resistance in between. */
  short: boolean
  /** part id -> how hard it is running, 1 = full power. */
  power: Record<string, number>
}

/** Union-find over terminal names. */
class Nets {
  private parent = new Map<string, string>()
  find(a: string): string {
    if (!this.parent.has(a)) this.parent.set(a, a)
    const p = this.parent.get(a)!
    if (p === a) return a
    const root = this.find(p)
    this.parent.set(a, root)
    return root
  }
  union(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }
}

export function simulate(
  /** Every wire the player drew, plus closed switches, as terminal pairs. */
  connections: [string, string][],
  parts: { part: SimPart; a: string; b: string }[],
  plusTerminal: string,
  minusTerminal: string,
  voltage: number,
): SimResult {
  const nets = new Nets()
  for (const [a, b] of connections) nets.union(a, b)

  const plus = nets.find(plusTerminal)
  const minus = nets.find(minusTerminal)
  const power: Record<string, number> = {}
  for (const { part } of parts) power[part.id] = 0

  // A straight wire from + to - with nothing in the way is a short circuit.
  if (plus === minus) return { short: true, power }

  // Collect the resistive branches between nets.
  const branches = parts
    .map(({ part, a, b }) => ({ part, na: nets.find(a), nb: nets.find(b) }))
    .filter((br) => br.na !== br.nb) // a part shorted across itself carries no load

  // Unknown nets: everything except the two the battery pins down.
  const unknown = [...new Set(branches.flatMap((br) => [br.na, br.nb]))].filter(
    (n) => n !== plus && n !== minus,
  )
  const index = new Map(unknown.map((n, i) => [n, i]))
  const n = unknown.length

  // Known voltages
  const fixed = (net: string) => (net === plus ? voltage : net === minus ? 0 : null)

  // Build the conductance matrix G v = i
  const G = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  const rhs = new Array<number>(n).fill(0)

  for (const { part, na, nb } of branches) {
    const g = 1 / part.resistance
    const ia = index.get(na)
    const ib = index.get(nb)
    const va = fixed(na)
    const vb = fixed(nb)

    if (ia !== undefined) {
      G[ia][ia] += g
      if (ib !== undefined) G[ia][ib] -= g
      else rhs[ia] += g * (vb ?? 0)
    }
    if (ib !== undefined) {
      G[ib][ib] += g
      if (ia !== undefined) G[ib][ia] -= g
      else rhs[ib] += g * (va ?? 0)
    }
  }

  // Nudge the diagonal so floating nets stay solvable instead of blowing up.
  for (let i = 0; i < n; i++) G[i][i] += 1e-9

  // Gaussian elimination with partial pivoting.
  const A = G.map((row, i) => [...row, rhs[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r
    }
    ;[A[col], A[pivot]] = [A[pivot], A[col]]
    const head = A[col][col]
    if (Math.abs(head) < 1e-15) continue
    for (let r = col + 1; r < n; r++) {
      const factor = A[r][col] / head
      if (factor === 0) continue
      for (let c = col; c <= n; c++) A[r][c] -= factor * A[col][c]
    }
  }
  const v = new Array<number>(n).fill(0)
  for (let row = n - 1; row >= 0; row--) {
    let sum = A[row][n]
    for (let c = row + 1; c < n; c++) sum -= A[row][c] * v[c]
    v[row] = Math.abs(A[row][row]) < 1e-15 ? 0 : sum / A[row][row]
  }

  const voltageOf = (net: string) => {
    const f = fixed(net)
    if (f !== null) return f
    const i = index.get(net)
    return i === undefined ? 0 : v[i]
  }

  for (const { part, na, nb } of branches) {
    const current = Math.abs(voltageOf(na) - voltageOf(nb)) / part.resistance
    power[part.id] = current / part.ratedCurrent
  }

  return { short: false, power }
}
