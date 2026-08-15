import { useEffect, useId, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Engraved } from './PanelSurface'
import { INK, LAMP, board, engravedStyle, recessShadow } from './tokens'
import type { LampTone } from './tokens'
import { useSvgDrag } from '@/hooks/useSvgDrag'
import { playSound } from '@/lib/sound'
import { cn } from '@/lib/utils'

/* ---------------------------------------------------------------- lever --- */

interface BankLeverProps {
  /** Engraved legend above the slot. */
  label: string
  value: number
  /** Value at the top of the slot. */
  topValue: number
  /** Value at the bottom of the slot. */
  bottomValue: number
  onChange: (v: number) => void
  /** Arrow key step, and the shifted step. */
  step?: number
  bigStep?: number
  /** Value spacing of the machined detents on the rail. */
  detent?: number
  /** Spoken value, e.g. "62 percent inserted". */
  valueText: (v: number) => string
  /** One line under the slot telling the operator what the handle does. */
  hint?: string
  className?: string
}

const LEVER_W = 150
const LEVER_H = 190
const SLOT_TOP = 26
const SLOT_H = 132

/**
 * A bank lever in a machined slot: grab the handle and haul it, or use the
 * arrow keys. Detents are marks the handle clicks past, not stops. The value
 * stays continuous, so anything reachable with the mouse is reachable with the
 * keyboard and nothing about the plant's resolution changes.
 *
 * Arrow keys move the HANDLE, not the number: up is always toward `topValue`.
 */
export function BankLever({
  label,
  value,
  topValue,
  bottomValue,
  onChange,
  step = 2,
  bigStep = 10,
  detent = 10,
  valueText,
  hint,
  className,
}: BankLeverProps) {
  const span = bottomValue - topValue
  const frac = span === 0 ? 0 : (value - topValue) / span
  const clamp = (v: number) => Math.max(Math.min(topValue, bottomValue), Math.min(Math.max(topValue, bottomValue), v))
  const lastDetent = useRef(Math.round(value / detent))

  const commit = (v: number) => {
    const next = clamp(Math.round(v))
    if (next === value) return
    const notch = Math.round(next / detent)
    if (notch !== lastDetent.current) {
      lastDetent.current = notch
      playSound('click')
    }
    onChange(next)
  }

  const { bind, dragging } = useSvgDrag((_x, y) => {
    commit(topValue + ((y - SLOT_TOP) / SLOT_H) * span)
  })

  const onKey = (e: React.KeyboardEvent) => {
    const s = e.shiftKey ? bigStep : step
    // Up moves the handle up the slot, whichever end of the scale that is.
    const up = Math.sign(topValue - bottomValue)
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') commit(value + up * s)
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') commit(value - up * s)
    else if (e.key === 'PageUp') commit(value + up * bigStep)
    else if (e.key === 'PageDown') commit(value - up * bigStep)
    else if (e.key === 'Home') commit(topValue)
    else if (e.key === 'End') commit(bottomValue)
    else return
    e.preventDefault()
  }

  const handleY = SLOT_TOP + frac * SLOT_H
  const notches = Math.max(1, Math.round(Math.abs(span) / detent))

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <Engraved className="mb-1">{label}</Engraved>
      <svg viewBox={`0 0 ${LEVER_W} ${LEVER_H}`} className="w-full max-w-[160px] touch-none" {...bind}>
        {/* plate and slot */}
        <rect x="8" y="14" width={LEVER_W - 16} height={LEVER_H - 34} rx="4" fill="#343b42" stroke="#0b0e11" />
        <rect x={LEVER_W / 2 - 9} y={SLOT_TOP - 6} width="18" height={SLOT_H + 12} rx="9" fill="#0d1114" />
        {/* detent marks, both sides of the slot */}
        {Array.from({ length: notches + 1 }, (_, i) => {
          const ty = SLOT_TOP + (i / notches) * SLOT_H
          const major = i % 5 === 0
          return (
            <g key={i}>
              <line x1={LEVER_W / 2 - 14} y1={ty} x2={LEVER_W / 2 - (major ? 24 : 19)} y2={ty} stroke={major ? INK.line : INK.lineDim} strokeWidth="1.5" />
              <line x1={LEVER_W / 2 + 14} y1={ty} x2={LEVER_W / 2 + (major ? 24 : 19)} y2={ty} stroke={major ? INK.line : INK.lineDim} strokeWidth="1.5" />
              {major && (
                <text x={LEVER_W / 2 + 28} y={ty + 3.5} fontSize="9" className="font-mono" fill={INK.text}>
                  {Math.round(topValue + (i / notches) * span)}
                </text>
              )}
            </g>
          )
        })}
        {/* the handle: the tabbable control */}
        <g
          tabIndex={0}
          role="slider"
          aria-label={label}
          aria-orientation="vertical"
          aria-valuenow={Math.round(value)}
          aria-valuemin={Math.min(topValue, bottomValue)}
          aria-valuemax={Math.max(topValue, bottomValue)}
          aria-valuetext={valueText(value)}
          onKeyDown={onKey}
          className="cursor-ns-resize [&:focus-visible>rect]:stroke-white"
          transform={`translate(0 ${(handleY - SLOT_TOP).toFixed(1)})`}
        >
          <rect
            x={LEVER_W / 2 - 30}
            y={SLOT_TOP - 9}
            width="60"
            height="18"
            rx="4"
            fill={dragging ? '#5d666f' : '#4a535b'}
            stroke="#0b0e11"
            strokeWidth="1.5"
          />
          <rect x={LEVER_W / 2 - 24} y={SLOT_TOP - 5} width="48" height="3" rx="1.5" fill="#6f7982" />
          <circle cx={LEVER_W / 2} cy={SLOT_TOP} r="4" fill="#2a3037" />
        </g>
        <text x={LEVER_W / 2} y={LEVER_H - 6} textAnchor="middle" fontSize="10" className="font-mono" fill={INK.textBright}>
          {Math.round(value)}
        </text>
      </svg>
      {hint && (
        <Engraved className="mt-1 max-w-[170px] text-center text-[9px] leading-snug text-slate-400">{hint}</Engraved>
      )}
    </div>
  )
}

/* ----------------------------------------------------------- pushbutton --- */

interface IlluminatedButtonProps {
  legend: string
  /** Second line on the cap, e.g. "40 MW". */
  sub?: string
  /** Lamp behind the cap. */
  lit: boolean
  tone?: LampTone
  onClick: () => void
  /** Set for a bank of mode buttons: reports the selected one. */
  pressed?: boolean
  disabled?: boolean
  ariaLabel?: string
  className?: string
}

/** A square illuminated pushbutton with an engraved cap. */
export function IlluminatedButton({
  legend,
  sub,
  lit,
  tone = 'white',
  onClick,
  pressed,
  disabled,
  ariaLabel,
  className,
}: IlluminatedButtonProps) {
  const ink = LAMP[tone]
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.95, y: 1 }}
      onClick={() => {
        if (disabled) return
        playSound('click')
        onClick()
      }}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      className={cn(
        'min-w-[72px] rounded-[3px] border border-black/50 px-2.5 py-2 text-center transition-colors duration-150',
        disabled && 'opacity-40',
        className,
      )}
      style={{
        backgroundColor: lit ? ink.lit : ink.off,
        boxShadow: lit
          ? `0 0 10px ${ink.glow}, inset 0 1px 0 rgb(255 255 255 / 0.3)`
          : 'inset 0 1px 0 rgb(255 255 255 / 0.08), 0 2px 3px rgb(0 0 0 / 0.5)',
      }}
    >
      <span
        className="block font-body text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: lit ? ink.legendOn : ink.legendOff }}
      >
        {legend}
      </span>
      {sub && (
        <span
          className="mt-0.5 block font-mono text-[9px] tracking-wide"
          style={{ color: lit ? ink.legendOn : ink.legendOff, opacity: 0.8 }}
        >
          {sub}
        </span>
      )}
    </motion.button>
  )
}

/* --------------------------------------------------------------- scram ---- */

interface GuardedControlProps {
  /** Legend on the button itself, e.g. "SCRAM". */
  legend: string
  /** One line telling the operator what firing it does. */
  description: string
  onFire: () => void
  /** How long the guard stays up before it drops again. */
  openMs?: number
  className?: string
}

/**
 * An emergency control under a hinged guard. Lifting the guard is its own
 * deliberate act, and the guard falls shut again on its own, so the button
 * cannot be hit in passing. Both halves are ordinary buttons, so the keyboard
 * path is the same two steps as the mouse path.
 */
export function GuardedControl({ legend, description, onFire, openMs = 5000, className }: GuardedControlProps) {
  const [open, setOpen] = useState(false)
  const reduced = useReducedMotion()
  const noteId = useId()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    timer.current = setTimeout(() => setOpen(false), openMs)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [open, openMs])

  const ink = LAMP.red
  return (
    <div className={cn('flex items-center gap-3 rounded-md p-2', board.bay, className)} style={recessShadow}>
      <div className="relative" style={{ perspective: 420 }}>
        {/* the guard, hinged at the top */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-full origin-top rounded-[3px] border border-white/25 bg-white/12"
          style={{ backdropFilter: 'blur(0.5px)' }}
          animate={{ rotateX: open ? -78 : 0, opacity: open ? 0.35 : 1 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 22 }}
        >
          <span className="absolute inset-x-0 top-1/2 h-px bg-white/30" />
        </motion.div>
        <motion.button
          type="button"
          whileTap={open ? { scale: 0.94 } : undefined}
          onClick={() => {
            if (!open) return
            playSound('reset')
            setOpen(false)
            onFire()
          }}
          // Kept focusable while guarded, so the note below is reachable by
          // keyboard. Pressing it does nothing until the guard is up.
          aria-disabled={!open}
          aria-describedby={noteId}
          className="relative rounded-[3px] border border-black/60 px-5 py-3"
          style={{
            backgroundColor: open ? ink.lit : ink.off,
            boxShadow: open
              ? `0 0 14px ${ink.glow}, inset 0 1px 0 rgb(255 255 255 / 0.3)`
              : 'inset 0 2px 5px rgb(0 0 0 / 0.55)',
            cursor: open ? 'pointer' : 'not-allowed',
          }}
        >
          <span
            className="font-body text-[13px] font-bold uppercase tracking-[0.22em]"
            style={{ color: open ? ink.legendOn : ink.legendOff }}
          >
            {legend}
          </span>
        </motion.button>
      </div>
      <div className="flex flex-col items-start gap-1.5">
        <button
          type="button"
          onClick={() => {
            playSound('click')
            setOpen((o) => !o)
          }}
          className="rounded-[3px] border border-white/15 bg-[#343b42] px-2.5 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300 hover:bg-[#3d454d]"
          style={engravedStyle}
        >
          {open ? 'Close guard' : 'Lift guard'}
        </button>
        <span id={noteId} className="max-w-[220px] font-body text-[11px] leading-snug text-slate-400">
          {open ? description : `Lift the guard first. ${description}`}
        </span>
      </div>
    </div>
  )
}
