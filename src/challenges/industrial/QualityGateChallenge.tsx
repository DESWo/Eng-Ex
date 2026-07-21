import { useEffect, useRef, useState } from 'react'
import { RotateCcw, Search } from 'lucide-react'
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

      {/* The line */}
      <div className="rounded-2xl bg-stone-100/80 p-4 dark:bg-white/5">
        <div className="flex flex-wrap items-stretch gap-2">
          {STATIONS.map((s, i) => {
            const st = r.perStation[i]
            return (
              <div key={s.name} className="flex flex-1 items-stretch gap-2" style={{ minWidth: 150 }}>
                <div className="flex-1 rounded-2xl bg-white p-3 dark:bg-white/5">
                  <p className="font-display text-sm font-bold">{s.name}</p>
                  <p className="text-xs text-ink-soft dark:text-stone-400">
                    adds {s.value} · spoils {(s.defect * 100).toFixed(0)}%
                  </p>
                  {setup.readout && showReadout && (
                    <p className="mt-1.5 text-xs font-semibold text-rose-600 dark:text-rose-300">
                      {Math.round(st.made)} go bad here
                      <span className="block text-ink-soft dark:text-stone-400">
                        worth {st.valueAtRisk} each by now
                      </span>
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    aria-pressed={gates[i]}
                    className={cn(
                      'mt-2 flex w-full items-center justify-center gap-1.5 rounded-full px-2 py-1.5 font-display text-xs font-bold transition-colors duration-200',
                      gates[i]
                        ? 'accent-bg text-white shadow-clay'
                        : 'bg-stone-100 text-ink-soft hover:bg-stone-200 dark:bg-white/10 dark:text-stone-400',
                    )}
                  >
                    <Search className="h-3.5 w-3.5" />
                    {gates[i] ? 'Inspecting' : 'Inspect here'}
                  </button>
                  {gates[i] && setup.readout && showReadout && (
                    <p className="mt-1 text-center text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      bins {Math.round(st.scrapped)} units
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
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
