import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BeamDemo } from '@/components/landing/BeamDemo'
import { buttonClasses } from '@/components/ui/Button'
import { RoughLine } from '@/components/ui/Sketchy'
import { disciplines } from '@/data/disciplines'

const UNDERLINE_1 = { roughness: 2.2, strokeWidth: 4 }
const UNDERLINE_2 = { roughness: 2.6, strokeWidth: 3 }

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const paperY = useTransform(scrollYProgress, [0, 1], ['0%', '22%'])

  return (
    <section ref={ref} className="relative overflow-hidden">
      <motion.div
        aria-hidden
        className="paper-grid-lg absolute inset-0 -z-20"
        style={reduced ? undefined : { y: paperY }}
      />

      <div className="mx-auto max-w-6xl px-6 pb-16 pt-14 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
          <div className="max-w-xl">
            <h1 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
              <span className="relative inline-block">
                Try engineering
                <svg
                  aria-hidden
                  className="absolute -bottom-2 left-0 w-full overflow-visible"
                  viewBox="0 0 300 16"
                  preserveAspectRatio="none"
                >
                  <RoughLine x1={4} y1={8} x2={296} y2={6} stroke="#f2695c" options={UNDERLINE_1} seed={7} />
                  <RoughLine x1={10} y1={12} x2={288} y2={11} stroke="#f2695c" options={UNDERLINE_2} seed={21} />
                </svg>
              </span>
              , do not just read about it.
            </h1>

            <p className="mt-8 text-lg text-ink-soft dark:text-stone-400">
              {disciplines.length} fields, three challenges each. You build something, run it, and see
              what it does. The beam here is the smallest version of that: drag the load and the
              reactions and the sag recompute.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
              <a href="#disciplines" className={buttonClasses('primary', 'lg')}>
                Pick a field
                <ArrowDown className="h-5 w-5" />
              </a>
              <Link
                to="/technical"
                className="inline-flex min-h-11 items-center px-2 font-display text-base font-semibold text-ink-soft underline decoration-ink/30 underline-offset-4 hover:text-ink dark:text-stone-400 dark:decoration-white/30 dark:hover:text-stone-200"
              >
                How the simulations work
              </Link>
            </div>
          </div>

          <BeamDemo />
        </div>
      </div>
    </section>
  )
}
