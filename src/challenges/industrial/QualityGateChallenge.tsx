import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import { InsightToggle } from '@/components/level/InsightToggle'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const UNITS = 1000 // batch size the line runs
const INSPECT_PER_UNIT = 1.5 // what it costs to check one unit
const WARRANTY = 60 // what one escaped defect costs once a customer finds it

/** Each station adds value, and each one can spoil a unit. */
const STATIONS = [
  { name: 'Mould', defect: 0.1, value: 8 },
  { name: 'Paint', defect: 0.12, value: 12 },
  { name: 'Electronics', defect: 0.04, value: 40 },
  { name: 'Pack', defect: 0.01, value: 6 },
]

/* ------------------- inspection-desk scene (SVG px) ------------------- */
const SCENE_W = 900
const SCENE_H = 300
const BELT_Y = 205
const ST_W = 150
const ST_H = 80
const ST_Y = 108
const UNIT_START = 12
const SPEED = 165 // px per second, so every unit moves at one belt speed
/** Station i sits here; the desk slot for gate i sits just after it. */
const stationX = (i: number) => 30 + i * 205
const boothX = (i: number) => stationX(i) + ST_W + 26
const CUSTOMER_X = 866

/**
 * A handful of units to watch, mixed to roughly match the station spoil rates
 * (about a quarter go bad). Each one carries the station that ruined it, so
 * what you see on the belt is what the maths above is actually counting.
 */
const SAMPLE: { defectAt: number | null }[] = [
  { defectAt: null },
  { defectAt: 0 },
  { defectAt: null },
  { defectAt: null },
  { defectAt: 1 },
  { defectAt: null },
  { defectAt: null },
  { defectAt: 2 },
  { defectAt: null },
  { defectAt: null },
]

interface LineResult {
  escaped: number
  inspectCost: number
  scrap: number
  waste: number
  total: number
  /** Per station: how many go bad there, and what a scrap costs at that point. */
  perStation: { made: number; scrapped: number; valueAtRisk: number }[]
}

/**
 * Run a batch down the line.
 * A defect made early is cheap to bin and expensive to keep, because every
 * station after it pours more work into a unit that was already ruined.
 */
function runLine(gates: boolean[]): LineResult {
  let good = UNITS
  let bad = 0
  let inspectCost = 0
  let scrap = 0
  let cumulativeValue = 0
  const perStation: LineResult['perStation'] = []

  STATIONS.forEach((station, i) => {
    cumulativeValue += station.value
    const made = good * station.defect
    good -= made
    bad += made

    let scrapped = 0
    if (gates[i]) {
      inspectCost += (good + bad) * INSPECT_PER_UNIT
      scrapped = bad
      scrap += bad * cumulativeValue
      bad = 0
    }
    perStation.push({ made, scrapped, valueAtRisk: cumulativeValue })
  })

  const escaped = bad
  const escapedCost = escaped * WARRANTY
  return {
    escaped,
    inspectCost,
    scrap,
    waste: scrap + escapedCost,
    total: inspectCost + scrap + escapedCost,
    perStation,
  }
}

interface QualitySetup {
  /** Most defects allowed to reach a customer. */
  maxEscaped: number
  /** Money allowed on inspection, or null. */
  inspectBudget: number | null
  /** Cap on inspection plus scrap plus warranty, or null. */
  maxTotal: number | null
  /** Level 4 on: the station readout is available. */
  readout: boolean
  brief: string
}

const LEVELS: ChallengeLevel<QualitySetup>[] = [
  {
    n: 1,
    title: 'Nobody is checking',
    phase: 'play',
    concept: 'An inspection catches defects',
    teach: 'It plays like an inspection-desk game, and the twist is where the desk goes. Right now every faulty unit walks out of the door and a customer finds it. Put an inspection somewhere on the line and watch the escapes fall.',
    setup: { maxEscaped: 60, inspectBudget: null, maxTotal: null, readout: false, brief: 'A toy factory is shipping faulty units and only hearing about it from complaints.' },
  },
  {
    n: 2,
    title: 'Inspectors cost money',
    phase: 'understand',
    concept: 'Checking is not free',
    teach: 'Every gate means somebody checking every unit that reaches it. You cannot afford one after every station, so the ones you keep have to earn their place.',
    setup: { maxEscaped: 60, inspectBudget: 3000, maxTotal: null, readout: false, brief: 'The same line, now with a real quality budget attached to it.' },
  },
  {
    n: 3,
    title: 'Where, not whether',
    phase: 'understand',
    concept: 'Bin it before you build on it',
    teach: 'Checking only at the very end catches everything and still costs more than checking nothing, because you have already fitted 40 of electronics to units you are about to throw away. Catch them before the expensive station, not after it.',
    setup: { maxEscaped: 60, inspectBudget: null, maxTotal: 9000, readout: false, brief: 'Accounts have added up what quality actually costs, and end-of-line checking is losing money.' },
  },
  {
    n: 4,
    title: 'Follow the defects',
    phase: 'analyze',
    concept: 'What a scrap is worth',
    teach: 'Turn on the readout. Each station shows how many units it spoils and how much work is already inside one when it gets there. The same defect gets more expensive the further down the line you find it.',
    setup: { maxEscaped: 60, inspectBudget: null, maxTotal: 9000, readout: true, brief: 'The same line with the defect flow drawn out station by station.' },
  },
  {
    n: 5,
    title: 'Write the quality plan',
    phase: 'optimize',
    concept: 'Escapes, checks, and waste',
    teach: 'Inspect everywhere and you catch everything but pay for it. Inspect nowhere and customers pay instead. Find the plan that keeps all three numbers down at once.',
    setup: { maxEscaped: 60, inspectBudget: null, maxTotal: null, readout: true, brief: 'Sign off the quality plan this line will run to.' },
    metrics: [
      { id: 'escaped', label: 'Reached customers', goal: 'min', target: 40 },
      { id: 'inspect', label: 'Inspection cost', goal: 'min', target: 1600 },
      { id: 'waste', label: 'Wasted work', goal: 'min', target: 6600 },
    ],
  },
]

export function QualityGateChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('quality-gate', LEVELS)
  const setup = lv.level.setup

  // Nothing checked to begin with, so level 1 opens on a line shipping faults.
  const [gates, setGates] = useState<boolean[]>([false, false, false, false])
  const [won, setWon] = useState(false)
  const [showReadout, setShowReadout] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    setGates([false, false, false, false])
    setWon(false)
  }, [lv.level.n])

  const r = runLine(gates)
  const overBudget = setup.inspectBudget !== null && r.inspectCost > setup.inspectBudget
  const overTotal = setup.maxTotal !== null && r.total > setup.maxTotal
  const solved = r.escaped <= setup.maxEscaped && !overBudget && !overTotal

  useEffect(() => {
    if (!solved || won) return
    const timer = setTimeout(() => {
      setWon(true)
      lv.clearLevel(
        lv.level.metrics ? { escaped: r.escaped, inspect: r.inspectCost, waste: r.waste } : undefined,
      )
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, 650)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, won, r.escaped, r.inspectCost, r.waste])

  const reset = () => {
    setGates([false, false, false, false])
    setWon(false)
  }

  const toggle = (i: number) => setGates((g) => g.map((v, j) => (j === i ? !v : v)))
  const onlyEndGate = gates[3] && !gates[0] && !gates[1] && !gates[2]

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.readout ? <InsightToggle label="defect flow" on={showReadout} onChange={setShowReadout} /> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{UNITS} units a shift</Badge>
      </div>

      {/* The line, drawn as an inspection desk you place on a conveyor */}
      <p className="mb-2 text-xs text-ink-soft dark:text-stone-500">
        Click a gap in the line to put an inspection desk there. Faulty units get stamped and
        binned at the first desk they reach; the rest walk out to customers.
      </p>
      <div className="overflow-hidden rounded-2xl bg-stone-100/80 dark:bg-white/5">
        <svg
          viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
          className="w-full"
          role="img"
          aria-label="Production line with inspection desks"
        >
          {/* conveyor */}
          <rect x="10" y={BELT_Y} width={SCENE_W - 20} height="12" rx="6" className="fill-stone-300 dark:fill-white/15" />
          {Array.from({ length: 44 }, (_, i) => (
            <rect key={i} x={18 + i * 20} y={BELT_Y + 3} width="9" height="6" rx="3" className="fill-stone-400/70 dark:fill-white/10" />
          ))}

          {/* stations */}
          {STATIONS.map((s, i) => {
            const st = r.perStation[i]
            const x = stationX(i)
            return (
              <g key={s.name}>
                <rect x={x} y={ST_Y} width={ST_W} height={ST_H} rx="12" className="fill-white dark:fill-white/10" />
                <rect x={x} y={ST_Y} width={ST_W} height="6" rx="3" className="fill-stone-300 dark:fill-white/20" />
                <text x={x + 12} y={ST_Y + 28} fontSize="15" fontWeight="700" className="fill-ink font-display dark:fill-stone-100">
                  {s.name}
                </text>
                <text x={x + 12} y={ST_Y + 48} fontSize="12" className="fill-ink-soft font-display dark:fill-stone-400">
                  adds {s.value} · spoils {(s.defect * 100).toFixed(0)}%
                </text>
                {setup.readout && showReadout && (
                  <>
                    <text x={x + 12} y={ST_Y + 66} fontSize="12" fontWeight="700" className="fill-rose-600 font-display dark:fill-rose-300">
                      {Math.round(st.made)} spoil here
                    </text>
                    <text x={x + ST_W - 12} y={ST_Y + 66} textAnchor="end" fontSize="11" className="fill-ink-soft font-display dark:fill-stone-400">
                      worth {st.valueAtRisk}
                    </text>
                  </>
                )}
                {/* legs down to the belt */}
                <rect x={x + 20} y={ST_Y + ST_H} width="8" height={BELT_Y - ST_Y - ST_H} className="fill-stone-300 dark:fill-white/15" />
                <rect x={x + ST_W - 28} y={ST_Y + ST_H} width="8" height={BELT_Y - ST_Y - ST_H} className="fill-stone-300 dark:fill-white/15" />
              </g>
            )
          })}

          {/* inspection desks: the actual decision */}
          {gates.map((on, i) => {
            const cx = boothX(i)
            const st = r.perStation[i]
            return (
              <g
                key={`booth-${i}`}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                aria-label={`${on ? 'Remove' : 'Add'} an inspection desk after ${STATIONS[i].name}`}
                onClick={() => toggle(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggle(i)
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <rect x={cx - 26} y={ST_Y + 10} width="52" height={BELT_Y - ST_Y + 10} fill="transparent" />
                {on ? (
                  <g>
                    {/* desk, lamp, and the stamp coming down */}
                    <rect x={cx - 22} y={BELT_Y - 46} width="44" height="46" rx="6" style={{ fill: 'var(--accent)' }} opacity="0.9" />
                    <rect x={cx - 26} y={BELT_Y - 52} width="52" height="9" rx="4" style={{ fill: 'var(--accent)' }} />
                    <circle cx={cx} cy={BELT_Y - 74} r="7" className="fill-emerald-400" />
                    <motion.g
                      animate={{ y: [0, 9, 0] }}
                      transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.5, ease: 'easeInOut' }}
                    >
                      <rect x={cx - 11} y={BELT_Y - 40} width="22" height="7" rx="2" className="fill-white/90" />
                      <rect x={cx - 4} y={BELT_Y - 48} width="8" height="9" rx="2" className="fill-white/70" />
                    </motion.g>
                    <text x={cx} y={BELT_Y + 22} textAnchor="middle" fontSize="12" fontWeight="700" className="fill-ink font-display dark:fill-stone-100">
                      DESK
                    </text>
                    {setup.readout && showReadout && (
                      <text x={cx} y={BELT_Y + 38} textAnchor="middle" fontSize="11" fontWeight="700" className="fill-emerald-700 font-display dark:fill-emerald-300">
                        bins {Math.round(st.scrapped)}
                      </text>
                    )}
                  </g>
                ) : (
                  <g>
                    <rect
                      x={cx - 20}
                      y={BELT_Y - 42}
                      width="40"
                      height="42"
                      rx="6"
                      fill="none"
                      strokeWidth="2"
                      strokeDasharray="5 5"
                      className="stroke-stone-400 dark:stroke-white/25"
                    />
                    <path
                      d={`M${cx - 8} ${BELT_Y - 21} h16 M${cx} ${BELT_Y - 29} v16`}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      className="stroke-stone-400 dark:stroke-white/30"
                    />
                    <text x={cx} y={BELT_Y + 22} textAnchor="middle" fontSize="11" className="fill-ink-soft font-display dark:fill-stone-500">
                      add desk
                    </text>
                  </g>
                )}
              </g>
            )
          })}

          {/* the customer door at the end of the line */}
          <g>
            <rect x={CUSTOMER_X - 26} y={BELT_Y - 62} width="52" height="62" rx="8" className="fill-stone-200 dark:fill-white/10" />
            <path d={`M${CUSTOMER_X - 30} ${BELT_Y - 62} L${CUSTOMER_X} ${BELT_Y - 84} L${CUSTOMER_X + 30} ${BELT_Y - 62} Z`} className="fill-stone-300 dark:fill-white/15" />
            <text x={CUSTOMER_X} y={BELT_Y + 22} textAnchor="middle" fontSize="12" fontWeight="700" className="fill-ink font-display dark:fill-stone-100">
              customers
            </text>
            <text
              x={CUSTOMER_X}
              y={BELT_Y + 38}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              className={r.escaped <= setup.maxEscaped ? 'fill-emerald-700 font-display dark:fill-emerald-300' : 'fill-rose-600 font-display dark:fill-rose-300'}
            >
              {Math.round(r.escaped)} faulty
            </text>
          </g>

          {/* units riding the belt, each ending where the maths says it ends */}
          {SAMPLE.map((u, i) => {
            const caughtAt = u.defectAt === null ? -1 : gates.findIndex((on, gi) => on && gi >= u.defectAt!)
            const rejected = caughtAt !== -1
            const endX = rejected ? boothX(caughtAt) : CUSTOMER_X - 34
            const travel = (endX - UNIT_START) / SPEED
            const duration = travel + (rejected ? 0.5 : 0)
            const travelFrac = travel / duration
            const spoilFrac =
              u.defectAt === null
                ? null
                : Math.min(0.97, (stationX(u.defectAt) + ST_W - UNIT_START) / SPEED / duration)
            const timing = {
              duration,
              delay: i * 0.42,
              repeat: Infinity,
              repeatDelay: 0.25,
              ease: 'linear' as const,
            }
            return (
              <motion.g
                key={`unit-${i}`}
                initial={{ x: UNIT_START, y: 0, opacity: 1 }}
                animate={
                  rejected
                    ? { x: [UNIT_START, endX, endX], y: [0, 0, 52], opacity: [1, 1, 0] }
                    : { x: [UNIT_START, endX], y: 0, opacity: 1 }
                }
                transition={rejected ? { ...timing, times: [0, travelFrac, 1] } : timing}
              >
                <rect x="-9" y={BELT_Y - 20} width="18" height="18" rx="4" className="fill-amber-400" />
                {spoilFrac !== null && (
                  <motion.g
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0, 1, 1] }}
                    transition={{ ...timing, times: [0, spoilFrac, Math.min(1, spoilFrac + 0.02), 1] }}
                  >
                    <rect x="-9" y={BELT_Y - 20} width="18" height="18" rx="4" className="fill-rose-500" />
                    <path d={`M-4 ${BELT_Y - 15} l8 8 M4 ${BELT_Y - 15} l-8 8`} strokeWidth="2" strokeLinecap="round" className="stroke-white" />
                  </motion.g>
                )}
              </motion.g>
            )
          })}
        </svg>
      </div>

      {/* Verdict */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        <p
          className={cn(
            'rounded-xl px-4 py-2.5 text-sm font-semibold',
            solved
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
          )}
        >
          {r.escaped > setup.maxEscaped
            ? `${Math.round(r.escaped)} faulty units reached customers. Anything over ${setup.maxEscaped} is too many.`
            : overBudget
              ? `Inspection is costing ${Math.round(r.inspectCost)} and the budget is ${setup.inspectBudget}.`
              : overTotal
                ? onlyEndGate
                  ? `Everything is caught, but quality is costing ${Math.round(r.total)}. You are binning finished units that already have the electronics fitted. Check them earlier.`
                  : `Quality is costing ${Math.round(r.total)} all in, and the target is ${setup.maxTotal}.`
                : `Good plan. ${Math.round(r.escaped)} escapes, ${Math.round(r.total)} total cost of quality.`}
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Meter
          label="Reached customers"
          display={`${Math.round(r.escaped)} units`}
          fraction={Math.min(1, r.escaped / 250)}
          barClass={r.escaped <= setup.maxEscaped ? 'bg-emerald-500' : 'bg-rose-500'}
        />
        <Meter
          label="Inspection"
          display={`${Math.round(r.inspectCost)}`}
          fraction={Math.min(1, r.inspectCost / 6000)}
          barClass="bg-sky-500"
        />
        <Meter
          label="Wasted work"
          display={`${Math.round(r.waste)}`}
          fraction={Math.min(1, r.waste / 18000)}
          barClass="bg-amber-500"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={reset} aria-label="Remove all inspections">
          <RotateCcw className="h-4 w-4" />
          Clear
        </Button>
        <Badge className="ml-auto">Cost of quality {Math.round(r.total)}</Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ escaped: r.escaped, inspect: r.inspectCost, waste: r.waste }}
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
              ? `${Math.round(r.escaped)} escapes for ${Math.round(r.total)}. Try moving a gate.`
              : 'The line is under control.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
