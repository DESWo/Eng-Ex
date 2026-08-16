import { Suspense, useCallback } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { PostLevelWhy } from '@/components/flow/PostLevelWhy'
import { challengeRegistry } from '@/challenges/registry'
import { getDiscipline } from '@/data/disciplines'
import { useLevelCounts } from '@/hooks/useLevelCounts'
import { useProgress } from '@/hooks/useProgress'
import { accentVars } from '@/lib/accent'
import { LEVELS_PER_CHALLENGE } from '@/lib/mastery'
import { loadJson, saveJson } from '@/lib/storage'
import { NotFoundPage } from '@/pages/NotFoundPage'

/** slug -> which of that discipline's challenges have been solved. */
type SolvedMap = Record<string, Record<string, boolean>>

/**
 * Game mode. The simulation owns the screen: the only chrome above it is a way
 * back to the field, the challenge title, and how deep the player has got.
 * Everything else about the level (the objective line, the rail, the concept
 * card) is rendered by the challenge itself.
 */
export function ChallengePage() {
  const { slug, challengeId } = useParams()
  const discipline = getDiscipline(slug)
  const challenge = discipline?.challenges.find((c) => c.id === challengeId)
  const levelsFor = useLevelCounts()
  const { markDone } = useProgress()

  // Solving a game still writes the same two keys it always did: the per
  // discipline solved map, and the 'challenge' step in ee:progress.
  const handleComplete = useCallback(() => {
    if (!discipline || !challenge) return
    const all = loadJson<SolvedMap>('challenges', {})
    saveJson('challenges', {
      ...all,
      [discipline.slug]: { ...all[discipline.slug], [challenge.id]: true },
    })
    markDone(discipline.slug, 'challenge')
  }, [discipline, challenge, markDone])

  if (!discipline || !challenge) return <NotFoundPage />

  const ChallengeComponent = challengeRegistry[challenge.id]?.Component
  const cleared = levelsFor(challenge.id)

  return (
    <div style={accentVars(discipline.accent)} className="mx-auto max-w-4xl px-6 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            to={`/explore/${discipline.slug}`}
            className="-ml-1 inline-flex min-h-11 w-fit items-center gap-1 pr-2 text-sm font-semibold text-ink-soft transition-colors hover:text-ink dark:text-stone-400 dark:hover:text-stone-200"
          >
            <ChevronLeft className="h-4 w-4" />
            {discipline.shortName}
          </Link>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            {challenge.title}
          </h1>
        </div>
        <p
          aria-live="polite"
          className="font-mono text-sm tabular-nums text-ink-soft dark:text-stone-400"
        >
          {cleared} / {LEVELS_PER_CHALLENGE} levels
        </p>
      </div>

      <div className="mt-5">
        {ChallengeComponent ? (
          // Keyed by game so a chunk that failed to download only marks THIS
          // game broken; going back and picking another still works.
          <ErrorBoundary
            key={challenge.id}
            fallback={() => (
              <Card className="space-y-4 p-8 text-center">
                <p className="font-display font-semibold">This game did not load.</p>
                <p className="text-sm text-ink-soft dark:text-stone-400">
                  That usually means the app was updated while this tab was open. A quick
                  reload picks up the new version; your progress is saved.
                </p>
                <Button variant="accent" onClick={() => window.location.reload()}>
                  Reload the page
                </Button>
              </Card>
            )}
          >
            {/* games are lazy chunks */}
            <Suspense
              fallback={
                <Card className="flex h-64 animate-pulse items-center justify-center text-ink-soft dark:text-stone-400">
                  Setting up the lab…
                </Card>
              }
            >
              {/* keyed so switching challenges remounts */}
              <ChallengeComponent key={challenge.id} onComplete={handleComplete} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <Card className="p-8 text-center text-ink-soft dark:text-stone-400">
            This challenge is not built yet.
          </Card>
        )}
      </div>

      <div className="mt-6">
        <PostLevelWhy discipline={discipline} challengeId={challenge.id} />
      </div>
    </div>
  )
}
