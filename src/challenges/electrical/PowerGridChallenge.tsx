import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import type { ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
/** Each win moves to a new town with less wire or closed routes. */
const ROUNDS = [
  { label: 'Willow Creek', budget: 280, closed: [] as string[] },
  { label: 'Copper shortage', budget: 262, closed: [] as string[] },
  { label: 'Flood season', budget: 270, closed: ['d|e'] },
]

interface GridNode {
  id: string
  x: number
  y: number
  kind: 'plant' | 'house'
}

const NODES: GridNode[] = [
  { id: 'plant', x: 110, y: 250, kind: 'plant' },
  { id: 'a', x: 320, y: 110, kind: 'house' },
  { id: 'b', x: 300, y: 390, kind: 'house' },
  { id: 'c', x: 520, y: 170, kind: 'house' },
  { id: 'd', x: 560, y: 360, kind: 'house' },
  { id: 'e', x: 710, y: 250, kind: 'house' },
]

/** Possible wire routes. Cost is the wire length in meters. */
const EDGES: { a: string; b: string; cost: number }[] = [
  { a: 'plant', b: 'a', cost: 60 },
  { a: 'plant', b: 'b', cost: 55 },
  { a: 'plant', b: 'c', cost: 100 },
  { a: 'plant', b: 'd', cost: 115 },
  { a: 'a', b: 'b', cost: 70 },
  { a: 'a', b: 'c', cost: 55 },
  { a: 'b', b: 'c', cost: 75 },
  { a: 'b', b: 'd', cost: 65 },
  { a: 'c', b: 'd', cost: 45 },
  { a: 'c', b: 'e', cost: 50 },
  { a: 'd', b: 'e', cost: 45 },
]

const edgeId = (e: { a: string; b: string }) => `${e.a}|${e.b}`
const nodeById = (id: string) => NODES.find((n) => n.id === id)!

/** Which nodes can currently reach the power plant through built wires. */
function poweredNodes(built: string[]): Set<string> {
  const lit = new Set(['plant'])
  const queue = ['plant']
  while (queue.length > 0) {
    const current = queue.pop()!
    for (const e of EDGES) {
      if (!built.includes(edgeId(e))) continue
      const next = e.a === current ? e.b : e.b === current ? e.a : null
      if (next && !lit.has(next)) {
        lit.add(next)
        queue.push(next)
      }
    }
  }
  return lit
}

function House({ node, lit }: { node: GridNode; lit: boolean }) {
  return (
    <g transform={`translate(${node.x - 24}, ${node.y - 26})`}>
      {lit && <circle cx="24" cy="28" r="36" fill="#fde047" opacity="0.14" />}
      <motion.g
        animate={lit ? { scale: [1, 1.14, 1] } : { scale: 1 }}
        transition={{ duration: 0.45 }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      >
        <polygon points="0,18 24,-2 48,18" fill={lit ? '#8b7cf3' : '#454168'} />
        <rect x="4" y="18" width="40" height="30" rx="3" fill={lit ? '#7b6cf0' : '#3a3660'} />
        <rect x="10" y="26" width="11" height="10" rx="2" fill={lit ? '#fde047' : '#2b284d'} />
        <rect x="27" y="26" width="11" height="14" rx="2" fill={lit ? '#fbbf24' : '#2b284d'} />
      </motion.g>
    </g>
  )
}

export function PowerGridChallenge({ onComplete }: ChallengeProps) {
  const [built, setBuilt] = useState<string[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [celebrate, setCelebrate] = useState(false)
  const completedRef = useRef(false)

  const round = ROUNDS[roundIndex % ROUNDS.length]
  const openEdges = EDGES.filter((e) => !round.closed.includes(edgeId(e)))
  const used = openEdges.filter((e) => built.includes(edgeId(e))).reduce((sum, e) => sum + e.cost, 0)
  const lit = useMemo(() => poweredNodes(built), [built])
  const houses = NODES.filter((n) => n.kind === 'house')
  const litCount = houses.filter((h) => lit.has(h.id)).length
  const allLit = litCount === houses.length
  const overBudget = used > round.budget
  const won = allLit && !overBudget

  useEffect(() => {
    if (won && !completedRef.current) {
      completedRef.current = true
      setCelebrate(true)
      onComplete()
    }
  }, [won, onComplete])

  const toggle = (id: string) => {
    setBuilt((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]))
  }

  const nextRound = () => {
    setRoundIndex((i) => i + 1)
    setBuilt([])
    setCelebrate(false)
  }

  const reset = () => {
    setBuilt([])
    setCelebrate(false)
  }

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {celebrate && <Confetti />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft dark:text-stone-400">
          Tap a dashed route to build a power line. Tap it again to remove it.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="accent-soft accent-text">{round.label}</Badge>
          <Badge>
            Homes with power: {litCount} / {houses.length}
          </Badge>
          <Badge
            className={cn(
              overBudget && 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
            )}
          >
            Wire: {used} / {round.budget} m
          </Badge>
        </div>
      </div>

      {/* Night scene. Deliberately dark in both themes so the lights pop. */}
      <div className="overflow-hidden rounded-2xl bg-[#232047]">
        <svg viewBox="0 0 800 500" className="w-full" role="img" aria-label="Town power grid">
          {/* stars */}
          {[
            [60, 60], [200, 40], [420, 55], [640, 40], [760, 90],
            [90, 420], [500, 470], [720, 420],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="2" fill="#ffffff" opacity="0.25" />
          ))}

          {/* wire routes */}
          {openEdges.map((e) => {
            const id = edgeId(e)
            const n1 = nodeById(e.a)
            const n2 = nodeById(e.b)
            const isBuilt = built.includes(id)
            const energized = isBuilt && lit.has(e.a) && lit.has(e.b)
            const midX = (n1.x + n2.x) / 2
            const midY = (n1.y + n2.y) / 2
            return (
              <g
                key={id}
                onClick={() => toggle(id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    toggle(id)
                  }
                }}
                role="button"
                tabIndex={0}
                aria-pressed={isBuilt}
                aria-label={`Power line, ${e.cost} meters of wire`}
                className="cursor-pointer outline-none"
              >
                {/* wide invisible hit area */}
                <line x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke="transparent" strokeWidth="26" />
                {isBuilt ? (
                  <motion.line
                    x1={n1.x}
                    y1={n1.y}
                    x2={n2.x}
                    y2={n2.y}
                    stroke="#c4b5fd"
                    strokeWidth="5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  />
                ) : (
                  <line
                    x1={n1.x}
                    y1={n1.y}
                    x2={n2.x}
                    y2={n2.y}
                    stroke="#8884b8"
                    strokeWidth="3"
                    strokeDasharray="6 9"
                    strokeLinecap="round"
                    opacity="0.55"
                  />
                )}
                {energized && (
                  <line
                    x1={n1.x}
                    y1={n1.y}
                    x2={n2.x}
                    y2={n2.y}
                    stroke="#fde047"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className="wire-flow"
                  />
                )}
                {/* cost label */}
                <g transform={`translate(${midX}, ${midY})`}>
                  <rect
                    x="-17"
                    y="-12"
                    width="34"
                    height="24"
                    rx="12"
                    fill="#16142e"
                    stroke={isBuilt ? '#c4b5fd' : '#454168'}
                    strokeWidth="1.5"
                  />
                  <text
                    textAnchor="middle"
                    dy="4.5"
                    fontSize="13"
                    fontWeight="700"
                    fill={isBuilt ? '#e0e7ff' : '#8884b8'}
                  >
                    {e.cost}
                  </text>
                </g>
              </g>
            )
          })}

          {/* power plant */}
          {(() => {
            const plant = nodeById('plant')
            return (
              <g transform={`translate(${plant.x - 32}, ${plant.y - 30})`}>
                <motion.circle
                  cx="32"
                  cy="30"
                  r="30"
                  fill="none"
                  stroke="#fde047"
                  strokeWidth="2"
                  animate={{ scale: [1, 1.25], opacity: [0.45, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                />
                <rect x="6" y="16" width="52" height="40" rx="6" fill="#312e81" stroke="#6366f1" strokeWidth="2" />
                <rect x="12" y="2" width="10" height="18" rx="3" fill="#4338ca" />
                <rect x="28" y="6" width="10" height="14" rx="3" fill="#4338ca" />
                <path d="M36 22 L26 40 h7 l-3 12 L42 34 h-8 Z" fill="#fde047" />
                <text x="32" y="70" textAnchor="middle" fontSize="12" fontWeight="700" fill="#a5b4fc">
                  Power plant
                </text>
              </g>
            )
          })()}

          {/* houses */}
          {houses.map((h) => (
            <House key={h.id} node={h} lit={lit.has(h.id)} />
          ))}
        </svg>
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        {won && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
          >
            The whole town is glowing! You connected everyone with {round.budget - used} m of wire to spare.
          </motion.p>
        )}
        {allLit && overBudget && (
          <p className="rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            Every home is lit, but you used more wire than the budget allows.
          </p>
        )}
        {!allLit && overBudget && (
          <p className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Out of wire, and some homes are still dark.
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-end gap-3">
        {won && (
          <Button variant="accent" onClick={nextRound}>
            Next town
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" onClick={reset} aria-label="Remove all wires">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>
    </Card>
  )
}
