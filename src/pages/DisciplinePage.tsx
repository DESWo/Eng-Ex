import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, Lock } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DifficultyBadge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { FlowStepper } from '@/components/flow/FlowStepper'
import { IntroStep } from '@/components/flow/IntroStep'
import { ChallengeStep } from '@/components/flow/ChallengeStep'
import { ReflectionStep } from '@/components/flow/ReflectionStep'
import { LearnWhyStep } from '@/components/flow/LearnWhyStep'
import { DiyStep } from '@/components/flow/DiyStep'
import { disciplines, getDiscipline } from '@/data/disciplines'
import { useProgress } from '@/hooks/useProgress'
import type { Discipline, StepId } from '@/lib/types'
import { NotFoundPage } from '@/pages/NotFoundPage'

/** Shown when a deeper field is opened before the core fields are finished. */
function LockedField({ discipline }: { discipline: Discipline }) {
  return (
    <div
      style={{ '--accent': discipline.accent } as CSSProperties}
      className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center"
    >
      <span className="accent-soft mb-6 flex h-20 w-20 items-center justify-center rounded-3xl">
        <Lock className="accent-text h-10 w-10" />
      </span>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        {discipline.name} is locked
      </h1>
      <p className="mt-3 text-ink-soft dark:text-stone-400">
        Finish the three core fields first: Mechanical, Civil, and Electrical. Then the deeper
        disciplines open up.
      </p>
      <ButtonLink to="/" className="mt-8">
        Back to the core fields
      </ButtonLink>
    </div>
  )
}

export function DisciplinePage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const discipline = getDiscipline(slug)
  const { markDone, isDone, percentFor, nextStepFor } = useProgress()

  // Resume where the visitor left off. A fully completed discipline starts over.
  const [step, setStep] = useState<StepId>(() => {
    if (!discipline) return 'intro'
    return percentFor(discipline.slug) === 100 ? 'intro' : nextStepFor(discipline.slug)
  })

  // Arriving at "Why it works" or "Try it at home" counts as finishing them.
  useEffect(() => {
    if (discipline && (step === 'learn' || step === 'diy')) markDone(discipline.slug, step)
  }, [discipline, step, markDone])

  const goTo = (next: StepId) => {
    setStep(next)
    window.scrollTo({ top: 0 })
  }

  if (!discipline) return <NotFoundPage />

  // Deeper fields stay locked until every core field is 100% complete.
  if (discipline.tier === 'more') {
    const coreDone = disciplines
      .filter((d) => d.tier !== 'more')
      .every((d) => percentFor(d.slug) === 100)
    if (!coreDone) return <LockedField discipline={discipline} />
  }

  const Icon = discipline.icon

  return (
    <div style={{ '--accent': discipline.accent } as CSSProperties}>
      {/* Discipline header */}
      <section className="accent-softer">
        <div className="mx-auto max-w-4xl px-6 py-8 sm:py-10">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft transition-colors hover:text-ink dark:text-stone-400 dark:hover:text-stone-200"
          >
            <ChevronLeft className="h-4 w-4" />
            All disciplines
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <span className="accent-soft flex h-16 w-16 items-center justify-center rounded-2xl shadow-clay">
              <Icon className="accent-text h-8 w-8" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                {discipline.name}
              </h1>
              <p className="mt-1 text-ink-soft dark:text-stone-400">{discipline.tagline}</p>
            </div>
            <DifficultyBadge level={discipline.difficulty} />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <FlowStepper
          current={step}
          isDone={(s) => isDone(discipline.slug, s)}
          onSelect={goTo}
        />

        <div className="mt-10">
          {/*
           * A keyed motion.div (no AnimatePresence) remounts on every step
           * change and replays its enter animation. This can never wedge the
           * way `AnimatePresence mode="wait"` can if an exit callback is missed.
           */}
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {step === 'intro' && (
                <IntroStep
                  discipline={discipline}
                  onNext={() => {
                    markDone(discipline.slug, 'intro')
                    goTo('challenge')
                  }}
                />
              )}
              {step === 'challenge' && (
                <ChallengeStep
                  discipline={discipline}
                  onSolved={() => markDone(discipline.slug, 'challenge')}
                  onNext={() => goTo('reflection')}
                />
              )}
              {step === 'reflection' && (
                <ReflectionStep
                  discipline={discipline}
                  onNext={() => {
                    markDone(discipline.slug, 'reflection')
                    goTo('learn')
                  }}
                />
              )}
              {step === 'learn' && (
                <LearnWhyStep
                  discipline={discipline}
                  onNext={() => goTo('diy')}
                  onReplay={() => goTo('challenge')}
                />
              )}
              {step === 'diy' && (
                <DiyStep
                  discipline={discipline}
                  onExploreMore={() => navigate('/')}
                  onReplay={() => goTo('challenge')}
                />
              )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
