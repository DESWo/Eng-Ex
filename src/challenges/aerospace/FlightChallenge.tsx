import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, RotateCcw, Wind } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Slider } from '@/components/ui/Slider'
import type { ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const STALL_ANGLE = 16 // degrees: past this the wing stalls and loses lift
const LIFT_TOLERANCE = 8 // how close lift must match weight (percent points)

interface FlightRound {
  label: string
  weight: number // lift target (arbitrary units)
  /** Sideways gust in lift units. Negative = downdraft. */
  gust: number
}

/** Each win loads the plane heavier or adds rougher air. */
const ROUNDS: FlightRound[] = [
  { label: 'Calm morning hop', weight: 100, gust: 0 },
  { label: 'Heavy cargo run', weight: 145, gust: 0 },
  { label: 'Downdraft over the ridge', weight: 120, gust: -22 },
  { label: 'Full load, gusty', weight: 155, gust: 18 },
]

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

export function FlightChallenge({ onComplete }: ChallengeProps) {
  const [throttle, setThrottle] = useState(50)
  const [angle, setAngle] = useState(6)
  const [roundIndex, setRoundIndex] = useState(0)
  const [wonRound, setWonRound] = useState(false)
  const completedRef = useRef(false)

  const round = ROUNDS[roundIndex % ROUNDS.length]
  const stalled = angle > STALL_ANGLE
  const lift = liftOf(throttle, angle) + round.gust
  const balance = lift - round.weight // >0 climbs, <0 sinks
  const level = Math.abs(balance) <= LIFT_TOLERANCE && !stalled
  const status = stalled ? 'stall' : balance > LIFT_TOLERANCE ? 'climb' : balance < -LIFT_TOLERANCE ? 'sink' : 'level'

  useEffect(() => {
    if (!level || wonRound) return
    const timer = setTimeout(() => {
      setWonRound(true)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, 900)
    return () => clearTimeout(timer)
  }, [level, wonRound, onComplete])

  const nextRound = () => {
    setRoundIndex((i) => i + 1)
    setThrottle(50)
    setAngle(6)
    setWonRound(false)
  }

  const reset = () => {
    setThrottle(50)
    setAngle(6)
    setWonRound(false)
  }

  // Plane pitch and vertical drift for the scene.
  const planeTilt = stalled ? 26 : Math.max(-18, Math.min(18, -balance * 0.4)) * -1
  const planeDrift = stalled ? 70 : Math.max(-46, Math.min(46, -balance * 1.4))

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">
          Trim the plane for level flight. Enough lift to match the weight, but keep the nose below
          the stall angle.
        </p>
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
          {/* target altitude line */}
          <line x1="60" y1="140" x2="740" y2="140" strokeDasharray="6 10" strokeWidth="2.5" style={{ stroke: 'var(--accent)' }} opacity="0.7" />
          <text x="70" y="130" fontSize="13" fontWeight="700" style={{ fill: 'var(--accent)' }}>hold this altitude</text>

          {/* drifting clouds */}
          {[130, 470, 650].map((x, i) => (
            <motion.g key={x} animate={{ x: [0, -18, 0] }} transition={{ duration: 8 + i * 2, repeat: Infinity, ease: 'easeInOut' }}>
              <ellipse cx={x} cy={40 + i * 12} rx="44" ry="15" className="fill-white/70 dark:fill-white/10" />
            </motion.g>
          ))}

          {/* the plane */}
          <motion.g
            animate={{ y: 140 + planeDrift, rotate: planeTilt }}
            transition={{ type: 'spring', stiffness: 90, damping: 14 }}
            style={{ transformOrigin: '400px 140px' }}
          >
            <g transform="translate(400 0)">
              <ellipse cx="0" cy="0" rx="60" ry="15" className="fill-slate-200 dark:fill-slate-300" />
              <path d="M-70 0 h140 l-18 -9 h-104 Z" className="fill-slate-300 dark:fill-slate-400" />
              {/* wing */}
              <path d="M-6 2 l40 20 h20 l-24 -22 Z" style={{ fill: 'var(--accent)' }} />
              {/* tail */}
              <path d="M-56 -2 l-14 -16 h10 l16 14 Z" style={{ fill: 'var(--accent)' }} />
              {/* windows */}
              <circle cx="20" cy="-2" r="4" className="fill-sky-300 dark:fill-sky-600" />
              <circle cx="34" cy="-2" r="4" className="fill-sky-300 dark:fill-sky-600" />
              {stalled && (
                <text x="0" y="-30" textAnchor="middle" fontSize="16" fontWeight="800" className="fill-rose-500 font-display">STALL!</text>
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
            ? 'Smooth and level. That is a happy passenger flight.'
            : status === 'stall'
              ? 'Stalled! The nose is too high, so the wing stopped lifting. Lower the angle.'
              : status === 'climb'
                ? 'Climbing. You have more lift than you need. Ease the nose down or the throttle back.'
                : status === 'sink'
                  ? 'Sinking. Not enough lift. Add throttle or raise the nose a little.'
                  : 'Holding level... steady!'}
        </p>
      </div>

      {/* Controls */}
      <div className="mt-4 grid items-end gap-x-6 gap-y-4 sm:grid-cols-2">
        <Slider label="Throttle (speed)" value={throttle} min={0} max={100} unit="%" onChange={setThrottle} />
        <Slider label="Nose angle" value={angle} min={0} max={24} unit="°" onChange={setAngle} />
      </div>
      <p className="mt-2 text-xs text-ink-soft dark:text-stone-400">
        Careful: past {STALL_ANGLE}° the wing stalls no matter how fast you go.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {wonRound && (
          <Button variant="accent" onClick={nextRound}>
            Next flight
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" onClick={reset} aria-label="Reset the controls">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Round {(roundIndex % ROUNDS.length) + 1}</Badge>
      </div>
    </Card>
  )
}
