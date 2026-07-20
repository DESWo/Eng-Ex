import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw, Wind } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import { InsightToggle } from '@/components/level/InsightToggle'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import { useSvgDrag } from '@/hooks/useSvgDrag'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const STALL_ANGLE = 16 // degrees: past this the wing stalls and loses lift
const LIFT_TOLERANCE = 8 // how close lift must match weight (percent points)

/**
 * Simple lift model. Lift grows with speed and with angle of attack,
 * but past the stall angle the wing "lets go" and lift collapses.
 */
function liftOf(throttle: number, angle: number) {
  const speed = 40 + (throttle / 100) * 120
  const clForAngle =
    angle <= STALL_ANGLE ? angle / STALL_ANGLE : Math.max(0, 1 - (angle - STALL_ANGLE) / 10)
  return (speed / 160) * clForAngle * 165
}

/**
 * Fuel flow. Throttle burns fuel directly, and a raised nose adds induced
 * drag that grows with the SQUARE of the angle, so both too fast and too
 * steep are expensive. Somewhere in between sits the cruise sweet spot.
 */
const burnOf = (throttle: number, angle: number) => 0.7 * throttle + 0.35 * angle * angle

/** Cargo options for level 5. */
const CARGO = [0, 20, 40]

interface FlightSetup {
  label: string
  /** Weight before any chosen cargo. */
  weight: number
  gust: number
  /** Max sustainable fuel flow, or null with a full tank. */
  fuelCap: number | null
  /** Level 5: the player loads cargo too. */
  chooseCargo: boolean
  /** Level 4 on: the four-forces overlay is available. */
  forces: boolean
  brief: string
}

const LEVELS: ChallengeLevel<FlightSetup>[] = [
  {
    n: 1,
    title: 'Straight and level',
    phase: 'play',
    concept: 'Lift fights weight',
    teach: 'Two controls: throttle for speed, and the nose angle. Lift comes from both. Find any combination where lift matches weight and the plane holds the line.',
    setup: { label: 'Calm morning hop', weight: 100, gust: 0, fuelCap: null, chooseCargo: false, forces: false, brief: 'A light plane on a calm morning. Just hold the dashed line.' },
  },
  {
    n: 2,
    title: 'Watch the fuel flow',
    phase: 'understand',
    concept: 'Full throttle is not free',
    teach: 'The gauge shows fuel flow, and this trip only works below the red line. Firewalling the throttle holds altitude easily and burns far too much, so find a setting the tank can actually sustain.',
    setup: { label: 'The long leg', weight: 100, gust: 0, fuelCap: 105, chooseCargo: false, forces: false, brief: 'The same plane on a leg long enough that fuel flow decides whether you arrive.' },
  },
  {
    n: 3,
    title: 'The drag tax',
    phase: 'understand',
    concept: 'Nose-up costs fuel too',
    teach: 'A raised nose buys lift but drags through the air, and that drag grows fast. Flying slow and steep burns MORE than flying faster and flatter, so the cheapest cruise sits in a narrow band between the two.',
    setup: { label: 'Cargo aboard', weight: 125, gust: 0, fuelCap: 125, chooseCargo: false, forces: false, brief: 'A heavier plane and a tight fuel margin. Both edges of the trim envelope now burn too much.' },
  },
  {
    n: 4,
    title: 'The four forces',
    phase: 'analyze',
    concept: 'Lift, weight, thrust, drag',
    teach: 'Turn on the overlay. Every aircraft ever flown balances these four arrows: lift against weight, thrust against drag. Watch how moving either control reshapes all four at once.',
    setup: { label: 'Gusty ridge line', weight: 115, gust: -15, fuelCap: 125, chooseCargo: false, forces: true, brief: 'A downdraft over the ridge, with the flight forces drawn on the plane.' },
  },
  {
    n: 5,
    title: 'Payload versus range',
    phase: 'optimize',
    concept: 'Every kilo needs fuel',
    teach: 'Load the cargo yourself. More payload needs more lift, more lift needs a steeper, thirstier trim, and the stall is closer than it looks. Carry the most you can while the burn stays sane.',
    setup: { label: 'The freight run', weight: 100, gust: 0, fuelCap: 145, chooseCargo: true, forces: true, brief: 'The customer pays by the kilo delivered. The tank does not care what the customer pays.' },
    metrics: [
      { id: 'cargo', label: 'Cargo carried', goal: 'max', target: 40, unit: ' kg' },
      { id: 'burn', label: 'Fuel flow', goal: 'min', target: 140 },
      { id: 'stall', label: 'Stall margin', goal: 'max', target: 2, unit: '°' },
    ],
  },
]

export function FlightChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('flight', LEVELS)
  const round = lv.level.setup

  const [throttle, setThrottle] = useState(50)
  const [angle, setAngle] = useState(6)
  const [cargo, setCargo] = useState(0)
  const [wonRound, setWonRound] = useState(false)
  const [showForces, setShowForces] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    setThrottle(50)
    setAngle(6)
    setCargo(0)
    setWonRound(false)
  }, [lv.level.n])

  const { bind: throttleBind } = useSvgDrag((x) =>
    setThrottle(Math.max(0, Math.min(100, Math.round(((x - 10) / 220) * 100)))),
  )
  const { bind: noseBind } = useSvgDrag((_x, y) =>
    setAngle(Math.max(0, Math.min(24, Math.round((46 - y) / 1.3)))),
  )
  const nudgeThrottle = (e: React.KeyboardEvent) => {
    const s = e.shiftKey ? 10 : 2
    if (e.key === 'ArrowRight') setThrottle((v) => Math.min(100, v + s))
    else if (e.key === 'ArrowLeft') setThrottle((v) => Math.max(0, v - s))
    else return
    e.preventDefault()
  }
  const nudgeNose = (e: React.KeyboardEvent) => {
    const s = e.shiftKey ? 4 : 1
    if (e.key === 'ArrowUp') setAngle((v) => Math.min(24, v + s))
    else if (e.key === 'ArrowDown') setAngle((v) => Math.max(0, v - s))
    else return
    e.preventDefault()
  }

  const weight = round.weight + (round.chooseCargo ? cargo : 0)
  const stalled = angle > STALL_ANGLE
  const lift = liftOf(throttle, angle) + round.gust
  const burn = Math.round(burnOf(throttle, angle))
  const overBurn = round.fuelCap !== null && burn > round.fuelCap
  const balance = lift - weight // >0 climbs, <0 sinks
  const level = Math.abs(balance) <= LIFT_TOLERANCE && !stalled && !overBurn
  const status = stalled
    ? 'stall'
    : balance > LIFT_TOLERANCE
      ? 'climb'
      : balance < -LIFT_TOLERANCE
        ? 'sink'
        : overBurn
          ? 'thirsty'
          : 'level'

  useEffect(() => {
    if (!level || wonRound) return
    const timer = setTimeout(() => {
      setWonRound(true)
      lv.clearLevel(
        lv.level.metrics ? { cargo, burn, stall: STALL_ANGLE - angle } : undefined,
      )
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, 900)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, wonRound, cargo, burn, angle])

  const reset = () => {
    setThrottle(50)
    setAngle(6)
    setCargo(0)
    setWonRound(false)
  }

  // Plane pitch and vertical drift for the scene.
  const planeTilt = stalled ? 26 : Math.max(-18, Math.min(18, -balance * 0.4)) * -1
  const planeDrift = stalled ? 70 : Math.max(-46, Math.min(46, -balance * 1.4))

  // Force arrows for the level 4 overlay, scaled to stay inside the scene.
  const thrustLen = 20 + throttle * 0.5
  const dragLen = 12 + (burn - 0.7 * throttle) * 0.5 + throttle * 0.15
  const liftLen = Math.min(70, lift * 0.4)
  const weightLen = Math.min(70, weight * 0.4)

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.forces ? <InsightToggle label="forces" on={showForces} onChange={setShowForces} /> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
          {round.gust !== 0 && (
            <Badge className={cn('px-4 py-1.5 text-sm', round.gust < 0 ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300')}>
              <Wind className="mr-1 h-4 w-4" />
              {round.gust < 0 ? 'Downdraft' : 'Updraft'} {Math.abs(round.gust)}
            </Badge>
          )}
        </div>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-sky-100/80 dark:bg-sky-950/50">
        <svg viewBox="0 0 800 280" className="w-full" role="img" aria-label="Airplane trim scene">
          <line x1="60" y1="140" x2="740" y2="140" strokeDasharray="6 10" strokeWidth="2.5" style={{ stroke: 'var(--accent)' }} opacity="0.7" />
          <text x="70" y="130" fontSize="13" fontWeight="700" style={{ fill: 'var(--accent)' }}>hold this altitude</text>

          {[130, 470, 650].map((x, i) => (
            <motion.g key={x} animate={{ x: [0, -18, 0] }} transition={{ duration: 8 + i * 2, repeat: Infinity, ease: 'easeInOut' }}>
              <ellipse cx={x} cy={40 + i * 12} rx="44" ry="15" className="fill-white/70 dark:fill-white/10" />
            </motion.g>
          ))}

          <motion.g
            animate={{ y: 140 + planeDrift, rotate: planeTilt }}
            transition={{ type: 'spring', stiffness: 90, damping: 14 }}
            style={{ transformOrigin: '400px 140px' }}
          >
            <g transform="translate(400 0)">
              <ellipse cx="0" cy="0" rx="60" ry="15" className="fill-slate-200 dark:fill-slate-300" />
              <path d="M-70 0 h140 l-18 -9 h-104 Z" className="fill-slate-300 dark:fill-slate-400" />
              <path d="M-6 2 l40 20 h20 l-24 -22 Z" style={{ fill: 'var(--accent)' }} />
              <path d="M-56 -2 l-14 -16 h10 l16 14 Z" style={{ fill: 'var(--accent)' }} />
              <circle cx="20" cy="-2" r="4" className="fill-sky-300 dark:fill-sky-600" />
              <circle cx="34" cy="-2" r="4" className="fill-sky-300 dark:fill-sky-600" />
              {stalled && (
                <text x="0" y="-30" textAnchor="middle" fontSize="16" fontWeight="800" className="fill-rose-500 font-display">STALL!</text>
              )}

              {/* level 4 overlay: the four forces */}
              {round.forces && showForces && !stalled && (
                <g strokeLinecap="round" strokeWidth="4">
                  <line x1="0" y1="-16" x2="0" y2={-16 - liftLen} className="stroke-emerald-500" />
                  <text x="6" y={-20 - liftLen} fontSize="11" fontWeight="700" className="fill-emerald-600 font-display dark:fill-emerald-300">lift</text>
                  <line x1="0" y1="16" x2="0" y2={16 + weightLen} className="stroke-stone-600 dark:stroke-stone-300" />
                  <text x="6" y={30 + weightLen} fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-300">weight</text>
                  <line x1="66" y1="0" x2={66 + thrustLen} y2="0" className="stroke-sky-500" />
                  <text x={70 + thrustLen} y="4" fontSize="11" fontWeight="700" className="fill-sky-600 font-display dark:fill-sky-300">thrust</text>
                  <line x1="-66" y1="0" x2={-66 - dragLen} y2="0" className="stroke-rose-500" />
                  <text x={-74 - dragLen} y="4" textAnchor="end" fontSize="11" fontWeight="700" className="fill-rose-600 font-display dark:fill-rose-300">drag</text>
                </g>
              )}
            </g>
          </motion.g>
        </svg>
      </div>

      {/* Readout */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        <p
          className={cn(
            'rounded-xl px-4 py-2.5 text-sm font-semibold',
            wonRound || status === 'level'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
              : status === 'stall'
                ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
          )}
        >
          {wonRound
            ? 'Smooth, level, and sustainable. That is a proper cruise.'
            : status === 'stall'
              ? 'Stalled! The nose got so steep the wing lost its grip on the air.'
              : status === 'climb'
                ? 'Climbing away from the target line. There is more lift than weight right now.'
                : status === 'sink'
                  ? 'Sinking below the line. There is not enough lift to hold the weight up.'
                  : status === 'thirsty'
                    ? `Level, but burning ${burn} against a limit of ${round.fuelCap}. This trim will not reach the destination.`
                    : 'Holding level... steady!'}
        </p>
      </div>

      {/* Fuel gauge */}
      {round.fuelCap !== null && (
        <div className="mt-3">
          <Meter
            label="Fuel flow"
            display={`${burn} of ${round.fuelCap} sustainable`}
            fraction={Math.min(1, burn / (round.fuelCap * 1.4))}
            markerFraction={1 / 1.4}
            barClass={overBurn ? 'bg-rose-500' : 'bg-emerald-500'}
          />
        </div>
      )}

      {/* Cargo picker for level 5 */}
      {round.chooseCargo && (
        <div className="mt-4">
          <p className="mb-2 font-display text-sm font-semibold">Cargo</p>
          <div className="flex flex-wrap gap-2">
            {CARGO.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCargo(c)}
                aria-pressed={cargo === c}
                className={cn(
                  'rounded-full px-4 py-2 font-display text-sm font-semibold transition-colors duration-200',
                  cargo === c
                    ? 'accent-bg text-white shadow-clay'
                    : 'bg-stone-100 text-ink-soft hover:bg-stone-200 dark:bg-white/5 dark:text-stone-400 dark:hover:bg-white/10',
                )}
              >
                {c === 0 ? 'Empty' : `${c} kg`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* A throttle quadrant and a nose you tilt, the way a cockpit works. */}
      <div className="mt-4 grid items-start gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 font-display text-sm font-semibold">
            Throttle <span className="font-normal text-ink-soft dark:text-stone-400">· {throttle}%</span>
          </p>
          <svg viewBox="0 0 240 74" className="w-full max-w-[240px]" role="img" aria-label="Throttle quadrant" {...throttleBind}>
            <rect x="10" y="30" width="220" height="14" rx="7" className="fill-stone-200 dark:fill-white/10" />
            <rect x="10" y="30" width={(throttle / 100) * 220} height="14" rx="7" style={{ fill: 'var(--accent)' }} />
            {[0, 25, 50, 75, 100].map((t) => (
              <line key={t} x1={10 + (t / 100) * 220} y1="48" x2={10 + (t / 100) * 220} y2="54" strokeWidth="2" className="stroke-stone-400 dark:stroke-stone-600" />
            ))}
            <rect
              x={4 + (throttle / 100) * 220}
              y="18"
              width="14"
              height="38"
              rx="5"
              tabIndex={0}
              onKeyDown={nudgeThrottle}
              role="slider"
              aria-label="Throttle"
              aria-valuenow={throttle}
              aria-valuemin={0}
              aria-valuemax={100}
              className="cursor-ew-resize fill-ink outline-none dark:fill-stone-200"
            />
            <text x="120" y="70" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
              push the lever
            </text>
          </svg>
        </div>

        <div>
          <p className="mb-2 font-display text-sm font-semibold">
            Nose angle <span className="font-normal text-ink-soft dark:text-stone-400">· {angle}°</span>
          </p>
          <svg viewBox="0 0 240 74" className="w-full max-w-[240px]" role="img" aria-label="Nose attitude" {...noseBind}>
            <line x1="14" y1="46" x2="226" y2="46" strokeWidth="2" strokeDasharray="5 6" className="stroke-stone-400 dark:stroke-stone-600" />
            <g style={{ transformBox: 'fill-box', transformOrigin: 'center', transform: `rotate(${-angle}deg)` }}>
              <path d="M60 46 L170 38 L186 46 L170 54 Z" style={{ fill: 'var(--accent)' }} />
            </g>
            <circle
              cx="196"
              cy={46 - angle * 1.3}
              r="12"
              tabIndex={0}
              onKeyDown={nudgeNose}
              role="slider"
              aria-label="Nose angle"
              aria-valuenow={angle}
              aria-valuemin={0}
              aria-valuemax={24}
              aria-valuetext={`${angle} degrees nose up`}
              className="cursor-ns-resize fill-ink/25 outline-none dark:fill-white/35"
            />
            <text x="120" y="70" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
              lift the nose
            </text>
          </svg>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-soft dark:text-stone-400">
        Careful with the nose angle: too steep and the wing stalls no matter how fast you go.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={reset} aria-label="Reset the controls">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">
          Weight {weight}{round.fuelCap !== null ? ` · burn ${burn}` : ''}
        </Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ cargo, burn, stall: STALL_ANGLE - angle }}
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
              ? `${cargo} kg delivered at ${burn} burn. Try squeezing on more.`
              : 'Level flight. Passengers happy.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
