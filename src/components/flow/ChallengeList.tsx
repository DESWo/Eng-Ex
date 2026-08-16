import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { challengeRegistry } from '@/challenges/registry'
import { useLevelCounts } from '@/hooks/useLevelCounts'
import { LEVELS_PER_CHALLENGE } from '@/lib/mastery'
import type { Discipline } from '@/lib/types'

/**
 * The three games, as the main thing on the field page. Each one links
 * straight into game mode; nothing here gates anything.
 */
export function ChallengeList({ discipline }: { discipline: Discipline }) {
  const levelsFor = useLevelCounts()

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {discipline.challenges.map((challenge) => {
        const cleared = levelsFor(challenge.id)
        // Downloading the game chunk on hover or focus means the click has
        // less to wait for. Same trick the old picker chips used.
        const preload = () => challengeRegistry[challenge.id]?.preload()

        return (
          <li key={challenge.id}>
            <Link
              to={`/explore/${discipline.slug}/${challenge.id}`}
              onMouseEnter={preload}
              onFocus={preload}
              className="block h-full rounded-3xl"
            >
              <Card interactive className="flex h-full flex-col p-5">
                <h3 className="font-display text-lg font-bold tracking-tight">
                  {challenge.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft dark:text-stone-400">
                  {challenge.goal}
                </p>
                <p className="mt-auto flex items-center gap-1.5 pt-5 font-mono text-xs tabular-nums text-ink-soft dark:text-stone-500">
                  {cleared >= LEVELS_PER_CHALLENGE && (
                    <Check aria-hidden className="accent-text h-3.5 w-3.5" />
                  )}
                  {cleared} / {LEVELS_PER_CHALLENGE} levels
                </p>
              </Card>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
