import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, RotateCcw, Wind } from 'lucide-react'
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
const GRAVITY = 9.81
const MIN_SPEED = 8 // launch speed in m/s at 0% power
const MAX_SPEED = 30 // launch speed in m/s at 100% power

/** Ammo choices unlocked in level 3. Heavier resists wind but launches slower. */
const AMMO = {
  light: { label: 'Light', mass: 5, speedMul: 1.15, windMul: 1.6 },
  medium: { label: 'Medium', mass: 10, speedMul: 1.0, windMul: 1.0 },
  heavy: { label: 'Heavy', mass: 18, speedMul: 0.85, windMul: 0.5 },
} as const
type AmmoId = keyof typeof AMMO
const AMMO_IDS = Object.keys(AMMO) as AmmoId[]

interface CatapultSetup {
  target: number // meters
  tolerance: number // meters either side that still count
  /** Sideways push in m/s². Negative = headwind, positive = tailwind. */
  wind: number
  /** A wall the boulder must clear, or null. */
  wall: { distance: number; height: number } | null
  /** Shots allowed before the level resets, or null for unlimited. */
  shotLimit: number | null
  /** Level 3 on: the player picks how heavy the boulder is. */
  chooseAmmo: boolean
  /** Level 4 on: the aim preview and velocity arrows are available. */
  vectors: boolean
}

const LEVELS: ChallengeLevel<CatapultSetup>[] = [
  {
    n: 1,
    title: 'First shot',
    phase: 'play',
    concept: 'Angle and power',
    teach: 'Grab the boulder and pull the sling back, like a certain bird game. Pull farther to throw harder, pull lower to throw steeper, and let go to fire. Shoot as many times as you like.',
    setup: { target: 65, tolerance: 6, wind: 0, wall: null, shotLimit: null, chooseAmmo: false, vectors: false },
  },
  {
    n: 2,
    title: 'Three boulders',
    phase: 'understand',
    concept: 'Limited attempts',
    teach: 'You get three shots. Guessing runs out fast, so read where the last one landed and correct from it, the way engineers use a test result.',
    setup: { target: 60, tolerance: 4, wind: 0, wall: null, shotLimit: 3, chooseAmmo: false, vectors: false },
  },
  {
    n: 3,
    title: 'Pick your ammo',
    phase: 'understand',
    concept: 'Mass changes everything',
    teach: 'A light boulder launches faster but the wind shoves it around. A heavy one barely notices the wind but needs far more power to go the same distance.',
    setup: { target: 62, tolerance: 4, wind: 3, wall: null, shotLimit: 4, chooseAmmo: true, vectors: false },
  },
  {
    n: 4,
    title: 'See the forces',
    phase: 'analyze',
    concept: 'Splitting the launch',
    teach: 'Turn on the overlay. Your launch speed splits into a forward part that carries distance and an upward part that buys hang time. That split is why 45 degrees throws farthest.',
    setup: {
      target: 58,
      tolerance: 4,
      wind: -2,
      wall: { distance: 28, height: 12 },
      shotLimit: 4,
      chooseAmmo: true,
      vectors: true,
    },
  },
  {
    n: 5,
    title: 'Siege engineer',
    phase: 'optimize',
    concept: 'Three goals at once',
    teach: 'Clear the wall and hit the camp, but the quartermaster is counting. Fewer shots, less power, lighter ammo. Heavy boulders beat the wind and lose you the other two.',
    setup: {
      target: 55,
      tolerance: 4,
      wind: -3,
      wall: { distance: 30, height: 12 },
      shotLimit: null,
      chooseAmmo: true,
      vectors: true,
    },
    metrics: [
      { id: 'shots', label: 'Shots fired', goal: 'min', target: 3 },
      { id: 'power', label: 'Launch power', goal: 'min', target: 70, unit: '%' },
      { id: 'mass', label: 'Ammo mass', goal: 'min', target: 12, unit: ' kg' },
    ],
  },
]

/* ------------------- scene constants (SVG pixels) ------------------- */
const GROUND_Y = 370
const ORIGIN_X = 90
const PX_PER_M = 6.6
const BOULDER_R = 9
/**
 * You aim like a slingshot: grab the boulder, pull it back and down, and let
 * go. The launch velocity is exactly opposite your pull, so level 4 splitting
 * it into a forward part and an upward part still splits the thing you drew.
 */
const AIM_X = ORIGIN_X
const AIM_Y = GROUND_Y - 44
const MAX_PULLBACK = 80 // sling stretch at full power
const FIRE_MIN = 16 // release closer than this and the sling just relaxes

interface Shot {
  xs: number[]
  ys: number[]
  duration: number
  distance: number
  hitWall: boolean
  /** Where the boulder was released from, so the flight starts in the sling. */
  fromX?: number
  fromY?: number
}

type Verdict = 'short' | 'far' | 'hit' | 'wall'

const messages: Record<Verdict, (d: number) => string> = {
  hit: (d) => `Bullseye! You landed right on the camp at ${d} m.`,
  short: (d) => `Landed short, at ${d} m.`,
  far: (d) => `Overshot, all the way to ${d} m.`,
  wall: () => 'Thunk! The wall knocked it down.',
}

export function CatapultChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('catapult', LEVELS)
  const round = lv.level.setup

  const [angle, setAngle] = useState(45)
  const [power, setPower] = useState(50)
  const [ammoId, setAmmoId] = useState<AmmoId>('medium')
  const [flying, setFlying] = useState(false)
  const [shot, setShot] = useState<Shot | null>(null)
  const [shotId, setShotId] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [result, setResult] = useState<{ distance: number; verdict: Verdict } | null>(null)
  const [impact, setImpact] = useState<{ x: number; y: number; id: number } | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const [pendingLaunch, setPendingLaunch] = useState(false)
  const [beat, setBeat] = useState(false)
  const [showVectors, setShowVectors] = useState(true)
  const completedRef = useRef(false)
  const handledShotRef = useRef(0)
  const flightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ammo = AMMO[round.chooseAmmo ? ammoId : 'medium']
  const outOfShots = round.shotLimit !== null && attempts >= round.shotLimit && !beat

  useEffect(() => () => {
    if (flightTimerRef.current) clearTimeout(flightTimerRef.current)
  }, [])

  /** Every level starts from a clean catapult. */
  useEffect(() => {
    setAngle(45)
    setPower(50)
    setAmmoId('medium')
    setShot(null)
    setResult(null)
    setImpact(null)
    setAttempts(0)
    setCelebrate(false)
    setBeat(false)
    setFlying(false)
  }, [lv.level.n])

  const targetX = ORIGIN_X + round.target * PX_PER_M
  const zoneX = ORIGIN_X + (round.target - round.tolerance) * PX_PER_M
  const zoneW = round.tolerance * 2 * PX_PER_M

  /** Sample a flight path for the given settings. Shared by the preview and the real shot. */
  const simulate = (deg: number, pct: number, id: AmmoId): Shot => {
    const spec = AMMO[round.chooseAmmo ? id : 'medium']
    const speed = (MIN_SPEED + (pct / 100) * (MAX_SPEED - MIN_SPEED)) * spec.speedMul
    const wind = round.wind * spec.windMul
    const radians = (deg * Math.PI) / 180
    const flightTime = (2 * speed * Math.sin(radians)) / GRAVITY

    const steps = 40
    const xs: number[] = []
    const ys: number[] = []
    let hitWall = false
    let distance = 0
    let prevX = 0
    let prevY = 0
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * flightTime
      const x = speed * Math.cos(radians) * t + 0.5 * wind * t * t
      const y = speed * Math.sin(radians) * t - 0.5 * GRAVITY * t * t

      // Only the moment the boulder crosses the wall plane counts. Testing
      // "past the wall and low" instead would also flag a boulder that already
      // sailed over it and is simply coming back down.
      if (round.wall && !hitWall && prevX < round.wall.distance && x >= round.wall.distance) {
        const span = x - prevX
        const frac = span > 0 ? (round.wall.distance - prevX) / span : 0
        const yAtWall = prevY + (y - prevY) * frac
        if (yAtWall < round.wall.height) {
          hitWall = true
          xs.push(ORIGIN_X + round.wall.distance * PX_PER_M - BOULDER_R)
          ys.push(GROUND_Y - Math.max(0, yAtWall) * PX_PER_M - BOULDER_R)
          xs.push(ORIGIN_X + round.wall.distance * PX_PER_M - BOULDER_R)
          ys.push(GROUND_Y - BOULDER_R)
          break
        }
      }

      distance = Math.max(distance, x)
      xs.push(ORIGIN_X + Math.max(0, x) * PX_PER_M)
      ys.push(GROUND_Y - Math.max(0, y) * PX_PER_M - BOULDER_R)
      prevX = x
      prevY = y
    }
    return {
      xs,
      ys,
      duration: Math.min(2.2, Math.max(0.8, flightTime * 0.45)),
      distance,
      hitWall,
    }
  }

  /**
   * Pull the boulder back to aim, slingshot style. The pull is the mirror of
   * the launch: farther back is more power, lower down is a steeper throw.
   */
  const aim = (x: number, y: number, done: boolean) => {
    if (flying || outOfShots) return
    const back = AIM_X - x // how far behind the fork
    const down = y - AIM_Y // how far below it
    const dist = Math.hypot(back, down)
    if (back > 0 && dist >= 6) {
      const deg = Math.max(15, Math.min(75, (Math.atan2(down, back) * 180) / Math.PI))
      setAngle(Math.round(deg))
      setPower(Math.round(Math.min(100, (dist / MAX_PULLBACK) * 100)))
    }
    // Letting go with a real stretch fires; a tiny one just relaxes the sling.
    if (done && back > 0 && dist >= FIRE_MIN) setPendingLaunch(true)
  }
  const { dragging, bind } = useSvgDrag(aim)

  const launch = () => {
    if (flying || outOfShots) return
    const nextShot = { ...simulate(angle, power, ammoId), fromX: pullX, fromY: pullY }
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
    setImpact({
      x: landed.xs[landed.xs.length - 1],
      y: Math.min(landed.ys[landed.ys.length - 1] + BOULDER_R, GROUND_Y),
      id,
    })
    const usedShots = attempts + 1
    setAttempts(usedShots)
    const diff = landed.distance - round.target
    const verdict: Verdict = landed.hitWall
      ? 'wall'
      : Math.abs(diff) <= round.tolerance
        ? 'hit'
        : diff < 0
          ? 'short'
          : 'far'
    setResult({ distance: Math.round(landed.distance), verdict })

    if (verdict !== 'hit') return

    setCelebrate(true)
    setBeat(true)
    lv.clearLevel(
      lv.level.metrics
        ? { shots: usedShots, power, mass: ammo.mass }
        : undefined,
    )
    // Solving any level counts as beating the challenge for the discipline flow.
    if (!completedRef.current) {
      completedRef.current = true
      onComplete()
    }
  }

  // Letting go of the sling is what fires it.
  useEffect(() => {
    if (!pendingLaunch) return
    setPendingLaunch(false)
    launch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLaunch])

  const reset = () => {
    setAngle(45)
    setPower(50)
    setAttempts(0)
    setResult(null)
    setShot(null)
    setImpact(null)
    setCelebrate(false)
    setBeat(false)
  }

  const nudge = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 5 : 1
    if (e.key === 'ArrowUp') setAngle((a) => Math.min(75, a + step))
    else if (e.key === 'ArrowDown') setAngle((a) => Math.max(15, a - step))
    else if (e.key === 'ArrowRight') setPower((p) => Math.min(100, p + step))
    else if (e.key === 'ArrowLeft') setPower((p) => Math.max(0, p - step))
    else if (e.key === 'Enter' || e.key === ' ') launch()
    else return
    e.preventDefault()
  }

  // Where the boulder sits in the stretched sling: mirror of the launch direction.
  const pullLen = (power / 100) * MAX_PULLBACK
  const pullX = AIM_X - Math.cos((angle * Math.PI) / 180) * pullLen
  const pullY = AIM_Y + Math.sin((angle * Math.PI) / 180) * pullLen
  // The two prongs of the fork the elastic bands anchor to.
  const FORK_BACK = { x: ORIGIN_X - 10, y: AIM_Y - 6 }
  const FORK_FRONT = { x: ORIGIN_X + 10, y: AIM_Y - 10 }

  const showTip = attempts >= 3 && !beat
  const wallX = round.wall ? ORIGIN_X + round.wall.distance * PX_PER_M : 0

  // Aim preview and the velocity split, both driven by the live slider values.
  const preview = round.vectors && showVectors && !flying ? simulate(angle, power, ammoId) : null
  const previewSpeed = (MIN_SPEED + (power / 100) * (MAX_SPEED - MIN_SPEED)) * ammo.speedMul
  const vx = previewSpeed * Math.cos((angle * Math.PI) / 180)
  const vy = previewSpeed * Math.sin((angle * Math.PI) / 180)
  const VEC = 3.4 // pixels per m/s, tuned so arrows stay inside the scene

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {celebrate && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={
          round.vectors ? (
            <InsightToggle label="forces" on={showVectors} onChange={setShowVectors} />
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft dark:text-stone-400">
          Pull the boulder back, let it fly, and land it on the enemy camp.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {round.shotLimit !== null && (
            <Badge
              className={cn(
                'px-4 py-1.5 text-sm',
                outOfShots
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300'
                  : 'bg-stone-100 text-ink-soft dark:bg-white/10 dark:text-stone-300',
              )}
            >
              {Math.max(0, round.shotLimit - attempts)} left
            </Badge>
          )}
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
        <svg viewBox="0 0 800 420" className="w-full" role="img" aria-label="Catapult scene" {...bind}>
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

          {/* target zone + enemy camp (it jumps when you flatten it) */}
          <rect x={zoneX} y={GROUND_Y - 5} width={zoneW} height="10" rx="5" style={{ fill: 'var(--accent)' }} opacity="0.85" />
          <motion.g
            animate={result?.verdict === 'hit' ? { y: [0, -16, 0], x: [0, 4, 0] } : { y: 0, x: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            <path d={`M${targetX - 20} ${GROUND_Y} L${targetX} ${GROUND_Y - 34} L${targetX + 20} ${GROUND_Y} Z`} className="fill-stone-500 dark:fill-stone-400" />
            <line x1={targetX} y1={GROUND_Y - 34} x2={targetX} y2={GROUND_Y - 52} className="stroke-stone-500 dark:stroke-stone-400" strokeWidth="2" />
            <path d={`M${targetX} ${GROUND_Y - 52} l14 4 l-14 4 Z`} style={{ fill: 'var(--accent)' }} />
          </motion.g>
          <text x={targetX} y={GROUND_Y - 62} textAnchor="middle" fontSize="15" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-300">
            {round.target} m
          </text>

          {/* level 4 overlay: where this shot would land, before firing */}
          {preview && (
            <polyline
              points={preview.xs.map((x, i) => `${x},${preview.ys[i]}`).join(' ')}
              fill="none"
              className="stroke-ink-soft dark:stroke-stone-400"
              strokeWidth="2"
              strokeDasharray="6 8"
              strokeLinecap="round"
              opacity="0.5"
            />
          )}

          {/* the slingshot: wheeled base, Y-fork, and the back elastic band */}
          <g>
            <rect x={ORIGIN_X - 26} y={GROUND_Y - 26} width="60" height="12" rx="5" className="fill-amber-800 dark:fill-amber-700" />
            <circle cx={ORIGIN_X - 16} cy={GROUND_Y - 9} r="9" className="fill-stone-600 dark:fill-stone-400" />
            <circle cx={ORIGIN_X + 24} cy={GROUND_Y - 9} r="9" className="fill-stone-600 dark:fill-stone-400" />
            <path
              d={`M${ORIGIN_X} ${GROUND_Y - 22} V${AIM_Y + 12} M${ORIGIN_X} ${AIM_Y + 12} L${FORK_BACK.x} ${FORK_BACK.y} M${ORIGIN_X} ${AIM_Y + 12} L${FORK_FRONT.x} ${FORK_FRONT.y}`}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className="stroke-amber-700 dark:stroke-amber-600"
            />
          </g>
          {!flying && (
            <line
              x1={FORK_BACK.x}
              y1={FORK_BACK.y}
              x2={pullX}
              y2={pullY}
              strokeWidth="5"
              strokeLinecap="round"
              className="stroke-amber-950/70 dark:stroke-amber-900"
            />
          )}

          {/* level 4 overlay: the launch speed split into its two parts */}
          {preview && (
            <g strokeLinecap="round">
              <marker id="cat-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M0 0 L10 5 L0 10 z" style={{ fill: 'var(--accent)' }} />
              </marker>
              {/* forward part: carries distance */}
              <line
                x1={ORIGIN_X}
                y1={GROUND_Y - 40}
                x2={ORIGIN_X + vx * VEC}
                y2={GROUND_Y - 40}
                style={{ stroke: 'var(--accent)' }}
                strokeWidth="3.5"
                markerEnd="url(#cat-arrow)"
              />
              <text x={ORIGIN_X + vx * VEC + 8} y={GROUND_Y - 44} fontSize="13" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-300">
                forward
              </text>
              {/* upward part: buys hang time */}
              <line
                x1={ORIGIN_X}
                y1={GROUND_Y - 40}
                x2={ORIGIN_X}
                y2={GROUND_Y - 40 - vy * VEC}
                style={{ stroke: 'var(--accent)' }}
                strokeWidth="3.5"
                markerEnd="url(#cat-arrow)"
              />
              <text x={ORIGIN_X + 8} y={GROUND_Y - 46 - vy * VEC} fontSize="13" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-300">
                up
              </text>
            </g>
          )}

          {/* while stretching: the first stretch of the flight, as fading dots */}
          {dragging && !flying && !preview && power >= 10 && (() => {
            const peek = simulate(angle, power, ammoId)
            return (
              <g className="pointer-events-none">
                {peek.xs.slice(1, 9).map((x, i) => (
                  <circle key={i} cx={x} cy={peek.ys[i + 1]} r={3.4 - i * 0.28} className="fill-ink/50 dark:fill-white/50" opacity={1 - i * 0.11} />
                ))}
              </g>
            )
          })()}

          {/* the boulder in the sling: grab it, pull back, let go */}
          {!flying && (
            <g>
              <circle
                cx={pullX}
                cy={pullY}
                r={(BOULDER_R + 3) * (ammo.mass >= 18 ? 1.25 : ammo.mass <= 5 ? 0.78 : 1)}
                tabIndex={0}
                onKeyDown={nudge}
                role="slider"
                aria-label="Slingshot aim. Up and down change the angle, left and right change the power. Enter fires."
                aria-valuetext={`${angle} degrees at ${power} percent power`}
                aria-valuenow={angle}
                aria-valuemin={15}
                aria-valuemax={75}
                className={cn(
                  'cursor-grab outline-none',
                  dragging ? 'cursor-grabbing fill-stone-800 dark:fill-stone-200' : 'fill-stone-700 dark:fill-stone-300',
                )}
                style={{ filter: dragging ? 'brightness(1.15)' : undefined }}
              />
              <circle cx={pullX} cy={pullY} r={BOULDER_R + 12} className="pointer-events-none fill-none stroke-ink/25 dark:stroke-white/25" strokeWidth="1.5" strokeDasharray="3 4" />
              {/* front band, over the boulder like a real sling pouch */}
              <line
                x1={FORK_FRONT.x}
                y1={FORK_FRONT.y}
                x2={pullX}
                y2={pullY}
                strokeWidth="5"
                strokeLinecap="round"
                className="pointer-events-none stroke-amber-950 dark:stroke-amber-800"
              />
            </g>
          )}

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

          {/* the boulder: snaps out of the sling, then flies the arc */}
          {shot && (
            <motion.circle
              key={shotId}
              r={BOULDER_R * (ammo.mass >= 18 ? 1.25 : ammo.mass <= 5 ? 0.78 : 1)}
              className="fill-stone-700 dark:fill-stone-300"
              initial={{ cx: shot.fromX ?? shot.xs[0], cy: shot.fromY ?? shot.ys[0] }}
              animate={{
                cx: [shot.fromX ?? shot.xs[0], ...shot.xs],
                cy: [shot.fromY ?? shot.ys[0], ...shot.ys],
              }}
              transition={{ duration: shot.duration, ease: 'linear' }}
              onAnimationComplete={() => finishFlight(shotId, shot)}
            />
          )}

          {/* dust where the last shot came down */}
          {impact && !flying && (
            <g className="pointer-events-none">
              {[0, 1, 2].map((i) => (
                <motion.circle
                  key={`${impact.id}-${i}`}
                  cx={impact.x + (i - 1) * 11}
                  cy={impact.y}
                  initial={{ r: 2, opacity: 0.6 }}
                  animate={{ r: 13 + i * 3, opacity: 0 }}
                  transition={{ duration: 0.7, delay: i * 0.06 }}
                  className="fill-stone-400 dark:fill-stone-500"
                />
              ))}
            </g>
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
          </motion.p>
        )}
        {!result && showTip && (
          <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-300">
            Stuck? Change just one thing at a time, angle or power, and watch how the landing spot moves. That is how engineers zero in.
          </p>
        )}
        {outOfShots && (
          <p className="mt-2 rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Out of boulders. Hit reset to get a fresh supply and try a different opening guess.
          </p>
        )}
      </div>

      {/* Ammo picker, unlocked in level 3 */}
      {round.chooseAmmo && (
        <div className="mt-4">
          <p className="mb-2 font-display text-sm font-semibold">Boulder</p>
          <div className="flex flex-wrap gap-2">
            {AMMO_IDS.map((id) => {
              const spec = AMMO[id]
              const active = ammoId === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAmmoId(id)}
                  aria-pressed={active}
                  disabled={flying}
                  className={cn(
                    'rounded-2xl px-4 py-2.5 text-left font-display text-sm font-semibold transition-colors duration-200',
                    active
                      ? 'accent-bg text-white shadow-clay'
                      : 'bg-stone-100 text-ink-soft hover:bg-stone-200 dark:bg-white/5 dark:text-stone-400 dark:hover:bg-white/10',
                  )}
                >
                  <span className="block">{spec.label}</span>
                  <span className={cn('block text-xs font-medium', active ? 'text-white/80' : 'opacity-70')}>
                    {spec.mass} kg
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Aim readout. The aiming itself happens by dragging the sling. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-stone-100 px-4 py-2 font-display text-sm font-semibold tabular-nums dark:bg-white/5">
          Angle <span className="accent-text font-bold">{angle}°</span>
        </span>
        <span className="rounded-full bg-stone-100 px-4 py-2 font-display text-sm font-semibold tabular-nums dark:bg-white/5">
          Power <span className="accent-text font-bold">{power}%</span>
        </span>
        <span className="text-sm text-ink-soft dark:text-stone-400">
          Grab the boulder, stretch the sling back, and release to fire. Arrow keys work too.
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={launch} disabled={flying || outOfShots}>
          <Play className="h-5 w-5" fill="currentColor" />
          {flying ? 'Flying...' : 'Launch!'}
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Reset the catapult">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Shots: {attempts}</Badge>
      </div>

      {/* Level 5 scorecard */}
      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ shots: attempts, power, mass: ammo.mass }}
            best={lv.best}
            scored={beat}
          />
        </div>
      )}

      {beat && (
        <LevelComplete
          lv={lv}
          message={
            lv.level.metrics
              ? `Camp destroyed in ${attempts} ${attempts === 1 ? 'shot' : 'shots'}. Try to beat your own numbers.`
              : 'Direct hit. On to the next one.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
