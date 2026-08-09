import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Doodle } from '@/components/ui/Doodle'
import type { ChallengeLevel } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * The hint for the level, hidden until the player asks for it.
 *
 * It used to sit open at the top of every level and spell out both the twist
 * and the strategy, so there was nothing left to work out. Now it starts
 * collapsed: you get the goal and the controls and have to try first. If you
 * get stuck, one tap opens the same explanation. Collapses again on each new
 * level, so the help is always earned, never forced.
 */
export function ConceptCard({
  level,
  onReveal,
}: {
  level: ChallengeLevel<unknown>
  /** Fires the first time the hint is opened on this level: it costs a star. */
  onReveal?: () => void
}) {
  const [open, setOpen] = useState(false)

  // Re-collapse whenever the level changes.
  useEffect(() => setOpen(false), [level.n])

  return (
    <div className="accent-soft overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={() => {
          if (!open) onReveal?.()
          setOpen((v) => !v)
        }}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <Doodle name="bulb" className="accent-text h-6 w-5 shrink-0" />
        <span className="accent-text font-display text-sm font-bold">
          {open ? 'Hint' : 'Stuck? Tap for a hint'}
        </span>
        <span
          aria-hidden
          className={cn(
            'accent-text ml-auto text-xs transition-transform duration-200',
            open && 'rotate-180',
          )}
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
          >
            <p className="px-4 pb-3 text-sm text-ink-soft dark:text-stone-300">
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
