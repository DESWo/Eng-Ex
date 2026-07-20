import { Trophy } from 'lucide-react'
import { Meter } from '@/components/ui/Meter'
import type { LevelMetric } from '@/lib/types'

interface ScorecardProps {
  metrics: LevelMetric[]
  /** Live value for each metric id, from the current design. */
  values: Record<string, number>
  /** Best value the player has ever recorded for each metric id. */
  best: Record<string, number>
  /**
   * True once the level has actually been solved. Until then the numbers are
   * only a preview: a design that has not run yet trivially "passes" every
   * minimize goal, so scoring it would be a lie.
   */
  scored: boolean
}

const passes = (m: LevelMetric, v: number) => (m.goal === 'min' ? v <= m.target : v >= m.target)

/**
 * Level 5 only. Three competing goals with par marked on each bar, plus the
 * player's own best, so beating your last design is the thing to chase.
 */
export function Scorecard({ metrics, values, best, scored }: ScorecardProps) {
  const met = metrics.filter((m) => values[m.id] !== undefined && passes(m, values[m.id])).length

  return (
    <div className="rounded-2xl bg-stone-100 p-4 dark:bg-white/5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-display text-sm font-bold">Optimization targets</p>
        <span className="font-display text-sm font-semibold tabular-nums text-ink-soft dark:text-stone-400">
          {scored ? `${met} of ${metrics.length} at par` : 'Solve it to score'}
        </span>
      </div>

      <div className="space-y-3">
        {metrics.map((m) => {
          const value = values[m.id] ?? 0
          const scaleMax = m.goal === 'min' ? m.target * 2 : m.target * 1.25
          const ok = passes(m, value)
          const bestValue = best[m.id]
          const unit = m.unit ?? ''
          return (
            <div key={m.id}>
              <Meter
                label={m.label}
                display={`${Math.round(value)}${unit}, par ${Math.round(m.target)}${unit}`}
                fraction={scaleMax > 0 ? value / scaleMax : 0}
                markerFraction={scaleMax > 0 ? m.target / scaleMax : 0}
                barClass={!scored ? 'accent-bg' : ok ? 'bg-emerald-500' : 'bg-amber-500'}
              />
              {bestValue !== undefined && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft dark:text-stone-400">
                  <Trophy className="h-3 w-3" />
                  Your best: <span className="font-semibold tabular-nums">{Math.round(bestValue)}{unit}</span>
                </p>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-xs text-ink-soft dark:text-stone-400">
        The black line is par. No single design hits every target, so try a few and keep the one you like best.
      </p>
    </div>
  )
}
