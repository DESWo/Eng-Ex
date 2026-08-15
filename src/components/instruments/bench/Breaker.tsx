import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { benchLabel } from './theme'

export type BreakerState = 'closed' | 'open' | 'tripped'

interface BreakerProps {
  state: BreakerState
  /** Throwing the handle. Not called while disabled. */
  onThrow: () => void
  /** Silkscreen under the module: "main", "circuit a". */
  label: string
  /** What the breaker is rated at: "15 A". */
  rating?: string
  disabled?: boolean
  className?: string
}

const POSITION: Record<BreakerState, number> = { closed: -18, tripped: 0, open: 18 }
const WORD: Record<BreakerState, string> = { closed: 'on', tripped: 'tripped', open: 'off' }

/**
 * A breaker handle that physically throws. Three positions, and the middle one
 * is not a choice a student makes: it means the breaker opened on its own, with
 * the trip flag out to say so.
 *
 * This is the bench's commit control. Throwing it is how a design gets tested,
 * and a trip is how the bench says no.
 */
export function BreakerHandle({ state, onThrow, label, rating, disabled, className }: BreakerProps) {
  const reduced = useReducedMotion()
  const tripped = state === 'tripped'
  const tone = tripped
    ? 'var(--bench-fault, #ff6b5c)'
    : state === 'closed'
      ? 'var(--bench-live, #f6bf4a)'
      : 'var(--bench-dim, #a29b93)'

  return (
    <button
      type="button"
      onClick={() => !disabled && onThrow()}
      disabled={disabled}
      aria-label={`${label} breaker, ${WORD[state]}${rating ? `, rated ${rating}` : ''}. Throw it to test the circuit.`}
      className={cn(
        'group flex flex-col items-center gap-1.5 rounded-xl border p-3 outline-none',
        'border-[var(--bench-edge,rgba(255,255,255,0.13))] bg-[var(--bench-recess,#131218)]',
        'transition-[filter] duration-150 hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
    >
      <span className={cn(benchLabel, 'text-[var(--bench-dim,#a29b93)]')}>{label}</span>

      <svg viewBox="0 0 76 116" className="h-24 w-16" aria-hidden>
        {/* module body */}
        <rect x="8" y="4" width="60" height="108" rx="6" fill="var(--bench-face, #1c1a22)" stroke="var(--bench-edge, rgba(255,255,255,0.13))" strokeWidth="1.5" />
        {/* handle slot */}
        <rect x="26" y="24" width="24" height="68" rx="12" fill="#000" opacity="0.55" />
        {/* on / off silkscreen */}
        <text x="58" y="34" fontSize="9" className="font-mono" fill="var(--bench-dim, #a29b93)" textAnchor="middle">
          I
        </text>
        <text x="58" y="90" fontSize="9" className="font-mono" fill="var(--bench-dim, #a29b93)" textAnchor="middle">
          O
        </text>

        <motion.g
          animate={{ y: POSITION[state] }}
          initial={false}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 700, damping: 26 }}
        >
          <rect x="22" y="46" width="32" height="24" rx="5" fill={tone} />
          <rect x="27" y="52" width="22" height="3" rx="1.5" fill="#000" opacity="0.35" />
          <rect x="27" y="59" width="22" height="3" rx="1.5" fill="#000" opacity="0.35" />
        </motion.g>

        {/* trip flag pops out of its window when the breaker opened on its own */}
        {tripped && (
          <motion.g
            initial={reduced ? false : { x: -14, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          >
            <rect x="10" y="8" width="56" height="16" rx="3" fill="var(--bench-fault, #ff6b5c)" />
            <text x="38" y="20" textAnchor="middle" fontSize="10" letterSpacing="2" className="font-mono" fill="#2b0a06">
              TRIP
            </text>
          </motion.g>
        )}
      </svg>

      <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: tone }}>
        {WORD[state]}
        {rating ? ` · ${rating}` : ''}
      </span>
    </button>
  )
}
