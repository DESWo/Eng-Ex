import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Doodle } from '@/components/ui/Doodle'
import type { ChallengeLevel } from '@/lib/types'
import { cn } from '@/lib/utils'

/** How long a student can sit on an uncleared level before the hint speaks up. */
const NUDGE_AFTER_MS = 60_000

/**
 * The level hint. It is a hint, not a briefing: closed by default and quiet
 * about itself, because a concept card sitting open above the game hands over
 * the idea the level is built to make the student find. Opening it costs a
 * star, which is why it stays one deliberate tap away.
 *
 * It gets louder when the student is having trouble: pass `missed` after a
 * failed attempt, or let the fallback timer notice a level nobody is clearing.
 */
export function ConceptCard({
  level,
  onReveal,
  missed = false,
}: {
  level: ChallengeLevel<unknown>
  /** Fires the first time the hint is opened on this level: it costs a star. */
  onReveal?: () => void
  /** The last attempt on this level failed, so offer the hint more visibly. */
  missed?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [waited, setWaited] = useState(false)

  // Re-collapse whenever the level changes, and restart the stuck timer.
  useEffect(() => {
    setOpen(false)
    setWaited(false)
    const t = setTimeout(() => setWaited(true), NUDGE_AFTER_MS)
    return () => clearTimeout(t)
  }, [level.n])

  const offer = missed || waited

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (!open) onReveal?.()
          setOpen((v) => !v)
        }}
        aria-expanded={open}
        className={cn(
          // 44px tall: same touch budget as the level markers.
          'inline-flex h-11 items-center gap-2 rounded-full px-3 text-left',
          'font-display text-sm font-bold transition-colors duration-200',
          open || offer
            ? 'accent-soft accent-text'
            : 'text-ink-soft hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-white/5',
        )}
      >
        <Doodle name="bulb" className="h-6 w-5 shrink-0" />
        <span>{open ? 'Hint' : 'Stuck? Tap for a hint'}</span>
        <span
          aria-hidden
          className={cn('text-xs transition-transform duration-200', open && 'rotate-180')}
        >
          ▾
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <p className="accent-soft mt-1 rounded-2xl px-4 py-3 text-sm text-ink-soft dark:text-stone-300">
              <span className="font-display font-semibold text-ink dark:text-stone-200">
                {level.concept}.
              </span>{' '}
              {level.teach}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
