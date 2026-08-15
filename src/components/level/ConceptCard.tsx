import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Doodle } from '@/components/ui/Doodle'
import type { ChallengeLevel } from '@/lib/types'
import { cn } from '@/lib/utils'

/** The level hint, collapsed until the player opens it. Opening costs a star. */
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
