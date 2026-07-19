import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { aboutCreator, aboutGoal, aboutRoadmap, aboutWhy } from '@/data/about'
import { fadeUp, staggerContainer } from '@/lib/animations'

export function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-center"
      >
        <Badge className="mb-5">About</Badge>
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Engineering, made something you can touch
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-soft dark:text-stone-400">
          A hands-on way for students to discover what engineers actually do, by doing it.
        </p>
      </motion.div>

      {/* Why */}
      <motion.section
        className="mt-16"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
      >
        <motion.h2 variants={fadeUp} className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {aboutWhy.heading}
        </motion.h2>
        <div className="mt-4 space-y-4">
          {aboutWhy.paragraphs.map((p) => (
            <motion.p key={p} variants={fadeUp} className="text-lg leading-relaxed text-ink-soft dark:text-stone-300">
              {p}
            </motion.p>
          ))}
        </div>
      </motion.section>

      {/* Goal */}
      <motion.section
        className="mt-16"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
      >
        <motion.h2 variants={fadeUp} className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {aboutGoal.heading}
        </motion.h2>
        <motion.p variants={fadeUp} className="mt-4 text-lg leading-relaxed text-ink-soft dark:text-stone-300">
          {aboutGoal.body}
        </motion.p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {aboutGoal.pillars.map(({ icon: Icon, label, text }) => (
            <motion.div key={label} variants={fadeUp}>
              <Card className="h-full p-5">
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 dark:bg-white/10">
                  <Icon className="h-6 w-6 text-ink-soft dark:text-stone-300" />
                </span>
                <h3 className="font-display font-bold">{label}</h3>
                <p className="mt-1 text-sm text-ink-soft dark:text-stone-400">{text}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Creator */}
      <motion.section
        className="mt-16"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
      >
        <motion.div variants={fadeUp}>
          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-rose-400 font-display text-2xl font-extrabold text-white">
                {aboutCreator.name.charAt(0)}
              </span>
              <div>
                <h2 className="font-display text-xl font-bold">{aboutCreator.name}</h2>
                <p className="text-sm text-ink-soft dark:text-stone-400">{aboutCreator.role}</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {aboutCreator.paragraphs.map((p) => (
                <p key={p} className="text-[15px] leading-relaxed text-ink-soft dark:text-stone-300">
                  {p}
                </p>
              ))}
            </div>
          </Card>
        </motion.div>
      </motion.section>

      {/* Roadmap */}
      <motion.section
        className="mt-16"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
      >
        <motion.h2 variants={fadeUp} className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {aboutRoadmap.heading}
        </motion.h2>
        <div className="mt-6 space-y-3">
          {aboutRoadmap.items.map(({ icon: Icon, title, body, status }) => (
            <motion.div key={title} variants={fadeUp}>
              <Card className="flex items-start gap-4 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-stone-100 dark:bg-white/10">
                  <Icon className="h-6 w-6 text-ink-soft dark:text-stone-300" />
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display font-bold">{title}</h3>
                    <Badge
                      className={
                        status === 'building'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'bg-stone-100 text-ink-soft dark:bg-white/10 dark:text-stone-400'
                      }
                    >
                      {status === 'building' ? 'In progress' : 'Planned'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-soft dark:text-stone-400">{body}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
        className="mt-16 text-center"
      >
        <ButtonLink to="/" size="lg">
          Start exploring
          <ArrowRight className="h-5 w-5" />
        </ButtonLink>
      </motion.div>
    </div>
  )
}
