import { Check } from 'lucide-react'
import { STEP_ORDER, type StepId } from '@/lib/types'
import { cn } from '@/lib/utils'

const stepMeta: Record<StepId, { label: string; short: string }> = {
  intro: { label: 'Learn', short: 'Learn' },
  challenge: { label: 'Play', short: 'Play' },
  reflection: { label: 'Reflect', short: 'Reflect' },
  learn: { label: 'Why it works', short: 'Why' },
  diy: { label: 'Try it at home', short: 'Home' },
}

interface FlowStepperProps {
  current: StepId
  isDone: (step: StepId) => boolean
  onSelect: (step: StepId) => void
}

/**
 * Folder tabs across the top of the discipline flow, like the divider tabs in
 * a real binder. The open tab sits proud of the rule with the accent along its
 * top edge; finished tabs earn a check; locked ones lie flat until you get
 * there. (This replaced a generic disc-and-dots stepper on purpose.)
 */
export function FlowStepper({ current, isDone, onSelect }: FlowStepperProps) {
  return (
    <nav aria-label="Progress" className="border-b border-ink/10 dark:border-white/10">
      <div className="flex items-end gap-1">
        {STEP_ORDER.map((step) => {
          const { label, short } = stepMeta[step]
          const done = isDone(step)
          const active = step === current
          const clickable = done || active

          return (
            <button
              key={step}
              type="button"
              disabled={!clickable}
              onClick={() => onSelect(step)}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'relative -mb-px rounded-t-lg px-2 py-2.5 font-display text-xs font-semibold transition-colors duration-200 sm:px-4 sm:text-sm',
                active
                  ? 'accent-text border border-b-0 border-ink/10 bg-white dark:border-white/10 dark:bg-night-panel'
                  : done
                    ? 'text-ink-soft hover:text-ink dark:text-stone-400 dark:hover:text-stone-200'
                    : 'cursor-default text-stone-400 dark:text-stone-600',
              )}
            >
              {active && (
                <span aria-hidden className="accent-bg absolute inset-x-0 top-0 h-0.5 rounded-full" />
              )}
              {done && !active && (
                <Check aria-hidden className="mr-1 hidden h-3.5 w-3.5 align-[-2px] sm:inline-block" />
              )}
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
