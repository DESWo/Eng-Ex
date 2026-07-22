import { useEffect, useRef, useState } from 'react'
import { FileCheck, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import { InsightToggle } from '@/components/level/InsightToggle'
import { Objective } from '@/components/level/Objective'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import { attemptsFor, useAttempts } from '@/hooks/useAttempts'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const SITE = 10000 // square metres of car park
const STEP_SECONDS = 600 // each bar of the storm is ten minutes
const RELEASE = 0.05 // m³ per second the downstream pipe will take
const MIN_PAVING = 3000 // the site still has to work as a car park
const POND_COST = 60 // per cubic metre of storage dug

/** Rain in millimetres per ten minutes. A short, sharp summer storm. */
const STORM = [1, 2, 4, 7, 9, 7, 4, 3, 2, 1, 0.6, 0.4]

/** How much of the rain landing on each surface runs straight off. */
const SURFACES = {
  paving: { label: 'Tarmac', runoff: 0.95, costPerM2: 0, note: 'Sheds almost everything' },
  permeable: { label: 'Permeable paving', runoff: 0.45, costPerM2: 0.4, note: 'Still parkable, drinks half' },
  grass: { label: 'Grass and planting', runoff: 0.2, costPerM2: 0.15, note: 'Cheapest, soaks up most' },
} as const
type SurfaceId = keyof typeof SURFACES

interface StormResult {
  overflow: number
  peakLevel: number
  landCost: number
  cost: number
  steps: { inflow: number; level: number; spill: number }[]
}

/** Route the storm through the site and into the pond, ten minutes at a time. */
function routeStorm(areas: Record<string, number>, pond: number): StormResult {
  let level = 0
  let overflow = 0
  let peakLevel = 0
  const steps: StormResult['steps'] = []

  for (const mm of STORM) {
    const inflow = (Object.keys(SURFACES) as SurfaceId[]).reduce(
      (sum, k) => sum + areas[k] * SURFACES[k].runoff * (mm / 1000),
      0,
    )
    const released = Math.min(level + inflow, RELEASE * STEP_SECONDS)
    level = level + inflow - released
    let spill = 0
    if (level > pond) {
      spill = level - pond
      overflow += spill
      level = pond
    }
    peakLevel = Math.max(peakLevel, level)
    steps.push({ inflow, level, spill })
  }

  const landCost = (Object.keys(SURFACES) as SurfaceId[]).reduce(
    (sum, k) => sum + areas[k] * SURFACES[k].costPerM2,
    0,
  )
  return { overflow, peakLevel, landCost, cost: landCost + pond * POND_COST, steps }
}

interface StormSetup {
  /** Level 3 on: the ground surface can be changed. */
  surfaces: boolean
  /** Water allowed to spill onto the road, in m³. */
  maxOverflow: number
  /** Spend limit, or null. */
  budget: number | null
  /** Level 4 on: the storm readout is available. */
  chart: boolean
  brief: string
}

const LEVELS: ChallengeLevel<StormSetup>[] = [
  {
    n: 1,
    title: 'Hold the storm',
    phase: 'play',
    concept: 'A pond buys time',
    teach: 'It is city-builder zoning, with real rain. Rain arrives far faster than the drain can swallow it, so the extra has to wait somewhere. Dig a pond big enough to hold the surge until the pipe catches up.',
    setup: { surfaces: false, maxOverflow: 0, budget: null, chart: false, brief: 'A car park floods the road every time it rains hard.' },
  },
  {
    n: 2,
    title: 'Land is expensive',
    phase: 'understand',
    concept: 'What digging costs',
    teach: 'Every cubic metre of pond is land bought and soil moved. There is a ceiling on this scheme, so the storage has to be no bigger than it needs to be.',
    setup: { surfaces: false, maxOverflow: 0, budget: 10000, chart: false, brief: 'The same car park, now with a budget from the council.' },
  },
  {
    n: 3,
    title: 'Stop it at the source',
    phase: 'understand',
    concept: 'Green beats grey',
    teach: 'No pond you can afford will hold this storm. But tarmac sheds almost every drop that lands on it, and permeable paving or planting drinks a good share before it ever becomes runoff. Shrinking the flood is cheaper than storing it.',
    setup: { surfaces: true, maxOverflow: 0, budget: 6000, chart: false, brief: 'Budget cut, and no pond that fits it will hold the water.' },
  },
  {
    n: 4,
    title: 'Watch the storm',
    phase: 'analyze',
    concept: 'Inflow against outflow',
    teach: 'Turn on the readout. The bars are what runs off each ten minutes, and the line is how full the pond gets. Everything above the pond line is water going down the road.',
    setup: { surfaces: true, maxOverflow: 0, budget: 6000, chart: true, brief: 'The same scheme, followed through the whole storm.' },
  },
  {
    n: 5,
    title: 'Get it approved',
    phase: 'optimize',
    concept: 'Dry, cheap, and still a car park',
    teach: 'Planting soaks up the most and parks the fewest cars, tarmac is the opposite, and the pond costs whatever is left over. The scheme has to stay dry, stay affordable, and still be somewhere people can park.',
    setup: { surfaces: true, maxOverflow: 0.5, budget: null, chart: true, brief: 'Submit the drainage scheme for planning approval.' },
    metrics: [
      { id: 'cost', label: 'Scheme cost', goal: 'min', target: 5500 },
      { id: 'overflow', label: 'Water on the road', goal: 'min', target: 0.5, unit: ' m³' },
      { id: 'paving', label: 'Parking kept', goal: 'max', target: 4000, unit: ' m²' },
    ],
  },
]

export function StormwaterChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('stormwater', LEVELS)
  const setup = lv.level.setup

  // No pond and all tarmac, so every level opens with the road under water.
  const [pond, setPond] = useState(0)
  // The site as 20 paintable plots of 500 m² each.
  const [cells, setCells] = useState<SurfaceId[]>(() => Array(20).fill('paving'))
  const [brush, setBrush] = useState<SurfaceId>('permeable')
  const [won, setWon] = useState(false)
  const [showChart, setShowChart] = useState(true)
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)
  const completedRef = useRef(false)

  useEffect(() => {
    setPond(0)
    setCells(Array(20).fill('paving'))
    setWon(false)
    setVerdict(null)
  }, [lv.level.n])

  const CELL = SITE / 20
  const count = (k: SurfaceId) => cells.filter((c) => c === k).length * CELL
  const perm = setup.surfaces ? count('permeable') : 0
  const grassArea = setup.surfaces ? count('grass') : 0
  const paving = SITE - perm - grassArea

  /** Paint a plot, but the site still has to work as a car park. */
  const paint = (i: number) => {
    setVerdict(null)
    setCells((prev) => {
      if (prev[i] === brush) return prev
      const next = [...prev]
      next[i] = brush
      if (next.filter((c) => c === 'paving').length * CELL < MIN_PAVING) return prev
      return next
    })
  }

  const r = routeStorm({ paving, permeable: perm, grass: grassArea }, pond)
  const overBudget = setup.budget !== null && r.cost > setup.budget
  const solved = r.overflow <= setup.maxOverflow && !overBudget

  const reset = () => {
    setPond(0)
    setCells(Array(20).fill('paving'))
    setWon(false)
    setVerdict(null)
  }

  /** Send the scheme to planning and let the next storm judge it. */
  const submitScheme = () => {
    if (won) return
    if (solved) {
      setWon(true)
      setVerdict({ ok: true, text: `Approved. Nothing on the road, ${Math.round(r.cost).toLocaleString()} all in, ${Math.round(paving).toLocaleString()} m² still parkable.` })
      lv.clearLevel(
        lv.level.metrics ? { cost: r.cost, overflow: r.overflow, paving } : undefined,
      )
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const text = overBudget
      ? `Rejected: the scheme costs ${Math.round(r.cost).toLocaleString()} and the council's budget is ${setup.budget?.toLocaleString()}.`
      : setup.surfaces && perm + grassArea === 0
        ? `The storm put ${r.overflow.toFixed(0)} m³ on the road. Everything that lands on tarmac becomes runoff, and no affordable pond can swallow all of it. Change what the ground is made of.`
        : `The storm still put ${r.overflow.toFixed(0)} m³ on the road, and planning allows ${setup.maxOverflow}.`
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'Planning refused to look at another draft. The site is back to bare tarmac. Follow one storm bar through the chart before resubmitting.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  /* Chart */
  const W = 700
  const H = 130
  const X0 = 50
  const maxIn = Math.max(...r.steps.map((s) => s.inflow), 1)
  const barW = W / STORM.length - 6

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.chart ? <InsightToggle label="the storm" on={showChart} onChange={setShowChart} /> : undefined}
      />

      <Objective
        goal={`Keep road overflow to ${setup.maxOverflow} m³${setup.budget !== null ? ` on a ${setup.budget.toLocaleString()} budget` : ''}`}
        status={`this storm: ${r.overflow.toFixed(0)} m³ on the road · ${Math.round(r.cost).toLocaleString()} spent`}
        attemptsLeft={att.left}
        met={won}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
          {STORM.reduce((a, b) => a + b, 0).toFixed(0)} mm in two hours
        </Badge>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl blueprint p-4">
        <svg viewBox={`0 0 800 ${H + 40}`} className="w-full" role="img" aria-label="Storm runoff and pond level">
          {r.steps.map((s, i) => {
            const x = X0 + i * (W / STORM.length)
            const h = (s.inflow / maxIn) * (H - 20)
            return (
              <g key={i}>
                <rect x={x} y={H - h} width={barW} height={h} rx="3" className="fill-sky-400/70" />
                {s.spill > 0.05 && (
                  <rect x={x} y={H - h - 8} width={barW} height="6" rx="2" className="fill-rose-500" />
                )}
              </g>
            )
          })}
          {/* how full the pond is */}
          {setup.chart && showChart && pond > 0 && (
            <polyline
              points={r.steps.map((s, i) => `${X0 + i * (W / STORM.length) + barW / 2},${H - (s.level / Math.max(pond, 1)) * (H - 20)}`).join(' ')}
              fill="none"
              strokeWidth="2.5"
              className="stroke-emerald-500"
            />
          )}
          <line x1={X0} y1={H} x2={X0 + W} y2={H} strokeWidth="1.5" className="stroke-stone-400 dark:stroke-stone-600" />
          <text x={X0} y={H + 20} fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
            storm starts
          </text>
          <text x={X0 + W} y={H + 20} textAnchor="end" fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
            two hours later
          </text>
          <text x={X0} y={14} fontSize="12" fontWeight="700" className="fill-sky-600 font-display dark:fill-sky-300">
            runoff
          </text>
          {setup.chart && showChart && pond > 0 && (
            <text x={X0 + 62} y={14} fontSize="12" fontWeight="700" className="fill-emerald-600 font-display dark:fill-emerald-300">
              pond filling
            </text>
          )}
          {r.overflow > 0.05 && (
            <text x={X0 + W} y={14} textAnchor="end" fontSize="12" fontWeight="700" className="fill-rose-600 font-display dark:fill-rose-300">
              {r.overflow.toFixed(0)} m³ onto the road
            </text>
          )}
        </svg>
      </div>

      {/* Verdict: planning only rules once the scheme is submitted */}
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
          <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-400">
            Paint the site, size the pond, then submit the scheme and let the design storm hit it.
          </p>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Meter
          label="Water on the road"
          display={`${r.overflow.toFixed(0)} m³`}
          fraction={Math.min(1, r.overflow / 150)}
          barClass={r.overflow <= setup.maxOverflow ? 'bg-emerald-500' : 'bg-rose-500'}
        />
        <Meter
          label="Scheme cost"
          display={setup.budget ? `${Math.round(r.cost).toLocaleString()} of ${setup.budget.toLocaleString()}` : `${Math.round(r.cost).toLocaleString()}`}
          fraction={setup.budget ? r.cost / setup.budget : Math.min(1, r.cost / 12000)}
          barClass={overBudget ? 'bg-rose-500' : 'bg-sky-500'}
        />
      </div>

      {/* Paint the site, and dig the pond in whole basins. */}
      <div className="mt-4 grid items-start gap-x-6 gap-y-4 sm:grid-cols-2">
        {setup.surfaces && (
          <div>
            <p className="mb-2 font-display text-sm font-semibold">Ground surface</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {(['paving', 'permeable', 'grass'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setBrush(k)}
                  aria-pressed={brush === k}
                  className={cn(
                    'rounded-full px-3 py-1.5 font-display text-xs font-bold transition-colors duration-200',
                    brush === k
                      ? 'accent-bg text-white shadow-clay'
                      : 'bg-stone-100 text-ink-soft hover:bg-stone-200 dark:bg-white/5 dark:text-stone-400',
                  )}
                >
                  {SURFACES[k].label}
                </button>
              ))}
            </div>
            {/* 20 cells, each 500 m² of the car park */}
            <div className="grid w-full max-w-[260px] grid-cols-5 gap-1">
              {cells.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onPointerDown={() => paint(i)}
                  onPointerEnter={(e) => e.buttons === 1 && paint(i)}
                  aria-label={`Plot ${i + 1}, currently ${SURFACES[c].label}`}
                  className={cn(
                    'aspect-square rounded transition-colors duration-100',
                    c === 'paving'
                      ? 'bg-stone-500'
                      : c === 'permeable'
                        ? 'bg-emerald-600'
                        : 'bg-lime-400',
                  )}
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink-soft dark:text-stone-400">
              Pick a surface, then paint over the car park. At least {MIN_PAVING / 500} plots must stay tarmac.
            </p>
          </div>
        )}

        <div>
          <p className="mb-2 font-display text-sm font-semibold">
            Detention pond <span className="font-normal text-ink-soft dark:text-stone-400">· {pond} m³</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 10 }, (_, i) => {
              const dug = i < pond / 20
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setVerdict(null); setPond(dug ? i * 20 : (i + 1) * 20) }}
                  aria-pressed={dug}
                  aria-label={dug ? `Fill in basin ${i + 1}` : `Dig basin ${i + 1}`}
                  className={cn(
                    'h-11 w-11 rounded-lg border-2 transition-colors duration-150',
                    dug
                      ? 'border-sky-700 bg-sky-400'
                      : 'border-dashed border-stone-300 hover:border-stone-400 dark:border-white/15',
                  )}
                />
              )
            })}
          </div>
          <p className="mt-1.5 text-xs text-ink-soft dark:text-stone-400">
            Each basin holds 20 m³ and costs land to dig.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={submitScheme} disabled={won}>
          <FileCheck className="h-5 w-5" />
          Submit the scheme
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Reset the scheme">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">{Math.round(paving).toLocaleString()} m² tarmac left</Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ cost: r.cost, overflow: r.overflow, paving }}
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
              ? `Approved at ${Math.round(r.cost).toLocaleString()}. Try keeping more parking.`
              : 'The road stays dry.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
