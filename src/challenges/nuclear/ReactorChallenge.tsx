import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { InsightToggle } from '@/components/level/InsightToggle'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import { useSvgDrag } from '@/hooks/useSvgDrag'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const MAX_POWER = 1100 // MW at fully withdrawn rods
const SAFE_TEMP = 600 // °C: stay under this
const MELTDOWN_TEMP = 900 // °C: cross this and the core melts
const BASE_TEMP = 250 // °C: idle coolant temperature
const HEAT_FACTOR = 0.6 // how fast leftover heat raises temperature
const COOLANT_PULL = 11 // heat each coolant point removes
const PUMP_DRAW = 40 // MW each pump takes off the grid output
const TICK_MS = 300
const POWER_LAG = 0.12 // how much of the gap the core closes per tick
const TEMP_LAG = 0.1
const HOLD_TICKS = 16 // about five seconds steady to bank a win

interface ReactorSetup {
  label: string
  /** MW band to hold. For level 5 this is the first phase of the day. */
  band: [number, number]
  /** Later phases of the demand day, or null for a single fixed band. */
  phases: [number, number][] | null
  /** Ticks each phase lasts in the demand day. */
  phaseTicks: number
  /** Level 2 on: pumps draw power off the grid output. */
  pumpsDraw: boolean
  /** Level 3 on: the core responds slowly, so overcorrecting oscillates. */
  lag: boolean
  /** Level 4 on: the strip chart is available. */
  chart: boolean
  brief: string
}

const LEVELS: ChallengeLevel<ReactorSetup>[] = [
  {
    n: 1,
    title: 'Rods out, power up',
    phase: 'play',
    concept: 'Rods are the throttle',
    teach: 'Control rods soak up the reaction. Haul the bank out and power climbs, push it in and power dies. Meet the demand band and keep the core out of the red.',
    setup: { label: 'Quiet night shift', band: [480, 580], phases: null, phaseTicks: 0, pumpsDraw: false, lag: false, chart: false, brief: 'The night city needs a steady trickle. Bring the reactor up to meet it.' },
  },
  {
    n: 2,
    title: 'The pumps bill the grid',
    phase: 'understand',
    concept: 'Cooling is not free',
    teach: 'Every coolant pump is driven off your own output, forty megawatts each. The band now measures what actually leaves the plant, so drowning the core in coolant means pulling the rods further than you would think.',
    setup: { label: 'Morning ramp', band: [760, 860], phases: null, phaseTicks: 0, pumpsDraw: true, lag: false, chart: false, brief: 'The city wakes up, and from now on the pumps run off your own electricity.' },
  },
  {
    n: 3,
    title: 'The core takes its time',
    phase: 'understand',
    concept: 'Thermal lag',
    teach: 'A real core does not jump to your setting, it drifts there over many seconds. Chase the needle and you will overshoot, correct, and overshoot again. Make a small move, then wait and watch.',
    setup: { label: 'Morning ramp', band: [760, 860], phases: null, phaseTicks: 0, pumpsDraw: true, lag: true, chart: false, brief: 'Same job, but now the core responds like the thousand-tonne machine it is.' },
  },
  {
    n: 4,
    title: 'Read the traces',
    phase: 'analyze',
    concept: 'The strip chart',
    teach: 'Turn on the chart. Power and temperature scroll past like a hospital monitor, and your own overcorrections show up as waves. A good operator leaves a flat line behind them.',
    setup: { label: 'High summer load', band: [900, 1000], phases: null, phaseTicks: 0, pumpsDraw: true, lag: true, chart: true, brief: 'A heavy, steady load with the control-room instruments switched on.' },
  },
  {
    n: 5,
    title: 'Follow the day',
    phase: 'optimize',
    concept: 'Demand never sits still',
    teach: 'A whole day compressed: quiet night, morning ramp, evening peak. Track the moving band with the least coolant you can and without cooking the core. Smooth beats fast.',
    setup: { label: 'A day on the grid', band: [480, 580], phases: [[480, 580], [760, 860], [960, 1050]], phaseTicks: 34, pumpsDraw: true, lag: true, chart: true, brief: 'Run the plant through a full day. The band moves whether you are ready or not.' },
    metrics: [
      { id: 'inband', label: 'Time on target', goal: 'max', target: 75, unit: '%' },
      { id: 'peak', label: 'Peak core temp', goal: 'min', target: 560, unit: '°C' },
      { id: 'pumps', label: 'Pump usage', goal: 'min', target: 260 },
    ],
  },
]

export function ReactorChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('reactor', LEVELS)
  const round = lv.level.setup

  const [rods, setRods] = useState(100) // 100 = fully inserted = shut down
  const [coolant, setCoolant] = useState(50)
  const [wonRound, setWonRound] = useState(false)
  const [meltdown, setMeltdown] = useState(false)
  const [showChart, setShowChart] = useState(true)
  // The live plant state, which lags the controls when the level says so.
  const [effPower, setEffPower] = useState(0)
  const [temp, setTemp] = useState(BASE_TEMP)
  const [heldTicks, setHeldTicks] = useState(0)
  const [dayTick, setDayTick] = useState(0)
  const [dayDone, setDayDone] = useState(false)
  const statsRef = useRef({ inBand: 0, total: 0, peak: BASE_TEMP, pumps: 0 })
  const traceRef = useRef<{ p: number; t: number }[]>([])
  const completedRef = useRef(false)

  useEffect(() => {
    setRods(100)
    setCoolant(50)
    setWonRound(false)
    setMeltdown(false)
    setEffPower(0)
    setTemp(BASE_TEMP)
    setHeldTicks(0)
    setDayTick(0)
    setDayDone(false)
    statsRef.current = { inBand: 0, total: 0, peak: BASE_TEMP, pumps: 0 }
    traceRef.current = []
  }, [lv.level.n])

  /** Haul the whole rod bank in or out of the core. */
  const { bind: rodBind } = useSvgDrag((_x, y) => {
    setRods(Math.max(0, Math.min(100, Math.round(((y - 30) / 74) * 100))))
  })
  const nudgeRods = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2
    if (e.key === 'ArrowDown') setRods((r) => Math.min(100, r + step))
    else if (e.key === 'ArrowUp') setRods((r) => Math.max(0, r - step))
    else return
    e.preventDefault()
  }

  // Which band applies right now (the day moves it on level 5).
  const phaseIndex = round.phases ? Math.min(round.phases.length - 1, Math.floor(dayTick / round.phaseTicks)) : 0
  const [bandLow, bandHigh] = round.phases ? round.phases[phaseIndex] : round.band

  const setPower = ((100 - rods) / 100) * MAX_POWER
  const pumpCount = coolant / 25
  const netPower = Math.round(effPower - (round.pumpsDraw ? pumpCount * PUMP_DRAW : 0))
  const inBand = netPower >= bandLow && netPower <= bandHigh
  const safe = temp < SAFE_TEMP
  const dayFinished = round.phases !== null && dayDone

  /* ---------- the plant, ticking ---------- */
  useEffect(() => {
    if (wonRound || meltdown) return
    const id = setInterval(() => {
      setEffPower((p) => (round.lag ? p + (setPower - p) * POWER_LAG : setPower))
      setTemp((t) => {
        const gross = round.lag ? effPower : setPower
        const eq = BASE_TEMP + Math.max(0, gross - coolant * COOLANT_PULL) * HEAT_FACTOR
        const next = round.lag ? t + (eq - t) * TEMP_LAG : eq
        if (next >= MELTDOWN_TEMP) setMeltdown(true)
        statsRef.current.peak = Math.max(statsRef.current.peak, next)
        return next
      })
      if (round.chart) {
        traceRef.current = [...traceRef.current.slice(-79), { p: netPower, t: temp }]
      }
      if (round.phases) {
        statsRef.current.total += 1
        if (inBand && safe) statsRef.current.inBand += 1
        statsRef.current.pumps += pumpCount
        setDayTick((d) => {
          const next = d + 1
          if (next >= round.phases!.length * round.phaseTicks) setDayDone(true)
          return next
        })
      } else {
        setHeldTicks((h) => (inBand && safe ? h + 1 : 0))
      }
    }, TICK_MS)
    return () => clearInterval(id)
  }, [round, setPower, coolant, effPower, temp, netPower, inBand, safe, wonRound, meltdown, pumpCount])

  /* ---------- winning ---------- */
  const holdNeeded = round.lag ? HOLD_TICKS : 3
  useEffect(() => {
    if (wonRound || meltdown) return
    if (round.phases) {
      if (!dayFinished) return
      const s = statsRef.current
      const pct = Math.round((s.inBand / Math.max(1, s.total)) * 100)
      if (pct < 65) return
      setWonRound(true)
      lv.clearLevel({ inband: pct, peak: Math.round(s.peak), pumps: Math.round(s.pumps) })
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    } else if (heldTicks >= holdNeeded) {
      setWonRound(true)
      lv.clearLevel()
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldTicks, dayFinished, wonRound, meltdown])

  const reset = () => {
    setRods(100)
    setCoolant(50)
    setWonRound(false)
    setMeltdown(false)
    setEffPower(0)
    setTemp(BASE_TEMP)
    setHeldTicks(0)
    setDayTick(0)
    setDayDone(false)
    statsRef.current = { inBand: 0, total: 0, peak: BASE_TEMP, pumps: 0 }
    traceRef.current = []
  }

  const power = Math.round(effPower)
  const shownTemp = Math.round(temp)
  const tempZone = meltdown ? 'meltdown' : shownTemp >= SAFE_TEMP ? 'warning' : 'safe'
  const glow = Math.min(1, power / MAX_POWER)
  const powerPos = (mw: number) => Math.min(1, Math.max(0, mw / MAX_POWER))
  const tempPos = (t: number) => Math.min(1, (t - BASE_TEMP) / (MELTDOWN_TEMP + 60 - BASE_TEMP))
  const dayPct = round.phases ? Math.round((statsRef.current.inBand / Math.max(1, statsRef.current.total)) * 100) : 0
  const failedDay = dayFinished && !wonRound && dayPct < 65

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.chart ? <InsightToggle label="strip chart" on={showChart} onChange={setShowChart} /> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
        <div className="flex flex-col items-end gap-1.5">
          <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
            {round.label} · hold {bandLow}-{bandHigh} MW
          </Badge>
          {round.phases && !dayFinished && (
            <Badge className="bg-stone-100 text-ink-soft dark:bg-white/10 dark:text-stone-300">
              Phase {phaseIndex + 1} of {round.phases.length} · on target {dayPct}%
            </Badge>
          )}
        </div>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-slate-100/80 dark:bg-slate-950/50">
        <svg viewBox={`0 0 800 ${round.chart && showChart ? 390 : 300}`} className="w-full" role="img" aria-label="Nuclear reactor scene">
          <path d="M250 250 V150 A150 100 0 0 1 550 150 V250 Z" className="fill-slate-200 dark:fill-slate-800" />
          <path d="M250 250 V150 A150 100 0 0 1 550 150 V250 Z" fill="none" className="stroke-slate-300 dark:stroke-slate-700" strokeWidth="3" />
          <rect x="330" y="120" width="140" height="130" rx="16" className="fill-slate-300 dark:fill-slate-700" />
          <motion.rect
            x="352" y="150" width="96" height="94" rx="8"
            animate={{ opacity: 0.25 + glow * 0.75 }}
            transition={{ duration: 0.3 }}
            style={{ fill: meltdown ? '#ef4444' : 'var(--accent)' }}
          />
          {meltdown && (
            <motion.rect x="352" y="150" width="96" height="94" rx="8" fill="#ef4444" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.5, repeat: Infinity }} />
          )}
          {[368, 392, 416, 440].map((x) => (
            <g key={x}>
              <rect x={x - 4} y="70" width="8" height="40" rx="3" className="fill-slate-500 dark:fill-slate-400" />
              <motion.rect
                x={x - 4} width="8" height="96" rx="3"
                className="fill-slate-600 dark:fill-slate-300"
                animate={{ y: 150 - (100 - rods) * 0.9 }}
                transition={{ type: 'spring', stiffness: 220, damping: 26 }}
              />
            </g>
          ))}
          <rect x="470" y="200" width="90" height="14" rx="7" className="fill-sky-300 dark:fill-sky-700" />
          <rect x="240" y="200" width="90" height="14" rx="7" className="fill-sky-300 dark:fill-sky-700" />
          {coolant > 20 &&
            [520, 545, 570].map((x, i) => (
              <motion.circle
                key={x} cx={x} r={4 + coolant / 22}
                className="fill-sky-200/80 dark:fill-sky-400/40"
                animate={{ cy: [200, 150], opacity: [0.7, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.35 }}
              />
            ))}
          <text x="400" y="285" textAnchor="middle" fontSize="14" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
            {meltdown ? 'CORE MELTDOWN' : `${netPower} MW to the grid · ${shownTemp}°C`}
          </text>

          {/* level 4 overlay: the strip chart */}
          {round.chart && showChart && (
            <g>
              <rect x="60" y="308" width="680" height="70" rx="8" className="fill-white/60 dark:fill-white/5" />
              {/* demand band */}
              <rect
                x="60"
                y={308 + 70 - (bandHigh / MAX_POWER) * 66}
                width="680"
                height={((bandHigh - bandLow) / MAX_POWER) * 66}
                className="fill-emerald-400/25"
              />
              <polyline
                points={traceRef.current.map((s, i) => `${60 + (i / 79) * 680},${308 + 70 - powerPos(s.p) * 66}`).join(' ')}
                fill="none" strokeWidth="2" style={{ stroke: 'var(--accent)' }}
              />
              <polyline
                points={traceRef.current.map((s, i) => `${60 + (i / 79) * 680},${308 + 70 - tempPos(s.t) * 66}`).join(' ')}
                fill="none" strokeWidth="2" className="stroke-rose-400"
              />
              <text x="66" y="322" fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                power (accent) · temperature (red) · green band = demand
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Gauges */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-display font-semibold">Power to the grid</span>
            <span className="tabular-nums text-ink-soft dark:text-stone-400">{netPower} MW</span>
          </div>
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
            <div
              className="absolute inset-y-0 bg-emerald-400/80"
              style={{ left: `${powerPos(bandLow) * 100}%`, width: `${(powerPos(bandHigh) - powerPos(bandLow)) * 100}%` }}
            />
            <motion.span
              className="absolute inset-y-0 w-1.5 rounded-full bg-ink dark:bg-white"
              animate={{ left: `${powerPos(netPower) * 100}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            />
          </div>
          <p className="mt-1 text-xs text-ink-soft dark:text-stone-400">
            {round.pumpsDraw ? `Each pump takes ${PUMP_DRAW} MW off this number.` : "Green = the city's demand."}
          </p>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-display font-semibold">Core temperature</span>
            <span
              className={cn(
                'tabular-nums font-semibold',
                tempZone === 'safe' ? 'text-emerald-600 dark:text-emerald-400' : tempZone === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400',
              )}
            >
              {shownTemp}°C
            </span>
          </div>
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-emerald-300/70 dark:bg-emerald-500/25">
            <div className="absolute inset-y-0 bg-amber-300/80 dark:bg-amber-500/30" style={{ left: `${tempPos(SAFE_TEMP) * 100}%`, right: 0 }} />
            <div className="absolute inset-y-0 bg-rose-400/80 dark:bg-rose-500/40" style={{ left: `${tempPos(MELTDOWN_TEMP) * 100}%`, right: 0 }} />
            <motion.span
              className="absolute inset-y-0 w-1.5 rounded-full bg-ink dark:bg-white"
              animate={{ left: `${tempPos(shownTemp) * 100}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            />
          </div>
          <p className="mt-1 text-xs text-ink-soft dark:text-stone-400">Keep the needle out of the red.</p>
        </div>
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-3 min-h-[2.5rem]">
        {wonRound ? (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            {round.phases ? `Day complete: on target ${dayPct}% of the time.` : 'Steady and cool! The grid is happy and the core is safe.'}
          </motion.p>
        ) : meltdown ? (
          <p className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Meltdown! The core ran away and overheated. Hit reset to bring it back online.
          </p>
        ) : failedDay ? (
          <p className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Day over: only on target {dayPct}% of the time, and the grid wants 65%. Reset and ride the band more closely.
          </p>
        ) : (
          <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-300">
            {!inBand
              ? netPower < bandLow
                ? 'The grid needs more than it is getting.'
                : 'The plant is sending more than the grid wants.'
              : shownTemp >= SAFE_TEMP
                ? 'Power is on target, but the core is running hot.'
                : round.lag
                  ? `Holding... ${Math.max(0, holdNeeded - heldTicks)} to go. The core drifts, so resist the urge to chase it.`
                  : 'Looking good... hold it steady!'}
          </p>
        )}
      </div>

      {/* Rods get hauled by hand; coolant runs on a whole number of pumps. */}
      <div className="mt-3 grid items-start gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 font-display text-sm font-semibold">
            Control rods <span className="font-normal text-ink-soft dark:text-stone-400">· {rods}% in</span>
          </p>
          <svg viewBox="0 0 260 120" className="w-full max-w-[260px]" role="img" aria-label="Control rod bank" {...rodBind}>
            <rect x="10" y="30" width="240" height="82" rx="6" className="fill-stone-200 dark:fill-white/10" />
            {[0, 1, 2, 3, 4].map((i) => {
              const x = 32 + i * 46
              const depth = Math.max(2, (rods / 100) * 74)
              return (
                <g key={i}>
                  <rect x={x} y="34" width="14" height="74" rx="3" className="fill-stone-300 dark:fill-white/10" />
                  <rect x={x} y="34" width="14" height={depth} rx="3" className="fill-slate-600 dark:fill-slate-300" />
                </g>
              )
            })}
            <rect
              x="10"
              y={26 + (rods / 100) * 74}
              width="240"
              height="14"
              rx="7"
              tabIndex={0}
              onKeyDown={nudgeRods}
              role="slider"
              aria-label="Control rod insertion"
              aria-valuenow={rods}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={`${rods} percent inserted`}
              className="cursor-ns-resize fill-ink/25 outline-none dark:fill-white/35"
            />
            <text x="130" y="20" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
              drag the rod bank
            </text>
          </svg>
        </div>

        <div>
          <p className="mb-2 font-display text-sm font-semibold">
            Coolant pumps <span className="font-normal text-ink-soft dark:text-stone-400">· {coolant}% flow</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {[0, 25, 50, 75, 100].map((v, i) => (
              <button
                key={v}
                type="button"
                onClick={() => setCoolant(v)}
                aria-pressed={coolant === v}
                className={cn(
                  'rounded-2xl px-3.5 py-2.5 font-display text-sm font-semibold transition-colors duration-200',
                  coolant === v
                    ? 'accent-bg text-white shadow-clay'
                    : 'bg-stone-100 text-ink-soft hover:bg-stone-200 dark:bg-white/5 dark:text-stone-400 dark:hover:bg-white/10',
                )}
              >
                {i === 0 ? 'Off' : `${i} pump${i > 1 ? 's' : ''}`}
              </button>
            ))}
          </div>
          {round.pumpsDraw && (
            <p className="mt-2 text-xs text-ink-soft dark:text-stone-400">
              Running {pumpCount} pump{pumpCount === 1 ? '' : 's'} costs {Math.round(pumpCount * PUMP_DRAW)} MW of output.
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={reset} aria-label="Scram the reactor">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{
              inband: dayPct,
              peak: Math.round(statsRef.current.peak),
              pumps: Math.round(statsRef.current.pumps),
            }}
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
              ? `On target ${dayPct}% with a ${Math.round(statsRef.current.peak)}°C peak. Try a calmer day.`
              : 'Steady state held. Well run.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
