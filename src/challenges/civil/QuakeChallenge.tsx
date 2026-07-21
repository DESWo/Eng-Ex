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
import { useAttempts } from '@/hooks/useAttempts'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const FRAMES = {
  wood: { label: 'Wood frame', cost: 3000, stability: 10, fill: '#c89b6b' },
  steel: { label: 'Steel frame', cost: 6000, stability: 18, fill: '#9aa7b5' },
  concrete: { label: 'Reinforced concrete', cost: 9000, stability: 26, fill: '#b6b1a9' },
} as const

const BRACE_COST = 1500
const BRACE_STABILITY = 6
const MAX_BRACES = 3
const ISOLATION_COST = 4000
const ISOLATION_STABILITY = 12

interface QuakeSetup {
  label: string
  magnitude: number
  /** Budget, or null while materials are free. */
  budget: number | null
  /** Level 3 on: base isolation is on the menu. */
  isolationOffered: boolean
  /** Level 4 on: the drift readout is available. */
  drift: boolean
  /** Level 5: sway the building can take and still be usable, or null. */
  maxSway: number | null
  brief: string
}

/**
 * Sway at the top floor. Stiffness fights the shake down; isolation lets the
 * building ride it, which cuts what the floors feel by almost half.
 */
const swayOf = (magnitude: number, stability: number, isolation: boolean) =>
  Math.round(((magnitude * 18) / Math.max(1, stability)) * (isolation ? 0.55 : 1) * 10) / 10

const LEVELS: ChallengeLevel<QuakeSetup>[] = [
  {
    n: 1,
    title: 'Ride it out',
    phase: 'play',
    concept: 'Stiffer survives',
    teach: 'It is the wobbling block-tower party game, played for keeps. A quake shakes the ground and the building has to keep up. Pick a frame and add braces until it can take the tremor. Money is no object today.',
    setup: { label: 'Magnitude 5 tremor', magnitude: 18, budget: null, isolationOffered: false, drift: false, maxSway: null, brief: 'A small tremor is due. Make the tower strong enough to stand through it.' },
  },
  {
    n: 2,
    title: 'The quote arrives',
    phase: 'understand',
    concept: 'Strength costs money',
    teach: 'Concrete everywhere would survive anything and nobody can pay for it. A bigger quake and a real budget, so every point of stability now has a price on it.',
    setup: { label: 'Magnitude 6 quake', magnitude: 30, budget: 12000, isolationOffered: false, drift: false, maxSway: null, brief: 'A stronger quake, and this time the client is watching the invoice.' },
  },
  {
    n: 3,
    title: 'Fight it or ride it',
    phase: 'understand',
    concept: 'Two philosophies',
    teach: 'Base isolation puts the building on rollers so the ground moves underneath it. On this budget there are exactly two designs that live: a stiff one that fights the shake, and a softer one on rollers that rides it. Both are real engineering.',
    setup: { label: 'Magnitude 6 quake', magnitude: 34, budget: 11000, isolationOffered: true, drift: false, maxSway: null, brief: 'A tighter budget than pure strength can satisfy. There is another way in the parts list.' },
  },
  {
    n: 4,
    title: 'See the sway',
    phase: 'analyze',
    concept: 'Drift, floor by floor',
    teach: 'Turn on the drift readout. It shows how far the top floor swings and how the movement builds up the height of the building. Two designs that both survive can feel completely different inside.',
    setup: { label: 'Magnitude 6 quake', magnitude: 36, budget: 12500, isolationOffered: true, drift: true, maxSway: null, brief: 'The same job, with the sway drawn out so you can compare designs.' },
  },
  {
    n: 5,
    title: 'Still standing is not enough',
    phase: 'optimize',
    concept: 'Usable after the quake',
    teach: 'A hospital that survives but sways so hard every ceiling comes down is still a write-off. The cheapest surviving design here sways far too much, so survival alone no longer passes.',
    setup: { label: 'Magnitude 7 monster', magnitude: 44, budget: 16000, isolationOffered: true, drift: true, maxSway: 12, brief: 'Design the building to stand AND stay usable when the big one hits.' },
    metrics: [
      { id: 'cost', label: 'Build cost', goal: 'min', target: 15000 },
      { id: 'sway', label: 'Top-floor sway', goal: 'min', target: 10 },
      { id: 'margin', label: 'Stability margin', goal: 'max', target: 4 },
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
  const stability = frame.stability + braces * BRACE_STABILITY + (isolation ? ISOLATION_STABILITY : 0)
  const overBudget = round.budget !== null && cost > round.budget
  const sway = swayOf(round.magnitude, stability, isolation)
  const tooSwayey = round.maxSway !== null && sway > round.maxSway
  const survives = stability >= round.magnitude && !tooSwayey
  const busy = phase === 'shaking'
  const leftover = round.budget !== null ? round.budget - cost : 0

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
        lv.level.metrics ? { cost, sway, margin: stability - round.magnitude } : undefined,
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

  const att = useAttempts(lv.level.n === 1 ? null : 3, lv.level.n)

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

  const amplitude = 6 + round.magnitude / 4
  const floors = 5
  const floorHeight = 38
  const baseY = 290

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {phase === 'passed' && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.drift ? <InsightToggle label="drift" on={showDrift} onChange={setShowDrift} /> : undefined}
      />

      <Objective
        goal={`Stand through a magnitude-${Math.round(round.magnitude / 6)} shake${round.budget !== null ? ` for ${round.budget.toLocaleString()} or less` : ''}${round.maxSway !== null ? `, swaying no more than ${round.maxSway}` : ''}`}
        attemptsLeft={att.left}
        met={phase === 'passed'}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
          <Waves className="mr-1 h-4 w-4" />
          {round.label}
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
            {/* floors */}
            {Array.from({ length: floors }, (_, i) => {
              const y = baseY - (i + 1) * floorHeight - (isolation ? 14 : 0) + 14
              return (
                <g key={i}>
                  <rect x="345" y={y} width="115" height={floorHeight - 3} rx="4" fill={frame.fill} />
                  {[360, 392, 424].map((wx) => (
                    <rect key={wx} x={wx} y={y + 9} width="18" height="14" rx="2" className="fill-sky-200 dark:fill-sky-900" />
                  ))}
                </g>
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
            {stability >= round.magnitude
              ? `It stood, but the top floor swung ${sway} and everything inside is wrecked. The limit for a usable building is ${round.maxSway}. Rollers cut the sway nearly in half.`
              : `Down it goes! Stability ${stability} was not enough for a ${round.magnitude} shake. Brace it, upgrade it${round.isolationOffered ? ', or put it on rollers' : ''}.`}
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
                    <span className="block text-xs tabular-nums text-ink-soft dark:text-stone-400">
                      ${f.cost.toLocaleString('en-US')} · stability {f.stability}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="mb-2 font-display text-sm font-semibold">
                2. X-braces (${BRACE_COST.toLocaleString('en-US')} each, +{BRACE_STABILITY})
              </p>
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => rebuild(setBraces)(Math.min(n, MAX_BRACES))}
                    disabled={busy}
                    className={cn(
                      'h-11 w-11 rounded-full border-2 font-display text-sm font-bold tabular-nums transition-colors duration-200',
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
                3. Base isolation (${ISOLATION_COST.toLocaleString('en-US')}, +{ISOLATION_STABILITY})
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
            label="Stability"
            display={`${stability} vs quake ${round.magnitude}`}
            fraction={stability / 60}
            markerFraction={round.magnitude / 60}
            barClass={survives ? 'bg-emerald-500' : 'bg-amber-400'}
          />
          {round.drift && showDrift && (
            <Meter
              label="Top-floor sway"
              display={round.maxSway !== null ? `${sway} of ${round.maxSway} allowed` : `${sway}`}
              fraction={Math.min(1, sway / 24)}
              markerFraction={round.maxSway !== null ? round.maxSway / 24 : undefined}
              barClass={tooSwayey ? 'bg-rose-500' : sway <= 10 ? 'bg-emerald-500' : 'bg-amber-400'}
            />
          )}
          <p className="text-xs text-ink-soft dark:text-stone-400">
            The black line marks how much stability this quake demands.
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
            values={{ cost, sway, margin: stability - round.magnitude }}
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
              ? `Stood at ${sway} of sway for $${cost.toLocaleString('en-US')}. Try the other philosophy.`
              : 'It stands. On to the next one.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
