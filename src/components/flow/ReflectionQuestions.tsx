import { useState } from 'react'
import { Frown, Meh, Smile } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useProgress } from '@/hooks/useProgress'
import { loadJson, saveJson } from '@/lib/storage'
import type { Discipline, Enjoyment, Reflection, TryAnother } from '@/lib/types'
import { cn } from '@/lib/utils'

const enjoyOptions: { value: Enjoyment; icon: LucideIcon; label: string }[] = [
  { value: 'loved', icon: Smile, label: 'Loved it' },
  { value: 'okay', icon: Meh, label: 'It was okay' },
  { value: 'not-really', icon: Frown, label: 'Not for me' },
]

const tryAnotherOptions: { value: TryAnother; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
]

const optionBase =
  'rounded-2xl border-2 transition-colors duration-200 font-display font-semibold ' +
  'border-stone-200 hover:border-stone-300 dark:border-white/10 dark:hover:border-white/25'
const optionSelected = 'accent-border accent-soft accent-text'

/**
 * The three reflection questions. Same answers, same `ee:reflections` shape,
 * keyed by discipline slug: the teacher report reads exactly what it read
 * before. Nothing here blocks anything; the questions are just available.
 */
export function ReflectionQuestions({ discipline }: { discipline: Discipline }) {
  const { markDone } = useProgress()
  const [reflection, setReflection] = useState<Reflection>(
    () => loadJson<Record<string, Reflection>>('reflections', {})[discipline.slug] ?? {},
  )

  const update = (patch: Partial<Reflection>) => {
    const next = { ...reflection, ...patch }
    // Re-read so another field's answers, saved since mount, survive the write.
    const all = loadJson<Record<string, Reflection>>('reflections', {})
    saveJson('reflections', { ...all, [discipline.slug]: next })
    setReflection(next)

    if (
      next.enjoyed !== undefined &&
      next.difficulty !== undefined &&
      next.tryAnother !== undefined
    ) {
      markDone(discipline.slug, 'reflection')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-display font-bold">Did you enjoy this challenge?</h4>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {enjoyOptions.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={reflection.enjoyed === value}
              onClick={() => update({ enjoyed: value })}
              className={cn(
                optionBase,
                'flex flex-col items-center gap-2 p-4',
                reflection.enjoyed === value && optionSelected,
              )}
            >
              <Icon className="h-7 w-7" />
              <span className="text-sm">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-display font-bold">How hard did it feel?</h4>
        <div className="mt-3 flex justify-between gap-2 sm:justify-start sm:gap-3">
          {[1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              type="button"
              aria-label={`Difficulty ${level} of 5`}
              aria-pressed={reflection.difficulty === level}
              onClick={() => update({ difficulty: level })}
              className={cn(
                optionBase,
                'h-12 w-12 rounded-full text-base font-mono tabular-nums sm:h-14 sm:w-14',
                reflection.difficulty === level && optionSelected,
              )}
            >
              {level}
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-ink-soft sm:max-w-[19rem] dark:text-stone-400">
          <span>Easy</span>
          <span>Very hard</span>
        </div>
      </div>

      <div>
        <h4 className="font-display font-bold">Would you try another challenge?</h4>
        <div className="mt-3 flex flex-wrap gap-3">
          {tryAnotherOptions.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={reflection.tryAnother === value}
              onClick={() => update({ tryAnother: value })}
              className={cn(
                optionBase,
                'min-h-11 rounded-full px-6 py-2.5 text-sm',
                reflection.tryAnother === value && optionSelected,
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-ink-soft dark:text-stone-400">
        Saved on this device, next to your answers for the other fields.
      </p>
    </div>
  )
}
