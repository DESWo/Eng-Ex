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
 */
export function Objective({ goal, status, attemptsLeft, met }: ObjectiveProps) {
  return (
    <div
      className={cn(
        'mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border-2 px-4 py-2.5',
        met
          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10'
          : 'accent-border accent-soft',
      )}
    >
      <p className="flex items-center gap-2 font-display text-sm font-bold">
        <Target className={cn('h-4 w-4 shrink-0', met ? 'text-emerald-600 dark:text-emerald-400' : 'accent-text')} />
        {goal}
      </p>
      {status && (
        <p className="text-sm font-semibold text-ink-soft dark:text-stone-300">{status}</p>
      )}
      {attemptsLeft !== undefined && attemptsLeft !== null && (
        <span
          className={cn(
            'ml-auto rounded-full px-3 py-1 font-display text-xs font-bold tabular-nums',
            attemptsLeft <= 1
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
              : 'bg-white/70 text-ink dark:bg-white/10 dark:text-stone-200',
          )}
        >
          {attemptsLeft} {attemptsLeft === 1 ? 'test' : 'tests'} left
        </span>
      )}
    </div>
  )
}
