import type { CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { Check, Compass, Lock, Sparkles } from 'lucide-react'
import { DisciplineCard } from '@/components/landing/DisciplineCard'
import { Card } from '@/components/ui/Card'
import { disciplines } from '@/data/disciplines'
import { useProgress } from '@/hooks/useProgress'
import { fadeUp, staggerContainer } from '@/lib/animations'
import type { Discipline } from '@/lib/types'
import { cn } from '@/lib/utils'

const gridMotion = {
  variants: staggerContainer,
  initial: 'hidden' as const,
  whileInView: 'show' as const,
  viewport: { once: true, margin: '-60px' },
}

function Grid({ items, percentFor }: { items: Discipline[]; percentFor: (slug: string) => number }) {
  return (
    <motion.div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" {...gridMotion}>
      {items.map((discipline) => (
        <motion.div key={discipline.slug} variants={fadeUp} className="h-full">
          <DisciplineCard discipline={discipline} percent={percentFor(discipline.slug)} />
        </motion.div>
      ))}
    </motion.div>
  )
}

/** Shown while the deeper fields are still locked. */
function LockedMore({
  core,
  doneCount,
  percentFor,
}: {
  core: Discipline[]
  doneCount: number
  percentFor: (slug: string) => number
}) {
  return (
    <motion.div
      className="mt-20"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <Card className="border-2 border-dashed border-stone-300 bg-stone-50/60 p-8 text-center dark:border-white/15 dark:bg-white/[0.02] sm:p-12">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-200 dark:bg-white/10">
          <Lock className="h-8 w-8 text-ink-soft dark:text-stone-300" />
        </span>
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Go deeper into engineering
        </h2>
        <p className="mx-auto mt-3 max-w-md text-ink-soft dark:text-stone-400">
          Finish the three core fields first. Then four more unlock: Nuclear, Aerospace, Industrial,
          and Systems.
        </p>

        {/* progress toward the unlock */}
        <div className="mx-auto mt-6 flex max-w-md flex-wrap items-center justify-center gap-2">
          {core.map((d) => {
            const done = percentFor(d.slug) === 100
            const Icon = d.icon
            return (
              <span
                key={d.slug}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-display text-sm font-semibold',
                  done
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-stone-200 text-ink-soft dark:bg-white/10 dark:text-stone-400',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                {d.shortName}
              </span>
            )
          })}
        </div>
        <p className="mt-4 font-display text-sm font-bold text-ink-soft dark:text-stone-400">
          {doneCount} of {core.length} complete
        </p>
      </Card>
    </motion.div>
  )
}

/** Shown once every core field is finished: branches grouped under each core parent. */
function UnlockedMore({
  core,
  more,
  percentFor,
}: {
  core: Discipline[]
  more: Discipline[]
  percentFor: (slug: string) => number
}) {
  return (
    <>
      <div className="mb-4 mt-20 text-center">
        <motion.span
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 font-display text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
        >
          <Sparkles className="h-4 w-4" />
          Unlocked
        </motion.span>
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Go deeper into engineering
        </h2>
        <p className="mt-3 text-ink-soft dark:text-stone-400">
          Every field splits into branches. Here are the big ones under each core field.
        </p>
      </div>

      <div className="space-y-14">
        {core.map((parent) => {
          const branches = more.filter((d) => d.parent === parent.slug)
          if (branches.length === 0) return null
          const ParentIcon = parent.icon
          return (
            <div key={parent.slug}>
              <div className="mb-6 flex items-center gap-3">
                <span
                  className="accent-soft flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ '--accent': parent.accent } as CSSProperties}
                >
                  <ParentIcon className="accent-text h-6 w-6" />
                </span>
                <div>
                  <p className="font-display text-lg font-bold tracking-tight">
                    Branches of {parent.shortName}
                  </p>
                  <p className="text-sm text-ink-soft dark:text-stone-400">
                    Fields that grow out of {parent.name.toLowerCase()}.
                  </p>
                </div>
              </div>
              <Grid items={branches} percentFor={percentFor} />
            </div>
          )
        })}
      </div>
    </>
  )
}

export function DisciplineGrid() {
  const { percentFor } = useProgress()

  const core = disciplines.filter((d) => d.tier !== 'more')
  const more = disciplines.filter((d) => d.tier === 'more')
  const doneCount = core.filter((d) => percentFor(d.slug) === 100).length
  const unlocked = doneCount === core.length

  return (
    <section id="disciplines" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16">
      <div className="mb-10 text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-stone-900/5 px-4 py-1.5 font-display text-sm font-semibold text-ink-soft dark:bg-white/10 dark:text-stone-300">
          <Compass className="h-4 w-4" />
          Start here
        </span>
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Pick your first adventure
        </h2>
        <p className="mt-3 text-ink-soft dark:text-stone-400">
          Three core fields, nine challenges, zero tests.
        </p>
      </div>

      <Grid items={core} percentFor={percentFor} />

      {more.length > 0 &&
        (unlocked ? (
          <UnlockedMore core={core} more={more} percentFor={percentFor} />
        ) : (
          <LockedMore core={core} doneCount={doneCount} percentFor={percentFor} />
        ))}

      <p className="mt-16 flex items-center justify-center gap-2 text-center text-sm text-ink-soft dark:text-stone-400">
        <Sparkles className="h-4 w-4 shrink-0" />
        Even more on the way: chemical, biomedical, software, and beyond.
      </p>
    </section>
  )
}
