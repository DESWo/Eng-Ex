/**
 * Build diagram for the popsicle stick truss bridge DIY project.
 * One zigzag wall seen from the side, plus a tiny end view. Edit freely.
 */
const label = 'fill-ink-soft dark:fill-stone-300'
const leader = 'stroke-stone-400 dark:stroke-stone-500'
const stick = 'stroke-amber-600 dark:stroke-amber-500'

/** Joint positions for the wall (bottom row and top row). */
const BOTTOM = [60, 185, 310, 435, 560]
const TOP = [122.5, 247.5, 372.5, 497.5]
const BOTTOM_Y = 252
const TOP_Y = 152

export function TrussBridgeDiagram() {
  return (
    <svg viewBox="0 0 640 340" className="w-full" role="img" aria-label="Truss bridge build diagram">
      {/* soft triangle tint so the shapes pop */}
      {TOP.map((tx, i) => (
        <polygon
          key={`tri-${tx}`}
          points={`${BOTTOM[i]},${BOTTOM_Y} ${tx},${TOP_Y} ${BOTTOM[i + 1]},${BOTTOM_Y}`}
          style={{ fill: 'var(--accent)' }}
          opacity="0.08"
        />
      ))}

      {/* bottom chord sticks */}
      {BOTTOM.slice(0, -1).map((x, i) => (
        <line key={`b-${x}`} x1={x + 4} y1={BOTTOM_Y} x2={BOTTOM[i + 1] - 4} y2={BOTTOM_Y} strokeWidth="10" strokeLinecap="round" className={stick} />
      ))}
      {/* top chord sticks */}
      {TOP.slice(0, -1).map((x, i) => (
        <line key={`t-${x}`} x1={x + 4} y1={TOP_Y} x2={TOP[i + 1] - 4} y2={TOP_Y} strokeWidth="10" strokeLinecap="round" className={stick} />
      ))}
      {/* zigzag diagonal sticks */}
      {TOP.map((tx, i) => (
        <g key={`d-${tx}`}>
          <line x1={BOTTOM[i]} y1={BOTTOM_Y} x2={tx} y2={TOP_Y} strokeWidth="10" strokeLinecap="round" className={stick} />
          <line x1={tx} y1={TOP_Y} x2={BOTTOM[i + 1]} y2={BOTTOM_Y} strokeWidth="10" strokeLinecap="round" className={stick} />
        </g>
      ))}
      {/* glue dots at every joint */}
      {[...BOTTOM.map((x) => [x, BOTTOM_Y]), ...TOP.map((x) => [x, TOP_Y])].map(([x, y]) => (
        <circle key={`j-${x}-${y}`} cx={x} cy={y} r="5.5" className="fill-stone-100 stroke-stone-400 dark:fill-stone-300 dark:stroke-stone-500" strokeWidth="2" />
      ))}

      {/* tiny end view: two walls joined across the top and bottom */}
      <g>
        <rect x="80" y="52" width="9" height="60" rx="4" className="fill-amber-600 dark:fill-amber-500" />
        <rect x="140" y="52" width="9" height="60" rx="4" className="fill-amber-600 dark:fill-amber-500" />
        <rect x="78" y="50" width="73" height="8" rx="4" className="fill-amber-700 dark:fill-amber-600" />
        <rect x="78" y="106" width="73" height="8" rx="4" className="fill-amber-700 dark:fill-amber-600" />
        <text x="60" y="136" fontSize="12" fontWeight="700" className={label}>seen from the end:</text>
        <text x="60" y="151" fontSize="12" fontWeight="700" className={label}>two walls, joined top + bottom</text>
      </g>

      {/* labels */}
      <text x="420" y="66" fontSize="13" fontWeight="700" className={label}>every gap is a triangle.</text>
      <text x="420" y="82" fontSize="13" fontWeight="700" className={label}>that is the whole secret</text>
      <line x1="450" y1="92" x2="380" y2="180" strokeDasharray="3 4" strokeWidth="1.5" className={leader} />

      <text x="310" y="300" textAnchor="middle" fontSize="13" fontWeight="700" className={label}>this is ONE wall. build two, then connect them</text>
      <text x="310" y="318" textAnchor="middle" fontSize="13" fontWeight="700" className={label}>glue every joint (the little dots) and let it dry fully</text>
    </svg>
  )
}
