import { useEffect, useRef, useState } from 'react'
import { RoughRect } from '@/components/ui/Sketchy'

interface SketchFrameProps {
  /** Tailwind stroke class for the pen, e.g. "stroke-ink/20". */
  className?: string
  /** Inset from the edge of the parent, in pixels. */
  inset?: number
  /** Corner rounding is not sketched, so this only affects the drawn box. */
  roughness?: number
}

/**
 * A hand-drawn border that sizes itself to whatever it is placed inside.
 *
 * The parent needs `position: relative`. The frame measures its own box rather
 * than stretching a fixed viewBox, because a squashed sketch loses the even
 * pen pressure that makes it read as drawn by hand.
 *
 * Sizes are rounded to a few pixels before they reach Rough, so a window
 * resize redraws the sketch in steps instead of reshuffling it continuously.
 */
export function SketchFrame({ className = 'stroke-ink/25 dark:stroke-white/25', inset = 2, roughness = 1.4 }: SketchFrameProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      // Quantised so a drag-resize does not regenerate the sketch every pixel.
      const w = Math.round(width / 4) * 4
      const h = Math.round(height / 4) * 4
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {size.w > 0 && size.h > 0 && (
        <svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} className="overflow-visible">
          <RoughRect
            x={inset}
            y={inset}
            width={Math.max(1, size.w - inset * 2)}
            height={Math.max(1, size.h - inset * 2)}
            className={className}
            options={{ roughness, bowing: 1.6, strokeWidth: 1.6 }}
          />
        </svg>
      )}
    </div>
  )
}
