import { cn } from '@/lib/utils'
import { benchLabel } from './theme'

interface ScopeProps {
  /** Newest sample last. Values in `unit`, zero at the bottom graticule line. */
  samples: number[]
  /** Vertical scale: one division is this many units. */
  perDivY: number
  /** Horizontal scale, already worded: "0.6 s". */
  perDivX: string
  unit: string
  /** Silkscreened above the screen: "ch1 source current". */
  channel: string
  /** Trace is pinned to the top rail and the over flag lights. */
  overRange?: boolean
  divsX?: number
  divsY?: number
  className?: string
}

const W = 300
const H = 170

/**
 * The scope. Use it wherever a value moves over time: it is the only instrument
 * on the bench that shows history rather than a number.
 *
 * The trace is sample and hold, drawn as steps, because a bench supply changes
 * when the circuit changes and holds flat in between.
 */
export function Oscilloscope({
  samples,
  perDivY,
  perDivX,
  unit,
  channel,
  overRange = false,
  divsX = 10,
  divsY = 8,
  className,
}: ScopeProps) {
  const full = perDivY * divsY
  const now = samples.length > 0 ? samples[samples.length - 1] : 0
  const peak = samples.length > 0 ? Math.max(...samples) : 0

  const yOf = (v: number) => H - Math.max(0, Math.min(1, v / full)) * H
  const xOf = (i: number) => (samples.length < 2 ? 0 : (i / (samples.length - 1)) * W)

  let d = ''
  if (samples.length > 0) {
    d = `M 0 ${yOf(samples[0])}`
    for (let i = 1; i < samples.length; i++) {
      d += ` L ${xOf(i)} ${yOf(samples[i - 1])} L ${xOf(i)} ${yOf(samples[i])}`
    }
    if (samples.length === 1) d += ` L ${W} ${yOf(samples[0])}`
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn(benchLabel, 'text-[var(--bench-dim,#a29b93)]')}>{channel}</span>
        <span className={cn(benchLabel, overRange ? 'text-[var(--bench-fault,#ff6b5c)]' : 'text-[var(--bench-trace,#6ef2a6)]')}>
          {overRange ? 'over' : `${now.toFixed(2)} ${unit}`}
        </span>
      </div>

      <svg
        viewBox={`-16 -8 ${W + 24} ${H + 30}`}
        className="w-full rounded-lg bg-[var(--bench-lcd,#101c18)]"
        role="img"
        aria-label={`${channel} trace. Now ${now.toFixed(2)} ${unit}, peak ${peak.toFixed(2)} ${unit} over the last ${divsX} divisions at ${perDivX} per division.`}
      >
        {/* graticule */}
        {Array.from({ length: divsX + 1 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={(i / divsX) * W}
            y1={0}
            x2={(i / divsX) * W}
            y2={H}
            stroke="var(--bench-trace, #6ef2a6)"
            strokeOpacity={i === 0 || i === divsX ? 0.4 : 0.13}
            strokeWidth="1"
          />
        ))}
        {Array.from({ length: divsY + 1 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={(i / divsY) * H}
            x2={W}
            y2={(i / divsY) * H}
            stroke="var(--bench-trace, #6ef2a6)"
            strokeOpacity={i === 0 || i === divsY ? 0.4 : 0.13}
            strokeWidth="1"
          />
        ))}
        {/* centre tick marks, one per fifth of a division */}
        {Array.from({ length: divsX * 5 - 1 }, (_, i) => (
          <line
            key={`t${i}`}
            x1={((i + 1) / (divsX * 5)) * W}
            y1={H / 2 - 3}
            x2={((i + 1) / (divsX * 5)) * W}
            y2={H / 2 + 3}
            stroke="var(--bench-trace, #6ef2a6)"
            strokeOpacity="0.3"
            strokeWidth="1"
          />
        ))}

        {/* ground reference at the bottom rail */}
        <path d={`M -14 ${H} l 10 -5 v 10 z`} fill="var(--bench-trace, #6ef2a6)" opacity="0.75" />

        {d && (
          <>
            <path d={d} fill="none" stroke="var(--bench-trace, #6ef2a6)" strokeWidth="5" opacity="0.16" />
            <path d={d} fill="none" stroke="var(--bench-trace, #6ef2a6)" strokeWidth="2" />
          </>
        )}

        {overRange && (
          <line x1="0" y1="2" x2={W} y2="2" stroke="var(--bench-fault, #ff6b5c)" strokeWidth="3" />
        )}

        <text x="0" y={H + 18} fontSize="11" className="font-mono" fill="var(--bench-trace, #6ef2a6)" opacity="0.75">
          {perDivX}/div
        </text>
        <text
          x={W}
          y={H + 18}
          textAnchor="end"
          fontSize="11"
          className="font-mono"
          fill="var(--bench-trace, #6ef2a6)"
          opacity="0.75"
        >
          {perDivY} {unit}/div
        </text>
      </svg>
    </div>
  )
}
