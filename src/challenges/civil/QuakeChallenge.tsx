import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw, Waves } from 'lucide-react'
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
 * Shaking is measured the way engineers measure it at a site: sideways ground
 * acceleration as a percentage of gravity. 22 %g is a jolt you would struggle
 * to stand up in, 38 %g throws unsecured furniture across the room. A frame's
 * `holds` is the same quantity, so demand and capacity are directly comparable.
 */
const FRAMES = {
  wood: { label: 'Wood frame', cost: 3000, holds: 10, fill: '#c89b6b' },
  steel: { label: 'Steel frame', cost: 6000, holds: 18, fill: '#9aa7b5' },
  concrete: { label: 'Reinforced concrete', cost: 9000, holds: 26, fill: '#b6b1a9' },
} as const

const BRACE_COST = 1500
const BRACE_HOLD = 6
const MAX_BRACES = 3
const ISOLATION_COST = 4000
const ISOLATION_HOLD = 12

interface QuakeSetup {
  label: string
  /** Sideways ground shaking at the site, in percent of gravity. */
  shaking: number
  /** Budget, or null while materials are free. */
  budget: number | null
  /** Level 3 on: base isolation is on the menu. */
  isolationOffered: boolean
  /** Level 4 on: the sway readout is available. */
  drift: boolean
  /** Level 5: top-floor sway the building can take and stay usable, in cm. */
  maxSway: number | null
  brief: string
}

/**
 * Sway at the top floor, in centimetres. Stiffness fights the shake down;
 * rollers let the building ride it, which cuts what the floors feel by almost
 * half. Over five storeys, 9 cm is the sort of drift a hospital is designed
 * for and 16 cm is the sort that brings the ceilings down.
 */
const swayOf = (shaking: number, holds: number, isolation: boolean) =>
  Math.round(((shaking * 18) / Math.max(1, holds)) * (isolation ? 0.55 : 1) * 10) / 10

const LEVELS: ChallengeLevel<QuakeSetup>[] = [
  {
    n: 1,
    title: 'Ride it out',
    phase: 'play',
    concept: 'Stiffer survives',
    teach: 'It is the wobbling block-tower party game, played for keeps. The ground yanks sideways and the building has to keep up. The badge says how hard it yanks, as a percentage of gravity: at 22 %g you could not stay on your feet. Pick a frame and add braces until it can take that. Money is no object today.',
    setup: { label: 'Sharp jolt', shaking: 22, budget: null, isolationOffered: false, drift: false, maxSway: null, brief: 'A sharp jolt is due. Make the tower strong enough to stand through it.' },
  },
  {
    n: 2,
    title: 'The quote arrives',
    phase: 'understand',
    concept: 'Strength costs money',
    teach: 'Concrete everywhere would survive anything and nobody can pay for it. A harder shake and a real budget, so every point of shaking the building can take now has a price on it.',
    setup: { label: 'Strong quake', shaking: 32, budget: 11000, isolationOffered: false, drift: false, maxSway: null, brief: 'Harder shaking, and this time the client is watching the invoice.' },
  },
  {
    n: 3,
    title: 'Fight it or ride it',
    phase: 'understand',
    concept: 'Two philosophies',
    teach: 'Base isolation puts the building on rollers so the ground slides underneath it. On this budget there are exactly two designs that live: a stiff one that fights the shake, and a softer one on rollers that rides it. Both are real engineering.',
    setup: { label: 'Strong quake', shaking: 34, budget: 11000, isolationOffered: true, drift: false, maxSway: null, brief: 'A tighter budget than pure strength can satisfy. There is another way in the parts list.' },
  },
  {
    n: 4,
    title: 'See the sway',
    phase: 'analyze',
    concept: 'Drift, floor by floor',
    teach: 'Turn on the sway readout. It shows how far the top floor swings and how the movement builds up the height of the building. Two designs that both survive can feel completely different inside. Worth knowing: real quakes get one magnitude number for the whole event, but what a building feels is the shaking at its own address, which is what the badge reports here. One number for how much a building can take is a stand-in for a whole design code.',
    setup: { label: 'Strong quake', shaking: 36, budget: 12500, isolationOffered: true, drift: true, maxSway: null, brief: 'The same job, with the sway drawn out so you can compare designs.' },
  },
  {
    n: 5,
    title: 'Still standing is not enough',
    phase: 'optimize',
    concept: 'Usable after the quake',
    teach: 'A hospital that survives but sways so hard every ceiling comes down is still a write-off. The cheapest way to reach this shake on stiffness alone sways 18 cm, well past what the wards can take, so standing up no longer passes on its own. Rollers buy quiet cheaply, mass and bracing buy spare strength, and nothing is best at both.',
    setup: { label: 'Violent quake', shaking: 38, budget: 16000, isolationOffered: true, drift: true, maxSway: 16, brief: 'Design the hospital to stand AND open its doors the next morning.' },
    // Pars proven three ways apart: of the seven designs that survive here, four
    // meet each par and none meets more than two. Cheap means swaying, quiet
    // means costly, and spare strength means concrete.
    metrics: [
      { id: 'cost', label: 'Build cost', goal: 'min', target: 13500 },
      { id: 'sway', label: 'Top-floor sway', goal: 'min', target: 9, unit: ' cm' },
      { id: 'margin', label: 'Spare strength', goal: 'max', target: 6, unit: ' %g' },
    ],
  },
]

type FrameId = keyof typeof FRAMES
type Phase = 'build' | 'shaking' | 'passed' | 'failed'

export function QuakeChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('quake', LEVELS)
  const round = lv.level.setup

  const [frameId, setFrameId] = useState<FrameId>('wood')
  const [braces, setBraces] = useState(0)
  const [isolation, setIsolation] = useState(false)
  const [phase, setPhase] = useState<Phase>('build')
  const [showDrift, setShowDrift] = useState(true)
  const [runId, setRunId] = useState(0)
  const completedRef = useRef(false)
  const handledRunRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  // Each level starts from a bare wood frame.
  useEffect(() => {
    setFrameId('wood')
    setBraces(0)
    setIsolation(false)
    setPhase('build')
  }, [lv.level.n])

  const frame = FRAMES[frameId]
  const cost = frame.cost + braces * BRACE_COST + (isolation ? ISOLATION_COST : 0)
  const holds = frame.holds + braces * BRACE_HOLD + (isolation ? ISOLATION_HOLD : 0)
  const overBudget = round.budget !== null && cost > round.budget
  const sway = swayOf(round.shaking, holds, isolation)
  const tooSwayey = round.maxSway !== null && sway > round.maxSway
  const survives = holds >= round.shaking && !tooSwayey
  const busy = phase === 'shaking'
  const leftover = round.budget !== null ? round.budget - cost : 0

  // Levels 2, 3 and 5 hold the verdict back until the tower has actually been
  // shaken, so "Shake it!" is a commitment rather than a confirmation. Level 1
  // shows it while the controls are still new, and level 4 exists to be read.
  // Every control change drops back to 'build', which hides it again.
  const outcomeVisible =
    lv.level.n === 1 || lv.level.n === 4 || phase === 'passed' || phase === 'failed'

  const rebuild = <T,>(setter: (v: T) => void) => (value: T) => {
    if (busy) return
    setter(value)
    setPhase('build')
  }

  /** Land the verdict exactly once per shake, even if the animation stalls. */
  const finishShake = (id: number, stands: boolean) => {
    if (handledRunRef.current === id) return
    handledRunRef.current = id
    if (stands) {
      setPhase('passed')
      lv.clearLevel(
        lv.level.metrics ? { cost, sway, margin: holds - round.shaking } : undefined,
      )
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
  }

  const att = useAttempts(attemptsFor(lv.level), lv.level.n)

  const shake = () => {
    if (busy || overBudget) return
    const id = runId + 1
    setRunId(id)
    setPhase('shaking')
    // Fallback in case the browser throttles the animation (hidden tab, etc).
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => finishShake(id, survives), 2100)
  }

  const reset = () => {
    setFrameId('wood')
    setBraces(0)
    setIsolation(false)
    setPhase('build')
  }

  const amplitude = 6 + round.shaking / 4
  const floors = 5
  const floorHeight = 38
  const baseY = 290

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {phase === 'passed' && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.drift ? <InsightToggle label="sway" on={showDrift} onChange={setShowDrift} /> : undefined}
      />

      <Objective
        goal={`Stand through ${round.shaking} %g of ground shaking${round.budget !== null ? ` for $${round.budget.toLocaleString()} or less` : ''}${round.maxSway !== null ? `, swaying no more than ${round.maxSway} cm` : ''}`}
        status={`this design: ${frame.label.toLowerCase()}${braces > 0 ? ` + ${braces} brace${braces > 1 ? 's' : ''}` : ''}${isolation ? ' + rollers' : ''} · $${cost.toLocaleString('en-US')}`}
        attemptsLeft={att.left}
        met={phase === 'passed'}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
          <Waves className="mr-1 h-4 w-4" />
          {round.label} · {round.shaking} %g
        </Badge>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-sky-100/70 dark:bg-sky-950/40">
        <svg viewBox="0 0 800 340" className="w-full" role="img" aria-label="Earthquake test scene">
          {/* ground */}
          <rect x="0" y={baseY + 14} width="800" height="40" className="fill-emerald-200 dark:fill-emerald-950" />

          {/* the building */}
          <motion.g
            key={runId}
            animate={
              phase === 'shaking'
                ? { x: [0, -amplitude, amplitude, -amplitude, amplitude, -amplitude / 2, amplitude / 2, 0] }
                : phase === 'failed'
                  ? { x: 26, rotate: 12, y: 8 }
                  : { x: 0, rotate: 0, y: 0 }
            }
            transition={
              phase === 'shaking'
                ? { duration: 1.7, ease: 'easeInOut' }
                : { type: 'spring', stiffness: 160, damping: 14 }
            }
            onAnimationComplete={phase === 'shaking' ? () => finishShake(runId, survives) : undefined}
          >
            {/* base isolation rollers */}
            {isolation && (
              <>
                {[358, 388, 418, 448].map((x) => (
                  <circle key={x} cx={x} cy={baseY + 7} r="7" className="fill-stone-500 dark:fill-stone-400" />
                ))}
              </>
            )}
            {/* floors: each block shears on its own, and drift builds with height */}
            {Array.from({ length: floors }, (_, i) => {
              const y = baseY - (i + 1) * floorHeight - (isolation ? 14 : 0) + 14
              const heightFrac = (i + 1) / floors
              // Weak designs let the upper blocks whip much further than the base.
              const shear = amplitude * 0.55 * heightFrac * (survives ? 0.45 : 1)
              const shaking = phase === 'shaking'
              return (
                <motion.g
                  key={`${i}-${runId}`}
                  animate={
                    shaking
                      ? { x: [0, -shear, shear, -shear * 0.8, shear * 0.5, survives ? 0 : shear * 0.9] }
                      : phase === 'failed'
                        ? { x: shear * 0.9 }
                        : { x: 0 }
                  }
                  transition={shaking ? { duration: 2.0, ease: 'easeInOut' } : { duration: 0.3 }}
                >
                  <rect x="345" y={y} width="115" height={floorHeight - 3} rx="4" fill={frame.fill} />
                  {[360, 392, 424].map((wx) => (
                    <rect key={wx} x={wx} y={y + 9} width="18" height="14" rx="2" className="fill-sky-200 dark:fill-sky-900" />
                  ))}
                </motion.g>
              )
            })}
            {/* X braces strengthen the lower floors */}
            {Array.from({ length: braces }, (_, i) => {
              const y = baseY - (i + 1) * floorHeight - (isolation ? 14 : 0) + 14
              return (
                <g key={i} className="stroke-ink dark:stroke-stone-900" strokeWidth="4" strokeLinecap="round">
                  <line x1="349" y1={y + 2} x2="456" y2={y + floorHeight - 6} />
                  <line x1="456" y1={y + 2} x2="349" y2={y + floorHeight - 6} />
                </g>
              )
            })}
            {/* cracks when it fails */}
            {phase === 'failed' && (
              <polyline
                points={`360,${baseY - 20} 372,${baseY - 40} 366,${baseY - 58} 380,${baseY - 76}`}
                fill="none"
                className="stroke-rose-600"
                strokeWidth="3"
                strokeLinecap="round"
              />
            )}
          </motion.g>
        </svg>
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        {phase === 'passed' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
          >
            It stands! The tower swayed, then settled right back.
            {leftover >= 2000 && (
              <Badge className="bg-emerald-200 text-emerald-900 dark:bg-emerald-500/25 dark:text-emerald-200">
                Efficient build: ${leftover.toLocaleString('en-US')} to spare
              </Badge>
            )}
          </motion.div>
        )}
        {phase === 'failed' && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300"
          >
            {holds >= round.shaking
              ? `It stood, but the top floor swung ${sway} cm and everything inside is wrecked. A usable building may sway ${round.maxSway} cm. Rollers cut the sway nearly in half.`
              : `Down it goes! This frame holds ${holds} %g and the ground shook at ${round.shaking} %g. Brace it, upgrade it${round.isolationOffered ? ', or put it on rollers' : ''}.`}
          </motion.p>
        )}
        {phase === 'build' && overBudget && (
          <p className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Over budget! Remove something before the test.
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <div className="space-y-5">
          <div>
            <p className="mb-2 font-display text-sm font-semibold">1. Pick a frame</p>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(FRAMES) as FrameId[]).map((id) => {
                const f = FRAMES[id]
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => rebuild(setFrameId)(id)}
                    disabled={busy}
                    className={cn(
                      'rounded-2xl border-2 p-3 text-left transition-colors duration-200',
                      frameId === id
                        ? 'accent-border accent-soft'
                        : 'border-stone-200 hover:border-stone-300 dark:border-white/10 dark:hover:border-white/25',
                    )}
                  >
                    <span className="mb-1 block h-2.5 w-8 rounded-full" style={{ backgroundColor: f.fill }} />
                    <span className="font-display text-sm font-bold">{f.label}</span>
                    <span className="block text-xs font-mono tabular-nums text-ink-soft dark:text-stone-400">
                      ${f.cost.toLocaleString('en-US')} · holds {f.holds} %g
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="mb-2 font-display text-sm font-semibold">
                2. X-braces (${BRACE_COST.toLocaleString('en-US')} each, +{BRACE_HOLD} %g)
              </p>
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => rebuild(setBraces)(Math.min(n, MAX_BRACES))}
                    disabled={busy}
                    className={cn(
                      'h-11 w-11 rounded-full border-2 text-sm font-bold font-mono tabular-nums transition-colors duration-200',
                      braces === n
                        ? 'accent-border accent-soft accent-text'
                        : 'border-stone-200 text-ink-soft hover:border-stone-300 dark:border-white/10 dark:text-stone-400 dark:hover:border-white/25',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {round.isolationOffered && (
            <div>
              <p className="mb-2 font-display text-sm font-semibold">
                3. Rollers under the base (${ISOLATION_COST.toLocaleString('en-US')}, +{ISOLATION_HOLD} %g)
              </p>
              <button
                type="button"
                onClick={() => rebuild(setIsolation)(!isolation)}
                disabled={busy}
                aria-pressed={isolation}
                className={cn(
                  'rounded-full border-2 px-5 py-2 font-display text-sm font-bold transition-colors duration-200',
                  isolation
                    ? 'accent-border accent-soft accent-text'
                    : 'border-stone-200 text-ink-soft hover:border-stone-300 dark:border-white/10 dark:text-stone-400 dark:hover:border-white/25',
                )}
              >
                {isolation ? 'Rollers on' : 'Rollers off'}
              </button>
            </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {round.budget !== null ? (
            <Meter
              label="Budget"
              display={`$${cost.toLocaleString('en-US')} of $${round.budget.toLocaleString('en-US')}`}
              fraction={cost / round.budget}
              barClass={overBudget ? 'bg-rose-500' : cost / round.budget > 0.85 ? 'bg-amber-400' : 'bg-emerald-500'}
            />
          ) : (
            <p className="font-display text-sm font-semibold text-ink-soft dark:text-stone-400">
              No budget this time. Cost so far: ${cost.toLocaleString('en-US')}
            </p>
          )}
          <Meter
            label="Shaking this design holds"
            display={
              outcomeVisible
                ? `${holds} %g against ${round.shaking} %g of shaking`
                : `${holds} %g. Shake it to see whether that is enough`
            }
            fraction={holds / 60}
            markerFraction={outcomeVisible ? round.shaking / 60 : undefined}
            barClass={!outcomeVisible ? 'accent-bg' : survives ? 'bg-emerald-500' : 'bg-amber-400'}
          />
          {round.drift && showDrift && (
            <Meter
              label="Top-floor sway"
              display={
                !outcomeVisible
                  ? 'shake it to find out'
                  : round.maxSway !== null
                    ? `${sway} cm of ${round.maxSway} cm allowed`
                    : `${sway} cm`
              }
              fraction={outcomeVisible ? Math.min(1, sway / 24) : 0}
              markerFraction={round.maxSway !== null ? round.maxSway / 24 : undefined}
              barClass={
                !outcomeVisible ? 'accent-bg' : tooSwayey ? 'bg-rose-500' : sway <= 10 ? 'bg-emerald-500' : 'bg-amber-400'
              }
            />
          )}
          <p className="text-xs text-ink-soft dark:text-stone-400">
            {outcomeVisible
              ? 'The black line marks how hard the ground shakes here.'
              : 'Add up what the frame and the extras hold, then commit. The shake tells you the rest.'}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={shake} disabled={busy || overBudget}>
          <Waves className="h-5 w-5" />
          {busy ? 'Shaking...' : 'Shake it!'}
        </Button>
        <Button variant="ghost" onClick={reset} disabled={busy} aria-label="Reset the tower">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={outcomeVisible ? { cost, sway, margin: holds - round.shaking } : { cost }}
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
              ? `Stood at ${sway} cm of sway for $${cost.toLocaleString('en-US')}, with ${holds - round.shaking} %g to spare. Try the other philosophy.`
              : 'It stands. On to the next one.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
