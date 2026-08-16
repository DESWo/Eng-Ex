import { BriefcaseBusiness } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useLevelCounts } from '@/hooks/useLevelCounts'
import type { Discipline } from '@/lib/types'

/**
 * The explanation for one game, shown once the player has cleared a level of
 * it. The why-points are this challenge's own, and the real job line moved
 * here from the pre-game screen: it reads as a payoff rather than a preamble.
 *
 * It appears on its own because useLevelCounts re-reads ee:levels whenever a
 * game saves, so the host does not have to tell it a level was cleared.
 */
export function PostLevelWhy({
  discipline,
  challengeId,
}: {
  discipline: Discipline
  challengeId: string
}) {
  const levelsFor = useLevelCounts()
  const challenge = discipline.challenges.find((c) => c.id === challengeId)

  if (!challenge || levelsFor(challengeId) === 0) return null

  return (
    <Card className="p-5 sm:p-6">
      {/* Reads true whenever it is re-read, not just in the moment after a clear. */}
      <h2 className="font-display text-lg font-bold tracking-tight">Why that worked</h2>

      <ul className="mt-4 space-y-4">
        {challenge.why.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3">
            <span className="accent-soft flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl">
              <Icon aria-hidden className="accent-text h-4 w-4" />
            </span>
            <div>
              <p className="font-display text-sm font-bold">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft dark:text-stone-400">
                {body}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-5 flex items-start gap-2 border-t border-stone-200/70 pt-4 text-sm text-ink-soft dark:border-white/10 dark:text-stone-400">
        <BriefcaseBusiness aria-hidden className="accent-text mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <span className="font-display font-semibold">The real job:</span> {challenge.realJob}
        </span>
      </p>
    </Card>
  )
}
