import { useEffect, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

interface TickerProps {
  value: number
  /** Turn the animated value into display text. Defaults to a rounded integer. */
  format?: (n: number) => string
  /** Seconds the count takes. */
  duration?: number
}

/**
 * A number that counts to its new value instead of snapping.
 *
 * Used on the scorecard, where watching cost slide down as you strip weight out
 * of a design is most of the feedback. Anyone who has asked for reduced motion
 * gets the final number immediately.
 */
export function Ticker({ value, format, duration = 0.5 }: TickerProps) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(value)

  useEffect(() => {
    if (reduced) {
      setShown(value)
      return
    }
    const controls = animate(shown, value, {
      duration,
      ease: 'easeOut',
      onUpdate: setShown,
    })
    return () => controls.stop()
    // Chasing `shown` here would restart the animation on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced, duration])

  return <span className="tabular-nums">{format ? format(shown) : Math.round(shown).toLocaleString()}</span>
}
