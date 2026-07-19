/**
 * Build diagram for the industrial "paper airplane factory" DIY project.
 * Three friends at stations along a table, with one slow bottleneck station.
 * Edit freely.
 */
const label = 'fill-ink-soft dark:fill-stone-300'
const leader = 'stroke-stone-400 dark:stroke-stone-500'

/** A simple seated-person marker. */
function Person({ x, busy = false }: { x: number; busy?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={92} r="15" className={busy ? '' : 'fill-stone-400 dark:fill-stone-500'} style={busy ? { fill: 'var(--accent)' } : undefined} />
      <path d={`M${x - 20} 140 a20 22 0 0 1 40 0 Z`} className={busy ? '' : 'fill-stone-400 dark:fill-stone-500'} style={busy ? { fill: 'var(--accent)' } : undefined} />
    </g>
  )
}

const STATIONS = [
  { x: 110, name: 'Fold wings', busy: false },
  { x: 300, name: 'Fold body', busy: true },
  { x: 490, name: 'Add tape', busy: false },
]

export function AssemblyLineDiagram() {
  return (
    <svg viewBox="0 0 640 300" className="w-full" role="img" aria-label="Assembly line build diagram">
      {/* table / conveyor */}
      <rect x="30" y="160" width="580" height="18" rx="9" className="fill-stone-300 dark:fill-stone-600" />

      {/* paper planes queueing up before the slow station */}
      {[210, 236, 262].map((x) => (
        <path key={x} d={`M${x} 152 l22 -7 l-6 7 l6 7 Z`} className="fill-stone-200 dark:fill-stone-300" />
      ))}
      {/* one plane moving on past the fast stations */}
      <path d="M560 152 l22 -7 l-6 7 l6 7 Z" style={{ fill: 'var(--accent)' }} />

      {/* flow arrows */}
      {[70, 400, 590].map((x) => (
        <path key={x} d={`M${x} 200 h26 m-6 -5 l6 5 l-6 5`} fill="none" className={leader} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      ))}

      {STATIONS.map((s) => (
        <g key={s.name}>
          <Person x={s.x} busy={s.busy} />
          <text x={s.x} y={200} textAnchor="middle" fontSize="13" fontWeight="700" className={label}>{s.name}</text>
          {s.busy && (
            <text x={s.x} y={222} textAnchor="middle" fontSize="12" fontWeight="700" className="fill-rose-500">slowest = bottleneck</text>
          )}
        </g>
      ))}

      {/* labels */}
      <text x="180" y="40" fontSize="13" fontWeight="700" className={label}>planes pile up behind the slow station</text>
      <line x1="240" y1="48" x2="236" y2="146" strokeDasharray="3 4" strokeWidth="1.5" className={leader} />

      <text x="320" y="274" textAnchor="middle" fontSize="13" fontWeight="700" className={label}>race a friend: build 10 solo, then as a 3-person line. add a helper to the slow spot and watch it speed up</text>
    </svg>
  )
}
