import { INK, LETTER, PEN, TRACK } from './tokens'

/** Filled arrowhead at `x,y` pointing along the unit vector `ux,uy`. */
export function Arrowhead({ x, y, ux, uy, size = 8, fill = INK.soft }: { x: number; y: number; ux: number; uy: number; size?: number; fill?: string }) {
  const bx = x - ux * size
  const by = y - uy * size
  const half = size * 0.32
  return (
    <path
      d={`M${x} ${y} L${bx + -uy * half} ${by + ux * half} L${bx - -uy * half} ${by - ux * half} Z`}
      fill={fill}
    />
  )
}

interface DimStringProps {
  x1: number
  y1: number
  x2: number
  y2: number
  /** Perpendicular distance from the geometry to the dimension line. Sign picks the side. */
  offset?: number
  /** The value, lettered into a break in the line. */
  label: string
  tone?: string
  /** Gap left between the geometry and the start of the extension line. */
  standoff?: number
}

/**
 * A dimension string done properly: extension lines standing off the geometry,
 * a dimension line with arrowheads at both ends, and the value breaking the
 * line rather than floating beside it.
 */
export function DimString({ x1, y1, x2, y2, offset = 26, label, tone = INK.soft, standoff = 6 }: DimStringProps) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len < 1) return null
  const ux = dx / len
  const uy = dy / len
  // Normal, so a positive offset puts the string below a horizontal run.
  const nx = -uy
  const ny = ux
  const s = Math.sign(offset) || 1
  const off = Math.abs(offset)

  const ext = (px: number, py: number) => ({
    from: { x: px + nx * s * standoff, y: py + ny * s * standoff },
    to: { x: px + nx * s * (off + 6), y: py + ny * s * (off + 6) },
  })
  const e1 = ext(x1, y1)
  const e2 = ext(x2, y2)
  const p1 = { x: x1 + nx * s * off, y: y1 + ny * s * off }
  const p2 = { x: x2 + nx * s * off, y: y2 + ny * s * off }
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }

  // Break the line wide enough for the lettering, measured along the run.
  const textW = label.length * 5.9 + 4
  const textH = 11
  const gap = Math.abs(ux) * textW + Math.abs(uy) * textH + 6
  const fits = len > gap + 20

  return (
    <g className="pointer-events-none" aria-hidden>
      <line x1={e1.from.x} y1={e1.from.y} x2={e1.to.x} y2={e1.to.y} stroke={tone} strokeWidth={PEN.thin} />
      <line x1={e2.from.x} y1={e2.from.y} x2={e2.to.x} y2={e2.to.y} stroke={tone} strokeWidth={PEN.thin} />
      {fits ? (
        <>
          <line x1={p1.x} y1={p1.y} x2={mid.x - (ux * gap) / 2} y2={mid.y - (uy * gap) / 2} stroke={tone} strokeWidth={PEN.dim} />
          <line x1={mid.x + (ux * gap) / 2} y1={mid.y + (uy * gap) / 2} x2={p2.x} y2={p2.y} stroke={tone} strokeWidth={PEN.dim} />
        </>
      ) : (
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={tone} strokeWidth={PEN.dim} />
      )}
      <Arrowhead x={p1.x} y={p1.y} ux={-ux} uy={-uy} fill={tone} />
      <Arrowhead x={p2.x} y={p2.y} ux={ux} uy={uy} fill={tone} />
      <text
        x={fits ? mid.x : p2.x + ux * 10}
        y={(fits ? mid.y : p2.y + uy * 10) + 3.4}
        textAnchor={fits ? 'middle' : 'start'}
        className={LETTER}
        style={{ letterSpacing: TRACK.normal }}
        fontSize="10"
        fill={tone}
      >
        {label}
      </text>
    </g>
  )
}

/**
 * A leader: a kinked line from a note to the thing it is about, with a dot on
 * the target. Notes point at geometry, they never sit on top of it.
 */
export function Leader({ x, y, toX, toY, tone = INK.soft }: { x: number; y: number; toX: number; toY: number; tone?: string }) {
  const land = toX >= x ? 10 : -10
  return (
    <g className="pointer-events-none" aria-hidden>
      <path d={`M${x} ${y} L${toX - land} ${toY} L${toX} ${toY}`} fill="none" stroke={tone} strokeWidth={PEN.thin} />
      <circle cx={x} cy={y} r="2" fill={tone} />
    </g>
  )
}

interface ScaleBarProps {
  x: number
  y: number
  /** Drawing px in one unit of the real world. */
  pxPerUnit: number
  /** How many units long the bar is. */
  units: number
  unit?: string
  tone?: string
}

/** The bar a reader measures the drawing with. Alternating blocks, one per unit. */
export function ScaleBar({ x, y, pxPerUnit, units, unit = 'm', tone = INK.soft }: ScaleBarProps) {
  const blocks = Array.from({ length: units }, (_, i) => i)
  const h = 5
  return (
    <g className="pointer-events-none" aria-hidden>
      <rect x={x - 6} y={y - 12} width={units * pxPerUnit + 12} height={h + 24} fill={INK.paper} opacity="0.85" />
      {blocks.map((i) => (
        <rect
          key={i}
          x={x + i * pxPerUnit}
          y={y}
          width={pxPerUnit}
          height={h}
          fill={i % 2 === 0 ? tone : 'none'}
          stroke={tone}
          strokeWidth={PEN.hair}
        />
      ))}
      {[0, units / 2, units].map((u) => (
        <text
          key={u}
          x={x + u * pxPerUnit}
          y={y - 4}
          textAnchor="middle"
          className={LETTER}
          style={{ letterSpacing: TRACK.normal }}
          fontSize="8.5"
          fill={tone}
        >
          {u}
        </text>
      ))}
      <text x={x + units * pxPerUnit + 4} y={y + h} className={LETTER} style={{ letterSpacing: TRACK.normal }} fontSize="8.5" fill={tone}>
        {unit}
      </text>
    </g>
  )
}
