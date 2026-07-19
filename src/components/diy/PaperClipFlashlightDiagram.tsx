/**
 * Build diagram for the paper clip flashlight DIY project.
 * Top-down view of the cardboard base, drawn switched ON. Edit freely.
 */
const label = 'fill-ink-soft dark:fill-stone-300'
const leader = 'stroke-stone-400 dark:stroke-stone-500'

export function PaperClipFlashlightDiagram() {
  return (
    <svg viewBox="0 0 640 340" className="w-full" role="img" aria-label="Paper clip flashlight build diagram">
      {/* cardboard base */}
      <rect x="70" y="55" width="500" height="235" rx="16" fill="#d8c39b" stroke="#b39a6b" strokeWidth="3" />

      {/* foil strip from + to the LED */}
      <polyline points="205,140 330,108 418,108" fill="none" stroke="#aab3bd" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      {/* foil strip from - toward the switch */}
      <polyline points="200,205 330,232 428,232" fill="none" stroke="#aab3bd" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      {/* small foil pad under the LED's short leg */}
      <rect x="462" y="152" width="42" height="14" rx="7" fill="#aab3bd" />

      {/* coin cell battery */}
      <circle cx="165" cy="172" r="44" fill="#c9ced6" stroke="#8b93a0" strokeWidth="3" />
      <circle cx="165" cy="172" r="34" fill="#dde1e7" />
      <text x="165" y="182" textAnchor="middle" fontSize="26" fontWeight="800" className="fill-stone-600">+</text>
      <text x="216" y="132" fontSize="18" fontWeight="800" className="fill-rose-500">+</text>
      <text x="212" y="222" fontSize="18" fontWeight="800" className="fill-stone-600 dark:fill-stone-300">−</text>

      {/* LED, glowing because the clip is closed */}
      <circle cx="443" cy="102" r="30" fill="#fde047" opacity="0.3" />
      <path d="M427 108 a16 16 0 0 1 32 0 v8 h-32 Z" fill="#f87171" stroke="#dc2626" strokeWidth="2" />
      <rect x="423" y="116" width="40" height="7" rx="3" fill="#fca5a5" />
      {/* legs: long one to the + strip, short one to the pad */}
      <line x1="434" y1="123" x2="424" y2="112" stroke="#8b93a0" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="452" y1="123" x2="474" y2="154" stroke="#8b93a0" strokeWidth="3.5" strokeLinecap="round" />

      {/* paper clip switch, swung closed onto the pad */}
      <circle cx="443" cy="228" r="6" fill="#8b93a0" />
      <g stroke="#7c8694" strokeWidth="3.5" fill="none" strokeLinecap="round">
        <path d="M443 228 L474 170" />
        <path d="M450 224 L479 169 a6 6 0 0 0 -11 -5 L441 216" />
      </g>
      {/* swing arc showing how it opens */}
      <path d="M497 212 A56 56 0 0 1 470 246" fill="none" strokeDasharray="3 6" strokeWidth="2.5" className={leader} />
      <path d="M470 246 l3 -11 l8 9 Z" className="fill-stone-400 dark:fill-stone-500" />

      {/* current direction hints */}
      <path d="M300 116 l14 -4 l-4 12 Z" style={{ fill: 'var(--accent)' }} />
      <path d="M310 224 l-14 4 l4 -12 Z" style={{ fill: 'var(--accent)' }} />

      {/* labels */}
      <text x="90" y="34" fontSize="13" fontWeight="700" className={label}>foil strips = your wires (tape them flat)</text>
      <line x1="180" y1="42" x2="300" y2="104" strokeDasharray="3 4" strokeWidth="1.5" className={leader} />

      <text x="500" y="60" fontSize="13" fontWeight="700" className={label}>LED: long leg</text>
      <text x="500" y="76" fontSize="13" fontWeight="700" className={label}>on the + strip</text>
      <line x1="497" y1="80" x2="462" y2="98" strokeDasharray="3 4" strokeWidth="1.5" className={leader} />

      <text x="78" y="316" fontSize="13" fontWeight="700" className={label}>coin cell: + side faces the top strip</text>
      <line x1="150" y1="302" x2="158" y2="220" strokeDasharray="3 4" strokeWidth="1.5" className={leader} />

      <text x="404" y="316" fontSize="13" fontWeight="700" className={label}>paper clip switch: swing it to light up</text>
      <line x1="460" y1="302" x2="452" y2="240" strokeDasharray="3 4" strokeWidth="1.5" className={leader} />
    </svg>
  )
}
