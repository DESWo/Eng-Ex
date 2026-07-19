import type { CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { DifficultyBadge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { Discipline } from '@/lib/types'

interface DisciplineCardProps {
  discipline: Discipline
  /** 0 to 100, read from saved progress. */
  percent: number
}

export function DisciplineCard({ discipline, percent }: DisciplineCardProps) {
  const Icon = discipline.icon
  const cta = percent === 0 ? 'Start exploring' : percent === 100 ? 'Explore again' : 'Keep going'

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
              {percent === 100 && (
                <CheckCircle2 aria-label="Completed" className="h-5 w-5 text-emerald-500" />
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
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-ink-soft dark:text-stone-400">
              <span>Explored</span>
              <span className="tabular-nums">{percent}%</span>
            </div>
            <ProgressBar value={percent} label={`${discipline.name} progress`} />
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
