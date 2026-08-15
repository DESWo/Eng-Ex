import { motion, useScroll, useSpring } from 'framer-motion'

/** Reading-progress bar across the top of the page. Spring-smoothed against scroll jitter. */
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
