import { motion } from 'framer-motion'
import { ArrowRight, Check, Heart, Lightbulb, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { loadJson } from '@/lib/storage'
import { fadeUp, staggerContainer } from '@/lib/animations'
import type { Discipline, Reflection } from '@/lib/types'
import { cn } from '@/lib/utils'

interface LearnWhyStepProps {
  discipline: Discipline
  /** Advances to the "Try it at home" step. */
  onNext: () => void
  onReplay: () => void
}

export function LearnWhyStep({ discipline, onNext, onReplay }: LearnWhyStepProps) {
  const { learn, challenges } = discipline
  const reflection = loadJson<Record<string, Reflection>>('reflections', {})[discipline.slug]
  const solved = loadJson<Record<string, Record<string, boolean>>>('challenges', {})[discipline.slug] ?? {}
  const multi = challenges.length > 1

  return (
    <motion.div
      className="mx-auto max-w-3xl space-y-8"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUp} className="text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {learn.heading}
        </h2>
        <p className="mt-2 text-ink-soft dark:text-stone-400">
          {multi
            ? 'Here is the engineering hiding inside each game.'
            : 'Here is the engineering hiding inside your win.'}
        </p>
      </motion.div>

      {/* One block per game, so every challenge gets explained. */}
      {challenges.map((challenge) => (
        <motion.div key={challenge.id} variants={fadeUp} className="space-y-4">
          {multi && (
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full',
                  solved[challenge.id]
                    ? 'accent-bg text-white'
                    : 'bg-stone-200 text-ink-soft dark:bg-white/10 dark:text-stone-400',
                )}
              >
                {solved[challenge.id] ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-current" />
                )}
              </span>
              <h3 className="font-display text-lg font-bold">{challenge.title}</h3>
              {!solved[challenge.id] && (
                <span className="text-xs font-semibold text-ink-soft dark:text-stone-500">
                  (not played yet)
                </span>
              )}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            {challenge.why.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="h-full p-6">
                <span className="accent-soft mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
                  <Icon className="accent-text h-6 w-6" />
                </span>
                <h4 className="font-display font-bold">{title}</h4>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft dark:text-stone-400">
                  {body}
                </p>
              </Card>
            ))}
          </div>
        </motion.div>
      ))}

      <motion.div variants={fadeUp}>
        <Card className="accent-soft flex items-start gap-4 p-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-clay dark:bg-night-panel">
            <Lightbulb className="accent-text h-6 w-6" />
          </span>
          <div>
            <p className="accent-text font-display text-xs font-bold uppercase tracking-widest">
              The big idea
            </p>
            <p className="mt-1.5 font-display text-lg font-semibold leading-snug">{learn.bigIdea}</p>
          </div>
        </Card>
      </motion.div>

      {reflection?.enjoyed === 'loved' && (
        <motion.div variants={fadeUp}>
          <Card className="flex items-center gap-3 p-5">
            <Heart className="h-5 w-5 shrink-0 text-rose-500" fill="currentColor" />
            <p className="text-[15px]">
              You said you loved this one.{' '}
              <span className="font-display font-bold">{discipline.name.toLowerCase()}</span> might
              be your thing!
            </p>
          </Card>
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-3 pb-4">
        <Button variant="accent" size="lg" onClick={onNext}>
          Next: try it at home
          <ArrowRight className="h-5 w-5" />
        </Button>
        <Button variant="soft" size="lg" onClick={onReplay}>
          <RotateCcw className="h-5 w-5" />
          {multi ? 'Back to the games' : 'Replay the challenge'}
        </Button>
      </motion.div>
    </motion.div>
  )
}
