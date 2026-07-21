import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Car, RotateCcw } from 'lucide-react'
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
import { useAttempts } from '@/hooks/useAttempts'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const SPRINGS = {
  soft: { label: 'Soft', k: 30000, coils: 8, note: 'Plush, but squats under weight' },
  medium: { label: 'Medium', k: 60000, coils: 6, note: 'The all-rounder' },
  firm: { label: 'Firm', k: 100000, coils: 5, note: 'Carries a load without squatting' },
  stiff: { label: 'Stiff', k: 160000, coils: 4, note: 'Barely moves at all' },
} as const
type SpringId = keyof typeof SPRINGS
const SPRING_IDS = Object.keys(SPRINGS) as SpringId[]

const DAMPER_C = 2000 // N·s/m per shock absorber
const MAX_DAMPERS = 3
const TRAVEL = 0.16 // metres of suspension travel before it bottoms out
const G = 9.81

/** Natural frequency of the body on its springs, in Hz. */
const naturalHz = (k: number, m: number) => Math.sqrt(k / m) / (2 * Math.PI)

/**
 * How much of the road's shaking reaches the body. Near 1 the road passes
 * straight through; near resonance it is AMPLIFIED, which is the whole story
 * of level 3. Classic single degree-of-freedom transmissibility.
 */
const ampAt = (k: number, m: number, dampers: number, roadHz: number) => {
  const r = roadHz / naturalHz(k, m)
  const zeta = (DAMPER_C * dampers) / (2 * Math.sqrt(k * m))
  return 1 / Math.sqrt((1 - r * r) ** 2 + (2 * zeta * r) ** 2)
}

const sagOf = (k: number, m: number) => (m * G) / k
const harshnessOf = (k: number, m: number) => Math.sqrt(k / m)

interface RideSetup {
  label: string
  /** Van plus whatever is loaded in the back. */
  mass: number
  cargoNote: string
  /** Sharp-bump harshness cap, or null. */
  maxHarsh: number | null
  /** Washboard road frequency in Hz, or null on smooth roads. */
  roadHz: number | null
  /** Body shake allowed at that frequency. */
  maxAmp: number
  /** Sag must stay inside the travel when true. */
  sagMatters: boolean
  /** Level 4 on: the response curve is available. */
  curve: boolean
  brief: string
}

const LEVELS: ChallengeLevel<RideSetup>[] = [
  {
    n: 1,
    title: 'Soak the pothole',
    phase: 'play',
    concept: 'Springs swallow bumps',
    teach: 'It is the suspension upgrade screen from a hill-climb driving game, with the physics switched on. A spring lets the wheel jump over the pothole while the body glides on. The stiffer the spring, the more of that hit reaches your spine. Pick one and take the test drive.',
    setup: { label: 'Pothole alley', mass: 700, cargoNote: 'empty van', maxHarsh: 10, roadHz: null, maxAmp: 99, sagMatters: false, curve: false, brief: 'A delivery van on a road full of potholes. Make it ride, not buck.' },
  },
  {
    n: 2,
    title: 'Now load the van',
    phase: 'understand',
    concept: 'Sag eats your travel',
    teach: 'Half a tonne of cargo squashes the springs before the road does anything. A soft spring squats through all its travel and slams metal on metal, so comfort now competes with carrying.',
    setup: { label: 'Delivery day', mass: 1200, cargoNote: '500 kg of cargo', maxHarsh: 10, roadHz: null, maxAmp: 99, sagMatters: true, curve: false, brief: 'The same van, loaded. The plush setup from level 1 is about to hit its bump stops.' },
  },
  {
    n: 3,
    title: 'The washboard road',
    phase: 'understand',
    concept: 'Resonance',
    teach: 'Corrugations hit the wheels at a steady rhythm, and if that rhythm matches the spring’s own bounce the shakes ADD UP instead of cancelling. The firm spring that won level 2 resonates here and shakes itself apart. Going SOFTER detunes it.',
    setup: { label: 'The corrugated track', mass: 700, cargoNote: 'empty van', maxHarsh: null, roadHz: 1.9, maxAmp: 0.8, sagMatters: false, curve: true, brief: 'A washboard gravel road with bumps at a steady rhythm. Strength is not what wins here.' },
  },
  {
    n: 4,
    title: 'Read the response',
    phase: 'analyze',
    concept: 'The resonance curve',
    teach: 'Turn on the curve. It shows how much shake reaches the body at EVERY road rhythm, and the spike is the resonance. Move the spring and watch the spike slide; add dampers and watch it flatten. The road’s rhythm is the marker.',
    setup: { label: 'The corrugated track II', mass: 700, cargoNote: 'empty van', maxHarsh: null, roadHz: 1.55, maxAmp: 0.8, sagMatters: false, curve: true, brief: 'A different corrugation rhythm, with the full response curve on screen.' },
  },
  {
    n: 5,
    title: 'Sign off the suspension',
    phase: 'optimize',
    concept: 'Comfort, load, and parts',
    teach: 'The production van must carry its load, smooth this road, and not carry shock absorbers it does not need. The comfy setup has thin load margin, the load-proof one needs every damper. Choose.',
    setup: { label: 'The production spec', mass: 1200, cargoNote: '500 kg of cargo', maxHarsh: null, roadHz: 2.6, maxAmp: 0.9, sagMatters: true, curve: true, brief: 'One suspension for the whole fleet. Pick the compromise you can defend.' },
    metrics: [
      { id: 'amp', label: 'Body shake', goal: 'min', target: 0.5 },
      { id: 'margin', label: 'Load margin', goal: 'max', target: 40, unit: ' mm' },
      { id: 'dampers', label: 'Shock absorbers', goal: 'min', target: 1 },
    ],
  },
]

export function SuspensionChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('suspension', LEVELS)
  const round = lv.level.setup

  // Stiff by default: level 1 opens on a van that bucks over every pothole.
  const [springId, setSpringId] = useState<SpringId>('stiff')
  const [dampers, setDampers] = useState(0)
  const [phase, setPhase] = useState<'garage' | 'driving' | 'passed' | 'failed'>('garage')
  const att = useAttempts(lv.level.n === 1 ? null : 3, lv.level.n)
  const [showCurve, setShowCurve] = useState(true)
  const completedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  useEffect(() => {
    setSpringId('stiff')
    setDampers(0)
    setPhase('garage')
  }, [lv.level.n])

  const spring = SPRINGS[springId]
  const sag = sagOf(spring.k, round.mass)
  const bottomsOut = round.sagMatters && sag > TRAVEL
  const harsh = harshnessOf(spring.k, round.mass)
  const tooHarsh = round.maxHarsh !== null && harsh > round.maxHarsh
  const amp = round.roadHz !== null ? ampAt(spring.k, round.mass, dampers, round.roadHz) : 0
  const shaken = round.roadHz !== null && amp > round.maxAmp
  const marginMm = Math.max(0, (TRAVEL - sag) * 1000)
  const passes = !bottomsOut && !tooHarsh && !shaken

  const drive = () => {
    if (phase === 'driving') return
    setPhase('driving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (passes) {
        setPhase('passed')
        lv.clearLevel(lv.level.metrics ? { amp, margin: marginMm, dampers } : undefined)
        if (!completedRef.current) {
          completedRef.current = true
          onComplete()
        }
      } else {
        if (att.spend()) {
          reset()
          att.refill()
        }
        setPhase('failed')
      }
    }, 2200)
  }

  const reset = () => {
    setSpringId('stiff')
    setDampers(0)
    setPhase('garage')
  }

  const retune = <T,>(fn: (v: T) => void) => (v: T) => {
    if (phase === 'driving') return
    fn(v)
    setPhase('garage')
  }

  /* Scene */
  const driving = phase === 'driving'
  // Body bounce for the animation: harshness or resonance, whichever applies.
  const bounce = round.roadHz !== null ? Math.min(26, amp * 12) : Math.min(26, harsh * 1.4)
  const squat = round.sagMatters ? Math.min(30, sag * 120) : 0
  const fnHz = naturalHz(spring.k, round.mass)

  /* Response curve for level 4 */
  const curvePts: string[] = []
  if (round.curve) {
    for (let i = 0; i <= 80; i++) {
      const f = 0.4 + (i / 80) * 3.6
      const a = Math.min(4, ampAt(spring.k, round.mass, dampers, f))
      curvePts.push(`${60 + (i / 80) * 680},${300 - (a / 4) * 130}`)
    }
  }

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {phase === 'passed' && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.curve ? <InsightToggle label="response curve" on={showCurve} onChange={setShowCurve} /> : undefined}
      />

      <Objective
        goal={
          round.roadHz !== null
            ? `Body shake ${round.maxAmp} or less on a road drumming at ${round.roadHz} Hz${round.sagMatters ? ', loaded, without bottoming out' : ''}`
            : round.sagMatters
              ? `Ride smooth (harshness ${round.maxHarsh} or less) without the load bottoming out`
              : `Ride smooth: harshness ${round.maxHarsh} or less`
        }
        attemptsLeft={att.left}
        met={phase === 'passed'}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
        <div className="flex flex-wrap gap-2">
          <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
          <Badge>{round.cargoNote}</Badge>
          {round.roadHz !== null && (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              bumps at {round.roadHz.toFixed(1)} per second
            </Badge>
          )}
        </div>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-sky-100/70 dark:bg-sky-950/40">
        <svg viewBox={`0 0 800 ${round.curve && showCurve ? 330 : 200}`} className="w-full" role="img" aria-label="Van on a bumpy road">
          {/* road with bumps */}
          <path
            d={
              round.roadHz !== null
                ? 'M0 168 ' + Array.from({ length: 20 }, () => `q10 -10 20 0 t20 0`).join(' ')
                : 'M0 168 h180 q8 -2 14 0 l10 12 l10 -12 q120 -4 200 0 l10 12 l10 -12 h366'
            }
            fill="none"
            strokeWidth="5"
            className="stroke-stone-500 dark:stroke-stone-400"
          />
          <rect x="0" y="172" width="800" height="28" className="fill-stone-300/60 dark:fill-stone-800" />

          {/* the van: wheels follow the road, body rides the springs */}
          <motion.g
            animate={driving ? { x: [-40, 40, -40] } : { x: 0 }}
            transition={driving ? { duration: 2.2, ease: 'linear' } : undefined}
          >
            {/* wheels */}
            <motion.g animate={driving ? { y: [0, -3, 0, -3, 0] } : { y: 0 }} transition={{ duration: 0.4, repeat: driving ? 5 : 0 }}>
              <circle cx="330" cy="158" r="15" className="fill-ink dark:fill-stone-900" />
              <circle cx="450" cy="158" r="15" className="fill-ink dark:fill-stone-900" />
            </motion.g>
            {/* springs drawn between axle and body */}
            {[330, 450].map((x) => (
              <path
                key={x}
                d={Array.from({ length: spring.coils }, (_, i) => `L${x + (i % 2 === 0 ? 8 : -8)} ${146 - squat - (i * (24 - squat * 0.3)) / spring.coils}`).join(' ').replace('L', 'M')}
                fill="none"
                strokeWidth="3"
                style={{ stroke: 'var(--accent)' }}
              />
            ))}
            {/* dampers as little cylinders beside the rear spring */}
            {Array.from({ length: dampers }, (_, i) => (
              <rect key={i} x={470 + i * 12} y={128 - squat} width="7" height="26" rx="3" className="fill-slate-500 dark:fill-slate-400" />
            ))}
            {/* body */}
            <motion.g
              animate={
                driving
                  ? { y: [0, -bounce, bounce * 0.7, -bounce, bounce * 0.5, 0] }
                  : phase === 'failed' && bottomsOut
                    ? { y: 16 }
                    : { y: 0 }
              }
              transition={driving ? { duration: 2.2, ease: 'easeInOut' } : { type: 'spring', stiffness: 160, damping: 12 }}
            >
              <rect x="295" y={92 - squat} width="190" height="52" rx="10" className="fill-slate-300 dark:fill-slate-400" />
              <rect x="440" y={100 - squat} width="42" height="30" rx="5" className="fill-sky-200 dark:fill-sky-800" />
              <rect x="305" y={104 - squat} width="60" height="14" rx="3" style={{ fill: 'var(--accent)' }} />
              {phase === 'failed' && shaken && (
                <text x="390" y={80 - squat} textAnchor="middle" fontSize="15" fontWeight="800" className="fill-rose-500 font-display">
                  SHAKING APART
                </text>
              )}
              {phase === 'failed' && bottomsOut && (
                <text x="390" y={80} textAnchor="middle" fontSize="15" fontWeight="800" className="fill-rose-500 font-display">
                  CLUNK. Bottomed out.
                </text>
              )}
            </motion.g>
          </motion.g>

          {/* level 4 overlay: the response curve */}
          {round.curve && showCurve && (
            <g>
              <rect x="60" y="215" width="680" height="90" rx="8" className="fill-white/60 dark:fill-white/5" />
              <text x="66" y="230" fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                Shake reaching the body, by road rhythm · spike = resonance at {fnHz.toFixed(2)}/s
              </text>
              {/* the pass line */}
              <line x1="60" y1={300 - (round.maxAmp / 4) * 130} x2="740" y2={300 - (round.maxAmp / 4) * 130} strokeWidth="1.5" strokeDasharray="5 5" className="stroke-emerald-500/70" />
              <polyline points={curvePts.join(' ')} fill="none" strokeWidth="2.5" style={{ stroke: 'var(--accent)' }} />
              {/* the road's rhythm */}
              {round.roadHz !== null && (
                <line
                  x1={60 + ((round.roadHz - 0.4) / 3.6) * 680}
                  y1="215"
                  x2={60 + ((round.roadHz - 0.4) / 3.6) * 680}
                  y2="305"
                  strokeWidth="2"
                  className="stroke-amber-500"
                />
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Verdict */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        <p
          className={cn(
            'rounded-xl px-4 py-2.5 text-sm font-semibold',
            phase === 'passed'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
              : phase === 'failed'
                ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300'
                : 'bg-stone-100 text-ink-soft dark:bg-white/5 dark:text-stone-300',
          )}
        >
          {phase === 'passed'
            ? round.roadHz !== null
              ? `Smooth. Only ${amp.toFixed(2)} of the road reaches the body.`
              : 'Glides right over. The customer keeps their coffee.'
            : phase === 'failed'
              ? bottomsOut
                ? `The cargo squashed the ${spring.label.toLowerCase()} spring through ${(sag * 100).toFixed(0)} cm of its ${TRAVEL * 100} cm travel. Metal on metal.`
                : tooHarsh
                  ? 'Every pothole came straight through the floor. That spring barely moves.'
                  : `The bumps hit at ${round.roadHz?.toFixed(1)}/s and this setup bounces at ${fnHz.toFixed(2)}/s. They fed each other until the van shook ${amp > 4 ? 'violently' : `at ${amp.toFixed(2)}`}. ${springId !== 'soft' ? 'Softer detunes it.' : 'Add damping.'}`
              : 'Set up the suspension, then take the test drive.'}
        </p>
      </div>

      {round.sagMatters && (
        <div className="mt-3">
          <Meter
            label="Suspension travel used by the load"
            display={`${(sag * 100).toFixed(1)} of ${TRAVEL * 100} cm`}
            fraction={Math.min(1, sag / TRAVEL)}
            barClass={bottomsOut ? 'bg-rose-500' : sag / TRAVEL > 0.8 ? 'bg-amber-400' : 'bg-emerald-500'}
          />
        </div>
      )}

      {/* Garage: springs and dampers */}
      <div className="mt-4 grid gap-5 sm:grid-cols-[1.4fr,1fr]">
        <div>
          <p className="mb-2 font-display text-sm font-semibold">Spring</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SPRING_IDS.map((id) => {
              const s = SPRINGS[id]
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => retune(setSpringId)(id)}
                  aria-pressed={springId === id}
                  className={cn(
                    'rounded-2xl border-2 p-2.5 text-left transition-colors duration-200',
                    springId === id ? 'accent-border accent-soft' : 'border-stone-200 hover:border-stone-300 dark:border-white/10 dark:hover:border-white/25',
                  )}
                >
                  <svg viewBox="0 0 20 34" className="mb-1 h-8 w-5" aria-hidden>
                    <path
                      d={Array.from({ length: s.coils }, (_, i) => `L${i % 2 === 0 ? 16 : 4} ${3 + (i * 28) / s.coils}`).join(' ').replace('L', 'M')}
                      fill="none"
                      strokeWidth="2.5"
                      style={{ stroke: 'var(--accent)' }}
                    />
                  </svg>
                  <span className="block font-display text-sm font-bold">{s.label}</span>
                  <span className="block text-xs text-ink-soft dark:text-stone-400">{s.note}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 font-display text-sm font-semibold">Shock absorbers</p>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => retune(setDampers)(Math.min(n, MAX_DAMPERS))}
                aria-pressed={dampers === n}
                className={cn(
                  'h-11 w-11 rounded-full border-2 font-display text-sm font-bold tabular-nums transition-colors duration-200',
                  dampers === n
                    ? 'accent-border accent-soft accent-text'
                    : 'border-stone-200 text-ink-soft hover:border-stone-300 dark:border-white/10 dark:text-stone-400 dark:hover:border-white/25',
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft dark:text-stone-400">
            Dampers turn bounce into heat. They cannot move the resonance, only blunt it.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={drive} disabled={phase === 'driving'}>
          <Car className="h-5 w-5" />
          {phase === 'driving' ? 'Driving...' : 'Test drive'}
        </Button>
        <Button variant="ghost" onClick={reset} disabled={phase === 'driving'} aria-label="Back to the stock setup">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Bounces at {fnHz.toFixed(2)}/s</Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ amp, margin: marginMm, dampers }}
            best={lv.best}
            scored={phase === 'passed'}
          />
        </div>
      )}

      {phase === 'passed' && (
        <LevelComplete
          lv={lv}
          message={
            lv.level.metrics
              ? `Shake ${amp.toFixed(2)} with ${marginMm.toFixed(0)} mm in hand on ${dampers} damper${dampers === 1 ? '' : 's'}. Defend a different compromise.`
              : 'That van rides beautifully.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
