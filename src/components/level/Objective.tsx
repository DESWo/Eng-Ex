import { motion } from 'framer-motion'
import { Target } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ObjectiveProps {
  /** The target in plain numbers: "Get the dose to 5 or less on a 90 kg wall". */
  goal: string
  /** Live reading against that target: "12.4 is getting through right now". */
  status?: string
  /** Tests remaining; null = unlimited (chip hidden), undefined = no attempt system. */
  attemptsLeft?: number | null
  /** Flip green only AFTER a successful check, never from live state. */
  met?: boolean
}

/**
 * The one line every game shows above its play area: what winning means, in
 * numbers, next to where the player currently stands. Desmond's rule: nobody
 * should ever win without having known what they were trying to do.
 *
 * Keyed on the goal text, so arriving at a new level replays the entrance and a
 * light sweeps across the banner once. That puts the eye on the objective at
 * the moment it changed, instead of nagging for attention all level long.
 */
export function Objective({ goal, status, attemptsLeft, met }: ObjectiveProps) {
  const urgent = attemptsLeft !== undefined && attemptsLeft !== null && attemptsLeft <= 1 && !met

  return (
    <motion.div
      key={goal}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className={cn(
        'relative mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 overflow-hidden rounded-2xl border-2 px-4 py-2.5',
        met
          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10'
          : 'accent-border accent-soft',
      )}
    >
      {/* One pass of light when the objective is new. */}
      <motion.span
        aria-hidden
        initial={{ x: '-140%' }}
        animate={{ x: '260%' }}
        transition={{ duration: 1.1, ease: 'easeInOut', delay: 0.15 }}
        className="pointer-events-none absolute inset-y-0 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent dark:via-white/10"
      />

      <p className="relative flex items-center gap-2 font-display text-sm font-bold">
        <Target
          className={cn('h-4 w-4 shrink-0', met ? 'text-emerald-600 dark:text-emerald-400' : 'accent-text')}
        />
        {goal}
      </p>
      {status && (
        <p className="relative text-sm font-semibold text-ink-soft dark:text-stone-300">{status}</p>
      )}
      {attemptsLeft !== undefined && attemptsLeft !== null && (
        <motion.span
          // The last test pulses, because that one is worth pausing over.
          animate={urgent ? { scale: [1, 1.07, 1] } : { scale: 1 }}
          transition={urgent ? { duration: 1.4, repeat: Infinity } : { duration: 0.2 }}
          className={cn(
            'relative ml-auto rounded-full px-3 py-1 font-display text-xs font-bold tabular-nums',
            attemptsLeft <= 1
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
              : 'bg-white/70 text-ink dark:bg-white/10 dark:text-stone-200',
          )}
        >
          {attemptsLeft} {attemptsLeft === 1 ? 'test' : 'tests'} left
        </motion.span>
      )}
    </motion.div>
  )
}
