import { memo, useCallback, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { RoughCircle, RoughLine, RoughPath } from '@/components/ui/Sketchy'
import { useSvgDrag } from '@/hooks/useSvgDrag'

/*
 * Simply supported beam, one point load, load position draggable.
 *
 * Reactions: R1 = P b / L, R2 = P a / L.
 * Deflection (downward positive), a from the left support, b = L - a:
 *   x <= a:  y = P b x (L^2 - b^2 - x^2) / (6 L EI)
 *   x >= a:  y = P a (L - x) (2 L x - x^2 - a^2) / (6 L EI)
 *
 * EI is a small steel section. The vertical scale is exaggerated by
 * EXAGGERATION so 15 mm is visible next to a 6 m span; the caption says so.
 *
 * Rough.js regenerates a shape whenever its geometry changes, so anything that
 * moves with the load is a plain path and the static parts live in <Furniture>,
 * which is memoized.
 */

const SPAN = 6 // m
const LOAD = 4 // kN
const EI = 1200 // kN m^2
const A_MIN = 0.6
const A_MAX = 5.4
const EXAGGERATION = 40

const W = 440
const H = 236
const X0 = 60
const X1 = 380
const Y0 = 110
const GROUND_Y = Y0 + 26
const PX_PER_M = (X1 - X0) / SPAN
const PX_PER_MM = (EXAGGERATION * PX_PER_M) / 1000

const ACCENT = '#f2695c'
const INK = 'stroke-ink/70 dark:stroke-stone-400'
const TEXT = 'fill-ink-soft font-mono text-[10px] dark:fill-stone-400'

function deflectionM(x: number, a: number) {
  const b = SPAN - a
  if (x <= a) return (LOAD * b * x * (SPAN * SPAN - b * b - x * x)) / (6 * SPAN * EI)
  return (LOAD * a * (SPAN - x) * (2 * SPAN * x - x * x - a * a)) / (6 * SPAN * EI)
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Triangular arrowhead with its tip at (x, y). dir 1 points down, -1 points up. */
function head(x: number, y: number, dir: 1 | -1) {
  return `M ${x - 4.5} ${y - dir * 9} L ${x} ${y} L ${x + 4.5} ${y - dir * 9} Z`
}

const PIN_OPTS = { roughness: 1.3, strokeWidth: 1.5 }
const GROUND_OPTS = { roughness: 1.5, strokeWidth: 1.2 }
const HATCH_OPTS = { roughness: 1.8, strokeWidth: 1 }
const DIM_OPTS = { roughness: 1.4, strokeWidth: 1 }
const DATUM_OPTS = { roughness: 0.9, strokeWidth: 1.3 }

/** Supports, ground, the undeflected beam and the span dimension. Never moves. */
const Furniture = memo(function Furniture() {
  return (
    <g aria-hidden="true">
      {/* undeflected datum, deflection is measured off this */}
      <RoughLine x1={X0} y1={Y0} x2={X1} y2={Y0} className="stroke-ink/35 dark:stroke-stone-600" options={DATUM_OPTS} seed={11} />

      {/* pin support */}
      <RoughPath d={`M ${X0} ${Y0 + 2} L ${X0 - 13} ${Y0 + 20} L ${X0 + 13} ${Y0 + 20} Z`} className={INK} options={PIN_OPTS} seed={23} />
      {/* roller support */}
      <RoughPath d={`M ${X1} ${Y0 + 2} L ${X1 - 13} ${Y0 + 16} L ${X1 + 13} ${Y0 + 16} Z`} className={INK} options={PIN_OPTS} seed={37} />
      <RoughCircle cx={X1 - 7} cy={GROUND_Y - 4} r={4} className={INK} options={PIN_OPTS} seed={41} />
      <RoughCircle cx={X1 + 7} cy={GROUND_Y - 4} r={4} className={INK} options={PIN_OPTS} seed={43} />

      {[X0, X1].map((x) => (
        <g key={x}>
          <RoughLine x1={x - 24} y1={GROUND_Y} x2={x + 24} y2={GROUND_Y} className={INK} options={GROUND_OPTS} seed={x} />
          {[-20, -11, 11, 20].map((d) => (
            <RoughLine
              key={d}
              x1={x + d}
              y1={GROUND_Y}
              x2={x + d - 6}
              y2={GROUND_Y + 7}
              className="stroke-ink/45 dark:stroke-stone-500"
              options={HATCH_OPTS}
              seed={x + d + 100}
            />
          ))}
        </g>
      ))}

      {/* span dimension, broken around its own label */}
      <RoughLine x1={X0} y1={222} x2={190} y2={222} className={INK} options={DIM_OPTS} seed={61} />
      <RoughLine x1={250} y1={222} x2={X1} y2={222} className={INK} options={DIM_OPTS} seed={67} />
      <RoughLine x1={X0} y1={214} x2={X0} y2={230} className={INK} options={DIM_OPTS} seed={71} />
      <RoughLine x1={X1} y1={214} x2={X1} y2={230} className={INK} options={DIM_OPTS} seed={73} />
      <text x={220} y={226} textAnchor="middle" className={TEXT}>
        {SPAN.toFixed(1)} m
      </text>

      {/* extension line the load offset is measured from */}
      <line x1={X0} y1={68} x2={X0} y2={104} className="stroke-ink/30 dark:stroke-stone-600" strokeWidth={1} strokeDasharray="3 4" />
    </g>
  )
})

export function BeamDemo() {
  const [a, setA] = useState(2.4)
  const [focused, setFocused] = useState(false)
  const [touched, setTouched] = useState(false)
  const reduced = useReducedMotion()

  const { bind } = useSvgDrag(
    useCallback((x: number) => {
      setTouched(true)
      setA(clamp((x - X0) / PX_PER_M, A_MIN, A_MAX))
    }, []),
  )

  const nudge = useCallback((e: React.KeyboardEvent) => {
    const step = e.key === 'PageUp' || e.key === 'PageDown' ? 0.5 : 0.1
    let next: number | null = null
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown') next = a - step
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') next = a + step
    if (e.key === 'Home') next = A_MIN
    if (e.key === 'End') next = A_MAX
    if (next === null) return
    e.preventDefault()
    setTouched(true)
    setA(clamp(next, A_MIN, A_MAX))
  }, [a])

  const b = SPAN - a
  const r1 = (LOAD * b) / SPAN
  const r2 = (LOAD * a) / SPAN
  const deflMm = deflectionM(a, a) * 1000

  const loadX = X0 + a * PX_PER_M
  const handleY = Y0 + deflMm * PX_PER_MM

  let curve = `M ${X0} ${Y0}`
  for (let i = 1; i <= 60; i++) {
    const x = (SPAN * i) / 60
    curve += ` L ${(X0 + x * PX_PER_M).toFixed(2)} ${(Y0 + deflectionM(x, a) * 1000 * PX_PER_MM).toFixed(2)}`
  }

  // Reaction arrows below each support, length proportional to the force.
  const armLen = (r: number) => 16 + 30 * (r / LOAD)
  const flip = loadX > 240
  const calloutX = flip ? loadX - 44 : loadX + 44

  return (
    <figure className="mx-auto w-full max-w-lg lg:max-w-none">
      {/* pan-y, not none: the load only moves sideways, so a vertical swipe on
          a phone should still scroll the page past the demo. */}
      <svg
        {...bind}
        style={{ ...bind.style, touchAction: 'pan-y' }}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none"
      >
        <Furniture />

        <g aria-hidden="true">
          {/* deflected shape */}
          <path d={curve} fill="none" stroke={ACCENT} strokeWidth={2.6} strokeLinecap="round" />

          {/* load */}
          <line x1={loadX} y1={32} x2={loadX} y2={handleY - 16} stroke={ACCENT} strokeWidth={2} />
          <path d={head(loadX, handleY - 8, 1)} fill={ACCENT} />
          <text x={loadX} y={24} textAnchor="middle" className="fill-ink font-mono text-[11px] font-semibold dark:fill-stone-200">
            {LOAD} kN
          </text>

          {/* distance from the left support to the load */}
          <line x1={X0} y1={62} x2={loadX} y2={62} className="stroke-ink/45 dark:stroke-stone-500" strokeWidth={1} strokeDasharray="4 3" />
          <line x1={loadX} y1={56} x2={loadX} y2={68} className="stroke-ink/45 dark:stroke-stone-500" strokeWidth={1} />
          <text x={(X0 + loadX) / 2} y={52} textAnchor="middle" className={TEXT}>
            {a.toFixed(1)} m
          </text>

          {/* deflection under the load, measured off the undeflected line */}
          <line x1={loadX} y1={handleY} x2={calloutX} y2={handleY} className="stroke-ink/40 dark:stroke-stone-600" strokeWidth={1} strokeDasharray="3 3" />
          <line x1={calloutX} y1={Y0} x2={calloutX} y2={handleY} className="stroke-ink/60 dark:stroke-stone-500" strokeWidth={1} />
          <line x1={calloutX - 3} y1={Y0} x2={calloutX + 3} y2={Y0} className="stroke-ink/60 dark:stroke-stone-500" strokeWidth={1} />
          <line x1={calloutX - 3} y1={handleY} x2={calloutX + 3} y2={handleY} className="stroke-ink/60 dark:stroke-stone-500" strokeWidth={1} />
          <text x={flip ? calloutX - 6 : calloutX + 6} y={handleY + 14} textAnchor={flip ? 'end' : 'start'} className={TEXT}>
            {deflMm.toFixed(1)} mm
          </text>

          {/* reactions */}
          {[
            { x: X0, r: r1 },
            { x: X1, r: r2 },
          ].map(({ x, r }) => (
            <g key={x}>
              <line x1={x} y1={146 + armLen(r)} x2={x} y2={148} stroke={ACCENT} strokeWidth={1.8} />
              <path d={head(x, 146, -1)} fill={ACCENT} />
              <text x={x} y={207} textAnchor="middle" className={TEXT}>
                {r.toFixed(2)} kN
              </text>
            </g>
          ))}
        </g>

        {!reduced && !touched && (
          <motion.circle
            aria-hidden="true"
            cx={loadX}
            cy={handleY}
            r={9}
            fill="none"
            stroke={ACCENT}
            strokeWidth={2}
            initial={{ opacity: 0.9, r: 9 }}
            animate={{ opacity: 0, r: 20 }}
            transition={{ duration: 1.4, repeat: 2, ease: 'easeOut' }}
          />
        )}

        {focused && <circle cx={loadX} cy={handleY} r={14} fill="none" stroke={ACCENT} strokeWidth={2} strokeDasharray="3 3" />}

        <circle
          role="slider"
          tabIndex={0}
          aria-label="Position of the load along the beam"
          aria-valuemin={A_MIN}
          aria-valuemax={A_MAX}
          aria-valuenow={Number(a.toFixed(1))}
          aria-valuetext={`Load ${a.toFixed(1)} metres from the left support. Deflection under the load ${deflMm.toFixed(1)} millimetres. Left reaction ${r1.toFixed(2)} kilonewtons, right reaction ${r2.toFixed(2)} kilonewtons.`}
          onKeyDown={nudge}
          onFocus={(e) => setFocused(e.currentTarget.matches(':focus-visible'))}
          onBlur={() => setFocused(false)}
          cx={loadX}
          cy={handleY}
          r={8}
          fill={ACCENT}
          className="stroke-cream outline-none dark:stroke-night"
          strokeWidth={2.5}
        />
      </svg>

      <figcaption className="mt-2 border-t border-ink/10 pt-3 font-mono text-xs leading-relaxed text-ink-soft dark:border-white/10 dark:text-stone-400">
        Simply supported beam, {SPAN.toFixed(1)} m span, {LOAD} kN point load, EI = {EI} kN m². Drag the load
        or focus it and use the arrow keys. Vertical scale is exaggerated {EXAGGERATION}x, otherwise
        {' '}{deflMm.toFixed(1)} mm would be less than a pixel.
      </figcaption>
    </figure>
  )
}
