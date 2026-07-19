/**
 * Build diagram for the robotics "cardboard grabber" DIY project.
 * A scissor-linkage claw that reaches out when you squeeze the handle end.
 * Edit freely.
 */
const label = 'fill-ink-soft dark:fill-stone-300'
const leader = 'stroke-stone-400 dark:stroke-stone-500'

/** One X of the scissor lattice, centred at (cx, cy). */
function ScissorX({ cx, cy, w = 70, h = 44 }: { cx: number; cy: number; w?: number; h?: number }) {
  return (
    <g style={{ stroke: 'var(--accent)' }} strokeWidth="7" strokeLinecap="round">
      <line x1={cx - w / 2} y1={cy - h / 2} x2={cx + w / 2} y2={cy + h / 2} />
      <line x1={cx - w / 2} y1={cy + h / 2} x2={cx + w / 2} y2={cy - h / 2} />
      <circle cx={cx} cy={cy} r="4.5" className="fill-stone-600 dark:fill-stone-300" stroke="none" />
    </g>
  )
}

export function GrabberDiagram() {
  const centers = [130, 210, 290, 370, 450]
  return (
    <svg viewBox="0 0 640 300" className="w-full" role="img" aria-label="Cardboard grabber diagram">
      {/* the scissor lattice */}
      {centers.map((cx) => (
        <ScissorX key={cx} cx={cx} cy={160} />
      ))}
      {/* pin dots between X units */}
      {centers.slice(0, -1).map((cx) => (
        <circle key={cx} cx={cx + 40} cy={160} r="4.5" className="fill-stone-600 dark:fill-stone-300" />
      ))}

      {/* jaws at the far (right) end */}
      <g style={{ stroke: 'var(--accent)' }} strokeWidth="8" strokeLinecap="round" fill="none">
        <path d="M490 148 l40 -20" />
        <path d="M490 172 l40 20" />
      </g>
      {/* object being grabbed */}
      <circle cx="548" cy="160" r="15" className="fill-sky-300 dark:fill-sky-600" />

      {/* squeeze handle at the near (left) end */}
      <g stroke="#78716c" strokeWidth="8" strokeLinecap="round" fill="none">
        <path d="M96 148 l-30 -16" />
        <path d="M96 172 l-30 16" />
      </g>
      {/* squeeze arrows */}
      <path d="M60 120 l6 12 l-12 -2 M60 200 l6 -12 l-12 2" fill="none" className={leader} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* labels */}
      <text x="40" y="96" fontSize="13" fontWeight="700" className={label}>squeeze here...</text>
      <line x1="70" y1="104" x2="86" y2="150" strokeDasharray="3 4" strokeWidth="1.5" className={leader} />

      <text x="470" y="96" fontSize="13" fontWeight="700" className={label}>...and it reaches out to grab</text>
      <line x1="520" y1="104" x2="524" y2="146" strokeDasharray="3 4" strokeWidth="1.5" className={leader} />

      <text x="320" y="250" textAnchor="middle" fontSize="13" fontWeight="700" className={label}>a small push at your hand becomes a big reach at the tip: that is a linkage</text>
    </svg>
  )
}
