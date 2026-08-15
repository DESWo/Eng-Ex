import { motion, useReducedMotion } from 'framer-motion'
import { pathFromPts, type Hop, type Pt } from './routing'

/**
 * Heat marking. A run that carried more than it should does not just turn red,
 * it gets marked: char along the conductor and soot where it ran hottest.
 *
 * Use `ScorchedRun` on a routed conductor, `ScorchSmudge` on anything else that
 * cooked (a bar, a terminal, a breaker pole).
 */
export function ScorchedRun({ pts, hops = [] }: { pts: Pt[]; hops?: Hop[] }) {
  const reduced = useReducedMotion()
  const d = pathFromPts(pts, hops)

  return (
    <g aria-hidden>
      <path d={d} fill="none" stroke="var(--bench-char, #40140c)" strokeWidth="15" strokeLinecap="round" opacity="0.85" />
      <path d={d} fill="none" stroke="var(--bench-fault, #ff6b5c)" strokeWidth="9" strokeLinecap="round" opacity="0.22" />
      <motion.path
        d={d}
        fill="none"
        stroke="var(--bench-hot, #fde047)"
        strokeWidth="2.4"
        strokeLinecap="butt"
        initial={false}
        animate={reduced ? { opacity: 0.7 } : { opacity: [0.35, 0.9, 0.35] }}
        transition={reduced ? { duration: 0 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />
      {pts.slice(1).map((p, i) => {
        const a = pts[i]
        return (
          <ScorchSmudge
            key={`${p.x}-${p.y}-${i}`}
            x={(a.x + p.x) / 2}
            y={(a.y + p.y) / 2}
            r={7 + (i % 3) * 2.5}
          />
        )
      })}
    </g>
  )
}

/** A soot blot. Two offset ellipses so it never reads as a drawn circle. */
export function ScorchSmudge({ x, y, r = 8 }: { x: number; y: number; r?: number }) {
  return (
    <g aria-hidden opacity="0.75">
      <ellipse cx={x} cy={y} rx={r} ry={r * 0.72} fill="var(--bench-char, #40140c)" opacity="0.8" />
      <ellipse cx={x + r * 0.35} cy={y - r * 0.25} rx={r * 0.6} ry={r * 0.45} fill="#000" opacity="0.5" />
    </g>
  )
}
