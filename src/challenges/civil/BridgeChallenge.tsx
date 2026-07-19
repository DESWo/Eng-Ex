import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, RotateCcw, Truck, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import { memberKey, solveTruss, type SolveOutcome, type TrussJoint } from '@/challenges/civil/truss'
import type { ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const VIEW_W = 800
const VIEW_H = 420
const GRID = 40 // build snaps to this grid
const ROAD_Y = 240 // the height the truck drives at
const LEFT_X = 160 // left anchor (edge of the left bank)
const RIGHT_X = 640 // right anchor
const MIN_X = 80
const MAX_X = 720
const MIN_Y = 80
const MAX_Y = 320
const MAX_LEN = 130 // a single beam cannot be longer than this

/** Build materials. Steel is far stronger but more than twice the price. */
const MATERIALS = {
  wood: { label: 'Wood', cost: 5, tension: 22, compression: 14, color: '#c89b6b' },
  steel: { label: 'Steel', cost: 12, tension: 50, compression: 38, color: '#9aa7b5' },
} as const
type MaterialId = keyof typeof MATERIALS

interface BridgeRound {
  label: string
  load: number
  budget: number
}

/**
 * Each win sends a heavier truck across on a tighter budget.
 * Verified against a standard Warren truss (15 beams, 1640 total length):
 *   all wood  = $8,200  holds 8t, buckles at 14t
 *   steel top = $10,720 holds 14t
 *   steel top + diagonals = $16,320 holds 20t
 *   all steel = $19,680 (deliberately does not fit the later budgets)
 */
const ROUNDS: BridgeRound[] = [
  { label: 'The delivery van', load: 8, budget: 11000 },
  { label: 'The loaded semi', load: 14, budget: 12500 },
  { label: 'The tank convoy', load: 20, budget: 17000 },
]

type Phase = 'build' | 'testing' | 'passed' | 'failed'

const jointId = (x: number, y: number) => `j${x}_${y}`
const ANCHOR_L: TrussJoint = { id: jointId(LEFT_X, ROAD_Y), x: LEFT_X, y: ROAD_Y, fixed: true }
const ANCHOR_R: TrussJoint = { id: jointId(RIGHT_X, ROAD_Y), x: RIGHT_X, y: ROAD_Y, fixed: true }

interface TestResult {
  /** Joint the truck was over when it broke, or null if it made it. */
  failedAt: string | null
  outcome: SolveOutcome | null
  /** Worst utilization each beam saw across the whole crossing. */
  utilization: Record<string, number>
  /** Peak force per beam (positive = tension, negative = compression). */
  force: Record<string, number>
}

export function BridgeChallenge({ onComplete }: ChallengeProps) {
  const [joints, setJoints] = useState<TrussJoint[]>([ANCHOR_L, ANCHOR_R])
  const [beams, setBeams] = useState<{ key: string; material: MaterialId }[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [material, setMaterial] = useState<MaterialId>('wood')
  const [roundIndex, setRoundIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('build')
  const [test, setTest] = useState<TestResult | null>(null)
  const [runId, setRunId] = useState(0)
  const completedRef = useRef(false)
  const handledRunRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const round = ROUNDS[roundIndex % ROUNDS.length]
  const busy = phase === 'testing'

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const jointAt = (id: string) => joints.find((j) => j.id === id)
  const beamKeys = beams.map((b) => b.key)
  const materialOf = (key: string) => beams.find((b) => b.key === key)?.material ?? 'wood'

  const lengthOf = (key: string) => {
    const [a, b] = key.split('|')
    const ja = jointAt(a)
    const jb = jointAt(b)
    if (!ja || !jb) return 0
    return Math.hypot(jb.x - ja.x, jb.y - ja.y)
  }

  const cost = Math.round(
    beams.reduce((sum, b) => sum + lengthOf(b.key) * MATERIALS[b.material].cost, 0),
  )
  const overBudget = cost > round.budget

  /* ---------- the road: horizontal beams at road level ---------- */
  const roadBeams = beamKeys.filter((key) => {
    const [a, b] = key.split('|')
    const ja = jointAt(a)
    const jb = jointAt(b)
    return ja && jb && ja.y === ROAD_Y && jb.y === ROAD_Y
  })

  /** Road joints in order from the left anchor, if a full deck exists. */
  const roadPath = useMemo(() => {
    const adj = new Map<string, string[]>()
    for (const key of roadBeams) {
      const [a, b] = key.split('|')
      adj.set(a, [...(adj.get(a) ?? []), b])
      adj.set(b, [...(adj.get(b) ?? []), a])
    }
    // walk from the left anchor toward the right anchor
    const seen = new Set([ANCHOR_L.id])
    const queue = [ANCHOR_L.id]
    while (queue.length) {
      const cur = queue.pop()!
      for (const next of adj.get(cur) ?? []) {
        if (!seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    if (!seen.has(ANCHOR_R.id)) return null
    return joints
      .filter((j) => seen.has(j.id) && j.y === ROAD_Y)
      .sort((a, b) => a.x - b.x)
      .map((j) => j.id)
  }, [roadBeams, joints]) // eslint-disable-line react-hooks/exhaustive-deps

  const deckComplete = roadPath !== null

  /* ---------- building ---------- */
  const edit = (fn: () => void) => {
    if (busy) return
    setPhase('build')
    setTest(null)
    fn()
  }

  const snap = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Math.round(v / GRID) * GRID))

  const handleCanvasClick = (event: React.MouseEvent<SVGRectElement>) => {
    if (busy) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = snap(((event.clientX - rect.left) / rect.width) * VIEW_W, MIN_X, MAX_X)
    const y = snap(((event.clientY - rect.top) / rect.height) * VIEW_H, MIN_Y, MAX_Y)
    const id = jointId(x, y)

    // clicking the joint you are drawing from lifts the pen, so you can start
    // a new chain somewhere else instead of being forced to connect.
    if (selected === id) {
      setSelected(null)
      return
    }

    edit(() => {
      // make sure a joint exists here
      setJoints((prev) => (prev.some((j) => j.id === id) ? prev : [...prev, { id, x, y }]))

      if (selected) {
        const from = jointAt(selected)
        const key = memberKey(selected, id)
        const len = from ? Math.hypot(x - from.x, y - from.y) : 0
        if (from && len <= MAX_LEN && !beamKeys.includes(key)) {
          setBeams((prev) => [...prev, { key, material }])
        }
      }
      // chain: keep drawing from the point just clicked
      setSelected(id)
    })
  }

  const removeBeam = (key: string) => edit(() => setBeams((prev) => prev.filter((b) => b.key !== key)))

  const undo = () =>
    edit(() => {
      setBeams((prev) => prev.slice(0, -1))
      setSelected(null)
    })

  const reset = () =>
    edit(() => {
      setJoints([ANCHOR_L, ANCHOR_R])
      setBeams([])
      setSelected(null)
    })

  /* ---------- testing ---------- */
  const capsFor = (key: string) => {
    const m = MATERIALS[materialOf(key)]
    return { tension: m.tension, compression: m.compression }
  }

  const finishTest = (id: number, failedAt: string | null) => {
    if (handledRunRef.current === id) return
    handledRunRef.current = id
    if (failedAt === null) {
      setPhase('passed')
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    } else {
      setPhase('failed')
    }
  }

  const runTest = () => {
    if (busy || overBudget || !deckComplete || !roadPath) return
    const utilization: Record<string, number> = {}
    const force: Record<string, number> = {}
    let failedAt: string | null = null
    let outcome: SolveOutcome | null = null

    // roll the truck across every road joint between the banks
    for (const id of roadPath) {
      if (id === ANCHOR_L.id || id === ANCHOR_R.id) continue
      const result = solveTruss(joints, beamKeys, id, round.load, capsFor)
      for (const [key, util] of Object.entries(result.utilization)) {
        if (util > (utilization[key] ?? 0)) {
          utilization[key] = util
          force[key] = result.forces[key]
        }
      }
      if (result.status !== 'ok' && failedAt === null) {
        failedAt = id
        outcome = result
      }
    }

    const id = runId + 1
    setTest({ failedAt, outcome, utilization, force })
    setRunId(id)
    setPhase('testing')
    const crossTime = failedAt ? 1.6 : 2.8
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => finishTest(id, failedAt), crossTime * 1000 + 400)
  }

  const nextRound = () => {
    setRoundIndex((i) => i + 1)
    setJoints([ANCHOR_L, ANCHOR_R])
    setBeams([])
    setSelected(null)
    setPhase('build')
    setTest(null)
  }

  /* ---------- drawing ---------- */
  const displaced = useMemo(() => {
    if (phase !== 'failed' || !test?.outcome) return null
    const deflection = test.outcome.deflection
    let maxMove = 0
    for (const [dx, dy] of Object.values(deflection)) {
      maxMove = Math.max(maxMove, Math.abs(dx), Math.abs(dy))
    }
    if (maxMove === 0) return null
    const scale = test.outcome.status === 'unstable' ? 46 / maxMove : Math.min(12, 30 / maxMove)
    const map: Record<string, { x: number; y: number }> = {}
    for (const j of joints) {
      const [dx, dy] = deflection[j.id] ?? [0, 0]
      map[j.id] = { x: j.x + dx * scale, y: j.y + dy * scale }
    }
    return map
  }, [phase, test, joints])

  const pos = (id: string) => displaced?.[id] ?? jointAt(id) ?? { x: 0, y: 0 }

  /** After a test, beams are colored by how hard they worked. */
  const beamColor = (key: string) => {
    if (phase === 'failed' && test?.outcome?.worst?.key === key) return '#f43f5e'
    const util = test?.utilization[key]
    if (util === undefined) return MATERIALS[materialOf(key)].color
    if (util >= 1) return '#f43f5e'
    if (util >= 0.75) return '#f59e0b'
    if (util >= 0.4) return '#eab308'
    return '#22c55e'
  }

  const failMode = test?.outcome?.status === 'unstable' ? 'unstable' : test?.outcome?.worst?.mode
  const truckStopX = test?.failedAt ? (jointAt(test.failedAt)?.x ?? RIGHT_X) - 20 : VIEW_W + 60
  const leftover = round.budget - cost
  const gridDots: { x: number; y: number }[] = []
  for (let x = MIN_X; x <= MAX_X; x += GRID) {
    for (let y = MIN_Y; y <= MAX_Y; y += GRID) gridDots.push({ x, y })
  }

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {phase === 'passed' && <Confetti />}

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <ol className="space-y-0.5 text-sm text-ink-soft dark:text-stone-400">
          <li>1. Click anywhere to drop a joint. Keep clicking to draw beams in a chain.</li>
          <li>2. Click the joint you are drawing from to lift the pen. Click a beam to delete it.</li>
          <li>3. The truck needs a road across the gap, at the height of the two anchors.</li>
        </ol>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
          {round.label} · {round.load} tons
        </Badge>
      </div>

      {/* Build canvas */}
      <div className="overflow-hidden rounded-2xl bg-sky-100/70 dark:bg-sky-950/40">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full touch-none"
          role="img"
          aria-label="Free-build bridge canvas"
        >
          {/* water + banks */}
          <rect x={LEFT_X} y={ROAD_Y + 20} width={RIGHT_X - LEFT_X} height={VIEW_H - ROAD_Y - 20} className="fill-sky-300/80 dark:fill-sky-900" />
          <path d={`M0 ${ROAD_Y} h${LEFT_X} v${VIEW_H - ROAD_Y} H0 Z`} className="fill-emerald-300 dark:fill-emerald-950" />
          <path d={`M${VIEW_W} ${ROAD_Y} h-${VIEW_W - RIGHT_X} v${VIEW_H - ROAD_Y} H${VIEW_W} Z`} className="fill-emerald-300 dark:fill-emerald-950" />

          {/* click surface */}
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="transparent" onClick={handleCanvasClick} className={busy ? '' : 'cursor-crosshair'} />

          {/* build grid */}
          {gridDots.map(({ x, y }) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" className="pointer-events-none fill-stone-400/40 dark:fill-white/15" />
          ))}
          {/* road level guide */}
          <line x1={MIN_X} y1={ROAD_Y} x2={MAX_X} y2={ROAD_Y} strokeDasharray="2 10" strokeWidth="2" className="pointer-events-none stroke-stone-400/60 dark:stroke-stone-500/50" />

          {/* beams */}
          {beams.map(({ key }) => {
            const [a, b] = key.split('|')
            const pa = pos(a)
            const pb = pos(b)
            const isRoad = roadBeams.includes(key)
            return (
              <g key={key} onClick={(e) => { e.stopPropagation(); removeBeam(key) }} className={busy ? '' : 'cursor-pointer'}>
                <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="transparent" strokeWidth="14" />
                <line
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  stroke={beamColor(key)}
                  strokeWidth={isRoad ? 9 : 6}
                  strokeLinecap="round"
                />
              </g>
            )
          })}

          {/* joints */}
          {joints.map((j) => {
            const p = pos(j.id)
            const isSelected = selected === j.id
            return (
              <g key={j.id} className="pointer-events-none">
                {j.fixed && <path d={`M${p.x - 15} ${p.y + 18} L${p.x} ${p.y} L${p.x + 15} ${p.y + 18} Z`} className="fill-stone-500 dark:fill-stone-400" />}
                <circle cx={p.x} cy={p.y} r={isSelected ? 8 : 6} className={isSelected ? 'fill-[var(--accent)]' : 'fill-stone-600 dark:fill-stone-300'} stroke="white" strokeWidth="2.5" />
                {isSelected && <circle cx={p.x} cy={p.y} r="13" fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2" strokeDasharray="4 4" />}
              </g>
            )
          })}

          {/* the truck */}
          {(phase === 'testing' || phase === 'failed') && (
            <motion.g
              key={runId}
              initial={{ x: -140, y: ROAD_Y, rotate: 0 }}
              animate={phase === 'failed' ? { x: truckStopX, y: ROAD_Y + 34, rotate: -12 } : { x: truckStopX, y: ROAD_Y }}
              transition={phase === 'failed' ? { type: 'spring', stiffness: 200, damping: 15 } : { duration: test?.failedAt ? 1.6 : 2.8, ease: 'linear' }}
              className="pointer-events-none"
            >
              <rect x="-62" y="-38" width="48" height="23" rx="5" className="fill-rose-500" />
              <rect x="-14" y="-30" width="19" height="15" rx="4" className="fill-rose-400" />
              <circle cx="-46" cy="-8" r="8" className="fill-ink dark:fill-stone-900" />
              <circle cx="-16" cy="-8" r="8" className="fill-ink dark:fill-stone-900" />
            </motion.g>
          )}
        </svg>
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        {phase === 'passed' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            It holds! Your design carried {round.load} tons for ${cost.toLocaleString('en-US')}.
            {leftover > 0 && (
              <Badge className="bg-emerald-200 text-emerald-900 dark:bg-emerald-500/25 dark:text-emerald-200">
                ${leftover.toLocaleString('en-US')} under budget
              </Badge>
            )}
          </motion.div>
        )}
        {phase === 'failed' && failMode === 'unstable' && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            The frame folded and dropped the truck. Those shapes could not hold themselves rigid.
          </motion.p>
        )}
        {phase === 'failed' && failMode === 'tension' && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Snap! The red beam was pulled apart. It was carrying {Math.abs(Math.round(test?.force[test.outcome!.worst!.key] ?? 0))} of tension.
          </motion.p>
        )}
        {phase === 'failed' && failMode === 'compression' && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Crunch! The red beam buckled under {Math.abs(Math.round(test?.force[test.outcome!.worst!.key] ?? 0))} of compression. Squeezed beams give out sooner than stretched ones.
          </motion.p>
        )}
        {phase === 'build' && overBudget && (
          <p className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Over budget by ${(cost - round.budget).toLocaleString('en-US')}.
          </p>
        )}
        {phase === 'build' && !overBudget && test && (
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-soft dark:text-stone-400">
            Beam colors from the last run:
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">easy</Badge>
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300">working</Badge>
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">near limit</Badge>
            <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">failed</Badge>
          </div>
        )}
      </div>

      {/* Material picker + budget */}
      <div className="mt-4 grid gap-4 sm:grid-cols-[auto,1fr]">
        <div>
          <p className="mb-2 font-display text-sm font-semibold">Build with</p>
          <div className="flex gap-2">
            {(Object.keys(MATERIALS) as MaterialId[]).map((id) => {
              const m = MATERIALS[id]
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMaterial(id)}
                  className={cn(
                    'rounded-2xl border-2 px-4 py-2 text-left transition-colors duration-200',
                    material === id ? 'accent-border accent-soft' : 'border-stone-200 hover:border-stone-300 dark:border-white/10 dark:hover:border-white/25',
                  )}
                >
                  <span className="mb-1 block h-2.5 w-8 rounded-full" style={{ backgroundColor: m.color }} />
                  <span className="font-display text-sm font-bold">{m.label}</span>
                  <span className="block text-xs tabular-nums text-ink-soft dark:text-stone-400">
                    ${m.cost}/length · holds {m.compression}-{m.tension}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="self-end">
          <Meter
            label="Material cost"
            display={`$${cost.toLocaleString('en-US')} of $${round.budget.toLocaleString('en-US')}`}
            fraction={cost / round.budget}
            barClass={overBudget ? 'bg-rose-500' : cost / round.budget > 0.9 ? 'bg-amber-400' : 'bg-emerald-500'}
          />
          <p className="mt-1.5 text-xs text-ink-soft dark:text-stone-400">
            {beams.length} beams{!deckComplete && ' · the road does not reach across yet'}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {phase === 'passed' ? (
          <Button variant="accent" size="lg" onClick={nextRound}>
            Next contract
            <ArrowRight className="h-5 w-5" />
          </Button>
        ) : (
          <Button variant="accent" size="lg" onClick={runTest} disabled={busy || overBudget || !deckComplete}>
            <Truck className="h-5 w-5" />
            {busy ? 'Crossing...' : 'Send the truck'}
          </Button>
        )}
        <Button variant="ghost" onClick={undo} disabled={busy || beams.length === 0} aria-label="Undo last beam">
          <Undo2 className="h-4 w-4" />
          Undo
        </Button>
        <Button variant="ghost" onClick={reset} disabled={busy} aria-label="Clear the bridge">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>
    </Card>
  )
}
