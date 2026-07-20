import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
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
/** Everything is in Earth radii with mu = 1, then converted for display. */
const R_START = 1.05 // parking orbit, about 320 km up
const SPEED_SCALE = 7900 // our speed unit -> m/s
const EARTH_KM = 6371
const MAX_BURN = 1200 // m/s per burn
const PULSE = 25 // one press of the engine

const vCirc = (r: number) => Math.sqrt(1 / r)
const V_START = vCirc(R_START)
const toKm = (r: number) => (r - 1) * EARTH_KM

type BurnDir = 'prograde' | 'radial' | 'retrograde'

const BURN_DIRS: { id: BurnDir; label: string; note: string }[] = [
  { id: 'prograde', label: 'Forwards', note: 'Along the direction of travel' },
  { id: 'radial', label: 'Outwards', note: 'Straight up, away from Earth' },
  { id: 'retrograde', label: 'Backwards', note: 'Against the direction of travel' },
]

interface Orbit {
  fail: null | 'escape' | 'crash' | 'no-burn'
  /** Radius the transfer ellipse reaches, before the second burn. */
  rApo: number
  apo: number
  peri: number
  /** 0 is a perfect circle. */
  e: number
  /** Which way periapsis points, so the drawn ellipse sits correctly. */
  omega: number
}

/**
 * Burn once at the parking orbit, then once at the top of the resulting ellipse.
 *
 * The first burn can point any way, which is the whole point of level 1: firing
 * outwards feels like the way to climb, but it barely lifts the far side and it
 * drags the near side down into the atmosphere. Only a forward burn adds the
 * energy that actually raises an orbit.
 */
function computeOrbit(burn1: number, dir: BurnDir, burn2: number): Orbit {
  const blank = { rApo: R_START, apo: R_START, peri: R_START, e: 0, omega: 0 }
  const dv = burn1 / SPEED_SCALE
  let vt = V_START
  let vr = 0
  if (dir === 'prograde') vt += dv
  else if (dir === 'retrograde') vt -= dv
  else vr = dv

  const vSq = vt * vt + vr * vr
  if (vSq >= 2 / R_START) return { fail: 'escape', ...blank }
  if (burn1 <= 0) return { fail: 'no-burn', ...blank }

  const a1 = 1 / (2 / R_START - vSq)
  const h = R_START * vt // angular momentum, untouched by a purely outward burn
  const energy = vSq / 2 - 1 / R_START
  const e1 = Math.sqrt(Math.max(0, 1 + 2 * energy * h * h))
  const rApo = a1 * (1 + e1)
  const rPeri = a1 * (1 - e1)

  // Where periapsis ends up, from the eccentricity vector.
  const ex = R_START * vSq - 1 - R_START * vr * vr
  const ey = -R_START * vr * vt
  const omega = Math.atan2(ey, ex)

  if (rPeri < 1.0) return { fail: 'crash', rApo, apo: rApo, peri: rPeri, e: e1, omega }

  // Second burn happens at the top, where the velocity is purely sideways.
  const vApo = h / rApo
  const v2 = vApo + burn2 / SPEED_SCALE
  if (v2 >= Math.sqrt(2 / rApo)) return { fail: 'escape', ...blank, rApo }

  const a2 = 1 / (2 / rApo - v2 * v2)
  const other = 2 * a2 - rApo
  const apo = Math.max(rApo, other)
  const peri = Math.min(rApo, other)
  const e2 = Math.abs(rApo * v2 * v2 - 1)
  if (peri < 1.0) return { fail: 'crash', rApo, apo, peri, e: e2, omega }

  return { fail: null, rApo, apo, peri, e: e2, omega }
}

interface OrbitSetup {
  /** Radius the mission is aiming for. */
  target: number
  /** How close the high point has to be, in km. */
  tolKm: number
  /** Level 3 on: the circularising burn is available. */
  secondBurn: boolean
  /** Max eccentricity accepted, or null when only altitude matters. */
  maxE: number | null
  /** Fuel budget in m/s, or null. */
  fuel: number | null
  /** Which burn directions are on offer. */
  dirs: BurnDir[]
  /** Level 4 on: the orbit readout is available. */
  readout: boolean
  brief: string
}

const LEVELS: ChallengeLevel<OrbitSetup>[] = [
  {
    n: 1,
    title: 'Which way is up?',
    phase: 'play',
    concept: 'Forwards, not upwards',
    teach: 'To climb, the obvious move is to fire the engine downwards and push yourself up. Try it, and watch what happens to the other side of your orbit. Then try firing forwards instead.',
    setup: { target: 1.4, tolKm: 400, secondBurn: false, maxE: null, fuel: null, dirs: ['prograde', 'radial', 'retrograde'], readout: false, brief: 'Your satellite is parked low. Get the far side of its orbit out to the marked ring.' },
  },
  {
    n: 2,
    title: 'One tank',
    phase: 'understand',
    concept: 'Fuel is finite',
    teach: 'Nothing refuels in orbit, so the whole mission is planned around one fixed budget of speed change. A wasteful direction will not reach this ring at all, however hard you push.',
    setup: { target: 1.6, tolKm: 400, secondBurn: false, maxE: null, fuel: 800, dirs: ['prograde', 'radial', 'retrograde'], readout: false, brief: 'A higher ring, and the upper stage has only so much left in it.' },
  },
  {
    n: 3,
    title: 'It keeps falling back',
    phase: 'understand',
    concept: 'Reaching is not staying',
    teach: 'Touching the ring once is not an orbit: you fall straight back to where you started. A second burn at the top raises the low side to match, which is what actually parks you there.',
    setup: { target: 1.5, tolKm: 250, secondBurn: true, maxE: 0.05, fuel: null, dirs: ['prograde'], readout: false, brief: 'Mission control wants the satellite to STAY at the ring, not just visit it once per lap.' },
  },
  {
    n: 4,
    title: 'Read the orbit',
    phase: 'analyze',
    concept: 'High point and low point',
    teach: 'Turn on the readout. Every orbit is described by its high point, its low point, and how far from a circle it is. Watch all three move as you adjust each burn.',
    setup: { target: 1.7, tolKm: 250, secondBurn: true, maxE: 0.05, fuel: null, dirs: ['prograde'], readout: true, brief: 'A survey satellite headed further out, with the full orbital readout switched on.' },
  },
  {
    n: 5,
    title: 'Comms satellite',
    phase: 'optimize',
    concept: 'High, round, or cheap',
    teach: 'A higher orbit sees more of the planet, a rounder one keeps the signal steady, and both cost fuel. Getting high is cheap if you accept a lopsided orbit. Pick your compromise.',
    setup: { target: 1.6, tolKm: 9999, secondBurn: true, maxE: 0.35, fuel: null, dirs: ['prograde'], readout: true, brief: 'Park a communications satellite as high and as round as the tank allows.' },
    metrics: [
      { id: 'fuel', label: 'Fuel spent', goal: 'min', target: 1450, unit: ' m/s' },
      { id: 'round', label: 'Roundness', goal: 'min', target: 0.03 },
      { id: 'alt', label: 'High point', goal: 'max', target: 4000, unit: ' km' },
    ],
  },
]

/* ------------------- scene constants (SVG pixels) ------------------- */
const CX = 400
const CY = 215
const PXR = 92 // pixels per Earth radius

/** Points around an orbit, rotated so periapsis sits where the maths puts it. */
function ellipsePoints(peri: number, apo: number, omega = 0, n = 120) {
  const a = (peri + apo) / 2
  const c = (apo - peri) / 2
  const b = Math.sqrt(Math.max(0, a * a - c * c))
  const cos = Math.cos(omega)
  const sin = Math.sin(omega)
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2
    // Built around the focus at the origin, then spun to the right angle.
    const x = a * Math.cos(t) - c
    const y = b * Math.sin(t)
    pts.push([CX + (x * cos - y * sin) * PXR, CY + (x * sin + y * cos) * PXR])
  }
  return pts
}

export function OrbitChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('orbit', LEVELS)
  const setup = lv.level.setup

  const [burn1, setBurn1] = useState(0)
  const [burn2, setBurn2] = useState(0)
  const [dir, setDir] = useState<BurnDir>('prograde')
  const [won, setWon] = useState(false)
  const [showReadout, setShowReadout] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    setBurn1(0)
    setBurn2(0)
    // Levels that still offer the choice start on the tempting wrong answer.
    setDir(setup.dirs.length > 1 ? 'radial' : 'prograde')
    setWon(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lv.level.n])

  const b2 = setup.secondBurn ? burn2 : 0
  const burnDir = setup.dirs.includes(dir) ? dir : setup.dirs[0]
  const orbit = computeOrbit(burn1, burnDir, b2)
  const fuel = burn1 + b2
  const targetKm = toKm(setup.target)
  const apoKm = toKm(orbit.apo)
  const periKm = toKm(orbit.peri)
  const altError = Math.abs(apoKm - targetKm)

  const overFuel = setup.fuel !== null && fuel > setup.fuel
  const solved =
    !orbit.fail &&
    !overFuel &&
    altError <= setup.tolKm &&
    (setup.maxE === null || orbit.e <= setup.maxE) &&
    // Level 5 has no altitude window, but still needs a genuine orbit.
    (lv.level.metrics ? apoKm >= 1500 : true)

  useEffect(() => {
    if (!solved || won) return
    const timer = setTimeout(() => {
      setWon(true)
      lv.clearLevel(lv.level.metrics ? { fuel, round: orbit.e, alt: apoKm } : undefined)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, won, fuel, orbit.e, apoKm])

  const reset = () => {
    setBurn1(0)
    setBurn2(0)
    setWon(false)
  }

  const transfer = ellipsePoints(R_START, Math.max(R_START, orbit.rApo), orbit.omega)
  const final = ellipsePoints(orbit.peri, orbit.apo, orbit.omega)
  const showFinal = setup.secondBurn && b2 > 0 && !orbit.fail

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.readout ? <InsightToggle label="orbit readout" on={showReadout} onChange={setShowReadout} /> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        {setup.tolKm < 9999 && (
          <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
            Target {Math.round(targetKm).toLocaleString()} km
          </Badge>
        )}
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-slate-900 dark:bg-slate-950">
        <svg viewBox="0 0 800 430" className="w-full" role="img" aria-label="Orbit around Earth">
          {/* stars */}
          {[
            [70, 40], [180, 90], [300, 30], [520, 60], [640, 110], [730, 45],
            [110, 330], [260, 390], [560, 370], [690, 300], [400, 410], [40, 200],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1.1} className="fill-white/60" />
          ))}

          {/* target ring */}
          {setup.tolKm < 9999 && (
            <circle
              cx={CX}
              cy={CY}
              r={setup.target * PXR}
              fill="none"
              strokeWidth="2"
              strokeDasharray="7 9"
              className="stroke-emerald-400/70"
            />
          )}

          {/* transfer ellipse, and the final orbit once the second burn is in */}
          {orbit.fail !== 'escape' && orbit.fail !== 'no-burn' && (
            <polyline
              points={transfer.map(([x, y]) => `${x},${y}`).join(' ')}
              fill="none"
              strokeWidth="2"
              strokeDasharray={showFinal ? '5 7' : undefined}
              className="stroke-white/45"
            />
          )}
          {showFinal && (
            <polyline
              points={final.map(([x, y]) => `${x},${y}`).join(' ')}
              fill="none"
              strokeWidth="2.5"
              style={{ stroke: 'var(--accent)' }}
            />
          )}

          {/* Earth */}
          <circle cx={CX} cy={CY} r={PXR} className="fill-sky-800" />
          <circle cx={CX} cy={CY} r={PXR} className="fill-none stroke-sky-400/40" strokeWidth="2" />
          <path d={`M${CX - 52} ${CY - 30} q26 -12 50 4 q-18 22 -50 -4 Z`} className="fill-emerald-700/80" />
          <path d={`M${CX + 6} ${CY + 18} q30 -14 52 6 q-24 24 -52 -6 Z`} className="fill-emerald-700/80" />

          {/* the satellite, riding whichever orbit is current */}
          {!orbit.fail && (
            <motion.circle
              key={`${showFinal ? 'f' : 't'}-${Math.round(orbit.apo * 100)}-${Math.round(orbit.peri * 100)}`}
              r="6"
              className="fill-white"
              animate={{
                cx: (showFinal ? final : transfer).map(([x]) => x),
                cy: (showFinal ? final : transfer).map(([, y]) => y),
              }}
              transition={{ duration: 6, ease: 'linear', repeat: Infinity }}
            />
          )}

          {/* burn marker at the parking orbit */}
          <circle cx={CX + R_START * PXR} cy={CY} r="4" style={{ fill: 'var(--accent)' }} />

          {/* level 4 overlay */}
          {setup.readout && showReadout && !orbit.fail && (
            <g>
              <line x1={CX} y1={CY} x2={CX - orbit.apo * PXR} y2={CY} strokeWidth="1.5" strokeDasharray="4 5" className="stroke-white/40" />
              <text x={CX - orbit.apo * PXR - 6} y={CY - 10} textAnchor="end" fontSize="13" fontWeight="700" className="fill-white font-display">
                high {Math.round(apoKm).toLocaleString()} km
              </text>
              <line x1={CX} y1={CY} x2={CX + orbit.peri * PXR} y2={CY} strokeWidth="1.5" strokeDasharray="4 5" className="stroke-white/40" />
              <text x={CX + orbit.peri * PXR + 6} y={CY + 22} fontSize="13" fontWeight="700" className="fill-white font-display">
                low {Math.round(periKm).toLocaleString()} km
              </text>
              <text x="24" y="404" fontSize="13" fontWeight="700" className="fill-white/80 font-display">
                Out of round: {orbit.e.toFixed(3)} {orbit.e < 0.02 ? '(near perfect circle)' : orbit.e < 0.1 ? '(slightly oval)' : '(a long ellipse)'}
              </text>
            </g>
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
          {orbit.fail === 'escape'
            ? 'Too much. The satellite escaped Earth entirely and is on its way to nowhere.'
            : orbit.fail === 'crash'
              ? burnDir === 'radial'
                ? `Pushing outwards barely lifted the far side to ${Math.round(apoKm).toLocaleString()} km, and it dragged the near side down into the ground. Height is not what you were missing.`
                : burnDir === 'retrograde'
                  ? 'Slowing down dropped the far side of your orbit straight into the planet.'
                  : 'The low point ended up inside the atmosphere. That is a re-entry, not an orbit.'
              : orbit.fail === 'no-burn'
                ? 'Nothing yet. Fire the engine and watch which part of the orbit moves.'
                : overFuel
                  ? `Over budget by ${Math.round(fuel - (setup.fuel ?? 0))} m/s. There is only so much in the tank.`
                  : solved
                    ? setup.secondBurn
                      ? `Parked. High point ${Math.round(apoKm).toLocaleString()} km, low point ${Math.round(periKm).toLocaleString()} km.`
                      : `The high point reaches ${Math.round(apoKm).toLocaleString()} km, right on the ring.`
                    : setup.secondBurn && orbit.e > (setup.maxE ?? 1)
                      ? `The orbit touches ${Math.round(apoKm).toLocaleString()} km but drops back to ${Math.round(periKm).toLocaleString()} km. Burn again at the top to lift the low side.`
                      : apoKm < targetKm
                        ? `High point only ${Math.round(apoKm).toLocaleString()} km. Still short of the ring.`
                        : `High point ${Math.round(apoKm).toLocaleString()} km, past the ring.`}
        </p>
      </div>

      {setup.fuel !== null && (
        <div className="mt-3">
          <Meter
            label="Fuel in the tank"
            display={`${Math.round(fuel)} of ${setup.fuel} m/s`}
            fraction={fuel / setup.fuel}
            barClass={overFuel ? 'bg-rose-500' : 'bg-emerald-500'}
          />
        </div>
      )}

      {/* Which way the engine points, while the choice is still the lesson */}
      {setup.dirs.length > 1 && (
        <div className="mt-4">
          <p className="mb-2 font-display text-sm font-semibold">Point the engine</p>
          <div className="flex flex-wrap gap-2">
            {BURN_DIRS.filter((d) => setup.dirs.includes(d.id)).map((d) => {
              const active = burnDir === d.id
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDir(d.id)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-2xl px-4 py-2.5 text-left font-display text-sm font-semibold transition-colors duration-200',
                    active
                      ? 'accent-bg text-white shadow-clay'
                      : 'bg-stone-100 text-ink-soft hover:bg-stone-200 dark:bg-white/5 dark:text-stone-400 dark:hover:bg-white/10',
                  )}
                >
                  <span className="block">{d.label}</span>
                  <span className={cn('block text-xs font-medium', active ? 'text-white/80' : 'opacity-70')}>
                    {d.note}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Fire the engine in pulses, the way a real spacecraft spends its fuel. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          { n: 1, value: burn1, set: setBurn1, label: 'Burn 1, at the low point', show: true },
          { n: 2, value: burn2, set: setBurn2, label: 'Burn 2, at the high point', show: setup.secondBurn },
        ]
          .filter((b) => b.show)
          .map((b) => (
            <div key={b.n} className="rounded-2xl bg-stone-100 p-3 dark:bg-white/5">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="font-display text-sm font-semibold">{b.label}</p>
                <span className="accent-text font-display text-sm font-bold tabular-nums">{b.value} m/s</span>
              </div>
              {/* one tick per pulse spent */}
              <div className="mb-2 flex h-2.5 gap-[2px]">
                {Array.from({ length: MAX_BURN / PULSE }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'flex-1 rounded-sm',
                      i < b.value / PULSE ? 'accent-bg' : 'bg-stone-200 dark:bg-white/10',
                    )}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => b.set((v) => Math.min(MAX_BURN, v + PULSE))}
                  disabled={b.value >= MAX_BURN}
                >
                  Fire {PULSE} m/s
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => b.set((v) => Math.max(0, v - PULSE))}
                  disabled={b.value <= 0}
                >
                  Back off
                </Button>
              </div>
            </div>
          ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={reset} aria-label="Reset the burns">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Total {Math.round(fuel)} m/s</Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ fuel, round: orbit.e, alt: Math.max(0, apoKm) }}
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
              ? `${Math.round(apoKm).toLocaleString()} km on ${Math.round(fuel)} m/s. Try trading height for roundness.`
              : 'Orbit achieved.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
