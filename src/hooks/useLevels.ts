import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChallengeLevel } from '@/lib/types'
import { loadJson, saveJson } from '@/lib/storage'
import { playSound } from '@/lib/sound'

/** challenge id -> which level numbers are cleared, plus best scores per metric. */
type LevelStore = Record<
  string,
  {
    cleared?: number[]
    /** metric id -> the best value the player has managed. */
    best?: Record<string, number>
    /** level number -> best star rating earned on it (1..3). */
    stars?: Record<number, number>
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
  /** Best stars earned on a level, 0 if never cleared. */
  starsFor: (n: number) => number
  /** Stars just earned on the current level, for the win bar. */
  starsNow: number
  /** Called by the shared hint disclosure: opening it costs a star. */
  noteHint: () => void
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

  // Stars are earned, not stored mid-run: peeking at the hint or coming back to
  // a level after leaving it both cost one. Kept per session so a fresh visit
  // to an old level is a genuine second chance at three.
  const [hinted, setHinted] = useState<Set<number>>(() => new Set())
  const [revisited, setRevisited] = useState<Set<number>>(() => new Set())
  const seenRef = useRef<Set<number>>(new Set())
  // Challenges rebuild their `levels` array every render, so this effect must
  // depend on `index` alone. Including `levels` re-fired it on every render and
  // instantly flagged a revisit, capping everyone at two stars.
  const levelsRef = useRef(levels)
  levelsRef.current = levels
  const prevIndexRef = useRef<number | null>(null)
  useEffect(() => {
    // Guard on a real index change. StrictMode runs effects twice on mount, and
    // without this the second pass sees the level already in `seen` and marks
    // the opening level as a revisit, making three stars unreachable.
    if (prevIndexRef.current === index) return
    prevIndexRef.current = index
    const all = levelsRef.current
    const n = all[Math.min(index, all.length - 1)]?.n
    if (n === undefined) return
    if (seenRef.current.has(n)) setRevisited((prev) => (prev.has(n) ? prev : new Set(prev).add(n)))
    seenRef.current.add(n)
  }, [index])

  const noteHint = useCallback(() => {
    const n = level?.n
    if (n !== undefined) setHinted((prev) => (prev.has(n) ? prev : new Set(prev).add(n)))
  }, [level])

  const starsFor = useCallback(
    (n: number) => store[challengeId]?.stars?.[n] ?? 0,
    [store, challengeId],
  )

  /** 3 = solved cold, 2 = needed the hint or a second look, 1 = got there. */
  const earnedStars = useCallback(
    (n: number) => (hinted.has(n) ? 1 : revisited.has(n) ? 2 : 3),
    [hinted, revisited],
  )

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
      // Every game routes its win through here, so this is the one place the
      // victory sound has to live.
      playSound('levelClear')
      write((entry) => {
        const nextCleared = entry.cleared?.includes(level.n)
          ? entry.cleared
          : [...(entry.cleared ?? []), level.n]

        // Keep the best rating ever earned, so replaying can only help.
        const won = earnedStars(level.n)
        const stars = { ...(entry.stars ?? {}) }
        if (won > (stars[level.n] ?? 0)) stars[level.n] = won

        if (!scores) return { ...entry, cleared: nextCleared, stars }

        const best = { ...(entry.best ?? {}) }
        for (const metric of level.metrics ?? []) {
          const value = scores[metric.id]
          if (value === undefined) continue
          const prev = best[metric.id]
          const better =
            prev === undefined || (metric.goal === 'min' ? value < prev : value > prev)
          if (better) best[metric.id] = value
        }
        return { ...entry, cleared: nextCleared, best, stars }
      })
    },
    [write, level, earnedStars],
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
    starsFor,
    starsNow: level ? earnedStars(level.n) : 0,
    noteHint,
  }
}
