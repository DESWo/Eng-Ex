import { cn } from '@/lib/utils'
import { benchDigits, benchLabel } from './theme'

/** A pin the probe can sit on. */
export interface BenchNode {
  id: string
  x: number
  y: number
  /** Spoken name: "LP1 pin A", "battery plus rail". */
  label: string
}

export type MeterMode = 'DCV' | 'DCA' | 'CONT'

export interface MeterReading {
  /** The number, already formatted: "9.00", "OL", "- - -". */
  value: string
  unit: string
  /** Where the probe is, in designators. */
  node?: string
  /** One line of context under the digits. */
  note?: string
  state?: 'ok' | 'over' | 'none'
}

/**
 * The meter. Its whole point is that it reads ONE node at a time: the student
 * decides where to measure instead of being handed every number at once.
 *
 * `announce` is spoken by the live region whenever the probe moves or the
 * circuit changes, which is the keyboard path to every reading on the sheet.
 */
export function ProbeMeter({
  reading,
  mode = 'DCV',
  announce,
  className,
}: {
  reading: MeterReading
  mode?: MeterMode
  announce: string
  className?: string
}) {
  const modes: MeterMode[] = ['DCV', 'DCA', 'CONT']
  const tone =
    reading.state === 'over'
      ? 'var(--bench-fault, #ff6b5c)'
      : reading.state === 'none'
        ? 'var(--bench-dim, #a29b93)'
        : 'var(--bench-trace, #6ef2a6)'

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--bench-edge,rgba(255,255,255,0.13))] bg-[var(--bench-recess,#131218)] p-3',
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={cn(benchLabel, 'text-[var(--bench-dim,#a29b93)]')}>bench meter</span>
        <div className="flex gap-1" aria-hidden>
          {modes.map((m) => (
            <span
              key={m}
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-widest',
                m === mode
                  ? 'bg-[var(--bench-trace,#6ef2a6)] text-[var(--bench-lcd,#101c18)]'
                  : 'text-[var(--bench-dim,#a29b93)] opacity-60',
              )}
            >
              {m}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-[var(--bench-lcd,#101c18)] px-3 py-2.5">
        <div className="flex items-baseline justify-end gap-1.5">
          <span className={cn(benchDigits, 'text-3xl font-semibold leading-none')} style={{ color: tone }}>
            {reading.value}
          </span>
          <span className={cn(benchDigits, 'text-sm')} style={{ color: tone }}>
            {reading.unit}
          </span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <span className={cn(benchLabel, 'text-[var(--bench-trace,#6ef2a6)] opacity-80')}>
            {reading.node ?? 'no probe'}
          </span>
          <span className="font-mono text-[10px] text-[var(--bench-dim,#a29b93)]">{reading.note ?? ''}</span>
        </div>
      </div>

      {/* lead jacks, red on the probe, black on the minus rail */}
      <div className="mt-2 flex items-center gap-3" aria-hidden>
        {[
          ['com', '#111', 'on the − rail'],
          ['v Ω', 'var(--bench-probe, #e5484d)', 'in your hand'],
        ].map(([jack, color, note]) => (
          <span key={jack} className="flex items-center gap-1.5">
            <span
              className="h-3.5 w-3.5 rounded-full ring-2 ring-[var(--bench-edge,rgba(255,255,255,0.13))]"
              style={{ background: color }}
            />
            <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--bench-dim,#a29b93)]">
              {jack} {note}
            </span>
          </span>
        ))}
      </div>

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  )
}

/** The probe itself, drawn on the sheet with its tip on the node. */
export function ProbeTip({ x, y }: { x: number; y: number }) {
  return (
    <g aria-hidden transform={`translate(${x}, ${y})`} style={{ pointerEvents: 'none' }}>
      <path d="M 0 0 L 9 -9 L 15 -3 L 6 6 Z" fill="var(--bench-ink, #eae7e3)" opacity="0.9" />
      <rect
        x="11"
        y="-30"
        width="11"
        height="30"
        rx="3"
        transform="rotate(45 11 -30)"
        fill="var(--bench-probe, #e5484d)"
      />
      <path
        d="M 34 -34 q 26 -6 42 10"
        fill="none"
        stroke="var(--bench-probe, #e5484d)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.85"
      />
      <circle cx="0" cy="0" r="3" fill="var(--bench-probe, #e5484d)" />
    </g>
  )
}

/**
 * Move the probe to the next pin in a direction. Nothing that way wraps to the
 * far side, so arrow keys always land somewhere.
 */
export function stepNode(nodes: BenchNode[], from: string | null, dir: 'left' | 'right' | 'up' | 'down'): string | null {
  if (nodes.length === 0) return null
  const here = nodes.find((n) => n.id === from)
  if (!here) return nodes[0].id

  const along = (n: BenchNode) =>
    dir === 'left' ? here.x - n.x : dir === 'right' ? n.x - here.x : dir === 'up' ? here.y - n.y : n.y - here.y
  const across = (n: BenchNode) => (dir === 'left' || dir === 'right' ? Math.abs(n.y - here.y) : Math.abs(n.x - here.x))

  const ahead = nodes.filter((n) => n.id !== here.id && along(n) > 1)
  if (ahead.length > 0) {
    // nearest in the direction of travel, with sideways drift penalised
    return ahead.reduce((best, n) => (along(n) + across(n) * 2 < along(best) + across(best) * 2 ? n : best)).id
  }
  // wrap: the pin furthest back the other way
  return nodes.reduce((best, n) => (along(n) < along(best) ? n : best)).id
}
