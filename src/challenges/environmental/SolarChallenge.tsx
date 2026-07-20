import { useEffect, useRef, useState } from 'react'
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
/** What the house draws each hour, in kW. Quiet all night, busy at teatime. */
const DEMAND = [
  0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.8, 1.5, 1.2, 0.6, 0.5, 0.5,
  0.5, 0.5, 0.5, 0.5, 0.5, 1.2, 2.0, 2.4, 2.0, 1.4, 0.8, 0.4,
]
const DAILY_DEMAND = DEMAND.reduce((a, b) => a + b, 0)
const PANEL_COST = 900 // per kW
const BATTERY_COST = 400 // per kWh
const TILE_KW = 0.5 // one roof panel
const TILE_COUNT = 16
const MODULE_KWH = 2 // one battery module
const MODULE_COUNT = 12

/** Sunlight through the day: nothing before six, peak at midday. */
const sunAt = (hour: number) =>
  hour >= 6 && hour <= 18 ? Math.max(0, Math.sin((Math.PI * (hour - 6)) / 12)) : 0
const SUN_HOURS = DEMAND.map((_, h) => sunAt(h)).reduce((a, b) => a + b, 0)

interface DayResult {
  generated: number
  unmet: number
  wasted: number
  darkHours: number
  cost: number
  hours: { gen: number; demand: number; soc: number; short: number }[]
}

/**
 * Run two days and report the second, so the battery starts the scored day
 * where it would really sit rather than empty.
 */
function runDay(panelKw: number, batteryKwh: number): DayResult {
  let soc = batteryKwh * 0.5
  let unmet = 0
  let wasted = 0
  let darkHours = 0
  let hours: DayResult['hours'] = []

  for (let day = 0; day < 2; day++) {
    if (day === 1) {
      unmet = 0
      wasted = 0
      darkHours = 0
      hours = []
    }
    for (let h = 0; h < 24; h++) {
      const gen = panelKw * sunAt(h)
      const net = gen - DEMAND[h]
      let short = 0
      if (net >= 0) {
        const stored = Math.min(net, batteryKwh - soc)
        soc += stored
        if (day === 1) wasted += net - stored
      } else {
        const taken = Math.min(-net, soc)
        soc -= taken
        short = -net - taken
        if (day === 1) {
          unmet += short
          if (short > 0.01) darkHours++
        }
      }
      if (day === 1) hours.push({ gen, demand: DEMAND[h], soc, short })
    }
  }

  return {
    generated: panelKw * SUN_HOURS,
    unmet,
    wasted,
    darkHours,
    cost: panelKw * PANEL_COST + batteryKwh * BATTERY_COST,
    hours,
  }
}

interface SolarSetup {
  /** Level 3 on: a battery can be fitted. */
  battery: boolean
  /** Level 1 and 2 only: just match the daily total. */
  matchDailyTotal: boolean
  /** Energy the house may go without over a day, or null. */
  maxUnmet: number | null
  /** Spend limit, or null. */
  budget: number | null
  /** Level 4 on: the day readout is available. */
  chart: boolean
  brief: string
}

const LEVELS: ChallengeLevel<SolarSetup>[] = [
  {
    n: 1,
    title: 'Cover the bill',
    phase: 'play',
    concept: 'Panels make what the sun gives',
    teach: 'A panel only produces while the sun is on it, so its rating is not what it makes in a day. Add enough panels to generate as much energy as this house gets through.',
    setup: { battery: false, matchDailyTotal: true, maxUnmet: null, budget: null, chart: false, brief: 'A family wants to generate as much electricity as they use.' },
  },
  {
    n: 2,
    title: 'What the roof costs',
    phase: 'understand',
    concept: 'Install budget',
    teach: 'Panels are priced per kilowatt installed, and this roof has a quote attached to it. Generate what the house needs without paying for capacity nobody asked for.',
    setup: { battery: false, matchDailyTotal: true, maxUnmet: null, budget: 3000, chart: false, brief: 'Same house, and the installer has come back with a price.' },
  },
  {
    n: 3,
    title: 'The lights still go out',
    phase: 'understand',
    concept: 'Making it is not having it',
    teach: 'Here is the catch. You can generate twice what this house uses and still sit in the dark every evening, because the sun sets exactly when everyone gets home. Energy has to be stored to be there when it is wanted.',
    setup: { battery: true, matchDailyTotal: false, maxUnmet: 1, budget: null, chart: false, brief: 'They generate plenty and the lights keep going off after dinner.' },
  },
  {
    n: 4,
    title: 'Watch the day',
    phase: 'analyze',
    concept: 'Supply against demand',
    teach: 'Turn on the day readout. The curve is what the panels make, the steps are what the house wants, and the band underneath is the battery filling and emptying. The gap between them at six in the evening is the whole problem.',
    setup: { battery: true, matchDailyTotal: false, maxUnmet: 1, budget: null, chart: true, brief: 'The same system, hour by hour across a whole day.' },
  },
  {
    n: 5,
    title: 'Quote the system',
    phase: 'optimize',
    concept: 'Never dark, never wasteful',
    teach: 'Batteries are dearer per unit than panels, but panels without storage spill their surplus into nothing. Find the pairing that keeps the house lit without a roof full of capacity that has nowhere to go.',
    setup: { battery: true, matchDailyTotal: false, maxUnmet: 2, budget: null, chart: true, brief: 'Give the family a system that works and a number they will accept.' },
    metrics: [
      { id: 'unmet', label: 'Energy gone without', goal: 'min', target: 0.5, unit: ' kWh' },
      { id: 'cost', label: 'System cost', goal: 'min', target: 7800 },
      { id: 'waste', label: 'Spilled surplus', goal: 'min', target: 2, unit: ' kWh' },
    ],
  },
]

export function SolarChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('solar', LEVELS)
  const setup = lv.level.setup

  // A single small panel to start, so nothing clears on load.
  const [panelKw, setPanelKw] = useState(1)
  const [batteryKwh, setBatteryKwh] = useState(0)
  const [won, setWon] = useState(false)
  const [showChart, setShowChart] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    setPanelKw(1)
    setBatteryKwh(0)
    setWon(false)
  }, [lv.level.n])

  const battery = setup.battery ? batteryKwh : 0
  const r = runDay(panelKw, battery)

  const overBudget = setup.budget !== null && r.cost > setup.budget
  const madeEnough = r.generated >= DAILY_DEMAND
  const solved = setup.matchDailyTotal
    ? madeEnough && !overBudget
    : r.unmet <= (setup.maxUnmet ?? 0) && !overBudget

  useEffect(() => {
    if (!solved || won) return
    const timer = setTimeout(() => {
      setWon(true)
      lv.clearLevel(lv.level.metrics ? { unmet: r.unmet, cost: r.cost, waste: r.wasted } : undefined)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, 650)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, won, r.unmet, r.cost, r.wasted])

  const reset = () => {
    setPanelKw(1)
    setBatteryKwh(0)
    setWon(false)
  }

  /* Chart */
  const W = 760
  const H = 150
  const X0 = 30
  const maxY = Math.max(2.6, ...r.hours.map((h) => Math.max(h.gen, h.demand)))
  const px = (h: number) => X0 + (h / 23) * W
  const py = (v: number) => H - (v / maxY) * (H - 16)

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.chart ? <InsightToggle label="the day" on={showChart} onChange={setShowChart} /> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
          House uses {DAILY_DEMAND.toFixed(1)} kWh a day
        </Badge>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-stone-100/80 p-4 dark:bg-white/5">
        <svg viewBox={`0 0 800 ${H + 34}`} className="w-full" role="img" aria-label="Solar generation against household demand">
          {/* demand steps */}
          <polyline
            points={r.hours.map((h, i) => `${px(i)},${py(h.demand)}`).join(' ')}
            fill="none"
            strokeWidth="2.5"
            className="stroke-ink-soft dark:stroke-stone-400"
          />
          {/* battery charge behind everything */}
          {setup.chart && showChart && battery > 0 && (
            <polygon
              points={`${X0},${H} ` + r.hours.map((h, i) => `${px(i)},${py((h.soc / battery) * maxY * 0.5)}`).join(' ') + ` ${px(23)},${H}`}
              className="fill-emerald-400/25"
            />
          )}
          {/* generation curve */}
          <polygon
            points={`${X0},${H} ` + r.hours.map((h, i) => `${px(i)},${py(h.gen)}`).join(' ') + ` ${px(23)},${H}`}
            className="fill-amber-400/40"
          />
          <polyline
            points={r.hours.map((h, i) => `${px(i)},${py(h.gen)}`).join(' ')}
            fill="none"
            strokeWidth="2.5"
            className="stroke-amber-500"
          />
          {/* hours where the house went without */}
          {r.hours.map((h, i) =>
            h.short > 0.01 ? (
              <rect key={i} x={px(i) - 5} y={H - 8} width="10" height="8" rx="2" className="fill-rose-500" />
            ) : null,
          )}
          <line x1={X0} y1={H} x2={px(23)} y2={H} strokeWidth="1.5" className="stroke-stone-400 dark:stroke-stone-600" />
          {[0, 6, 12, 18, 23].map((h) => (
            <text key={h} x={px(h)} y={H + 20} textAnchor="middle" fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
              {h}:00
            </text>
          ))}
          <text x={X0} y={14} fontSize="12" fontWeight="700" className="fill-amber-600 font-display dark:fill-amber-300">
            panels
          </text>
          <text x={X0 + 60} y={14} fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
            house
          </text>
          {r.darkHours > 0 && (
            <text x={px(23)} y={14} textAnchor="end" fontSize="12" fontWeight="700" className="fill-rose-600 font-display dark:fill-rose-300">
              {r.darkHours} hours short
            </text>
          )}
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
          {overBudget
            ? `That system costs ${Math.round(r.cost).toLocaleString()} and the budget is ${setup.budget?.toLocaleString()}.`
            : setup.matchDailyTotal
              ? madeEnough
                ? `Generating ${r.generated.toFixed(1)} kWh a day against ${DAILY_DEMAND.toFixed(1)} used.`
                : `Only ${r.generated.toFixed(1)} kWh a day, and the house gets through ${DAILY_DEMAND.toFixed(1)}.`
              : solved
                ? `Lit all day. ${r.generated.toFixed(1)} kWh generated, ${r.unmet.toFixed(1)} kWh gone without.`
                : r.generated > DAILY_DEMAND && battery < 4
                  ? `The panels make ${r.generated.toFixed(1)} kWh, comfortably more than the ${DAILY_DEMAND.toFixed(1)} the house uses, and it is still dark for ${r.darkHours} hours. All that surplus is arriving at noon and there is nowhere to keep it.`
                  : `${r.unmet.toFixed(1)} kWh gone without across ${r.darkHours} hours.`}
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Meter
          label={setup.matchDailyTotal ? 'Generated per day' : 'Energy gone without'}
          display={
            setup.matchDailyTotal
              ? `${r.generated.toFixed(1)} of ${DAILY_DEMAND.toFixed(1)} kWh`
              : `${r.unmet.toFixed(1)} kWh over ${r.darkHours} hours`
          }
          fraction={setup.matchDailyTotal ? r.generated / (DAILY_DEMAND * 1.6) : Math.min(1, r.unmet / 8)}
          markerFraction={setup.matchDailyTotal ? 1 / 1.6 : undefined}
          barClass={solved ? 'bg-emerald-500' : 'bg-amber-500'}
        />
        <Meter
          label="System cost"
          display={setup.budget ? `${Math.round(r.cost).toLocaleString()} of ${setup.budget.toLocaleString()}` : `${Math.round(r.cost).toLocaleString()}`}
          fraction={setup.budget ? r.cost / setup.budget : Math.min(1, r.cost / 12000)}
          barClass={overBudget ? 'bg-rose-500' : 'bg-sky-500'}
        />
      </div>

      {/* Fit the actual hardware: panels onto the roof, modules into the cupboard. */}
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="mb-2 font-display text-sm font-semibold">
            Roof panels <span className="font-normal text-ink-soft dark:text-stone-400">· {panelKw.toFixed(1)} kW</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: TILE_COUNT }, (_, i) => {
              const fitted = i < Math.round(panelKw / TILE_KW)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPanelKw(fitted ? i * TILE_KW : (i + 1) * TILE_KW)}
                  aria-pressed={fitted}
                  aria-label={fitted ? `Remove panel ${i + 1}` : `Fit panel ${i + 1}`}
                  className={cn(
                    'h-9 w-9 rounded-md border-2 transition-colors duration-150',
                    fitted
                      ? 'border-sky-700 bg-sky-500 shadow-clay'
                      : 'border-dashed border-stone-300 hover:border-stone-400 dark:border-white/15',
                  )}
                >
                  {fitted && (
                    <svg viewBox="0 0 20 20" className="h-full w-full opacity-50" aria-hidden>
                      <line x1="0" y1="7" x2="20" y2="7" stroke="white" strokeWidth="1.5" />
                      <line x1="0" y1="13" x2="20" y2="13" stroke="white" strokeWidth="1.5" />
                      <line x1="10" y1="0" x2="10" y2="20" stroke="white" strokeWidth="1.5" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {setup.battery && (
          <div>
            <p className="mb-2 font-display text-sm font-semibold">
              Battery modules{' '}
              <span className="font-normal text-ink-soft dark:text-stone-400">· {batteryKwh} kWh</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: MODULE_COUNT }, (_, i) => {
                const fitted = i < batteryKwh / MODULE_KWH
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setBatteryKwh(fitted ? i * MODULE_KWH : (i + 1) * MODULE_KWH)}
                    aria-pressed={fitted}
                    aria-label={fitted ? `Remove battery module ${i + 1}` : `Fit battery module ${i + 1}`}
                    className={cn(
                      'h-9 w-12 rounded-md border-2 font-display text-[10px] font-bold transition-colors duration-150',
                      fitted
                        ? 'border-emerald-700 bg-emerald-500 text-white shadow-clay'
                        : 'border-dashed border-stone-300 text-transparent hover:border-stone-400 dark:border-white/15',
                    )}
                  >
                    {MODULE_KWH}kWh
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={reset} aria-label="Reset the system">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Spilled {r.wasted.toFixed(1)} kWh</Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ unmet: r.unmet, cost: r.cost, waste: r.wasted }}
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
              ? `${Math.round(r.cost).toLocaleString()} for a house that stays lit. Try trimming the panels.`
              : 'That will keep the lights on.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
