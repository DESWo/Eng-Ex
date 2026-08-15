import type { ReactNode } from 'react'
import { board, brushed, digitClass, engravedClass, engravedStyle, recessShadow } from './tokens'
import { cn } from '@/lib/utils'

/** Small engraved legend. Use for every label on the board. */
export function Engraved({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn(engravedClass, className)} style={engravedStyle}>
      {children}
    </span>
  )
}

/**
 * A sentence on the board. Engraved legends are uppercase and letterspaced, so
 * anything longer than three words goes here instead.
 */
export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('font-body text-[11px] leading-snug text-slate-400', className)}>{children}</p>
}

/** A stamped brass plate: setpoints, unit numbers, anything fixed for the run. */
export function Plate({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div
      className={cn('rounded-[3px] border border-white/10 bg-[#343b42] px-2.5 py-1', className)}
      style={{ boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.12), 0 1px 2px rgb(0 0 0 / 0.5)' }}
    >
      <Engraved className="block text-[9px] text-slate-400">{label}</Engraved>
      <span className={cn(digitClass, 'text-[13px] font-medium')}>{value}</span>
    </div>
  )
}

/** A cut window with mono digits in it: the digital repeat of any analog value. */
export function DigitalWindow({
  value,
  unit,
  className,
  tone = 'normal',
}: {
  value: ReactNode
  unit?: string
  className?: string
  /** `alarm` turns the digits red, `warn` amber. Nothing else changes. */
  tone?: 'normal' | 'warn' | 'alarm'
}) {
  const ink = tone === 'alarm' ? 'text-[#f08678]' : tone === 'warn' ? 'text-[#ecb85a]' : 'text-[#8fe3c4]'
  return (
    <span
      className={cn('inline-flex items-baseline gap-1 rounded-[3px] px-2 py-0.5', board.recess, className)}
      style={recessShadow}
    >
      <span className={cn(digitClass, ink, 'text-[13px] font-medium')}>{value}</span>
      {unit && <span className="font-mono text-[9px] tracking-wider text-slate-400">{unit}</span>}
    </span>
  )
}

/** A recessed area of the board holding one group of instruments. */
export function PanelBay({
  legend,
  right,
  children,
  className,
}: {
  legend: string
  /** Anything that belongs on the bay's own header strip, e.g. a digital repeat. */
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-md p-2.5', board.bay, className)} style={recessShadow}>
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/8 pb-1.5">
        <Engraved>{legend}</Engraved>
        {right}
      </div>
      {children}
    </section>
  )
}

/** Four screw heads, one per corner of the board. */
function Screws() {
  const spots = ['left-2 top-2', 'right-2 top-2', 'left-2 bottom-2', 'right-2 bottom-2']
  return (
    <>
      {spots.map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={cn('absolute h-2 w-2 rounded-full bg-[#41484f]', pos)}
          style={{ boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.25), 0 1px 1px rgb(0 0 0 / 0.6)' }}
        />
      ))}
    </>
  )
}

interface PanelSurfaceProps {
  /** Engraved nameplate along the top of the board. */
  title: string
  /** Plates and lamps that sit on the nameplate strip. */
  header?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * The instrument panel itself. Dark brushed steel in both themes, so it reads
 * as equipment set down on the page rather than a restyled card.
 */
export function PanelSurface({ title, header, children, className }: PanelSurfaceProps) {
  return (
    <div className={cn('relative rounded-lg p-3 sm:p-4', board.panel, className)} style={brushed}>
      <Screws />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-4">
        <Engraved className="text-[11px] text-slate-300">{title}</Engraved>
        {header && <div className="flex flex-wrap items-center gap-1.5">{header}</div>}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}
