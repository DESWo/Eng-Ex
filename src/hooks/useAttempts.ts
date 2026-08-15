import { useCallback, useEffect, useState } from 'react'
import type { ChallengeLevel } from '@/lib/types'
import { playSound } from '@/lib/sound'

/**
 * Limited test runs per level, so a small search space cannot be brute-forced.
 * Running dry is not a lockout: the game resets, the pool refills, the level
 * starts over.
 */
export interface AttemptState {
  /** Tests remaining, or null when this level is unlimited. */
  left: number | null
  /**
   * Burn one attempt on a failed check. Returns true when that was the last
   * one, in which case the caller should reset the level and call refill().
   */
  spend: () => boolean
  /** Refill the pool after the level state has been reset. */
  refill: () => void
}

/**
 * Level 1 unlimited, since it is where the controls are learned. Optimize
 * levels get 5 because exploring trade-offs takes runs. Everything else gets 3,
 * which is few enough that guessing is worse than reasoning.
 */
export function attemptsFor(level: Pick<ChallengeLevel, 'n' | 'phase'>): number | null {
  if (level.n === 1) return null
  return level.phase === 'optimize' ? 5 : 3
}

export function useAttempts(allowance: number | null, levelN: number): AttemptState {
  const [left, setLeft] = useState<number | null>(allowance)

  // A new level starts with a fresh pool.
  useEffect(() => {
    setLeft(allowance)
  }, [allowance, levelN])

  const spend = useCallback(() => {
    if (allowance === null || left === null) {
      // unlimited levels still failed the check, so still buzz
      playSound('fail')
      return false
    }
    const next = Math.max(0, left - 1)
    setLeft(next)
    // running dry sounds different from an ordinary miss
    playSound(next === 0 ? 'reset' : 'fail')
    return next === 0
  }, [allowance, left])

  const refill = useCallback(() => setLeft(allowance), [allowance])

  return { left, spend, refill }
}
