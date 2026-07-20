import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, RotateCcw, X } from 'lucide-react'
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
const BLOCK = 5 // kilograms per block
const MAX_BLOCKS = 14

interface MissionSetup {
  label: string
  brief: string
  massBudget: number
  /** Each science point needs this much power. */
  powerPerScience: number
  goals: { science: number; comms: number }
  /** Level 2 on: instruments draw power that the panels must supply. */
  powerCheck: boolean
  /** Level 3 on: instruments also make heat the radiators must dump. */
  thermalCheck: boolean
  /** Level 4 on: the flow readout is available. */
  flows: boolean
}

const LEVELS: ChallengeLevel<MissionSetup>[] = [
  {
    n: 1,
    title: 'Fit it together',
    phase: 'play',
    concept: 'A satellite is a team',
    teach: 'Deal out mass blocks to the subsystems. Science instruments earn the mission its keep and the comms antenna phones the results home, so give each what its goal asks for.',
    setup: { label: 'Weather satellite', brief: 'Take pictures and send them home. The rocket has room to spare today.', massBudget: 160, powerPerScience: 1.2, goals: { science: 20, comms: 15 }, powerCheck: false, thermalCheck: false, flows: false },
  },
  {
    n: 2,
    title: 'Nothing runs on hope',
    phase: 'understand',
    concept: 'Power is a subsystem too',
    teach: 'Instruments draw power, and power comes from panels that weigh something. The mass you give the power system does nothing for the goals directly, and the mission dies without it.',
    setup: { label: 'Weather satellite II', brief: 'A bigger instrument package, and this time the electricity has to come from somewhere.', massBudget: 90, powerPerScience: 1.2, goals: { science: 30, comms: 25 }, powerCheck: true, thermalCheck: false, flows: false },
  },
  {
    n: 3,
    title: 'Everything leans on everything',
    phase: 'understand',
    concept: 'Coupled subsystems',
    teach: 'Now the heat matters too: every instrument warms the craft and the radiators must dump it. Add science and you need more power AND more cooling, which both cost mass you wanted for science. That circle is systems engineering.',
    setup: { label: 'Deep space probe', brief: 'Far from the Sun, every subsystem pulls on every other one.', massBudget: 120, powerPerScience: 1.6, goals: { science: 30, comms: 25 }, powerCheck: true, thermalCheck: true, flows: false },
  },
  {
    n: 4,
    title: 'Watch the flows',
    phase: 'analyze',
    concept: 'Supply against demand',
    teach: 'Turn on the flow readout. Power flows from the panels to the instruments and heat flows out through the radiators, and you can see exactly which pipe is about to starve.',
    setup: { label: 'Survey probe', brief: 'A heavier survey mission, fully instrumented.', massBudget: 135, powerPerScience: 1.6, goals: { science: 35, comms: 28 }, powerCheck: true, thermalCheck: true, flows: true },
  },
  {
    n: 5,
    title: 'Science per kilogram',
    phase: 'optimize',
    concept: 'Margins cost science',
    teach: 'The agency wants maximum science, but a craft with zero margin dies the first time anything sags. Leave spare mass and spare power, and every scrap of both is science you did not fly.',
    setup: { label: 'Flagship mission', brief: 'Squeeze out the science, but leave enough slack that one bad day does not end the mission.', massBudget: 130, powerPerScience: 1.4, goals: { science: 25, comms: 20 }, powerCheck: true, thermalCheck: true, flows: true },
    metrics: [
      { id: 'science', label: 'Science flown', goal: 'max', target: 35 },
      { id: 'spare', label: 'Mass margin', goal: 'max', target: 10, unit: ' kg' },
      { id: 'power', label: 'Power margin', goal: 'max', target: 8 },
    ],
  },
]

/** How much capability each kg buys in each subsystem. */
const YIELD = { power: 2.4, science: 1.0, comms: 1.0, thermal: 1.0 }

export function MissionChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('mission', LEVELS)
  const round = lv.level.setup

  // Start lean so no level clears itself on load.
  const [mass, setMass] = useState({ power: 10, science: 10, comms: 10, thermal: 10 })
  const [wonRound, setWonRound] = useState(false)
  const [showFlows, setShowFlows] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    setMass({ power: 10, science: 10, comms: 10, thermal: 10 })
    setWonRound(false)
  }, [lv.level.n])

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
    power: !round.powerCheck || powerSupply >= powerDemand,
    thermal: !round.thermalCheck || cooling >= coolingNeed,
    mass: !overMass,
  }
  const win = Object.values(checks).every(Boolean)

  useEffect(() => {
    if (!win || wonRound) return
    const timer = setTimeout(() => {
      setWonRound(true)
      lv.clearLevel(
        lv.level.metrics
          ? {
              science: Math.round(science),
              spare: round.massBudget - usedMass,
              power: Math.round(powerSupply - powerDemand),
            }
          : undefined,
      )
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win, wonRound, science, usedMass, powerSupply, powerDemand])

  const setPart = (key: keyof typeof mass, value: number) =>
    setMass((prev) => ({ ...prev, [key]: value }))

  const reset = () => {
    setMass({ power: 10, science: 10, comms: 10, thermal: 10 })
    setWonRound(false)
  }

  const requirements = [
    { ok: checks.science, label: `Science ≥ ${round.goals.science}`, value: `${Math.round(science)}` },
    { ok: checks.comms, label: `Comms ≥ ${round.goals.comms}`, value: `${Math.round(comms)}` },
    ...(round.powerCheck
      ? [{ ok: checks.power, label: 'Power supply ≥ demand', value: `${Math.round(powerSupply)}/${Math.round(powerDemand)}` }]
      : []),
    ...(round.thermalCheck
      ? [{ ok: checks.thermal, label: 'Cooling ≥ heat', value: `${Math.round(cooling)}/${Math.round(coolingNeed)}` }]
      : []),
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

      <LevelHeader
        lv={lv}
        insight={round.flows ? <InsightToggle label="flows" on={showFlows} onChange={setShowFlows} /> : undefined}
      />

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

      {/* Level 4 flows: how full each supply pipe runs */}
      {round.flows && showFlows && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Meter
            label="Power pipe"
            display={`${Math.round(powerDemand)} drawn of ${Math.round(powerSupply)} made`}
            fraction={powerSupply > 0 ? Math.min(1, powerDemand / powerSupply) : 1}
            barClass={checks.power ? 'bg-sky-500' : 'bg-rose-500'}
          />
          <Meter
            label="Heat pipe"
            display={`${Math.round(coolingNeed)} made of ${Math.round(cooling)} dumped`}
            fraction={cooling > 0 ? Math.min(1, coolingNeed / cooling) : 1}
            barClass={checks.thermal ? 'bg-amber-500' : 'bg-rose-500'}
          />
        </div>
      )}

      {/* Mass budget */}
      <div className="mt-4">
        <Meter
          label="Mass budget"
          display={`${usedMass} of ${round.massBudget} kg`}
          fraction={usedMass / round.massBudget}
          barClass={overMass ? 'bg-rose-500' : usedMass / round.massBudget > 0.92 ? 'bg-amber-400' : 'bg-emerald-500'}
        />
      </div>

      {/* Hand out the mass budget as physical blocks, five kilograms at a time. */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {([
          ['power', 'Power system'],
          ['science', 'Science instruments'],
          ['comms', 'Comms antenna'],
          ['thermal', 'Thermal control'],
        ] as const).map(([key, label]) => {
          const blocks = Math.round(mass[key] / BLOCK)
          return (
            <div key={key} className="rounded-2xl bg-stone-100 p-3 dark:bg-white/5">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="font-display text-sm font-semibold">{label}</p>
                <span className="accent-text font-display text-sm font-bold tabular-nums">{mass[key]} kg</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: MAX_BLOCKS }, (_, i) => {
                  const filled = i < blocks
                  const canAdd = !filled && i === blocks && usedMass + BLOCK <= round.massBudget
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!filled && !canAdd}
                      onClick={() => setPart(key, (filled ? i : i + 1) * BLOCK)}
                      aria-label={`${filled ? 'Remove' : 'Add'} ${BLOCK} kg on ${label}`}
                      className={cn(
                        'h-6 w-6 rounded transition-colors duration-150',
                        filled
                          ? 'accent-bg shadow-clay'
                          : canAdd
                            ? 'border-2 border-dashed border-stone-300 hover:border-stone-400 dark:border-white/20'
                            : 'border-2 border-dashed border-stone-200 opacity-40 dark:border-white/10',
                      )}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-ink-soft dark:text-stone-400">
        Each block is {BLOCK} kg. Blocks grey out when the rocket has nothing left to give.
      </p>

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
            Some subsystems still are not getting what they need. Notice which ones lean on the others.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={reset} aria-label="Reset the design">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">{round.massBudget - usedMass} kg spare</Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{
              science: Math.round(science),
              spare: round.massBudget - usedMass,
              power: Math.round(powerSupply - powerDemand),
            }}
            best={lv.best}
            scored={wonRound}
          />
        </div>
      )}

      {wonRound && (
        <LevelComplete
          lv={lv}
          message={
            lv.level.metrics
              ? `${Math.round(science)} science flown with ${round.massBudget - usedMass} kg in hand. Push it further.`
              : 'Cleared for launch.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
