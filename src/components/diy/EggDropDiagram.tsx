/**
 * Build diagram for the systems "egg drop on a budget" DIY project.
 * A cushioned egg capsule with a small parachute, materials tagged by cost.
 * Edit freely.
 */
const label = 'fill-ink-soft dark:fill-stone-300'
const leader = 'stroke-stone-400 dark:stroke-stone-500'

function CostTag({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <g>
      <rect x={x} y={y} width="70" height="22" rx="11" className="fill-stone-100 stroke-stone-300 dark:fill-white/10 dark:stroke-white/20" strokeWidth="1.5" />
      <text x={x + 35} y={y + 15} textAnchor="middle" fontSize="11" fontWeight="700" className="fill-ink-soft dark:fill-stone-300">{text}</text>
    </g>
  )
}

export function EggDropDiagram() {
  return (
    <svg viewBox="0 0 640 360" className="w-full" role="img" aria-label="Egg drop capsule diagram">
      {/* parachute */}
      <path d="M250 60 a80 60 0 0 1 160 0 Z" style={{ fill: 'var(--accent)' }} opacity="0.85" />
      <path d="M250 60 a80 60 0 0 1 160 0" fill="none" className="stroke-white/50" strokeWidth="2" />
      {/* strings */}
      <line x1="255" y1="62" x2="315" y2="150" strokeWidth="1.5" className={leader} />
      <line x1="330" y1="60" x2="322" y2="150" strokeWidth="1.5" className={leader} />
      <line x1="405" y1="62" x2="330" y2="150" strokeWidth="1.5" className={leader} />

      {/* cup capsule */}
      <path d="M292 152 h62 l-8 78 h-46 Z" className="fill-amber-200 dark:fill-amber-300" />
      {/* cotton cushioning */}
      {[[305, 176], [325, 170], [340, 180], [312, 196], [332, 198]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="11" className="fill-white stroke-stone-200 dark:stroke-stone-400" strokeWidth="1.5" />
      ))}
      {/* the egg, nestled inside */}
      <ellipse cx="323" cy="186" rx="13" ry="17" className="fill-orange-100 stroke-orange-300" strokeWidth="2" />

      {/* ground + drop arrow */}
      <line x1="120" y1="300" x2="520" y2="300" strokeWidth="3" className="stroke-stone-300 dark:stroke-stone-600" />
      <path d="M470 120 v150 m-7 -12 l7 12 l7 -12" fill="none" className={leader} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* cost tags with leaders */}
      <CostTag x={430} y={54} text="chute: 4" />
      <CostTag x={200} y={168} text="cup: 3" />
      <CostTag x={360} y={210} text="cotton: 2" />

      {/* labels */}
      <text x="60" y="330" fontSize="13" fontWeight="700" className={label}>you get a budget (say 10 points). protect the egg, stay under budget, keep it light.</text>
      <text x="60" y="348" fontSize="13" fontWeight="700" className={label}>every part is a trade-off, exactly like the mission challenge.</text>
    </svg>
  )
}
