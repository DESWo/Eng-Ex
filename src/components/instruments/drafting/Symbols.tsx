import { Arrowhead } from './Dimension'
import { INK, LETTER, PEN, TRACK } from './tokens'

/** The ground: a line with 45 degree hatching hanging off it. */
export function GroundHatch({ x, y, width, depth = 9, spacing = 7, tone = INK.soft }: { x: number; y: number; width: number; depth?: number; spacing?: number; tone?: string }) {
  const marks: number[] = []
  for (let i = -depth; i < width; i += spacing) marks.push(i)
  return (
    <g className="pointer-events-none" aria-hidden>
      <line x1={x} y1={y} x2={x + width} y2={y} stroke={tone} strokeWidth={PEN.thin} />
      {marks.map((i) => {
        const x1 = Math.max(x, x + i)
        const y1 = y + Math.max(0, -i)
        const x2 = Math.min(x + width, x + i + depth)
        const y2 = y + depth - Math.max(0, i + depth - width)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={tone} strokeWidth={PEN.hair} />
      })}
    </g>
  )
}

/** Pin: pinned both ways, so the triangle sits flat on hatched ground. */
export function PinSupport({ x, y, size = 13, tone = INK.line }: { x: number; y: number; size?: number; tone?: string }) {
  return (
    <g className="pointer-events-none" aria-hidden>
      <path d={`M${x} ${y} L${x - size} ${y + size * 1.25} L${x + size} ${y + size * 1.25} Z`} fill="none" stroke={tone} strokeWidth={PEN.thin} />
      <GroundHatch x={x - size - 5} y={y + size * 1.25} width={size * 2 + 10} tone={tone} />
    </g>
  )
}

/** Roller: free to slide along the ground, so the triangle rides on two wheels. */
export function RollerSupport({ x, y, size = 13, tone = INK.line }: { x: number; y: number; size?: number; tone?: string }) {
  const base = y + size
  return (
    <g className="pointer-events-none" aria-hidden>
      <path d={`M${x} ${y} L${x - size} ${base} L${x + size} ${base} Z`} fill="none" stroke={tone} strokeWidth={PEN.thin} />
      <circle cx={x - size * 0.45} cy={base + 3.4} r="3.4" fill="none" stroke={tone} strokeWidth={PEN.hair} />
      <circle cx={x + size * 0.45} cy={base + 3.4} r="3.4" fill="none" stroke={tone} strokeWidth={PEN.hair} />
      <GroundHatch x={x - size - 5} y={base + 6.8} width={size * 2 + 10} tone={tone} />
    </g>
  )
}

/** Fixed: built in, no rotation, so the end is a heavy line into hatching. */
export function FixedSupport({ x, y, width = 34, tone = INK.line }: { x: number; y: number; width?: number; tone?: string }) {
  return (
    <g className="pointer-events-none" aria-hidden>
      <line x1={x - width / 2} y1={y} x2={x + width / 2} y2={y} stroke={tone} strokeWidth={PEN.member} />
      <GroundHatch x={x - width / 2} y={y} width={width} tone={tone} />
    </g>
  )
}

interface LoadArrowProps {
  /** The point the load is applied at, which is where the head lands. */
  x: number
  y: number
  /** Arrow length in px. Carry the magnitude in it. */
  length: number
  /** The value, lettered at the tail. */
  label: string
  /** Unit vector the arrow points along. Down by default. */
  ux?: number
  uy?: number
  tone?: string
}

/** A point load: length carries the magnitude, the lettering carries the value. */
export function LoadArrow({ x, y, length, label, ux = 0, uy = 1, tone = INK.line }: LoadArrowProps) {
  const tailX = x - ux * length
  const tailY = y - uy * length
  return (
    <g className="pointer-events-none" aria-hidden>
      <line x1={tailX} y1={tailY} x2={x} y2={y} stroke={tone} strokeWidth={PEN.dim} />
      <Arrowhead x={x} y={y} ux={ux} uy={uy} size={10} fill={tone} />
      <text
        x={tailX}
        y={tailY - 5}
        textAnchor="middle"
        className={LETTER}
        style={{ letterSpacing: TRACK.normal }}
        fontSize="11"
        fontWeight="600"
        fill={tone}
      >
        {label}
      </text>
    </g>
  )
}

/** A grid bubble: the reference letter for a line of structure, on a leader. */
export function GridBubble({ x, y, label, leaderTo, tone = INK.soft }: { x: number; y: number; label: string; leaderTo?: number; tone?: string }) {
  return (
    <g className="pointer-events-none" aria-hidden>
      {leaderTo !== undefined && (
        <line x1={x} y1={y + 11} x2={x} y2={leaderTo} stroke={tone} strokeWidth={PEN.hair} strokeDasharray="4 4" />
      )}
      <circle cx={x} cy={y} r="10.5" fill={INK.paper} stroke={tone} strokeWidth={PEN.thin} />
      <text x={x} y={y + 3.6} textAnchor="middle" className={LETTER} style={{ letterSpacing: TRACK.normal }} fontSize="10" fill={tone}>
        {label}
      </text>
    </g>
  )
}

/** A section mark: where the drawing is cut, and which way the cut is viewed. */
export function SectionMark({ x, y, label, dir = 1, tone = INK.soft }: { x: number; y: number; label: string; dir?: 1 | -1; tone?: string }) {
  return (
    <g className="pointer-events-none" aria-hidden>
      <circle cx={x} cy={y} r="10" fill={INK.paper} stroke={tone} strokeWidth={PEN.thin} />
      <line x1={x - 10} y1={y} x2={x + 10} y2={y} stroke={tone} strokeWidth={PEN.hair} />
      <text x={x} y={y - 2.5} textAnchor="middle" className={LETTER} style={{ letterSpacing: TRACK.normal }} fontSize="9" fill={tone}>
        {label}
      </text>
      <line x1={x} y1={y + 10} x2={x} y2={y + 20} stroke={tone} strokeWidth={PEN.member} />
      <Arrowhead x={x + dir * 14} y={y + 20} ux={dir} uy={0} size={9} fill={tone} />
      <line x1={x} y1={y + 20} x2={x + dir * 14} y2={y + 20} stroke={tone} strokeWidth={PEN.member} />
    </g>
  )
}
