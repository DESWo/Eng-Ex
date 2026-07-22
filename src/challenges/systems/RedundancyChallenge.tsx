import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, Rocket, RotateCcw } from 'lucide-react'
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
 * Four subsystems, all of which have to survive the mission. The odds of that
 * are the odds of each one multiplied together, so the weakest link drags the
 * whole spacecraft down no matter how good the others are.
 */
const PARTS = [
  { name: 'Power', reliability: 0.99, mass: 40, cost: 120 },
  { name: 'Computer', reliability: 0.995, mass: 15, cost: 200 },
  { name: 'Comms', reliability: 0.97, mass: 25, cost: 90 },
  { name: 'Sensor', reliability: 0.92, mass: 30, cost: 70 },
]
const MAX_SPARES = 2

/** With spares running alongside, the part only fails if every copy fails. */
const partReliability = (i: number, spares: number) =>
  1 - Math.pow(1 - PARTS[i].reliability, 1 + spares)

interface RedundancySetup {
  /** Mission survival odds needed, as a percentage. */
  minReliability: number
  /** Mass allowed, or null. */
  maxMass: number | null
  /** Level 4 on: the weak link readout is available. */
  readout: boolean
  brief: string
}

const LEVELS: ChallengeLevel<RedundancySetup>[] = [
  {
    n: 1,
    title: 'One of everything',
    phase: 'play',
    concept: 'Spares raise the odds',
    teach: 'Pick your loadout like a monster-catching team: you cannot bring everything. Every subsystem has to survive for the mission to work, so the odds multiply and land lower than any single part. Fly a spare of something and watch the number climb.',
    setup: { minReliability: 88.5, maxMass: null, readout: false, brief: 'A probe with one of each subsystem. Mission control is not happy with its odds.' },
  },
  {
    n: 2,
    title: 'It has to launch',
    phase: 'understand',
    concept: 'Mass budget',
    teach: 'Spares are whole extra units of hardware and the rocket only lifts so much. You cannot double everything, so the spares you do fly have to be worth their weight.',
    setup: { minReliability: 90, maxMass: 140, readout: false, brief: 'The same probe, now weighed against what the rocket can actually lift.' },
  },
  {
    n: 3,
    title: 'Back the weak link',
    phase: 'understand',
    concept: 'Where redundancy pays',
    teach: 'A spare computer adds almost nothing, because the computer was already going to survive. A spare sensor adds seven percentage points for barely more mass. Redundancy pays where things are likely to break, not where they feel important.',
    setup: { minReliability: 96, maxMass: 170, readout: false, brief: 'A tougher reliability requirement, and only enough mass for two spares.' },
  },
  {
    n: 4,
    title: 'Find the weak link',
    phase: 'analyze',
    concept: 'Who is losing the mission',
    teach: 'Turn on the readout. Each bar is how much of the total failure risk that subsystem is responsible for. The longest bar is where your next spare belongs, and it is rarely the part you would have guessed.',
    setup: { minReliability: 96, maxMass: 175, readout: true, brief: 'The same probe, with each subsystem sized by the risk it contributes.' },
  },
  {
    n: 5,
    title: 'Sign off the design',
    phase: 'optimize',
    concept: 'Odds, mass, and money',
    teach: 'Every spare buys reliability and costs both mass and money, and the cheap parts are not the risky ones. Find the set that gets the odds up without a rocket that cannot lift it.',
    setup: { minReliability: 90, maxMass: null, readout: true, brief: 'Choose the final subsystem layout for the probe.' },
    metrics: [
      { id: 'rel', label: 'Mission survives', goal: 'max', target: 97, unit: '%' },
      { id: 'mass', label: 'Launch mass', goal: 'min', target: 170, unit: ' kg' },
      { id: 'cost', label: 'Build cost', goal: 'min', target: 650 },
    ],
  },
]

export function RedundancyChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('redundancy', LEVELS)
  const setup = lv.level.setup

  // No spares to begin with, so the odds start below every level's bar.
  const [spares, setSpares] = useState<number[]>([0, 0, 0, 0])
  const [won, setWon] = useState(false)
  const [showReadout, setShowReadout] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    setSpares([0, 0, 0, 0])
    setWon(false)
    setVerdict(null)
  }, [lv.level.n])

  const parts = PARTS.map((p, i) => {
    const r = partReliability(i, spares[i])
    return { ...p, spares: spares[i], r, risk: 1 - r }
  })
  const reliability = parts.reduce((p, c) => p * c.r, 1) * 100
  const mass = parts.reduce((s, c) => s + c.mass * (1 + c.spares), 0)
  const cost = parts.reduce((s, c) => s + c.cost * (1 + c.spares), 0)
  const totalRisk = parts.reduce((s, c) => s + c.risk, 0) || 1

  const overMass = setup.maxMass !== null && mass > setup.maxMass
  const solved = reliability >= setup.minReliability && !overMass

  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)

  /** Light the candle. Reliability is only a number until launch day. */
  const launch = () => {
    if (won) return
    if (solved) {
      setWon(true)
      setVerdict({ ok: true, text: `Mission success. ${reliability.toFixed(2)}% odds held up, at ${mass} kg.` })
      lv.clearLevel(lv.level.metrics ? { rel: reliability, mass, cost } : undefined)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const text = overMass
      ? `Scrubbed on the pad: that build is ${mass} kg and the rocket lifts ${setup.maxMass}.`
      : `The review board scored it ${reliability.toFixed(2)}% against a required ${setup.minReliability}%. The post-mortem points at ${weakest.name}: it alone carries ${((weakest.risk / totalRisk) * 100).toFixed(0)}% of the risk.`
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'The launch window closed. Spares unloaded. Back the weakest link, not the most famous part.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  const reset = () => {
    setSpares([0, 0, 0, 0])
    setWon(false)
    setVerdict(null)
  }

  const bump = (i: number, delta: number) => {
    setVerdict(null)
    setSpares((prev) => prev.map((v, j) => (j === i ? Math.max(0, Math.min(MAX_SPARES, v + delta)) : v)))
  }

  const weakest = parts.reduce((a, b) => (b.risk > a.risk ? b : a), parts[0])

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.readout ? <InsightToggle label="risk share" on={showReadout} onChange={setShowReadout} /> : undefined}
      />

      <Objective
        goal={`Mission survival odds of ${setup.minReliability}% or better${setup.maxMass !== null ? `, at most ${setup.maxMass} kg on the pad` : ''}`}
        status={`this build: ${reliability.toFixed(2)}% · ${mass} kg`}
        attemptsLeft={att.left}
        met={won}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
          Needs {setup.minReliability}% odds
        </Badge>
      </div>

      {/* Subsystems */}
      <div className="space-y-2 rounded-2xl bg-stone-100/80 p-4 dark:bg-white/5">
        {parts.map((p, i) => (
          <div key={p.name} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-3 py-2.5 dark:bg-white/5">
            <div className="min-w-[9rem]">
              <p className="font-display text-sm font-bold">{p.name}</p>
              <p className="text-xs text-ink-soft dark:text-stone-400">
                {(PARTS[i].reliability * 100).toFixed(1)}% each · {p.mass} kg · {p.cost}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => bump(i, -1)}
                disabled={p.spares === 0}
                aria-label={`One fewer spare ${p.name}`}
                className="rounded-full bg-stone-100 p-1.5 text-ink-soft transition-colors hover:bg-stone-200 disabled:opacity-30 dark:bg-white/10 dark:text-stone-400"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-24 text-center text-sm font-bold font-mono tabular-nums">
                {p.spares === 0 ? 'no spare' : `${p.spares} spare${p.spares > 1 ? 's' : ''}`}
              </span>
              <button
                type="button"
                onClick={() => bump(i, 1)}
                disabled={p.spares === MAX_SPARES}
                aria-label={`One more spare ${p.name}`}
                className="accent-bg rounded-full p-1.5 text-white transition-opacity hover:brightness-110 disabled:opacity-30"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {setup.readout && showReadout && (
              <div className="flex flex-1 items-center gap-2" style={{ minWidth: 130 }}>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
                  <div
                    className={cn('h-full rounded-full', p.name === weakest.name ? 'bg-rose-500' : 'bg-amber-400')}
                    style={{ width: `${(p.risk / totalRisk) * 100}%` }}
                  />
                </div>
                <span className="w-20 text-right text-xs font-bold font-mono tabular-nums text-ink-soft dark:text-stone-400">
                  {((p.risk / totalRisk) * 100).toFixed(0)}% of risk
                </span>
              </div>
            )}
          </div>
        ))}
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
            Decide which parts deserve a spare, then launch and find out.
          </p>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Meter
          label="Mission survives"
          display={`${reliability.toFixed(2)}% of ${setup.minReliability}% needed`}
          fraction={Math.max(0, (reliability - 80) / 20)}
          markerFraction={Math.max(0, (setup.minReliability - 80) / 20)}
          barClass={reliability >= setup.minReliability ? 'bg-emerald-500' : 'bg-amber-500'}
        />
        {setup.maxMass !== null && (
          <Meter
            label="Launch mass"
            display={`${mass} of ${setup.maxMass} kg`}
            fraction={mass / setup.maxMass}
            barClass={overMass ? 'bg-rose-500' : 'bg-emerald-500'}
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={launch} disabled={won}>
          <Rocket className="h-5 w-5" />
          Launch the mission
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Remove all spares">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">
          {mass} kg · {cost}
        </Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ rel: reliability, mass, cost }}
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
              ? `${reliability.toFixed(2)}% at ${mass} kg. See if a different spare does better.`
              : 'Those odds will fly.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
