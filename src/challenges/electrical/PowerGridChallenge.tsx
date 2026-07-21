import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { InsightToggle } from '@/components/level/InsightToggle'
import { Objective } from '@/components/level/Objective'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import { attemptsFor, useAttempts } from '@/hooks/useAttempts'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const LOSS_PER_M = 0.15 // percent of supply lost per metre of wire travelled

interface GridSetup {
  label: string
  budget: number | null
  closed: string[]
  /** Minimum delivery a house needs, or null when any connection counts. */
  threshold: number | null
  /** Level 4 on: line load and losses are drawn. */
  flow: boolean
  /** Level 5 on: the network must survive any single line failing. */
  n1: boolean
  brief: string
}

const LEVELS: ChallengeLevel<GridSetup>[] = [
  {
    n: 1,
    title: 'Light the town',
    phase: 'play',
    concept: 'Everyone needs a path',
    teach: 'Think subway-map puzzle: clean routes, nothing wasted. Electricity only reaches a house that has an unbroken run of wire back to the plant. Build routes until every window glows. Copper is free today.',
    setup: { label: 'Willow Creek', budget: null, closed: [], threshold: null, flow: false, n1: false, brief: 'A new town with no grid at all. Connect every home.' },
  },
  {
    n: 2,
    title: 'The copper runs short',
    phase: 'understand',
    concept: 'Shared trunks beat spokes',
    teach: 'Wire is priced by the metre now, and running a private line to each house wastes it. Let houses share trunk lines and the same town connects for far less.',
    setup: { label: 'Copper shortage', budget: 475, closed: [], threshold: null, flow: false, n1: false, brief: 'The same town on a tight reel of wire. The cheapest possible network barely fits.' },
  },
  {
    n: 3,
    title: 'The far end flickers',
    phase: 'understand',
    concept: 'Wires leak',
    teach: 'Power fades along every metre it travels, so a house at the end of a long daisy-chain gets a brown-out even though it is connected. The SHORTEST network and a network that DELIVERS are not the same thing.',
    setup: { label: 'The brown-out', budget: 520, closed: [], threshold: 60, flow: false, n1: false, brief: 'The cheapest network from last time now leaves the far houses flickering. Route for delivery, not just length.' },
  },
  {
    n: 4,
    title: 'Watch the load',
    phase: 'analyze',
    concept: 'Flow and losses',
    teach: 'Turn on the readout. Thicker lines carry more homes, and the warm glow shows where power is being lost. The busiest line is the one whose failure would hurt most, remember it.',
    setup: { label: 'The brown-out II', budget: 540, closed: [], threshold: 60, flow: true, n1: false, brief: 'The same delivery problem, with the load on every line made visible.' },
  },
  {
    n: 5,
    title: 'Survive the storm',
    phase: 'optimize',
    concept: 'One line will fail',
    teach: 'A tree is the cheapest network and the worst one: cut any line and everything behind it goes dark. Build loops so every home has a second way back to the plant, and spend as little extra as you can.',
    setup: { label: 'Storm season', budget: 850, closed: [], threshold: 55, flow: true, n1: true, brief: 'The storm will take one line, and nobody knows which. The town must stay lit anyway.' },
    metrics: [
      { id: 'wire', label: 'Wire used', goal: 'min', target: 720, unit: ' m' },
      { id: 'weakest', label: 'Weakest house gets', goal: 'max', target: 58, unit: '%' },
      { id: 'lines', label: 'Lines built', goal: 'min', target: 11 },
    ],
  },
]

interface GridNode {
  id: string
  x: number
  y: number
  kind: 'plant' | 'house'
}

const NODES: GridNode[] = [
  { id: 'plant', x: 100, y: 250, kind: 'plant' },
  { id: 'a', x: 250, y: 110, kind: 'house' },
  { id: 'b', x: 240, y: 385, kind: 'house' },
  { id: 'c', x: 400, y: 205, kind: 'house' },
  { id: 'd', x: 410, y: 420, kind: 'house' },
  { id: 'e', x: 560, y: 120, kind: 'house' },
  { id: 'f', x: 570, y: 320, kind: 'house' },
  { id: 'g', x: 700, y: 210, kind: 'house' },
  { id: 'h', x: 710, y: 405, kind: 'house' },
]

/** Possible wire routes. Cost is the wire length in meters. */
const EDGES: { a: string; b: string; cost: number }[] = [
  { a: 'plant', b: 'a', cost: 55 },
  { a: 'plant', b: 'b', cost: 60 },
  { a: 'plant', b: 'c', cost: 75 },
  { a: 'a', b: 'c', cost: 45 },
  { a: 'a', b: 'b', cost: 90 },
  { a: 'b', b: 'c', cost: 70 },
  { a: 'b', b: 'd', cost: 80 },
  { a: 'c', b: 'd', cost: 70 },
  { a: 'c', b: 'e', cost: 60 },
  { a: 'c', b: 'f', cost: 65 },
  { a: 'd', b: 'f', cost: 60 },
  { a: 'd', b: 'h', cost: 95 },
  { a: 'e', b: 'f', cost: 75 },
  { a: 'e', b: 'g', cost: 55 },
  { a: 'f', b: 'g', cost: 60 },
  { a: 'f', b: 'h', cost: 70 },
  { a: 'g', b: 'h', cost: 60 },
]

const edgeId = (e: { a: string; b: string }) => `${e.a}|${e.b}`
const nodeById = (id: string) => NODES.find((n) => n.id === id)!

/** Shortest wire-distance from the plant to every reachable node. */
function distances(built: string[]): Record<string, number> {
  const dist: Record<string, number> = { plant: 0 }
  const queue: [string, number][] = [['plant', 0]]
  while (queue.length) {
    queue.sort((x, y) => x[1] - y[1])
    const [u, du] = queue.shift()!
    if (du > (dist[u] ?? Infinity)) continue
    for (const e of EDGES) {
      if (!built.includes(edgeId(e))) continue
      const v = e.a === u ? e.b : e.b === u ? e.a : null
      if (!v) continue
      const nd = du + e.cost
      if (nd < (dist[v] ?? Infinity)) {
        dist[v] = nd
        queue.push([v, nd])
      }
    }
  }
  return dist
}

/** Percent of full power a house receives, after line losses. */
const deliveredTo = (built: string[], houseId: string): number => {
  const d = distances(built)[houseId]
  return d === undefined ? 0 : Math.max(0, 100 - LOSS_PER_M * d)
}

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
  const lv = useLevels('power-grid', LEVELS)
  const round = lv.level.setup

  const [built, setBuilt] = useState<string[]>([])
  const [celebrate, setCelebrate] = useState(false)
  const [showFlow, setShowFlow] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    setBuilt([])
    setCelebrate(false)
    setWonRound(false)
    setVerdict(null)
  }, [lv.level.n])
  const openEdges = EDGES.filter((e) => !round.closed.includes(edgeId(e)))
  const used = openEdges.filter((e) => built.includes(edgeId(e))).reduce((sum, e) => sum + e.cost, 0)
  const lit = useMemo(() => poweredNodes(built), [built])
  const houses = NODES.filter((n) => n.kind === 'house')
  const delivery = useMemo(() => {
    const map: Record<string, number> = {}
    for (const h of houses) map[h.id] = deliveredTo(built, h.id)
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built])
  const threshold = round.threshold ?? 0
  const served = (id: string) =>
    round.threshold === null ? lit.has(id) : delivery[id] >= threshold
  const litCount = houses.filter((h) => served(h.id)).length
  const allLit = litCount === houses.length
  const weakest = Math.min(...houses.map((h) => delivery[h.id]))
  const overBudget = round.budget !== null && used > round.budget

  // Level 5: pull each built line in turn and see whether the town survives.
  const survivesAnyCut = useMemo(() => {
    if (!round.n1) return true
    for (const cut of built) {
      const rest = built.filter((e) => e !== cut)
      const ok = houses.every((h) => deliveredTo(rest, h.id) >= threshold)
      if (!ok) return false
    }
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built, round.n1, threshold])

  const solvedNow = allLit && !overBudget && survivesAnyCut

  const [wonRound, setWonRound] = useState(false)
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)

  /** Throw the main breaker and see what the town thinks. */
  const energize = () => {
    if (wonRound) return
    if (solvedNow) {
      setWonRound(true)
      setCelebrate(true)
      setVerdict({ ok: true, text: `The whole town is glowing!${round.budget !== null ? ` ${round.budget - used} m of wire to spare.` : ''}` })
      lv.clearLevel(
        lv.level.metrics
          ? { wire: used, weakest: Math.round(weakest), lines: built.length }
          : undefined,
      )
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const text =
      allLit && !overBudget && round.n1 && !survivesAnyCut
        ? 'Everyone is lit today, but the storm test cut one line and part of the town went dark. Every home needs a second route.'
        : !allLit && round.threshold !== null && houses.every((h) => lit.has(h.id))
          ? 'Every home is connected, but the far ones got a brown-out. Power fades with every metre, so give the far end a shorter route.'
          : allLit && overBudget
            ? `Every home is lit, but ${used} m of wire is over the ${round.budget} m reel.`
            : !allLit
              ? `${houses.length - litCount} home${houses.length - litCount === 1 ? ' is' : 's are'} still dark.`
              : 'The grid failed its acceptance test.'
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'The utility pulled the crew. Poles bare again. Sketch the shortest routes that still deliver before rebuilding.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  const toggle = (id: string) => {
    setVerdict(null)
    setBuilt((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]))
  }

  const reset = () => {
    setBuilt([])
    setCelebrate(false)
    setWonRound(false)
    setVerdict(null)
  }

  /** Homes whose cheapest route to the plant would lose this line. */
  const loadOf = (id: string): number => {
    if (!round.flow) return 0
    const rest = built.filter((e) => e !== id)
    return houses.filter((h) => delivery[h.id] > 0 && deliveredTo(rest, h.id) < delivery[h.id] - 0.01).length
  }

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {celebrate && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.flow ? <InsightToggle label="line load" on={showFlow} onChange={setShowFlow} /> : undefined}
      />

      <Objective
        goal={`Light every home${round.threshold !== null ? ` with delivery ${round.threshold}% or better` : ''}${round.budget !== null ? ` on ${round.budget} m of wire` : ''}${round.n1 ? ', and survive losing any one line' : ''}`}
        status={`${litCount} of ${houses.length} homes served · ${used} m used`}
        attemptsLeft={att.left}
        met={wonRound}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-sm text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
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
            Wire: {used}{round.budget !== null ? ` / ${round.budget}` : ''} m
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
                    stroke={round.flow && showFlow && loadOf(id) > 0 ? '#fbbf24' : '#c4b5fd'}
                    strokeWidth={round.flow && showFlow ? 3 + loadOf(id) * 1.4 : 5}
                    strokeOpacity={round.flow && showFlow ? 0.55 + Math.min(0.45, loadOf(id) * 0.08) : 1}
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

          {/* houses: dark, brown-out, or fully lit */}
          {houses.map((h) => (
            <g key={h.id} opacity={lit.has(h.id) && !served(h.id) ? 0.75 : 1}>
              <House node={h} lit={served(h.id)} />
              {round.threshold !== null && lit.has(h.id) && (
                <text
                  x={h.x}
                  y={h.y + 44}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill={served(h.id) ? '#a7f3d0' : '#fbbf24'}
                >
                  {Math.round(delivery[h.id])}%
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        {verdict ? (
          <p
            className={cn(
              'rounded-xl px-4 py-2.5 text-sm font-semibold',
              verdict.ok
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
            )}
          >
            {verdict.text}
          </p>
        ) : (
          <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-300">
            String the lines, then energize the grid for the acceptance test.
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-end gap-3">
        <Button variant="accent" size="lg" onClick={energize} disabled={wonRound}>
          <Zap className="h-5 w-5" />
          Energize the grid
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Remove all wires">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ wire: used, weakest: Math.round(Math.max(0, weakest)), lines: built.length }}
            best={lv.best}
            scored={wonRound}
          />
        </div>
      )}

      {wonRound && (
        <LevelComplete
          lv={lv}
          message={
            lv.level.metrics
              ? `Storm-proof on ${used} m of wire. Try trimming a loop.`
              : 'The whole town glows.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
