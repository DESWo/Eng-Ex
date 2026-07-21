import { motion } from 'framer-motion'
import { ArrowDown, Compass, HeartHandshake, Timer } from 'lucide-react'
import { buttonClasses } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

const chips = [
  { icon: Compass, text: '11 fields to explore' },
  { icon: Timer, text: 'About 10 minutes each' },
  { icon: HeartHandshake, text: 'No grades, no pressure' },
]

export function Hero() {
  return (
    <section className="relative overflow-hidden">
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
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <Badge className="mb-6">For future engineers</Badge>

          <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-7xl">
            Explore{' '}
            <span className="relative inline-block">
              Engineering
              <svg
                aria-hidden
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 300 12"
                preserveAspectRatio="none"
              >
                <motion.path
                  d="M3 9 Q 50 2 100 8 T 200 7 T 297 5"
                  fill="none"
                  stroke="#f2695c"
                  strokeWidth="5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.7, delay: 0.4, ease: 'easeOut' }}
                />
              </svg>
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
