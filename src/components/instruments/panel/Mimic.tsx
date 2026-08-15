import type { ReactNode } from 'react'
import { Engraved } from './PanelSurface'
import { LAMP, board, recessShadow } from './tokens'
import type { LampTone } from './tokens'
import { cn } from '@/lib/utils'

interface MimicBoardProps {
  legend: string
  /** Right side of the legend strip: digital repeats, plates. */
  right?: ReactNode
  viewBox: string
  /** What the diagram is showing right now, for screen readers. */
  summary: string
  children: ReactNode
  className?: string
}

/**
 * The line diagram of the plant, cut into the board. Draw process lines in
 * INK.line, equipment in slate fills, and put every live number in a
 * DigitalWindow rather than as loose SVG text.
 */
export function MimicBoard({ legend, right, viewBox, summary, children, className }: MimicBoardProps) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <Engraved>{legend}</Engraved>
        {right}
      </div>
      <div className={cn('overflow-hidden rounded-[3px]', board.recess)} style={recessShadow}>
        <svg viewBox={viewBox} className="block w-full" role="img" aria-label={summary}>
          {children}
        </svg>
      </div>
    </div>
  )
}

/** An indicator lamp for use inside a mimic diagram. */
export function MimicLamp({ x, y, r = 5, tone = 'green', lit }: { x: number; y: number; r?: number; tone?: LampTone; lit: boolean }) {
  const ink = LAMP[tone]
  return (
    <g>
      {lit && <circle cx={x} cy={y} r={r * 2.1} fill={ink.lit} opacity="0.22" />}
      <circle cx={x} cy={y} r={r} fill={lit ? ink.lit : ink.off} stroke="#0b0e11" strokeWidth="1" />
    </g>
  )
}
