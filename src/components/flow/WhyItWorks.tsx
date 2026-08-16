import { Factory, Lightbulb, Scale } from 'lucide-react'
import type { Discipline } from '@/lib/types'

/**
 * The engineering behind all three games, plus what ties the field together.
 * Nothing is locked: a student who wants to read first can read first.
 */
export function WhyItWorks({ discipline }: { discipline: Discipline }) {
  const { learn, challenges } = discipline

  return (
    <div className="space-y-8">
      {challenges.map((challenge) => (
        <div key={challenge.id}>
          <h4 className="font-display font-bold">{challenge.title}</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {challenge.why.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-stone-200/70 p-4 dark:border-white/10"
              >
                <span className="accent-soft mb-3 flex h-10 w-10 items-center justify-center rounded-2xl">
                  <Icon aria-hidden className="accent-text h-5 w-5" />
                </span>
                <p className="font-display text-sm font-bold">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft dark:text-stone-400">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="accent-soft flex items-start gap-4 rounded-2xl p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-clay dark:bg-night-panel">
          <Lightbulb aria-hidden className="accent-text h-5 w-5" />
        </span>
        <div>
          <p className="accent-text font-display text-xs font-bold uppercase tracking-widest">
            The big idea
          </p>
          <p className="mt-1.5 font-display leading-snug font-semibold">{learn.bigIdea}</p>
        </div>
      </div>

      <div className="flex items-start gap-4 rounded-2xl border border-stone-200/70 p-5 dark:border-white/10">
        <span className="accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
          <Scale aria-hidden className="accent-text h-5 w-5" />
        </span>
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft dark:text-stone-400">
            The tradeoff
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed">{learn.tradeoff}</p>
        </div>
      </div>

      <div className="accent-border rounded-2xl border-2 p-5">
        <p className="accent-text flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest">
          <Factory aria-hidden className="h-4 w-4" />
          Where this shows up
        </p>
        <p className="mt-2 font-display leading-snug font-semibold">{learn.realWorld.intro}</p>
        <ul className="mt-3 space-y-2">
          {learn.realWorld.examples.map((example) => (
            <li key={example} className="flex gap-2.5 text-[15px] leading-relaxed">
              <span aria-hidden className="accent-bg mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
              {example}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
