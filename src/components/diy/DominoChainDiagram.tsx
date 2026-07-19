/**
 * Build diagram for the nuclear "domino chain reaction" DIY project.
 * A branching line of dominoes: one knocks two, each of those knocks more.
 * Edit freely.
 */
const label = 'fill-ink-soft dark:fill-stone-300'
const leader = 'stroke-stone-400 dark:stroke-stone-500'

/** A single standing domino. */
function Domino({ x, y, tipped = false }: { x: number; y: number; tipped?: boolean }) {
  return (
    <g
      style={{
        transformBox: 'fill-box',
        transformOrigin: 'bottom center',
        transform: tipped ? `rotate(-38deg)` : 'none',
      }}
    >
      <rect x={x - 7} y={y - 34} width="14" height="34" rx="2" style={{ fill: 'var(--accent)' }} />
      <line x1={x - 7} y1={y - 17} x2={x + 7} y2={y - 17} className="stroke-white/70" strokeWidth="1.5" />
    </g>
  )
}

export function DominoChainDiagram() {
  // Generations spread out to the right, each splitting into more dominoes.
  const gens = [
    [{ x: 70, y: 250 }],
    [{ x: 170, y: 190 }, { x: 170, y: 310 }],
    [
      { x: 290, y: 150 }, { x: 290, y: 220 },
      { x: 290, y: 280 }, { x: 290, y: 350 },
    ],
    [
      { x: 430, y: 120 }, { x: 430, y: 175 }, { x: 430, y: 230 },
      { x: 430, y: 290 }, { x: 430, y: 345 },
    ],
  ]

  return (
    <svg viewBox="0 0 640 400" className="w-full" role="img" aria-label="Domino chain reaction diagram">
      {/* connecting hints between generations */}
      {gens.slice(0, -1).map((gen, gi) =>
        gen.map((d, di) =>
          gens[gi + 1].map((n, ni) => (
            <line
              key={`${gi}-${di}-${ni}`}
              x1={d.x + 6}
              y1={d.y - 14}
              x2={n.x - 6}
              y2={n.y - 14}
              strokeDasharray="2 7"
              strokeWidth="1.5"
              className={leader}
              opacity="0.5"
            />
          )),
        ),
      )}

      {/* the first domino is already falling */}
      <Domino x={70} y={250} tipped />
      {gens.slice(1).flat().map((d) => (
        <Domino key={`${d.x}-${d.y}`} x={d.x} y={d.y} />
      ))}

      {/* finger giving the first push */}
      <path d="M40 250 q -18 -6 -26 4" fill="none" className="stroke-stone-500 dark:stroke-stone-300" strokeWidth="6" strokeLinecap="round" />
      <path d="M64 244 l14 -6 l-4 12 Z" style={{ fill: 'var(--accent)' }} />

      {/* labels */}
      <text x="20" y="300" fontSize="13" fontWeight="700" className={label}>one push...</text>
      <text x="480" y="140" fontSize="13" fontWeight="700" className={label}>...knocks over more</text>
      <text x="480" y="156" fontSize="13" fontWeight="700" className={label}>and more: a chain reaction</text>

      <text x="150" y="378" textAnchor="middle" fontSize="13" fontWeight="700" className={label}>space them out or pull some away to slow the chain, just like control rods</text>
    </svg>
  )
}
