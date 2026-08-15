import { Check, Lock, Star } from 'lucide-react'
import type { ChallengeLevel } from '@/lib/types'
import { PHASE_META } from './levelMeta'
import { Stars } from './Stars'
import { cn } from '@/lib/utils'

interface LevelRailProps {
  levels: ChallengeLevel<unknown>[]
  /** Level number currently on screen. */
  current: number
  unlockedThrough: number
  isCleared: (n: number) => boolean
  onPick: (n: number) => void
  /** Best stars earned per level, 0 when never cleared. */
  starsFor: (n: number) => number
}

/**
 * The five level stepper that sits above every challenge.
 * Cleared levels stay clickable so a student can revisit an early design
 * once a later level has taught them something new.
 */
export function LevelRail({
  levels,
  current,
  unlockedThrough,
  isCleared,
  onPick,
  starsFor,
}: LevelRailProps) {
  const active = levels.find((l) => l.n === current) ?? levels[0]
  const earned = levels.reduce((sum, l) => sum + starsFor(l.n), 0)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
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
              aria-label={
                locked
                  ? `Level ${l.n}, locked`
                  : `Level ${l.n}: ${l.title}${cleared ? `, ${starsFor(l.n)} of 3 stars` : ''}`
              }
              title={locked ? 'Clear the level before this one to unlock' : l.title}
              className={cn(
                // 44px square minimum: these are the most tapped controls in the
                // app and most of the audience is on an iPad, not a mouse.
                'flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3',
                'text-sm font-bold font-mono tabular-nums transition-colors duration-200',
                isActive && 'accent-bg on-accent shadow-clay',
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

        {earned > 0 && (
          <span className="ml-auto flex items-center gap-1.5 font-mono text-xs font-bold tabular-nums text-ink-soft dark:text-stone-400">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
            {earned}/{levels.length * 3}
          </span>
        )}
      </div>

      {/* title only, not the concept: that would give the level away */}
      <p className="mt-2 flex items-center gap-2 text-sm text-ink-soft dark:text-stone-400">
        <span className="font-display font-semibold text-ink dark:text-stone-200">
          Level {active.n}: {active.title}
        </span>
        {isCleared(active.n) && <Stars earned={starsFor(active.n)} size="xs" />}
      </p>
    </div>
  )
}
