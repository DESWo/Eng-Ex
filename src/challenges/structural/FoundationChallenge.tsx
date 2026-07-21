import { useEffect, useRef, useState } from 'react'
import { HardHat, RotateCcw } from 'lucide-react'
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
import { useSvgDrag } from '@/hooks/useSvgDrag'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const BEARING = 150 // what the clay can carry, kPa
const SETTLE_K = 0.1 // turns load-over-width into millimetres of sinking
const COST_PER_M2 = 40 // concrete and excavation

/** Pressure under a square footing: the load spread over its area. */
const pressure = (loadKn: number, widthM: number) => loadKn / (widthM * widthM)

/**
 * How far it sinks. Note this falls off with WIDTH, not with area, so a footing
 * sized only to pass the pressure check still sinks further under a heavier
 * column. That gap is what cracks buildings.
 */
const settlement = (loadKn: number, widthM: number) => (SETTLE_K * loadKn) / widthM

interface FootingSetup {
  /** Column loads in kN. One entry means a single footing. */
  loads: number[]
  /** Most the two sides may differ by before the frame cracks, or null. */
  maxDiff: number | null
  /** Concrete budget, or null. */
  budget: number | null
  /** Level 4 on: the ground readout is available. */
  ground: boolean
  brief: string
}

const LEVELS: ChallengeLevel<FootingSetup>[] = [
  {
    n: 1,
    title: 'Spread the load',
    phase: 'play',
    concept: 'Pressure is load over area',
    teach: 'A column concentrates its whole weight onto a small patch of soil. Widen the footing until the pressure drops below what this clay can carry.',
    setup: { loads: [1200], maxDiff: null, budget: null, ground: false, brief: 'A column is punching straight through the clay. Give it a footing wide enough to stand on.' },
  },
  {
    n: 2,
    title: 'Concrete is not free',
    phase: 'understand',
    concept: 'Excavation budget',
    teach: 'Footing cost climbs with area, so doubling the width costs four times as much. Use the smallest footing that still passes rather than the biggest you can dig.',
    setup: { loads: [1200], maxDiff: null, budget: 500, ground: false, brief: 'Same column, and the groundworks quote has come back higher than anyone hoped.' },
  },
  {
    n: 3,
    title: 'The building cracks',
    phase: 'understand',
    concept: 'Differential settlement',
    teach: 'Two columns now, one carrying four times the other. Size each one just to pass its pressure check and both are technically safe, yet the heavy side sinks twice as far and tears the frame apart. Buildings tolerate sinking. They do not tolerate sinking unevenly.',
    setup: { loads: [300, 1200], maxDiff: 8, budget: null, ground: false, brief: 'A frame on two columns with very different loads. Keep them sinking together.' },
  },
  {
    n: 4,
    title: 'Look underground',
    phase: 'analyze',
    concept: 'Pressure bulbs',
    teach: 'Turn on the ground readout. The stress spreads down into the soil in a bulb under each footing, and the deeper that bulb reaches the more soil is being squeezed. A wider footing pushes less hard and sinks less.',
    setup: { loads: [300, 1200], maxDiff: 8, budget: null, ground: true, brief: 'The same pair, with what is happening under the ground drawn out.' },
  },
  {
    n: 5,
    title: 'Pour the foundations',
    phase: 'optimize',
    concept: 'Cheap, low, and even',
    teach: 'Wide footings sink less and stay even, but concrete and excavation are billed by the square metre. Find the pair that keeps the frame straight without digging half the site out.',
    setup: { loads: [300, 1200], maxDiff: 8, budget: null, ground: true, brief: 'Sign off the foundation design for the real building.' },
    metrics: [
      { id: 'cost', label: 'Groundworks cost', goal: 'min', target: 1400 },
      { id: 'settle', label: 'Worst settlement', goal: 'min', target: 26, unit: ' mm' },
      { id: 'diff', label: 'Uneven sinking', goal: 'min', target: 6, unit: ' mm' },
    ],
  },
]

export function FoundationChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('foundation', LEVELS)
  const setup = lv.level.setup

  // Both start far too narrow, so the columns are visibly punching through.
  const [widths, setWidths] = useState<number[]>([1, 1])
  const [won, setWon] = useState(false)
  const [showGround, setShowGround] = useState(true)
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)
  const completedRef = useRef(false)

  useEffect(() => {
    setWidths([1, 1])
    setWon(false)
    setVerdict(null)
  }, [lv.level.n])

  const feet = setup.loads.map((load, i) => {
    const width = widths[i] ?? 1
    return {
      load,
      width,
      press: pressure(load, width),
      settle: settlement(load, width),
      safe: pressure(load, width) <= BEARING,
    }
  })

  const anyOverloaded = feet.some((f) => !f.safe)
  const worstSettle = Math.max(...feet.map((f) => f.settle))
  const diff = feet.length > 1 ? Math.abs(feet[1].settle - feet[0].settle) : 0
  const cost = feet.reduce((s, f) => s + COST_PER_M2 * f.width * f.width, 0)

  const overBudget = setup.budget !== null && cost > setup.budget
  const cracked = setup.maxDiff !== null && diff > setup.maxDiff
  const solved = !anyOverloaded && !overBudget && !cracked

  const reset = () => {
    setWidths([1, 1])
    setWon(false)
    setVerdict(null)
  }

  /** Pour the concrete and let the building settle onto it. */
  const pour = () => {
    if (won) return
    if (solved) {
      setWon(true)
      setVerdict({
        ok: true,
        text:
          feet.length > 1
            ? `Standing straight. Both sides settle within ${diff.toFixed(0)} mm of each other.`
            : `Solid. ${Math.round(feet[0].press)} kPa on soil that takes ${BEARING}.`,
      })
      lv.clearLevel(lv.level.metrics ? { cost, settle: worstSettle, diff } : undefined)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const text = anyOverloaded
      ? `Punching through. The soil takes ${BEARING} kPa and that footing is pushing ${Math.round(Math.max(...feet.map((f) => f.press)))} kPa.`
      : overBudget
        ? `The groundworks come to ${Math.round(cost)} and the budget is ${setup.budget}.`
        : `The frame cracked: the heavy side sank ${diff.toFixed(0)} mm further than the light one and it tolerates ${setup.maxDiff} mm. Passing the pressure check is not the same as sinking evenly.`
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'Out of pours. The site is cleared back to narrow pads. Work out the sink difference on paper first: settling is load over width.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  /** Drag a footing edge outwards. Which footing depends on where you grabbed. */
  const { bind } = useSvgDrag((x) => {
    const spotsNow = setup.loads.length > 1 ? [255, 545] : [400]
    let best = 0
    for (let i = 1; i < spotsNow.length; i++) {
      if (Math.abs(x - spotsNow[i]) < Math.abs(x - spotsNow[best])) best = i
    }
    const metres = (Math.abs(x - spotsNow[best]) * 2) / 34
    const snapped = Math.round(metres * 4) / 4
    setVerdict(null)
    setWidths((p) => p.map((w, j) => (j === best ? Math.max(1, Math.min(6, snapped)) : w)))
  })

  /* Scene */
  const GROUND_Y = 118
  const PX_PER_M = 34
  const spots = feet.length > 1 ? [255, 545] : [400]
  // Sinking is drawn much larger than life so a few millimetres is visible.
  const sinkPx = (mm: number) => Math.min(26, mm * 0.55)

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.ground ? <InsightToggle label="ground" on={showGround} onChange={setShowGround} /> : undefined}
      />

      <Objective
        goal={`Keep every footing under ${BEARING} kPa${setup.maxDiff !== null ? ` and uneven sinking under ${setup.maxDiff} mm` : ''}${setup.budget !== null ? `, spending at most ${setup.budget}` : ''}`}
        status={
          feet.length > 1
            ? `now: ${feet.map((f) => Math.round(f.press) + ' kPa').join(' / ')} · ${diff.toFixed(0)} mm uneven`
            : `now: ${Math.round(feet[0].press)} kPa`
        }
        attemptsLeft={att.left}
        met={won}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">Clay holds {BEARING} kPa</Badge>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-stone-100/80 dark:bg-white/5">
        <svg viewBox="0 0 800 300" className="w-full" role="img" aria-label="Building foundations in soil" {...bind}>
          {/* the frame, tilting when one side drops further than the other */}
          {feet.length > 1 && (
            <g>
              <line
                x1={spots[0]}
                y1={GROUND_Y - 92 + sinkPx(feet[0].settle)}
                x2={spots[1]}
                y2={GROUND_Y - 92 + sinkPx(feet[1].settle)}
                strokeWidth="12"
                strokeLinecap="round"
                className={cn(cracked ? 'stroke-rose-500' : 'stroke-stone-500 dark:stroke-stone-400')}
              />
              {cracked && (
                <text x="400" y={GROUND_Y - 106} textAnchor="middle" fontSize="13" fontWeight="700" className="fill-rose-600 font-display dark:fill-rose-300">
                  the frame is tearing
                </text>
              )}
            </g>
          )}

          {/* sky and soil */}
          <rect x="0" y={GROUND_Y} width="800" height="182" className="fill-amber-100 dark:fill-amber-950/40" />
          <line x1="0" y1={GROUND_Y} x2="800" y2={GROUND_Y} strokeWidth="2" className="stroke-amber-300 dark:stroke-amber-900" />

          {feet.map((f, i) => {
            const x = spots[i]
            const w = f.width * PX_PER_M
            const drop = sinkPx(f.settle)
            return (
              <g key={i}>
                {/* level 4 overlay: how far the squeeze reaches down */}
                {setup.ground && showGround && (
                  <ellipse
                    cx={x}
                    cy={GROUND_Y + drop + f.width * PX_PER_M * 0.75}
                    rx={w * 0.75}
                    ry={f.width * PX_PER_M * 0.85}
                    className={f.safe ? 'fill-sky-400/25' : 'fill-rose-400/30'}
                  />
                )}
                {/* column */}
                <rect x={x - 13} y={GROUND_Y - 92 + drop} width="26" height={92} className="fill-stone-500 dark:fill-stone-400" />
                {/* footing */}
                <rect
                  x={x - w / 2}
                  y={GROUND_Y + drop}
                  width={w}
                  height="16"
                  rx="3"
                  tabIndex={0}
                  role="slider"
                  aria-label={`Footing width under the ${f.load} kilonewton column`}
                  aria-valuenow={f.width}
                  aria-valuemin={1}
                  aria-valuemax={6}
                  aria-valuetext={`${f.width.toFixed(2)} metres wide`}
                  onKeyDown={(e) => {
                    const step = e.shiftKey ? 1 : 0.25
                    if (e.key === 'ArrowRight') setWidths((p) => p.map((v, j) => (j === i ? Math.min(6, v + step) : v)))
                    else if (e.key === 'ArrowLeft') setWidths((p) => p.map((v, j) => (j === i ? Math.max(1, v - step) : v)))
                    else return
                    e.preventDefault()
                  }}
                  className={cn('cursor-ew-resize outline-none', f.safe ? 'fill-slate-500 dark:fill-slate-400' : 'fill-rose-500')}
                />
                <text x={x} y={GROUND_Y - 100} textAnchor="middle" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                  {f.load} kN
                </text>
                <text x={x} y={GROUND_Y + drop + 40} textAnchor="middle" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                  {f.width.toFixed(2)} m wide
                </text>
                {setup.ground && showGround && (
                  <text x={x} y={GROUND_Y + drop + 58} textAnchor="middle" fontSize="12" fontWeight="700" className={cn('font-display', f.safe ? 'fill-sky-700 dark:fill-sky-300' : 'fill-rose-600 dark:fill-rose-300')}>
                    {Math.round(f.press)} kPa · sinks {f.settle.toFixed(0)} mm
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Verdict: the clay answers only after the pour */}
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
            Drag the footing edges to size them, then pour the concrete to see how the building settles.
          </p>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {setup.maxDiff !== null && (
          <Meter
            label="Uneven sinking"
            display={`${diff.toFixed(0)} of ${setup.maxDiff} mm allowed`}
            fraction={Math.min(1, diff / (setup.maxDiff * 2))}
            markerFraction={0.5}
            barClass={cracked ? 'bg-rose-500' : 'bg-emerald-500'}
          />
        )}
        {setup.budget !== null && (
          <Meter
            label="Groundworks"
            display={`${Math.round(cost)} of ${setup.budget}`}
            fraction={cost / setup.budget}
            barClass={overBudget ? 'bg-rose-500' : 'bg-emerald-500'}
          />
        )}
      </div>

      <p className="mt-4 text-sm text-ink-soft dark:text-stone-400">
        Drag the edge of a footing to make it wider.{' '}
        {feet.map((f, i) => (
          <span key={i} className="mr-3 whitespace-nowrap">
            <span className="font-display font-semibold">{f.load} kN</span> column:{' '}
            <span className="accent-text font-display font-bold">{f.width.toFixed(2)} m</span>
          </span>
        ))}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={pour} disabled={won}>
          <HardHat className="h-5 w-5" />
          Pour the concrete
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Reset the footings">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Cost {Math.round(cost)}</Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard metrics={lv.level.metrics} values={{ cost, settle: worstSettle, diff }} best={lv.best} scored={won} />
        </div>
      )}

      {won && (
        <LevelComplete
          lv={lv}
          message={
            lv.level.metrics
              ? `Even to within ${diff.toFixed(0)} mm for ${Math.round(cost)}. Try it cheaper.`
              : 'That will hold.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
