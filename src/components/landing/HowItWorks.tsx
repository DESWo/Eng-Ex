import { Reveal } from '@/components/ui/Reveal'

const steps = [
  {
    title: 'Learn the basics',
    body: 'A quick, friendly intro to the field. Two minutes, tops.',
  },
  {
    title: 'Play a challenge',
    body: 'Solve a real engineering problem, game style.',
  },
  {
    title: 'Say how it felt',
    body: 'Loved it? Not your thing? Both are useful clues.',
  },
  {
    title: 'See why it worked',
    body: 'The idea behind your win, in plain words.',
  },
]

/**
 * The loop, set like a numbered procedure in a lab notebook: hairline rules,
 * mono step numbers, no icon tiles. A procedure reads left-aligned; centering
 * it would make it a poster.
 */
export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <Reveal className="mb-10">
        <p className="label-caps accent-text mb-3">The loop</p>
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
        <p className="mt-3 text-ink-soft dark:text-stone-400">
          Every discipline follows the same simple loop.
        </p>
      </Reveal>

      <Reveal>
        <ol className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ title, body }, i) => (
            <li key={title} className="rule pt-4">
              <span className="font-mono text-xs font-semibold text-ink-soft dark:text-stone-500">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-2 font-display text-lg font-bold">{title}</h3>
              <p className="mt-1.5 text-[15px] text-ink-soft dark:text-stone-400">{body}</p>
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  )
}
