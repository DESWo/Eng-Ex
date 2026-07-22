import { motion } from 'framer-motion'
import { Compass, FlaskConical, Hammer, RotateCcw, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { diyDiagramRegistry } from '@/components/diy'
import { fadeUp, staggerContainer } from '@/lib/animations'
import type { Discipline } from '@/lib/types'

interface DiyStepProps {
  discipline: Discipline
  onExploreMore: () => void
  onReplay: () => void
}

/** "Try it at home": a real-world mini project that mirrors the challenge. */
export function DiyStep({ discipline, onExploreMore, onReplay }: DiyStepProps) {
  const { diy } = discipline
  const Diagram = diy.diagram ? diyDiagramRegistry[diy.diagram] : undefined

  return (
    <motion.div
      className="mx-auto max-w-2xl space-y-6"
      variants={staggerContainer}
    >
      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }} className="text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Try it at home
        </h2>
        <p className="mt-2 text-ink-soft dark:text-stone-400">
          No screen needed for this part. Real materials, real engineering.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }}>
        <Card className="accent-softer accent-border border-2 p-6">
          <p className="accent-text flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest">
            <Hammer className="h-4 w-4" />
            The project
          </p>
          <h3 className="mt-2 font-display text-xl font-bold">{diy.title}</h3>
          <p className="mt-1.5 text-[15px] text-ink-soft dark:text-stone-300">{diy.intro}</p>
        </Card>
      </motion.div>

      {Diagram && (
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }}>
          <Card className="p-4 sm:p-6">
            <p className="mb-3 font-display text-xs font-bold uppercase tracking-widest text-ink-soft dark:text-stone-400">
              The build, at a glance
            </p>
            <div className="overflow-hidden rounded-2xl bg-stone-100/80 dark:bg-white/5">
              <Diagram />
            </div>
          </Card>
        </motion.div>
      )}

      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }}>
        <p className="mb-3 font-display text-sm font-bold uppercase tracking-widest text-ink-soft dark:text-stone-400">
          You will need
        </p>
        <div className="flex flex-wrap gap-2">
          {diy.materials.map((item) => (
            <Badge key={item} className="accent-soft accent-text px-4 py-1.5 text-sm">
              {item}
            </Badge>
          ))}
        </div>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }}>
        <Card className="p-6">
          <h3 className="mb-4 font-display text-lg font-bold">How to build it</h3>
          <ol className="space-y-3">
            {diy.steps.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="accent-soft accent-text flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold font-mono tabular-nums">
                  {i + 1}
                </span>
                <p className="pt-0.5 text-[15px] leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }}>
        <Card className="accent-soft flex items-start gap-4 p-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-clay dark:bg-night-panel">
            <FlaskConical className="accent-text h-6 w-6" />
          </span>
          <div>
            <p className="accent-text font-display text-xs font-bold uppercase tracking-widest">
              Make it an experiment
            </p>
            <p className="mt-1.5 text-[15px] leading-relaxed">{diy.experiment}</p>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }}>
        <div className="flex items-start gap-3 rounded-2xl bg-amber-100 p-4 text-sm font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          {diy.safety}
        </div>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }} className="flex flex-wrap justify-center gap-3 pb-4">
        <Button variant="primary" size="lg" onClick={onExploreMore}>
          <Compass className="h-5 w-5" />
          Explore more disciplines
        </Button>
        <Button variant="soft" size="lg" onClick={onReplay}>
          <RotateCcw className="h-5 w-5" />
          Replay the challenges
        </Button>
      </motion.div>
    </motion.div>
  )
}
