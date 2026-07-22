import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowDown, Compass, HeartHandshake, Timer } from 'lucide-react'
import { buttonClasses } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { RoughLine } from '@/components/ui/Sketchy'

const chips = [
  { icon: Compass, text: '11 fields to explore' },
  { icon: Timer, text: 'About 10 minutes each' },
  { icon: HeartHandshake, text: 'No grades, no pressure' },
]

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  // The paper drifts slower than the words on it, so the headline lifts off
  // the drafting sheet as you scroll rather than sliding with it.
  const paperY = useTransform(scrollYProgress, [0, 1], ['0%', '22%'])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '-12%'])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  return (
    <section ref={ref} className="relative overflow-hidden">
      <motion.div aria-hidden className="paper-grid-lg absolute inset-0 -z-20" style={{ y: paperY }} />
      {/* Soft floating color blobs behind the headline. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <motion.div
          className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#f2695c]/15 blur-3xl"
          animate={{ y: [0, 18, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -right-16 top-24 h-80 w-80 rounded-full bg-[#7b6cf0]/15 blur-3xl"
          animate={{ y: [0, -22, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute left-1/2 top-64 h-64 w-64 -translate-x-1/2 rounded-full bg-[#2fb98b]/15 blur-3xl"
          animate={{ y: [0, 14, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="mx-auto max-w-4xl px-6 pb-16 pt-20 text-center sm:pt-28">
        <motion.div
          style={{ y: contentY, opacity: contentOpacity }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <Badge className="mb-6">For future engineers</Badge>

          <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-7xl">
            Explore{' '}
            <span className="relative inline-block">
              Engineering
              <motion.svg
                aria-hidden
                className="absolute -bottom-3 left-0 w-full overflow-visible"
                viewBox="0 0 300 16"
                preserveAspectRatio="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                {/* Two passes, the way you underline something by hand. */}
                <RoughLine x1={4} y1={8} x2={296} y2={6} stroke="#f2695c" options={{ roughness: 2.2, strokeWidth: 4 }} seed={7} />
                <RoughLine x1={10} y1={12} x2={288} y2={11} stroke="#f2695c" options={{ roughness: 2.6, strokeWidth: 3 }} seed={21} />
              </motion.svg>
            </span>
          </h1>

          <p className="mx-auto mt-8 max-w-xl text-lg text-ink-soft sm:text-xl dark:text-stone-400">
            Discover what engineers actually do through interactive challenges.
          </p>

          <div className="mt-10 flex justify-center">
            <a href="#disciplines" className={buttonClasses('primary', 'lg')}>
              Start Exploring
              <ArrowDown className="h-5 w-5" />
            </a>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            {chips.map(({ icon: Icon, text }) => (
              <Badge key={text} className="bg-white px-4 py-2 text-sm shadow-clay dark:bg-night-panel">
                <Icon className="mr-1 h-4 w-4" />
                {text}
              </Badge>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
