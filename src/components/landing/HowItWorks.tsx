import { motion } from 'framer-motion'
import { BookOpen, Gamepad2, Lightbulb, MessagesSquare } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { fadeUp, staggerContainer } from '@/lib/animations'

const steps = [
  {
    icon: BookOpen,
    title: 'Learn the basics',
    body: 'A quick, friendly intro to the field. Two minutes, tops.',
  },
  {
    icon: Gamepad2,
    title: 'Play a challenge',
    body: 'Solve a real engineering problem, game style.',
  },
  {
    icon: MessagesSquare,
    title: 'Say how it felt',
    body: 'Loved it? Not your thing? Both are useful clues.',
  },
  {
    icon: Lightbulb,
    title: 'See why it worked',
    body: 'The idea behind your win, in plain words.',
  },
]

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-10 text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
        <p className="mt-3 text-ink-soft dark:text-stone-400">
          Every discipline follows the same simple loop.
        </p>
      </div>

      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
      >
        {steps.map(({ icon: Icon, title, body }, i) => (
          <motion.div key={title} variants={fadeUp}>
            <Card className="h-full p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 font-display text-sm font-bold dark:bg-white/10">
                  {i + 1}
                </span>
                <Icon className="h-6 w-6 text-ink-soft dark:text-stone-300" />
              </div>
              <h3 className="font-display text-lg font-bold">{title}</h3>
              <p className="mt-1.5 text-[15px] text-ink-soft dark:text-stone-400">{body}</p>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}
