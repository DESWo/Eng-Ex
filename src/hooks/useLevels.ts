import { useCallback, useMemo, useState } from 'react'
import type { ChallengeLevel } from '@/lib/types'
import { loadJson, saveJson } from '@/lib/storage'

/** challenge id -> which level numbers are cleared, plus best scores per metric. */
type LevelStore = Record<
  string,
  {
    cleared?: number[]
    /** metric id -> the best value the player has managed. */
    best?: Record<string, number>
  }
>

const KEY = 'levels'

/** Everything a challenge (and the shared level chrome) needs to drive its levels. */
export interface LevelState<S> {
  level: ChallengeLevel<S>
  index: number
  levels: ChallengeLevel<S>[]
  isCleared: (n: number) => boolean
  /** Mark the current level beaten. Pass metric values on level 5. */
  clearLevel: (scores?: Record<string, number>) => void
  goTo: (n: number) => void
  next: () => void
  hasNext: boolean
  unlockedThrough: number
  allCleared: boolean
  best: Record<string, number>
}

/**
 * Level state for one challenge: which level is on screen, which are cleared,
 * and the player's best score on each optimization metric.
 *
 * Levels are unlocked in order. Cleared levels stay replayable so a student can
 * go back and try a better design once they know what the later levels taught.
 */
export function useLevels<S>(challengeId: string, levels: ChallengeLevel<S>[]): LevelState<S> {
  const [store, setStore] = useState<LevelStore>(() => loadJson<LevelStore>(KEY, {}))

  const cleared = useMemo(
    () => new Set(store[challengeId]?.cleared ?? []),
    [store, challengeId],
  )

  // Open on the first level they have not beaten, so returning players resume.
  const [index, setIndex] = useState(() => {
    const done = new Set(loadJson<LevelStore>(KEY, {})[challengeId]?.cleared ?? [])
    const firstOpen = levels.findIndex((l) => !done.has(l.n))
    return firstOpen === -1 ? 0 : firstOpen
  })

  const level = levels[Math.min(index, levels.length - 1)]
  const isCleared = useCallback((n: number) => cleared.has(n), [cleared])

  /** Highest level the player is allowed to open (previous one must be cleared). */
  const unlockedThrough = useMemo(() => {
    let n = 1
    for (const l of levels) {
      if (cleared.has(l.n)) n = Math.min(levels.length, l.n + 1)
      else break
    }
    return n
  }, [cleared, levels])

  const write = useCallback(
    (updater: (entry: NonNullable<LevelStore[string]>) => NonNullable<LevelStore[string]>) => {
      // Re-read before writing. Holding the snapshot taken at mount and writing
      // the whole object back would erase any progress another challenge saved
      // in the meantime, since every challenge shares this one storage key.
      const latest = loadJson<LevelStore>(KEY, {})
      const next: LevelStore = { ...latest, [challengeId]: updater(latest[challengeId] ?? {}) }
      saveJson(KEY, next)
      setStore(next)
    },
    [challengeId],
  )

  /**
   * Mark the current level beaten. Pass metric values on level 5 and only
   * genuine improvements are kept, so the scorecard rewards iterating.
   */
  const clearLevel = useCallback(
    (scores?: Record<string, number>) => {
      write((entry) => {
        const nextCleared = entry.cleared?.includes(level.n)
          ? entry.cleared
          : [...(entry.cleared ?? []), level.n]

        if (!scores) return { ...entry, cleared: nextCleared }

        const best = { ...(entry.best ?? {}) }
        for (const metric of level.metrics ?? []) {
          const value = scores[metric.id]
          if (value === undefined) continue
          const prev = best[metric.id]
          const better =
            prev === undefined || (metric.goal === 'min' ? value < prev : value > prev)
          if (better) best[metric.id] = value
        }
        return { ...entry, cleared: nextCleared, best }
      })
    },
    [write, level],
  )

  const goTo = useCallback(
    (n: number) => {
      const target = levels.findIndex((l) => l.n === n)
      if (target !== -1 && n <= unlockedThrough) setIndex(target)
    },
    [levels, unlockedThrough],
  )

  const hasNext = index < levels.length - 1
  const next = useCallback(() => setIndex((i) => Math.min(i + 1, levels.length - 1)), [levels.length])

  return {
    level,
    index,
    levels,
    isCleared,
    clearLevel,
    goTo,
    next,
    hasNext,
    unlockedThrough,
    allCleared: levels.every((l) => cleared.has(l.n)),
    best: store[challengeId]?.best ?? {},
  }
}
