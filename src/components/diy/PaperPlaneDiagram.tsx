/**
 * Build diagram for the aerospace paper airplane DIY project.
 * Top view of a dart plane with adjustable elevator flaps at the back.
 * Edit freely.
 */
const label = 'fill-ink-soft dark:fill-stone-300'
const leader = 'stroke-stone-400 dark:stroke-stone-500'

export function PaperPlaneDiagram() {
  return (
    <svg viewBox="0 0 640 340" className="w-full" role="img" aria-label="Paper airplane build diagram">
      {/* body (two wings meeting at the center fold) */}
      <polygon points="500,170 120,90 150,170" className="fill-stone-200 dark:fill-stone-300" />
      <polygon points="500,170 120,250 150,170" className="fill-stone-300 dark:fill-stone-400" />
      {/* center fold line */}
      <line x1="150" y1="170" x2="500" y2="170" strokeDasharray="8 6" strokeWidth="2" className="stroke-stone-400 dark:stroke-stone-500" />
      {/* fold lines on each wing */}
      <line x1="500" y1="170" x2="200" y2="120" strokeDasharray="4 5" strokeWidth="1.5" className={leader} />
      <line x1="500" y1="170" x2="200" y2="220" strokeDasharray="4 5" strokeWidth="1.5" className={leader} />

      {/* elevator flaps at the back, bent up */}
      <polygon points="150,150 178,140 178,152 150,162" style={{ fill: 'var(--accent)' }} />
      <polygon points="150,190 178,200 178,188 150,178" style={{ fill: 'var(--accent)' }} />
      {/* up-bend arrows */}
      <path d="M164 132 q 6 -12 0 -22 m0 -22 m-5 8 l5 -8 l5 8" fill="none" className="stroke-stone-500 dark:stroke-stone-300" strokeWidth="2" strokeLinecap="round" />

      {/* flight path */}
      <path d="M505 172 q 70 -4 110 -34" fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
      <path d="M615 138 l-1 -12 l11 6 Z" style={{ fill: 'var(--accent)' }} />

      {/* labels */}
      <text x="70" y="70" fontSize="13" fontWeight="700" className={label}>the back flaps are your elevator</text>
      <line x1="150" y1="80" x2="165" y2="140" strokeDasharray="3 4" strokeWidth="1.5" className={leader} />

      <text x="40" y="300" fontSize="13" fontWeight="700" className={label}>bend both flaps UP a little = nose lifts.</text>
      <text x="40" y="318" fontSize="13" fontWeight="700" className={label}>bend them DOWN = nose drops. tiny tweaks!</text>

      <text x="360" y="120" fontSize="13" fontWeight="700" className={label}>throw level and watch it trim</text>
    </svg>
  )
}
