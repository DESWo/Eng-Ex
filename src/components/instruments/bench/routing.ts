/**
 * Orthogonal wire routing, the way a schematic is drawn: conductors leave a
 * pin along its lead, run in right angles, and hop over anything they cross.
 *
 * The rule this kit enforces everywhere: wires join ONLY at pins. A crossing is
 * always drawn as a hop, so a student never has to guess whether two lines that
 * touch are connected. A filled junction dot on a pin means two or more
 * conductors land there.
 *
 * Nothing here measures anything a game scores. A schematic is not a scale
 * drawing; if a game bills cable, it bills it off the physical layout, not off
 * the path drawn on the sheet.
 */

export interface Pt {
  x: number
  y: number
}

/** The direction a pin's lead leaves its body. */
export type Lead = 'left' | 'right' | 'up' | 'down'

/** A crossing drawn as a bump on segment `seg` of a route. */
export interface Hop {
  seg: number
  x: number
  y: number
}

const STEP: Record<Lead, Pt> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
}

const snap = (v: number, grid = 10) => Math.round(v / grid) * grid
const horizontal = (lead: Lead) => lead === 'left' || lead === 'right'

/**
 * A right-angle route out of one pin and into another. Both ends get a short
 * stub along their lead first, so a conductor never leaves a pin sideways.
 */
export function orthRoute(from: Pt, fromLead: Lead, to: Pt, toLead: Lead, stub = 16): Pt[] {
  const a = { x: from.x + STEP[fromLead].x * stub, y: from.y + STEP[fromLead].y * stub }
  const b = { x: to.x + STEP[toLead].x * stub, y: to.y + STEP[toLead].y * stub }
  const mid: Pt[] = []

  if (horizontal(fromLead) && horizontal(toLead)) {
    if (Math.abs(a.y - b.y) > 0.5) {
      // Both stubs facing the same way route around the far side, so the
      // conductor never doubles back across the parts it just left.
      const sa = STEP[fromLead].x
      const sb = STEP[toLead].x
      const mx =
        sa > 0 && sb > 0
          ? snap(Math.max(a.x, b.x))
          : sa < 0 && sb < 0
            ? snap(Math.min(a.x, b.x))
            : snap((a.x + b.x) / 2)
      mid.push({ x: mx, y: a.y }, { x: mx, y: b.y })
    }
  } else if (!horizontal(fromLead) && !horizontal(toLead)) {
    if (Math.abs(a.x - b.x) > 0.5) {
      const sa = STEP[fromLead].y
      const sb = STEP[toLead].y
      const my =
        sa > 0 && sb > 0
          ? snap(Math.max(a.y, b.y))
          : sa < 0 && sb < 0
            ? snap(Math.min(a.y, b.y))
            : snap((a.y + b.y) / 2)
      mid.push({ x: a.x, y: my }, { x: b.x, y: my })
    }
  } else if (horizontal(fromLead)) {
    mid.push({ x: b.x, y: a.y })
  } else {
    mid.push({ x: a.x, y: b.y })
  }

  return dedupe([from, a, ...mid, b, to])
}

function dedupe(pts: Pt[]): Pt[] {
  const out: Pt[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) out.push(p)
  }
  return out
}

/** Drawn length of a route. Display only, never a score. */
export function routeLength(pts: Pt[]): number {
  let sum = 0
  for (let i = 1; i < pts.length; i++) sum += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  return sum
}

const between = (v: number, p: number, q: number, margin: number) =>
  v > Math.min(p, q) + margin && v < Math.max(p, q) - margin

/**
 * Every place two different routes cross without meeting at a pin. The hop is
 * always put on the horizontal run, which is the usual drafting habit.
 */
export function findHops(routes: { id: string; pts: Pt[] }[], margin = 6): Record<string, Hop[]> {
  const hops: Record<string, Hop[]> = {}
  for (const route of routes) hops[route.id] = []

  for (const a of routes) {
    for (let i = 1; i < a.pts.length; i++) {
      const h1 = a.pts[i - 1]
      const h2 = a.pts[i]
      if (Math.abs(h1.y - h2.y) > 0.5) continue // horizontal runs only
      for (const b of routes) {
        if (b.id === a.id) continue
        for (let j = 1; j < b.pts.length; j++) {
          const v1 = b.pts[j - 1]
          const v2 = b.pts[j]
          if (Math.abs(v1.x - v2.x) > 0.5) continue // vertical runs only
          if (between(v1.x, h1.x, h2.x, margin) && between(h1.y, v1.y, v2.y, margin)) {
            hops[a.id].push({ seg: i - 1, x: v1.x, y: h1.y })
          }
        }
      }
    }
  }
  return hops
}

/** SVG path for a route, with a semicircular bump at each hop. */
export function pathFromPts(pts: Pt[], hops: Hop[] = [], r = 5): string {
  if (pts.length === 0) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const dir = b.x > a.x ? 1 : -1
    const onSeg = hops
      .filter((h) => h.seg === i - 1)
      .sort((h1, h2) => (dir > 0 ? h1.x - h2.x : h2.x - h1.x))
    for (const h of onSeg) {
      // sweep flag flips with travel direction so the bump always reads as "over"
      d += ` L ${h.x - dir * r} ${a.y} A ${r} ${r} 0 0 ${dir > 0 ? 1 : 0} ${h.x + dir * r} ${a.y}`
    }
    d += ` L ${b.x} ${b.y}`
  }
  return d
}
