import { useCallback, useEffect, useRef, useState } from 'react'
import type { LampTone } from './tokens'
import { playSound } from '@/lib/sound'

/** One alarm window on the annunciator panel. */
export interface AnnunciatorDef {
  id: string
  /** Engraved legend, two or three words. */
  legend: string
  tone?: LampTone
}

/**
 * `clear`   dark.
 * `unacked` tripped and not yet acknowledged: flashing, and it stays lit even
 *           after the condition goes away. This is the latch.
 * `acked`   acknowledged while still true: steady lit until the condition clears.
 */
export type AnnunciatorStatus = 'clear' | 'unacked' | 'acked'

export interface AnnunciatorTile extends AnnunciatorDef {
  status: AnnunciatorStatus
  /** Whether the underlying condition is true right now. */
  live: boolean
}

export interface AnnunciatorState {
  tiles: AnnunciatorTile[]
  /** Number of windows waiting for an acknowledge. */
  unacked: number
  acknowledge: () => void
  /** Drop every latch, e.g. on a scram or a level change. */
  reset: () => void
}

/**
 * Latching alarm logic.
 *
 * `live` maps tile id to whether its condition is true this instant. A window
 * that trips latches in until the operator acknowledges it, which is what makes
 * a control board different from a status light: you cannot miss an alarm by
 * looking away, because the board remembers.
 */
export function useAnnunciators(defs: AnnunciatorDef[], live: Record<string, boolean>): AnnunciatorState {
  const [status, setStatus] = useState<Record<string, AnnunciatorStatus>>({})
  // Defs, conditions and the latch itself live in refs, so the effect keys on
  // the bit pattern alone instead of refiring on every render of the game
  // around it, and the horn cannot sound twice for one trip under StrictMode.
  const defsRef = useRef(defs)
  defsRef.current = defs
  const liveRef = useRef(live)
  liveRef.current = live
  const statusRef = useRef<Record<string, AnnunciatorStatus>>({})
  const bits = defs.map((d) => (live[d.id] ? '1' : '0')).join('')

  useEffect(() => {
    const prev = statusRef.current
    const next = { ...prev }
    let changed = false
    let tripped = false
    for (const d of defsRef.current) {
      const on = liveRef.current[d.id] === true
      const was = prev[d.id] ?? 'clear'
      if (on && was === 'clear') {
        next[d.id] = 'unacked'
        changed = true
        tripped = true
      } else if (!on && was === 'acked') {
        next[d.id] = 'clear'
        changed = true
      }
    }
    if (!changed) return
    statusRef.current = next
    if (tripped) playSound('zap')
    setStatus(next)
  }, [bits])

  const acknowledge = useCallback(() => {
    const prev = statusRef.current
    const next = { ...prev }
    for (const d of defsRef.current) {
      if (prev[d.id] === 'unacked') next[d.id] = liveRef.current[d.id] === true ? 'acked' : 'clear'
    }
    playSound('click')
    statusRef.current = next
    setStatus(next)
  }, [])

  const reset = useCallback(() => {
    statusRef.current = {}
    setStatus({})
  }, [])

  const tiles = defs.map((d) => ({ ...d, status: status[d.id] ?? 'clear', live: live[d.id] === true }))
  return { tiles, unacked: tiles.filter((t) => t.status === 'unacked').length, acknowledge, reset }
}
