import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowDown } from 'lucide-react'
import { buttonClasses } from '@/components/ui/Button'
import { Doodle } from '@/components/ui/Doodle'
import { RoughLine } from '@/components/ui/Sketchy'
import { disciplines } from '@/data/disciplines'

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
      {/* A real reader, drawn by a real hand (Pablo Stanley, CC0). */}
      <Doodle
        name="sitting-reading"
        className="pointer-events-none absolute -bottom-2 right-[4%] hidden w-52 text-ink/85 lg:block dark:text-stone-200/90"
      />

      <div className="mx-auto max-w-4xl px-6 pb-16 pt-20 text-center sm:pt-28">
        <motion.div
          style={{ y: contentY, opacity: contentOpacity }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <p className="label-caps mb-6 text-ink-soft dark:text-stone-400">For future engineers</p>

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
              Start exploring
              <ArrowDown className="h-5 w-5" />
            </a>
          </div>

          {/*
           * One quiet caption under the button, the way a drawing carries a
           * note in its margin. Stars are personal bests, not marks, so the
           * low-pressure promise stands.
           */}
          <p className="mx-auto mt-6 max-w-md text-sm text-ink-soft dark:text-stone-400">
            <span className="whitespace-nowrap">{disciplines.length} fields ·</span>{' '}
            <span className="whitespace-nowrap">about 10 minutes each ·</span>{' '}
            <span className="whitespace-nowrap">no grades, just your own best</span>
          </p>
        </motion.div>
      </div>
    </section>
  )
}
