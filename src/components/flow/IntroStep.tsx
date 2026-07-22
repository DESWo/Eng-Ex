import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { VideoPlaceholder } from '@/components/ui/VideoPlaceholder'
import { fadeUp, staggerContainer } from '@/lib/animations'
import type { Discipline } from '@/lib/types'

interface IntroStepProps {
  discipline: Discipline
  onNext: () => void
}

export function IntroStep({ discipline, onNext }: IntroStepProps) {
  const { intro } = discipline

  return (
    <motion.div
      className="mx-auto max-w-2xl space-y-8"
      variants={staggerContainer}
    >
      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }}>
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {intro.heading}
        </h2>
        <div className="mt-4 space-y-4">
          {intro.paragraphs.map((text) => (
            <p key={text} className="text-lg leading-relaxed text-ink-soft dark:text-stone-300">
              {text}
            </p>
          ))}
        </div>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }}>
        <p className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-ink-soft dark:text-stone-400">
          Things they build
        </p>
        <div className="flex flex-wrap gap-2">
          {intro.builds.map((item) => (
            <Badge key={item} className="accent-soft accent-text px-4 py-1.5 text-sm">
              {item}
            </Badge>
          ))}
        </div>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }}>
        <VideoPlaceholder videoId={intro.videoId} title={`${discipline.name} intro video`} />
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }}>
        <Card className="accent-softer accent-border border-2 p-6">
          <p className="accent-text font-display text-xs font-bold uppercase tracking-widest">
            Your mission
          </p>
          <p className="mt-2 font-display text-lg font-semibold leading-snug">
            {intro.challengeTeaser}
          </p>
          <p className="mt-3 text-sm text-ink-soft dark:text-stone-400">
            {discipline.challenges.length === 1
              ? 'One challenge is waiting. Beat it to keep exploring.'
              : `${discipline.challenges.length} challenges await. Beat one to keep going, or master them all.`}
          </p>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }} className="flex justify-center pb-4">
        <Button variant="accent" size="lg" onClick={onNext}>
          Start the challenge
          <ArrowRight className="h-5 w-5" />
        </Button>
      </motion.div>
    </motion.div>
  )
}
