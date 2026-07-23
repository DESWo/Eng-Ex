import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { FlaskConical, RotateCcw } from 'lucide-react'
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
const T_MIN = 300 // °C
const T_MAX = 700
const T_STEP = 20
const TIME_MIN = 1 // arbitrary residence-time units (minutes on the dial)
const TIME_MAX = 10

/**
 * An exothermic, reversible reaction, which is where chemical engineering
 * stops being obvious. Heat makes the reaction go FASTER but pushes the
 * equilibrium BACKWARDS, so the ceiling on how much product you can ever make
 * drops as the reactor gets hotter. The best yield sits at a warm middle, not
 * at the top of the dial.
 */
const eqCeiling = (t: number) => Math.max(0.3, Math.min(0.98, 0.98 - 0.0011 * (t - 300)))
const approach = (t: number, time: number) => 1 - Math.exp(-0.02 * Math.exp((t - 300) / 70) * time)
const conversionOf = (t: number, time: number) => eqCeiling(t) * approach(t, time)
/** Fuel to hold the reactor at temperature for that long. */
const energyOf = (t: number, time: number) => Math.round(((t - 260) / 40) * time)

interface ReactionSetup {
  /** Conversion the batch has to reach, 0..1. */
  target: number
  /** Residence time is fixed until the player is trusted to set it. */
  fixedTime: number | null
  /** Fuel allowed, or null. */
  energyBudget: number | null
  /** Level 4 on: the rate-vs-equilibrium readout is available. */
  curves: boolean
  brief: string
}

const LEVELS: ChallengeLevel<ReactionSetup>[] = [
  {
    n: 1,
    title: 'Warm it up',
    phase: 'play',
    concept: 'Heat speeds a reaction',
    teach: 'It is a cooking game with a chemistry twist. A cold reactor barely reacts. Turn the heat up and the reactants turn into product faster, so raise the temperature until enough of the batch has converted.',
    setup: { target: 0.35, fixedTime: 6, energyBudget: null, curves: false, brief: 'A sluggish reactor. Give it enough heat to actually react.' },
  },
  {
    n: 2,
    title: 'Heat costs fuel',
    phase: 'understand',
    concept: 'Hot reactors are thirsty',
    teach: 'Holding a reactor hot burns fuel every minute, and this plant has a gas bill. Reach the target without simply pinning the dial to maximum, because the hottest run is also the most expensive.',
    setup: { target: 0.4, fixedTime: 6, energyBudget: 90, curves: false, brief: 'The same reaction, now with the gas meter running.' },
  },
  {
    n: 3,
    title: 'Hotter is not better',
    phase: 'understand',
    concept: 'Equilibrium fights back',
    teach: 'This reaction gives off heat, so a hot reactor actually pushes product back into reactant: the ceiling on how much you can make DROPS as it heats up. Crank the dial to the top and yield falls. The best batch is at a warm middle.',
    setup: { target: 0.62, fixedTime: 6, energyBudget: null, curves: false, brief: 'Chase the yield up the dial and watch it turn back down on you.' },
  },
  {
    n: 4,
    title: 'Read the two curves',
    phase: 'analyze',
    concept: 'Rate against ceiling',
    teach: 'Turn on the readout. One line is how fast the reaction reaches its limit (climbs with heat), the other is that limit itself (falls with heat). Your yield is the two multiplied, and it peaks where they cross over.',
    setup: { target: 0.66, fixedTime: 6, energyBudget: null, curves: true, brief: 'The same trade, with the rate and equilibrium curves drawn out.' },
  },
  {
    n: 5,
    title: 'Sign off the process',
    phase: 'optimize',
    concept: 'Yield, fuel, and time',
    teach: 'You set the residence time too now. A long slow bake reaches the ceiling on less heat but ties up the reactor; a fast hot run frees it sooner but costs fuel and yield. Find the recipe the plant will run for years.',
    setup: { target: 0.6, fixedTime: null, energyBudget: 140, curves: true, brief: 'Design the operating point: high yield, cheap fuel, quick turnaround.' },
    metrics: [
      { id: 'yield', label: 'Conversion', goal: 'max', target: 68, unit: '%' },
      { id: 'energy', label: 'Fuel burned', goal: 'min', target: 90 },
      { id: 'time', label: 'Batch time', goal: 'min', target: 6, unit: ' min' },
    ],
  },
]

export function ReactionChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('reaction', LEVELS)
  const setup = lv.level.setup

  const [temp, setTemp] = useState(360)
  const [time, setTime] = useState(setup.fixedTime ?? 6)
  const [won, setWon] = useState(false)
  const [showCurves, setShowCurves] = useState(true)
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)
  const completedRef = useRef(false)

  useEffect(() => {
    setTemp(360)
    setTime(setup.fixedTime ?? 6)
    setWon(false)
    setVerdict(null)
  }, [lv.level.n, setup.fixedTime])

  const conv = conversionOf(temp, time)
  const energy = energyOf(temp, time)
  const overEnergy = setup.energyBudget !== null && energy > setup.energyBudget
  const solved = conv >= setup.target && !overEnergy

  const reset = () => {
    setTemp(360)
    setTime(setup.fixedTime ?? 6)
    setWon(false)
    setVerdict(null)
  }

  /** Run the batch and see what came out of the reactor. */
  const runBatch = () => {
    if (won) return
    if (solved) {
      setWon(true)
      setVerdict({ ok: true, text: `Good batch. ${Math.round(conv * 100)}% converted, on ${energy} of fuel.` })
      lv.clearLevel(lv.level.metrics ? { yield: Math.round(conv * 100), energy, time } : undefined)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const text = overEnergy
      ? `That run burned ${energy} of fuel and the budget is ${setup.energyBudget}. Back the heat off.`
      : temp > 560 && conv < setup.target
        ? `Only ${Math.round(conv * 100)}% converted. The reactor is too hot: the product is turning back into reactant. Try cooler.`
        : `Only ${Math.round(conv * 100)}% converted, and the target is ${Math.round(setup.target * 100)}%. It needs more heat or more time.`
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'Batch dumped, reactor flushed. Read the curves before you set the dial this time.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  const change = (setter: (fn: (v: number) => number) => void, delta: number, min: number, max: number) => {
    setVerdict(null)
    setter((v) => Math.max(min, Math.min(max, v + delta)))
  }

  /* Scene geometry */
  const W = 800
  const H = 250
  // temperature as a fill height in the vessel
  const heatFrac = (temp - T_MIN) / (T_MAX - T_MIN)
  const glow = `rgba(${Math.round(120 + heatFrac * 135)}, ${Math.round(90 - heatFrac * 40)}, 40, ${0.35 + heatFrac * 0.4})`

  // curve overlay points
  const CX0 = 90
  const CX1 = 720
  const CY0 = 40
  const CY1 = 150
  const tx = (t: number) => CX0 + ((t - T_MIN) / (T_MAX - T_MIN)) * (CX1 - CX0)
  const cy = (v: number) => CY1 - v * (CY1 - CY0)
  const ceilPts: string[] = []
  const convPts: string[] = []
  for (let t = T_MIN; t <= T_MAX; t += 10) {
    ceilPts.push(`${tx(t)},${cy(eqCeiling(t))}`)
    convPts.push(`${tx(t)},${cy(conversionOf(t, time))}`)
  }

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.curves ? <InsightToggle label="rate curves" on={showCurves} onChange={setShowCurves} /> : undefined}
      />

      <Objective
        goal={`Convert at least ${Math.round(setup.target * 100)}% of the batch${setup.energyBudget !== null ? ` on ${setup.energyBudget} of fuel` : ''}`}
        status={`this run: ${Math.round(conv * 100)}% converted · ${energy} fuel`}
        attemptsLeft={att.left}
        met={won}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">Exothermic · reversible</Badge>
      </div>

      {/* Scene: the reactor vessel + optional rate curves */}
      <div className="overflow-hidden rounded-2xl blueprint">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Chemical reactor">
          {/* rate/equilibrium curves */}
          {setup.curves && showCurves && (
            <g>
              <polyline points={ceilPts.join(' ')} fill="none" strokeWidth="2.5" className="stroke-rose-400" strokeDasharray="5 5" />
              <polyline points={convPts.join(' ')} fill="none" strokeWidth="3" className="stroke-emerald-500" />
              <line x1={tx(temp)} y1={CY0 - 6} x2={tx(temp)} y2={CY1 + 6} strokeWidth="1.5" className="stroke-ink/40 dark:stroke-white/40" />
              {/* Fixed y anchors: the two curves converge at high temperature, so
                  labels pinned to the curve would overlap there. */}
              <text x={CX0 + 4} y={CY0 + 2} fontSize="11" fontWeight="700" className="fill-rose-500 font-display">ceiling (falls with heat)</text>
              <text x={CX0 + 4} y={CY1 - 4} fontSize="11" fontWeight="700" className="fill-emerald-600 font-display dark:fill-emerald-400">yield (peaks in the middle)</text>
            </g>
          )}

          {/* reactor vessel on the right */}
          <g transform={`translate(560 ${setup.curves && showCurves ? 70 : 30})`}>
            <rect x="0" y="0" width="150" height="150" rx="18" className="fill-stone-200/70 stroke-stone-400 dark:fill-white/5 dark:stroke-stone-500" strokeWidth="2" />
            {/* the reacting fluid, warmer = brighter */}
            <rect x="10" y={150 - 20 - conv * 110} width="130" height={20 + conv * 110} rx="10" style={{ fill: glow }} />
            {/* bubbles rise faster when hot */}
            {[30, 65, 100].map((bx, i) => (
              <motion.circle
                key={bx}
                cx={bx + 10}
                r="5"
                fill="rgba(255,255,255,0.5)"
                animate={{ cy: [140, 30] }}
                transition={{ duration: Math.max(0.6, 2.4 - heatFrac * 1.8), repeat: Infinity, delay: i * 0.4, ease: 'easeIn' }}
              />
            ))}
            <text x="75" y="80" textAnchor="middle" fontSize="22" fontWeight="800" className="fill-ink font-display dark:fill-white">
              {Math.round(conv * 100)}%
            </text>
            <text x="75" y="100" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
              converted
            </text>
          </g>

          {/* temperature gauge on the left when no curves */}
          {!(setup.curves && showCurves) && (
            <g transform="translate(90 30)">
              <text x="0" y="0" fontSize="13" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">Reactor temperature</text>
              <rect x="0" y="14" width="380" height="26" rx="13" className="fill-stone-200 dark:bg-white/10 dark:fill-white/10" />
              <rect x="0" y="14" width={heatFrac * 380} height="26" rx="13" className="fill-orange-400" />
              <text x={Math.min(360, heatFrac * 380 + 10)} y="32" fontSize="13" fontWeight="800" className="fill-ink font-display dark:fill-white">{temp}°C</text>
            </g>
          )}
        </svg>
      </div>

      {/* Verdict */}
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
            Set the temperature{setup.fixedTime === null ? ' and the residence time' : ''}, then run the batch.
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-stone-100 p-3 dark:bg-white/5">
          <p className="mb-2 font-display text-sm font-semibold">
            Temperature <span className="font-mono font-bold accent-text">{temp}°C</span>
          </p>
          <div className="flex gap-2">
            <Button variant="soft" onClick={() => change(setTemp, -T_STEP, T_MIN, T_MAX)} disabled={temp <= T_MIN}>− cooler</Button>
            <Button variant="soft" onClick={() => change(setTemp, T_STEP, T_MIN, T_MAX)} disabled={temp >= T_MAX}>hotter +</Button>
          </div>
        </div>
        <div className="rounded-2xl bg-stone-100 p-3 dark:bg-white/5">
          <p className="mb-2 font-display text-sm font-semibold">
            Residence time <span className="font-mono font-bold accent-text">{time} min</span>
          </p>
          <div className="flex gap-2">
            <Button variant="soft" onClick={() => change(setTime, -1, TIME_MIN, TIME_MAX)} disabled={setup.fixedTime !== null || time <= TIME_MIN}>− shorter</Button>
            <Button variant="soft" onClick={() => change(setTime, 1, TIME_MIN, TIME_MAX)} disabled={setup.fixedTime !== null || time >= TIME_MAX}>longer +</Button>
          </div>
          {setup.fixedTime !== null && <p className="mt-1 text-xs text-ink-soft dark:text-stone-400">Fixed at this level.</p>}
        </div>
      </div>

      <div className="mt-3">
        <Meter
          label="Conversion"
          display={`${Math.round(conv * 100)}% of ${Math.round(setup.target * 100)}% needed`}
          fraction={conv / Math.max(0.01, setup.target)}
          markerFraction={1 / Math.max(0.01, 1)}
          barClass={conv >= setup.target ? 'bg-emerald-500' : 'bg-amber-500'}
        />
        {setup.energyBudget !== null && (
          <div className="mt-2">
            <Meter
              label="Fuel"
              display={`${energy} of ${setup.energyBudget}`}
              fraction={energy / setup.energyBudget}
              barClass={overEnergy ? 'bg-rose-500' : 'bg-emerald-500'}
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={runBatch} disabled={won}>
          <FlaskConical className="h-5 w-5" />
          Run the batch
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Flush the reactor">
          <RotateCcw className="h-4 w-4" />
          Flush
        </Button>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard metrics={lv.level.metrics} values={{ yield: Math.round(conv * 100), energy, time }} best={lv.best} scored={won} />
        </div>
      )}

      {won && (
        <LevelComplete
          lv={lv}
          message={
            lv.level.metrics
              ? `${Math.round(conv * 100)}% at ${energy} fuel in ${time} min. Try a leaner recipe.`
              : 'Good chemistry. That batch is on spec.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
