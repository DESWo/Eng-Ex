import { FlaskConical, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { diyDiagramRegistry } from '@/components/diy'
import type { Discipline } from '@/lib/types'

/** The build-it-at-home project: the same idea off the screen. */
export function DiyProject({ discipline }: { discipline: Discipline }) {
  const { diy } = discipline
  const Diagram = diy.diagram ? diyDiagramRegistry[diy.diagram] : undefined

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-display text-lg font-bold">{diy.title}</h4>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft dark:text-stone-300">
          {diy.intro}
        </p>
      </div>

      {Diagram && (
        <div className="overflow-hidden rounded-2xl bg-stone-100/80 dark:bg-white/5">
          <Diagram />
        </div>
      )}

      <div>
        <h5 className="mb-3 font-display text-xs font-bold uppercase tracking-widest text-ink-soft dark:text-stone-400">
          You will need
        </h5>
        <div className="flex flex-wrap gap-2">
          {diy.materials.map((item) => (
            <Badge key={item} className="accent-soft accent-text px-4 py-1.5 text-sm">
              {item}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <h5 className="mb-3 font-display text-xs font-bold uppercase tracking-widest text-ink-soft dark:text-stone-400">
          How to build it
        </h5>
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
      </div>

      <div className="accent-soft flex items-start gap-4 rounded-2xl p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-clay dark:bg-night-panel">
          <FlaskConical aria-hidden className="accent-text h-5 w-5" />
        </span>
        <div>
          <p className="accent-text font-display text-xs font-bold uppercase tracking-widest">
            Make it an experiment
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed">{diy.experiment}</p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl bg-amber-100 p-4 text-sm font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-300">
        <TriangleAlert aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
        {diy.safety}
      </div>
    </div>
  )
}
