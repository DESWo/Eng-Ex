import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { Doodle } from '@/components/ui/Doodle'
import { Button } from '@/components/ui/Button'
import type { LevelState } from '@/hooks/useLevels'
import { LevelRail } from './LevelRail'
import { ConceptCard } from './ConceptCard'
import { Stars, starReason } from './Stars'

interface LevelHeaderProps {
  lv: LevelState<unknown>
  /** The level 4 overlay toggle, shown on the right of the rail. */
  insight?: ReactNode
  /** The last attempt failed: the hint is offered more visibly. */
  missed?: boolean
}

/**
 * Everything above the play area: the level markers, one line naming the level,
 * and the hint, closed. The simulation owns the rest of the screen, so nothing
 * else belongs here. The after-action material lives in LevelComplete.
 */
export function LevelHeader({ lv, insight, missed }: LevelHeaderProps) {
  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <LevelRail
          levels={lv.levels}
          current={lv.level.n}
          unlockedThrough={lv.unlockedThrough}
          isCleared={lv.isCleared}
          onPick={lv.goTo}
          starsFor={lv.starsFor}
        />
        {insight && <div className="shrink-0">{insight}</div>}
      </div>
      <ConceptCard level={lv.level} onReveal={lv.noteHint} missed={missed} />
    </div>
  )
}

interface LevelCompleteProps {
  lv: LevelState<unknown>
  /** Shown above the buttons, e.g. "Bullseye at 64 m." */
  message: string
  onReplay?: () => void
  /**
   * The after-action layer, rendered under the result line. This is the slot
   * for the post-level "here is why that happened" panel. The shell does not
   * know what goes in it, so the caller composes it.
   */
  explanation?: ReactNode
}

/** The bar that appears once a level is beaten, offering the next one. */
export function LevelComplete({ lv, message, onReplay, explanation }: LevelCompleteProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="accent-soft mt-4 flex flex-col gap-3 rounded-2xl p-4"
    >
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-2.5 font-display text-sm font-semibold">
            <Doodle name="trophy" className="accent-text h-5 w-5 shrink-0" />
            {message}
          </p>
          <p className="flex items-center gap-2 pl-[30px] text-xs text-ink-soft dark:text-stone-400">
            <Stars earned={lv.starsFor(lv.level.n)} size="sm" />
            {starReason(lv.starsFor(lv.level.n))}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {onReplay && (
            <Button variant="ghost" size="sm" onClick={onReplay}>
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
          )}
          {lv.hasNext ? (
            <Button variant="accent" size="sm" onClick={lv.next}>
              Level {lv.level.n + 1}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <span className="font-display text-sm font-semibold text-ink-soft dark:text-stone-400">
              All five levels cleared
            </span>
          )}
        </div>
      </div>

      {explanation}
    </motion.div>
  )
}
