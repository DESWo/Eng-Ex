import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  Coffee,
  Flame,
  Lamp,
  Lightbulb,
  Microwave,
  Refrigerator,
  RotateCcw,
  Snowflake,
  Utensils,
  WashingMachine,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import { InsightToggle } from '@/components/level/InsightToggle'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import { playSound } from '@/lib/sound'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
// Motors (AC, fridge, dryer...) briefly draw this much EXTRA the instant they
// switch on. A circuit can look fine on steady watts and still trip at startup.
const SURGE = 0.5 // +50% => 1.5x startup draw

interface Appliance {
  id: string
  label: string
  watts: number
  icon: LucideIcon
  /** Motors spike at startup. Their steady bar hides that extra draw. */
  motor?: boolean
}

interface BreakerCircuit {
  id: string
  label: string
  rating: number
}

interface OverloadSetup {
  label: string
  circuits: BreakerCircuit[]
  appliances: Appliance[]
  /** Level 5 on: steady load must stay under 80% of each rating. */
  eightyRule: boolean
  /** Level 4 on: ghost surge markers on the meters. */
  surgeBars: boolean
  brief: string
}

const surgeExtra = (a: Appliance) => (a.motor ? Math.round(a.watts * SURGE) : 0)

const LEVELS: ChallengeLevel<OverloadSetup>[] = [
  {
    n: 1,
    title: 'Trip the breaker once',
    phase: 'play',
    concept: 'Circuits have limits',
    teach: 'It is a block-fitting puzzle where the blocks are appliances and the box is the breaker. Every circuit has a rating, and pushing past it snaps the breaker off. Plug things in, hit the power, and find out the hard way once. That is what breakers are for.',
    setup: {
      label: 'A quiet evening',
      circuits: [
        { id: 'A', label: 'Circuit A', rating: 1800 },
        { id: 'B', label: 'Circuit B', rating: 1800 },
      ],
      appliances: [
        { id: 'kettle', label: 'Kettle', watts: 1100, icon: Coffee },
        { id: 'microwave', label: 'Microwave', watts: 700, icon: Microwave },
        { id: 'lamp', label: 'Lamp', watts: 150, icon: Lamp },
        { id: 'lights', label: 'Lights', watts: 100, icon: Lightbulb },
      ],
      eightyRule: false,
      surgeBars: false,
      brief: 'A small flat with two circuits. Get everything running at once.',
    },
  },
  {
    n: 2,
    title: 'Spread the load',
    phase: 'understand',
    concept: 'Big draws need separating',
    teach: 'The heater and the kettle together beat any single circuit in the house. From now on WHERE you plug something matters as much as whether you do.',
    setup: {
      label: 'Kitchen rush',
      circuits: [
        { id: 'A', label: 'Circuit A', rating: 1800 },
        { id: 'B', label: 'Circuit B', rating: 1800 },
      ],
      appliances: [
        { id: 'heater', label: 'Space heater', watts: 1200, icon: Flame },
        { id: 'kettle', label: 'Kettle', watts: 1100, icon: Coffee },
        { id: 'microwave', label: 'Microwave', watts: 700, icon: Microwave },
        { id: 'toaster', label: 'Toaster', watts: 250, icon: Utensils },
        { id: 'lamp', label: 'Lamp', watts: 150, icon: Lamp },
        { id: 'lights', label: 'Lights', watts: 100, icon: Lightbulb },
      ],
      eightyRule: false,
      surgeBars: false,
      brief: 'Breakfast time, and everything wants power at once.',
    },
  },
  {
    n: 3,
    title: 'The startup kick',
    phase: 'understand',
    concept: 'Motors surge',
    teach: 'Anything with a motor pulls about half as much AGAIN for the instant it starts. A circuit that looks comfortable on steady watts can still snap the moment the fridge kicks in.',
    setup: {
      label: 'Hot afternoon',
      circuits: [
        { id: 'A', label: 'Circuit A', rating: 1800 },
        { id: 'B', label: 'Circuit B', rating: 1800 },
        { id: 'C', label: 'Circuit C', rating: 1800 },
      ],
      appliances: [
        { id: 'ac', label: 'AC unit', watts: 900, icon: Snowflake, motor: true },
        { id: 'oven', label: 'Oven', watts: 1200, icon: Flame },
        { id: 'microwave', label: 'Microwave', watts: 900, icon: Microwave },
        { id: 'toaster', label: 'Toaster', watts: 800, icon: Utensils },
        { id: 'fridge', label: 'Fridge', watts: 400, icon: Refrigerator, motor: true },
        { id: 'lamp', label: 'Lamp', watts: 150, icon: Lamp },
      ],
      eightyRule: false,
      surgeBars: false,
      brief: 'Two motors join the house, and steady watts stop telling the whole story.',
    },
  },
  {
    n: 4,
    title: 'See the spike coming',
    phase: 'analyze',
    concept: 'Ghost surge markers',
    teach: 'Turn on the markers. Each meter now shows a pale extension for the startup spike its motors will cause, so you can see a doomed circuit BEFORE you throw the switch.',
    setup: {
      label: 'Laundry and dinner',
      circuits: [
        { id: 'A', label: 'Circuit A', rating: 2000 },
        { id: 'B', label: 'Circuit B', rating: 1800 },
        { id: 'C', label: 'Circuit C', rating: 1600 },
      ],
      appliances: [
        { id: 'dryer', label: 'Dryer', watts: 1400, icon: WashingMachine },
        { id: 'ac', label: 'AC unit', watts: 800, icon: Snowflake, motor: true },
        { id: 'oven', label: 'Oven', watts: 1000, icon: Flame },
        { id: 'fridge', label: 'Fridge', watts: 350, icon: Refrigerator, motor: true },
        { id: 'airfryer', label: 'Air fryer', watts: 700, icon: Utensils },
        { id: 'lamp', label: 'Lamp', watts: 250, icon: Lamp },
      ],
      eightyRule: false,
      surgeBars: true,
      brief: 'The fullest house yet, with the surge markers switched on.',
    },
  },
  {
    n: 5,
    title: 'Wire it to code',
    phase: 'optimize',
    concept: 'The 80 percent rule',
    teach: 'Real electrical code says a circuit running for hours should sit under 80 percent of its rating, because breakers and wiring heat up. Passing the peak test is no longer enough: every circuit has to run COOL.',
    setup: {
      label: 'Sign-off inspection',
      circuits: [
        { id: 'A', label: 'Circuit A', rating: 2000 },
        { id: 'B', label: 'Circuit B', rating: 2000 },
        { id: 'C', label: 'Circuit C', rating: 1800 },
      ],
      appliances: [
        { id: 'dryer', label: 'Dryer', watts: 1200, icon: WashingMachine },
        { id: 'ac', label: 'AC unit', watts: 800, icon: Snowflake, motor: true },
        { id: 'oven', label: 'Oven', watts: 1000, icon: Flame },
        { id: 'fridge', label: 'Fridge', watts: 350, icon: Refrigerator, motor: true },
        { id: 'airfryer', label: 'Air fryer', watts: 700, icon: Utensils },
        { id: 'lamp', label: 'Lamp', watts: 250, icon: Lamp },
      ],
      eightyRule: true,
      surgeBars: true,
      brief: 'The inspector wants every circuit under 80 percent, spikes included in the peak test.',
    },
  },
]

type Phase = 'idle' | 'testing' | 'passed' | 'failed'

function ApplianceChip({
  appliance,
  onClick,
  assigned,
  selected,
  disabled,
}: {
  appliance: Appliance
  onClick: () => void
  assigned: boolean
  selected: boolean
  disabled: boolean
}) {
  const Icon = appliance.icon
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex items-center gap-2 rounded-full border-2 px-3.5 py-1.5 font-display text-sm font-semibold transition-all duration-200',
        assigned
          ? 'accent-border accent-soft accent-text'
          : 'border-dashed border-stone-300 text-ink-soft hover:border-stone-400 dark:border-white/15 dark:text-stone-400 dark:hover:border-white/30',
        selected && 'scale-105 ring-2 ring-offset-2 ring-[var(--accent)] ring-offset-white dark:ring-offset-night-panel',
      )}
    >
      <Icon className="h-4 w-4" />
      {appliance.label}
      <span className="font-mono tabular-nums opacity-70">{appliance.watts}W</span>
      {appliance.motor && <Zap className="h-3.5 w-3.5 text-amber-500" fill="currentColor" />}
    </button>
  )
}

export function OverloadChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('overload', LEVELS)
  const round = lv.level.setup

  const [assignment, setAssignment] = useState<Record<string, string | null>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [showSurge, setShowSurge] = useState(true)
  const completedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setAssignment({})
    setSelectedId(null)
    setPhase('idle')
  }, [lv.level.n])

  const hasMotors = round.appliances.some((a) => a.motor)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const onCircuit = (circuitId: string) => round.appliances.filter((a) => assignment[a.id] === circuitId)
  /** Steady draw shown on the meters while you arrange. */
  const steadyOf = (circuitId: string) => onCircuit(circuitId).reduce((sum, a) => sum + a.watts, 0)
  /** Peak draw the instant the power comes on (steady + every motor's surge). */
  const peakOf = (circuitId: string) =>
    onCircuit(circuitId).reduce((sum, a) => sum + a.watts + surgeExtra(a), 0)

  const unassigned = round.appliances.filter((a) => !assignment[a.id])
  const tripped = round.circuits.filter((c) => peakOf(c.id) > c.rating)
  // The 80 percent rule: continuous load has to leave headroom for heat.
  const overheated = round.eightyRule
    ? round.circuits.filter((c) => steadyOf(c.id) > c.rating * 0.8)
    : []
  const worstSteadyPct = Math.max(
    ...round.circuits.map((c) => (steadyOf(c.id) / c.rating) * 100),
  )
  const minSurgeMargin = Math.min(...round.circuits.map((c) => c.rating - peakOf(c.id)))

  const clickAppliance = (applianceId: string) => {
    if (phase === 'testing') return
    setPhase('idle')
    setSelectedId((current) => (current === applianceId ? null : applianceId))
  }

  const placeSelected = (circuitId: string | null) => {
    if (phase === 'testing' || selectedId === null) return
    setPhase('idle')
    setAssignment((prev) => ({ ...prev, [selectedId]: circuitId }))
    setSelectedId(null)
  }

  const selectedAppliance = round.appliances.find((a) => a.id === selectedId)

  const powerOn = () => {
    if (phase === 'testing' || unassigned.length > 0) return
    setPhase('testing')
    timerRef.current = setTimeout(() => {
      if (tripped.length === 0 && overheated.length === 0) {
        setPhase('passed')
        playSound('success')
        lv.clearLevel(
          lv.level.metrics
            ? { worst: Math.round(worstSteadyPct), margin: minSurgeMargin }
            : undefined,
        )
        if (!completedRef.current) {
          completedRef.current = true
          onComplete()
        }
      } else {
        setPhase('failed')
        // A breaker snapping open, rather than the generic fail buzz.
        playSound('zap')
      }
    }, 900)
  }

  const reset = () => {
    setAssignment({})
    setSelectedId(null)
    setPhase('idle')
  }

  const firstTripped = tripped[0]

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {phase === 'passed' && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.surgeBars ? <InsightToggle label="surge markers" on={showSurge} onChange={setShowSurge} /> : undefined}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="max-w-md text-sm font-semibold text-ink-soft dark:text-stone-400">
          {selectedAppliance
            ? `Tap a circuit to plug in the ${selectedAppliance.label.toLowerCase()}, or the shelf to set it back.`
            : 'Plug everything in, then hit the power. A breaker trips if its circuit is pushed past its limit.'}
        </p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
      </div>

      {hasMotors && (
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <Zap className="h-3.5 w-3.5" fill="currentColor" />
          Motors draw about 1.5x for a moment when they first switch on.
        </p>
      )}

      {/* Unplugged shelf. Tap it (while holding an appliance) to unplug. */}
      <div
        onClick={() => placeSelected(null)}
        className={cn(
          'rounded-2xl border-2 border-dashed p-4 transition-colors duration-200',
          selectedId ? 'accent-border cursor-pointer' : 'border-stone-200 dark:border-white/10',
        )}
      >
        <p className="mb-3 font-display text-xs font-bold uppercase tracking-widest text-ink-soft dark:text-stone-400">
          The shelf ({unassigned.length} unplugged)
        </p>
        <div className="flex flex-wrap gap-2">
          {unassigned.length === 0 && (
            <p className="text-sm text-ink-soft dark:text-stone-400">Everything is plugged in. Hit the power!</p>
          )}
          {unassigned.map((a) => (
            <ApplianceChip
              key={a.id}
              appliance={a}
              assigned={false}
              selected={selectedId === a.id}
              disabled={phase === 'testing'}
              onClick={() => clickAppliance(a.id)}
            />
          ))}
        </div>
      </div>

      {/* Circuits */}
      <div className={cn('mt-4 grid gap-4', round.circuits.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        {round.circuits.map((circuit) => {
          const steady = steadyOf(circuit.id)
          const isTripped = phase === 'failed' && peakOf(circuit.id) > circuit.rating
          return (
            <motion.div
              key={circuit.id}
              onClick={() => placeSelected(circuit.id)}
              animate={phase === 'testing' ? { opacity: [1, 0.6, 1, 0.7, 1] } : { opacity: 1 }}
              transition={{ duration: 0.8 }}
              className={cn(
                'rounded-2xl border-2 p-4 transition-colors duration-200',
                selectedId && 'accent-border cursor-pointer border-dashed',
                !selectedId && isTripped && 'border-rose-400 bg-rose-50 dark:border-rose-500/50 dark:bg-rose-500/10',
                !selectedId && !isTripped && phase === 'passed' && 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10',
                !selectedId && !isTripped && phase !== 'passed' && 'border-stone-200 dark:border-white/10',
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-sm font-bold">
                  {circuit.label}{' '}
                  <span className="text-xs font-normal text-ink-soft dark:text-stone-400">
                    · {circuit.rating}W limit
                  </span>
                </p>
                {isTripped && (
                  <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">Tripped!</Badge>
                )}
              </div>
              <Meter
                label={phase === 'failed' && isTripped ? 'Startup spike' : 'Steady load'}
                display={
                  phase === 'failed' && isTripped
                    ? `${peakOf(circuit.id).toLocaleString('en-US')}W peak`
                    : round.surgeBars && showSurge && peakOf(circuit.id) > steady
                      ? `${steady.toLocaleString('en-US')}W, spikes to ${peakOf(circuit.id).toLocaleString('en-US')}W`
                      : `${steady.toLocaleString('en-US')}W`
                }
                fraction={(phase === 'failed' && isTripped ? peakOf(circuit.id) : steady) / circuit.rating}
                markerFraction={
                  round.surgeBars && showSurge && peakOf(circuit.id) > steady
                    ? Math.min(1, peakOf(circuit.id) / circuit.rating)
                    : round.eightyRule
                      ? 0.8
                      : undefined
                }
                barClass={
                  isTripped ? 'bg-rose-500' : steady > circuit.rating ? 'bg-rose-500' : steady / circuit.rating > 0.8 ? 'bg-amber-400' : 'bg-emerald-500'
                }
              />
              <div className="mt-3 flex min-h-11 flex-wrap gap-2">
                {onCircuit(circuit.id).map((a) => (
                  <ApplianceChip
                    key={a.id}
                    appliance={a}
                    assigned
                    selected={selectedId === a.id}
                    disabled={phase === 'testing'}
                    onClick={() => clickAppliance(a.id)}
                  />
                ))}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Feedback (observational: what happened, not what to do) */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        {phase === 'passed' && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
          >
            The whole house came on and every breaker held. Nice and steady.
          </motion.p>
        )}
        {phase === 'failed' && !firstTripped && overheated.length > 0 && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
          >
            Nothing tripped, but {overheated[0].label} is running at{' '}
            {Math.round((steadyOf(overheated[0].id) / overheated[0].rating) * 100)}% continuously. Code
            says 80% is the ceiling, because wiring that runs hot for hours is a fire waiting.
          </motion.p>
        )}
        {phase === 'failed' && firstTripped && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300"
          >
            Snap! {firstTripped.label} spiked to {peakOf(firstTripped.id).toLocaleString('en-US')}W the
            instant everything switched on, past its {firstTripped.rating.toLocaleString('en-US')}W limit.
          </motion.p>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={powerOn} disabled={phase === 'testing' || unassigned.length > 0}>
          <Zap className="h-5 w-5" fill="currentColor" />
          {phase === 'testing' ? 'Testing...' : 'Power on!'}
        </Button>
        <Button variant="ghost" onClick={reset} disabled={phase === 'testing'} aria-label="Unplug everything">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ worst: Math.round(worstSteadyPct), margin: minSurgeMargin }}
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
              ? `Every circuit under code, worst at ${Math.round(worstSteadyPct)}%. Try evening them out.`
              : 'Every breaker held.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
