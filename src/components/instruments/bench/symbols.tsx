import type { Pt } from './routing'
import { ink, inkDim } from './theme'

/**
 * Schematic symbols, drawn as symbols. Not pictures of parts.
 *
 * Shared geometry: every two-pin symbol is centred on (x, y), its body is about
 * 36 units wide, and it draws its own lead stubs out to ±`lead` where the pins
 * sit. Designators go above the body, the plain-language caption below it, so a
 * sheet reads the same everywhere.
 */

const STROKE = 2.2

interface TwoPin {
  x: number
  y: number
  /** Distance from centre to each pin. Matches the game's terminal offset. */
  lead?: number
  /** Reference designator: LP1, SW1, R3. */
  designator?: string
  /** Plain words under the symbol. */
  caption?: string
  tone?: string
}

function Labels({ x, y, designator, caption, tone = ink }: TwoPin) {
  return (
    <>
      {designator && (
        <text
          x={x}
          y={y - 30}
          textAnchor="middle"
          fontSize="12"
          letterSpacing="1.2"
          className="font-mono"
          fill={tone}
        >
          {designator}
        </text>
      )}
      {caption && (
        <text x={x} y={y + 42} textAnchor="middle" fontSize="12" className="font-mono" fill={inkDim}>
          {caption}
        </text>
      )}
    </>
  )
}

/** Battery / DC source: alternating long and short plates, plus marked. */
export function SourceSymbol({
  x,
  y,
  volts,
  designator = 'BT1',
  plusPin,
  minusPin,
}: {
  x: number
  y: number
  volts: number
  designator?: string
  /** Where the + pin sits. The lead is drawn to it in right angles. */
  plusPin: Pt
  minusPin: Pt
}) {
  const plates = [
    { dy: -18, w: 34 },
    { dy: -6, w: 16 },
    { dy: 6, w: 34 },
    { dy: 18, w: 16 },
  ]
  const top = y - 18
  const bottom = y + 18
  return (
    <g>
      {plates.map((p) => (
        <line
          key={p.dy}
          x1={x - p.w / 2}
          y1={y + p.dy}
          x2={x + p.w / 2}
          y2={y + p.dy}
          stroke={ink}
          strokeWidth={p.w > 20 ? STROKE : STROKE + 1.4}
          strokeLinecap="butt"
        />
      ))}
      <path
        d={`M ${x} ${top} V ${plusPin.y} H ${plusPin.x}`}
        fill="none"
        stroke={ink}
        strokeWidth={STROKE}
      />
      <path
        d={`M ${x} ${bottom} V ${minusPin.y} H ${minusPin.x}`}
        fill="none"
        stroke={ink}
        strokeWidth={STROKE}
      />
      {/* polarity beside the plates, clear of both leads */}
      <text x={x + 26} y={y - 14} textAnchor="middle" fontSize="16" className="font-mono" fill={ink}>
        +
      </text>
      <text x={x + 26} y={y + 26} textAnchor="middle" fontSize="18" className="font-mono" fill={ink}>
        −
      </text>
      <text x={x - 42} y={y + 4} textAnchor="middle" fontSize="12" letterSpacing="1.2" className="font-mono" fill={ink}>
        {designator}
      </text>
      <text x={x} y={y + 62} textAnchor="middle" fontSize="12" className="font-mono" fill={inkDim}>
        {volts} V dc
      </text>
    </g>
  )
}

/** Lamp: a circle with a cross. Fills and blooms with how hard it is running. */
export function LampSymbol({
  x,
  y,
  lead = 52,
  glow = 0,
  designator,
  caption,
}: TwoPin & { glow?: number }) {
  const r = 17
  const lit = glow > 0.15
  const face = lit ? `rgb(253, ${200 + Math.round(glow * 40)}, ${71 + Math.round(glow * 60)})` : 'none'
  return (
    <g>
      <line x1={x - lead} y1={y} x2={x - r} y2={y} stroke={ink} strokeWidth={STROKE} />
      <line x1={x + r} y1={y} x2={x + lead} y2={y} stroke={ink} strokeWidth={STROKE} />
      {lit && <circle cx={x} cy={y} r={r + 10 + glow * 12} fill="#fde047" opacity={0.1 + glow * 0.2} />}
      <circle cx={x} cy={y} r={r} fill={face} stroke={ink} strokeWidth={STROKE} />
      <line
        x1={x - r * 0.7}
        y1={y - r * 0.7}
        x2={x + r * 0.7}
        y2={y + r * 0.7}
        stroke={lit ? '#7c2d12' : ink}
        strokeWidth={STROKE}
      />
      <line
        x1={x - r * 0.7}
        y1={y + r * 0.7}
        x2={x + r * 0.7}
        y2={y - r * 0.7}
        stroke={lit ? '#7c2d12' : ink}
        strokeWidth={STROKE}
      />
      <Labels x={x} y={y} designator={designator} caption={caption} />
    </g>
  )
}

/** Single pole switch: a blade hinged on the left contact. */
export function SwitchSymbol({
  x,
  y,
  lead = 52,
  closed,
  designator,
  caption,
}: TwoPin & { closed: boolean }) {
  const gap = 16
  const hinge = { x: x - gap, y }
  const contact = { x: x + gap, y }
  const bladeEnd = closed ? contact : { x: x + gap - 5, y: y - 20 }
  return (
    <g>
      <line x1={x - lead} y1={y} x2={hinge.x} y2={y} stroke={ink} strokeWidth={STROKE} />
      <line x1={contact.x} y1={y} x2={x + lead} y2={y} stroke={ink} strokeWidth={STROKE} />
      <line
        x1={hinge.x}
        y1={hinge.y}
        x2={bladeEnd.x}
        y2={bladeEnd.y}
        stroke={closed ? 'var(--bench-live, #f6bf4a)' : ink}
        strokeWidth={STROKE + 0.8}
        strokeLinecap="round"
      />
      <circle cx={hinge.x} cy={hinge.y} r="3.4" fill={ink} />
      <circle cx={contact.x} cy={contact.y} r="3.4" fill={closed ? 'var(--bench-live, #f6bf4a)' : ink} />
      <Labels x={x} y={y} designator={designator} caption={caption} />
    </g>
  )
}

/** Resistor: the zigzag, six peaks. */
export function ResistorSymbol({ x, y, lead = 52, ohms, designator, caption }: TwoPin & { ohms?: number }) {
  const w = 34
  const h = 8
  const step = w / 6
  let d = `M ${x - w / 2} ${y}`
  for (let i = 0; i < 6; i++) d += ` L ${x - w / 2 + step * (i + 0.5)} ${y + (i % 2 ? h : -h)}`
  d += ` L ${x + w / 2} ${y}`
  return (
    <g>
      <line x1={x - lead} y1={y} x2={x - w / 2} y2={y} stroke={ink} strokeWidth={STROKE} />
      <line x1={x + w / 2} y1={y} x2={x + lead} y2={y} stroke={ink} strokeWidth={STROKE} />
      <path d={d} fill="none" stroke={ink} strokeWidth={STROKE} strokeLinejoin="miter" />
      <Labels x={x} y={y} designator={designator} caption={caption ?? (ohms ? `${ohms} Ω` : undefined)} />
    </g>
  )
}

/** Breaker: a switch with the trip hook over its contact. */
export function BreakerSymbol({
  x,
  y,
  lead = 52,
  state,
  designator,
  caption,
}: TwoPin & { state: 'closed' | 'open' | 'tripped' }) {
  const gap = 16
  const closed = state === 'closed'
  const end = closed ? { x: x + gap, y } : { x: x + gap - 6, y: y - 22 }
  const tone = state === 'tripped' ? 'var(--bench-fault, #ff6b5c)' : closed ? 'var(--bench-live, #f6bf4a)' : ink
  return (
    <g>
      <line x1={x - lead} y1={y} x2={x - gap} y2={y} stroke={ink} strokeWidth={STROKE} />
      <line x1={x + gap} y1={y} x2={x + lead} y2={y} stroke={ink} strokeWidth={STROKE} />
      <line x1={x - gap} y1={y} x2={end.x} y2={end.y} stroke={tone} strokeWidth={STROKE + 0.8} strokeLinecap="round" />
      <path
        d={`M ${x + gap - 9} ${y - 3} a 9 9 0 0 1 18 0`}
        fill="none"
        stroke={tone}
        strokeWidth={STROKE}
      />
      <circle cx={x - gap} cy={y} r="3.4" fill={ink} />
      <circle cx={x + gap} cy={y} r="3.4" fill={tone} />
      <Labels x={x} y={y} designator={designator} caption={caption} tone={tone} />
    </g>
  )
}

/** Bus bar: one thick conductor everything taps off. */
export function BusSymbol({
  x,
  y,
  length,
  vertical = false,
  label,
  live = false,
}: {
  x: number
  y: number
  length: number
  vertical?: boolean
  label?: string
  live?: boolean
}) {
  return (
    <g>
      <line
        x1={x}
        y1={y}
        x2={vertical ? x : x + length}
        y2={vertical ? y + length : y}
        stroke={live ? 'var(--bench-live, #f6bf4a)' : ink}
        strokeWidth="7"
        strokeLinecap="round"
      />
      {label && (
        <text
          x={vertical ? x + 12 : x}
          y={vertical ? y - 8 : y - 12}
          textAnchor={vertical ? 'start' : 'middle'}
          fontSize="12"
          letterSpacing="1.2"
          className="font-mono"
          fill={inkDim}
        >
          {label}
        </text>
      )}
    </g>
  )
}

/** Two windings either side of a core. */
export function TransformerSymbol({
  x,
  y,
  designator,
  caption,
}: {
  x: number
  y: number
  designator?: string
  caption?: string
}) {
  const coil = (cx: number, flip: number) =>
    [0, 1, 2].map((i) => `M ${cx} ${y - 21 + i * 14} a 7 7 0 0 ${flip > 0 ? 1 : 0} 0 14`).join(' ')
  return (
    <g>
      <path d={coil(x - 8, -1)} fill="none" stroke={ink} strokeWidth={STROKE} />
      <path d={coil(x + 8, 1)} fill="none" stroke={ink} strokeWidth={STROKE} />
      <line x1={x - 2} y1={y - 24} x2={x - 2} y2={y + 24} stroke={ink} strokeWidth="1.6" />
      <line x1={x + 2} y1={y - 24} x2={x + 2} y2={y + 24} stroke={ink} strokeWidth="1.6" />
      {designator && (
        <text x={x} y={y - 32} textAnchor="middle" fontSize="12" className="font-mono" fill={ink}>
          {designator}
        </text>
      )}
      {caption && (
        <text x={x} y={y + 42} textAnchor="middle" fontSize="12" className="font-mono" fill={inkDim}>
          {caption}
        </text>
      )}
    </g>
  )
}

/** Earth: stem and three tapering bars. */
export function GroundSymbol({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <line x1={x} y1={y - 12} x2={x} y2={y} stroke={ink} strokeWidth={STROKE} />
      {[14, 9, 4].map((half, i) => (
        <line
          key={half}
          x1={x - half}
          y1={y + i * 5}
          x2={x + half}
          y2={y + i * 5}
          stroke={ink}
          strokeWidth={STROKE}
        />
      ))}
    </g>
  )
}

/** A pin you can put a probe on. Rings, never filled, so a junction reads apart. */
export function TestPoint({
  x,
  y,
  state = 'idle',
  r = 5.5,
}: {
  x: number
  y: number
  state?: 'idle' | 'armed' | 'probed'
  r?: number
}) {
  const tone =
    state === 'armed'
      ? 'var(--accent, #7163dd)'
      : state === 'probed'
        ? 'var(--bench-probe, #e5484d)'
        : ink
  return (
    <>
      {state !== 'idle' && <circle cx={x} cy={y} r={r + 5} fill={tone} opacity="0.22" />}
      <circle cx={x} cy={y} r={r} fill="var(--bench-recess, #131218)" stroke={tone} strokeWidth="2.4" />
    </>
  )
}

/** Two or more conductors land here. Filled dot, the only "these are joined" mark. */
export function JunctionDot({ x, y, live = false }: { x: number; y: number; live?: boolean }) {
  return <circle cx={x} cy={y} r="4.6" fill={live ? 'var(--bench-live, #f6bf4a)' : ink} />
}

/**
 * The sheet cursor: four corner ticks around the pin the keyboard is on. Drawn
 * without pointer events so it never eats a click meant for the pin.
 */
export function Crosshair({ x, y, size = 13 }: { x: number; y: number; size?: number }) {
  const tick = 5
  const corners = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]
  return (
    <g style={{ pointerEvents: 'none' }}>
      {corners.map(([sx, sy]) => (
        <path
          key={`${sx}${sy}`}
          d={`M ${x + sx * size} ${y + sy * size - sy * tick} V ${y + sy * size} H ${x + sx * size - sx * tick}`}
          fill="none"
          stroke="var(--accent, #7163dd)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      ))}
    </g>
  )
}
