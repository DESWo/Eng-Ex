import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

interface RevealProps {
  children: ReactNode
  /** Seconds to wait once the element is in view. */
  delay?: number
  /** How far it travels on the way in, in pixels. */
  y?: number
  className?: string
  /** Replay every time it scrolls into view, rather than only the first. */
  repeat?: boolean
}

/**
 * Fades a block in as it scrolls into view. Runs once unless `repeat`.
 * The -80px viewport margin fires it just before the element reaches the fold.
 * MotionConfig sets reducedMotion="user" app-wide, so reduced motion skips the travel.
 */
export function Reveal({ children, delay = 0, y = 22, className, repeat = false }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: !repeat, margin: '-80px 0px -80px 0px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  )
}
