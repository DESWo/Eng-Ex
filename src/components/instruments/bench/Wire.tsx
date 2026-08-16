import { pathFromPts, type Hop, type Pt } from './routing'
import { conductor } from './theme'

export type WireState = 'dead' | 'live' | 'fault'

interface WireProps {
  pts: Pt[]
  hops?: Hop[]
  state?: WireState
  /** Marching dashes along a conductor that is carrying current. */
  flow?: boolean
  /** What activating the wire does, in words, for the screen reader. */
  label?: string
  onActivate?: () => void
}

/**
 * One conductor. Right angles only, hops at every crossing, and the state is in
 * the color: dim ink when dead, amber when carrying, red when it is the fault.
 *
 * The flow overlay reuses the app's `.wire-flow` class, which already stops
 * under prefers-reduced-motion.
 */
export function Wire({ pts, hops = [], state = 'dead', flow = false, label, onActivate }: WireProps) {
  const d = pathFromPts(pts, hops)
  const stroke = conductor[state]
  const interactive = Boolean(onActivate)

  return (
    <g
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={label}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (!onActivate) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
      className={interactive ? 'cursor-pointer outline-none' : undefined}
    >
      {interactive && <path d={d} fill="none" stroke="transparent" strokeWidth="14" />}
      <path d={d} fill="none" stroke={stroke} strokeWidth="2.6" strokeLinejoin="miter" strokeLinecap="butt" />
      {flow && state === 'live' && (
        <path
          d={d}
          fill="none"
          stroke="var(--bench-hot, #fde047)"
          strokeWidth="2.6"
          strokeLinecap="butt"
          className="wire-flow"
        />
      )}
    </g>
  )
}
