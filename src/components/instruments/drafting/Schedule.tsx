import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { LETTER, TRACK } from './tokens'

const CAPS = cn(LETTER, 'text-[9px] leading-none text-[var(--dr-ink-soft)]')

export interface ScheduleColumn {
  key: string
  label: string
  align?: 'left' | 'right'
}

export interface ScheduleRow {
  key: string
  cells: Record<string, ReactNode>
  /** Marks the row as the one that busts a limit. */
  over?: boolean
}

export interface ScheduleFoot {
  label: string
  value: ReactNode
  tone?: 'normal' | 'over' | 'ok'
}

interface ScheduleProps {
  title: string
  columns: ScheduleColumn[]
  rows: ScheduleRow[]
  /** Totals, budget, variance: the lines under the rule. */
  foot?: ScheduleFoot[]
  /** Shown in place of the rows when there is nothing scheduled yet. */
  empty?: string
  className?: string
}

const FOOT_TONE = {
  normal: 'text-[var(--dr-ink)]',
  over: 'text-[var(--dr-red)]',
  ok: 'text-[var(--dr-check)]',
} as const

/**
 * A parts schedule: what is drawn, how much of it, and what it costs. This is
 * the readout convention for quantities on a drafting sheet. Never a progress
 * bar, always a table you could hand to a supplier.
 */
export function Schedule({ title, columns, rows, foot, empty, className }: ScheduleProps) {
  return (
    <div className={cn('border border-[var(--dr-ink)]/45 bg-[var(--dr-paper-2)]', className)}>
      <p className={cn(CAPS, 'border-b border-[var(--dr-ink)]/45 px-2.5 py-1.5')} style={{ letterSpacing: TRACK.wide }}>
        {title}
      </p>
      <table className="w-full border-collapse font-mono text-[11px] text-[var(--dr-ink)]">
        <thead>
          <tr className="border-b border-[var(--dr-ink)]/30">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(CAPS, 'px-2.5 py-1.5 font-normal', c.align === 'right' ? 'text-right' : 'text-left')}
                style={{ letterSpacing: TRACK.wide }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty && (
            <tr>
              <td colSpan={columns.length} className="px-2.5 py-2 text-[var(--dr-ink-soft)]">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.key} className={cn('border-b border-[var(--dr-ink)]/12', r.over && 'text-[var(--dr-red)]')}>
              {columns.map((c) => (
                <td key={c.key} className={cn('px-2.5 py-1 tabular-nums', c.align === 'right' ? 'text-right' : 'text-left')}>
                  {r.cells[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && foot.length > 0 && (
          <tfoot>
            {foot.map((f) => (
              <tr key={f.label} className="border-t border-[var(--dr-ink)]/45">
                <td colSpan={Math.max(1, columns.length - 1)} className={cn(CAPS, 'px-2.5 py-1.5')} style={{ letterSpacing: TRACK.wide }}>
                  {f.label}
                </td>
                <td className={cn('px-2.5 py-1.5 text-right font-semibold tabular-nums', FOOT_TONE[f.tone ?? 'normal'])}>
                  {f.value}
                </td>
              </tr>
            ))}
          </tfoot>
        )}
      </table>
    </div>
  )
}

export interface StencilOption {
  id: string
  /** The mark this material carries on the drawing, e.g. "W" or "S". */
  mark: string
  label: string
  /** One line of properties: rate, capacity, whatever the game bills by. */
  note?: string
  /** A 26x14 SVG fragment showing how the material is drawn. */
  swatch: ReactNode
}

interface StencilPaletteProps {
  label: string
  options: StencilOption[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  className?: string
}

/**
 * The stencil: pick the shape you are about to draw with. A radio group, so
 * arrow keys move between cutouts and the choice is announced as a choice.
 */
export function StencilPalette({ label, options, value, onChange, disabled, className }: StencilPaletteProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  const step = (from: number, delta: number) => {
    const next = options[(from + delta + options.length) % options.length]
    onChange(next.id)
    refs.current[next.id]?.focus()
  }

  return (
    <div className={cn('border border-[var(--dr-ink)]/45 bg-[var(--dr-paper-2)]', className)}>
      <p className={cn(CAPS, 'border-b border-[var(--dr-ink)]/45 px-2.5 py-1.5')} style={{ letterSpacing: TRACK.wide }} id={`stencil-${label}`}>
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={`stencil-${label}`} className="flex flex-wrap gap-2 p-2">
        {options.map((o, i) => {
          const on = o.id === value
          return (
            <button
              key={o.id}
              ref={(el) => {
                refs.current[o.id] = el
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(o.id)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  step(i, 1)
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  step(i, -1)
                }
              }}
              className={cn(
                'flex min-w-[8.5rem] flex-1 items-center gap-2.5 border px-2.5 py-2 text-left transition-colors duration-150',
                on
                  ? 'border-[var(--dr-ink)] bg-[var(--dr-paper)]'
                  : 'border-dashed border-[var(--dr-ink)]/35 hover:border-[var(--dr-ink)]/70',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <svg viewBox="0 0 26 14" className="h-3.5 w-[26px] shrink-0" aria-hidden>
                {o.swatch}
              </svg>
              <span className="min-w-0">
                <span className={cn(LETTER, 'block text-[10px] font-semibold text-[var(--dr-ink)]')} style={{ letterSpacing: TRACK.normal }}>
                  {o.mark} · {o.label}
                </span>
                {o.note && <span className="block font-mono text-[10px] leading-tight text-[var(--dr-ink-soft)]">{o.note}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** The key: what each line on the drawing means. Samples, not colour chips. */
export function DrawingKey({ title, items, className }: { title: string; items: { label: string; sample: ReactNode }[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      <span className={cn(CAPS)} style={{ letterSpacing: TRACK.wide }}>
        {title}
      </span>
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--dr-ink-soft)]">
          <svg viewBox="0 0 26 10" className="h-2.5 w-[26px] shrink-0" aria-hidden>
            {it.sample}
          </svg>
          {it.label}
        </span>
      ))}
    </div>
  )
}

const NOTE_TONE = {
  normal: 'border-[var(--dr-ink)]/45 text-[var(--dr-ink)]',
  red: 'border-[var(--dr-red)] text-[var(--dr-red)]',
  amber: 'border-[var(--dr-amber)] text-[var(--dr-amber)]',
  check: 'border-[var(--dr-check)] text-[var(--dr-check)]',
} as const

/**
 * A general note. Verdicts, warnings and hints are all lettered notes on the
 * sheet, numbered the way notes are numbered, never toast popups.
 */
export function NoteBlock({ n, tone = 'normal', children, className }: { n: number | string; tone?: keyof typeof NOTE_TONE; children: ReactNode; className?: string }) {
  return (
    <div className={cn('border-l-2 bg-[var(--dr-paper-2)] px-3 py-2', NOTE_TONE[tone], className)}>
      <p className={cn(LETTER, 'text-[9px] leading-none opacity-80')} style={{ letterSpacing: TRACK.wide }}>
        note {n}
      </p>
      <p className="mt-1 text-sm leading-snug">{children}</p>
    </div>
  )
}

/** An instrument on the sheet edge: pencil, eraser, whatever the game draws with. */
export function SheetTool({
  active,
  onClick,
  disabled,
  icon,
  label,
  tone = 'ink',
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  icon: ReactNode
  label: string
  tone?: 'ink' | 'red'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 border px-2.5 py-1.5 transition-colors duration-150',
        LETTER,
        'text-[10px] font-semibold',
        active
          ? tone === 'red'
            ? 'border-[var(--dr-red)] bg-[var(--dr-red)]/10 text-[var(--dr-red)]'
            : 'border-[var(--dr-ink)] bg-[var(--dr-ink)]/10 text-[var(--dr-ink)]'
          : 'border-dashed border-[var(--dr-ink)]/40 text-[var(--dr-ink-soft)] hover:border-[var(--dr-ink)]/70',
        disabled && 'cursor-not-allowed opacity-50',
      )}
      style={{ letterSpacing: TRACK.wide }}
    >
      {icon}
      {label}
    </button>
  )
}
