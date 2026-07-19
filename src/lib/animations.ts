import type { Variants } from 'framer-motion'

/** Fade in while rising slightly. Used for most entrances. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}

/** Parent wrapper that staggers its fadeUp children. */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
}
