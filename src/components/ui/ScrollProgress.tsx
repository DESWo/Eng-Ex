import { motion, useScroll, useSpring } from 'framer-motion'

/**
 * A reading-progress rule across the top of the page.
 *
 * Borrowed straight from long-form academic reading: it tells you how much of
 * the document is left without taking any space to say it. Spring-smoothed so
 * a flicked scroll wheel does not make it twitch.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 180, damping: 30, restDelta: 0.001 })

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-[var(--accent,#7b6cf0)]"
    />
  )
}
