/**
 * Build diagram for the structural "tallest paper tower" DIY project.
 * Rolled paper tubes stacked into a wide-based tower holding a book.
 * Edit freely.
 */
const label = 'fill-ink-soft dark:fill-stone-300'
const leader = 'stroke-stone-400 dark:stroke-stone-500'

/** A vertical paper tube column. */
function Tube({ x, y, h, w = 20 }: { x: number; y: number; h: number; w?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={w / 2} className="fill-stone-200 stroke-stone-300 dark:fill-stone-300 dark:stroke-stone-400" strokeWidth="1.5" />
      <ellipse cx={x + w / 2} cy={y} rx={w / 2} ry="4" className="fill-stone-100 dark:fill-stone-200" />
    </g>
  )
}

export function PaperTowerDiagram() {
  return (
    <svg viewBox="0 0 640 340" className="w-full" role="img" aria-label="Paper tower diagram">
      {/* ground */}
      <line x1="120" y1="292" x2="520" y2="292" strokeWidth="3" className="stroke-stone-300 dark:stroke-stone-600" />

      {/* wide base of 3 tubes */}
      <Tube x={220} y={172} h={120} />
      <Tube x={310} y={172} h={120} />
      <Tube x={400} y={172} h={120} />
      {/* tie bars */}
      <line x1="220" y1="200" x2="420" y2="200" strokeWidth="5" className="stroke-amber-500/70" />
      <line x1="220" y1="270" x2="420" y2="270" strokeWidth="5" className="stroke-amber-500/70" />

      {/* narrower upper tier of 2 tubes */}
      <Tube x={268} y={92} h={80} />
      <Tube x={352} y={92} h={80} />
      <line x1="268" y1="120" x2="372" y2="120" strokeWidth="5" className="stroke-amber-500/70" />

      {/* the book on top */}
      <rect x="250" y="66" width="140" height="24" rx="3" style={{ fill: 'var(--accent)' }} />
      <rect x="250" y="66" width="10" height="24" className="fill-black/20" />
      {/* weight arrows */}
      <path d="M290 40 v18 m-5 -6 l5 6 l5 -6 M350 40 v18 m-5 -6 l5 6 l5 -6" fill="none" className={leader} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* labels */}
      <text x="410" y="60" fontSize="13" fontWeight="700" className={label}>can it hold the book?</text>
      <text x="424" y="140" fontSize="13" fontWeight="700" className={label}>rolled tubes beat flat paper</text>
      <line x1="422" y1="135" x2="378" y2="130" strokeDasharray="3 4" strokeWidth="1.5" className={leader} />
      <text x="70" y="250" fontSize="13" fontWeight="700" className={label}>wide base =</text>
      <text x="70" y="268" fontSize="13" fontWeight="700" className={label}>steadier tower</text>
      <line x1="150" y1="255" x2="218" y2="240" strokeDasharray="3 4" strokeWidth="1.5" className={leader} />
    </svg>
  )
}
