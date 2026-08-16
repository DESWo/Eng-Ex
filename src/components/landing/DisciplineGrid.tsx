import { motion } from 'framer-motion'
import { Doodle } from '@/components/ui/Doodle'
import { DisciplineCard } from '@/components/landing/DisciplineCard'
import { Reveal } from '@/components/ui/Reveal'
import { disciplines } from '@/data/disciplines'
import { fadeUp, staggerContainer } from '@/lib/animations'
import type { Discipline } from '@/lib/types'

const gridMotion = {
  variants: staggerContainer,
  initial: 'hidden' as const,
  whileInView: 'show' as const,
  viewport: { once: true, margin: '-60px' },
}

function Grid({ items }: { items: Discipline[] }) {
  return (
    <motion.div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" {...gridMotion}>
      {items.map((discipline) => (
        <motion.div key={discipline.slug} variants={fadeUp} className="h-full">
          <DisciplineCard discipline={discipline} />
        </motion.div>
      ))}
    </motion.div>
  )
}

/**
 * A named run of cards. The two groups are reading order only: every field is
 * playable from the first visit, so nothing here gates anything.
 */
function Group({ title, blurb, items }: { title: string; blurb: string; items: Discipline[] }) {
  return (
    <div>
      <Reveal className="mb-6">
        <h3 className="font-display text-2xl font-bold tracking-tight">{title}</h3>
        <p className="mt-2 text-ink-soft dark:text-stone-400">{blurb}</p>
      </Reveal>
      <Grid items={items} />
    </div>
  )
}

export function DisciplineGrid() {
  const core = disciplines.filter((d) => d.tier !== 'more')
  const more = disciplines.filter((d) => d.tier === 'more')

  return (
    <section id="disciplines" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16">
      <Reveal className="mb-10 text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Choose a field to study
        </h2>
        <p className="mt-3 text-ink-soft dark:text-stone-400">
          Every field is open from the first visit. Three challenges in each, five levels deep.
        </p>
      </Reveal>

      <div className="space-y-16">
        <Group
          title="Start here"
          blurb={`The ${core.length} widest fields. Most engineering work sits under one of them.`}
          items={core}
        />
        {more.length > 0 && (
          <Group
            title="Explore more"
            blurb={`${more.length} narrower fields that branch off the first three.`}
            items={more}
          />
        )}
      </div>

      <p className="mt-16 text-center text-sm text-ink-soft dark:text-stone-400">
        <Doodle name="star" className="mr-1.5 inline-block h-4 w-4 align-[-2px]" />
        Twelve fields and 36 games, and that is the whole list. The work from here goes into
        making these better, not adding more.
      </p>
    </section>
  )
}
