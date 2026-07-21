import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Eraser, Hammer, RotateCcw, Truck, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import { memberKey, solveTruss, type SolveOutcome, type TrussJoint } from '@/challenges/civil/truss'
import { InsightToggle } from '@/components/level/InsightToggle'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
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

interface BridgeSetup {
  label: string
  load: number
  /** Cost cap, or null for free materials. */
  budget: number | null
  /** Materials on the shelf. */
  materials: MaterialId[]
  /** Level 4 on: colour beams by push versus pull instead of by how hard they work. */
  forces: boolean
  /** Level 5: the deck may only sag this far under the truck (px), or null. */
  maxDeflection: number | null
  brief: string
}

const LEVELS: ChallengeLevel<BridgeSetup>[] = [
  {
    n: 1,
    title: 'Triangles hold',
    phase: 'play',
    concept: 'Shapes that keep their shape',
    teach: 'It is the bridge-builder game you already know, running on a real solver. Build a road across the gap and send the van over. A square frame folds flat under load, but a triangle cannot change shape without changing the length of a beam, so triangles are what hold bridges up.',
    setup: { label: 'The delivery van', load: 6, budget: null, materials: ['wood'], forces: false, maxDeflection: null, brief: 'A van needs to cross the river. Materials are free, so just get it across.' },
  },
  {
    n: 2,
    title: 'On a budget',
    phase: 'understand',
    concept: 'Every beam costs',
    teach: 'Timber is billed by the length now. The sprawling bridge that worked when it was free suddenly prices itself out, so every beam has to earn its place.',
    setup: { label: 'The loaded semi', load: 10, budget: 9000, materials: ['wood'], forces: false, maxDeflection: null, brief: 'A heavier truck, and the council is paying by the metre.' },
  },
  {
    n: 3,
    title: 'Wood or steel',
    phase: 'understand',
    concept: 'Spend strength where it goes',
    teach: 'Steel is more than twice the price but far stronger. No all-wood bridge can carry this load on budget, so the trick is steel only on the few beams doing the hardest work and wood everywhere else.',
    setup: { label: 'The tank convoy', load: 16, budget: 13000, materials: ['wood', 'steel'], forces: false, maxDeflection: null, brief: 'A load too heavy for timber alone, on a budget too tight for all steel.' },
  },
  {
    n: 4,
    title: 'Push and pull',
    phase: 'analyze',
    concept: 'Tension and compression',
    teach: 'Turn on the force view. Every beam is either being stretched or squashed as the truck rolls over, and the solver knows which. Stretched beams are pulled apart, squashed ones can buckle, and buckling gives out sooner, which is why the two are drawn apart.',
    setup: { label: 'The loaded semi', load: 14, budget: 13000, materials: ['wood', 'steel'], forces: true, maxDeflection: null, brief: 'The same kind of load, with the forces inside every beam drawn out.' },
  },
  {
    n: 5,
    title: 'Strength per dollar',
    phase: 'optimize',
    concept: 'Strong, stiff, and cheap',
    teach: 'The heaviest truck yet, on a budget all-steel cannot meet. A cheap bridge wobbles and a stiff one overspends, so the scorecard tracks how far the deck sags: carry the load, keep it lean, and stiffen it if you can.',
    setup: { label: 'The heavy hauler', load: 20, budget: 19000, materials: ['wood', 'steel'], forces: true, maxDeflection: null, brief: 'Sign off the bridge that goes out to tender: strong, stiff, and no more expensive than it has to be.' },
    metrics: [
      { id: 'cost', label: 'Build cost', goal: 'min', target: 16000 },
      { id: 'sag', label: 'Deck sag', goal: 'min', target: 18, unit: ' px' },
      { id: 'load', label: 'Load carried', goal: 'max', target: 20, unit: ' t' },
    ],
  },
]

type Phase = 'build' | 'testing' | 'passed' | 'failed'

const jointId = (x: number, y: number) => `j${x}_${y}`
const ANCHOR_L: TrussJoint = { id: jointId(LEFT_X, ROAD_Y), x: LEFT_X, y: ROAD_Y, fixed: true }
const ANCHOR_R: TrussJoint = { id: jointId(RIGHT_X, ROAD_Y), x: RIGHT_X, y: ROAD_Y, fixed: true }

interface TestResult {
  failedAt: string | null
  outcome: SolveOutcome | null
  utilization: Record<string, number>
  force: Record<string, number>
  /** Largest joint movement seen during the crossing, in px. */
  peakSag: number
}

export function BridgeChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('bridge', LEVELS)
  const round = lv.level.setup

  const [joints, setJoints] = useState<TrussJoint[]>([ANCHOR_L, ANCHOR_R])
  const [beams, setBeams] = useState<{ key: string; material: MaterialId }[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [material, setMaterial] = useState<MaterialId>('wood')
  const [tool, setToolState] = useState<'build' | 'remove'>('build')
  /** Where the pointer is hovering on the grid, for the placement preview. */
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  /** Snapshots taken before every change, so undo covers removals too. */
  const [history, setHistory] = useState<{ joints: TrussJoint[]; beams: { key: string; material: MaterialId }[] }[]>([])
  const [phase, setPhase] = useState<Phase>('build')
  const [test, setTest] = useState<TestResult | null>(null)
  const [runId, setRunId] = useState(0)
  const [won, setWon] = useState(false)
  const [showForces, setShowForces] = useState(true)
  const completedRef = useRef(false)
  const handledRunRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const busy = phase === 'testing'

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  // Each level starts on an empty span, and steel snaps back to wood if it is gone.
  useEffect(() => {
    setJoints([ANCHOR_L, ANCHOR_R])
    setBeams([])
    setSelected(null)
    setPhase('build')
    setTest(null)
    setWon(false)
    setMaterial(round.materials[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lv.level.n])

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
  const overBudget = round.budget !== null && cost > round.budget

  /* ---------- the road: horizontal beams at road level ---------- */
  const roadBeams = beamKeys.filter((key) => {
    const [a, b] = key.split('|')
    const ja = jointAt(a)
    const jb = jointAt(b)
    return ja && jb && ja.y === ROAD_Y && jb.y === ROAD_Y
  })

  const roadPath = useMemo(() => {
    const adj = new Map<string, string[]>()
    for (const key of roadBeams) {
      const [a, b] = key.split('|')
      adj.set(a, [...(adj.get(a) ?? []), b])
      adj.set(b, [...(adj.get(b) ?? []), a])
    }
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

  const setTool = (next: 'build' | 'remove') => {
    if (busy) return
    setToolState(next)
    setSelected(null)
    setHover(null)
  }

  const snap = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Math.round(v / GRID) * GRID))

  /** Pointer event -> snapped grid coordinates in viewBox space. */
  const svgPoint = (event: { clientX: number; clientY: number }) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    return {
      x: snap(((event.clientX - rect.left) / rect.width) * VIEW_W, MIN_X, MAX_X),
      y: snap(((event.clientY - rect.top) / rect.height) * VIEW_H, MIN_Y, MAX_Y),
    }
  }

  const pushHistory = () =>
    setHistory((prev) => [...prev.slice(-49), { joints, beams }])

  /** True if this joint still matters once `remaining` are the only beams. */
  const touchedBy = (id: string, remaining: { key: string }[]) =>
    remaining.some((b) => b.key.split('|').includes(id))

  const handleCanvasClick = (event: React.MouseEvent<SVGRectElement>) => {
    if (busy || tool !== 'build') return
    const p = svgPoint(event)
    if (!p) return
    const id = jointId(p.x, p.y)

    if (selected === id) {
      setSelected(null)
      return
    }

    const from = selected ? jointAt(selected) : null
    const exists = joints.some((j) => j.id === id)
    const len = from ? Math.hypot(p.x - from.x, p.y - from.y) : 0
    const key = from && selected ? memberKey(selected, id) : null

    // Too far for one beam: hop the chain to an existing joint, but never
    // drop a stranded new joint (the preview line shows red out there).
    if (from && len > MAX_LEN) {
      if (exists) edit(() => setSelected(id))
      return
    }

    const addsBeam = key !== null && !beamKeys.includes(key)
    if (!exists || addsBeam) pushHistory()
    edit(() => {
      if (!exists) setJoints((prev) => [...prev, { id, x: p.x, y: p.y }])
      if (addsBeam && key) setBeams((prev) => [...prev, { key, material }])
      setSelected(id)
    })
  }

  const removeBeam = (key: string) => {
    if (busy || tool !== 'remove') return
    pushHistory()
    const nextBeams = beams.filter((b) => b.key !== key)
    edit(() => {
      setBeams(nextBeams)
      // Sweep away joints the removed beam was the last to touch.
      setJoints((prev) => prev.filter((j) => j.fixed || touchedBy(j.id, nextBeams)))
    })
  }

  const removeJoint = (id: string) => {
    if (busy || tool !== 'remove') return
    pushHistory()
    const nextBeams = beams.filter((b) => !b.key.split('|').includes(id))
    edit(() => {
      setBeams(nextBeams)
      setJoints((prev) =>
        prev.filter((j) => j.id !== id && (j.fixed || touchedBy(j.id, nextBeams))),
      )
    })
  }

  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    edit(() => {
      setJoints(last.joints)
      setBeams(last.beams)
      setHistory((prev) => prev.slice(0, -1))
      setSelected(null)
    })
  }

  const reset = () => {
    if (beams.length > 0 || joints.length > 2) pushHistory()
    edit(() => {
      setJoints([ANCHOR_L, ANCHOR_R])
      setBeams([])
      setSelected(null)
    })
  }

  /* ---------- testing ---------- */
  const capsFor = (key: string) => {
    const m = MATERIALS[materialOf(key)]
    return { tension: m.tension, compression: m.compression }
  }

  const finishTest = (id: number, failedAt: string | null, peakSag: number) => {
    if (handledRunRef.current === id) return
    handledRunRef.current = id
    const sagOk = round.maxDeflection === null || peakSag <= round.maxDeflection
    if (failedAt === null && sagOk) {
      setPhase('passed')
      setWon(true)
      lv.clearLevel(
        lv.level.metrics ? { cost, sag: peakSag, load: round.load } : undefined,
      )
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
    let peakSag = 0

    for (const id of roadPath) {
      if (id === ANCHOR_L.id || id === ANCHOR_R.id) continue
      const result = solveTruss(joints, beamKeys, id, round.load, capsFor)
      for (const [key, util] of Object.entries(result.utilization)) {
        if (util > (utilization[key] ?? 0)) {
          utilization[key] = util
          force[key] = result.forces[key]
        }
      }
      for (const [dx, dy] of Object.values(result.deflection)) {
        peakSag = Math.max(peakSag, Math.hypot(dx, dy))
      }
      if (result.status !== 'ok' && failedAt === null) {
        failedAt = id
        outcome = result
      }
    }
    // The solver reports deflection in its own units; scale to something readable.
    peakSag = Math.round(peakSag * 2)

    const id = runId + 1
    setTest({ failedAt, outcome, utilization, force, peakSag })
    setRunId(id)
    setPhase('testing')
    const crossTime = failedAt ? 1.6 : 2.8
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => finishTest(id, failedAt, peakSag), crossTime * 1000 + 400)
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

  const forceView = round.forces && showForces

  /** After a test, colour each beam either by how hard it worked, or by push/pull. */
  const beamColor = (key: string) => {
    if (phase === 'failed' && test?.outcome?.worst?.key === key) return '#f43f5e'
    const util = test?.utilization[key]
    if (util === undefined) return MATERIALS[materialOf(key)].color
    if (forceView) {
      const f = test?.force[key] ?? 0
      if (Math.abs(f) < 0.5) return '#94a3b8' // idle
      return f > 0 ? '#3b82f6' : '#ef4444' // pulled = blue, pushed = red
    }
    if (util >= 1) return '#f43f5e'
    if (util >= 0.75) return '#f59e0b'
    if (util >= 0.4) return '#eab308'
    return '#22c55e'
  }

  const beamWidth = (key: string, isRoad: boolean) => {
    if (forceView) {
      const util = test?.utilization[key]
      if (util !== undefined) return 4 + Math.min(1, util) * 8
    }
    return isRoad ? 9 : 6
  }

  const failMode = test?.outcome?.status === 'unstable' ? 'unstable' : test?.outcome?.worst?.mode
  const sagFailed =
    phase === 'failed' && test?.failedAt === null && round.maxDeflection !== null && (test?.peakSag ?? 0) > round.maxDeflection
  const truckStopX = test?.failedAt ? (jointAt(test.failedAt)?.x ?? RIGHT_X) - 20 : VIEW_W + 60
  const leftover = round.budget !== null ? round.budget - cost : 0
  const gridDots: { x: number; y: number }[] = []
  for (let x = MIN_X; x <= MAX_X; x += GRID) {
    for (let y = MIN_Y; y <= MAX_Y; y += GRID) gridDots.push({ x, y })
  }

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {phase === 'passed' && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.forces ? <InsightToggle label="forces" on={showForces} onChange={setShowForces} /> : undefined}
      />

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
          <p className="mt-1 text-xs text-ink-soft dark:text-stone-500">
            {tool === 'build'
              ? 'Click to drop a joint and chain beams from the glowing one. Click the glowing joint to let go. The road must reach across at anchor height.'
              : 'Click a beam to take it out. Clicking a joint removes it and every beam on it.'}
          </p>
        </div>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
          {round.label} · {round.load} t
        </Badge>
      </div>

      {/* Build canvas */}
      <div className="relative overflow-hidden rounded-2xl bg-sky-100/70 dark:bg-sky-950/40">
        {/* Tool switch, right where the building happens. */}
        <div className="absolute left-3 top-3 z-10 flex gap-1 rounded-full bg-white/85 p-1 shadow-sm backdrop-blur dark:bg-stone-900/85">
          <button
            type="button"
            onClick={() => setTool('build')}
            aria-pressed={tool === 'build'}
            disabled={busy}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-xs font-bold transition-colors duration-150',
              tool === 'build' ? 'accent-bg text-white' : 'text-ink-soft hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-white/10',
            )}
          >
            <Hammer className="h-3.5 w-3.5" />
            Build
          </button>
          <button
            type="button"
            onClick={() => setTool('remove')}
            aria-pressed={tool === 'remove'}
            disabled={busy}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-xs font-bold transition-colors duration-150',
              tool === 'remove' ? 'bg-rose-500 text-white' : 'text-ink-soft hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-white/10',
            )}
          >
            <Eraser className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full touch-none"
          role="img"
          aria-label="Free-build bridge canvas"
        >
          <rect x={LEFT_X} y={ROAD_Y + 20} width={RIGHT_X - LEFT_X} height={VIEW_H - ROAD_Y - 20} className="fill-sky-300/80 dark:fill-sky-900" />
          <path d={`M0 ${ROAD_Y} h${LEFT_X} v${VIEW_H - ROAD_Y} H0 Z`} className="fill-emerald-300 dark:fill-emerald-950" />
          <path d={`M${VIEW_W} ${ROAD_Y} h-${VIEW_W - RIGHT_X} v${VIEW_H - ROAD_Y} H${VIEW_W} Z`} className="fill-emerald-300 dark:fill-emerald-950" />

          <rect
            x="0"
            y="0"
            width={VIEW_W}
            height={VIEW_H}
            fill="transparent"
            onClick={handleCanvasClick}
            onPointerMove={(e) => {
              if (!busy && tool === 'build') setHover(svgPoint(e))
            }}
            onPointerLeave={() => setHover(null)}
            className={busy || tool !== 'build' ? '' : 'cursor-crosshair'}
          />

          {gridDots.map(({ x, y }) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" className="pointer-events-none fill-stone-400/40 dark:fill-white/15" />
          ))}
          {/* the sag limit line for level 5 */}
          {round.maxDeflection !== null && (
            <line x1={MIN_X} y1={ROAD_Y + round.maxDeflection} x2={MAX_X} y2={ROAD_Y + round.maxDeflection} strokeDasharray="6 6" strokeWidth="2" className="pointer-events-none stroke-rose-400/70" />
          )}
          <line x1={MIN_X} y1={ROAD_Y} x2={MAX_X} y2={ROAD_Y} strokeDasharray="2 10" strokeWidth="2" className="pointer-events-none stroke-stone-400/60 dark:stroke-stone-500/50" />

          {beams.map(({ key }) => {
            const [a, b] = key.split('|')
            const pa = pos(a)
            const pb = pos(b)
            const isRoad = roadBeams.includes(key)
            const removable = tool === 'remove' && !busy
            return (
              // In build mode beams ignore the pointer entirely, so a click
              // near one always places or selects instead of deleting.
              <g
                key={key}
                onClick={(e) => { e.stopPropagation(); removeBeam(key) }}
                className={cn('group', removable && 'cursor-pointer')}
                pointerEvents={removable ? 'auto' : 'none'}
              >
                <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="transparent" strokeWidth="18" />
                <line
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  stroke={beamColor(key)}
                  strokeWidth={beamWidth(key, isRoad)}
                  strokeLinecap="round"
                  className={removable ? 'transition-opacity group-hover:opacity-30' : undefined}
                />
                {removable && (
                  <line
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    stroke="#f43f5e"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray="7 5"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  />
                )}
              </g>
            )
          })}

          {/* Placement preview: where the next joint lands, and the beam it would chain. */}
          {tool === 'build' && !busy && hover && (() => {
            const from = selected ? jointAt(selected) : null
            const tooFar = from ? Math.hypot(hover.x - from.x, hover.y - from.y) > MAX_LEN : false
            return (
              <g className="pointer-events-none">
                {from && (
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={hover.x}
                    y2={hover.y}
                    stroke={tooFar ? '#f43f5e' : '#22c55e'}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="8 6"
                    opacity="0.8"
                  />
                )}
                <circle
                  cx={hover.x}
                  cy={hover.y}
                  r="7"
                  fill="none"
                  stroke={tooFar ? '#f43f5e' : '#22c55e'}
                  strokeWidth="2.5"
                  opacity="0.9"
                />
                {tooFar && (
                  <text x={hover.x} y={hover.y - 14} textAnchor="middle" className="fill-rose-500 font-display text-[13px] font-bold">
                    too far for one beam
                  </text>
                )}
              </g>
            )
          })()}

          {joints.map((j) => {
            const p = pos(j.id)
            const isSelected = selected === j.id
            const removable = tool === 'remove' && !busy && !j.fixed
            return (
              <g
                key={j.id}
                onClick={(e) => { e.stopPropagation(); removeJoint(j.id) }}
                className={cn('group', removable ? 'cursor-pointer' : 'pointer-events-none')}
                pointerEvents={removable ? 'auto' : 'none'}
              >
                {j.fixed && <path d={`M${p.x - 15} ${p.y + 18} L${p.x} ${p.y} L${p.x + 15} ${p.y + 18} Z`} className="fill-stone-500 dark:fill-stone-400" />}
                {removable && <circle cx={p.x} cy={p.y} r="14" fill="transparent" />}
                <circle cx={p.x} cy={p.y} r={isSelected ? 8 : 6} className={isSelected ? 'fill-[var(--accent)]' : 'fill-stone-600 dark:fill-stone-300'} stroke="white" strokeWidth="2.5" />
                {isSelected && <circle cx={p.x} cy={p.y} r="13" fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2" strokeDasharray="4 4" />}
                {removable && (
                  <circle cx={p.x} cy={p.y} r="12" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="4 4" className="opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </g>
            )
          })}

          {(phase === 'testing' || phase === 'failed') && (
            <motion.g
              key={runId}
              initial={{ x: -140, y: ROAD_Y, rotate: 0 }}
              animate={phase === 'failed' && test?.failedAt ? { x: truckStopX, y: ROAD_Y + 34, rotate: -12 } : { x: truckStopX, y: ROAD_Y }}
              transition={phase === 'failed' && test?.failedAt ? { type: 'spring', stiffness: 200, damping: 15 } : { duration: test?.failedAt ? 1.6 : 2.8, ease: 'linear' }}
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
            It holds! Carried {round.load} tons{round.budget !== null ? ` for $${cost.toLocaleString('en-US')}` : ''}.
            {round.budget !== null && leftover > 0 && (
              <Badge className="bg-emerald-200 text-emerald-900 dark:bg-emerald-500/25 dark:text-emerald-200">
                ${leftover.toLocaleString('en-US')} under budget
              </Badge>
            )}
          </motion.div>
        )}
        {sagFailed && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            It held, but the deck sagged {test?.peakSag} px past the {round.maxDeflection} px line. Stiffen it with more triangles or a deeper truss.
          </motion.p>
        )}
        {phase === 'failed' && !sagFailed && failMode === 'unstable' && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            The frame folded and dropped the truck. Those shapes could not hold themselves rigid, so brace the squares into triangles.
          </motion.p>
        )}
        {phase === 'failed' && !sagFailed && failMode === 'tension' && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Snap! The red beam was pulled apart under {Math.abs(Math.round(test?.force[test.outcome!.worst!.key] ?? 0))} of tension.
          </motion.p>
        )}
        {phase === 'failed' && !sagFailed && failMode === 'compression' && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Crunch! The red beam buckled under {Math.abs(Math.round(test?.force[test.outcome!.worst!.key] ?? 0))} of compression. Squeezed beams give out sooner than stretched ones.
          </motion.p>
        )}
        {phase === 'build' && overBudget && (
          <p className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Over budget by ${(cost - (round.budget ?? 0)).toLocaleString('en-US')}.
          </p>
        )}
        {phase === 'build' && !overBudget && test && (
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-soft dark:text-stone-400">
            {forceView ? (
              <>
                From the last run:
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">pulled apart</Badge>
                <Badge className="bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300">squashed</Badge>
                <span>thicker means harder worked</span>
              </>
            ) : (
              <>
                Beam colours from the last run:
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">easy</Badge>
                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300">working</Badge>
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">near limit</Badge>
                <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">failed</Badge>
              </>
            )}
          </div>
        )}
      </div>

      {/* Material picker + budget */}
      <div className="mt-4 grid gap-4 sm:grid-cols-[auto,1fr]">
        {round.materials.length > 1 && (
          <div>
            <p className="mb-2 font-display text-sm font-semibold">Build with</p>
            <div className="flex gap-2">
              {round.materials.map((id) => {
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
        )}
        <div className="self-end">
          {round.budget !== null ? (
            <Meter
              label="Material cost"
              display={`$${cost.toLocaleString('en-US')} of $${round.budget.toLocaleString('en-US')}`}
              fraction={cost / round.budget}
              barClass={overBudget ? 'bg-rose-500' : cost / round.budget > 0.9 ? 'bg-amber-400' : 'bg-emerald-500'}
            />
          ) : (
            <p className="font-display text-sm font-semibold text-ink-soft dark:text-stone-400">
              Materials are free this level. Build whatever holds.
            </p>
          )}
          <p className="mt-1.5 text-xs text-ink-soft dark:text-stone-400">
            {beams.length} beams{!deckComplete && ' · the road does not reach across yet'}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={runTest} disabled={busy || overBudget || !deckComplete}>
          <Truck className="h-5 w-5" />
          {busy ? 'Crossing...' : 'Send the truck'}
        </Button>
        <Button variant="ghost" onClick={undo} disabled={busy || history.length === 0} aria-label="Undo last change">
          <Undo2 className="h-4 w-4" />
          Undo
        </Button>
        <Button variant="ghost" onClick={reset} disabled={busy} aria-label="Clear the bridge">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ cost, sag: test?.peakSag ?? round.maxDeflection ?? 0, load: round.load }}
            best={lv.best}
            scored={won}
          />
        </div>
      )}

      {won && (
        <LevelComplete
          lv={lv}
          message={
            lv.level.metrics
              ? `Carried ${round.load} t for $${cost.toLocaleString('en-US')}, sagging ${test?.peakSag} px. Try it leaner.`
              : 'Solid bridge. On you go.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
