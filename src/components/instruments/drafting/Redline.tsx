import { motion, useReducedMotion } from 'framer-motion'
import { Leader } from './Dimension'
import { INK, LETTER, PEN, TRACK, wobble } from './tokens'

/** A hand-drawn loop around a point, twice round the way a pencil does it. */
function pencilLoop(cx: number, cy: number, rx: number, ry: number, seed: string, pass: number) {
  const steps = 22
  const pts: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 + pass * 0.35
    const j = 1 + wobble(seed, i + pass * 40) * 0.07
    pts.push(`${(cx + Math.cos(t) * rx * j).toFixed(1)} ${(cy + Math.sin(t) * ry * j).toFixed(1)}`)
  }
  return `M${pts.join(' L')}`
}

interface RedlineProps {
  /** Center of the thing being marked up. */
  x: number
  y: number
  rx: number
  ry: number
  /** The note, one line per string. First line is the mark, e.g. "M14 over". */
  note: string[]
  /** Where the note sits. The leader runs from the loop to here. */
  noteX: number
  noteY: number
  /** Stable seed so the freehand marks do not crawl between renders. */
  seed: string
  /** Revision number shown in the triangle beside the note. */
  rev?: number
}

/**
 * The failure convention: the member that let go is circled in red pencil, a
 * leader runs out to a note carrying the number that broke it, and a revision
 * triangle marks the note.
 */
export function Redline({ x, y, rx, ry, note, noteX, noteY, seed, rev }: RedlineProps) {
  const reduced = useReducedMotion()
  const anchor = noteX >= x ? 'start' : 'end'
  return (
    <motion.g
      initial={reduced ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.25 }}
      className="pointer-events-none"
    >
      <path d={pencilLoop(x, y, rx, ry, seed, 0)} fill="none" stroke={INK.red} strokeWidth={PEN.dim} strokeLinecap="round" opacity="0.95" />
      <path d={pencilLoop(x, y, rx * 1.08, ry * 1.12, seed, 1)} fill="none" stroke={INK.red} strokeWidth={PEN.thin} strokeLinecap="round" opacity="0.65" />
      <Leader x={x + (noteX >= x ? rx : -rx)} y={y} toX={noteX} toY={noteY} tone={INK.red} />
      {note.map((line, i) => (
        <text
          key={line}
          x={noteX + (anchor === 'start' ? 4 : -4)}
          y={noteY + 4 + i * 12}
          textAnchor={anchor}
          className={LETTER}
          style={{ letterSpacing: TRACK.normal }}
          fontSize={i === 0 ? 11 : 10}
          fontWeight={i === 0 ? 700 : 500}
          fill={INK.red}
        >
          {line}
        </text>
      ))}
      {rev !== undefined && (
        <RevisionTriangle x={noteX + (anchor === 'start' ? -14 : 14)} y={noteY} rev={rev} />
      )}
    </motion.g>
  )
}

/** The delta beside a marked-up note, carrying the revision it belongs to. */
export function RevisionTriangle({ x, y, rev }: { x: number; y: number; rev: number }) {
  return (
    <g className="pointer-events-none" aria-hidden>
      <path d={`M${x} ${y - 8} L${x + 8} ${y + 6} L${x - 8} ${y + 6} Z`} fill="none" stroke={INK.red} strokeWidth={PEN.thin} />
      <text x={x} y={y + 4.5} textAnchor="middle" className={LETTER} fontSize="8.5" fontWeight="700" fill={INK.red}>
        {rev}
      </text>
    </g>
  )
}

interface StampProps {
  x: number
  y: number
  /** The word in the box. */
  title: string
  /** Small lines under it, e.g. what was checked and at which revision. */
  lines?: string[]
  tone?: string
  width?: number
  angle?: number
}

function Stamp({ x, y, title, lines = [], tone = INK.check, width = 172, angle = -7 }: StampProps) {
  const reduced = useReducedMotion()
  const height = 30 + lines.length * 12
  return (
    <motion.g
      initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 1.25 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 18 }}
      style={{ transformOrigin: `${x}px ${y}px` }}
      className="pointer-events-none"
    >
      <g transform={`rotate(${angle} ${x} ${y})`}>
        <rect x={x - width / 2} y={y - height / 2} width={width} height={height} fill="none" stroke={tone} strokeWidth={PEN.member} opacity="0.9" />
        <rect x={x - width / 2 + 4} y={y - height / 2 + 4} width={width - 8} height={height - 8} fill="none" stroke={tone} strokeWidth={PEN.hair} opacity="0.8" />
        <text
          x={x}
          y={y - height / 2 + 21}
          textAnchor="middle"
          className={LETTER}
          style={{ letterSpacing: TRACK.wide }}
          fontSize="15"
          fontWeight="700"
          fill={tone}
        >
          {title}
        </text>
        {lines.map((line, i) => (
          <text
            key={line}
            x={x}
            y={y - height / 2 + 34 + i * 12}
            textAnchor="middle"
            className={LETTER}
            style={{ letterSpacing: TRACK.normal }}
            fontSize="9"
            fill={tone}
          >
            {line}
          </text>
        ))}
      </g>
    </motion.g>
  )
}

/** Sign-off. Goes on a drawing that passed its check. */
export function ApprovalStamp(props: Omit<StampProps, 'title' | 'tone'> & { title?: string }) {
  return <Stamp {...props} title={props.title ?? 'checked'} tone={INK.check} />
}

/** The other verdict. Goes on a drawing that has redlines on it. */
export function RevisionStamp(props: Omit<StampProps, 'title' | 'tone'> & { title?: string }) {
  return <Stamp {...props} title={props.title ?? 'revise'} tone={INK.red} angle={props.angle ?? 6} />
}
