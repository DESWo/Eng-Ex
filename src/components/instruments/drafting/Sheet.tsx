import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { LETTER, TRACK, sheetVars } from './tokens'

interface DraftingSheetProps {
  /** The drawing itself, normally one <svg>. */
  children: ReactNode
  /** Pencil, eraser and other instruments. Sits on the top edge inside the border. */
  tools?: ReactNode
  /** Readouts that belong to the sheet, not the drawing. Sits under the drawing. */
  footer?: ReactNode
  /** Always a <TitleBlock>. Bottom right corner, inside the border. */
  titleBlock?: ReactNode
  className?: string
}

/**
 * A sheet of drawing stock: paper ground, trimmed border, corner registration
 * ticks, and a title block in the corner. Everything the drafting kit draws
 * expects to be inside one of these, because the sheet carries the ink vars.
 */
export function DraftingSheet({ children, tools, footer, titleBlock, className }: DraftingSheetProps) {
  return (
    <div
      className={cn(
        sheetVars,
        'relative rounded-lg bg-[var(--dr-paper,#f5efe1)] p-2 shadow-clay',
        'ring-1 ring-[var(--dr-ink,#2e2a23)]/25',
        className,
      )}
    >
      <div className="relative rounded-[2px] border border-[var(--dr-ink,#2e2a23)]/55 p-2 sm:p-3">
        {/* registration ticks, one per corner */}
        {[
          'left-1 top-1 border-l border-t',
          'right-1 top-1 border-r border-t',
          'left-1 bottom-1 border-b border-l',
          'right-1 bottom-1 border-b border-r',
        ].map((pos) => (
          <span key={pos} aria-hidden className={cn('pointer-events-none absolute h-3 w-3 border-[var(--dr-ink,#2e2a23)]/70', pos)} />
        ))}

        {tools && <div className="mb-2 flex flex-wrap items-center gap-2">{tools}</div>}
        {children}
        {footer && <div className="mt-2">{footer}</div>}
        {titleBlock && <div className="mt-2 flex justify-end">{titleBlock}</div>}
      </div>
    </div>
  )
}

export type SheetStatus = 'draft' | 'revise' | 'approved'

interface TitleBlockProps {
  project: string
  /** What this particular sheet draws. */
  drawing: string
  /** Sheet number, e.g. "S-01". */
  sheetNo: string
  /** How the drawing is scaled, in the reader's terms. */
  scale: string
  /** What is being checked on this sheet, in numbers. */
  checking: string
  /** Revision count. 0 until the first check is run. */
  rev: number
  status: SheetStatus
}

const STATUS_TEXT: Record<SheetStatus, string> = {
  draft: 'for review',
  revise: 'revise, see redline',
  approved: 'approved',
}

const STATUS_TONE: Record<SheetStatus, string> = {
  draft: 'text-[var(--dr-ink-soft,#6c6252)]',
  revise: 'text-[var(--dr-red,#c0362c)]',
  approved: 'text-[var(--dr-check,#1d5f9e)]',
}

function Field({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 px-2.5 py-1.5', className)}>
      <p className={cn(LETTER, 'text-[9px] leading-none text-[var(--dr-ink-soft,#6c6252)]')} style={{ letterSpacing: TRACK.wide }}>
        {label}
      </p>
      <p className="mt-1 truncate font-mono text-[11px] leading-tight text-[var(--dr-ink,#2e2a23)]">{value}</p>
    </div>
  )
}

/**
 * The signature of the whole field: who drew what, at what scale, on which
 * sheet, and whether it has been signed off. Read it top left to bottom right.
 */
export function TitleBlock({ project, drawing, sheetNo, scale, checking, rev, status }: TitleBlockProps) {
  const cell = 'border-[var(--dr-ink,#2e2a23)]/45'
  return (
    <div className={cn('w-full max-w-md border', cell, 'bg-[var(--dr-paper-2,#ece3d2)]')}>
      <div className="grid grid-cols-[1fr_auto_auto]">
        <Field label="project" value={project} />
        <Field label="sheet" value={sheetNo} className={cn('border-l', cell)} />
        <Field label="scale" value={scale} className={cn('border-l', cell)} />
      </div>
      <div className={cn('grid grid-cols-[1fr_1.2fr] border-t', cell)}>
        <Field label="drawing" value={drawing} />
        <Field label="checking" value={checking} className={cn('border-l', cell)} />
      </div>
      <div className={cn('grid grid-cols-[1fr_auto] border-t', cell)}>
        <Field
          label="status"
          value={<span className={STATUS_TONE[status]}>{STATUS_TEXT[status]}</span>}
        />
        <Field label="rev" value={String(rev).padStart(2, '0')} className={cn('border-l', cell)} />
      </div>
    </div>
  )
}
