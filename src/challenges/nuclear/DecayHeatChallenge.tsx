import { useEffect, useRef, useState } from 'react'
import { BookCheck, RotateCcw } from 'lucide-react'
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
    setup: { modes: BASIC, limit: 900, battery: null, curve: false, brief: 'The reactor scrammed an hour ago. Keep it cool for the next day.' },
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
      { id: 'peak', label: 'Peak fuel temp', goal: 'min', target: 420, unit: '°C' },
      { id: 'battery', label: 'Battery used', goal: 'min', target: 160, unit: ' kWh' },
      { id: 'final', label: 'Temp after a day', goal: 'min', target: 320, unit: '°C' },
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
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)
  const completedRef = useRef(false)

  useEffect(() => {
    setPicks(['off', 'off', 'off'])
    setWon(false)
    setVerdict(null)
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
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'The drill is over and the core is back at the start. Read the heat curve: spend your power where the heat actually is.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  const maxBar = 60
  const COL_W = 200
  const COL_X = 110

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.curve ? <InsightToggle label="decay curve" on={showCurve} onChange={setShowCurve} /> : undefined}
      />

      <Objective
        goal={`Keep the fuel under ${setup.limit}°C for 24 hours${setup.battery !== null ? ` on ${setup.battery} kWh of battery` : ''}`}
        status={`this plan peaks at ${Math.round(peak)}°C · ${Math.round(battery)} kWh`}
        attemptsLeft={att.left}
        met={won}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">Damage above {setup.limit}°C</Badge>
      </div>

      {/* Scene: heat against cooling for each stretch of the day */}
      <div className="overflow-hidden rounded-2xl blueprint">
        <svg viewBox="0 0 800 260" className="w-full" role="img" aria-label="Decay heat over the first day">
          {timeline.map((b, i) => {
            const x = COL_X + i * COL_W
            const heatH = (b.heat / maxBar) * 120
            const coolH = (MODES[b.mode].mw / maxBar) * 120
            const short = b.heat > MODES[b.mode].mw
            return (
              <g key={b.label}>
                <text x={x + 30} y="26" textAnchor="middle" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                  {b.label}
                </text>
                {/* decay heat */}
                <rect x={x} y={160 - heatH} width="26" height={heatH} rx="3" className="fill-rose-400" />
                {/* what the chosen cooling can remove */}
                <rect x={x + 34} y={160 - coolH} width="26" height={coolH} rx="3" className="fill-sky-400" />
                <line x1={x - 6} y1="160" x2={x + 66} y2="160" strokeWidth="1.5" className="stroke-stone-400 dark:stroke-stone-600" />
                {showCurve && setup.curve && (
                  <>
                    <text x={x + 13} y={154 - heatH} textAnchor="middle" fontSize="11" fontWeight="700" className="fill-rose-600 font-display dark:fill-rose-300">
                      {b.heat}
                    </text>
                    <text x={x + 47} y={154 - coolH} textAnchor="middle" fontSize="11" fontWeight="700" className="fill-sky-700 font-display dark:fill-sky-300">
                      {MODES[b.mode].mw}
                    </text>
                  </>
                )}
                <text
                  x={x + 30}
                  y="182"
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  className={cn('font-display', short ? 'fill-rose-600 dark:fill-rose-300' : 'fill-emerald-700 dark:fill-emerald-300')}
                >
                  {short ? 'heating up' : 'cooling down'}
                </text>
                <text x={x + 30} y="204" textAnchor="middle" fontSize="13" fontWeight="700" className="fill-ink font-display dark:fill-stone-200">
                  {Math.round(b.temp)}°C
                </text>
              </g>
            )
          })}

          {/* legend */}
          <rect x="24" y="60" width="14" height="14" rx="3" className="fill-rose-400" />
          <text x="44" y="72" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">heat</text>
          <rect x="24" y="82" width="14" height="14" rx="3" className="fill-sky-400" />
          <text x="44" y="94" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">cooling</text>

          <text x="24" y="240" fontSize="12" fontWeight="700" className={cn('font-display', melted ? 'fill-rose-600 dark:fill-rose-300' : 'fill-ink-soft dark:fill-stone-400')}>
            Peak fuel temperature {Math.round(peak)}°C
          </text>
        </svg>
      </div>

      {/* Verdict: the day only plays out once the procedure is handed over */}
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
            Assign a cooling mode to each block of the day, then run the procedure to see the whole 24 hours.
          </p>
        )}
      </div>

      {setup.battery !== null && (
        <div className="mt-3">
          <Meter
            label="Backup power"
            display={`${Math.round(battery)} of ${setup.battery} kWh`}
            fraction={battery / setup.battery}
            barClass={overBattery ? 'bg-rose-500' : 'bg-emerald-500'}
          />
        </div>
      )}

      {/* Controls: one cooling choice per stretch of the day */}
      <div className="mt-4 space-y-3">
        {BLOCKS.map((b, i) => (
          <div key={b.label}>
            <p className="mb-2 font-display text-sm font-semibold">
              {b.label} <span className="font-normal text-ink-soft dark:text-stone-400">· {b.heat} MW of decay heat</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {setup.modes.map((m) => {
                const active = picks[i] === m
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setVerdict(null); setPicks((p) => p.map((v, j) => (j === i ? m : v))) }}
                    aria-pressed={active}
                    className={cn(
                      'rounded-2xl px-4 py-2 text-left font-display text-sm font-semibold transition-colors duration-200',
                      active ? 'accent-bg text-white shadow-clay' : 'bg-stone-100 text-ink-soft hover:bg-stone-200 dark:bg-white/5 dark:text-stone-400 dark:hover:bg-white/10',
                    )}
                  >
                    <span className="block">{MODES[m].label}</span>
                    <span className={cn('block text-xs font-medium', active ? 'text-white/80' : 'opacity-70')}>
                      {MODES[m].mw} MW{MODES[m].kwhPerHour > 0 ? ` · ${MODES[m].kwhPerHour} kWh/h` : ' · free'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={runProcedure} disabled={won}>
          <BookCheck className="h-5 w-5" />
          Run the procedure
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Reset the plan">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">{Math.round(battery)} kWh used</Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard metrics={lv.level.metrics} values={{ peak, battery, final: temp }} best={lv.best} scored={won} />
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
          onReplay={reset}
        />
      )}
    </Card>
  )
}
