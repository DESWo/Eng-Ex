import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, PartyPopper, Target } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { challengeRegistry } from '@/challenges/registry'
import { useLevelCounts } from '@/hooks/useLevelCounts'
import { LEVELS_PER_CHALLENGE } from '@/lib/mastery'
import { loadJson, saveJson } from '@/lib/storage'
import type { Discipline } from '@/lib/types'
import { cn } from '@/lib/utils'

/** slug -> which of that discipline's challenges have been solved. */
type SolvedMap = Record<string, Record<string, boolean>>

interface ChallengeStepProps {
  discipline: Discipline
  /** Called when a challenge is solved (updates step progress). */
  onSolved: () => void
  /** Called when the player continues to the reflection step. */
  onNext: () => void
}

export function ChallengeStep({ discipline, onSolved, onNext }: ChallengeStepProps) {
  const { challenges } = discipline

  const [solved, setSolved] = useState<Record<string, boolean>>(
    () => loadJson<SolvedMap>('challenges', {})[discipline.slug] ?? {},
  )
  // Start on the first challenge the player has not beaten yet.
  const [activeId, setActiveId] = useState<string>(() => {
    const done = loadJson<SolvedMap>('challenges', {})[discipline.slug] ?? {}
    return (challenges.find((c) => !done[c.id]) ?? challenges[0]).id
  })

  const active = challenges.find((c) => c.id === activeId) ?? challenges[0]
  const ChallengeComponent = challengeRegistry[active.id]
  const nextChallenge = challenges.find((c) => !solved[c.id] && c.id !== active.id)

  const levelsFor = useLevelCounts()
  const totalLevels = challenges.length * LEVELS_PER_CHALLENGE
  const clearedLevels = challenges.reduce((sum, c) => sum + levelsFor(c.id), 0)

  const handleComplete = () => {
    setSolved((prev) => {
      const next = { ...prev, [active.id]: true }
      const all = loadJson<SolvedMap>('challenges', {})
      saveJson('challenges', { ...all, [discipline.slug]: next })
      return next
    })
    onSolved()
  }

  return (
    <div className="space-y-6">
      {/* Challenge picker */}
      <div>
        <div className="flex flex-wrap gap-2">
          {challenges.map((c, i) => {
            const isActive = c.id === active.id
            const lv = levelsFor(c.id)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                aria-pressed={isActive}
                title={`${lv}/${LEVELS_PER_CHALLENGE} levels cleared`}
                className={cn(
                  'flex items-center gap-2 rounded-full px-4 py-2 font-display text-sm font-semibold transition-colors duration-200',
                  isActive
                    ? 'accent-bg text-white shadow-clay'
                    : solved[c.id]
                      ? 'accent-soft accent-text hover:brightness-105'
                      : 'bg-stone-100 text-ink-soft hover:bg-stone-200 dark:bg-white/5 dark:text-stone-400 dark:hover:bg-white/10',
                )}
              >
                {lv >= LEVELS_PER_CHALLENGE ? (
                  <Check className="h-4 w-4" />
                ) : lv > 0 ? (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums',
                      isActive ? 'bg-white/25' : 'bg-stone-200 dark:bg-white/10',
                    )}
                  >
                    {lv}/{LEVELS_PER_CHALLENGE}
                  </span>
                ) : solved[c.id] ? (
                  // Beaten before the level system existed; no level data to show.
                  <Check className="h-4 w-4" />
                ) : (
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-xs tabular-nums',
                      isActive ? 'bg-white/25' : 'bg-stone-200 dark:bg-white/10',
                    )}
                  >
                    {i + 1}
                  </span>
                )}
                {c.title}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-sm text-ink-soft dark:text-stone-400">
          {`Beat level 1 of any game to keep going. Every game runs ${LEVELS_PER_CHALLENGE} levels deep: ${clearedLevels}/${totalLevels} cleared so far.`}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {active.title}
        </h2>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
          <Target className="mr-1 h-4 w-4" />
          Goal: {active.goal}
        </Badge>
      </div>

      {ChallengeComponent ? (
        // Keyed so switching challenges gives each one a fresh start.
        <ChallengeComponent key={active.id} onComplete={handleComplete} />
      ) : (
        <Card className="p-8 text-center text-ink-soft dark:text-stone-400">
          This challenge is still being built. Check back soon!
        </Card>
      )}

      <AnimatePresence>
        {solved[active.id] && (
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <Card className="accent-soft flex flex-col items-center justify-between gap-4 p-5 sm:flex-row">
              <p className="flex items-center gap-3 font-display font-semibold">
                <PartyPopper className="accent-text h-6 w-6 shrink-0" />
                Nice work, engineer! Keep tinkering, or move on.
              </p>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {nextChallenge && (
                  <Button variant="soft" onClick={() => setActiveId(nextChallenge.id)}>
                    Next: {nextChallenge.title}
                  </Button>
                )}
                <Button variant="accent" onClick={onNext}>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
