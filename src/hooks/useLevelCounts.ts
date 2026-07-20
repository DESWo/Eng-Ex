import { useMemo, useSyncExternalStore } from 'react'
import { SAVE_EVENT, rawSnapshot } from '@/lib/storage'
import { LEVELS_PER_CHALLENGE } from '@/lib/mastery'

/** challenge id -> which level numbers are cleared. Written by useLevels. */
type LevelStore = Record<string, { cleared?: number[] }>

function subscribe(onChange: () => void) {
  const handler = (e: Event) => {
    if ((e as CustomEvent<string>).detail === 'levels') onChange()
  }
  window.addEventListener(SAVE_EVENT, handler)
  return () => window.removeEventListener(SAVE_EVENT, handler)
}

/**
 * Live lookup of how many levels a challenge has cleared (0..5).
 * Re-reads whenever any game saves, so a picker chip ticks up the moment the
 * level is beaten inside the game below it.
 */
export function useLevelCounts(): (challengeId: string) => number {
  const raw = useSyncExternalStore(subscribe, () => rawSnapshot('levels'))

  return useMemo(() => {
    let store: LevelStore = {}
    try {
      store = raw ? (JSON.parse(raw) as LevelStore) : {}
    } catch {
      // Unreadable storage counts as no progress rather than a crash.
    }
    return (challengeId: string) => {
      const done = store[challengeId]?.cleared ?? []
      return done.filter((n) => n >= 1 && n <= LEVELS_PER_CHALLENGE).length
    }
  }, [raw])
}
