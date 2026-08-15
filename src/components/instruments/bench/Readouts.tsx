import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { benchLabel } from './theme'

/** A panel LED. Off is a dark lens, not a missing element. */
export function StatusLamp({
  on,
  tone = 'var(--bench-trace, #6ef2a6)',
  label,
}: {
  on: boolean
  tone?: string
  label?: string
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-[var(--bench-edge,rgba(255,255,255,0.13))]"
        style={{
          background: on ? tone : 'var(--bench-face, #1c1a22)',
          boxShadow: on ? `0 0 8px ${tone}` : 'none',
        }}
      />
      {label && <span className="font-mono text-[10px] text-[var(--bench-dim,#a29b93)]">{label}</span>}
    </span>
  )
}

interface ToolOption<T extends string> {
  id: T
  label: string
  hint: string
  icon?: ReactNode
}

/**
 * Which tool is in the student's hand. The bench has verbs, not modes: one tool
 * builds, the other measures, and only one is held at a time.
 */
export function ToolSelector<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: ToolOption<T>[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div
      className={cn('flex gap-1 rounded-full border border-[var(--bench-edge,rgba(255,255,255,0.13))] p-1', className)}
      role="group"
      aria-label="Bench tool"
    >
      {options.map((opt) => {
        const active = opt.id === value
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            title={opt.hint}
            onClick={() => onChange(opt.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest',
              'transition-colors duration-150',
              active
                ? 'bg-[var(--accent,#7163dd)] text-white'
                : 'text-[var(--bench-dim,#a29b93)] hover:bg-white/5',
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * The test schedule: what the design has to do, line by line, with a lamp per
 * line. This is how every bench game states its requirements.
 */
export function SpecList({
  title = 'test schedule',
  items,
  className,
}: {
  title?: string
  items: { text: string; met: boolean }[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--bench-edge,rgba(255,255,255,0.13))] bg-[var(--bench-recess,#131218)] p-3',
        className,
      )}
    >
      <p className={cn(benchLabel, 'mb-2 text-[var(--bench-dim,#a29b93)]')}>{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={item.text} className="flex items-start gap-2">
            <span className="pt-0.5">
              <StatusLamp on={item.met} />
            </span>
            <span className="font-mono text-[11px] leading-snug text-[var(--bench-ink,#eae7e3)]">
              <span className="text-[var(--bench-dim,#a29b93)]">{String(i + 1).padStart(2, '0')} </span>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The result strip. Every bench game says what happened here and nowhere else,
 * and it is a live region, so a screen reader hears the same sentence.
 */
export function BenchVerdict({
  verdict,
  idle,
  className,
}: {
  verdict: { ok: boolean; text: string } | null
  /** Shown before anything has been tested. */
  idle: string
  className?: string
}) {
  const tone = !verdict
    ? 'var(--bench-dim, #a29b93)'
    : verdict.ok
      ? 'var(--bench-trace, #6ef2a6)'
      : 'var(--bench-fault, #ff6b5c)'
  const stamp = !verdict ? 'idle' : verdict.ok ? 'pass' : 'fault'

  return (
    <div
      aria-live="polite"
      className={cn(
        'flex items-stretch gap-3 overflow-hidden rounded-xl border',
        'border-[var(--bench-edge,rgba(255,255,255,0.13))] bg-[var(--bench-recess,#131218)]',
        className,
      )}
    >
      <span className="w-1.5 shrink-0" style={{ background: tone }} aria-hidden />
      <span className="flex items-center py-2.5">
        <span className={cn(benchLabel, 'w-14 shrink-0')} style={{ color: tone }}>
          {stamp}
        </span>
        <span className="pr-3 font-mono text-[11.5px] leading-snug text-[var(--bench-ink,#eae7e3)]">
          {verdict ? verdict.text : idle}
        </span>
      </span>
    </div>
  )
}
