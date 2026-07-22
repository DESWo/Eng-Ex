import { useCallback, useEffect, useState } from 'react'
import type { ChallengeLevel } from '@/lib/types'
import { playSound } from '@/lib/sound'

/**
 * Limited test runs per level, so brute-forcing a small search space stops
 * being a strategy. Running dry is not a lockout: the game resets its bench,
 * the pool refills, and the player starts the level over having spent nothing
 * but pride.
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
 * The house rule: level 1 is unlimited (learn the controls in peace),
 * the level 5 optimization gets a longer leash, everything else gets 4.
 */
export function attemptsFor(level: Pick<ChallengeLevel, 'n' | 'phase'>): number | null {
  if (level.n === 1) return null
  return level.phase === 'optimize' ? 6 : 4
}

export function useAttempts(allowance: number | null, levelN: number): AttemptState {
  const [left, setLeft] = useState<number | null>(allowance)

  // A new level starts with a fresh pool.
  useEffect(() => {
    setLeft(allowance)
  }, [allowance, levelN])

  const spend = useCallback(() => {
    if (allowance === null || left === null) {
      // Unlimited levels still failed a check, so they still get the buzz.
      playSound('fail')
      return false
    }
    const next = Math.max(0, left - 1)
    setLeft(next)
    // Running dry sounds different from an ordinary miss: the bench is cleared.
    playSound(next === 0 ? 'reset' : 'fail')
    return next === 0
  }, [allowance, left])

  const refill = useCallback(() => setLeft(allowance), [allowance])

  return { left, spend, refill }
}
