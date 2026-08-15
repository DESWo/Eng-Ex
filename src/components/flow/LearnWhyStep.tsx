import { motion } from 'framer-motion'
import { ArrowRight, Check, Factory, Lightbulb, Lock, RotateCcw, Scale } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useLevelCounts } from '@/hooks/useLevelCounts'
import { LEVELS_PER_CHALLENGE } from '@/lib/mastery'
import { loadJson } from '@/lib/storage'
import { staggerContainer } from '@/lib/animations'
import type { Discipline } from '@/lib/types'
import { cn } from '@/lib/utils'

interface LearnWhyStepProps {
  discipline: Discipline
  /** Advances to the "Try it at home" step. */
  onNext: () => void
  onReplay: () => void
}

export function LearnWhyStep({ discipline, onNext, onReplay }: LearnWhyStepProps) {
  const { learn, challenges } = discipline
  const solved = loadJson<Record<string, Record<string, boolean>>>('challenges', {})[discipline.slug] ?? {}
  const levelsFor = useLevelCounts()
  const multi = challenges.length > 1

  return (
    <motion.div
      className="mx-auto max-w-3xl space-y-8"
      variants={staggerContainer}
    >
      <motion.div  className="text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {learn.heading}
        </h2>
        <p className="mt-2 text-ink-soft dark:text-stone-400">
          {multi ? 'The engineering behind each game.' : 'The engineering behind the game.'}
        </p>
      </motion.div>

      {/* one block per game */}
      {challenges.map((challenge) => (
        <motion.div key={challenge.id}  className="space-y-4">
          {multi && (
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full',
                  solved[challenge.id]
                    ? 'accent-bg on-accent'
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
              {!solved[challenge.id] ? (
                <span className="text-xs font-semibold text-ink-soft dark:text-stone-500">
                  (not played yet)
                </span>
              ) : levelsFor(challenge.id) >= LEVELS_PER_CHALLENGE ? (
                <span className="accent-text text-xs font-semibold">(all levels cleared)</span>
              ) : levelsFor(challenge.id) > 0 ? (
                <span className="text-xs font-semibold text-ink-soft dark:text-stone-500">
                  ({levelsFor(challenge.id)}/{LEVELS_PER_CHALLENGE} levels)
                </span>
              ) : null}
            </div>
          )}
          {/* the explanation stays locked until the game is beaten */}
          {multi && !solved[challenge.id] ? (
            <Card className="flex items-center gap-3 border-2 border-dashed border-stone-300 bg-stone-50/60 p-6 dark:border-white/15 dark:bg-white/[0.02]">
              <Lock className="h-4 w-4 shrink-0 text-ink-soft dark:text-stone-400" />
              <p className="text-sm text-ink-soft dark:text-stone-400">
                Beat a level of {challenge.title} to unlock the idea behind it.
              </p>
            </Card>
          ) : (
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
          )}
        </motion.div>
      ))}

      <motion.div >
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

      <motion.div >
        <Card className="flex items-start gap-4 p-6">
          <span className="accent-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
            <Scale className="accent-text h-6 w-6" />
          </span>
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft dark:text-stone-400">
              The tradeoff
            </p>
            <p className="mt-1.5 text-[15px] leading-relaxed">{learn.tradeoff}</p>
          </div>
        </Card>
      </motion.div>

      <motion.div >
        <Card className="border-2 accent-border p-6">
          <p className="accent-text flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest">
            <Factory className="h-4 w-4" />
            Real-world application
          </p>
          <p className="mt-2 font-display text-lg font-semibold leading-snug">{learn.realWorld.intro}</p>
          <ul className="mt-3 space-y-2">
            {learn.realWorld.examples.map((example) => (
              <li key={example} className="flex gap-2.5 text-[15px] leading-relaxed">
                <span className="accent-text mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full accent-bg" />
                {example}
              </li>
            ))}
          </ul>
        </Card>
      </motion.div>

      <motion.div  className="flex flex-wrap justify-center gap-3 pb-4">
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
