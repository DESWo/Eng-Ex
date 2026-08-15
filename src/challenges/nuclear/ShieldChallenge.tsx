import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { InsightToggle } from '@/components/level/InsightToggle'
import { Objective } from '@/components/level/Objective'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import {
  AnnunciatorPanel,
  ChartRecorder,
  DigitalWindow,
  Engraved,
  Gauge,
  GuardedControl,
  IlluminatedButton,
  INK,
  MimicBoard,
  MimicLamp,
  Note,
  PanelBay,
  PanelSurface,
  Plate,
  clamp01,
  useAnnunciators,
} from '@/components/instruments/panel'
import type { AnnunciatorDef } from '@/components/instruments/panel'
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
 *
 * `ink` and `hatch` are board colours only: the slabs are drawn as a section
 * through the wall, hatched the way a shop drawing hatches materials.
 */
const MATERIALS = {
  lead: { label: 'Lead', gamma: 0.8, neutron: 0.05, kgPerCm: 11.3, costPerCm: 8, ink: '#9aa6b0', hatch: 'dense' },
  concrete: { label: 'Concrete', gamma: 0.15, neutron: 0.1, kgPerCm: 2.4, costPerCm: 1, ink: '#b5a58a', hatch: 'aggregate' },
  water: { label: 'Water', gamma: 0.07, neutron: 0.35, kgPerCm: 1.0, costPerCm: 0.3, ink: '#4a9fd0', hatch: 'wave' },
  poly: { label: 'Polyethylene', gamma: 0.06, neutron: 0.45, kgPerCm: 0.95, costPerCm: 2, ink: '#5fc39a', hatch: 'sparse' },
} as const
type MatId = keyof typeof MATERIALS
const MAT_IDS = Object.keys(MATERIALS) as MatId[]
const SLAB = 2 // centimetres added per slab
const MAX_CM = 20 // per material

/* --------------- board only, never read by the sim --------------- */
/** Survey meter ranges, full scale. The meter reads the same dose on any of them. */
const RANGES = [10, 100, 1000] as const
/** Bottom of the beam profile paper, so a decade scale has somewhere to end. */
const PROFILE_FLOOR = 0.05
/** Samples taken across the wall for the profile trace. */
const PROFILE_N = 64
/** Dot colours in the beam line. Red is radiation that reaches the technician. */
const GAMMA_INK = '#a78bfa'
const NEUTRON_INK = '#2dd4bf'
const LEAK_INK = '#e0574a'

const ALARMS: AnnunciatorDef[] = [
  { id: 'dose', legend: 'Dose above limit', tone: 'red' },
  { id: 'neutron', legend: 'Neutron dose high', tone: 'amber' },
  { id: 'scale', legend: 'Meter off scale', tone: 'amber' },
  { id: 'mass', legend: 'Over floor limit', tone: 'red' },
  { id: 'cost', legend: 'Over cost budget', tone: 'amber' },
  { id: 'bench', legend: 'Bench reset', tone: 'white' },
]

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
      // Pars come from scanning all 14,641 stacks: 1,135 are safe and inside
      // both budgets, and none of them clears all three pars. Any two are
      // reachable, and each pair wants a different wall: 6 cm of lead with 20
      // water and 6 poly for dose and mass, 4 cm of lead with 12 concrete for
      // dose and cost, a thinner neutron stack for mass and cost. The $70 par
      // was the loose one, since that first wall swept all three at $66.
      { id: 'dose', label: 'Dose outside', goal: 'min', target: 1.2 },
      { id: 'mass', label: 'Shield mass', goal: 'min', target: 95, unit: ' kg' },
      { id: 'cost', label: 'Cost', goal: 'min', target: 60 },
    ],
  },
]

/* Beam line geometry, in mimic units. */
const SRC_X = 46
const BEAM_START = 74
const BEAM_END = 522
const WALL_X = 140

/** Section hatch for each material, drawn once into the mimic defs. */
function Hatches() {
  return (
    <defs>
      {MAT_IDS.map((m) => {
        const { ink, hatch } = MATERIALS[m]
        return (
          <pattern key={m} id={`hatch-${m}`} width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#1a2025" />
            {hatch === 'dense' && <path d="M-2 2 L2 -2 M0 8 L8 0 M6 10 L10 6" stroke={ink} strokeWidth="1.6" opacity="0.75" />}
            {hatch === 'sparse' && <path d="M0 8 L8 0" stroke={ink} strokeWidth="1.2" opacity="0.6" />}
            {hatch === 'wave' && <path d="M0 2 q2 -2 4 0 t4 0 M0 6 q2 -2 4 0 t4 0" fill="none" stroke={ink} strokeWidth="1.1" opacity="0.7" />}
            {hatch === 'aggregate' && (
              <g fill={ink} opacity="0.65">
                <circle cx="2" cy="2" r="1.2" />
                <circle cx="6" cy="5" r="0.9" />
                <circle cx="3.5" cy="6.5" r="0.7" />
              </g>
            )}
          </pattern>
        )
      })}
    </defs>
  )
}

export function ShieldChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('shield', LEVELS)
  const setup = lv.level.setup

  const [thick, setThick] = useState<Record<MatId, number>>({ lead: 0, concrete: 0, water: 0, poly: 0 })
  const [won, setWon] = useState(false)
  const [showBeam, setShowBeam] = useState(true)
  /** Shown only after a certification attempt, never from live state. */
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  /** Board state: which slab the loader is holding, and the meter range. */
  const [sel, setSel] = useState<MatId>(setup.available[0])
  const [range, setRange] = useState(RANGES.length - 1)
  /** Latches the white window when the last test run cleared the bench. */
  const [benchReset, setBenchReset] = useState(false)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)
  const completedRef = useRef(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    setThick({ lead: 0, concrete: 0, water: 0, poly: 0 })
    setWon(false)
    setVerdict(null)
    setSel(setup.available[0])
    setRange(RANGES.length - 1)
    setBenchReset(false)
  }, [lv.level.n, setup.available])

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

  /** Levels 2, 3 and 5 hide the dose until the player certifies the wall. */
  const outcomeVisible = lv.level.n === 1 || lv.level.n === 4 || verdict !== null || won

  const reset = () => {
    setThick({ lead: 0, concrete: 0, water: 0, poly: 0 })
    setWon(false)
    setVerdict(null)
    setBenchReset(false)
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
          ? `Failed: ${Math.round(neutron)} of neutrons are still getting through, and piling on more lead is barely denting them.`
          : `Failed: ${dose < 10 ? dose.toFixed(1) : Math.round(dose)} is getting through and safe is ${setup.safeDose} or less.`
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'Out of test runs. The wall is cleared, the meter is reset. Read the beam before you stack this time.' })
      setBenchReset(true)
    } else {
      setVerdict({ ok: false, text })
    }
  }

  /** Add or take away one slab of a material. */
  const addSlab = (m: MatId, delta: number) => {
    setVerdict(null)
    setBenchReset(false)
    setThick((prev) => ({ ...prev, [m]: Math.max(0, Math.min(MAX_CM, prev[m] + delta)) }))
  }

  /* ---------- the board ---------- */
  const totalCm = setup.available.reduce((s, m) => s + thick[m], 0)
  const rangeFull = RANGES[range]
  const doseText = dose < 10 ? dose.toFixed(2) : `${Math.round(dose)}`
  const beamOn = setup.beam && showBeam

  // Alarm conditions are read off the same numbers the operator can see. The
  // dose windows stay dark while the channel is isolated, so a latched tile
  // never gives away a reading the student has not earned yet.
  const alarms = useAnnunciators(ALARMS, {
    dose: outcomeVisible && dose > setup.safeDose,
    neutron: outcomeVisible && neutron > gamma && neutron > setup.safeDose,
    scale: outcomeVisible && dose > rangeFull,
    mass: overMass,
    cost: overCost,
    bench: benchReset,
  })

  const clearAlarms = alarms.reset
  useEffect(() => {
    clearAlarms()
  }, [lv.level.n, clearAlarms])

  /** Stripping the wall starts the run over, so the windows go dark with it. */
  const stripWall = () => {
    clearAlarms()
    reset()
  }

  /* ---------- the beam line ---------- */
  const pxPerCm = totalCm > 0 ? Math.min(9, 360 / totalCm) : 9

  // Where each layer sits, shared by the slab art and the particle lanes.
  const wall: { m: MatId; x: number; w: number }[] = []
  {
    let cx = WALL_X
    for (const m of layers) {
      const w = thick[m] * pxPerCm
      wall.push({ m, x: cx, w })
      cx += w
    }
  }
  // Remount the streams whenever the wall changes so every dot re-samples.
  const wallKey = layers.map((m) => `${m}${thick[m]}`).join('-') || 'open'

  /**
   * One lane of radiation. Each dot is a slice of the beam, and where it stops
   * is read off the attenuation curve, so leakage on screen matches the dose.
   */
  const lane = (kind: 'gamma' | 'neutron', laneY: number, strength: number, color: string) => {
    if (strength <= 0) return null
    const N = 12
    const dots = []
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N // the survival fraction this dot represents
      let S = 1
      let endX = BEAM_END
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
    // Reduced motion gets the same information as a still: every dot parked
    // where the beam ran out of it.
    if (reduced) {
      return dots.map((d, i) => (
        <circle
          key={`${wallKey}-${kind}-${i}`}
          r="3.2"
          cx={d.endX}
          cy={laneY + ((i % 3) - 1) * 5}
          fill={d.absorbed ? color : LEAK_INK}
          opacity="0.85"
        />
      ))
    }
    return dots.map((d, i) => (
      <motion.circle
        key={`${wallKey}-${kind}-${i}`}
        r="3.2"
        cy={laneY + ((i % 3) - 1) * 5}
        fill={d.absorbed ? color : LEAK_INK}
        initial={{ cx: BEAM_START, opacity: 0 }}
        animate={{ cx: [BEAM_START, d.endX, d.endX], opacity: [0.85, 0.85, 0] }}
        transition={{ duration: 2.4, times: [0, 0.92, 1], delay: d.delay, repeat: Infinity, ease: 'linear' }}
        className="pointer-events-none"
      />
    ))
  }

  /* ---------- beam profile paper ---------- */
  // Intensity through the wall on a decade scale, sampled at even depths. Same
  // attenuation curve the sim uses, read at points between the layer faces.
  const profileTop = Math.max(10, setup.gammaIn + setup.neutronIn)
  const logSpan = Math.log10(profileTop) - Math.log10(PROFILE_FLOOR)
  const logPos = (v: number) => clamp01((Math.log10(Math.max(v, PROFILE_FLOOR)) - Math.log10(PROFILE_FLOOR)) / logSpan)
  const profile = { g: [] as number[], n: [] as number[] }
  if (beamOn) {
    for (let i = 0; i < PROFILE_N; i++) {
      let rem = (i / (PROFILE_N - 1)) * totalCm
      let gv = setup.gammaIn
      let nv = setup.neutronIn
      for (const m of layers) {
        const t = Math.min(thick[m], rem)
        if (t <= 0) break
        gv *= Math.exp(-MATERIALS[m].gamma * t)
        nv *= Math.exp(-MATERIALS[m].neutron * t)
        rem -= t
      }
      profile.g.push(logPos(gv))
      profile.n.push(logPos(nv))
    }
  }

  const fmt = (v: number) => (v < 1 ? v.toFixed(2) : `${Math.round(v)}`)
  const gammaLane = setup.neutronIn > 0 ? 84 : 100
  const massMax = setup.massBudget !== null ? setup.massBudget * 2 : 200
  const spec = MATERIALS[sel]
  const status = verdict
    ? verdict.text
    : 'Pick a material, load slabs into the beam line, then lift the guard and certify the wall.'

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.beam ? <InsightToggle label="beam readout" on={showBeam} onChange={setShowBeam} /> : undefined}
      />

      <Objective
        goal={`Get the dose to ${setup.safeDose} or less${setup.massBudget !== null ? `, wall under ${setup.massBudget} kg` : ''}${setup.costBudget !== null ? `, under $${setup.costBudget}` : ''}`}
        status={
          outcomeVisible
            ? `getting through now: ${dose < 10 ? dose.toFixed(1) : Math.round(dose)}`
            : `wall so far: ${totalCm} cm · certify to find out`
        }
        attemptsLeft={att.left}
        met={won}
      />

      <div className="mb-4">
        <p className="max-w-xl text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
      </div>

      <PanelSurface
        title="Shielding bench · survey station"
        header={
          <>
            <Plate label="Dose limit" value={`${setup.safeDose} µSv/h`} />
            <Plate label="Gamma source" value={setup.gammaIn} />
            {setup.neutronIn > 0 && <Plate label="Neutron source" value={setup.neutronIn} />}
            {setup.massBudget !== null && <Plate label="Floor limit" value={`${setup.massBudget} kg`} />}
            {setup.costBudget !== null && <Plate label="Cost budget" value={`$${setup.costBudget}`} />}
          </>
        }
      >
        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_248px]">
          <PanelBay
            legend="Beam line"
            right={
              <div className="flex flex-wrap items-center gap-1.5">
                <DigitalWindow value={totalCm} unit="cm wall" />
                <DigitalWindow value={Math.round(mass)} unit="kg" tone={overMass ? 'alarm' : 'normal'} />
                {setup.costBudget !== null && (
                  <DigitalWindow value={`$${Math.round(cost)}`} tone={overCost ? 'alarm' : 'normal'} />
                )}
              </div>
            }
          >
            <MimicBoard
              legend="Cell elevation"
              viewBox="0 0 640 212"
              summary={`Beam line. Source on the left, ${totalCm} centimetres of shielding in ${layers.length} layer${layers.length === 1 ? '' : 's'}, technician on the right.${
                outcomeVisible ? ` Detector reads ${doseText} against a limit of ${setup.safeDose}.` : ' The detector channel is isolated.'
              }`}
            >
              <Hatches />
              {/* floor line and beam centreline */}
              <path d="M12 178 H 628" stroke={INK.lineDim} strokeWidth="1.5" />
              <path d={`M${BEAM_START} ${gammaLane} H ${BEAM_END}`} stroke={INK.lineDim} strokeWidth="0.8" strokeDasharray="3 5" />
              {setup.neutronIn > 0 && (
                <path d={`M${BEAM_START} 116 H ${BEAM_END}`} stroke={INK.lineDim} strokeWidth="0.8" strokeDasharray="3 5" />
              )}

              {/* the source pig, open on the beam side */}
              <rect x={SRC_X - 22} y="62" width="44" height="76" rx="5" fill="#232a30" stroke={INK.line} strokeWidth="2" />
              <circle cx={SRC_X} cy="100" r="9" fill="#e6a72e" opacity="0.85" />
              <path d={`M${SRC_X + 22} 84 L${BEAM_START} 76 L${BEAM_START} 124 L${SRC_X + 22} 116 Z`} fill="#e6a72e" opacity="0.14" />
              <text x={SRC_X} y="198" textAnchor="middle" fontSize="9" letterSpacing="1.4" fill={INK.text} className="font-body">
                SOURCE
              </text>

              {/* the horde: gamma up top, neutrons below, absorbed inside the wall */}
              {lane('gamma', gammaLane, setup.gammaIn, GAMMA_INK)}
              {lane('neutron', 116, setup.neutronIn, NEUTRON_INK)}

              {/* the wall, drawn as a hatched section */}
              {wall.map(({ m, x, w }, i) => {
                const after = steps[i]
                return (
                  <g key={m}>
                    <g className="pointer-events-none">
                      <rect x={x} y="44" width={w} height="120" fill={`url(#hatch-${m})`} />
                      <rect
                        x={x}
                        y="44"
                        width={w}
                        height="120"
                        fill="none"
                        stroke={MATERIALS[m].ink}
                        strokeWidth={sel === m ? 2.5 : 1.2}
                        opacity={sel === m ? 1 : 0.7}
                      />
                      <text x={x + w / 2} y="176" textAnchor="middle" fontSize="10" className="font-mono" fill={INK.textBright}>
                        {thick[m]}
                      </text>
                      {beamOn && w > 24 && (
                        <>
                          <text x={x + w / 2} y="30" textAnchor="middle" fontSize="8" className="font-mono" fill={GAMMA_INK}>
                            {fmt(after.gamma)}
                          </text>
                          {setup.neutronIn > 0 && (
                            <text x={x + w / 2} y="40" textAnchor="middle" fontSize="8" className="font-mono" fill={NEUTRON_INK}>
                              {fmt(after.neutron)}
                            </text>
                          )}
                        </>
                      )}
                    </g>
                    {/* selecting a layer by clicking it: the caps do the same job by keyboard */}
                    <rect x={x} y="44" width={w} height="120" fill="transparent" className="cursor-pointer" onClick={() => setSel(m)}>
                      <title>{`${MATERIALS[m].label}, ${thick[m]} cm. Click to load the slab handler with it.`}</title>
                    </rect>
                  </g>
                )
              })}

              {/* detector head and the technician behind it */}
              <rect x={BEAM_END} y="86" width="14" height="28" rx="3" fill="#232a30" stroke={INK.line} strokeWidth="1.5" />
              <path d={`M${BEAM_END + 14} 100 H 560`} stroke={INK.line} strokeWidth="1.5" />
              <rect x="560" y="82" width="34" height="36" rx="4" fill="#232a30" stroke={INK.line} strokeWidth="1.5" />
              <MimicLamp
                x={577}
                y={64}
                tone={!outcomeVisible ? 'white' : dose <= setup.safeDose ? 'green' : 'red'}
                lit={outcomeVisible}
              />
              <g stroke={INK.line} strokeWidth="1.8" fill="none">
                <circle cx="614" cy="92" r="9" />
                <path d="M614 101 V 140 M600 114 H 628 M614 140 L604 166 M614 140 L624 166" />
              </g>
              <text x="577" y="198" textAnchor="middle" fontSize="9" letterSpacing="1.4" fill={INK.text} className="font-body">
                DETECTOR
              </text>
            </MimicBoard>
          </PanelBay>

          <PanelBay legend="Survey instruments">
            <div className="relative">
              <Gauge
                label="Dose at the technician"
                unit="µSv/h"
                value={outcomeVisible ? dose : 0}
                min={0}
                max={rangeFull}
                majorTicks={6}
                bands={[
                  { from: 0, to: setup.safeDose, tone: 'green' },
                  { from: setup.safeDose, to: rangeFull, tone: 'red' },
                ]}
                readout={outcomeVisible ? doseText : '- - -'}
                valueText={
                  outcomeVisible
                    ? `${doseText} microsieverts per hour, limit ${setup.safeDose}`
                    : 'Dose channel isolated, certify the wall to read it'
                }
                tone={outcomeVisible && dose > setup.safeDose ? 'alarm' : 'normal'}
              />
              {!outcomeVisible && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-0 top-3 -rotate-6 rounded-[3px] border border-black/50 bg-[#d8c69a] px-2 py-1"
                  style={{ boxShadow: '0 2px 5px rgb(0 0 0 / 0.55)' }}
                >
                  <span className="block font-body text-[9px] font-bold uppercase tracking-[0.12em] text-[#2a1c00]">
                    Channel isolated
                  </span>
                </span>
              )}
            </div>

            <div className="mt-2">
              <Engraved className="mb-1.5 block">Meter range</Engraved>
              <div className="flex flex-wrap gap-1">
                {RANGES.map((full, i) => (
                  <IlluminatedButton
                    key={full}
                    legend={`×${10 ** i}`}
                    sub={`0-${full}`}
                    lit={range === i}
                    tone="white"
                    pressed={range === i}
                    onClick={() => setRange(i)}
                    ariaLabel={`Survey meter range times ${10 ** i}, full scale ${full} microsieverts per hour`}
                    className="min-w-[68px] flex-1"
                  />
                ))}
              </div>
              <Note className="mt-1.5">Switching range moves the needle, not the dose.</Note>
            </div>

            {setup.massBudget !== null && (
              <div className="mt-2 border-t border-white/8 pt-2">
                <Gauge
                  label="Shield mass"
                  unit="kg"
                  value={mass}
                  min={0}
                  max={massMax}
                  majorTicks={5}
                  bands={[{ from: setup.massBudget, to: massMax, tone: 'red' }]}
                  readout={`${Math.round(mass)}`}
                  valueText={`${Math.round(mass)} kilograms, floor limit ${setup.massBudget}`}
                  tone={overMass ? 'alarm' : 'normal'}
                />
              </div>
            )}
          </PanelBay>
        </div>

        {beamOn && (
          <PanelBay legend="Beam profile">
            <ChartRecorder
              legend="Chart 2 · intensity through the wall"
              span={PROFILE_N}
              pens={[
                { id: 'gamma', label: 'Gamma', color: GAMMA_INK, points: profile.g, readout: fmt(gamma) },
                { id: 'neutron', label: 'Neutron', color: NEUTRON_INK, points: profile.n, readout: fmt(neutron), dashed: true },
              ]}
              band={{ from: 0, to: logPos(setup.safeDose), label: 'The front face is the left edge and the pens sit at the exit face. Green paper is under the limit.' }}
              summary={`Beam intensity across ${totalCm} centimetres of shielding, each rule a factor of ten. Gamma leaves at ${fmt(gamma)}, neutrons at ${fmt(neutron)}, limit ${setup.safeDose}.`}
              height={104}
            />
          </PanelBay>
        )}

        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <PanelBay legend="Alarms">
            <AnnunciatorPanel state={alarms} columns={3} legend="Annunciator windows" />
            <Note className="mt-2">A window stays lit after the trouble passes. Press ack to clear it.</Note>
          </PanelBay>

          <PanelBay
            legend="Slab handler"
            right={<DigitalWindow value={thick[sel]} unit="cm loaded" />}
          >
            <Engraved className="mb-1.5 block">Material select</Engraved>
            <div className="flex flex-wrap gap-1.5">
              {setup.available.map((m) => (
                <IlluminatedButton
                  key={m}
                  legend={MATERIALS[m].label}
                  sub={`${thick[m]} cm`}
                  lit={sel === m}
                  tone="green"
                  pressed={sel === m}
                  onClick={() => setSel(m)}
                  ariaLabel={`Load the handler with ${MATERIALS[m].label}, ${thick[m]} centimetres in the wall, ${MATERIALS[m].kgPerCm * SLAB} kilograms per slab`}
                />
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-1.5">
              <IlluminatedButton
                legend="Load slab"
                sub={`+${SLAB} cm`}
                lit={false}
                tone="white"
                onClick={() => addSlab(sel, SLAB)}
                disabled={thick[sel] >= MAX_CM}
                ariaLabel={`Push ${SLAB} more centimetres of ${spec.label} into the beam line`}
              />
              <IlluminatedButton
                legend="Pull slab"
                sub={`-${SLAB} cm`}
                lit={false}
                tone="white"
                onClick={() => addSlab(sel, -SLAB)}
                disabled={thick[sel] <= 0}
                ariaLabel={`Pull ${SLAB} centimetres of ${spec.label} back out of the beam line`}
              />
              <IlluminatedButton
                legend="Strip wall"
                lit={false}
                tone="white"
                onClick={stripWall}
                disabled={totalCm === 0}
                ariaLabel="Pull every slab out and start the wall over"
              />
            </div>
            <Note className="mt-2">
              Slabs go in {SLAB} cm at a time, and {MATERIALS[sel].kgPerCm * SLAB} kg of {spec.label.toLowerCase()} rides on each
              one. Order does not matter, only how much of each.
            </Note>

            <div className="mt-3">
              {won ? (
                <IlluminatedButton
                  legend="Certified"
                  sub="wall released"
                  lit
                  tone="green"
                  disabled
                  onClick={certify}
                  ariaLabel="Wall certified, the survey is signed off"
                />
              ) : (
                <GuardedControl
                  legend="Certify"
                  description="Runs the survey and signs off the wall. A failed survey costs one test run."
                  onFire={certify}
                />
              )}
            </div>
          </PanelBay>
        </div>

        <PanelBay legend="Survey status">
          <p
            aria-live="polite"
            className={cn(
              'min-h-[2.25rem] font-body text-[13px] leading-snug',
              verdict && !verdict.ok ? 'text-[#f08678]' : verdict?.ok ? 'text-[#8fe3c4]' : 'text-slate-300',
            )}
          >
            {status}
          </p>
        </PanelBay>
      </PanelSurface>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard metrics={lv.level.metrics} values={outcomeVisible ? { dose, mass, cost } : {}} best={lv.best} scored={won} />
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
          onReplay={stripWall}
        />
      )}
    </Card>
  )
}
