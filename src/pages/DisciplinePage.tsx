import { useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { DifficultyBadge } from '@/components/ui/Badge'
import { FieldIntro } from '@/components/flow/FieldIntro'
import { ChallengeList } from '@/components/flow/ChallengeList'
import { SupportingMaterial } from '@/components/flow/SupportingMaterial'
import { getDiscipline } from '@/data/disciplines'
import { useProgress } from '@/hooks/useProgress'
import { accentVars } from '@/lib/accent'
import { NotFoundPage } from '@/pages/NotFoundPage'

/**
 * The field page: what this field is, the three challenges to play, and the
 * supporting material underneath. Every field is reachable; nothing is gated.
 */
export function DisciplinePage() {
  const { slug } = useParams()
  const discipline = getDiscipline(slug)
  const { markDone } = useProgress()

  // The intro is on the page now rather than behind a step, so opening the
  // field is what finishes it. Same key, same shape as before.
  useEffect(() => {
    if (discipline) markDone(discipline.slug, 'intro')
  }, [discipline, markDone])

  if (!discipline) return <NotFoundPage />

  const Icon = discipline.icon

  return (
    <div style={accentVars(discipline.accent)}>
      {/* Field header */}
      <section className="accent-softer paper-grid-lg">
        <div className="mx-auto max-w-4xl px-6 py-8 sm:py-10">
          <Link
            to="/"
            className="-ml-1 inline-flex min-h-11 w-fit items-center gap-1 pr-2 text-sm font-semibold text-ink-soft transition-colors hover:text-ink dark:text-stone-400 dark:hover:text-stone-200"
          >
            <ChevronLeft className="h-4 w-4" />
            All disciplines
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-4">
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

      <div className="mx-auto max-w-4xl space-y-12 px-6 py-10">
        <FieldIntro discipline={discipline} />
        <ChallengeList discipline={discipline} />
        <SupportingMaterial discipline={discipline} />
      </div>
    </div>
  )
}
