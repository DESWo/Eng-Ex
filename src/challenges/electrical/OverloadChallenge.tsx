import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  Coffee,
  Droplets,
  Fan,
  Flame,
  Lamp,
  Lightbulb,
  Microwave,
  Monitor,
  Refrigerator,
  RotateCcw,
  Snowflake,
  Tv,
  Utensils,
  WashingMachine,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import type { ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
interface Appliance {
  id: string
  label: string
  watts: number
  icon: LucideIcon
}

interface BreakerCircuit {
  id: string
  label: string
  rating: number
}

interface OverloadRound {
  label: string
  circuits: BreakerCircuit[]
  appliances: Appliance[]
}

/** Each win brings a new house with trickier loads. */
const ROUNDS: OverloadRound[] = [
  {
    label: 'The kitchen remodel',
    circuits: [
      { id: 'A', label: 'Circuit A', rating: 1800 },
      { id: 'B', label: 'Circuit B', rating: 1800 },
    ],
    appliances: [
      { id: 'heater', label: 'Heater', watts: 1200, icon: Flame },
      { id: 'kettle', label: 'Kettle', watts: 1100, icon: Coffee },
      { id: 'microwave', label: 'Microwave', watts: 700, icon: Microwave },
      { id: 'tv', label: 'TV', watts: 200, icon: Tv },
      { id: 'lamp', label: 'Lamp', watts: 100, icon: Lamp },
    ],
  },
  {
    label: 'Summer heat wave',
    circuits: [
      { id: 'A', label: 'Circuit A', rating: 1500 },
      { id: 'B', label: 'Circuit B', rating: 1500 },
      { id: 'C', label: 'Circuit C', rating: 1500 },
    ],
    appliances: [
      { id: 'ac', label: 'AC unit', watts: 1400, icon: Snowflake },
      { id: 'dishwasher', label: 'Dishwasher', watts: 1200, icon: Droplets },
      { id: 'microwave', label: 'Microwave', watts: 900, icon: Microwave },
      { id: 'computer', label: 'Computer', watts: 300, icon: Monitor },
      { id: 'tv', label: 'TV', watts: 200, icon: Tv },
      { id: 'lights', label: 'Lights', watts: 150, icon: Lightbulb },
      { id: 'fan', label: 'Fan', watts: 100, icon: Fan },
    ],
  },
  {
    label: 'Laundry day',
    circuits: [
      { id: 'A', label: 'Circuit A', rating: 2000 },
      { id: 'B', label: 'Circuit B', rating: 1600 },
    ],
    appliances: [
      { id: 'dryer', label: 'Dryer', watts: 1800, icon: WashingMachine },
      { id: 'microwave', label: 'Microwave', watts: 900, icon: Microwave },
      { id: 'airfryer', label: 'Air fryer', watts: 450, icon: Utensils },
      { id: 'fridge', label: 'Mini fridge', watts: 250, icon: Refrigerator },
      { id: 'lamp', label: 'Lamp', watts: 100, icon: Lamp },
    ],
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
      <span className="tabular-nums opacity-70">{appliance.watts}W</span>
    </button>
  )
}

export function OverloadChallenge({ onComplete }: ChallengeProps) {
  const [roundIndex, setRoundIndex] = useState(0)
  const [assignment, setAssignment] = useState<Record<string, string | null>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const completedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const round = ROUNDS[roundIndex % ROUNDS.length]

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const loadOf = (circuitId: string) =>
    round.appliances
      .filter((a) => assignment[a.id] === circuitId)
      .reduce((sum, a) => sum + a.watts, 0)

  const unassigned = round.appliances.filter((a) => !assignment[a.id])
  const tripped = round.circuits.filter((c) => loadOf(c.id) > c.rating)

  /** Tap an appliance to pick it up, then tap a circuit (or the pool) to place it. */
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
      if (tripped.length === 0) {
        setPhase('passed')
        if (!completedRef.current) {
          completedRef.current = true
          onComplete()
        }
      } else {
        setPhase('failed')
      }
    }, 900)
  }

  const nextRound = () => {
    setRoundIndex((i) => i + 1)
    setAssignment({})
    setSelectedId(null)
    setPhase('idle')
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm font-semibold text-ink-soft dark:text-stone-400">
          {selectedAppliance
            ? `Now tap a circuit to plug the ${selectedAppliance.label.toLowerCase()} in. Tap the shelf to unplug it.`
            : 'Tap an appliance to pick it up, then tap a circuit to plug it in.'}
        </p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
      </div>

      {/* Unplugged shelf. Tap it (while holding an appliance) to unplug. */}
      <div
        onClick={() => placeSelected(null)}
        className={cn(
          'rounded-2xl border-2 border-dashed p-4 transition-colors duration-200',
          selectedId
            ? 'accent-border cursor-pointer'
            : 'border-stone-200 dark:border-white/10',
        )}
      >
        <p className="mb-3 font-display text-xs font-bold uppercase tracking-widest text-ink-soft dark:text-stone-400">
          The shelf ({unassigned.length} unplugged)
        </p>
        <div className="flex flex-wrap gap-2">
          {unassigned.length === 0 && (
            <p className="text-sm text-ink-soft dark:text-stone-400">
              Everything is plugged in. Hit the power!
            </p>
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
      <div
        className={cn('mt-4 grid gap-4', round.circuits.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}
      >
        {round.circuits.map((circuit) => {
          const load = loadOf(circuit.id)
          const over = load > circuit.rating
          const isTripped = phase === 'failed' && over
          return (
            <motion.div
              key={circuit.id}
              onClick={() => placeSelected(circuit.id)}
              animate={phase === 'testing' ? { opacity: [1, 0.6, 1, 0.7, 1] } : { opacity: 1 }}
              transition={{ duration: 0.8 }}
              className={cn(
                'rounded-2xl border-2 p-4 transition-colors duration-200',
                selectedId && 'accent-border cursor-pointer border-dashed',
                !selectedId && isTripped
                  && 'border-rose-400 bg-rose-50 dark:border-rose-500/50 dark:bg-rose-500/10',
                !selectedId && !isTripped && phase === 'passed'
                  && 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10',
                !selectedId && !isTripped && phase !== 'passed'
                  && 'border-stone-200 dark:border-white/10',
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-sm font-bold">{circuit.label}</p>
                {isTripped && (
                  <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                    Tripped!
                  </Badge>
                )}
              </div>
              <Meter
                label="Load"
                display={`${load.toLocaleString('en-US')}W of ${circuit.rating.toLocaleString('en-US')}W`}
                fraction={load / circuit.rating}
                barClass={over ? 'bg-rose-500' : load / circuit.rating > 0.85 ? 'bg-amber-400' : 'bg-emerald-500'}
              />
              <div className="mt-3 flex min-h-11 flex-wrap gap-2">
                {round.appliances
                  .filter((a) => assignment[a.id] === circuit.id)
                  .map((a) => (
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

      {/* Feedback */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        {phase === 'passed' && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
          >
            Everything hums along safely. Not a single breaker tripped.
          </motion.p>
        )}
        {phase === 'failed' && firstTripped && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300"
          >
            {firstTripped.label} tripped! {loadOf(firstTripped.id).toLocaleString('en-US')}W is more
            than its {firstTripped.rating.toLocaleString('en-US')}W rating. Move something off it.
          </motion.p>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {phase === 'passed' ? (
          <Button variant="accent" size="lg" onClick={nextRound}>
            Next house
            <ArrowRight className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            variant="accent"
            size="lg"
            onClick={powerOn}
            disabled={phase === 'testing' || unassigned.length > 0}
          >
            <Zap className="h-5 w-5" fill="currentColor" />
            {phase === 'testing' ? 'Testing...' : 'Power on!'}
          </Button>
        )}
        <Button variant="ghost" onClick={reset} disabled={phase === 'testing'} aria-label="Unplug everything">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>
    </Card>
  )
}
