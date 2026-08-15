import { loadJson } from '@/lib/storage'
import type { Discipline } from '@/lib/types'

/** challenge id -> which level numbers are cleared. Written by useLevels. */
type LevelStore = Record<string, { cleared?: number[] }>

export const LEVELS_PER_CHALLENGE = 5

export type MasteryTier = 'untouched' | 'explored' | 'solid' | 'mastered'

export interface Mastery {
  cleared: number
  total: number
  tier: MasteryTier
}

export const TIER_LABEL: Record<MasteryTier, string> = {
  untouched: 'Not started',
  explored: 'Explored',
  solid: 'Solid',
  mastered: 'Mastered',
}

/**
 * Progress through a field, counted in levels (15 per field) rather than in
 * flow steps. The step-based percentage in useProgress reads 100% after one
 * challenge at level 1, which is not the same question.
 */
export function masteryFor(discipline: Discipline): Mastery {
  const store = loadJson<LevelStore>('levels', {})
  const total = discipline.challenges.length * LEVELS_PER_CHALLENGE

  let cleared = 0
  let everyGameAtThree = discipline.challenges.length > 0
  for (const c of discipline.challenges) {
    const done = store[c.id]?.cleared ?? []
    cleared += done.filter((n) => n >= 1 && n <= LEVELS_PER_CHALLENGE).length
    // "solid" requires every game at level 3+, not one game played to death
    if (!done.some((n) => n >= 3)) everyGameAtThree = false
  }

  const tier: MasteryTier =
    cleared === 0
      ? 'untouched'
      : cleared >= total
        ? 'mastered'
        : everyGameAtThree
          ? 'solid'
          : 'explored'

  return { cleared, total, tier }
}
