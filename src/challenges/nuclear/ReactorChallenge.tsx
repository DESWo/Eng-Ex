import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Slider } from '@/components/ui/Slider'
import type { ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const MAX_POWER = 1100 // MW at fully withdrawn rods
const SAFE_TEMP = 600 // °C: stay under this to win
const MELTDOWN_TEMP = 900 // °C: cross this and the core melts
const BASE_TEMP = 250 // °C: idle coolant temperature
const HEAT_FACTOR = 0.6 // how fast leftover heat raises temperature
const COOLANT_PULL = 11 // heat each coolant point removes

interface ReactorRound {
  label: string
  target: [number, number] // MW band to hold
}

/** Each win asks the city for more power, which needs more cooling. */
const ROUNDS: ReactorRound[] = [
  { label: 'Quiet night shift', target: [480, 580] },
  { label: 'City wakes up', target: [760, 860] },
  { label: 'Heat wave peak demand', target: [960, 1050] },
]

export function ReactorChallenge({ onComplete }: ChallengeProps) {
  const [rods, setRods] = useState(100) // 100 = fully inserted = shut down
  const [coolant, setCoolant] = useState(50)
  const [roundIndex, setRoundIndex] = useState(0)
  const [wonRound, setWonRound] = useState(false)
  const [meltdown, setMeltdown] = useState(false)
  const completedRef = useRef(false)

  const round = ROUNDS[roundIndex % ROUNDS.length]
  const [bandLow, bandHigh] = round.target

  const power = Math.round(((100 - rods) / 100) * MAX_POWER)
  const leftoverHeat = Math.max(0, power - coolant * COOLANT_PULL)
  const temp = Math.round(BASE_TEMP + leftoverHeat * HEAT_FACTOR)
  const inBand = power >= bandLow && power <= bandHigh
  const safe = temp < SAFE_TEMP
  const winnable = inBand && safe && !meltdown

  // Trip the reactor if it ever crosses the meltdown line.
  useEffect(() => {
    if (temp >= MELTDOWN_TEMP && !meltdown && !wonRound) setMeltdown(true)
  }, [temp, meltdown, wonRound])

  // Hold a good state briefly so sweeping past it is not a win.
  useEffect(() => {
    if (!winnable || wonRound) return
    const timer = setTimeout(() => {
      setWonRound(true)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, 900)
    return () => clearTimeout(timer)
  }, [winnable, wonRound, onComplete])

  const nextRound = () => {
    setRoundIndex((i) => i + 1)
    setRods(100)
    setCoolant(50)
    setWonRound(false)
    setMeltdown(false)
  }

  const reset = () => {
    setRods(100)
    setCoolant(50)
    setWonRound(false)
    setMeltdown(false)
  }

  const tempZone = meltdown
    ? 'meltdown'
    : temp >= SAFE_TEMP
      ? 'warning'
      : 'safe'
  const glow = Math.min(1, power / MAX_POWER)

  // Gauge helpers (0..1 across the visible range).
  const powerPos = (mw: number) => Math.min(1, mw / MAX_POWER)
  const tempPos = (t: number) => Math.min(1, (t - BASE_TEMP) / (MELTDOWN_TEMP + 60 - BASE_TEMP))

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">
          Bring the reactor up to meet the grid's demand, and keep the core temperature out of the
          red. Two controls, see what each one does.
        </p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
          {round.label} · aim for {bandLow}-{bandHigh} MW
        </Badge>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-slate-100/80 dark:bg-slate-950/50">
        <svg viewBox="0 0 800 300" className="w-full" role="img" aria-label="Nuclear reactor scene">
          {/* containment dome */}
          <path d="M250 250 V150 A150 100 0 0 1 550 150 V250 Z" className="fill-slate-200 dark:fill-slate-800" />
          <path d="M250 250 V150 A150 100 0 0 1 550 150 V250 Z" fill="none" className="stroke-slate-300 dark:stroke-slate-700" strokeWidth="3" />

          {/* reactor vessel */}
          <rect x="330" y="120" width="140" height="130" rx="16" className="fill-slate-300 dark:fill-slate-700" />

          {/* glowing core (brightness tracks power) */}
          <motion.rect
            x="352"
            y="150"
            width="96"
            height="94"
            rx="8"
            animate={{ opacity: 0.25 + glow * 0.75 }}
            transition={{ duration: 0.3 }}
            style={{ fill: meltdown ? '#ef4444' : 'var(--accent)' }}
          />
          {meltdown && (
            <motion.rect
              x="352"
              y="150"
              width="96"
              height="94"
              rx="8"
              fill="#ef4444"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          )}

          {/* control rods slide down from the top as insertion rises */}
          {[368, 392, 416, 440].map((x) => (
            <g key={x}>
              <rect x={x - 4} y="70" width="8" height="40" rx="3" className="fill-slate-500 dark:fill-slate-400" />
              <motion.rect
                x={x - 4}
                width="8"
                height="96"
                rx="3"
                className="fill-slate-600 dark:fill-slate-300"
                animate={{ y: 150 - (100 - rods) * 0.9 }}
                transition={{ type: 'spring', stiffness: 220, damping: 26 }}
              />
            </g>
          ))}

          {/* coolant pipes + steam puffs sized by coolant flow */}
          <rect x="470" y="200" width="90" height="14" rx="7" className="fill-sky-300 dark:fill-sky-700" />
          <rect x="240" y="200" width="90" height="14" rx="7" className="fill-sky-300 dark:fill-sky-700" />
          {coolant > 20 &&
            [520, 545, 570].map((x, i) => (
              <motion.circle
                key={x}
                cx={x}
                r={4 + coolant / 22}
                className="fill-sky-200/80 dark:fill-sky-400/40"
                animate={{ cy: [200, 150], opacity: [0.7, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.35 }}
              />
            ))}

          <text x="400" y="285" textAnchor="middle" fontSize="14" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
            {meltdown ? 'CORE MELTDOWN' : `${power} MW · ${temp}°C`}
          </text>
        </svg>
      </div>

      {/* Gauges */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* power gauge with target band */}
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-display font-semibold">Power output</span>
            <span className="tabular-nums text-ink-soft dark:text-stone-400">{power} MW</span>
          </div>
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
            <div
              className="absolute inset-y-0 bg-emerald-400/80"
              style={{ left: `${powerPos(bandLow) * 100}%`, width: `${(powerPos(bandHigh) - powerPos(bandLow)) * 100}%` }}
            />
            <motion.span
              className="absolute inset-y-0 w-1.5 rounded-full bg-ink dark:bg-white"
              animate={{ left: `${powerPos(power) * 100}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            />
          </div>
          <p className="mt-1 text-xs text-ink-soft dark:text-stone-400">Green = the city's demand.</p>
        </div>

        {/* temperature gauge with safe / warning / meltdown zones */}
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-display font-semibold">Core temperature</span>
            <span
              className={cn(
                'tabular-nums font-semibold',
                tempZone === 'safe' ? 'text-emerald-600 dark:text-emerald-400' : tempZone === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400',
              )}
            >
              {temp}°C
            </span>
          </div>
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-emerald-300/70 dark:bg-emerald-500/25">
            <div className="absolute inset-y-0 bg-amber-300/80 dark:bg-amber-500/30" style={{ left: `${tempPos(SAFE_TEMP) * 100}%`, right: 0 }} />
            <div className="absolute inset-y-0 bg-rose-400/80 dark:bg-rose-500/40" style={{ left: `${tempPos(MELTDOWN_TEMP) * 100}%`, right: 0 }} />
            <motion.span
              className="absolute inset-y-0 w-1.5 rounded-full bg-ink dark:bg-white"
              animate={{ left: `${tempPos(temp) * 100}%` }}
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
            Steady and cool! The grid is happy and the core is safe.
          </motion.p>
        ) : meltdown ? (
          <p className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Meltdown! The core ran away and overheated. Hit reset to bring it back online.
          </p>
        ) : (
          <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-300">
            {!inBand
              ? power < bandLow
                ? 'The grid needs more power than the reactor is making.'
                : 'The reactor is making more power than the grid needs.'
              : temp >= SAFE_TEMP
                ? 'Power is on target, but the core is running hot.'
                : 'Looking good... hold it steady!'}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="mt-3 grid items-end gap-x-6 gap-y-4 sm:grid-cols-2">
        <Slider
          label="Control rods (insertion)"
          value={rods}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => {
            setRods(v)
            setMeltdown(false)
          }}
        />
        <Slider
          label="Coolant flow"
          value={coolant}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => {
            setCoolant(v)
            setMeltdown(false)
          }}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {wonRound && (
          <Button variant="accent" onClick={nextRound}>
            Next demand
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" onClick={reset} aria-label="Scram the reactor">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Round {(roundIndex % ROUNDS.length) + 1}</Badge>
      </div>
    </Card>
  )
}
