/**
 * Build diagram for the computer "two-switch logic light" DIY project.
 * Series wiring (AND) vs parallel wiring (OR), side by side.
 * Edit freely.
 */
const label = 'fill-ink-soft dark:fill-stone-300'
const wire = 'stroke-stone-500 dark:stroke-stone-400'

function Battery({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y - 12} width="26" height="24" rx="3" className="fill-stone-600 dark:fill-stone-500" />
      <text x={x + 13} y={y + 5} textAnchor="middle" fontSize="11" fontWeight="800" className="fill-white">+ -</text>
    </g>
  )
}

function Switch({ x, y, closed = true }: { x: number; y: number; closed?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r="4" className="fill-stone-600 dark:fill-stone-300" />
      <circle cx={x + 30} cy={y} r="4" className="fill-stone-600 dark:fill-stone-300" />
      <line
        x1={x}
        y1={y}
        x2={x + 30}
        y2={closed ? y : y - 14}
        strokeWidth="4"
        strokeLinecap="round"
        className={closed ? 'stroke-emerald-500' : 'stroke-stone-400'}
      />
    </g>
  )
}

function Bulb({ x, y, on = true }: { x: number; y: number; on?: boolean }) {
  return (
    <g>
      {on && <circle cx={x} cy={y} r="20" fill="#fde047" opacity="0.3" />}
      <circle cx={x} cy={y} r="12" className={on ? 'fill-yellow-300' : 'fill-stone-300 dark:fill-stone-600'} stroke="#a16207" strokeWidth="1.5" />
    </g>
  )
}

export function TwoSwitchDiagram() {
  return (
    <svg viewBox="0 0 640 320" className="w-full" role="img" aria-label="Two switch logic diagram">
      {/* ---- SERIES = AND (top) ---- */}
      <text x="40" y="40" fontSize="14" fontWeight="800" style={{ fill: 'var(--accent)' }}>SERIES = AND</text>
      <text x="40" y="58" fontSize="12" fontWeight="600" className={label}>both switches must be closed</text>
      <g fill="none" strokeWidth="4" className={wire}>
        <path d="M70 110 h30" />
        <path d="M180 110 h20" />
        <path d="M280 110 h40" />
        <path d="M338 110 h30" />
        <path d="M70 110 v-0 M70 110 M70 110" />
        <path d="M70 110 h-0" />
        <path d="M70 110" />
      </g>
      {/* series loop wires */}
      <g fill="none" strokeWidth="4" className={wire}>
        <path d="M56 110 h44" />
        <path d="M368 110 h20 v50 h-332 v-50 h44" />
      </g>
      <Battery x={44} y={160} />
      <Switch x={100} y={110} closed />
      <Switch x={200} y={110} closed />
      <Bulb x={338} y={110} on />
      <text x="100" y="90" fontSize="11" fontWeight="700" className={label}>A</text>
      <text x="200" y="90" fontSize="11" fontWeight="700" className={label}>B</text>

      {/* divider */}
      <line x1="30" y1="196" x2="610" y2="196" strokeDasharray="4 6" strokeWidth="1.5" className="stroke-stone-300 dark:stroke-stone-600" />

      {/* ---- PARALLEL = OR (bottom) ---- */}
      <text x="40" y="230" fontSize="14" fontWeight="800" style={{ fill: 'var(--accent)' }}>PARALLEL = OR</text>
      <text x="40" y="248" fontSize="12" fontWeight="600" className={label}>either switch lights it</text>
      <g fill="none" strokeWidth="4" className={wire}>
        {/* two parallel branches, each with a switch */}
        <path d="M120 274 h20" />
        <path d="M240 274 h40" />
        <path d="M120 300 h20" />
        <path d="M240 300 h40" />
        <path d="M120 274 v26" />
        <path d="M280 274 v26" />
        {/* battery + bulb rails */}
        <path d="M70 287 h50" />
        <path d="M280 287 h40" />
      </g>
      <Switch x={140} y={274} closed />
      <Switch x={140} y={300} closed={false} />
      <Battery x={44} y={287} />
      <Bulb x={338} y={287} on />
    </svg>
  )
}
