import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { InsightToggle } from '@/components/level/InsightToggle'
import { Objective } from '@/components/level/Objective'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import {
  AnnunciatorPanel,
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
import { attemptsFor, useAttempts } from '@/hooks/useAttempts'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
/**
 * A reactor that has been shut down still makes heat, because the broken
 * fragments left in the fuel keep decaying. It fades slowly and never reaches
 * zero, which is why cooling has to keep running for days after shutdown.
 */
const BLOCKS = [
  { label: 'First hour', hours: 1, heat: 55 },
  { label: 'Hours 1 to 6', hours: 5, heat: 32 },
  { label: 'Hours 6 to 24', hours: 18, heat: 22 },
]

const MODES = {
  off: { label: 'Off', mw: 0, kwhPerHour: 0, note: 'No cooling at all' },
  natural: { label: 'Natural flow', mw: 25, kwhPerHour: 0, note: 'Free, but weak' },
  low: { label: 'Pump, low', mw: 30, kwhPerHour: 20, note: 'Steady drain' },
  high: { label: 'Pump, high', mw: 50, kwhPerHour: 45, note: 'Powerful and thirsty' },
} as const
type ModeId = keyof typeof MODES

const START_TEMP = 300
const FLOOR_TEMP = 280
const DEG_PER_MW_HOUR = 6

/* --------------- board only, never read by the sim --------------- */
/** Engraved cap legends. Engraved text takes no punctuation. */
const CAP: Record<ModeId, string> = { off: 'Off', natural: 'Natural flow', low: 'Pump low', high: 'Pump high' }
/** Full scale on the board meters. Display range, not a plant limit. */
const TEMP_SCALE_MIN = 200
const TEMP_SCALE_MAX = 1000
/** A day of pumping flat out draws 1080 kWh, so the bank meter has to reach past it. */
const BATT_SCALE = 1200
/** Amber band and amber window on the temperature meter. Board threshold only. */
const WARN_TEMP = 700
/** Full scale on the recorder's megawatt pens. */
const MW_SCALE = 60
/** One recorder sample per hour: which block each hour of the day belongs to. */
const HOUR_BLOCK = BLOCKS.flatMap((b, i) => Array.from({ length: b.hours }, () => i))

const ALARMS: AnnunciatorDef[] = [
  { id: 'temp-high', legend: 'Fuel temp high', tone: 'amber' },
  { id: 'fuel-damage', legend: 'Fuel damage', tone: 'red' },
  { id: 'bank-empty', legend: 'Battery exhausted', tone: 'red' },
]

interface DecaySetup {
  /** Cooling modes on offer this level. */
  modes: ModeId[]
  /** Temperature that means fuel damage. */
  limit: number
  /** Backup power available in kWh, or null. */
  battery: number | null
  /** Level 4 on: the decay curve readout is available. */
  curve: boolean
  brief: string
}

const BASIC: ModeId[] = ['off', 'low', 'high']
const ALL: ModeId[] = ['off', 'natural', 'low', 'high']

const LEVELS: ChallengeLevel<DecaySetup>[] = [
  {
    n: 1,
    title: 'It is still hot',
    phase: 'play',
    concept: 'Heat after shutdown',
    teach: 'It plays like an idle game running in reverse: the reactor is OFF and still earning heat you never asked for, fastest right after shutdown. Pick a cooling setting for each stretch of time and keep the fuel below the damage line.',
    setup: { modes: BASIC, limit: 900, battery: null, curve: false, brief: 'The reactor just scrammed, an emergency shutdown, and the first hour starts now. Keep it cool for the next day.' },
  },
  {
    n: 2,
    title: 'On backup power',
    phase: 'understand',
    concept: 'The batteries are finite',
    teach: 'The grid is down, so the pumps are running off batteries. Running them flat out for a whole day is not an option, and the heat lasts far longer than the charge.',
    setup: { modes: BASIC, limit: 900, battery: 600, curve: false, brief: 'Off-site power is gone. Everything now runs on the backup bank.' },
  },
  {
    n: 3,
    title: 'Let it flow',
    phase: 'understand',
    concept: 'Passive cooling',
    teach: 'Hot water rises and cold water sinks, so the coolant will circulate on its own with no pump at all. It is weak, but the decay heat is fading, and eventually weak is enough.',
    setup: { modes: ALL, limit: 900, battery: 200, curve: false, brief: 'The battery bank is nearly spent. There is one more way to move heat, and it costs nothing.' },
  },
  {
    n: 4,
    title: 'Read the curve',
    phase: 'analyze',
    concept: 'Heat falls, slowly',
    teach: 'Turn on the readout. The bars show how the decay heat drops against what each cooling mode can remove. The moment the free option clears the bar is the moment you can stop spending power.',
    setup: { modes: ALL, limit: 850, battery: 200, curve: true, brief: 'Same emergency, with the decay heat curve on screen.' },
  },
  {
    n: 5,
    title: 'Write the procedure',
    phase: 'optimize',
    concept: 'Cool, cheap, and calm',
    teach: 'This becomes the station emergency procedure. Keep the peak temperature down, leave the core cold at the end, and use as little of the battery as you can, because nobody knows when the grid comes back.',
    setup: { modes: ALL, limit: 900, battery: 300, curve: true, brief: 'Write the cooling procedure the operators will follow next time.' },
    metrics: [
      // Pars come from walking all 64 procedures: 12 of them survive the day
      // on the 300 kWh bank, and none clears all three pars. Holding the peak
      // under 400°C costs at least 145 kWh, and finishing under 300°C costs at
      // least 45, so a thrifty procedure gives up the peak and a calm one
      // gives up the bank. Pump high, pump low, then natural flow used to take
      // all three at once.
      { id: 'peak', label: 'Peak fuel temp', goal: 'min', target: 400, unit: '°C' },
      { id: 'battery', label: 'Battery used', goal: 'min', target: 120, unit: ' kWh' },
      { id: 'final', label: 'Temp after a day', goal: 'min', target: 300, unit: '°C' },
    ],
  },
]

export function DecayHeatChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('decay-heat', LEVELS)
  const setup = lv.level.setup

  const [picks, setPicks] = useState<ModeId[]>(['off', 'off', 'off'])
  const [won, setWon] = useState(false)
  const [showCurve, setShowCurve] = useState(true)
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  /** What the last committed day did. The annunciators read this, never the plan. */
  const [played, setPlayed] = useState<{ peak: number; melted: boolean; over: boolean } | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)
  const completedRef = useRef(false)

  useEffect(() => {
    setPicks(['off', 'off', 'off'])
    setWon(false)
    setVerdict(null)
    setPlayed(null)
  }, [lv.level.n])

  // Walk the day forwards, block by block.
  let temp = START_TEMP
  let peak = START_TEMP
  let battery = 0
  const timeline = BLOCKS.map((b, i) => {
    const mode = MODES[picks[i]]
    temp = Math.max(FLOOR_TEMP, temp + (b.heat - mode.mw) * DEG_PER_MW_HOUR * b.hours)
    peak = Math.max(peak, temp)
    battery += mode.kwhPerHour * b.hours
    return { ...b, mode: picks[i], temp }
  })

  const overBattery = setup.battery !== null && battery > setup.battery
  const melted = peak > setup.limit
  const solved = !melted && !overBattery

  /** Levels 2, 3 and 5 hide the temperatures until the procedure is run. */
  const outcomeVisible = lv.level.n === 1 || lv.level.n === 4 || verdict !== null || won

  const reset = () => {
    setPicks(['off', 'off', 'off'])
    setWon(false)
    setVerdict(null)
  }

  /** Hand the procedure to the operators and live the next 24 hours. */
  const runProcedure = () => {
    if (won) return
    if (solved) {
      setWon(true)
      setPlayed({ peak, melted, over: overBattery })
      setVerdict({ ok: true, text: `Safe. Peak ${Math.round(peak)}°C, and the core is down to ${Math.round(temp)}°C after a day.` })
      lv.clearLevel(lv.level.metrics ? { peak, battery, final: temp } : undefined)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const text = melted
      ? `Fuel damage. The core reached ${Math.round(peak)}°C, past the ${setup.limit}°C line. Decay heat is fiercest in the first hours.`
      : `The batteries died mid-shift: that plan needs ${Math.round(battery)} kWh and the bank holds ${setup.battery}.`
    setPlayed({ peak, melted, over: overBattery })
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'The drill is over and the core is back at the start. Read the heat curve: spend your power where the heat actually is.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  /* ---------- the board ---------- */
  // Windows record the day that was run, so clearing the plan does not erase
  // what happened. Nothing here writes back into the walk above.
  const alarms = useAnnunciators(ALARMS, {
    'temp-high': played !== null && played.peak >= WARN_TEMP,
    'fuel-damage': played?.melted === true,
    'bank-empty': played?.over === true,
  })

  // Latched windows belong to one run, so a new level opens on a dark board.
  const clearAlarms = alarms.reset
  useEffect(() => {
    clearAlarms()
  }, [lv.level.n, clearAlarms])

  /** Clear plan: fresh schedule, dark windows, cold core. */
  const clearBoard = () => {
    clearAlarms()
    setPlayed(null)
    reset()
  }

  const pick = (i: number, m: ModeId) => {
    setVerdict(null)
    setPicks((p) => p.map((v, j) => (j === i ? m : v)))
  }

  /* ---------- recorder traces: one sample per hour ---------- */
  // Same rate and same floor as the block walk, stepped an hour at a time, so
  // every block boundary lands on exactly the temperature the walk produced.
  let hourTemp = START_TEMP
  const tempTrace = HOUR_BLOCK.map((bi) => {
    hourTemp = Math.max(FLOOR_TEMP, hourTemp + (BLOCKS[bi].heat - MODES[picks[bi]].mw) * DEG_PER_MW_HOUR)
    return hourTemp
  })
  const tempPos = (t: number) => (t - TEMP_SCALE_MIN) / (TEMP_SCALE_MAX - TEMP_SCALE_MIN)

  const anyPump = picks.some((p) => p === 'low' || p === 'high')
  const anyNatural = picks.includes('natural')
  const anyCooling = picks.some((p) => p !== 'off')
  const lastMode = MODES[picks[2]]

  const planLine = timeline.map((b) => `${b.label.toLowerCase()} on ${MODES[b.mode].label.toLowerCase()}`).join(', ')
  const status = verdict
    ? verdict.text
    : 'Set a cooling mode for each stretch of the day, then lift the guard and run the day.'

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.curve ? <InsightToggle label="decay curve" on={showCurve} onChange={setShowCurve} /> : undefined}
      />

      <Objective
        goal={`Keep the fuel under ${setup.limit}°C for 24 hours${setup.battery !== null ? ` on ${setup.battery} kWh of battery` : ''}`}
        status={
          outcomeVisible
            ? `this plan peaks at ${Math.round(peak)}°C · ${Math.round(battery)} kWh`
            : `plan drains ${Math.round(battery)} kWh · run it to find out`
        }
        attemptsLeft={att.left}
        met={won}
      />

      <div className="mb-4">
        <p className="max-w-xl text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
      </div>

      <PanelSurface
        title="Unit 1 · shutdown cooling board"
        header={
          <>
            <Plate label="Damage limit" value={`${setup.limit} °C`} />
            {setup.battery !== null && <Plate label="Battery bank" value={`${setup.battery} kWh`} />}
            <Plate label="Shift" value="24 h" />
          </>
        }
      >
        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <PanelBay
            legend="Residual heat removal"
            right={
              <div className="flex flex-wrap items-center gap-1.5">
                <DigitalWindow value={outcomeVisible ? Math.round(temp) : '- - -'} unit="°C at 24 h" />
                {setup.battery !== null && (
                  <DigitalWindow value={Math.round(battery)} unit="kWh drawn" tone={overBattery ? 'alarm' : 'normal'} />
                )}
              </div>
            }
          >
            <MimicBoard
              legend="Cooling train"
              viewBox="0 0 640 172"
              summary={`Shutdown cooling train. The plan runs ${planLine}. ${
                anyPump ? 'Pumps draw from the battery bank.' : 'No pump is running.'
              }`}
            >
              {/* the shut down core, still making decay heat */}
              <rect x="34" y="38" width="126" height="112" rx="10" fill="#1a2025" stroke={INK.line} strokeWidth="2" />
              <rect
                x="58"
                y="82"
                width="78"
                height="46"
                rx="5"
                fill={played?.melted ? '#e0574a' : '#e0894a'}
                opacity={played?.melted ? 0.95 : 0.7}
              />
              <text x="97" y="166" textAnchor="middle" fontSize="9" letterSpacing="1.4" fill={INK.text} className="font-body">
                SHUT DOWN CORE
              </text>

              {/* hot leg out to the heat exchanger, cold leg back through the pump */}
              <path
                d="M160 60 H 352"
                fill="none"
                stroke={anyCooling ? '#e0894a' : INK.lineDim}
                strokeWidth="4"
                className={anyCooling ? 'wire-flow' : undefined}
              />
              <path
                d="M352 138 H 160"
                fill="none"
                stroke={anyCooling ? '#4a9fd0' : INK.lineDim}
                strokeWidth="4"
                className={anyCooling ? 'wire-flow' : undefined}
              />

              {/* the bypass line: hot water rises through it with no pump at all */}
              <path
                d="M240 138 C 240 104, 172 104, 172 138"
                fill="none"
                stroke={anyNatural ? '#48a878' : INK.lineDim}
                strokeWidth="2.5"
                className={anyNatural ? 'wire-flow' : undefined}
              />
              <MimicLamp x={206} y={100} tone="green" lit={anyNatural} />
              <text x="206" y="86" textAnchor="middle" fontSize="9" letterSpacing="1.4" fill={INK.text} className="font-body">
                NATURAL FLOW
              </text>
              <circle cx="206" cy="138" r="13" fill="#232a30" stroke={INK.line} strokeWidth="2" />
              <path d="M201 132 L215 138 L201 144 Z" fill={anyPump ? '#4a9fd0' : INK.lineDim} />
              <MimicLamp x={240} y={126} tone={anyPump ? 'green' : 'white'} lit={anyPump} />
              <text x="206" y="166" textAnchor="middle" fontSize="9" letterSpacing="1.4" fill={INK.text} className="font-body">
                PUMP
              </text>

              {/* heat exchanger out to the ultimate heat sink */}
              <rect x="352" y="38" width="66" height="112" rx="8" fill="#1a2025" stroke={INK.line} strokeWidth="2" />
              <path d="M362 62 H 408 M362 82 H 408 M362 102 H 408 M362 122 H 408" stroke={INK.lineDim} strokeWidth="2" fill="none" />
              <text x="385" y="166" textAnchor="middle" fontSize="9" letterSpacing="1.4" fill={INK.text} className="font-body">
                HEAT SINK
              </text>

              {/* battery bank feeding the pump motors */}
              <rect x="452" y="44" width="150" height="52" rx="6" fill="#232a30" stroke={INK.line} strokeWidth="2" />
              {[470, 502, 534, 566].map((x) => (
                <rect
                  key={x}
                  x={x}
                  y="56"
                  width="20"
                  height="28"
                  rx="2"
                  fill={played?.over ? '#e0574a' : anyPump ? '#e6a72e' : '#2a3037'}
                  opacity={played?.over || anyPump ? 0.85 : 1}
                  stroke="#0b0e11"
                />
              ))}
              <text x="527" y="116" textAnchor="middle" fontSize="9" letterSpacing="1.4" fill={INK.text} className="font-body">
                BATTERY BANK
              </text>
              <path
                d="M527 122 V 156 H 216 V 147"
                fill="none"
                stroke={anyPump ? '#e6a72e' : INK.lineDim}
                strokeWidth="2"
                className={anyPump ? 'wire-flow' : undefined}
              />
            </MimicBoard>
          </PanelBay>

          <PanelBay legend="Fuel instruments">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              <Gauge
                label="Peak fuel temp"
                unit="°C"
                value={outcomeVisible ? peak : TEMP_SCALE_MIN}
                min={TEMP_SCALE_MIN}
                max={TEMP_SCALE_MAX}
                majorTicks={5}
                bands={[
                  { from: WARN_TEMP, to: setup.limit, tone: 'amber' },
                  { from: setup.limit, to: TEMP_SCALE_MAX, tone: 'red' },
                ]}
                readout={outcomeVisible ? `${Math.round(peak)}` : '- - -'}
                valueText={
                  outcomeVisible
                    ? `${Math.round(peak)} degrees celsius peak, fuel damage above ${setup.limit}`
                    : 'Not measured yet. Run the day to read the peak temperature.'
                }
                tone={outcomeVisible ? (melted ? 'alarm' : peak >= WARN_TEMP ? 'warn' : 'normal') : 'normal'}
              />
              {setup.battery !== null && (
                <Gauge
                  label="Battery drawn"
                  unit="kWh"
                  value={battery}
                  min={0}
                  max={BATT_SCALE}
                  majorTicks={5}
                  bands={[
                    { from: 0, to: setup.battery, tone: 'green' },
                    { from: setup.battery, to: BATT_SCALE, tone: 'red' },
                  ]}
                  valueText={`${Math.round(battery)} kilowatt hours drawn of ${setup.battery} in the bank`}
                  tone={overBattery ? 'alarm' : 'normal'}
                />
              )}
            </div>
          </PanelBay>
        </div>

        <PanelBay legend="Trend recorder">
          <ChartRecorder
            legend="Chart 1 · decay heat against cooling"
            span={HOUR_BLOCK.length}
            pens={[
              {
                id: 'heat',
                label: 'Decay heat',
                color: '#e0574a',
                points: HOUR_BLOCK.map((bi) => BLOCKS[bi].heat / MW_SCALE),
                readout: setup.curve && showCurve ? `${BLOCKS[2].heat} MW` : undefined,
              },
              {
                id: 'cooling',
                label: 'Heat removed',
                color: '#4a9fd0',
                points: HOUR_BLOCK.map((bi) => MODES[picks[bi]].mw / MW_SCALE),
                readout: setup.curve && showCurve ? `${lastMode.mw} MW` : undefined,
              },
              ...(outcomeVisible
                ? [
                    {
                      id: 'fuel',
                      label: 'Fuel temp',
                      color: '#ecb85a',
                      points: tempTrace.map(tempPos),
                      readout: `${Math.round(temp)} °C`,
                      dashed: true,
                    },
                  ]
                : []),
            ]}
            summary={
              outcomeVisible
                ? `Decay heat falls from ${BLOCKS[0].heat} to ${BLOCKS[2].heat} megawatts across the day. Your cooling removes ${MODES[picks[0]].mw}, then ${MODES[picks[1]].mw}, then ${lastMode.mw} megawatts. Fuel peaks at ${Math.round(peak)} degrees and ends at ${Math.round(temp)}.`
                : `Decay heat falls from ${BLOCKS[0].heat} to ${BLOCKS[2].heat} megawatts across the day. Your cooling removes ${MODES[picks[0]].mw}, then ${MODES[picks[1]].mw}, then ${lastMode.mw} megawatts. Run the day to draw the fuel temperature pen.`
            }
          />
          <Note className="mt-1.5">
            Paper runs from the scram at the left edge to 24 hours at the right. Wherever the red pen sits above the blue one, the fuel
            is heating up.
          </Note>
        </PanelBay>

        <PanelBay legend="Cooling schedule">
          <div className="space-y-2.5">
            {timeline.map((b, i) => {
              const short = b.heat > MODES[b.mode].mw
              return (
                <div key={b.label} className="border-b border-white/8 pb-2.5 last:border-0 last:pb-0">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Engraved>{b.label}</Engraved>
                      <Plate label="Decay heat" value={`${b.heat} MW`} />
                    </div>
                    {outcomeVisible && (
                      <div className="flex items-center gap-2">
                        <Engraved className="text-[9px]">{short ? 'Heating up' : 'Cooling down'}</Engraved>
                        <DigitalWindow
                          value={Math.round(b.temp)}
                          unit="°C at end"
                          tone={b.temp > setup.limit ? 'alarm' : b.temp >= WARN_TEMP ? 'warn' : 'normal'}
                        />
                      </div>
                    )}
                  </div>
                  <div role="group" aria-label={`Cooling for ${b.label.toLowerCase()}`} className="flex flex-wrap gap-1.5">
                    {setup.modes.map((m) => (
                      <IlluminatedButton
                        key={m}
                        legend={CAP[m]}
                        sub={`${MODES[m].mw} MW · ${MODES[m].kwhPerHour > 0 ? `${MODES[m].kwhPerHour} kWh/h` : 'free'}`}
                        lit={picks[i] === m}
                        tone={m === 'off' ? 'red' : m === 'natural' ? 'white' : 'green'}
                        pressed={picks[i] === m}
                        onClick={() => pick(i, m)}
                        ariaLabel={`${MODES[m].label} for ${b.label.toLowerCase()}, removes ${MODES[m].mw} megawatts`}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </PanelBay>

        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <PanelBay legend="Alarms">
            <AnnunciatorPanel state={alarms} columns={3} legend="Annunciator windows" />
            <Note className="mt-2">A window stays lit after the day is over. Press ack to clear it.</Note>
          </PanelBay>

          <PanelBay legend="Procedure">
            <div className="flex flex-wrap items-start gap-3">
              {won ? (
                <IlluminatedButton
                  legend="Day complete"
                  lit
                  tone="green"
                  disabled
                  onClick={() => {}}
                  ariaLabel="The day is complete"
                  className="px-5 py-3"
                />
              ) : (
                <GuardedControl
                  legend="Run day"
                  description="Hands the schedule to the shift and plays all 24 hours. It spends one test."
                  onFire={runProcedure}
                />
              )}
              <IlluminatedButton
                legend="Clear plan"
                lit={false}
                tone="white"
                onClick={clearBoard}
                ariaLabel="Clear the plan and the alarm windows"
                className="px-4 py-3"
              />
            </div>
          </PanelBay>
        </div>

        <PanelBay legend="Plant status">
          <p
            aria-live="polite"
            className={cn(
              'min-h-[2.25rem] font-body text-[13px] leading-snug',
              verdict ? (verdict.ok ? 'text-[#8fe3c4]' : 'text-[#f08678]') : 'text-slate-300',
            )}
          >
            {status}
          </p>
        </PanelBay>
      </PanelSurface>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard metrics={lv.level.metrics} values={outcomeVisible ? { peak, battery, final: temp } : {}} best={lv.best} scored={won} />
        </div>
      )}

      {won && (
        <LevelComplete
          lv={lv}
          message={
            lv.level.metrics
              ? `Peak ${Math.round(peak)}°C on ${Math.round(battery)} kWh. Can you spend less?`
              : 'The core is stable. Cooling held all day.'
          }
          onReplay={clearBoard}
        />
      )}
    </Card>
  )
}
