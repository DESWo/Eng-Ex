import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { benchLabel, benchSurface, ink, inkDim } from './theme'

interface BenchPanelProps {
  /** Silkscreened at the top left, e.g. "bench 01". */
  title: string
  /** Sits at the top right: rating, mode, whatever the panel is set to. */
  meta?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * The equipment shell. Dark anodized face, hairline bevel, four case screws,
 * silkscreen header. Everything else in the kit is designed to sit inside one.
 */
export function BenchPanel({ title, meta, children, className }: BenchPanelProps) {
  return (
    <div
      className={cn(
        benchSurface,
        'relative rounded-2xl border p-3 sm:p-4',
        'border-[var(--bench-edge,rgba(255,255,255,0.13))] bg-[var(--bench-face,#1c1a22)]',
        'shadow-clay',
        className,
      )}
    >
      {/* case screws */}
      {[
        ['left-2 top-2', ''],
        ['right-2 top-2', ''],
        ['left-2 bottom-2', ''],
        ['right-2 bottom-2', ''],
      ].map(([pos], i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            'pointer-events-none absolute h-2 w-2 rounded-full',
            'bg-[var(--bench-recess,#131218)] ring-1 ring-[var(--bench-edge,rgba(255,255,255,0.13))]',
            pos,
          )}
        />
      ))}

      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 px-3">
        <span className={cn(benchLabel, 'text-[var(--bench-dim,#a29b93)]')}>{title}</span>
        {meta && <div className="flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {children}
    </div>
  )
}

interface SheetProps {
  viewBox: string
  /** Names the drawing for screen readers. */
  label: string
  /** Rows of the title block, drawn bottom right of the sheet. */
  titleBlock?: string[]
  /** Rubber stamp across the sheet once the design passes. */
  stamp?: string
  /** Width of the sheet in viewBox units, for placing the title block. */
  width: number
  height: number
  children: ReactNode
  className?: string
}

/**
 * The schematic ground: a fine 8-unit grid with a 40-unit major, a drawn border,
 * and a title block. Deliberately not drafting paper. This is an EDA sheet.
 */
export function SchematicSheet({
  viewBox,
  label,
  titleBlock,
  stamp,
  width,
  height,
  children,
  className,
}: SheetProps) {
  const uid = useId().replace(/:/g, '')
  const minor = `grid-${uid}`
  const major = `grid-major-${uid}`

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border',
        'border-[var(--bench-edge,rgba(255,255,255,0.13))] bg-[var(--bench-recess,#131218)]',
        className,
      )}
    >
      <svg viewBox={viewBox} className="w-full" role="group" aria-label={label}>
        <defs>
          <pattern id={minor} width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M 8 0 L 0 0 0 8" fill="none" stroke="var(--bench-grid, rgba(255,255,255,0.055))" strokeWidth="1" />
          </pattern>
          <pattern id={major} width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill={`url(#${minor})`} />
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="var(--bench-grid-major, rgba(255,255,255,0.115))"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill={`url(#${major})`} />
        {/* drawing border, inset like a real sheet */}
        <rect
          x="6"
          y="6"
          width={width - 12}
          height={height - 12}
          fill="none"
          stroke="var(--bench-edge, rgba(255,255,255,0.13))"
          strokeWidth="1.5"
        />

        {children}

        {titleBlock && titleBlock.length > 0 && (
          <g transform={`translate(${width - 178}, ${height - 14 - titleBlock.length * 16})`}>
            <rect
              x="0"
              y="0"
              width="164"
              height={titleBlock.length * 16 + 6}
              fill="var(--bench-recess, #131218)"
              stroke="var(--bench-edge, rgba(255,255,255,0.13))"
              strokeWidth="1.5"
            />
            {titleBlock.map((row, i) => (
              <g key={row}>
                {i > 0 && (
                  <line
                    x1="0"
                    y1={i * 16 + 3}
                    x2="164"
                    y2={i * 16 + 3}
                    stroke="var(--bench-edge, rgba(255,255,255,0.13))"
                    strokeWidth="1"
                  />
                )}
                <text
                  x="8"
                  y={i * 16 + 15}
                  fontSize="10"
                  letterSpacing="1.4"
                  className="font-mono"
                  fill={i === 0 ? ink : inkDim}
                >
                  {row.toUpperCase()}
                </text>
              </g>
            ))}
          </g>
        )}

        {stamp && (
          <g transform={`translate(${width / 2}, 46) rotate(-8)`} opacity="0.9">
            <rect
              x="-86"
              y="-20"
              width="172"
              height="40"
              rx="4"
              fill="none"
              stroke="var(--bench-trace, #6ef2a6)"
              strokeWidth="3"
            />
            <text
              textAnchor="middle"
              y="8"
              fontSize="22"
              letterSpacing="4"
              className="font-mono"
              fill="var(--bench-trace, #6ef2a6)"
            >
              {stamp.toUpperCase()}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
