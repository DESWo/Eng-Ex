import type { CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { DifficultyBadge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { masteryFor, TIER_LABEL } from '@/lib/mastery'
import { cn } from '@/lib/utils'
import type { Discipline } from '@/lib/types'

interface DisciplineCardProps {
  discipline: Discipline
  /** 0 to 100, read from saved progress. */
}

export function DisciplineCard({ discipline }: DisciplineCardProps) {
  const mastery = masteryFor(discipline)
  const Icon = discipline.icon
  const cta = mastery.cleared === 0 ? 'Start exploring' : mastery.tier === 'mastered' ? 'Explore again' : 'Keep going'

  return (
    <Link
      to={`/explore/${discipline.slug}`}
      className="group block h-full"
      style={{ '--accent': discipline.accent } as CSSProperties}
    >
      <motion.div
        whileHover={{ y: -6 }}
        transition={{ type: 'spring', stiffness: 350, damping: 22 }}
        className="h-full"
      >
        <Card interactive className="flex h-full flex-col gap-4 p-6">
          <div className="flex items-start justify-between">
            <span className="accent-soft flex h-14 w-14 items-center justify-center rounded-2xl">
              <Icon className="accent-text h-7 w-7" />
            </span>
            <div className="flex items-center gap-2">
              {mastery.tier === 'mastered' && (
                <CheckCircle2 aria-label="Mastered" className="h-5 w-5 text-emerald-500" />
              )}
              <DifficultyBadge level={discipline.difficulty} />
            </div>
          </div>

          <div className="flex-1">
            <h3 className="font-display text-xl font-bold">{discipline.name}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft dark:text-stone-400">
              {discipline.description}
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5',
                  mastery.tier === 'mastered'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : mastery.tier === 'solid'
                      ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300'
                      : mastery.tier === 'explored'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                        : 'bg-stone-100 text-ink-soft dark:bg-white/10 dark:text-stone-400',
                )}
              >
                {TIER_LABEL[mastery.tier]}
              </span>
              <span className="tabular-nums text-ink-soft dark:text-stone-400">
                {mastery.cleared} / {mastery.total} levels
              </span>
            </div>
            {/* The bar tracks levels cleared, so it can no longer read full
                while the field is untouched. */}
            <ProgressBar
              value={Math.round((mastery.cleared / mastery.total) * 100)}
              label={`${discipline.name} progress`}
            />
          </div>

          <span className="accent-text flex items-center gap-1 font-display text-sm font-bold">
            {cta}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </span>
        </Card>
      </motion.div>
    </Link>
  )
}
