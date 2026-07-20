import { Check, Lock } from 'lucide-react'
import type { ChallengeLevel } from '@/lib/types'
import { PHASE_META } from './levelMeta'
import { cn } from '@/lib/utils'

interface LevelRailProps {
  levels: ChallengeLevel<unknown>[]
  /** Level number currently on screen. */
  current: number
  unlockedThrough: number
  isCleared: (n: number) => boolean
  onPick: (n: number) => void
}

/**
 * The five level stepper that sits above every challenge.
 * Cleared levels stay clickable so a student can revisit an early design
 * once a later level has taught them something new.
 */
export function LevelRail({ levels, current, unlockedThrough, isCleared, onPick }: LevelRailProps) {
  const active = levels.find((l) => l.n === current) ?? levels[0]

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {levels.map((l) => {
          const cleared = isCleared(l.n)
          const locked = l.n > unlockedThrough
          const isActive = l.n === current
          return (
            <button
              key={l.n}
              type="button"
              disabled={locked}
              onClick={() => onPick(l.n)}
              aria-current={isActive ? 'step' : undefined}
              aria-label={locked ? `Level ${l.n}, locked` : `Level ${l.n}: ${l.concept}`}
              title={locked ? 'Clear the level before this one to unlock' : l.concept}
              className={cn(
                'flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-3',
                'font-display text-sm font-bold tabular-nums transition-colors duration-200',
                isActive && 'accent-bg text-white shadow-clay',
                !isActive && cleared && 'accent-soft accent-text hover:brightness-105',
                !isActive &&
                  !cleared &&
                  !locked &&
                  'bg-stone-100 text-ink-soft hover:bg-stone-200 dark:bg-white/5 dark:text-stone-400 dark:hover:bg-white/10',
                locked && 'cursor-not-allowed bg-stone-100 text-stone-400 dark:bg-white/5 dark:text-stone-600',
              )}
            >
              {locked ? (
                <Lock className="h-3.5 w-3.5" />
              ) : cleared && !isActive ? (
                <Check className="h-4 w-4" />
              ) : (
                l.n
              )}
            </button>
          )
        })}

        <span
          className={cn(
            'ml-1 rounded-full px-2.5 py-1 font-display text-xs font-semibold',
            PHASE_META[active.phase].chip,
          )}
        >
          {PHASE_META[active.phase].label}
        </span>
      </div>

      <p className="mt-2 text-sm text-ink-soft dark:text-stone-400">
        <span className="font-display font-semibold text-ink dark:text-stone-200">
          Level {active.n}: {active.title}
        </span>{' '}
        &middot; {active.concept}
      </p>
    </div>
  )
}
