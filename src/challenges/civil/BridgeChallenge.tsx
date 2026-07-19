import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, RotateCcw, Truck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import { memberKey, memberLength, solveTruss, type SolveOutcome, type TrussJoint } from '@/challenges/civil/truss'
import type { ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const COST_PER_PX = 10 // dollars per pixel of beam
const MAX_MEMBER_LENGTH = 240 // beams longer than this cannot be built
const TENSION_CAP = 30 // snap limit when stretched
const COMPRESSION_CAP = 22 // buckle limit when squeezed (weaker on purpose)

/** Each win brings a heavier truck. Bigger trucks need extra bracing. */
const ROUNDS = [
  { label: 'The delivery van', load: 10, budget: 21000 },
  { label: 'The loaded semi', load: 17, budget: 30000 },
  { label: 'The tank convoy', load: 21, budget: 29200 },
]

/** The joints you can build between. Anchors sit on the banks. */
const JOINTS: TrussJoint[] = [
  { id: 'L', x: 120, y: 250, fixed: true },
  { id: 'R', x: 680, y: 250, fixed: true },
  { id: 'd1', x: 260, y: 250 },
  { id: 'd2', x: 400, y: 250 },
  { id: 'd3', x: 540, y: 250 },
  { id: 'u1', x: 190, y: 150 },
  { id: 'u2', x: 330, y: 150 },
  { id: 'u3', x: 470, y: 150 },
  { id: 'u4', x: 610, y: 150 },
]

/** The four road pieces the truck actually drives on. */
const DECK_KEYS = [memberKey('L', 'd1'), memberKey('d1', 'd2'), memberKey('d2', 'd3'), memberKey('d3', 'R')]

const jointById = (id: string) => JOINTS.find((j) => j.id === id)!

/** Every legal beam (short enough to build). */
const CANDIDATES: string[] = []
for (let i = 0; i < JOINTS.length; i++) {
  for (let j = i + 1; j < JOINTS.length; j++) {
    const a = JOINTS[i]
    const b = JOINTS[j]
    if (Math.hypot(b.x - a.x, b.y - a.y) <= MAX_MEMBER_LENGTH) {
      CANDIDATES.push(memberKey(a.id, b.id))
    }
  }
}

type Phase = 'build' | 'testing' | 'passed' | 'failed'

interface TestResult {
  /** Deck joint the truck was over when things went wrong (null = crossed). */
  failedAt: string | null
  outcome: SolveOutcome | null
  utilization: Record<string, number>
}

export function BridgeChallenge({ onComplete }: ChallengeProps) {
  const [built, setBuilt] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [roundIndex, setRoundIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('build')
  const [test, setTest] = useState<TestResult | null>(null)
  const [runId, setRunId] = useState(0)
  const completedRef = useRef(false)
  const handledRunRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const round = ROUNDS[roundIndex % ROUNDS.length]
  const cost = Math.round(built.reduce((sum, key) => sum + memberLength(JOINTS, key), 0) * COST_PER_PX)
  const overBudget = cost > round.budget
  const deckComplete = DECK_KEYS.every((key) => built.includes(key))
  const busy = phase === 'testing'

  const edit = (mutate: (prev: string[]) => string[]) => {
    if (busy) return
    setBuilt(mutate)
    setPhase('build')
    setTest(null)
  }

  const clickJoint = (id: string) => {
    if (busy) return
    if (selected === null) {
      setSelected(id)
      return
    }
    if (selected === id) {
      setSelected(null)
      return
    }
    const key = memberKey(selected, id)
    if (CANDIDATES.includes(key)) {
      edit((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
    }
    setSelected(null)
  }

  /** Land the verdict exactly once per test run, even if the animation stalls. */
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
    if (busy || overBudget || !deckComplete) return
    // Drive the truck over each deck joint and check the whole structure.
    const utilization: Record<string, number> = {}
    let failedAt: string | null = null
    let outcome: SolveOutcome | null = null
    for (const deckId of ['d1', 'd2', 'd3']) {
      const result = solveTruss(JOINTS, built, deckId, round.load, TENSION_CAP, COMPRESSION_CAP)
      for (const [key, util] of Object.entries(result.utilization)) {
        utilization[key] = Math.max(utilization[key] ?? 0, util)
      }
      if (result.status !== 'ok' && failedAt === null) {
        failedAt = deckId
        outcome = result
      }
    }
    const id = runId + 1
    setTest({ failedAt, outcome, utilization })
    setRunId(id)
    setPhase('testing')
    // Fallback in case the browser throttles the animation (hidden tab, etc).
    const crossTime = failedAt ? 1.6 : 2.8
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => finishTest(id, failedAt), crossTime * 1000 + 400)
  }

  const nextRound = () => {
    setRoundIndex((i) => i + 1)
    setBuilt([])
    setSelected(null)
    setPhase('build')
    setTest(null)
  }

  const reset = () => {
    setBuilt([])
    setSelected(null)
    setPhase('build')
    setTest(null)
  }

  /* Collapse drawing: shift joints by the solver's deflections. */
  const displaced = useMemo(() => {
    if (phase !== 'failed' || !test?.outcome) return null
    const deflection = test.outcome.deflection
    let maxMove = 0
    for (const [dx, dy] of Object.values(deflection)) {
      maxMove = Math.max(maxMove, Math.abs(dx), Math.abs(dy))
    }
    if (maxMove === 0) return null
    // Mechanisms move miles; broken members barely move. Normalize for drawing.
    const scale = test.outcome.status === 'unstable' ? 48 / maxMove : Math.min(14, 34 / maxMove)
    const map: Record<string, { x: number; y: number }> = {}
    for (const j of JOINTS) {
      const [dx, dy] = deflection[j.id] ?? [0, 0]
      map[j.id] = { x: j.x + dx * scale, y: j.y + dy * scale }
    }
    return map
  }, [phase, test])

  const pos = (id: string) => displaced?.[id] ?? jointById(id)

  const memberColor = (key: string) => {
    if (phase === 'failed' && test?.outcome?.worst?.key === key) return '#f43f5e'
    const util = test?.utilization[key]
    if (util === undefined) return DECK_KEYS.includes(key) ? '#8b6b4a' : '#7d8697'
    if (util >= 1) return '#f43f5e'
    if (util >= 0.75) return '#f59e0b'
    return '#22c55e'
  }

  const failMode = test?.outcome?.status === 'unstable' ? 'unstable' : test?.outcome?.worst?.mode
  const truckStopX = test?.failedAt ? jointById(test.failedAt).x - 26 : 830

  const ghostPartners = selected
    ? CANDIDATES.filter((key) => key.split('|').includes(selected) && !built.includes(key))
    : []

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {phase === 'passed' && <Confetti />}

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <ol className="space-y-0.5 text-sm text-ink-soft dark:text-stone-400">
          <li>1. Tap two dots to stretch a beam between them. Tap a beam to remove it.</li>
          <li>2. Build the road across the water first, then brace it. Triangles are your friends.</li>
          <li>3. Stay under budget, then send the truck.</li>
        </ol>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
          {round.label} · {round.load} tons
        </Badge>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-sky-100/70 dark:bg-sky-950/40">
        <svg viewBox="0 0 800 420" className="w-full" role="img" aria-label="Truss bridge builder">
          {/* water + banks */}
          <rect x="130" y="270" width="540" height="150" className="fill-sky-300/80 dark:fill-sky-900" />
          <path d="M0 258 h140 l-30 162 H0 Z" className="fill-emerald-300 dark:fill-emerald-950" />
          <path d="M800 258 h-140 l30 162 H800 Z" className="fill-emerald-300 dark:fill-emerald-950" />
          <path d="M240 320 q 20 -8 40 0 t 40 0" fill="none" className="stroke-sky-100 dark:stroke-sky-700" strokeWidth="3" strokeLinecap="round" />
          <path d="M460 360 q 20 -8 40 0 t 40 0" fill="none" className="stroke-sky-100 dark:stroke-sky-700" strokeWidth="3" strokeLinecap="round" />

          {/* faint guide for the road level */}
          <line x1="120" y1="250" x2="680" y2="250" strokeDasharray="3 10" strokeWidth="2" className="stroke-stone-400/50 dark:stroke-stone-500/40" />

          {/* ghost beams from the selected joint */}
          {ghostPartners.map((key) => {
            const [a, b] = key.split('|')
            const pa = jointById(a)
            const pb = jointById(b)
            return (
              <g key={`ghost-${key}`} onClick={() => { edit((prev) => [...prev, key]); setSelected(null) }} className="cursor-pointer">
                <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="transparent" strokeWidth="18" />
                <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} style={{ stroke: 'var(--accent)' }} strokeWidth="3" strokeDasharray="6 7" opacity="0.5" />
              </g>
            )
          })}

          {/* built beams */}
          {built.map((key) => {
            const [a, b] = key.split('|')
            const pa = pos(a)
            const pb = pos(b)
            const isDeck = DECK_KEYS.includes(key)
            return (
              <g key={key} onClick={() => edit((prev) => prev.filter((k) => k !== key))} className={busy ? undefined : 'cursor-pointer'}>
                <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="transparent" strokeWidth="16" />
                <line
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  stroke={memberColor(key)}
                  strokeWidth={isDeck ? 9 : 6}
                  strokeLinecap="round"
                  strokeDasharray={phase === 'failed' && test?.outcome?.worst?.key === key ? '10 6' : undefined}
                />
              </g>
            )
          })}

          {/* joints */}
          {JOINTS.map((j) => {
            const p = pos(j.id)
            const isSelected = selected === j.id
            return (
              <g key={j.id} onClick={() => clickJoint(j.id)} className={busy ? undefined : 'cursor-pointer'}>
                <circle cx={p.x} cy={p.y} r="20" fill="transparent" />
                {j.fixed && <path d={`M${p.x - 16} ${p.y + 18} L${p.x} ${p.y} L${p.x + 16} ${p.y + 18} Z`} className="fill-stone-500 dark:fill-stone-400" />}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isSelected ? 12 : 9}
                  className={cn(
                    'transition-[r] duration-150',
                    isSelected ? 'fill-[var(--accent)]' : 'fill-stone-600 dark:fill-stone-300',
                  )}
                  stroke="white"
                  strokeWidth="3"
                />
                {isSelected && (
                  <circle cx={p.x} cy={p.y} r="17" fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2" strokeDasharray="4 4" />
                )}
              </g>
            )
          })}

          {/* the truck */}
          {(phase === 'testing' || phase === 'failed') && (
            <motion.g
              key={runId}
              initial={{ x: -120, y: 250, rotate: 0 }}
              animate={
                phase === 'failed'
                  ? { x: truckStopX, y: 274, rotate: -10 }
                  : { x: truckStopX, y: 250 }
              }
              transition={
                phase === 'failed'
                  ? { type: 'spring', stiffness: 200, damping: 15 }
                  : { duration: test?.failedAt ? 1.6 : 2.8, ease: 'linear' }
              }
              onAnimationComplete={
                phase === 'testing' ? () => finishTest(runId, test?.failedAt ?? null) : undefined
              }
            >
              <rect x="-64" y="-40" width="50" height="24" rx="5" className="fill-rose-500" />
              <rect x="-14" y="-32" width="20" height="16" rx="4" className="fill-rose-400" />
              <circle cx="-48" cy="-9" r="8" className="fill-ink dark:fill-stone-900" />
              <circle cx="-16" cy="-9" r="8" className="fill-ink dark:fill-stone-900" />
            </motion.g>
          )}
        </svg>
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        {phase === 'passed' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
          >
            It holds! Every beam stayed inside its limits.
            {round.budget - cost >= 1000 && (
              <Badge className="bg-emerald-200 text-emerald-900 dark:bg-emerald-500/25 dark:text-emerald-200">
                Efficient build: ${(round.budget - cost).toLocaleString('en-US')} to spare
              </Badge>
            )}
          </motion.div>
        )}
        {phase === 'failed' && failMode === 'unstable' && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            The bridge folds up like paper. It is not stiff enough. Add diagonals until every shape is a triangle, and tie the tops together.
          </motion.p>
        )}
        {phase === 'failed' && failMode === 'tension' && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Snap! The red beam was stretched past its limit. More bracing spreads the pull across more beams.
          </motion.p>
        )}
        {phase === 'failed' && failMode === 'compression' && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Buckled! The red beam was squeezed until it bent. Squeezed beams fail early. Long crossing braces share the squeeze.
          </motion.p>
        )}
        {phase === 'build' && overBudget && (
          <p className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Over budget! Remove some beams.
          </p>
        )}
        {phase === 'build' && !overBudget && test && (
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-soft dark:text-stone-400">
            Beam colors from the last test:
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">relaxed</Badge>
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">working hard</Badge>
            <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">over the limit</Badge>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 grid items-end gap-x-6 gap-y-4 sm:grid-cols-[1fr,auto]">
        <div className="max-w-sm">
          <Meter
            label="Budget"
            display={`$${cost.toLocaleString('en-US')} of $${round.budget.toLocaleString('en-US')}`}
            fraction={cost / round.budget}
            barClass={overBudget ? 'bg-rose-500' : cost / round.budget > 0.9 ? 'bg-amber-400' : 'bg-emerald-500'}
          />
          <p className="mt-1.5 text-xs text-ink-soft dark:text-stone-400">
            {built.length} beams. Longer beams cost more.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          <Button variant="ghost" onClick={reset} disabled={busy} aria-label="Clear all beams">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>
      {!deckComplete && (
        <p className="mt-2 text-sm font-semibold text-ink-soft dark:text-stone-400">
          Connect the road across the bottom row of dots first.
        </p>
      )}
    </Card>
  )
}
