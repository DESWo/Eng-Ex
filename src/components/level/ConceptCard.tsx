import { motion } from 'framer-motion'
import { Lightbulb } from 'lucide-react'
import type { ChallengeLevel } from '@/lib/types'

/**
 * The "here is what is new" strip that opens each level.
 * Keyed on the level number so it re-animates every time the level changes.
 */
export function ConceptCard({ level }: { level: ChallengeLevel<unknown> }) {
  return (
    <motion.div
      key={level.n}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="accent-soft flex items-start gap-3 rounded-2xl px-4 py-3"
    >
      <Lightbulb className="accent-text mt-0.5 h-5 w-5 shrink-0" />
      <p className="text-sm text-ink-soft dark:text-stone-300">
        <span className="accent-text font-display font-bold">
          {level.n === 1 ? 'Start here: ' : `New in level ${level.n}: `}
        </span>
        <span className="font-display font-semibold text-ink dark:text-stone-200">
          {level.concept}.
        </span>{' '}
        {level.teach}
      </p>
    </motion.div>
  )
}
