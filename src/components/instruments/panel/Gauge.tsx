import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Engraved } from './PanelSurface'
import { INK, LAMP, arcPath, board, clamp01, digitClass, polar, recessShadow } from './tokens'
import type { LampTone } from './tokens'
import { cn } from '@/lib/utils'

/** A colored sector of the scale, e.g. the red band above the safety limit. */
export interface GaugeBand {
  from: number
  to: number
  tone: LampTone
}

interface GaugeProps {
  /** Engraved legend under the dial, e.g. "CORE TEMPERATURE". */
  label: string
  value: number
  min: number
  max: number
  /** Unit shown on the face and in the digital repeat. */
  unit: string
  /** Labelled ticks around the arc, including both ends. */
  majorTicks?: number
  bands?: GaugeBand[]
  /** Overrides the digits under the dial. Defaults to the rounded value. */
  readout?: string
  /** Spoken value. Defaults to "<value> <unit>". */
  valueText?: string
  /** Tints the digital repeat only. The needle never changes color. */
  tone?: 'normal' | 'warn' | 'alarm'
  className?: string
}

const CX = 100
const CY = 108
const R = 82
/** The scale sweeps 220 degrees, from lower-left round to lower-right. */
const A0 = 200
const A1 = -20

/**
 * A plant meter: needle on a 220 degree arc, numbered scale, colored bands, and
 * a digital repeat of the same signal underneath.
 *
 * The needle is driven by a spring integrator written straight to the transform
 * attribute, so a 300 ms sim tick does not re-render the page at 60 fps. It
 * overshoots a hair and settles, the way a real meter does. Under
 * prefers-reduced-motion it snaps.
 */
export function Gauge({
  label,
  value,
  min,
  max,
  unit,
  majorTicks = 5,
  bands = [],
  readout,
  valueText,
  tone = 'normal',
  className,
}: GaugeProps) {
  const reduced = useReducedMotion()
  const needleRef = useRef<SVGGElement | null>(null)
  const posRef = useRef<number | null>(null)
  const velRef = useRef(0)

  const angleFor = (v: number) => A0 - clamp01((v - min) / (max - min)) * (A0 - A1)
  const target = angleFor(value)

  useEffect(() => {
    const write = (deg: number) => needleRef.current?.setAttribute('transform', `rotate(${(-deg).toFixed(2)} ${CX} ${CY})`)
    const from = posRef.current
    if (from === null || reduced) {
      posRef.current = target
      velRef.current = 0
      write(target)
      return
    }
    let pos: number = from
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      // Underdamped second order system: zeta about 0.78, settles in half a second.
      velRef.current += (120 * (target - pos) - 17 * velRef.current) * dt
      pos += velRef.current * dt
      posRef.current = pos
      if (Math.abs(target - pos) < 0.05 && Math.abs(velRef.current) < 0.4) {
        posRef.current = target
        velRef.current = 0
        write(target)
        return
      }
      write(pos)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced])

  const ticks = Array.from({ length: majorTicks }, (_, i) => {
    const f = i / (majorTicks - 1)
    return { f, deg: A0 - f * (A0 - A1), v: Math.round(min + f * (max - min)) }
  })
  const digits = readout ?? `${Math.round(value)}`
  const digitInk = tone === 'alarm' ? '#f08678' : tone === 'warn' ? '#ecb85a' : '#8fe3c4'

  return (
    <div
      className={cn('flex flex-col items-center', className)}
      role="meter"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={valueText ?? `${Math.round(value)} ${unit}`}
    >
      <svg viewBox="0 0 200 150" className="w-full max-w-[220px]" aria-hidden focusable="false">
        {/* bezel and face */}
        <circle cx={CX} cy={CY} r={R + 14} fill="#343b42" stroke="#0b0e11" strokeWidth="2" />
        <circle cx={CX} cy={CY} r={R + 9} fill={INK.face} stroke="#9a9384" strokeWidth="1" />

        {bands.map((b) => (
          <path
            key={`${b.from}-${b.to}-${b.tone}`}
            d={arcPath(CX, CY, R - 4, angleFor(b.from), angleFor(b.to))}
            fill="none"
            stroke={LAMP[b.tone].lit}
            strokeWidth="8"
            strokeLinecap="butt"
            opacity="0.9"
          />
        ))}

        {/* minor ticks, four per major division */}
        {ticks.slice(0, -1).flatMap((t, i) =>
          [1, 2, 3, 4].map((m) => {
            const deg = t.deg - (m / 5) * ((A0 - A1) / (majorTicks - 1))
            const a = polar(CX, CY, R - 12, deg)
            const b = polar(CX, CY, R - 18, deg)
            return <line key={`m${i}-${m}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#7b7466" strokeWidth="1" />
          }),
        )}

        {ticks.map((t) => {
          const a = polar(CX, CY, R - 10, t.deg)
          const b = polar(CX, CY, R - 22, t.deg)
          const n = polar(CX, CY, R - 34, t.deg)
          return (
            <g key={t.v}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2b2820" strokeWidth="2" />
              <text
                x={n.x}
                y={n.y + 4}
                textAnchor="middle"
                fontSize="11"
                className="font-mono"
                fill="#2b2820"
              >
                {t.v}
              </text>
            </g>
          )
        })}

        <text x={CX} y={CY - 34} textAnchor="middle" fontSize="9" letterSpacing="1.6" fill="#6b6558" className="font-body">
          {unit.toUpperCase()}
        </text>

        {/* needle: drawn pointing east from the hub, rotated about it */}
        <g ref={needleRef}>
          <path
            d={`M ${CX - 16} ${CY - 3} L ${CX + R - 14} ${CY - 1.2} L ${CX + R - 6} ${CY} L ${CX + R - 14} ${CY + 1.2} L ${CX - 16} ${CY + 3} Z`}
            fill="#23201a"
          />
          <circle cx={CX - 16} cy={CY} r="5" fill="#23201a" />
        </g>
        <circle cx={CX} cy={CY} r="7" fill="#3b3730" stroke="#1a1814" strokeWidth="1.5" />
      </svg>

      <div className="-mt-3 flex flex-col items-center gap-1">
        <span
          className={cn('rounded-[3px] px-2.5 py-0.5', board.recess, digitClass, 'text-[15px] font-medium')}
          style={{ ...recessShadow, color: digitInk }}
        >
          {digits}
          <span className="ml-1 font-mono text-[9px] tracking-wider text-slate-400">{unit}</span>
        </span>
        <Engraved className="text-center text-[9px]">{label}</Engraved>
      </div>
    </div>
  )
}
