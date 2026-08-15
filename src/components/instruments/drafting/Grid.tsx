import { useCallback, useRef, useState } from 'react'
import { INK, LETTER, PEN, TRACK } from './tokens'

interface SnapGridProps {
  x0: number
  y0: number
  x1: number
  y1: number
  /** Module of the board. Every snap point sits on this. */
  step: number
  /** A full line every this many modules; the rest get a cross tick. */
  major?: number
}

/**
 * The board itself: a light line every major module and a cross tick on every
 * snap point, so a student can see where a click will land before clicking.
 */
export function SnapGrid({ x0, y0, x1, y1, step, major = 2 }: SnapGridProps) {
  const cols: number[] = []
  for (let x = x0; x <= x1; x += step) cols.push(x)
  const rows: number[] = []
  for (let y = y0; y <= y1; y += step) rows.push(y)

  return (
    <g className="pointer-events-none" aria-hidden>
      {cols.map((x) => (
        <line
          key={`c${x}`}
          x1={x}
          y1={y0}
          x2={x}
          y2={y1}
          stroke={(x - x0) % (step * major) === 0 ? INK.gridMajor : INK.grid}
          strokeWidth={PEN.hair}
          opacity={(x - x0) % (step * major) === 0 ? 0.9 : 0.5}
        />
      ))}
      {rows.map((y) => (
        <line
          key={`r${y}`}
          x1={x0}
          y1={y}
          x2={x1}
          y2={y}
          stroke={(y - y0) % (step * major) === 0 ? INK.gridMajor : INK.grid}
          strokeWidth={PEN.hair}
          opacity={(y - y0) % (step * major) === 0 ? 0.9 : 0.5}
        />
      ))}
      {cols.map((x) =>
        rows.map((y) => (
          <path
            key={`t${x}-${y}`}
            d={`M${x - 2.5} ${y} h5 M${x} ${y - 2.5} v5`}
            stroke={INK.gridMajor}
            strokeWidth={PEN.hair}
            opacity={0.85}
          />
        )),
      )}
    </g>
  )
}

/** A level line the drawing measures from, lettered at its right end. */
export function DatumLine({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: string }) {
  return (
    <g className="pointer-events-none" aria-hidden>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={INK.soft} strokeWidth={PEN.thin} strokeDasharray="14 3 2 3" />
      <text
        x={x2}
        y={y - 5}
        textAnchor="end"
        className={LETTER}
        style={{ letterSpacing: TRACK.normal }}
        fontSize="9"
        fill={INK.soft}
      >
        {label}
      </text>
    </g>
  )
}

/** Where the keyboard is pointing on the board. */
export function CursorMark({ x, y, tone = INK.check, size = 13 }: { x: number; y: number; tone?: string; size?: number }) {
  const g = 4
  return (
    <g className="pointer-events-none" aria-hidden>
      <path
        d={`M${x - size} ${y} h${size - g} M${x + g} ${y} h${size - g} M${x} ${y - size} v${size - g} M${x} ${y + g} v${size - g}`}
        stroke={tone}
        strokeWidth={PEN.dim}
      />
      <rect x={x - g} y={y - g} width={g * 2} height={g * 2} fill="none" stroke={tone} strokeWidth={PEN.thin} />
    </g>
  )
}

interface SheetCursorOpts {
  /** Module the cursor steps by. */
  step: number
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  start: { x: number; y: number }
  /** Enter or space at the cursor. */
  onCommit: (p: { x: number; y: number }) => void
  /** Escape. */
  onCancel?: () => void
  /** Delete or backspace at the cursor. */
  onDelete?: (p: { x: number; y: number }) => void
  disabled?: boolean
}

/**
 * The keyboard path across a snap grid. Arrow keys walk the modules, enter
 * commits, escape lets go, delete removes. `boardProps` goes on the <svg>,
 * which needs its own aria-label and aria-describedby from the caller.
 */
export function useSheetCursor({ step, bounds, start, onCommit, onCancel, onDelete, disabled }: SheetCursorOpts) {
  const [cursor, setCursor] = useState(start)
  const [active, setActive] = useState(false)
  const fns = useRef({ onCommit, onCancel, onDelete })
  fns.current = { onCommit, onCancel, onDelete }

  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, y)),
    }),
    [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return
      const nudge = (dx: number, dy: number) => {
        e.preventDefault()
        setActive(true)
        setCursor((c) => clamp(c.x + dx * step, c.y + dy * step))
      }
      switch (e.key) {
        case 'ArrowLeft': return nudge(-1, 0)
        case 'ArrowRight': return nudge(1, 0)
        case 'ArrowUp': return nudge(0, -1)
        case 'ArrowDown': return nudge(0, 1)
        case 'Enter':
        case ' ':
          e.preventDefault()
          setActive(true)
          fns.current.onCommit(cursor)
          return
        case 'Escape':
          fns.current.onCancel?.()
          return
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          fns.current.onDelete?.(cursor)
          return
        default:
      }
    },
    [clamp, cursor, disabled, step],
  )

  return {
    cursor,
    setCursor,
    /** True once the board has been driven by key or focus, so the mark shows. */
    active,
    setActive,
    boardProps: {
      tabIndex: 0,
      onKeyDown,
      onFocus: () => setActive(true),
      onBlur: () => setActive(false),
    },
  }
}
