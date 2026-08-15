import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { RotateCcw, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { InsightToggle } from '@/components/level/InsightToggle'
import { Objective } from '@/components/level/Objective'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import {
  BenchPanel,
  BenchVerdict,
  BreakerHandle,
  BreakerSymbol,
  BusSymbol,
  Crosshair,
  GroundSymbol,
  JunctionDot,
  Oscilloscope,
  ProbeMeter,
  ResistorSymbol,
  SchematicSheet,
  ScorchSmudge,
  Silk,
  SpecList,
  TestPoint,
  ToolSelector,
  Wire,
  benchLabel,
  ink,
  inkDim,
  stepNode,
  type BenchNode,
  type BreakerState,
  type MeterReading,
  type WireState,
} from '@/components/instruments/bench'
import { useLevels } from '@/hooks/useLevels'
import { attemptsFor, useAttempts } from '@/hooks/useAttempts'
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
  /** Motors spike at startup. Their steady draw hides that extra current. */
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
  /** Level 4 on: the scope shows the startup spike before you throw the main. */
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
        { id: 'kettle', label: 'Kettle', watts: 1100 },
        { id: 'microwave', label: 'Microwave', watts: 700 },
        { id: 'lamp', label: 'Lamp', watts: 150 },
        { id: 'lights', label: 'Lights', watts: 100 },
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
        { id: 'heater', label: 'Space heater', watts: 1200 },
        { id: 'kettle', label: 'Kettle', watts: 1100 },
        { id: 'microwave', label: 'Microwave', watts: 700 },
        { id: 'toaster', label: 'Toaster', watts: 250 },
        { id: 'lamp', label: 'Lamp', watts: 150 },
        { id: 'lights', label: 'Lights', watts: 100 },
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
    teach: 'Anything with a motor pulls about half as much AGAIN for the instant it starts. A circuit that looks comfortable on steady watts can still snap the moment the fridge kicks in. Real breakers will ride out a spike that brief; the breakers on this panel are strict and judge the raw peak.',
    setup: {
      label: 'Hot afternoon',
      circuits: [
        { id: 'A', label: 'Circuit A', rating: 1800 },
        { id: 'B', label: 'Circuit B', rating: 1800 },
        { id: 'C', label: 'Circuit C', rating: 1800 },
      ],
      appliances: [
        { id: 'ac', label: 'AC unit', watts: 900, motor: true },
        { id: 'oven', label: 'Oven', watts: 1200 },
        { id: 'microwave', label: 'Microwave', watts: 900 },
        { id: 'toaster', label: 'Toaster', watts: 800 },
        { id: 'fridge', label: 'Fridge', watts: 400, motor: true },
        { id: 'lamp', label: 'Lamp', watts: 150 },
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
        { id: 'dryer', label: 'Dryer', watts: 1400 },
        { id: 'ac', label: 'AC unit', watts: 800, motor: true },
        { id: 'oven', label: 'Oven', watts: 1000 },
        { id: 'fridge', label: 'Fridge', watts: 350, motor: true },
        { id: 'airfryer', label: 'Air fryer', watts: 700 },
        { id: 'lamp', label: 'Lamp', watts: 250 },
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
    teach: 'Real electrical code says a circuit running for hours should sit under 80 percent of its rating, because breakers and wiring heat up. Passing the peak test is no longer enough: every circuit has to run COOL. And breakers cost money, so an unused one counts in your favor.',
    setup: {
      label: 'Sign-off inspection',
      circuits: [
        { id: 'A', label: 'Circuit A', rating: 2400 },
        { id: 'B', label: 'Circuit B', rating: 2400 },
        { id: 'C', label: 'Circuit C', rating: 1600 },
      ],
      appliances: [
        { id: 'dryer', label: 'Dryer', watts: 1150 },
        { id: 'ac', label: 'AC unit', watts: 750, motor: true },
        { id: 'oven', label: 'Oven', watts: 850 },
        { id: 'fridge', label: 'Fridge', watts: 300, motor: true },
        { id: 'airfryer', label: 'Air fryer', watts: 500 },
        { id: 'lamp', label: 'Lamp', watts: 150 },
      ],
      eightyRule: true,
      surgeBars: true,
      brief: 'The inspector wants every circuit under 80 percent, spikes included in the peak test.',
    },
    // Pars come from enumerating all 3^6 layouts against the formulas above:
    // a balanced three-circuit spread runs cool AND calm (60% steady, 625 W of
    // margin), while exactly two layouts squeeze onto two breakers, and those
    // run hot with almost no margin (79%, 125 W). No layout beats all three.
    metrics: [
      { id: 'worst', label: 'Worst steady load', goal: 'min', target: 60, unit: '%' },
      { id: 'margin', label: 'Surge margin', goal: 'max', target: 500, unit: ' W' },
      { id: 'circuits', label: 'Circuits used', goal: 'min', target: 2 },
    ],
  },
]

type Phase = 'idle' | 'testing' | 'passed' | 'failed'

/* ---------------- sheet geometry (drawing only, nothing here is scored) ------ */
const SHEET = { w: 970, h: 712 }
const BUS_Y = 48 // service bus across the top
const CB_Y = 96 // branch breaker centre, one per circuit
const CB_LEAD = 40
const RAIL = 150 // hot rail to neutral rail, loads bridge between them
const COL_PITCH = 300
const ROW_Y0 = 180
const ROW_PITCH = 68
const MAX_SLOTS = 6 // six appliances is the most any level ships
const NEUTRAL_Y = 580
const SHELF_Y = 660
const SHELF_X0 = 268
const SHELF_PITCH = 118
const SHELF_PIN = { x: 206, y: SHELF_Y }
const LOAD_LEAD = RAIL / 2 // leads land exactly on both rails
const SHELF_LEAD = 44 // shorter, so a shelved load reads as loose ends
const rowY = (k: number) => ROW_Y0 + k * ROW_PITCH
const EDGE = 'var(--bench-edge, rgba(255,255,255,0.13))'

/** Motor load: the circle with M. Motors surge, so they get their own symbol. */
function MotorSymbol({ x, y, lead }: { x: number; y: number; lead: number }) {
  const r = 17
  return (
    <g>
      <line x1={x - lead} y1={y} x2={x - r} y2={y} stroke={ink} strokeWidth="2.2" />
      <line x1={x + r} y1={y} x2={x + lead} y2={y} stroke={ink} strokeWidth="2.2" />
      <circle cx={x} cy={y} r={r} fill="none" stroke={ink} strokeWidth="2.2" />
      <text x={x} y={y + 5} textAnchor="middle" fontSize="15" className="font-mono" fill={ink}>
        M
      </text>
    </g>
  )
}

/** The clamp meter's jaws, closed around one branch conductor. */
function ClampJaw({ x, y }: { x: number; y: number }) {
  const tone = 'var(--bench-probe, #e5484d)'
  return (
    <g aria-hidden style={{ pointerEvents: 'none' }}>
      <circle cx={x} cy={y} r="15" fill="none" stroke={tone} strokeWidth="1" opacity="0.3" />
      <circle
        cx={x}
        cy={y}
        r="15"
        fill="none"
        stroke={tone}
        strokeWidth="5"
        strokeDasharray="72 22"
        transform={`rotate(-38 ${x} ${y})`}
      />
      <path d={`M ${x + 11} ${y + 11} l 20 20`} stroke={tone} strokeWidth="5" strokeLinecap="round" />
      <rect x={x + 28} y={y + 28} width="16" height="10" rx="3" fill={tone} />
    </g>
  )
}

export function OverloadChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('overload', LEVELS)
  const round = lv.level.setup

  const [assignment, setAssignment] = useState<Record<string, string | null>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [showSurge, setShowSurge] = useState(true)
  /** Set only when the attempt pool ran dry and the house got unplugged. */
  const [notice, setNotice] = useState<string | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)
  const completedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Bench state: the tool in hand, the sheet cursor, and the clamped branch. */
  const [tool, setTool] = useState<'lead' | 'clamp'>('lead')
  const [cursor, setCursor] = useState<string>(`load:${LEVELS[0].setup.appliances[0].id}`)
  const [clampAt, setClampAt] = useState<string | null>(LEVELS[0].setup.circuits[0].id)

  useEffect(() => {
    setAssignment({})
    setSelectedId(null)
    setPhase('idle')
    setNotice(null)
    setTool('lead')
    setCursor(`load:${round.appliances[0].id}`)
    setClampAt(round.circuits[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lv.level.n])

  const hasMotors = round.appliances.some((a) => a.motor)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const onCircuit = (circuitId: string) => round.appliances.filter((a) => assignment[a.id] === circuitId)
  /** Steady draw the clamp reads while everything runs. */
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
  // breakers cost money, so an empty one is the third scored metric
  const circuitsUsed = round.circuits.filter((c) => onCircuit(c.id).length > 0).length

  // Instruments stay neutral until the power goes on, so a colour never gives
  // away arithmetic the player can already do from the watts on the sheet.
  // Level 1 is the tutorial and level 4's surge markers are its concept.
  const outcomeVisible = lv.level.n === 1 || lv.level.n === 4 || phase === 'passed' || phase === 'failed'

  const clickAppliance = (applianceId: string) => {
    if (phase === 'testing') return
    setPhase('idle')
    setNotice(null)
    setSelectedId((current) => (current === applianceId ? null : applianceId))
  }

  const placeSelected = (circuitId: string | null) => {
    if (phase === 'testing' || selectedId === null) return
    setPhase('idle')
    setNotice(null)
    setAssignment((prev) => ({ ...prev, [selectedId]: circuitId }))
    setSelectedId(null)
  }

  /** Delete at the cursor: pull one load back off its circuit. */
  const unplug = (applianceId: string) => {
    if (phase === 'testing') return
    setPhase('idle')
    setNotice(null)
    setAssignment((prev) => ({ ...prev, [applianceId]: null }))
    setSelectedId(null)
  }

  const selectedAppliance = round.appliances.find((a) => a.id === selectedId)

  const powerOn = () => {
    if (phase === 'testing' || unassigned.length > 0) return
    setPhase('testing')
    setNotice(null)
    timerRef.current = setTimeout(() => {
      if (tripped.length === 0 && overheated.length === 0) {
        setPhase('passed')
        playSound('success')
        lv.clearLevel(
          lv.level.metrics
            ? { worst: Math.round(worstSteadyPct), margin: minSurgeMargin, circuits: circuitsUsed }
            : undefined,
        )
        if (!completedRef.current) {
          completedRef.current = true
          onComplete()
        }
      } else if (att.spend()) {
        // Out of tests: the house gets unplugged and the pool refills.
        reset()
        att.refill()
        setNotice('The inspector pulled the meter. Everything is back on the shelf. Add up each circuit before the next try: the watts are printed beside every load.')
      } else {
        setPhase('failed')
        // A breaker snapping open, layered over the attempt buzz from spend().
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

  /* ------------------------- the load center drawing ------------------------- */

  /** Reference designators: L1..L6 in the order the level lists them. */
  const designator = useMemo(() => {
    const map: Record<string, string> = {}
    round.appliances.forEach((a, i) => {
      map[a.id] = `L${i + 1}`
    })
    return map
  }, [round])

  /** Column positions. The panel block is centred whatever the circuit count. */
  const geom = useMemo(() => {
    const n = round.circuits.length
    const blockW = (n - 1) * COL_PITCH + RAIL
    const colStart = Math.round((SHEET.w - blockW) / 2) + 20
    const colX = (i: number) => colStart + i * COL_PITCH
    return { colStart, colX, lastCol: colX(n - 1) }
  }, [round])

  /**
   * Anything not sitting on a circuit THIS level has is drawn on the shelf. That
   * covers an assignment left over from a level with more circuits, which would
   * otherwise be a load with nowhere to draw.
   */
  const shelved = round.appliances.filter((a) => !round.circuits.some((c) => c.id === assignment[a.id]))

  /** Where every load sits: slot k down its circuit, or a slot on the shelf. */
  const placedAt = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {}
    round.circuits.forEach((c, i) => {
      round.appliances
        .filter((a) => assignment[a.id] === c.id)
        .forEach((a, k) => {
          map[a.id] = { x: geom.colX(i) + LOAD_LEAD, y: rowY(k) }
        })
    })
    round.appliances
      .filter((a) => !round.circuits.some((c) => c.id === assignment[a.id]))
      .forEach((a, j) => {
        map[a.id] = { x: SHELF_X0 + j * SHELF_PITCH, y: SHELF_Y }
      })
    return map
  }, [assignment, round, geom])

  /** Every point the cursor, the lead and the clamp can land on. */
  const nodes: BenchNode[] = useMemo(() => {
    const out: BenchNode[] = []
    for (const a of round.appliances) {
      const p = placedAt[a.id]
      const on = assignment[a.id]
      out.push({
        id: `load:${a.id}`,
        x: p.x,
        y: p.y,
        label: `${designator[a.id]}, ${a.label}, ${a.watts} watts, ${on ? `on circuit ${on}` : 'on the shelf'}`,
      })
    }
    round.circuits.forEach((c, i) => {
      const k = round.appliances.filter((a) => assignment[a.id] === c.id).length
      out.push({
        id: `tap:${c.id}`,
        x: geom.colX(i),
        y: rowY(Math.min(k, MAX_SLOTS - 1)),
        label: `${c.label} tap, ${k} ${k === 1 ? 'load' : 'loads'}, rated ${c.rating} watts`,
      })
    })
    out.push({ id: 'shelf', x: SHELF_PIN.x, y: SHELF_PIN.y, label: 'the shelf' })
    return out
  }, [assignment, placedAt, designator, round, geom])

  const nodeAt = (id: string) => nodes.find((n) => n.id === id) ?? null
  const partOf = (nodeId: string): [string, string] => {
    const cut = nodeId.indexOf(':')
    return cut < 0 ? [nodeId, ''] : [nodeId.slice(0, cut), nodeId.slice(cut + 1)]
  }

  /** Where the clamp goes when it lands on a node: onto that node's branch. */
  const clampNode = (nodeId: string) => {
    const [kind, key] = partOf(nodeId)
    setClampAt(kind === 'tap' ? key : kind === 'load' ? assignment[key] ?? null : null)
  }

  const act = (nodeId: string) => {
    setCursor(nodeId)
    if (tool === 'clamp') {
      clampNode(nodeId)
      return
    }
    const [kind, key] = partOf(nodeId)
    if (kind === 'load') clickAppliance(key)
    else if (kind === 'tap') placeSelected(key)
    else placeSelected(null)
  }

  const onSheetKey = (e: KeyboardEvent) => {
    const dirs: Record<string, 'left' | 'right' | 'up' | 'down'> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
    }
    if (e.key in dirs) {
      e.preventDefault()
      const next = stepNode(nodes, cursor, dirs[e.key])
      if (!next) return
      setCursor(next)
      if (tool === 'clamp') clampNode(next)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      act(cursor)
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      const [kind, key] = partOf(cursor)
      if (kind === 'load' && assignment[key]) unplug(key)
      return
    }
    if (e.key === 'Escape') setSelectedId(null)
  }

  /* ------------------------- bench readouts ------------------------- */

  const energised = phase !== 'idle'
  const trippedHere = (c: BreakerCircuit) => phase === 'failed' && peakOf(c.id) > c.rating
  /** The startup spike is hidden until the markers are on or a test has run. */
  const showSpike = (round.surgeBars && showSurge) || phase === 'passed' || phase === 'failed'

  const clamped = round.circuits.find((c) => c.id === clampAt) ?? null

  const reading = useMemo((): MeterReading => {
    if (!clamped) {
      return { value: '- - -', unit: 'W', note: 'jaws off the panel', state: 'none' }
    }
    const steady = steadyOf(clamped.id)
    const peak = peakOf(clamped.id)
    const count = onCircuit(clamped.id).length
    const hot = round.eightyRule && steady > clamped.rating * 0.8
    const note =
      showSpike && peak > steady
        ? `starts at ${peak.toLocaleString('en-US')} w`
        : round.eightyRule
          ? `code max ${Math.round(clamped.rating * 0.8).toLocaleString('en-US')} w`
          : `${count} ${count === 1 ? 'load' : 'loads'} · limit ${clamped.rating.toLocaleString('en-US')} w`
    return {
      value: steady.toLocaleString('en-US'),
      unit: 'W',
      node: `CB-${clamped.id}`,
      note,
      state: !outcomeVisible ? 'none' : peak > clamped.rating || hot ? 'over' : 'ok',
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped, assignment, round, showSpike, outcomeVisible])

  const announce = clamped
    ? `Clamp on ${clamped.label}. ${steadyOf(clamped.id).toLocaleString('en-US')} watts steady against a ${clamped.rating.toLocaleString('en-US')} watt limit.${
        showSpike && peakOf(clamped.id) > steadyOf(clamped.id)
          ? ` It starts at ${peakOf(clamped.id).toLocaleString('en-US')} watts.`
          : ''
      }`
    : 'Clamp parked. Put it round a branch to read that circuit.'

  /* Scope: one shot of the clamped branch switching on. Zero, then the inrush
     sample, then the steady draw it settles at. A breaker that opened cuts to
     nothing, which is exactly what the trace shows. */
  const SCOPE_PER_DIV = 400
  const SCOPE_SAMPLES = 20
  const SCOPE_ZEROS = 4
  const scopeSamples = useMemo(() => {
    const out: number[] = new Array(SCOPE_SAMPLES).fill(0)
    if (!clamped) return out
    const steady = steadyOf(clamped.id)
    const peak = peakOf(clamped.id)
    const cut = trippedHere(clamped)
    for (let i = SCOPE_ZEROS; i < SCOPE_SAMPLES; i++) {
      if (cut) out[i] = i === SCOPE_ZEROS ? peak : 0
      else out[i] = i === SCOPE_ZEROS && showSpike ? peak : steady
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped, assignment, round, showSpike, phase])

  const handleState: BreakerState =
    phase === 'passed' || phase === 'testing' ? 'closed' : phase === 'failed' ? 'tripped' : 'open'

  const specs = [
    { text: 'every load landed on a circuit', met: unassigned.length === 0 },
    {
      text: 'no breaker over its limit at switch-on',
      met: outcomeVisible && unassigned.length === 0 && tripped.length === 0,
    },
    ...(round.eightyRule
      ? [
          {
            text: 'every circuit at 80 percent or less steady',
            met: outcomeVisible && unassigned.length === 0 && overheated.length === 0,
          },
        ]
      : []),
  ]

  const verdict =
    phase === 'passed'
      ? { ok: true, text: 'The whole house came on and every breaker held. Nice and steady.' }
      : phase === 'failed' && firstTripped
        ? {
            ok: false,
            text: `Snap! ${firstTripped.label} spiked to ${peakOf(firstTripped.id).toLocaleString('en-US')}W the instant everything switched on, past its ${firstTripped.rating.toLocaleString('en-US')}W limit.`,
          }
        : phase === 'failed' && overheated.length > 0
          ? {
              ok: false,
              text: `Nothing tripped, but ${overheated[0].label} is running at ${Math.round((steadyOf(overheated[0].id) / overheated[0].rating) * 100)}% continuously. Code says 80% is the ceiling, because wiring that runs hot for hours is a fire waiting.`,
            }
          : notice
            ? { ok: false, text: notice }
            : null

  const cursorNode = nodeAt(cursor)
  const totalConnected = round.circuits.reduce((sum, c) => sum + steadyOf(c.id), 0)

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {phase === 'passed' && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.surgeBars ? <InsightToggle label="surge markers" on={showSurge} onChange={setShowSurge} /> : undefined}
      />

      <Objective
        goal={`Get everything running with no breaker tripped${round.eightyRule ? ', every circuit at 80 percent or less steady' : ''}`}
        status={unassigned.length > 0 ? `${unassigned.length} still on the shelf` : 'all plugged in'}
        attemptsLeft={att.left}
        met={phase === 'passed'}
      />

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-md">
          <p aria-live="polite" className="text-sm font-semibold text-ink-soft dark:text-stone-400">
            {selectedAppliance
              ? `Land the ${selectedAppliance.label.toLowerCase()} on a circuit, or on the shelf to set it back.`
              : round.brief}
          </p>
          <p className="mt-1 text-xs text-ink-soft dark:text-stone-500">
            Hold the lead to move a load between circuits. Hold the clamp to read one branch at a
            time. Arrow keys walk the cursor, enter uses the tool, delete pulls the load off.
          </p>
        </div>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
      </div>

      {hasMotors && (
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <Zap className="h-3.5 w-3.5" fill="currentColor" />
          Motors draw about 1.5x for a moment when they first switch on.
        </p>
      )}

      <BenchPanel
        title="load center · 120 v service"
        meta={
          <>
            <span className={cn(benchLabel, 'text-[var(--bench-dim,#a29b93)]')}>
              {unassigned.length} on the shelf · {round.circuits.length} circuits
            </span>
            <ToolSelector
              value={tool}
              onChange={(id) => {
                setTool(id)
                setSelectedId(null)
                if (id === 'clamp') clampNode(cursor)
              }}
              options={[
                { id: 'lead' as const, label: 'load lead', hint: 'Move a load onto a circuit' },
                { id: 'clamp' as const, label: 'clamp meter', hint: 'Read one branch at a time' },
              ]}
            />
          </>
        }
      >
        <SchematicSheet
          viewBox={`0 0 ${SHEET.w} ${SHEET.h}`}
          width={SHEET.w}
          height={SHEET.h}
          label={`Load center schematic, level ${lv.level.n}: ${round.label}`}
          titleBlock={[
            round.label,
            `sheet ${lv.level.n} of 5 · 120 v`,
            `${round.circuits.length} circuits · ${totalConnected.toLocaleString('en-US')} w`,
          ]}
          stamp={phase === 'passed' ? 'all held' : undefined}
        >
          {/* Nothing crosses on this sheet: buses run across, rails run down, and
              every meeting point is a tap, so there are no hops to draw. */}
          <BusSymbol
            x={geom.colStart - 94}
            y={BUS_Y}
            length={geom.lastCol - CB_LEAD * 2 + 14 - (geom.colStart - 94)}
            live={energised}
          />
          <Silk x={geom.colStart - 48} y={BUS_Y - 14} text="service · 120 v" size={11} tone={inkDim} />

          <BusSymbol
            x={geom.colStart + RAIL - 24}
            y={NEUTRAL_Y}
            length={geom.lastCol + RAIL + 46 - (geom.colStart + RAIL - 24)}
            live={energised}
          />
          <Silk x={geom.lastCol + RAIL - 44} y={NEUTRAL_Y + 22} text="neutral bar" size={11} tone={inkDim} />
          <GroundSymbol x={geom.lastCol + RAIL + 46} y={NEUTRAL_Y + 14} />

          {round.circuits.map((circuit, i) => {
            const x = geom.colX(i)
            const loads = onCircuit(circuit.id)
            const k = loads.length
            const isTripped = trippedHere(circuit)
            const state: WireState = isTripped ? 'fault' : energised && k > 0 ? 'live' : 'dead'
            const flowing = state === 'live'
            const railEnd = rowY(Math.min(k, MAX_SLOTS - 1))
            const cooked = phase === 'failed' && overheated.some((c) => c.id === circuit.id)

            return (
              <g key={circuit.id}>
                {/* bus tap down to the branch breaker */}
                <Wire
                  pts={[
                    { x: x - CB_LEAD * 2, y: BUS_Y },
                    { x: x - CB_LEAD * 2, y: CB_Y },
                  ]}
                  state={state}
                  flow={flowing}
                />
                <JunctionDot x={x - CB_LEAD * 2} y={BUS_Y} live={state === 'live'} />

                {/* hot rail, running down as far as the next open slot */}
                <Wire
                  pts={[
                    { x, y: CB_Y },
                    { x, y: railEnd },
                  ]}
                  state={state}
                  flow={flowing}
                />
                {/* neutral rail, back to the bar at the bottom */}
                {k > 0 && (
                  <Wire
                    pts={[
                      { x: x + RAIL, y: rowY(0) },
                      { x: x + RAIL, y: NEUTRAL_Y },
                    ]}
                    state={state}
                    flow={flowing}
                  />
                )}

                {/* a circuit that runs hot for hours does not trip, it cooks */}
                {cooked &&
                  loads.map((a, k2) => <ScorchSmudge key={`char-${a.id}`} x={x} y={rowY(k2) + 34} r={8} />)}

                {/* branch breakers draw open until the main is thrown, so the
                    sheet says at a glance whether the panel is live */}
                <BreakerSymbol
                  x={x - CB_LEAD}
                  y={CB_Y}
                  lead={CB_LEAD}
                  state={isTripped ? 'tripped' : energised ? 'closed' : 'open'}
                  designator={`CB-${circuit.id}`}
                  caption={`${circuit.rating.toLocaleString('en-US')} w limit`}
                />

                {/* the loads, bridged across the two rails, all in parallel */}
                {loads.map((a, k2) => {
                  const y = rowY(k2)
                  const held = selectedId === a.id
                  return (
                    <g key={a.id} onClick={() => act(`load:${a.id}`)} className="cursor-pointer">
                      <rect x={x + 16} y={y - 30} width={RAIL - 32} height="60" fill="transparent" />
                      {held && (
                        <rect
                          x={x + 20}
                          y={y - 22}
                          width={RAIL - 40}
                          height="44"
                          rx="6"
                          fill="none"
                          stroke="var(--accent, #7163dd)"
                          strokeWidth="2"
                        />
                      )}
                      {a.motor ? (
                        <MotorSymbol x={x + LOAD_LEAD} y={y} lead={LOAD_LEAD} />
                      ) : (
                        <ResistorSymbol x={x + LOAD_LEAD} y={y} lead={LOAD_LEAD} />
                      )}
                      <Silk
                        x={x + LOAD_LEAD}
                        y={y - 22}
                        text={`${designator[a.id]} · ${a.watts} w`}
                        size={10}
                      />
                      <Silk x={x + LOAD_LEAD} y={y + 28} text={a.label} size={10} tone={inkDim} />
                      {railEnd > y && <JunctionDot x={x} y={y} live={state === 'live'} />}
                      {k2 > 0 && <JunctionDot x={x + RAIL} y={y} live={state === 'live'} />}
                    </g>
                  )
                })}

                {/* the branch tap: where the held load lands, and where the
                    clamp goes to read this circuit */}
                <g onClick={() => act(`tap:${circuit.id}`)} className="cursor-pointer">
                  <circle cx={x} cy={railEnd} r="16" fill="transparent" />
                  <TestPoint
                    x={x}
                    y={railEnd}
                    state={selectedId ? 'armed' : clampAt === circuit.id ? 'probed' : 'idle'}
                  />
                </g>

                {clampAt === circuit.id && <ClampJaw x={x} y={CB_Y + 34} />}
              </g>
            )
          })}

          {/* the shelf: loads with nowhere to go, leads hanging loose */}
          <g onClick={() => act('shelf')} className="cursor-pointer">
            <rect
              x="186"
              y="626"
              width="760"
              height="74"
              rx="8"
              fill="transparent"
              stroke={EDGE}
              strokeWidth="1.5"
              strokeDasharray="8 6"
            />
            <circle cx={SHELF_PIN.x} cy={SHELF_PIN.y} r="16" fill="transparent" />
            <TestPoint x={SHELF_PIN.x} y={SHELF_PIN.y} state={selectedId ? 'armed' : 'idle'} />
          </g>
          <Silk
            x={278}
            y={618}
            text={`shelf · ${shelved.length} unconnected`}
            size={11}
            tone={inkDim}
          />
          {shelved.map((a) => {
            const p = placedAt[a.id]
            const held = selectedId === a.id
            return (
              <g key={a.id} onClick={() => act(`load:${a.id}`)} className="cursor-pointer">
                <rect x={p.x - 50} y={p.y - 30} width="100" height="60" fill="transparent" />
                {held && (
                  <rect
                    x={p.x - 46}
                    y={p.y - 22}
                    width="92"
                    height="44"
                    rx="6"
                    fill="none"
                    stroke="var(--accent, #7163dd)"
                    strokeWidth="2"
                  />
                )}
                {a.motor ? (
                  <MotorSymbol x={p.x} y={p.y} lead={SHELF_LEAD} />
                ) : (
                  <ResistorSymbol x={p.x} y={p.y} lead={SHELF_LEAD} />
                )}
                <Silk x={p.x} y={p.y - 22} text={`${designator[a.id]} · ${a.watts} w`} size={10} />
                <Silk x={p.x} y={p.y + 28} text={a.label} size={10} tone={inkDim} />
              </g>
            )
          })}

          {/* one cursor, one tab stop: the keyboard path to every point */}
          {cursorNode && (
            <g
              role="button"
              tabIndex={0}
              aria-label={`Sheet cursor on ${cursorNode.label}, holding the ${tool === 'clamp' ? 'clamp meter' : 'load lead'}.${selectedAppliance ? ` Carrying the ${selectedAppliance.label.toLowerCase()}.` : ''} Arrow keys move point to point, enter uses the tool, delete pulls a load off its circuit.`}
              aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter Delete Escape"
              onKeyDown={onSheetKey}
              className="outline-none"
            >
              <Crosshair x={cursorNode.x} y={cursorNode.y} size={22} />
            </g>
          )}
        </SchematicSheet>

        <div className="mt-3 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto]">
          <ProbeMeter reading={reading} mode="DCA" announce={announce} />
          <Oscilloscope
            samples={scopeSamples}
            perDivY={SCOPE_PER_DIV}
            perDivX="20 ms"
            unit="W"
            channel={`ch1 · ${clamped ? `CB-${clamped.id}` : 'no clamp'} switch-on`}
            overRange={Math.max(...scopeSamples) > SCOPE_PER_DIV * 8}
          />
          <BreakerHandle
            state={handleState}
            onThrow={powerOn}
            label="main"
            disabled={phase === 'testing' || unassigned.length > 0}
            className="lg:h-full lg:justify-center"
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <SpecList items={specs} />
          <BenchVerdict
            verdict={verdict}
            idle="Land every load on a circuit, then throw the main. A breaker trips if its circuit is pushed past its limit."
          />
        </div>
      </BenchPanel>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={reset} disabled={phase === 'testing'} aria-label="Unplug everything">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <p className="ml-auto text-xs text-ink-soft dark:text-stone-500">
          The panel is dead until you throw the main. That is the test.
        </p>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={
              outcomeVisible
                ? { worst: Math.round(worstSteadyPct), margin: minSurgeMargin, circuits: circuitsUsed }
                : {}
            }
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
              ? `Every circuit under code, worst at ${Math.round(worstSteadyPct)}%. Balance them cooler, or try squeezing onto two breakers.`
              : 'Every breaker held.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
