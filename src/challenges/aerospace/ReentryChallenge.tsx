import { useEffect, useRef, useState } from 'react'

import { Rocket, RotateCcw } from 'lucide-react'
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
import { useSvgDrag } from '@/hooks/useSvgDrag'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const SCALE_H = 7200 // how fast the air thins out, in meters
const RHO0 = 1.225 // air density at sea level
const G = 9.81
const V_ENTRY = 7800 // speed coming out of orbit, m/s
const AREA = 12 // capsule frontal area, m²
const DRY_MASS = 2000
const SHIELD_PER_CM = 60 // kg of heat shield per centimeter
const SHIELD_CAPACITY = 1400 // heat each centimeter can soak up before burning through
const SKIP_ANGLE = 1.5 // shallower than this and you bounce back off the atmosphere
// The ablator chars usefully up to a point, then the surface flash-fails no
// matter how thick the stack behind it is. This is what makes a too-steep
// entry fatal: thickness fixes the soak, nothing fixes the pulse.
const PEAK_HEAT_LIMIT = 160 // W/cm² the shield face can stand

/**
 * Capsule shapes. A blunt nose pushes a thick shock wave ahead of it that holds
 * the hottest air away from the skin, which is why real capsules are not pointy.
 * The cost is a bigger, heavier shield.
 */
const SHAPES = {
  sharp: { label: 'Sharp cone', cd: 0.6, noseR: 0.3, extraMass: 0, note: 'Slippery, but the tip takes the heat' },
  rounded: { label: 'Rounded', cd: 1.0, noseR: 1.0, extraMass: 80, note: 'A middle ground' },
  // The blunt shell is priced so it does not dominate level 5: light enough to
  // win on heat, heavy enough that the mass par belongs to the rounded shape.
  blunt: { label: 'Blunt capsule', cd: 1.4, noseR: 2.5, extraMass: 350, note: 'Heavy, but rides its own shock wave' },
} as const
type ShapeId = keyof typeof SHAPES
const SHAPE_IDS = Object.keys(SHAPES) as ShapeId[]

interface Flight {
  fail: null | 'skip' | 'burnt' | 'peak'
  peakG: number
  peakQ: number
  totalQ: number
  capacity: number
  shieldMass: number
  minutes: number
  /** Sampled trace of g load and heat rate for the level 4 readout. */
  trace: { g: number; q: number }[]
}

/** Fly the capsule down through the atmosphere one half second at a time. */
function reenter(angleDeg: number, shapeId: ShapeId, shieldCm: number): Flight {
  const shape = SHAPES[shapeId]
  const shieldMass = shieldCm * SHIELD_PER_CM + shape.extraMass
  const mass = DRY_MASS + shieldMass
  const capacity = shieldCm * SHIELD_CAPACITY
  const gamma = (angleDeg * Math.PI) / 180

  let h = 120000
  let v = V_ENTRY
  let t = 0
  let totalQ = 0
  let peakG = 0
  let peakQ = 0
  const trace: { g: number; q: number }[] = []

  while (h > 0 && t < 1500) {
    const rho = RHO0 * Math.exp(-h / SCALE_H)
    const decel = (rho * v * v * shape.cd * AREA) / (2 * mass)
    // Sutton-Graves style: heating rises with density and the cube of speed,
    // and falls off with a bigger nose radius.
    const q = (1.83e-4 * Math.sqrt(rho / shape.noseR) * Math.pow(v, 3)) / 1e4
    v += (-decel + G * Math.sin(gamma)) * 0.5
    h -= v * Math.sin(gamma) * 0.5
    t += 0.5
    totalQ += q * 0.5
    peakG = Math.max(peakG, decel / G)
    peakQ = Math.max(peakQ, q)
    if (trace.length < 260) trace.push({ g: decel / G, q })
    if (v < 300) break // slow enough for parachutes
  }

  return {
    fail:
      angleDeg < SKIP_ANGLE
        ? 'skip'
        : totalQ > capacity
          ? 'burnt'
          : peakQ > PEAK_HEAT_LIMIT
            ? 'peak'
            : null,
    peakG,
    peakQ,
    totalQ,
    capacity,
    shieldMass,
    minutes: t / 60,
    trace,
  }
}

interface EntrySetup {
  /** Fixed shape, or null when the player picks. */
  shape: ShapeId | null
  /** Fixed shield thickness in cm, or null when the player picks. */
  shield: number | null
  /** Peak g the crew can take, or null. */
  gLimit: number | null
  /** Level 4 on: the descent traces are available. */
  traces: boolean
  brief: string
}

const LEVELS: ChallengeLevel<EntrySetup>[] = [
  {
    n: 1,
    title: 'Come home',
    phase: 'play',
    concept: 'The entry corridor',
    teach: 'Drag the handle on the dashed approach line to set the angle. Too shallow and you skip off the atmosphere like a stone on a pond. Too steep and the heat arrives faster than the shield face can shed it. Find the angle in between.',
    setup: { shape: 'rounded', shield: 8, gLimit: null, traces: false, brief: 'Your capsule is falling out of orbit. Pick the angle it meets the atmosphere at.' },
  },
  {
    n: 2,
    title: 'Crew aboard',
    phase: 'understand',
    concept: 'People have limits',
    teach: 'There are astronauts inside now, and they black out above about 12 g. Steep entries slam on the brakes hard, so the top of your corridor just moved down.',
    setup: { shape: 'rounded', shield: 8, gLimit: 12, traces: false, brief: 'Same capsule, but this time it is carrying a crew home.' },
  },
  {
    n: 3,
    title: 'Half the shield',
    phase: 'understand',
    concept: 'Blunt beats sharp',
    teach: 'Launch mass was cut, so you only have a 4 cm shield. A pointed nose looks fast but it sits right in the hottest air. A blunt one pushes a shock wave ahead of it that keeps that heat off the skin.',
    setup: { shape: null, shield: 4, gLimit: 12, traces: false, brief: 'A lighter capsule with a much thinner heat shield. The shape you choose now matters more than the angle.' },
  },
  {
    n: 4,
    title: 'Watch the descent',
    phase: 'analyze',
    concept: 'Peak versus total heat',
    teach: 'Turn on the traces. The spike is how hard the heating hits at its worst, and the area under it is the total the shield has to absorb. A shallow entry lowers the spike but stretches the soak.',
    setup: { shape: null, shield: null, gLimit: 12, traces: true, brief: 'Full instrumentation. Watch how the g load and the heating build and fade as you come down.' },
  },
  {
    n: 5,
    title: 'Design the capsule',
    phase: 'optimize',
    concept: 'Crew, mass, and heat',
    teach: 'Shallow is gentle on the crew but soaks for ages, so it needs a thick shield. Steep needs less shield but crushes them. Blunt cuts the heat but carries weight. Nothing wins all three.',
    setup: { shape: null, shield: null, gLimit: 20, traces: true, brief: 'Sign off the final capsule design: kind to the crew, light on the pad, and cool on the way down.' },
    // PEAK_HEAT_LIMIT already burns off anything past 160, so a heating par of
    // 175 was free on every capsule that survived, and 470 kg was reachable by
    // one design in ninety-two. At 560 kg and 100 W/cm² each pair has a capsule
    // that takes it (rounded 8 cm at 3° for crew and mass, blunt 5 cm at 2.5°
    // for crew and heat, blunt 3 cm at 6° for mass and heat) and nothing takes
    // all three. Proven by grid over every shape, thickness, and half degree.
    metrics: [
      { id: 'peakG', label: 'Peak g on the crew', goal: 'min', target: 12, unit: ' g' },
      { id: 'mass', label: 'Heat shield mass', goal: 'min', target: 560, unit: ' kg' },
      { id: 'peakQ', label: 'Peak heating', goal: 'min', target: 100 },
    ],
  },
]

export function ReentryChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('reentry', LEVELS)
  const setup = lv.level.setup

  // Starts too shallow to survive, so level 1 opens on a visible failure
  // instead of quietly clearing itself before the player touches anything.
  const [angle, setAngle] = useState(1)
  const [shapeId, setShapeId] = useState<ShapeId>('rounded')
  const [shieldCm, setShieldCm] = useState(6)
  const [won, setWon] = useState(false)
  const [showTraces, setShowTraces] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    setAngle(1)
    setShapeId(setup.shape ?? 'rounded')
    setShieldCm(setup.shield ?? 6)
    setWon(false)
    setVerdict(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lv.level.n])

  const shape = setup.shape ?? shapeId
  const shield = setup.shield ?? shieldCm
  const f = reenter(angle, shape, shield)
  const overG = setup.gLimit !== null && f.peakG > setup.gLimit
  const solved = !f.fail && !overG

  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)

  // Levels 2, 3 and 5 fly blind: the outcome numbers only appear once the
  // player commits to an entry. Level 1 is for learning the corridor and
  // level 4 exists to show the readouts.
  const outcomeVisible = lv.level.n === 1 || lv.level.n === 4 || verdict !== null || won

  /** Any pre-flight tweak makes the last verdict stale, which re-hides the outcome. */
  const touch = () => {
    if (!won) setVerdict(null)
  }

  /** Commit to the entry corridor. The capsule only flies once per call. */
  const beginEntry = () => {
    if (won) return
    if (solved) {
      setWon(true)
      setVerdict({ ok: true, text: `Home safe. Peak ${f.peakG.toFixed(1)} g, peak heating ${Math.round(f.peakQ)} W/cm², ${f.minutes.toFixed(1)} minutes of descent.` })
      lv.clearLevel(
        lv.level.metrics ? { peakG: f.peakG, mass: f.shieldMass, peakQ: f.peakQ } : undefined,
      )
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const text = f.fail === 'skip'
      ? 'Too shallow. The capsule skipped off the atmosphere like a stone and is heading for deep space.'
      : f.fail === 'burnt'
        ? `Shield burned through: it soaked ${Math.round(f.totalQ).toLocaleString()} of heat and could only take ${Math.round(f.capacity).toLocaleString()}.`
        : f.fail === 'peak'
          ? `The shield face flashed away at ${Math.round(f.peakQ)} W/cm², past the ${PEAK_HEAT_LIMIT} it can stand. That steep, the heat all arrives at once, and thickness does not help.`
          : `The crew blacked out at ${f.peakG.toFixed(1)} g against a limit of ${setup.gLimit}. Ease the angle back.`
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'Mission control waved off the entry. Fresh capsule on the pad. Steeper means hotter and harder; find the corridor first.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  const reset = () => {
    setAngle(1)
    setShapeId(setup.shape ?? 'rounded')
    setShieldCm(setup.shield ?? 6)
    setWon(false)
    setVerdict(null)
  }

  /** Drag the approach line to change how steeply you come in. */
  const { bind } = useSvgDrag((x, y) => {
    const dx = Math.max(20, x - 70)
    const dy = y - 52
    // The path is drawn with an exaggerated vertical scale, so undo that here.
    const deg = (Math.atan2(dy / 4, dx) * 180) / Math.PI
    setAngle(Math.max(1, Math.min(8, Math.round(deg * 2) / 2)))
    touch()
  })
  const nudgeAngle = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') setAngle((a) => Math.min(8, a + 0.5))
    else if (e.key === 'ArrowUp') setAngle((a) => Math.max(1, a - 0.5))
    else return
    touch()
    e.preventDefault()
  }

  /* Scene */
  const showTr = setup.traces && showTraces
  const TR_TOP = 250
  const TR_H = 78
  const maxQ = Math.max(60, ...f.trace.map((p) => p.q))
  const maxG = Math.max(6, ...f.trace.map((p) => p.g))
  const tracePath = (key: 'g' | 'q', max: number) =>
    f.trace
      .map((p, i) => {
        const x = 60 + (i / Math.max(1, f.trace.length - 1)) * 680
        const y = TR_TOP + TR_H - (p[key] / max) * (TR_H - 6)
        return `${x},${y}`
      })
      .join(' ')

  // Entry path drawn as a straight line at the chosen angle.
  const pathLen = 300
  const dx = pathLen * Math.cos((angle * Math.PI) / 180)
  const dy = pathLen * Math.sin((angle * Math.PI) / 180) * 4 // exaggerated so the angle reads

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.traces ? <InsightToggle label="descent traces" on={showTraces} onChange={setShowTraces} /> : undefined}
      />

      <Objective
        goal={`Bring the capsule home: no skip, shield intact${setup.gLimit !== null ? `, crew under ${setup.gLimit} g` : ''}`}
        status={`this corridor: ${angle.toFixed(1)}° · ${shield} cm shield`}
        attemptsLeft={att.left}
        met={won}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        {setup.gLimit !== null && (
          <Badge
            className={cn(
              'px-4 py-1.5 text-sm',
              outcomeVisible && overG ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-stone-100 text-ink-soft dark:bg-white/10 dark:text-stone-300',
            )}
          >
            Crew limit {setup.gLimit} g
          </Badge>
        )}
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-slate-900 dark:bg-slate-950">
        <svg viewBox={`0 0 800 ${showTr ? TR_TOP + TR_H + 34 : 240}`} className="w-full" role="img" aria-label="Capsule re-entry" {...bind}>
          {[[80, 30], [220, 60], [420, 25], [640, 55], [730, 90]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.4" className="fill-white/60" />
          ))}

          {/* atmosphere bands, thicker lower down */}
          {[0.18, 0.34, 0.52, 0.72].map((frac, i) => (
            <rect key={frac} x="0" y={60 + i * 34} width="800" height="34" className="fill-sky-500" opacity={0.05 + frac * 0.12} />
          ))}
          <rect x="0" y="196" width="800" height="44" className="fill-emerald-900" />

          {/* the entry path, which you drag to set the angle */}
          <line x1="70" y1="52" x2={70 + dx} y2={52 + dy} strokeWidth="2.5" strokeDasharray="8 8" className="stroke-white/50" />
          <circle
            cx={70 + dx}
            cy={52 + dy}
            r="13"
            tabIndex={0}
            onKeyDown={nudgeAngle}
            role="slider"
            aria-label="Entry angle"
            aria-valuenow={angle}
            aria-valuemin={1}
            aria-valuemax={8}
            aria-valuetext={`${angle} degrees`}
            className="cursor-grab fill-white/80 outline-none"
          />
          <text x={70 + dx + 20} y={52 + dy + 5} fontSize="12" fontWeight="700" className="fill-white/80 font-display">
            {angle.toFixed(1)}° drag me
          </text>

          {/* capsule, glowing according to how hot it is getting */}
          <g transform={`translate(${70 + dx * 0.62} ${52 + dy * 0.62})`}>
            <ellipse
              rx={outcomeVisible && f.peakQ > 200 ? 34 : 24}
              ry={outcomeVisible && f.peakQ > 200 ? 20 : 14}
              className={outcomeVisible && f.fail === 'burnt' ? 'fill-rose-500/60' : 'fill-amber-400/40'}
            />
            <path
              d={shape === 'blunt' ? 'M-16 10 L16 10 L10 -8 L-10 -8 Z' : shape === 'rounded' ? 'M-13 10 L13 10 L7 -10 L-7 -10 Z' : 'M-9 10 L9 10 L0 -14 Z'}
              className="fill-stone-300"
            />
          </g>

          <text x="24" y="30" fontSize="13" fontWeight="700" className="fill-white/70 font-display">
            Entry interface, 120 km
          </text>
          <text x="24" y="228" fontSize="13" fontWeight="700" className="fill-white/70 font-display">
            Ground
          </text>

          {/* level 4 overlay */}
          {showTr && (
            <g>
              <text x="60" y={TR_TOP - 10} fontSize="12" fontWeight="700" className="fill-white/80 font-display">
                Through the descent: g load (white) and heating (orange)
              </text>
              <rect x="60" y={TR_TOP} width="680" height={TR_H} rx="6" className="fill-white/5" />
              <polyline points={tracePath('q', maxQ)} fill="none" strokeWidth="2.5" className="stroke-amber-400" />
              <polyline points={tracePath('g', maxG)} fill="none" strokeWidth="2" className="stroke-white/70" />
              <text x="66" y={TR_TOP + 14} fontSize="11" fontWeight="700" className="fill-white/60 font-display">
                {outcomeVisible
                  ? `peak ${Math.round(f.peakQ)} W/cm² · ${f.peakG.toFixed(1)} g · ${f.minutes.toFixed(1)} min`
                  : 'fly it to put numbers on the peaks'}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Verdict */}
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
          <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-300">
            Set the approach angle, shape, and shield, then commit to the entry.
          </p>
        )}
      </div>

      <div className="mt-3">
        <Meter
          label="Heat shield"
          display={
            outcomeVisible
              ? `${Math.round(f.totalQ).toLocaleString()} of ${Math.round(f.capacity).toLocaleString()} soaked up`
              : `can soak ${Math.round(f.capacity).toLocaleString()} · fly it to find out`
          }
          fraction={outcomeVisible ? f.totalQ / f.capacity : 0}
          barClass={outcomeVisible && f.fail === 'burnt' ? 'bg-rose-500' : 'bg-emerald-500'}
        />
      </div>

      {/* Shape picker */}
      {setup.shape === null && (
        <div className="mt-4">
          <p className="mb-2 font-display text-sm font-semibold">Capsule shape</p>
          <div className="flex flex-wrap gap-2">
            {SHAPE_IDS.map((id) => {
              const s = SHAPES[id]
              const active = shapeId === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setShapeId(id)
                    touch()
                  }}
                  aria-pressed={active}
                  className={cn(
                    'rounded-2xl px-4 py-2.5 text-left font-display text-sm font-semibold transition-colors duration-200',
                    active ? 'accent-bg on-accent shadow-clay' : 'bg-stone-100 text-ink-soft hover:bg-stone-200 dark:bg-white/5 dark:text-stone-400 dark:hover:bg-white/10',
                  )}
                >
                  <span className="block">{s.label}</span>
                  <span className={cn('block text-xs font-medium', active ? 'on-accent opacity-80' : 'opacity-70')}>{s.note}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {setup.shield === null && (
        <div className="mt-4">
          <p className="mb-2 font-display text-sm font-semibold">
            Heat shield <span className="font-normal text-ink-soft dark:text-stone-400">· {shieldCm} cm</span>
          </p>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 10 }, (_, i) => {
              const on = i < shieldCm
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setShieldCm(on ? Math.max(2, i) : i + 1)
                    touch()
                  }}
                  aria-pressed={on}
                  aria-label={on ? `Remove shield layer ${i + 1}` : `Add shield layer ${i + 1}`}
                  className={cn(
                    'h-10 w-8 rounded-md border-2 transition-colors duration-150',
                    on
                      ? 'border-orange-700 bg-orange-500'
                      : 'border-dashed border-stone-300 hover:border-stone-400 dark:border-white/15',
                  )}
                />
              )
            })}
          </div>
          <p className="mt-1.5 text-xs text-ink-soft dark:text-stone-400">
            Each layer is a centimeter of ablative shield, and each one is mass on the pad.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={beginEntry} disabled={won}>
          <Rocket className="h-5 w-5" />
          Begin re-entry
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Reset the entry">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Shield {Math.round(f.shieldMass)} kg</Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={outcomeVisible ? { peakG: f.peakG, mass: f.shieldMass, peakQ: f.peakQ } : {}}
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
              ? `${f.peakG.toFixed(1)} g on a ${Math.round(f.shieldMass)} kg shield. Try trading angle for thickness.`
              : 'Splashdown. Everyone made it.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
