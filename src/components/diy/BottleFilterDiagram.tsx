/**
 * Build diagram for the environmental "bottle water filter" DIY project.
 * A cut bottle turned upside down with layers of gravel, sand, and cotton.
 * Edit freely.
 */
const label = 'fill-ink-soft dark:fill-stone-300'
const leader = 'stroke-stone-400 dark:stroke-stone-500'

export function BottleFilterDiagram() {
  return (
    <svg viewBox="0 0 640 360" className="w-full" role="img" aria-label="Bottle water filter diagram">
      {/* pouring cup of muddy water */}
      <path d="M70 60 h70 l-8 54 h-54 Z" className="fill-stone-300 dark:fill-stone-600" />
      <path d="M78 70 h54 l-4 30 h-46 Z" fill="#8a6d3b" opacity="0.85" />
      <path d="M120 112 q6 26 22 40" fill="none" stroke="#8a6d3b" strokeWidth="6" strokeLinecap="round" />
      <text x="60" y="44" fontSize="13" fontWeight="700" className={label}>muddy water in</text>

      {/* the upside-down bottle */}
      <g>
        {/* bottle body (funnel shape, neck at bottom) */}
        <path
          d="M250 90 h150 v120 q0 40 -45 60 l-6 34 h-48 l-6 -34 q-45 -20 -45 -60 Z"
          className="fill-sky-100/70 stroke-sky-300 dark:fill-sky-950/40 dark:stroke-sky-800"
          strokeWidth="3"
        />
        {/* layers, top to bottom: gravel, sand, cotton */}
        <path d="M255 96 h140 v34 h-140 Z" fill="#9ca3af" opacity="0.8" />
        <path d="M255 130 h140 v40 h-140 Z" fill="#e6d19a" />
        <path d="M262 170 h126 q0 26 -30 42 h-66 q-30 -16 -30 -42 Z" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
        {/* neck + cap (loosened) */}
        <rect x="309" y="284" width="32" height="18" className="fill-sky-200 dark:fill-sky-900" />
      </g>

      {/* clean drip out */}
      <path d="M325 306 v26 m-4 -8 l4 8 l4 -8" fill="none" className={leader} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="325" cy="344" rx="30" ry="8" fill="#38bdf8" opacity="0.6" />

      {/* layer labels */}
      <text x="420" y="118" fontSize="13" fontWeight="700" className={label}>gravel (catches big bits)</text>
      <line x1="418" y1="113" x2="398" y2="113" strokeDasharray="3 4" strokeWidth="1.5" className={leader} />
      <text x="420" y="154" fontSize="13" fontWeight="700" className={label}>sand (catches fine dirt)</text>
      <line x1="418" y1="150" x2="398" y2="150" strokeDasharray="3 4" strokeWidth="1.5" className={leader} />
      <text x="420" y="196" fontSize="13" fontWeight="700" className={label}>cotton (catches the last specks)</text>
      <line x1="418" y1="192" x2="392" y2="192" strokeDasharray="3 4" strokeWidth="1.5" className={leader} />

      <text x="270" y="348" fontSize="12" fontWeight="700" className={label}>clearer water out (still not safe to drink!)</text>
    </svg>
  )
}
