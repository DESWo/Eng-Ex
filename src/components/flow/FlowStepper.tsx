import { Fragment } from 'react'
import { BookOpen, Check, Gamepad2, Hammer, Lightbulb, MessagesSquare } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { STEP_ORDER, type StepId } from '@/lib/types'
import { cn } from '@/lib/utils'

const stepMeta: Record<StepId, { label: string; icon: LucideIcon }> = {
  intro: { label: 'Learn', icon: BookOpen },
  challenge: { label: 'Play', icon: Gamepad2 },
  reflection: { label: 'Reflect', icon: MessagesSquare },
  learn: { label: 'Why it works', icon: Lightbulb },
  diy: { label: 'Try it at home', icon: Hammer },
}

interface FlowStepperProps {
  current: StepId
  isDone: (step: StepId) => boolean
  onSelect: (step: StepId) => void
}

/** The four dots at the top of every discipline page. */
export function FlowStepper({ current, isDone, onSelect }: FlowStepperProps) {
  return (
    <nav aria-label="Progress" className="flex items-center justify-center">
      {STEP_ORDER.map((step, i) => {
        const { label, icon: Icon } = stepMeta[step]
        const done = isDone(step)
        const active = step === current
        const clickable = done || active

        return (
          <Fragment key={step}>
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  'mx-1 h-1 w-5 rounded-full sm:mx-2 sm:w-10',
                  isDone(STEP_ORDER[i - 1]) ? 'accent-bg' : 'bg-stone-200 dark:bg-white/10',
                )}
              />
            )}
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onSelect(step)}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-2xl px-1 py-1',
                !clickable && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-200',
                  active
                    ? 'accent-bg text-white shadow-clay'
                    : done
                      ? 'accent-soft accent-text'
                      : 'bg-stone-100 text-stone-400 dark:bg-white/5 dark:text-stone-500',
                )}
              >
                {done && !active ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </span>
              <span
                className={cn(
                  'hidden font-display text-xs font-semibold sm:block',
                  active ? 'accent-text' : 'text-ink-soft dark:text-stone-500',
                )}
              >
                {label}
              </span>
            </button>
          </Fragment>
        )
      })}
    </nav>
  )
}
