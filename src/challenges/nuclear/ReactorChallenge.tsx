import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { InsightToggle } from '@/components/level/InsightToggle'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import {
  AnnunciatorPanel,
  BankLever,
  ChartRecorder,
  DigitalWindow,
  Engraved,
  Gauge,
  GuardedControl,
  IlluminatedButton,
  INK,
  MimicBoard,
  MimicLamp,
  Note,
  PanelBay,
  PanelSurface,
  Plate,
  useAnnunciators,
} from '@/components/instruments/panel'
import type { AnnunciatorDef } from '@/components/instruments/panel'
import { useLevels } from '@/hooks/useLevels'
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

/* --------------- board only, never read by the sim --------------- */
/** Annunciator threshold for "you are getting close to the limit". */
const ALARM_TEMP = 750
/** Deviation alarms stay dark until the plant is actually online. */
const ONLINE_MW = 50
/** Full scale on the two board meters. Display range, not a plant limit. */
const TEMP_SCALE_MIN = 200
const TEMP_SCALE_MAX = 1000

const ALARMS: AnnunciatorDef[] = [
  { id: 'temp-high', legend: 'Core temp high', tone: 'amber' },
  { id: 'temp-limit', legend: 'Temp near limit', tone: 'amber' },
  { id: 'trip', legend: 'Reactor trip', tone: 'red' },
  { id: 'out-low', legend: 'Output below band', tone: 'white' },
  { id: 'out-high', legend: 'Output above band', tone: 'white' },
  { id: 'pumps-off', legend: 'Coolant pumps off', tone: 'red' },
]

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
  /** Level 4 on: the chart recorder is available. */
  chart: boolean
  brief: string
}

const LEVELS: ChallengeLevel<ReactorSetup>[] = [
  {
    n: 1,
    title: 'Rods out, power up',
    phase: 'play',
    concept: 'Rods are the throttle',
    teach: 'Play it like a virtual pet that can melt. Control rods soak up the reaction. Haul the bank out and power climbs, push it in and power dies. Meet the demand band and keep the core out of the red.',
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
    concept: 'The chart recorder',
    teach: 'Turn on the recorder. Power and temperature scroll past like a hospital monitor, and your own overcorrections show up as waves. A good operator leaves a flat line behind them.',
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
  /**
   * The loop reads the controls through refs and keeps the plant in one, so the
   * interval can stay mounted. Rebuilding it on every render restarted the
   * 300 ms timer, and a continuous drag on the rod bank stalled sim time.
   */
  const plantRef = useRef({ power: 0, temp: BASE_TEMP, day: 0 })
  const rodsRef = useRef(100)
  const coolantRef = useRef(50)
  /** Latched the instant the run ends, so no tick lands after the verdict. */
  const overRef = useRef(false)
  const reduced = useReducedMotion()

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
    plantRef.current = { power: 0, temp: BASE_TEMP, day: 0 }
    overRef.current = false
    statsRef.current = { inBand: 0, total: 0, peak: BASE_TEMP, pumps: 0 }
    traceRef.current = []
  }, [lv.level.n])

  // The controls are React state for the scene and refs for the loop.
  useEffect(() => {
    rodsRef.current = rods
    coolantRef.current = coolant
  }, [rods, coolant])

  // Which band applies right now (the day moves it on level 5).
  const phaseIndex = round.phases ? Math.min(round.phases.length - 1, Math.floor(dayTick / round.phaseTicks)) : 0
  const [bandLow, bandHigh] = round.phases ? round.phases[phaseIndex] : round.band

  const pumpCount = coolant / 25
  const netPower = Math.round(effPower - (round.pumpsDraw ? pumpCount * PUMP_DRAW : 0))
  const inBand = netPower >= bandLow && netPower <= bandHigh
  const dayFinished = round.phases !== null && dayDone

  /* ---------- the plant, ticking ---------- */
  // A won, melted or finished run is over: the loop stops, which freezes the
  // stats, the trace and the verdict. Reset is the only way back to a live core.
  const running = !wonRound && !meltdown && !dayFinished
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      if (overRef.current) return
      const plant = plantRef.current
      const coolantNow = coolantRef.current
      const demand = ((100 - rodsRef.current) / 100) * MAX_POWER
      const power = round.lag ? plant.power + (demand - plant.power) * POWER_LAG : demand
      // Heat follows the power the core was already making, so under lag the
      // temperature trails the rods rather than tracking them.
      const gross = round.lag ? plant.power : demand
      const eq = BASE_TEMP + Math.max(0, gross - coolantNow * COOLANT_PULL) * HEAT_FACTOR
      const nextTemp = round.lag ? plant.temp + (eq - plant.temp) * TEMP_LAG : eq
      const pumps = coolantNow / 25
      const net = Math.round(power - (round.pumpsDraw ? pumps * PUMP_DRAW : 0))
      const [low, high] = round.phases
        ? round.phases[Math.min(round.phases.length - 1, Math.floor(plant.day / round.phaseTicks))]
        : round.band
      const onTarget = net >= low && net <= high && nextTemp < SAFE_TEMP

      plantRef.current = { power, temp: nextTemp, day: plant.day + 1 }
      statsRef.current.peak = Math.max(statsRef.current.peak, nextTemp)
      if (round.chart) traceRef.current = [...traceRef.current.slice(-79), { p: net, t: nextTemp }]
      setEffPower(power)
      setTemp(nextTemp)

      if (nextTemp >= MELTDOWN_TEMP) {
        overRef.current = true
        setMeltdown(true)
        return
      }
      if (round.phases) {
        statsRef.current.total += 1
        if (onTarget) statsRef.current.inBand += 1
        statsRef.current.pumps += pumps
        setDayTick(plantRef.current.day)
        if (plantRef.current.day >= round.phases.length * round.phaseTicks) {
          overRef.current = true
          setDayDone(true)
        }
      } else {
        setHeldTicks((h) => (onTarget ? h + 1 : 0))
      }
    }, TICK_MS)
    return () => clearInterval(id)
  }, [round, running])

  /* ---------- winning ---------- */
  const holdNeeded = round.lag ? HOLD_TICKS : 3
  useEffect(() => {
    if (wonRound || meltdown) return
    if (round.phases) {
      if (!dayFinished) return
      const s = statsRef.current
      const pct = Math.round((s.inBand / Math.max(1, s.total)) * 100)
      if (pct < 65) return
      overRef.current = true
      setWonRound(true)
      lv.clearLevel({ inband: pct, peak: Math.round(s.peak), pumps: Math.round(s.pumps) })
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    } else if (heldTicks >= holdNeeded) {
      overRef.current = true
      setWonRound(true)
      lv.clearLevel()
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldTicks, dayFinished, wonRound, meltdown])

  /** The scram: rods all the way in, and a fresh run from a cold core. */
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
    plantRef.current = { power: 0, temp: BASE_TEMP, day: 0 }
    overRef.current = false
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

  /* ---------- the board ---------- */
  // Alarm conditions are read off the same numbers the operator sees. They
  // latch in the annunciator hook; nothing here feeds back into the plant.
  const online = power > ONLINE_MW
  const alarms = useAnnunciators(ALARMS, {
    'temp-high': shownTemp >= SAFE_TEMP,
    'temp-limit': shownTemp >= ALARM_TEMP,
    trip: meltdown,
    'out-low': running && online && netPower < bandLow,
    'out-high': running && online && netPower > bandHigh,
    'pumps-off': running && coolant === 0,
  })

  // Latched windows belong to one run, so a new level opens on a dark board.
  const clearAlarms = alarms.reset
  useEffect(() => {
    clearAlarms()
  }, [lv.level.n, clearAlarms])

  /** Scram clears the latched alarms along with the plant. */
  const scram = () => {
    clearAlarms()
    reset()
  }

  const pumpDrawMw = Math.round(pumpCount * PUMP_DRAW)
  const status = meltdown
    ? 'Meltdown! The core ran away and overheated. The plant is stopped, so scram to bring it back online.'
    : failedDay
      ? `Day over: on target ${dayPct}% of the time, and the grid wants 65%. The plant is stopped there. Scram to run the day again and ride the band more closely.`
      : wonRound
        ? round.phases
          ? `Day complete: on target ${dayPct}% of the time.`
          : 'Steady and cool! The grid is happy and the core is safe.'
        : !inBand
          ? netPower < bandLow
            ? 'The grid needs more than it is getting.'
            : 'The plant is sending more than the grid wants.'
          : shownTemp >= SAFE_TEMP
            ? 'Power is on target, but the core is running hot.'
            : round.lag
              ? `Holding... ${Math.max(0, holdNeeded - heldTicks)} to go. The core drifts, so resist the urge to chase it.`
              : 'Looking good... hold it steady!'

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.chart ? <InsightToggle label="trend recorder" on={showChart} onChange={setShowChart} /> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="max-w-xl text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
        <p className="font-display text-sm font-semibold text-ink-soft dark:text-stone-400">{round.label}</p>
      </div>

      <PanelSurface
        title="Unit 1 · reactor control board"
        header={
          <>
            <Plate label="Demand band" value={`${bandLow}-${bandHigh} MW`} />
            {round.phases ? (
              <>
                <Plate label="Day phase" value={`${phaseIndex + 1} of ${round.phases.length}`} />
                <Plate label="On target" value={`${dayPct}%`} />
              </>
            ) : (
              <Plate label="Steady hold" value={`${Math.min(heldTicks, holdNeeded)} / ${holdNeeded}`} />
            )}
          </>
        }
      >
        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <PanelBay
            legend="Primary loop"
            right={
              <div className="flex flex-wrap items-center gap-1.5">
                <DigitalWindow value={power} unit="MW gross" />
                {round.pumpsDraw && <DigitalWindow value={`-${pumpDrawMw}`} unit="MW pumps" tone="warn" />}
                <DigitalWindow value={netPower} unit="MW net" tone={inBand ? 'normal' : 'warn'} />
              </div>
            }
          >
            <MimicBoard
              legend="Plant mimic"
              viewBox="0 0 640 186"
              summary={`Reactor mimic. Rod bank ${rods} percent inserted, ${power} megawatts gross, core at ${shownTemp} degrees, coolant flow ${coolant} percent.`}
            >
              {/* vessel */}
              <rect x="42" y="44" width="136" height="112" rx="10" fill="#1a2025" stroke={INK.line} strokeWidth="2" />
              <motion.rect
                x="66"
                y="86"
                width="88"
                height="58"
                rx="6"
                initial={false}
                animate={{ opacity: 0.25 + glow * 0.75 }}
                transition={{ duration: reduced ? 0 : 0.3 }}
                style={{ fill: meltdown ? '#e0574a' : 'var(--accent)' }}
              />
              {meltdown && (
                <motion.rect
                  x="66"
                  y="86"
                  width="88"
                  height="58"
                  rx="6"
                  fill="#e0574a"
                  animate={reduced ? { opacity: 0.9 } : { opacity: [0.4, 1, 0.4] }}
                  transition={reduced ? { duration: 0 } : { duration: 0.5, repeat: Infinity }}
                />
              )}
              {/* rod bank: the drive shafts telescope down into the core */}
              {[78, 100, 122, 144].map((x) => (
                <g key={x}>
                  <rect x={x - 5} y="10" width="10" height="20" rx="2" fill="#4a535b" stroke="#0b0e11" />
                  <motion.rect
                    x={x - 3}
                    y="26"
                    width="6"
                    rx="2"
                    fill="#9aa6b0"
                    // Without a seeded baseline framer animates the shaft up from zero height.
                    initial={false}
                    animate={{ height: 60 + (rods / 100) * 58 }}
                    transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 26 }}
                  />
                </g>
              ))}
              <text x="110" y="172" textAnchor="middle" fontSize="9" letterSpacing="1.6" fill={INK.text} className="font-body">
                REACTOR
              </text>

              {/* hot leg to the steam generator */}
              <path
                d="M178 68 H 268"
                fill="none"
                stroke={power > 0 ? '#e0894a' : INK.lineDim}
                strokeWidth="4"
                className={power > 0 ? 'wire-flow' : undefined}
              />
              <rect x="268" y="34" width="74" height="120" rx="8" fill="#1a2025" stroke={INK.line} strokeWidth="2" />
              <text x="305" y="172" textAnchor="middle" fontSize="9" letterSpacing="1.6" fill={INK.text} className="font-body">
                STEAM GEN
              </text>

              {/* cold leg back through the coolant pumps */}
              <path
                d="M268 134 H 178"
                fill="none"
                stroke={coolant > 0 ? '#4a9fd0' : INK.lineDim}
                strokeWidth="4"
                className={coolant > 0 ? 'wire-flow' : undefined}
              />
              <circle cx="223" cy="134" r="13" fill="#232a30" stroke={INK.line} strokeWidth="2" />
              <path d="M218 128 L232 134 L218 140 Z" fill={coolant > 0 ? '#4a9fd0' : INK.lineDim} />
              <MimicLamp x={223} y={110} tone={coolant > 0 ? 'green' : 'red'} lit />
              <text x="223" y="160" textAnchor="middle" fontSize="9" letterSpacing="1.4" fill={INK.text} className="font-body">
                PUMPS
              </text>

              {/* steam to the turbine, then out to the grid */}
              <path
                d="M342 60 H 404"
                fill="none"
                stroke={power > 0 ? '#cfd6dc' : INK.lineDim}
                strokeWidth="3"
                className={power > 0 ? 'wire-flow' : undefined}
              />
              <path d="M404 40 L468 30 L468 90 L404 80 Z" fill="#232a30" stroke={INK.line} strokeWidth="2" />
              <circle cx="506" cy="60" r="22" fill="#232a30" stroke={INK.line} strokeWidth="2" />
              <text x="506" y="64" textAnchor="middle" fontSize="11" fill={INK.text} className="font-mono">
                G
              </text>
              <text x="452" y="172" textAnchor="middle" fontSize="9" letterSpacing="1.6" fill={INK.text} className="font-body">
                TURBINE AND GENERATOR
              </text>
              <path
                d="M528 60 H 600"
                fill="none"
                stroke={netPower > 0 ? '#e6c34a' : INK.lineDim}
                strokeWidth="3"
                className={netPower > 0 ? 'wire-flow' : undefined}
              />
              <path d="M600 30 V 96 M586 44 H 614 M590 62 H 610" stroke={INK.line} strokeWidth="2" fill="none" />
              <text x="600" y="120" textAnchor="middle" fontSize="9" letterSpacing="1.4" fill={INK.text} className="font-body">
                GRID
              </text>
            </MimicBoard>
          </PanelBay>

          <PanelBay legend="Plant instruments">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              <Gauge
                label="Net output to grid"
                unit="MW"
                value={netPower}
                min={0}
                max={MAX_POWER}
                majorTicks={6}
                bands={[{ from: bandLow, to: bandHigh, tone: 'green' }]}
                valueText={`${netPower} megawatts, band ${bandLow} to ${bandHigh}`}
                tone={inBand ? 'normal' : 'warn'}
              />
              <Gauge
                label="Core temperature"
                unit="°C"
                value={shownTemp}
                min={TEMP_SCALE_MIN}
                max={TEMP_SCALE_MAX}
                majorTicks={5}
                bands={[
                  { from: SAFE_TEMP, to: MELTDOWN_TEMP, tone: 'amber' },
                  { from: MELTDOWN_TEMP, to: TEMP_SCALE_MAX, tone: 'red' },
                ]}
                valueText={`${shownTemp} degrees celsius, safe below ${SAFE_TEMP}`}
                tone={tempZone === 'safe' ? 'normal' : tempZone === 'warning' ? 'warn' : 'alarm'}
              />
            </div>
          </PanelBay>
        </div>

        {round.chart && showChart && (
          <PanelBay legend="Trend recorder">
            <ChartRecorder
              legend="Chart 1 · output and core temperature"
              span={80}
              pens={[
                {
                  id: 'power',
                  label: 'Output',
                  color: 'var(--accent)',
                  points: traceRef.current.map((s) => powerPos(s.p)),
                  readout: `${netPower} MW`,
                },
                {
                  id: 'temp',
                  label: 'Core temp',
                  color: '#e0574a',
                  points: traceRef.current.map((s) => tempPos(s.t)),
                  readout: `${shownTemp} °C`,
                  dashed: true,
                },
              ]}
              band={{ from: powerPos(bandLow), to: powerPos(bandHigh), label: 'Green paper is the band the grid wants' }}
              summary={`Trend of output and core temperature over the last ${traceRef.current.length} ticks. Output ${netPower} megawatts, core ${shownTemp} degrees.`}
            />
          </PanelBay>
        )}

        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <PanelBay legend="Alarms">
            <AnnunciatorPanel state={alarms} columns={3} legend="Annunciator windows" />
            <Note className="mt-2">A window stays lit after the trouble passes. Press ack to clear it.</Note>
          </PanelBay>

          <PanelBay legend="Controls">
            <div className="flex flex-wrap items-start gap-4">
              <BankLever
                label="Control rod bank"
                value={rods}
                topValue={0}
                bottomValue={100}
                step={2}
                bigStep={10}
                detent={10}
                onChange={setRods}
                valueText={(v) => `${Math.round(v)} percent inserted`}
                hint="Handle up withdraws the rods and power climbs"
              />
              <div className="min-w-[190px] flex-1">
                <Engraved className="mb-1.5 block">Coolant pump bank</Engraved>
                <div className="flex flex-wrap gap-1.5">
                  {[0, 25, 50, 75, 100].map((v, i) => (
                    <IlluminatedButton
                      key={v}
                      legend={i === 0 ? 'Off' : `${i} pump${i > 1 ? 's' : ''}`}
                      sub={round.pumpsDraw && i > 0 ? `${i * PUMP_DRAW} MW` : undefined}
                      lit={coolant === v}
                      tone={i === 0 ? 'white' : 'green'}
                      pressed={coolant === v}
                      onClick={() => setCoolant(v)}
                      ariaLabel={i === 0 ? 'Coolant pumps off' : `Run ${i} coolant pump${i > 1 ? 's' : ''}`}
                    />
                  ))}
                </div>
                <Note className="mt-2">
                  {round.pumpsDraw
                    ? `Running ${pumpCount} pump${pumpCount === 1 ? '' : 's'} costs ${pumpDrawMw} MW of output.`
                    : 'Each pump pulls heat out of the core.'}
                </Note>
              </div>
            </div>
            <div className="mt-3">
              <GuardedControl
                legend="Scram"
                description="Drops every rod and starts the run over from a cold core."
                onFire={scram}
              />
            </div>
          </PanelBay>
        </div>

        <PanelBay legend="Plant status">
          <p
            aria-live="polite"
            className={cn(
              'min-h-[2.25rem] font-body text-[13px] leading-snug',
              meltdown || failedDay ? 'text-[#f08678]' : wonRound ? 'text-[#8fe3c4]' : 'text-slate-300',
            )}
          >
            {status}
          </p>
        </PanelBay>
      </PanelSurface>

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
          onReplay={scram}
        />
      )}
    </Card>
  )
}
