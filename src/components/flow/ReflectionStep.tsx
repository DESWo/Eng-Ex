import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Frown, Meh, Smile } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { loadJson, saveJson } from '@/lib/storage'
import { fadeUp, staggerContainer } from '@/lib/animations'
import type { Discipline, Enjoyment, Reflection, TryAnother } from '@/lib/types'
import { cn } from '@/lib/utils'

const enjoyOptions: { value: Enjoyment; icon: LucideIcon; label: string }[] = [
  { value: 'loved', icon: Smile, label: 'Loved it' },
  { value: 'okay', icon: Meh, label: 'It was okay' },
  { value: 'not-really', icon: Frown, label: 'Not for me' },
]

const tryAnotherOptions: { value: TryAnother; label: string }[] = [
  { value: 'yes', label: 'Yes!' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No thanks' },
]

const optionBase =
  'rounded-2xl border-2 transition-colors duration-200 font-display font-semibold ' +
  'border-stone-200 hover:border-stone-300 dark:border-white/10 dark:hover:border-white/25'
const optionSelected = 'accent-border accent-soft accent-text'

interface ReflectionStepProps {
  discipline: Discipline
  onNext: () => void
}

export function ReflectionStep({ discipline, onNext }: ReflectionStepProps) {
  const [reflection, setReflection] = useState<Reflection>(
    () => loadJson<Record<string, Reflection>>('reflections', {})[discipline.slug] ?? {},
  )

  const update = (patch: Partial<Reflection>) => {
    setReflection((prev) => {
      const next = { ...prev, ...patch }
      const all = loadJson<Record<string, Reflection>>('reflections', {})
      saveJson('reflections', { ...all, [discipline.slug]: next })
      return next
    })
  }

  const complete =
    reflection.enjoyed !== undefined &&
    reflection.difficulty !== undefined &&
    reflection.tryAnother !== undefined

  return (
    <motion.div
      className="mx-auto max-w-2xl space-y-6"
      variants={staggerContainer}
    >
      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }} className="text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">How was that?</h2>
        <p className="mt-2 text-ink-soft dark:text-stone-400">
          No wrong answers here. This just helps you figure out what fits you.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }}>
        <Card className="p-6">
          <h3 className="font-display text-lg font-bold">Did you enjoy this challenge?</h3>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {enjoyOptions.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
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
        </Card>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }}>
        <Card className="p-6">
          <h3 className="font-display text-lg font-bold">How hard did it feel?</h3>
          <div className="mt-4 flex justify-between gap-2 sm:justify-start sm:gap-3">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                type="button"
                aria-label={`Difficulty ${level} of 5`}
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
            <span>Easy breezy</span>
            <span>Brain melting</span>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }}>
        <Card className="p-6">
          <h3 className="font-display text-lg font-bold">Would you try another challenge?</h3>
          <div className="mt-4 flex flex-wrap gap-3">
            {tryAnotherOptions.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => update({ tryAnother: value })}
                className={cn(
                  optionBase,
                  'rounded-full px-6 py-2.5 text-sm',
                  reflection.tryAnother === value && optionSelected,
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-70px' }} className="flex flex-col items-center gap-2 pb-4">
        <Button variant="accent" size="lg" onClick={onNext} disabled={!complete}>
          Continue
          <ArrowRight className="h-5 w-5" />
        </Button>
        {!complete && (
          <p className="text-sm text-ink-soft dark:text-stone-400">
            Answer all three to keep going.
          </p>
        )}
      </motion.div>
    </motion.div>
  )
}
