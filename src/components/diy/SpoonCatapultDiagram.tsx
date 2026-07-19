/**
 * Build diagram for the spoon catapult DIY project.
 * Side view of the finished build, with labels. Edit freely.
 */
const label = 'fill-ink-soft dark:fill-stone-300'
const leader = 'stroke-stone-400 dark:stroke-stone-500'

export function SpoonCatapultDiagram() {
  return (
    <svg viewBox="0 0 640 340" className="w-full" role="img" aria-label="Spoon catapult build diagram">
      {/* table */}
      <line x1="30" y1="292" x2="610" y2="292" strokeWidth="3" className="stroke-stone-300 dark:stroke-stone-600" />

      {/* bottom stick of the V */}
      <rect x="180" y="278" width="280" height="12" rx="6" className="fill-amber-700 dark:fill-amber-600" />

      {/* top stick of the V, with the spoon riding on it */}
      <g transform="rotate(-18 190 284)">
        <rect x="185" y="272" width="290" height="12" rx="6" className="fill-amber-700 dark:fill-amber-600" />
        {/* spoon lashed to the stick */}
        <rect x="380" y="264" width="70" height="8" rx="4" className="fill-stone-400 dark:fill-stone-500" />
        <ellipse cx="465" cy="264" rx="22" ry="13" className="fill-stone-300 dark:fill-stone-400" />
        <ellipse cx="465" cy="262" rx="15" ry="8" className="fill-stone-200 dark:fill-stone-300" />
        {/* marshmallow */}
        <circle cx="465" cy="252" r="9" className="fill-white stroke-stone-300 dark:stroke-stone-500" strokeWidth="2" />
        {/* rubber band lashing the spoon */}
        <ellipse cx="390" cy="272" rx="10" ry="13" fill="none" className="stroke-rose-500" strokeWidth="3" />
        <ellipse cx="402" cy="272" rx="10" ry="13" fill="none" className="stroke-rose-500" strokeWidth="3" />
      </g>

      {/* rubber band joining the V at the left end */}
      <ellipse cx="196" cy="277" rx="15" ry="12" fill="none" className="stroke-rose-500" strokeWidth="3.5" />
      <ellipse cx="208" cy="276" rx="15" ry="12" fill="none" className="stroke-rose-500" strokeWidth="3.5" />

      {/* the 3-stick wedge propping the V open */}
      <rect x="270" y="268" width="50" height="9" rx="4" className="fill-amber-600 dark:fill-amber-500" />
      <rect x="270" y="257" width="50" height="9" rx="4" className="fill-amber-600 dark:fill-amber-500" />
      <rect x="270" y="246" width="50" height="9" rx="4" className="fill-amber-600 dark:fill-amber-500" />
      <rect x="272" y="243" width="4" height="37" className="fill-rose-500" />
      <rect x="314" y="243" width="4" height="37" className="fill-rose-500" />
      {/* slide arrows for the wedge */}
      <path d="M258 235 h-16 m4 -4 l-4 4 l4 4 M332 235 h16 m-4 -4 l4 4 l-4 4" fill="none" className="stroke-stone-400 dark:stroke-stone-500" strokeWidth="2.5" strokeLinecap="round" />

      {/* launch arc */}
      <path d="M450 160 Q 540 70 600 138" fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
      <path d="M600 138 l-2 -13 l12 7 Z" style={{ fill: 'var(--accent)' }} />

      {/* labels */}
      <text x="330" y="52" textAnchor="middle" fontSize="13" fontWeight="700" className={label}>marshmallow ammo</text>
      <line x1="360" y1="60" x2="432" y2="158" strokeDasharray="3 4" strokeWidth="1.5" className={leader} />

      <text x="36" y="212" fontSize="13" fontWeight="700" className={label}>rubber-band the two</text>
      <text x="36" y="228" fontSize="13" fontWeight="700" className={label}>sticks at this end only</text>
      <line x1="120" y1="238" x2="192" y2="270" strokeDasharray="3 4" strokeWidth="1.5" className={leader} />

      <text x="230" y="322" fontSize="13" fontWeight="700" className={label}>3-stick wedge: slide it to change the launch angle</text>
      <line x1="295" y1="308" x2="295" y2="282" strokeDasharray="3 4" strokeWidth="1.5" className={leader} />

      <text x="545" y="180" textAnchor="middle" fontSize="13" fontWeight="700" className={label}>pull back, let go!</text>
    </svg>
  )
}
