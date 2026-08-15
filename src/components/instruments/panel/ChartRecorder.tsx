import { Engraved } from './PanelSurface'
import { INK, board, clamp01, digitClass, recessShadow } from './tokens'
import { cn } from '@/lib/utils'

/** One pen on the recorder. `points` are 0..1 of the paper height, oldest first. */
export interface RecorderPen {
  id: string
  /** Engraved key under the paper, e.g. "POWER". */
  label: string
  color: string
  points: number[]
  /** Current value in engineering units, shown in the key. */
  readout?: string
  dashed?: boolean
}

interface ChartRecorderProps {
  legend?: string
  pens: RecorderPen[]
  /** Sample slots across the paper. The newest sample sits at the right edge. */
  span: number
  /** Shaded target band, in the same 0..1 paper units as the pens. */
  band?: { from: number; to: number; label?: string }
  /** Sentence a screen reader gets in place of the trace. */
  summary: string
  /** Paper height in px. */
  height?: number
  className?: string
}

const W = 640
const PAD = 4

/**
 * A strip chart recorder: pens draw on ruled paper that scrolls right to left,
 * newest sample at the pen. Values arrive already scaled to the paper, so the
 * recorder never needs to know what it is drawing.
 */
export function ChartRecorder({
  legend = 'Trend recorder',
  pens,
  span,
  band,
  summary,
  height = 96,
  className,
}: ChartRecorderProps) {
  const H = 100
  const x = (i: number, n: number) => PAD + ((span - 1 - (n - 1 - i)) / (span - 1)) * (W - PAD * 2)
  const y = (v: number) => PAD + (1 - clamp01(v)) * (H - PAD * 2)

  return (
    <div className={className}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <Engraved>{legend}</Engraved>
        <div className="flex flex-wrap items-center gap-3">
          {pens.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-0.5 w-4 rounded-full"
                style={{ backgroundColor: p.color, opacity: p.dashed ? 0.7 : 1 }}
              />
              <Engraved className="text-[9px]">{p.label}</Engraved>
              {p.readout && <span className={cn(digitClass, 'text-[11px]')}>{p.readout}</span>}
            </span>
          ))}
        </div>
      </div>
      <div className={cn('overflow-hidden rounded-[3px]', board.recess)} style={recessShadow}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ height, width: '100%', display: 'block' }}
          role="img"
          aria-label={summary}
        >
          <rect x="0" y="0" width={W} height={H} fill={INK.paper} />
          {/* ruled paper: coarse horizontals, fine verticals */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" y1={y(f)} x2={W} y2={y(f)} stroke={INK.paperRule} strokeWidth="0.6" />
          ))}
          {Array.from({ length: 15 }, (_, i) => ((i + 1) / 16) * W).map((vx) => (
            <line key={vx} x1={vx} y1="0" x2={vx} y2={H} stroke={INK.paperRule} strokeWidth="0.4" opacity="0.6" />
          ))}
          {band && (
            <rect
              x="0"
              y={y(band.to)}
              width={W}
              height={Math.max(1, y(band.from) - y(band.to))}
              fill="#3f8f63"
              opacity="0.22"
            />
          )}
          {pens.map((p) => {
            // Never draw more than the paper holds, or the trace runs off the left edge.
            const pts = p.points.length > span ? p.points.slice(-span) : p.points
            const n = pts.length
            if (n === 0) return null
            const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i, n).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
            const last = pts[n - 1]
            return (
              <g key={p.id}>
                <path
                  d={d}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray={p.dashed ? '4 3' : undefined}
                />
                {/* the pen carriage itself, parked on the newest sample */}
                <path
                  d={`M ${x(n - 1, n).toFixed(1)} ${y(last).toFixed(1)} l 7 -4 l 0 8 Z`}
                  fill={p.color}
                  transform={`translate(${-3},0)`}
                />
              </g>
            )
          })}
          <rect x="0" y="0" width={W} height={H} fill="none" stroke="#00000033" strokeWidth="1" />
        </svg>
      </div>
      {band?.label && <Engraved className="mt-1 block text-[9px] text-slate-400">{band.label}</Engraved>}
    </div>
  )
}
