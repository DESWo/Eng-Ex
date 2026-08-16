import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { DiyProject } from '@/components/flow/DiyProject'
import { ReflectionQuestions } from '@/components/flow/ReflectionQuestions'
import { WhyItWorks } from '@/components/flow/WhyItWorks'
import { useProgress } from '@/hooks/useProgress'
import type { Discipline, StepId } from '@/lib/types'
import { cn } from '@/lib/utils'

function Disclosure({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const bodyId = useId()

  return (
    <Card className="overflow-hidden">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-h-11 w-full items-center gap-3 px-5 py-4 text-left font-display font-bold"
        >
          {title}
          <ChevronDown
            aria-hidden
            className={cn(
              'ml-auto h-4 w-4 shrink-0 text-ink-soft transition-transform duration-200 dark:text-stone-400',
              open && 'rotate-180',
            )}
          />
        </button>
      </h3>
      <div
        id={bodyId}
        hidden={!open}
        className="border-t border-stone-200/70 px-5 py-5 dark:border-white/10"
      >
        {open && children}
      </div>
    </Card>
  )
}

/**
 * Everything that is not a game: the reflection questions, the engineering
 * behind the three games, and the project you can build at home. It sits under
 * the challenges as material to open when you want it, not as steps to finish.
 */
export function SupportingMaterial({ discipline }: { discipline: Discipline }) {
  const { markDone } = useProgress()
  const [open, setOpen] = useState<Record<string, boolean>>({})

  // Opening a section is what reading it used to be worth, so the same
  // ee:progress steps still get written and the teacher report still adds up.
  const toggle = (id: string, step?: StepId) => {
    if (!open[id] && step) markDone(discipline.slug, step)
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-bold tracking-tight">After you play</h2>

      <Disclosure
        title="How was that?"
        open={Boolean(open.reflection)}
        onToggle={() => toggle('reflection')}
      >
        <ReflectionQuestions discipline={discipline} />
      </Disclosure>

      <Disclosure
        title={discipline.learn.heading}
        open={Boolean(open.learn)}
        onToggle={() => toggle('learn', 'learn')}
      >
        <WhyItWorks discipline={discipline} />
      </Disclosure>

      <Disclosure
        title="Try it at home"
        open={Boolean(open.diy)}
        onToggle={() => toggle('diy', 'diy')}
      >
        <DiyProject discipline={discipline} />
      </Disclosure>
    </section>
  )
}
