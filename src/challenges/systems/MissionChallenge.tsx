import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Check, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import { Slider } from '@/components/ui/Slider'
import type { ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
interface MissionRound {
  label: string
  brief: string
  massBudget: number // kg to split across subsystems
  /** Each science point needs this much power. */
  powerPerScience: number
  goals: { science: number; comms: number }
}

/** Each win is a bolder mission on the same mass budget. */
const ROUNDS: MissionRound[] = [
  {
    label: 'Weather satellite',
    brief: 'Take pictures and send them home. Balance the mass so nothing starves.',
    massBudget: 100,
    powerPerScience: 1.2,
    goals: { science: 20, comms: 15 },
  },
  {
    label: 'Deep space probe',
    brief: 'Far from the Sun, power is scarce and comms need to be strong. Every kilogram counts.',
    massBudget: 130,
    powerPerScience: 1.6,
    goals: { science: 30, comms: 28 },
  },
]

/** How much capability each kg buys in each subsystem. */
const YIELD = { power: 2.4, science: 1.0, comms: 1.0, thermal: 1.0 }

export function MissionChallenge({ onComplete }: ChallengeProps) {
  const [roundIndex, setRoundIndex] = useState(0)
  const round = ROUNDS[roundIndex % ROUNDS.length]

  const [mass, setMass] = useState({ power: 25, science: 25, comms: 25, thermal: 25 })
  const [wonRound, setWonRound] = useState(false)
  const completedRef = useRef(false)

  const usedMass = mass.power + mass.science + mass.comms + mass.thermal
  const overMass = usedMass > round.massBudget

  // Capability produced by each subsystem.
  const powerSupply = mass.power * YIELD.power
  const science = mass.science * YIELD.science
  const comms = mass.comms * YIELD.comms
  const coolingNeed = (science + comms) * 0.5
  const cooling = mass.thermal * YIELD.thermal
  // Power drawn by the instruments.
  const powerDemand = science * round.powerPerScience + comms * 0.8

  const checks = {
    science: science >= round.goals.science,
    comms: comms >= round.goals.comms,
    power: powerSupply >= powerDemand,
    thermal: cooling >= coolingNeed,
    mass: !overMass,
  }
  const win = Object.values(checks).every(Boolean)

  useEffect(() => {
    if (win && !wonRound) {
      setWonRound(true)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }
  }, [win, wonRound, onComplete])

  const setPart = (key: keyof typeof mass, value: number) =>
    setMass((prev) => ({ ...prev, [key]: value }))

  const nextRound = () => {
    setRoundIndex((i) => i + 1)
    setMass({ power: 25, science: 25, comms: 25, thermal: 25 })
    setWonRound(false)
  }

  const reset = () => {
    setMass({ power: 25, science: 25, comms: 25, thermal: 25 })
    setWonRound(false)
  }

  const requirements = [
    { ok: checks.science, label: `Science ≥ ${round.goals.science}`, value: `${Math.round(science)}` },
    { ok: checks.comms, label: `Comms ≥ ${round.goals.comms}`, value: `${Math.round(comms)}` },
    { ok: checks.power, label: 'Power supply ≥ demand', value: `${Math.round(powerSupply)}/${Math.round(powerDemand)}` },
    { ok: checks.thermal, label: 'Cooling ≥ heat', value: `${Math.round(cooling)}/${Math.round(coolingNeed)}` },
  ]

  const modules: { key: keyof typeof mass; name: string; ok: boolean; x: number }[] = [
    { key: 'power', name: 'Power', ok: checks.power, x: 250 },
    { key: 'science', name: 'Science', ok: checks.science, x: 350 },
    { key: 'comms', name: 'Comms', ok: checks.comms, x: 450 },
    { key: 'thermal', name: 'Thermal', ok: checks.thermal, x: 550 },
  ]

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
      </div>

      {/* Satellite scene: modules light up when their requirement is met */}
      <div className="overflow-hidden rounded-2xl bg-slate-100/80 dark:bg-slate-950/50">
        <svg viewBox="0 0 800 220" className="w-full" role="img" aria-label="Satellite subsystems">
          {/* stars */}
          {[[80, 40], [180, 150], [700, 60], [640, 170], [120, 90]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="2" className="fill-slate-400 dark:fill-white" opacity="0.3" />
          ))}
          {/* solar panels */}
          <rect x="120" y="90" width="110" height="40" rx="4" className="fill-sky-300 dark:fill-sky-800" />
          <rect x="570" y="90" width="110" height="40" rx="4" className="fill-sky-300 dark:fill-sky-800" />
          <line x1="230" y1="110" x2="250" y2="110" strokeWidth="4" className="stroke-slate-400" />
          <line x1="550" y1="110" x2="570" y2="110" strokeWidth="4" className="stroke-slate-400" />

          {/* body + modules */}
          {modules.map((m) => (
            <g key={m.key}>
              <motion.rect
                x={m.x - 40}
                y="80"
                width="80"
                height="60"
                rx="8"
                animate={{ opacity: m.ok ? 1 : 0.55 }}
                className={m.ok ? '' : 'fill-slate-300 dark:fill-slate-700'}
                style={m.ok ? { fill: 'var(--accent)' } : undefined}
              />
              <text x={m.x} y="66" textAnchor="middle" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">{m.name}</text>
              {m.ok ? (
                <text x={m.x} y="118" textAnchor="middle" fontSize="20" className="fill-white">✓</text>
              ) : (
                <text x={m.x} y="118" textAnchor="middle" fontSize="18" className="fill-slate-500 dark:fill-slate-400">…</text>
              )}
            </g>
          ))}
          {/* dish */}
          <path d="M400 80 q 0 -30 26 -34" fill="none" className="stroke-slate-400" strokeWidth="3" />
        </svg>
      </div>

      {/* Requirements checklist */}
      <div className="mt-4 flex flex-wrap gap-2">
        {requirements.map((r) => (
          <span
            key={r.label}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-display font-semibold',
              r.ok
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-stone-100 text-ink-soft dark:bg-white/5 dark:text-stone-400',
            )}
          >
            {r.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            {r.label}
            <span className="tabular-nums opacity-70">({r.value})</span>
          </span>
        ))}
      </div>

      {/* Mass budget */}
      <div className="mt-4">
        <Meter
          label="Mass budget"
          display={`${usedMass} of ${round.massBudget} kg`}
          fraction={usedMass / round.massBudget}
          barClass={overMass ? 'bg-rose-500' : usedMass / round.massBudget > 0.92 ? 'bg-amber-400' : 'bg-emerald-500'}
        />
      </div>

      {/* Sliders */}
      <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Slider label="Power system (kg)" value={mass.power} min={0} max={70} onChange={(v) => setPart('power', v)} />
        <Slider label="Science instruments (kg)" value={mass.science} min={0} max={70} onChange={(v) => setPart('science', v)} />
        <Slider label="Comms antenna (kg)" value={mass.comms} min={0} max={70} onChange={(v) => setPart('comms', v)} />
        <Slider label="Thermal control (kg)" value={mass.thermal} min={0} max={70} onChange={(v) => setPart('thermal', v)} />
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-3 min-h-[2.5rem]">
        {wonRound ? (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            Every subsystem is happy and you stayed under budget. Cleared for launch!
          </motion.p>
        ) : overMass ? (
          <p className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Too heavy to launch. Take mass from a subsystem that already meets its goal.
          </p>
        ) : (
          <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-300">
            Systems tie together: more science needs more power AND more cooling. Feed the whole chain.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {wonRound && (
          <Button variant="accent" onClick={nextRound}>
            Next mission
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" onClick={reset} aria-label="Reset the design">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Round {(roundIndex % ROUNDS.length) + 1}</Badge>
      </div>
    </Card>
  )
}
