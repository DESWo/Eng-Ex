import type { LevelPhase } from '@/lib/types'

/**
 * The progression arc, spelled out for the UI.
 * Levels 2 and 3 share the "understand" phase: the first adds a limit,
 * the second adds a real engineering concept on top of it.
 */
export const PHASE_META: Record<LevelPhase, { label: string; chip: string }> = {
  play: {
    label: 'Play',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  },
  understand: {
    label: 'Understand',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  analyze: {
    label: 'Analyze',
    chip: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  },
  optimize: {
    label: 'Optimize',
    chip: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  },
}
