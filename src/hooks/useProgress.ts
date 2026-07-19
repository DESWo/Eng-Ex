import { useCallback, useState } from 'react'
import { STEP_ORDER, type StepId } from '@/lib/types'
import { loadJson, saveJson } from '@/lib/storage'

/** slug -> which steps of that discipline are finished. */
type ProgressMap = Record<string, Partial<Record<StepId, boolean>>>

const KEY = 'progress'

/**
 * Per-discipline progress, persisted to localStorage.
 * Each of the four flow steps is worth 25%.
 */
export function useProgress() {
  const [progress, setProgress] = useState<ProgressMap>(() => loadJson(KEY, {}))

  const markDone = useCallback((slug: string, step: StepId) => {
    setProgress((prev) => {
      if (prev[slug]?.[step]) return prev
      const next: ProgressMap = { ...prev, [slug]: { ...prev[slug], [step]: true } }
      saveJson(KEY, next)
      return next
    })
  }, [])

  const isDone = useCallback(
    (slug: string, step: StepId) => Boolean(progress[slug]?.[step]),
    [progress],
  )

  const percentFor = useCallback(
    (slug: string) => {
      const done = STEP_ORDER.filter((step) => progress[slug]?.[step]).length
      return Math.round((done / STEP_ORDER.length) * 100)
    },
    [progress],
  )

  /** First step the visitor has not finished yet (where to resume). */
  const nextStepFor = useCallback(
    (slug: string): StepId => STEP_ORDER.find((step) => !progress[slug]?.[step]) ?? 'learn',
    [progress],
  )

  return { markDone, isDone, percentFor, nextStepFor }
}
