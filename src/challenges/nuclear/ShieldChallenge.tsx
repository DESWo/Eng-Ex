import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import { InsightToggle } from '@/components/level/InsightToggle'
import { Objective } from '@/components/level/Objective'
import { RoughCircle, RoughRect } from '@/components/ui/Sketchy'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import { attemptsFor, useAttempts } from '@/hooks/useAttempts'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
/**
 * How strongly each centimetre of a material soaks up each kind of radiation.
 * Dense metals stop gamma rays. Neutrons are stopped by light, hydrogen-rich
 * stuff instead, because a neutron loses most of its energy when it hits
 * something close to its own mass. Lead is nearly useless against them.
 */
const MATERIALS = {
  lead: { label: 'Lead', gamma: 0.8, neutron: 0.05, kgPerCm: 11.3, costPerCm: 8, fill: 'fill-slate-500', ink: 'stroke-slate-700 dark:stroke-slate-300', hatch: 'stroke-slate-500' },
  concrete: { label: 'Concrete', gamma: 0.15, neutron: 0.1, kgPerCm: 2.4, costPerCm: 1, fill: 'fill-stone-400', ink: 'stroke-stone-600 dark:stroke-stone-300', hatch: 'stroke-stone-400' },
  water: { label: 'Water', gamma: 0.07, neutron: 0.35, kgPerCm: 1.0, costPerCm: 0.3, fill: 'fill-sky-400', ink: 'stroke-sky-600 dark:stroke-sky-300', hatch: 'stroke-sky-400' },
  poly: { label: 'Polythene', gamma: 0.06, neutron: 0.45, kgPerCm: 0.95, costPerCm: 2, fill: 'fill-emerald-400', ink: 'stroke-emerald-600 dark:stroke-emerald-300', hatch: 'stroke-emerald-400' },
} as const
type MatId = keyof typeof MATERIALS
const MAT_IDS = Object.keys(MATERIALS) as MatId[]
const SLAB = 2 // centimetres added per slab
const MAX_CM = 20 // per material

interface ShieldSetup {
  /** Strength of each kind of radiation coming out of the source. */
  gammaIn: number
  neutronIn: number
  /** Dose that still counts as safe. */
  safeDose: number
  /** Which materials are on the shelf. */
  available: MatId[]
  /** Shielding mass allowed, or null. */
  massBudget: number | null
  /** Money allowed, or null. */
  costBudget: number | null
  /** Level 4 on: the beam readout is available. */
  beam: boolean
  brief: string
}

const LEVELS: ChallengeLevel<ShieldSetup>[] = [
  {
    n: 1,
    title: 'Block the beam',
    phase: 'play',
    concept: 'Thickness soaks up rays',
    teach: 'Think lane defense: the rays are the invaders, the technician is the house, and your wall is the only thing planted in the lane. Every centimetre of lead cuts the gamma rays down by the same fraction again, so add lead until nothing red reaches the other side.',
    setup: { gammaIn: 1000, neutronIn: 0, safeDose: 5, available: ['lead'], massBudget: null, costBudget: null, beam: false, brief: 'A gamma source in the lab needs a shield between it and the technician.' },
  },
  {
    n: 2,
    title: 'The floor will not take it',
    phase: 'understand',
    concept: 'Mass budget',
    teach: 'Lead is wonderfully dense, which is exactly why it is heavy. This lab floor is only rated for so much, so you cannot just keep stacking.',
    setup: { gammaIn: 1000, neutronIn: 0, safeDose: 5, available: ['lead'], massBudget: 100, costBudget: null, beam: false, brief: 'Same source, but the shield has to sit on an ordinary lab floor.' },
  },
  {
    n: 3,
    title: 'Neutrons too',
    phase: 'understand',
    concept: 'Different rays, different stoppers',
    teach: 'This source throws neutrons as well, and lead barely touches them. Neutrons are slowed by light atoms like the hydrogen in water and plastic. You will need one material for each problem, and the port platform only takes 90 kg.',
    setup: { gammaIn: 800, neutronIn: 800, safeDose: 5, available: MAT_IDS as unknown as MatId[], massBudget: 90, costBudget: null, beam: false, brief: 'A reactor port leaking both gamma rays and neutrons. Lead alone will not save you here.' },
  },
  {
    n: 4,
    title: 'Watch it fall',
    phase: 'analyze',
    concept: 'Layer by layer',
    teach: 'Turn on the beam readout. Each band shows how much of each kind of radiation is left after that layer. You can see which layer is doing the real work, and which is just adding weight.',
    setup: { gammaIn: 900, neutronIn: 700, safeDose: 4, available: MAT_IDS as unknown as MatId[], massBudget: 90, costBudget: null, beam: true, brief: 'A shielded transport flask, with the beam readout switched on.' },
  },
  {
    n: 5,
    title: 'Ship it',
    phase: 'optimize',
    concept: 'Dose, mass, and money',
    teach: 'This shield has to travel, so weight costs fuel and lead costs a fortune. Concrete and water are cheap and light but weak. Find the stack that is safe without being a brick of gold.',
    setup: { gammaIn: 800, neutronIn: 800, safeDose: 5, available: MAT_IDS as unknown as MatId[], massBudget: 100, costBudget: 120, beam: true, brief: 'Design the shipping shield for a medical isotope: safe, light, and affordable.' },
    metrics: [
      // Tuned by scanning every stack: only a layered shield (a little lead for
      // gamma, plenty of water and polythene for neutrons) clears all three.
      { id: 'dose', label: 'Dose outside', goal: 'min', target: 1.2 },
      { id: 'mass', label: 'Shield mass', goal: 'min', target: 95, unit: ' kg' },
      { id: 'cost', label: 'Cost', goal: 'min', target: 70 },
    ],
  },
]

export function ShieldChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('shield', LEVELS)
  const setup = lv.level.setup

  const [thick, setThick] = useState<Record<MatId, number>>({ lead: 0, concrete: 0, water: 0, poly: 0 })
  const [won, setWon] = useState(false)
  const [showBeam, setShowBeam] = useState(true)
  /** Shown only after a certification attempt, never from live state. */
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)
  const completedRef = useRef(false)

  useEffect(() => {
    setThick({ lead: 0, concrete: 0, water: 0, poly: 0 })
    setWon(false)
    setVerdict(null)
  }, [lv.level.n])

  const layers = setup.available.filter((m) => thick[m] > 0)
  let gamma = setup.gammaIn
  let neutron = setup.neutronIn
  // What is left of each beam after every layer it passes through.
  const steps = layers.map((m) => {
    gamma *= Math.exp(-MATERIALS[m].gamma * thick[m])
    neutron *= Math.exp(-MATERIALS[m].neutron * thick[m])
    return { m, gamma, neutron }
  })
  const dose = gamma + neutron
  const mass = setup.available.reduce((s, m) => s + MATERIALS[m].kgPerCm * thick[m], 0)
  const cost = setup.available.reduce((s, m) => s + MATERIALS[m].costPerCm * thick[m], 0)

  const overMass = setup.massBudget !== null && mass > setup.massBudget
  const overCost = setup.costBudget !== null && cost > setup.costBudget
  const solved = dose <= setup.safeDose && !overMass && !overCost

  const reset = () => {
    setThick({ lead: 0, concrete: 0, water: 0, poly: 0 })
    setWon(false)
    setVerdict(null)
  }

  /** The commitment: call the wall done and see if the meter agrees. */
  const certify = () => {
    if (won) return
    if (solved) {
      setWon(true)
      setVerdict({ ok: true, text: `Safe. Only ${dose.toFixed(2)} is getting through, well under ${setup.safeDose}.` })
      lv.clearLevel(lv.level.metrics ? { dose, mass, cost } : undefined)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const text = overMass
      ? `That stack weighs ${Math.round(mass)} kg and the limit is ${setup.massBudget}. Something dense has to go.`
      : overCost
        ? `That stack costs $${Math.round(cost)} and the budget is $${setup.costBudget}. Lead is the expensive part.`
        : neutron > gamma && neutron > setup.safeDose
          ? `Failed: ${Math.round(neutron)} of neutrons still get through. Dense metal barely slows them, so try something light and hydrogen-rich.`
          : `Failed: ${dose < 10 ? dose.toFixed(1) : Math.round(dose)} is getting through and safe is ${setup.safeDose} or less.`
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'Out of test runs. The wall is cleared, the meter is reset. Read the beam before you stack this time.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  /** Add or take away one slab of a material. */
  const addSlab = (m: MatId, delta: number) => {
    setVerdict(null)
    setThick((prev) => ({ ...prev, [m]: Math.max(0, Math.min(MAX_CM, prev[m] + delta)) }))
  }

  /* Scene: source on the left, stacked slabs, technician on the right. */
  const SRC_X = 70
  const TECH_X = 708
  const totalCm = setup.available.reduce((s, m) => s + thick[m], 0)
  const pxPerCm = totalCm > 0 ? Math.min(9, 460 / totalCm) : 9

  // Where each layer sits, shared by the slab art and the particle lanes.
  const wall: { m: MatId; x: number; w: number }[] = []
  {
    let cx = 150
    for (const m of layers) {
      const w = thick[m] * pxPerCm
      wall.push({ m, x: cx, w })
      cx += w
    }
  }
  // Remount the streams whenever the wall changes so every dot re-samples.
  const wallKey = layers.map((m) => `${m}${thick[m]}`).join('-') || 'open'

  /**
   * One lane of radiation, lane-defense style. Each dot stands for a slice of
   * the beam; where it dies is read off the real attenuation curve, so a weak
   * wall visibly lets dots through to the technician (those fly red).
   */
  const lane = (kind: 'gamma' | 'neutron', laneY: number, strength: number, color: string) => {
    if (strength <= 0) return null
    const N = 12
    const dots = []
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N // the survival fraction this dot represents
      let S = 1
      let endX = TECH_X - 18
      let absorbed = false
      for (const { m, x, w } of wall) {
        const muPx = MATERIALS[m][kind] / pxPerCm
        const Sout = S * Math.exp(-muPx * w)
        if (Sout <= u) {
          endX = x + Math.log(S / u) / muPx
          absorbed = true
          break
        }
        S = Sout
      }
      dots.push({ endX, absorbed, delay: (i * 2.4) / N })
    }
    return dots.map((d, i) => (
      <motion.circle
        key={`${wallKey}-${kind}-${i}`}
        r="3.2"
        cy={laneY + ((i % 3) - 1) * 5}
        fill={d.absorbed ? color : '#f43f5e'}
        initial={{ cx: SRC_X + 26, opacity: 0 }}
        animate={{ cx: [SRC_X + 26, d.endX, d.endX], opacity: [0.85, 0.85, 0] }}
        transition={{ duration: 2.4, times: [0, 0.92, 1], delay: d.delay, repeat: Infinity, ease: 'linear' }}
        className="pointer-events-none"
      />
    ))
  }

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.beam ? <InsightToggle label="beam readout" on={showBeam} onChange={setShowBeam} /> : undefined}
      />

      <Objective
        goal={`Get the dose to ${setup.safeDose} or less${setup.massBudget !== null ? `, wall under ${setup.massBudget} kg` : ''}${setup.costBudget !== null ? `, under $${setup.costBudget}` : ''}`}
        status={`getting through now: ${dose < 10 ? dose.toFixed(1) : Math.round(dose)}`}
        attemptsLeft={att.left}
        met={won}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300">Gamma {setup.gammaIn}</Badge>
          {setup.neutronIn > 0 && (
            <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300">Neutrons {setup.neutronIn}</Badge>
          )}
        </div>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl blueprint">
        <svg viewBox="0 0 800 250" className="w-full" role="img" aria-label="Radiation shield stack">
          {/* source */}
          <RoughCircle cx={SRC_X} cy={120} r={22} className="stroke-amber-600" fillClassName="stroke-amber-400" />
          <RoughCircle cx={SRC_X} cy={120} r={11} className="stroke-amber-700" fillClassName="stroke-amber-600" />
          <text x={SRC_X} y="168" textAnchor="middle" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
            Source
          </text>

          {/* the horde: gamma up top, neutrons below, absorbed inside the wall */}
          {lane('gamma', setup.neutronIn > 0 ? 106 : 118, setup.gammaIn, '#a78bfa')}
          {lane('neutron', 134, setup.neutronIn, '#2dd4bf')}

          {/* slabs */}
          {wall.map(({ m, x, w }, i) => {
            const after = steps[i]
            const frac = (after.gamma + after.neutron) / Math.max(1, setup.gammaIn + setup.neutronIn)
            return (
              <g key={m}>
                {/*
                 * The sketched slab is decoration; the transparent rect on top
                 * of it keeps the click target and tooltip a plain rectangle.
                 */}
                <g className="pointer-events-none">
                  <RoughRect
                    x={x}
                    y={62}
                    width={w}
                    height={116}
                    className={MATERIALS[m].ink}
                    fillClassName={MATERIALS[m].hatch}
                  />
                </g>
                <rect
                  x={x}
                  y="62"
                  width={w}
                  height="116"
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => addSlab(m, -SLAB)}
                >
                  <title>{`${MATERIALS[m].label}, click to take 2 cm off`}</title>
                </rect>
                <text x={x + w / 2} y="196" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                  {thick[m]} cm
                </text>
                {setup.beam && showBeam && (
                  <rect x={x + w} y={120 - Math.max(1, frac * 8)} width="6" height={Math.max(2, frac * 16)} className="fill-amber-500" />
                )}
              </g>
            )
          })}

          {/* technician, ringed red while anything is still getting through */}
          {won ? (
            <circle cx="720" cy="118" r="42" fill="none" strokeWidth="2.5" strokeDasharray="5 6" className="stroke-emerald-500/80" />
          ) : (
            <motion.circle
              cx="720"
              cy="118"
              r="42"
              fill="none"
              strokeWidth="2.5"
              className="stroke-rose-500"
              animate={{ opacity: [0.75, 0.2, 0.75] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
          <g transform="translate(720 96)">
            <RoughCircle cx={0} cy={0} r={13} className="stroke-stone-600 dark:stroke-stone-300" fillClassName="stroke-stone-500 dark:stroke-stone-400" />
            <RoughRect x={-11} y={17} width={22} height={42} className="stroke-stone-600 dark:stroke-stone-300" fillClassName="stroke-stone-500 dark:stroke-stone-400" />
          </g>
          <text x="720" y="176" textAnchor="middle" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
            Technician
          </text>

          {setup.beam && showBeam && (
            <g>
              <text x="24" y="228" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                Getting through: gamma {gamma < 1 ? gamma.toFixed(2) : Math.round(gamma)} · neutrons{' '}
                {neutron < 1 ? neutron.toFixed(2) : Math.round(neutron)}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Verdict: only after the player certifies, so the meter is the test */}
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
          <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-400">
            Stack the wall, watch where the dots die, then certify it when you trust it.
          </p>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Meter
          label="Dose outside the shield"
          display={`${dose < 10 ? dose.toFixed(2) : Math.round(dose)} of ${setup.safeDose} allowed`}
          fraction={Math.min(1, dose / (setup.safeDose * 2))}
          markerFraction={0.5}
          barClass={dose <= setup.safeDose ? 'bg-emerald-500' : 'bg-rose-500'}
        />
        {setup.massBudget !== null && (
          <Meter
            label="Shield mass"
            display={`${Math.round(mass)} of ${setup.massBudget} kg`}
            fraction={mass / setup.massBudget}
            barClass={overMass ? 'bg-rose-500' : 'bg-emerald-500'}
          />
        )}
      </div>

      {/* Build the wall out of slabs. Click a material to add, click the wall to remove. */}
      <div className="mt-4">
        <p className="mb-2 font-display text-sm font-semibold">Add a {SLAB} cm slab</p>
        <div className="flex flex-wrap gap-2">
          {setup.available.map((m) => {
            const spec = MATERIALS[m]
            const full = thick[m] >= MAX_CM
            return (
              <button
                key={m}
                type="button"
                onClick={() => addSlab(m, SLAB)}
                disabled={full}
                className={cn(
                  'flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left font-display text-sm font-semibold transition-colors duration-200',
                  'bg-stone-100 text-ink hover:bg-stone-200 disabled:opacity-40 dark:bg-white/5 dark:text-stone-200 dark:hover:bg-white/10',
                )}
              >
                <svg width="16" height="26" aria-hidden>
                  <rect width="16" height="26" rx="3" className={spec.fill} />
                </svg>
                <span>
                  {spec.label}
                  <span className="block text-xs font-medium text-ink-soft dark:text-stone-400">
                    {thick[m]} cm up · {spec.kgPerCm * SLAB} kg each
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-ink-soft dark:text-stone-400">
          Click a slab in the wall to take it back off. Order does not matter, only how much of each.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={certify} disabled={won}>
          <ShieldCheck className="h-5 w-5" />
          Certify the shield
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Clear the shield">
          <RotateCcw className="h-4 w-4" />
          Clear
        </Button>
        <Badge className="ml-auto">
          {Math.round(mass)} kg · ${Math.round(cost)}
        </Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard metrics={lv.level.metrics} values={{ dose, mass, cost }} best={lv.best} scored={won} />
        </div>
      )}

      {won && (
        <LevelComplete
          lv={lv}
          message={
            lv.level.metrics
              ? `Safe at ${Math.round(mass)} kg and $${Math.round(cost)}. Try a cheaper stack.`
              : 'Shielded. Nothing dangerous is getting past that.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
