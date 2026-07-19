import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, RotateCcw, Wind } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Slider } from '@/components/ui/Slider'
import { Badge } from '@/components/ui/Badge'
import type { ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const GRAVITY = 9.81
const MIN_SPEED = 8 // launch speed in m/s at 0% power
const MAX_SPEED = 30 // launch speed in m/s at 100% power

interface CatapultRound {
  label: string
  target: number // meters
  tolerance: number // meters either side that still count
  /** Sideways push in m/s². Negative = headwind, positive = tailwind. */
  wind: number
  /** A wall the boulder must clear, or null. */
  wall: { distance: number; height: number } | null
}

/** Each bullseye brings a trickier shot. */
const ROUNDS: CatapultRound[] = [
  { label: 'Warm-up shot', target: 65, tolerance: 4, wind: 0, wall: null },
  { label: 'Over the wall', target: 48, tolerance: 4, wind: 0, wall: { distance: 30, height: 14 } },
  { label: 'Headwind', target: 60, tolerance: 4, wind: -3, wall: null },
  { label: 'Tailwind trouble', target: 55, tolerance: 3, wind: 4, wall: null },
  { label: 'The gauntlet', target: 70, tolerance: 3, wind: -2, wall: { distance: 40, height: 16 } },
]

/* ------------------- scene constants (SVG pixels) ------------------- */
const GROUND_Y = 370
const ORIGIN_X = 70
const PX_PER_M = 6.6
const BOULDER_R = 9

interface Shot {
  xs: number[]
  ys: number[]
  duration: number
  distance: number
  hitWall: boolean
}

type Verdict = 'short' | 'far' | 'hit' | 'wall'

const messages: Record<Verdict, (d: number) => string> = {
  hit: (d) => `Bullseye! You landed right on the camp at ${d} m.`,
  short: (d) => `Too short! It landed at ${d} m. Add power, or flatten the angle a touch.`,
  far: (d) => `Too far! It flew to ${d} m. Ease off the power a little.`,
  wall: () => 'Thunk! The wall caught it. Arc higher to clear it.',
}

export function CatapultChallenge({ onComplete }: ChallengeProps) {
  const [angle, setAngle] = useState(45)
  const [power, setPower] = useState(50)
  const [flying, setFlying] = useState(false)
  const [shot, setShot] = useState<Shot | null>(null)
  const [shotId, setShotId] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [roundIndex, setRoundIndex] = useState(0)
  const [result, setResult] = useState<{ distance: number; verdict: Verdict } | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const completedRef = useRef(false)
  const handledShotRef = useRef(0)
  const flightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (flightTimerRef.current) clearTimeout(flightTimerRef.current)
  }, [])

  const round = ROUNDS[roundIndex % ROUNDS.length]
  const targetX = ORIGIN_X + round.target * PX_PER_M
  const zoneX = ORIGIN_X + (round.target - round.tolerance) * PX_PER_M
  const zoneW = round.tolerance * 2 * PX_PER_M

  const launch = () => {
    if (flying) return
    const speed = MIN_SPEED + (power / 100) * (MAX_SPEED - MIN_SPEED)
    const radians = (angle * Math.PI) / 180
    const flightTime = (2 * speed * Math.sin(radians)) / GRAVITY

    // Sample the flight path. Wind bends it sideways as it flies.
    const steps = 40
    const xs: number[] = []
    const ys: number[] = []
    let hitWall = false
    let distance = 0
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * flightTime
      const x = speed * Math.cos(radians) * t + 0.5 * round.wind * t * t
      const y = speed * Math.sin(radians) * t - 0.5 * GRAVITY * t * t
      if (round.wall && !hitWall && x >= round.wall.distance && y < round.wall.height) {
        // The boulder smacks the wall and drops straight down.
        hitWall = true
        xs.push(ORIGIN_X + round.wall.distance * PX_PER_M - BOULDER_R)
        ys.push(GROUND_Y - Math.max(0, y) * PX_PER_M - BOULDER_R)
        xs.push(ORIGIN_X + round.wall.distance * PX_PER_M - BOULDER_R)
        ys.push(GROUND_Y - BOULDER_R)
        break
      }
      distance = Math.max(distance, x)
      xs.push(ORIGIN_X + Math.max(0, x) * PX_PER_M)
      ys.push(GROUND_Y - Math.max(0, y) * PX_PER_M - BOULDER_R)
    }

    const nextShot: Shot = {
      xs,
      ys,
      duration: Math.min(2.2, Math.max(0.8, flightTime * 0.45)),
      distance,
      hitWall,
    }
    const id = shotId + 1
    setShot(nextShot)
    setShotId(id)
    setResult(null)
    setFlying(true)
    // Fallback in case the browser throttles the animation (hidden tab, etc).
    if (flightTimerRef.current) clearTimeout(flightTimerRef.current)
    flightTimerRef.current = setTimeout(() => finishFlight(id, nextShot), nextShot.duration * 1000 + 400)
  }

  /** Land the verdict exactly once per shot, even if the animation stalls. */
  const finishFlight = (id: number, landed: Shot) => {
    if (handledShotRef.current === id) return
    handledShotRef.current = id
    setFlying(false)
    setAttempts((a) => a + 1)
    const diff = landed.distance - round.target
    const verdict: Verdict = landed.hitWall
      ? 'wall'
      : Math.abs(diff) <= round.tolerance
        ? 'hit'
        : diff < 0
          ? 'short'
          : 'far'
    setResult({ distance: Math.round(landed.distance), verdict })
    if (verdict === 'hit') {
      setCelebrate(true)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }
  }

  const nextRound = () => {
    setRoundIndex((i) => i + 1)
    setResult(null)
    setShot(null)
    setCelebrate(false)
  }

  // The next mission marches in shortly after every bullseye.
  useEffect(() => {
    if (result?.verdict !== 'hit') return
    const timer = setTimeout(nextRound, 2400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  const reset = () => {
    setAngle(45)
    setPower(50)
    setAttempts(0)
    setResult(null)
    setShot(null)
    setCelebrate(false)
  }

  const showTip = attempts >= 3 && result?.verdict !== 'hit'
  const wallX = round.wall ? ORIGIN_X + round.wall.distance * PX_PER_M : 0

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {celebrate && <Confetti />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft dark:text-stone-400">
          Set the angle and power, then launch. Land the boulder on the enemy camp.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
          {round.wind !== 0 && (
            <Badge
              className={cn(
                'px-4 py-1.5 text-sm',
                round.wind < 0
                  ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
              )}
            >
              <Wind className="mr-1 h-4 w-4" />
              {round.wind < 0 ? '←' : '→'} Wind {Math.abs(round.wind)}
            </Badge>
          )}
        </div>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-sky-100/70 dark:bg-sky-950/40">
        <svg viewBox="0 0 800 420" className="w-full" role="img" aria-label="Catapult scene">
          {/* clouds */}
          <ellipse cx="200" cy="70" rx="46" ry="16" className="fill-white/70 dark:fill-white/10" />
          <ellipse cx="240" cy="82" rx="34" ry="13" className="fill-white/70 dark:fill-white/10" />
          <ellipse cx="600" cy="50" rx="52" ry="17" className="fill-white/70 dark:fill-white/10" />

          {/* ground */}
          <rect x="0" y={GROUND_Y} width="800" height="50" className="fill-emerald-200 dark:fill-emerald-950" />
          <rect x="0" y={GROUND_Y} width="800" height="5" className="fill-emerald-300 dark:fill-emerald-900" />

          {/* castle we are defending */}
          <g className="fill-stone-300 dark:fill-stone-700">
            <rect x="4" y={GROUND_Y - 90} width="18" height="90" />
            <rect x="30" y={GROUND_Y - 70} width="16" height="70" />
            <rect x="0" y={GROUND_Y - 98} width="26" height="10" />
          </g>
          <path d={`M13 ${GROUND_Y - 112} l16 5 l-16 5 Z`} className="fill-rose-400" />
          <line x1="13" y1={GROUND_Y - 112} x2="13" y2={GROUND_Y - 98} className="stroke-stone-400" strokeWidth="2" />

          {/* the wall to clear */}
          {round.wall && (
            <g>
              <rect
                x={wallX - 7}
                y={GROUND_Y - round.wall.height * PX_PER_M}
                width="14"
                height={round.wall.height * PX_PER_M}
                rx="3"
                className="fill-stone-500 dark:fill-stone-500"
              />
              {[0.25, 0.5, 0.75].map((frac) => (
                <line
                  key={frac}
                  x1={wallX - 7}
                  y1={GROUND_Y - round.wall!.height * PX_PER_M * frac}
                  x2={wallX + 7}
                  y2={GROUND_Y - round.wall!.height * PX_PER_M * frac}
                  className="stroke-stone-400 dark:stroke-stone-600"
                  strokeWidth="2"
                />
              ))}
            </g>
          )}

          {/* target zone + enemy camp */}
          <rect x={zoneX} y={GROUND_Y - 5} width={zoneW} height="10" rx="5" style={{ fill: 'var(--accent)' }} opacity="0.85" />
          <path d={`M${targetX - 20} ${GROUND_Y} L${targetX} ${GROUND_Y - 34} L${targetX + 20} ${GROUND_Y} Z`} className="fill-stone-500 dark:fill-stone-400" />
          <line x1={targetX} y1={GROUND_Y - 34} x2={targetX} y2={GROUND_Y - 52} className="stroke-stone-500 dark:stroke-stone-400" strokeWidth="2" />
          <path d={`M${targetX} ${GROUND_Y - 52} l14 4 l-14 4 Z`} style={{ fill: 'var(--accent)' }} />
          <text x={targetX} y={GROUND_Y - 62} textAnchor="middle" fontSize="15" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-300">
            {round.target} m
          </text>

          {/* catapult */}
          <g>
            <rect
              x={ORIGIN_X - 18}
              y={GROUND_Y - 46}
              width="52"
              height="9"
              rx="4"
              className="fill-amber-700 dark:fill-amber-600"
              style={{
                transformBox: 'fill-box',
                transformOrigin: 'left bottom',
                transform: `rotate(${flying ? -60 : -28}deg)`,
                transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            />
            <rect x={ORIGIN_X - 26} y={GROUND_Y - 26} width="60" height="12" rx="5" className="fill-amber-800 dark:fill-amber-700" />
            <circle cx={ORIGIN_X - 16} cy={GROUND_Y - 9} r="9" className="fill-stone-600 dark:fill-stone-400" />
            <circle cx={ORIGIN_X + 24} cy={GROUND_Y - 9} r="9" className="fill-stone-600 dark:fill-stone-400" />
          </g>

          {/* flight trail after landing */}
          {shot && !flying && (
            <polyline
              points={shot.xs.map((x, i) => `${x},${shot.ys[i]}`).join(' ')}
              fill="none"
              style={{ stroke: 'var(--accent)' }}
              strokeWidth="2.5"
              strokeDasharray="1 10"
              strokeLinecap="round"
              opacity="0.6"
            />
          )}

          {/* the boulder */}
          {shot && (
            <motion.circle
              key={shotId}
              r={BOULDER_R}
              className="fill-stone-700 dark:fill-stone-300"
              initial={{ cx: shot.xs[0], cy: shot.ys[0] }}
              animate={{ cx: shot.xs, cy: shot.ys }}
              transition={{ duration: shot.duration, ease: 'linear' }}
              onAnimationComplete={() => finishFlight(shotId, shot)}
            />
          )}
        </svg>
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        {result && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'rounded-xl px-4 py-2.5 text-sm font-semibold',
              result.verdict === 'hit'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
            )}
          >
            {messages[result.verdict](result.distance)}
            {result.verdict === 'hit' && ' Next mission incoming...'}
          </motion.p>
        )}
        {!result && showTip && (
          <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-300">
            Engineer's tip: 45 degrees flies farthest in calm air. Walls want a higher arc. Wind wants extra power or less.
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 grid items-end gap-x-6 gap-y-4 sm:grid-cols-2">
        <Slider label="Angle" value={angle} min={15} max={75} unit="°" onChange={setAngle} disabled={flying} />
        <Slider label="Power" value={power} min={0} max={100} unit="%" onChange={setPower} disabled={flying} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={launch} disabled={flying}>
          <Play className="h-5 w-5" fill="currentColor" />
          {flying ? 'Flying...' : 'Launch!'}
        </Button>
        {result?.verdict === 'hit' && (
          <Button variant="soft" onClick={nextRound}>
            Next mission
          </Button>
        )}
        <Button variant="ghost" onClick={reset} aria-label="Reset the catapult">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Attempts: {attempts}</Badge>
      </div>
    </Card>
  )
}
