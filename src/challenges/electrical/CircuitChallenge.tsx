import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useReducedMotion } from 'framer-motion'
import { RotateCcw, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { simulate, type SimPart } from '@/challenges/electrical/circuitSim'
import { InsightToggle } from '@/components/level/InsightToggle'
import { Objective } from '@/components/level/Objective'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { Meter } from '@/components/ui/Meter'
import {
  BenchPanel,
  BenchVerdict,
  BreakerHandle,
  Crosshair,
  JunctionDot,
  LampSymbol,
  Oscilloscope,
  ProbeMeter,
  ProbeTip,
  SchematicSheet,
  ScorchedRun,
  SourceSymbol,
  SpecList,
  SwitchSymbol,
  TestPoint,
  ToolSelector,
  Wire,
  benchLabel,
  findHops,
  orthRoute,
  stepNode,
  type BenchNode,
  type Box,
  type BreakerState,
  type MeterReading,
  type Pt,
} from '@/components/instruments/bench'
import { useLevels } from '@/hooks/useLevels'
import { attemptsFor, useAttempts } from '@/hooks/useAttempts'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const VOLTAGE = 9
const BULB: Omit<SimPart, 'id'> = { resistance: 6, ratedCurrent: 1.5 } // full at 9V alone
const FULL = 0.9 // counts as "full brightness" at 90% or more
const LIT = 0.15 // anything above this is visibly glowing

type PartKind = 'bulb' | 'switch'

interface BoardPart {
  id: string
  kind: PartKind
  label: string
  x: number
  y: number
}

interface Requirement {
  /** Which bulb this is about. */
  id: string
  want: 'full' | 'off'
  /** Check with every switch open instead of closed. */
  switchesOpen?: boolean
  text: string
}

interface CircuitSetup {
  label: string
  brief: string
  parts: BoardPart[]
  requirements: Requirement[]
  /** Total wire length allowed in board units, or null. */
  wireBudget: number | null
  /** Level 4 on: current flow is animated along live wires. */
  flow: boolean
}

const LEVELS: ChallengeLevel<CircuitSetup>[] = [
  {
    n: 1,
    title: 'First light',
    phase: 'play',
    concept: 'Electricity needs a loop',
    teach: 'It is the wiring sandbox from every block-building game, with real electrons. Current only flows around an unbroken loop: out of the battery, through the bulb, and back. Wire it up and make it glow.',
    setup: {
      label: 'First light',
      brief: 'Wire the bulb to the battery so it lights up.',
      parts: [{ id: 'b1', kind: 'bulb', label: 'Bulb', x: 420, y: 180 }],
      requirements: [{ id: 'b1', want: 'full', text: 'Bulb glows at full brightness' }],
      wireBudget: null,
      flow: false,
    },
  },
  {
    n: 2,
    title: 'Copper is money',
    phase: 'understand',
    concept: 'Wire has a length',
    teach: 'A switch is a drawbridge in the loop, and from now on every centimeter of wire is metered. A tidy, direct run passes; a sprawling one costs more copper than the job allows.',
    setup: {
      label: 'On a switch',
      brief: 'The bulb should light, but only while the switch is closed. Mind the wire budget.',
      parts: [
        { id: 's1', kind: 'switch', label: 'Switch', x: 340, y: 95 },
        { id: 'b1', kind: 'bulb', label: 'Bulb', x: 560, y: 190 },
      ],
      requirements: [
        { id: 'b1', want: 'full', text: 'Bulb is full when the switch is closed' },
        { id: 'b1', want: 'off', switchesOpen: true, text: 'Bulb goes out when the switch opens' },
      ],
      wireBudget: 800,
      flow: false,
    },
  },
  {
    n: 3,
    title: 'Two bulbs, one battery',
    phase: 'understand',
    concept: 'Series against parallel',
    teach: 'Chain the bulbs one after the other and they share the battery, so both run dim. Give each its OWN loop back to the battery and both burn at full. Same parts, different wiring, completely different circuit.',
    setup: {
      label: 'Both bright',
      brief: 'Light BOTH bulbs at full brightness from the one battery.',
      parts: [
        { id: 'b1', kind: 'bulb', label: 'Bulb A', x: 430, y: 105 },
        { id: 'b2', kind: 'bulb', label: 'Bulb B', x: 430, y: 265 },
      ],
      requirements: [
        { id: 'b1', want: 'full', text: 'Bulb A at full brightness' },
        { id: 'b2', want: 'full', text: 'Bulb B at full brightness' },
      ],
      wireBudget: null,
      flow: false,
    },
  },
  {
    n: 4,
    title: 'Watch it flow',
    phase: 'analyze',
    concept: 'Current made visible',
    teach: 'Turn on the flow view and the current itself marches along every live wire. Watch what happens to the moving dots when you open the switch or break a loop, and where they never went at all.',
    setup: {
      label: 'Control just one',
      brief: 'Both bulbs full, but the switch must turn off ONLY bulb B.',
      parts: [
        { id: 'b1', kind: 'bulb', label: 'Bulb A', x: 400, y: 100 },
        { id: 'b2', kind: 'bulb', label: 'Bulb B', x: 400, y: 265 },
        { id: 's1', kind: 'switch', label: 'Switch', x: 620, y: 265 },
      ],
      requirements: [
        { id: 'b1', want: 'full', text: 'Bulb A at full brightness' },
        { id: 'b2', want: 'full', text: 'Bulb B at full brightness' },
        { id: 'b1', want: 'full', switchesOpen: true, text: 'Bulb A stays on when the switch opens' },
        { id: 'b2', want: 'off', switchesOpen: true, text: 'Bulb B goes out when the switch opens' },
      ],
      wireBudget: null,
      flow: true,
    },
  },
  {
    n: 5,
    title: 'Wire the workshop',
    phase: 'optimize',
    concept: 'Right, then lean',
    teach: 'Three bulbs, one switch that controls only the bench light, and a copper bill. Plenty of wirings work; the good one does it with the least wire and the fewest runs.',
    setup: {
      label: 'The workshop',
      brief: 'All three full when closed; only bulb C goes out when the switch opens.',
      parts: [
        { id: 'b1', kind: 'bulb', label: 'Bulb A', x: 430, y: 95 },
        { id: 'b2', kind: 'bulb', label: 'Bulb B', x: 430, y: 265 },
        { id: 'b3', kind: 'bulb', label: 'Bulb C', x: 640, y: 180 },
        { id: 's1', kind: 'switch', label: 'Switch', x: 640, y: 320 },
      ],
      requirements: [
        { id: 'b1', want: 'full', text: 'Bulb A at full brightness' },
        { id: 'b2', want: 'full', text: 'Bulb B at full brightness' },
        { id: 'b3', want: 'full', text: 'Bulb C at full brightness' },
        { id: 'b1', want: 'full', switchesOpen: true, text: 'Bulb A stays on when the switch opens' },
        { id: 'b2', want: 'full', switchesOpen: true, text: 'Bulb B stays on when the switch opens' },
        { id: 'b3', want: 'off', switchesOpen: true, text: 'Bulb C goes out when the switch opens' },
      ],
      wireBudget: 2000,
      flow: true,
    },
    metrics: [
      { id: 'wire', label: 'Wire used', goal: 'min', target: 1600, unit: ' cm' },
      { id: 'runs', label: 'Wire runs', goal: 'min', target: 8 },
    ],
  },
]

/* Terminal positions, relative to each part. */
const termOffset = { a: -52, b: 52 }
const terminalId = (partId: string, side: 'a' | 'b') => `${partId}.${side}`
const BAT_P = 'bat.p'
const BAT_N = 'bat.n'
const BAT = { x: 120, y: 185, plus: { x: 170, y: 135 }, minus: { x: 170, y: 235 } }

const wireKey = (a: string, b: string) => [a, b].sort().join('~')

/* Sheet size. Wider than the parts need, so the title block has its own corner.
   Nothing here feeds the copper bill: that is measured pin to pin. */
const SHEET = { w: 800, h: 400 }
const SCOPE_DIVS_Y = 8
const SAMPLES = 60

export function CircuitChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('circuit', LEVELS)
  const round = lv.level.setup

  const [wires, setWires] = useState<[string, string][]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [switchOn, setSwitchOn] = useState(true)
  const [wonRound, setWonRound] = useState(false)
  const [showFlow, setShowFlow] = useState(true)
  const completedRef = useRef(false)

  /* Bench state: which tool is in hand, where the cursor sits, where the probe
     is clipped on, and what the main breaker is doing. */
  const [tool, setTool] = useState<'spool' | 'probe'>('spool')
  const [cursor, setCursor] = useState<string>(BAT_P)
  const [probeAt, setProbeAt] = useState<string | null>(null)
  const [breaker, setBreaker] = useState<BreakerState>('open')

  // Clear the board whenever the level changes, so a render never sees wires
  // belonging to parts the new level does not have.
  useEffect(() => {
    setWires([])
    setSelected(null)
    setSwitchOn(true)
    setWonRound(false)
    setVerdict(null)
    setTool('spool')
    setCursor(BAT_P)
    setProbeAt(null)
    setBreaker('open')
  }, [lv.level.n])

  const bulbs = round.parts.filter((p) => p.kind === 'bulb')
  const switches = round.parts.filter((p) => p.kind === 'switch')

  /** Null when the terminal does not belong to this round (e.g. leftover wires). */
  const terminalPos = (id: string): { x: number; y: number } | null => {
    if (id === BAT_P) return BAT.plus
    if (id === BAT_N) return BAT.minus
    const [partId, side] = id.split('.') as [string, 'a' | 'b']
    const part = round.parts.find((p) => p.id === partId)
    if (!part) return null
    return { x: part.x + termOffset[side], y: part.y }
  }

  /** Run the circuit with switches either closed or open. */
  const runSim = (closed: boolean) => {
    const connections: [string, string][] = [...wires]
    if (closed) {
      for (const s of switches) connections.push([terminalId(s.id, 'a'), terminalId(s.id, 'b')])
    }
    return simulate(
      connections,
      bulbs.map((b) => ({ part: { id: b.id, ...BULB }, a: terminalId(b.id, 'a'), b: terminalId(b.id, 'b') })),
      BAT_P,
      BAT_N,
      VOLTAGE,
    )
  }

  const simClosed = useMemo(() => runSim(true), [wires, round]) // eslint-disable-line react-hooks/exhaustive-deps
  const simOpen = useMemo(() => runSim(false), [wires, round]) // eslint-disable-line react-hooks/exhaustive-deps
  /** What the board is actually doing right now, given the switch position. */
  const live = switchOn ? simClosed : simOpen

  const met = (req: Requirement) => {
    const sim = req.switchesOpen ? simOpen : simClosed
    if (sim.short) return false
    const p = sim.power[req.id] ?? 0
    return req.want === 'full' ? p >= FULL : p < LIT
  }
  // Total copper, wire by wire. One board unit is one centimeter. The schematic
  // is not a scale drawing, so this measures pin to pin, not the drawn route.
  const wireLength = Math.round(
    wires.reduce((sum, [a, b]) => {
      const pa = terminalPos(a)
      const pb = terminalPos(b)
      return pa && pb ? sum + Math.hypot(pb.x - pa.x, pb.y - pa.y) : sum
    }, 0),
  )
  const overWire = round.wireBudget !== null && wireLength > round.wireBudget
  const allMet = round.requirements.every(met) && !simClosed.short && !overWire

  const att = useAttempts(attemptsFor(lv.level), lv.level.n)
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)

  /** Any edit puts the breaker back in your hand. */
  const stand = () => {
    if (!wonRound) setBreaker('open')
  }

  /** Close the case and power the board for real. */
  const powerUp = () => {
    if (wonRound) return
    if (allMet) {
      setWonRound(true)
      setBreaker('closed')
      setVerdict({ ok: true, text: 'That circuit does exactly what was asked. Nice wiring.' })
      lv.clearLevel(lv.level.metrics ? { wire: wireLength, runs: wires.length } : undefined)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const unmet = round.requirements.filter((rq) => !met(rq)).length
    const text = simClosed.short
      ? 'Short circuit! A wire runs straight from + back to − with nothing in between. The bench fuse blew.'
      : overWire
        ? `The wiring works but uses ${wireLength} cm of copper against a budget of ${round.wireBudget} cm. Route it more directly.`
        : `${unmet} of the ${round.requirements.length} requirements ${unmet === 1 ? 'is' : 'are'} not met. Test with the switch before powering up.`
    setBreaker('tripped')
    if (att.spend()) {
      reset()
      att.refill()
      setBreaker('tripped')
      setVerdict({ ok: false, text: 'The bench supply cut out. Board stripped. Trace the current path with a finger before rebuilding.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  const clickTerminal = (id: string) => {
    setVerdict(null)
    stand()
    if (selected === null) {
      setSelected(id)
      return
    }
    if (selected === id) {
      setSelected(null)
      return
    }
    // A wire straight across a part's own two terminals is a dead short: current
    // skips the part entirely and the whole board reads as broken with no clue
    // why. Refuse it and say so, rather than letting it quietly kill the level.
    const partOf = (t: string) => t.slice(0, t.lastIndexOf('.'))
    if (partOf(selected) === partOf(id)) {
      setVerdict({ ok: false, text: 'That wire shorts the part out: its two terminals must reach the rest of the circuit, not each other.' })
      setSelected(null)
      return
    }
    const key = wireKey(selected, id)
    if (!wires.some(([a, b]) => wireKey(a, b) === key)) {
      setWires((prev) => [...prev, [selected, id]])
    }
    setSelected(null)
  }

  const removeWire = (key: string) => {
    stand()
    setWires((prev) => prev.filter(([a, b]) => wireKey(a, b) !== key))
  }
  const undo = () => {
    stand()
    setWires((prev) => prev.slice(0, -1))
    setSelected(null)
  }
  const reset = () => {
    setWires([])
    setSelected(null)
    setWonRound(false)
    setVerdict(null)
    setBreaker('open')
  }
  const throwSwitch = () => {
    stand()
    setSwitchOn((v) => !v)
  }

  const allTerminals = [
    BAT_P,
    BAT_N,
    ...round.parts.flatMap((p) => [terminalId(p.id, 'a'), terminalId(p.id, 'b')]),
  ]

  /* ------------------------- bench readouts ------------------------- */

  /** Reference designators: LP1, SW1, and their pins. */
  const designator = useMemo(() => {
    const map: Record<string, string> = { [BAT_P]: 'BT1 +', [BAT_N]: 'BT1 −' }
    let lamps = 0
    let sws = 0
    for (const p of round.parts) {
      const tag = p.kind === 'bulb' ? `LP${++lamps}` : `SW${++sws}`
      map[p.id] = tag
      map[terminalId(p.id, 'a')] = `${tag} A`
      map[terminalId(p.id, 'b')] = `${tag} B`
    }
    return map
  }, [round])

  const nodes: BenchNode[] = useMemo(
    () =>
      allTerminals
        .map((id) => {
          const p = terminalPos(id)
          return p ? { id, x: p.x, y: p.y, label: designator[id] ?? id } : null
        })
        .filter((n): n is BenchNode => n !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round, designator],
  )

  /** Short-circuit path: the run of wire that ties + straight back to −. */
  const faultRun = useMemo(() => {
    if (!live.short) return new Set<string>()
    const links: { key: string | null; a: string; b: string }[] = wires.map(([a, b]) => ({ key: wireKey(a, b), a, b }))
    if (switchOn) {
      for (const s of switches) links.push({ key: null, a: terminalId(s.id, 'a'), b: terminalId(s.id, 'b') })
    }
    const from: Record<string, { prev: string; key: string | null } | null> = { [BAT_P]: null }
    const queue = [BAT_P]
    while (queue.length > 0) {
      const here = queue.shift()!
      if (here === BAT_N) break
      for (const l of links) {
        const next = l.a === here ? l.b : l.b === here ? l.a : null
        if (!next || next in from) continue
        from[next] = { prev: here, key: l.key }
        queue.push(next)
      }
    }
    const path = new Set<string>()
    let step = from[BAT_N]
    while (step) {
      if (step.key) path.add(step.key)
      step = from[step.prev]
    }
    return path
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wires, switchOn, live.short, round])

  /** Amps flowing out of each net, so a conductor knows whether it is working. */
  const netCurrent = useMemo(() => {
    const amps: Record<string, number> = {}
    if (live.short) return amps
    for (const b of bulbs) {
      const i = (live.power[b.id] ?? 0) * BULB.ratedCurrent
      if (i <= 0.001) continue
      for (const side of ['a', 'b'] as const) {
        const n = live.net[terminalId(b.id, side)]
        if (n) amps[n] = (amps[n] ?? 0) + i
      }
    }
    return amps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, round])

  /** Routed conductors, plus the hop list for every crossing. */
  const routed = useMemo(() => {
    const lead = (id: string) => (id.endsWith('.a') ? ('left' as const) : ('right' as const))
    // symbol bodies and their lettering, so a crossing run steps around them
    const avoid: Box[] = [
      { x0: BAT.x - 46, y0: BAT.y - 40, x1: BAT.x + 34, y1: BAT.y + 66 },
      ...round.parts.map((p) => ({ x0: p.x - 30, y0: p.y - 34, x1: p.x + 30, y1: p.y + 32 })),
    ]
    // Stable lane per conductor, hashed off its own key rather than its index,
    // so two returns heading the same way never draw on top of each other and
    // cutting one wire does not shuffle the rest of the drawing.
    const laneOf = (key: string) => ([...key].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 3) - 1
    const runs = wires
      .map(([a, b]) => {
        const pa = terminalPos(a)
        const pb = terminalPos(b)
        if (!pa || !pb) return null
        const id = wireKey(a, b)
        return { id, a, b, pts: orthRoute(pa as Pt, lead(a), pb as Pt, lead(b), { avoid, lane: laneOf(id) }) }
      })
      .filter((r): r is { id: string; a: string; b: string; pts: Pt[] } => r !== null)
    return { runs, hops: findHops(runs) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wires, round])

  /** How many conductors land on each pin. Two or more is a junction. */
  const landings = useMemo(() => {
    const count: Record<string, number> = {}
    for (const [a, b] of wires) {
      count[a] = (count[a] ?? 0) + 1
      count[b] = (count[b] ?? 0) + 1
    }
    return count
  }, [wires])

  /* Scope: total current out of the supply, sampled at 10 Hz. */
  const perDivY = bulbs.length > 2 ? 1 : 0.5
  const fullScale = perDivY * SCOPE_DIVS_Y
  const sourceCurrent = live.short
    ? fullScale
    : bulbs.reduce((sum, b) => sum + (live.power[b.id] ?? 0) * BULB.ratedCurrent, 0)
  const [trace, setTrace] = useState<number[]>(() => new Array(SAMPLES).fill(0))
  const reduced = useReducedMotion()
  const signalRef = useRef(sourceCurrent)
  signalRef.current = sourceCurrent

  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => setTrace((t) => [...t.slice(1), signalRef.current]), 100)
    return () => clearInterval(id)
  }, [reduced])
  // Reduced motion gets no sweep, so the trace steps only when the circuit does.
  useEffect(() => {
    if (reduced) setTrace((t) => [...t.slice(1), sourceCurrent])
  }, [reduced, sourceCurrent])
  useEffect(() => setTrace(new Array(SAMPLES).fill(0)), [lv.level.n])

  /* Meter: one node at a time, COM on the minus rail. */
  const reading = useMemo((): MeterReading => {
    if (!probeAt) {
      return { value: '- - -', unit: 'V', note: 'probe in its holster', state: 'none' }
    }
    const tag = designator[probeAt] ?? probeAt
    if (live.short) {
      return { value: 'SHRT', unit: '', node: tag, note: '+ tied to − through bare copper', state: 'over' }
    }
    const netId = live.net[probeAt]
    const volts = netId === undefined ? undefined : live.volts[netId]
    if (volts === undefined) {
      return { value: '- - -', unit: 'V', node: tag, note: 'no path back to the supply', state: 'none' }
    }
    const partId = probeAt.slice(0, probeAt.lastIndexOf('.'))
    const bulb = bulbs.find((b) => b.id === partId)
    const sw = switches.find((s) => s.id === partId)
    const note = bulb
      ? `${((live.power[bulb.id] ?? 0) * BULB.ratedCurrent).toFixed(2)} A through ${designator[bulb.id]}`
      : sw
        ? `${designator[sw.id]} is ${switchOn ? 'closed' : 'open'}`
        : probeAt === BAT_N
          ? 'meter reference'
          : 'supply rail'
    return { value: volts.toFixed(2), unit: 'V', node: tag, note }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probeAt, live, switchOn, designator, round])

  const announce = probeAt
    ? `Probe on ${reading.node}. ${reading.value === '- - -' ? 'No reading' : `${reading.value} ${reading.unit}`}. ${reading.note}.`
    : 'Probe parked. Move it onto a pin to take a reading.'

  /* ------------------------- bench controls ------------------------- */

  const act = (id: string) => {
    setCursor(id)
    if (tool === 'probe') {
      setProbeAt(id)
      return
    }
    clickTerminal(id)
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
      if (tool === 'probe') setProbeAt(next)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      act(cursor)
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      const last = [...wires].reverse().find(([a, b]) => a === cursor || b === cursor)
      if (last) removeWire(wireKey(last[0], last[1]))
      return
    }
    if (e.key === 'Escape') setSelected(null)
  }

  const cursorPos = terminalPos(cursor)
  const probePos = probeAt ? terminalPos(probeAt) : null
  const flowing = round.flow && showFlow

  const specs = round.requirements.map((req) => ({ text: req.text, met: met(req) }))
  const idleText = bulbs.some((b) => (live.power[b.id] ?? 0) > LIT && (live.power[b.id] ?? 0) < FULL)
    ? 'Something is glowing, but not at full strength.'
    : 'Wire the pins, test with the switch, then throw the main breaker.'
  const shown = verdict
    ? verdict
    : simClosed.short
      ? {
          ok: false,
          text: 'Short circuit! A wire runs straight from + back to − with nothing in between, so all the power races through it.',
        }
      : null

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.flow ? <InsightToggle label="current flow" on={showFlow} onChange={setShowFlow} /> : undefined}
      />

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <Objective
          goal={`Meet all ${round.requirements.length} requirement${round.requirements.length === 1 ? '' : 's'}${round.wireBudget !== null ? ` within ${round.wireBudget} cm of copper` : ''}, no shorts`}
          status={`copper used: ${wireLength} cm`}
          attemptsLeft={att.left}
          met={wonRound}
        />

        <div className="max-w-md">
          <p className="text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
          <p className="mt-1 text-xs text-ink-soft dark:text-stone-500">
            Hold the spool to run wire pin to pin. Hold the probe to read one pin at a time. Arrow keys
            walk the cursor, enter uses the tool, delete cuts the wire at that pin.
          </p>
        </div>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
      </div>

      <BenchPanel
        title="bench 01 · 9 v dc supply"
        meta={
          <>
            <span className={cn(benchLabel, 'text-[var(--bench-dim,#a29b93)]')}>
              {wires.length} runs · {wireLength} cm copper
            </span>
            <ToolSelector
              value={tool}
              onChange={(id) => {
                setTool(id)
                setSelected(null)
                if (id === 'probe') setProbeAt(cursor)
              }}
              options={[
                { id: 'spool' as const, label: 'wire spool', hint: 'Run wire between two pins' },
                { id: 'probe' as const, label: 'meter probe', hint: 'Read one pin at a time' },
              ]}
            />
          </>
        }
      >
        <SchematicSheet
          viewBox={`0 0 ${SHEET.w} ${SHEET.h}`}
          width={SHEET.w}
          height={SHEET.h}
          label={`Circuit schematic, level ${lv.level.n}: ${round.label}`}
          titleBlock={[`circuit lab · ${round.label}`, `sheet ${lv.level.n} of 5 · 9 v dc`, `${wires.length} runs · ${wireLength} cm`]}
          stamp={wonRound ? 'spec met' : undefined}
        >
          {/* conductors */}
          {routed.runs.map((run) => {
            const netId = live.net[run.a]
            const carrying = !live.short && netId !== undefined && (netCurrent[netId] ?? 0) > 0
            const faulted = faultRun.has(run.id)
            return (
              <Wire
                key={run.id}
                pts={run.pts}
                hops={routed.hops[run.id]}
                state={faulted ? 'fault' : carrying ? 'live' : 'dead'}
                flow={flowing && carrying}
                label={`Wire from ${designator[run.a] ?? run.a} to ${designator[run.b] ?? run.b}. ${
                  tool === 'probe' ? 'Press enter to probe this net.' : 'Press enter to cut it.'
                }`}
                onActivate={() => {
                  if (tool !== 'probe') {
                    removeWire(run.id)
                    return
                  }
                  setCursor(run.a)
                  setProbeAt(run.a)
                }}
              />
            )
          })}

          {/* the run that cooked */}
          {routed.runs
            .filter((run) => faultRun.has(run.id))
            .map((run) => (
              <ScorchedRun key={`char-${run.id}`} pts={run.pts} hops={routed.hops[run.id]} />
            ))}

          <SourceSymbol x={BAT.x} y={BAT.y} volts={VOLTAGE} plusPin={BAT.plus} minusPin={BAT.minus} />

          {round.parts.map((part) => {
            if (part.kind === 'bulb') {
              const p = live.short ? 0 : live.power[part.id] ?? 0
              return (
                <LampSymbol
                  key={part.id}
                  x={part.x}
                  y={part.y}
                  lead={52}
                  glow={Math.max(0, Math.min(1, p))}
                  designator={designator[part.id]}
                  caption={part.label}
                />
              )
            }
            return (
              <g
                key={part.id}
                role="button"
                tabIndex={0}
                aria-pressed={switchOn}
                aria-label={`${designator[part.id]}, ${switchOn ? 'closed' : 'open'}. Press to throw it.`}
                onClick={throwSwitch}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    throwSwitch()
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <rect x={part.x - 46} y={part.y - 40} width="92" height="66" rx="8" fill="transparent" />
                <SwitchSymbol
                  x={part.x}
                  y={part.y}
                  lead={52}
                  closed={switchOn}
                  designator={designator[part.id]}
                  caption={`${part.label} · ${switchOn ? 'closed' : 'open'}`}
                />
              </g>
            )
          })}

          {/* pins: every one is a test point, and a filled dot means joined */}
          {nodes.map((n) => (
            <g key={n.id} onClick={() => act(n.id)} className="cursor-pointer">
              <circle cx={n.x} cy={n.y} r="15" fill="transparent" />
              <TestPoint
                x={n.x}
                y={n.y}
                state={selected === n.id ? 'armed' : probeAt === n.id ? 'probed' : 'idle'}
                r={(landings[n.id] ?? 0) >= 2 ? 6.5 : 5.5}
              />
              {(landings[n.id] ?? 0) >= 2 && (
                <JunctionDot x={n.x} y={n.y} live={!live.short && (netCurrent[live.net[n.id] ?? ''] ?? 0) > 0} />
              )}
            </g>
          ))}

          {probePos && <ProbeTip x={probePos.x} y={probePos.y} />}

          {/* one cursor, one tab stop: the keyboard path to every pin */}
          {cursorPos && (
            <g
              role="button"
              tabIndex={0}
              aria-label={`Sheet cursor on ${designator[cursor] ?? cursor}, holding the ${tool === 'probe' ? 'meter probe' : 'wire spool'}. Arrow keys move pin to pin, enter uses the tool, delete cuts the wire at this pin.`}
              aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter Delete"
              onKeyDown={onSheetKey}
              className="outline-none"
            >
              <Crosshair x={cursorPos.x} y={cursorPos.y} />
            </g>
          )}
        </SchematicSheet>

        <div className="mt-3 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto]">
          <ProbeMeter reading={reading} mode="DCV" announce={announce} />
          <Oscilloscope
            samples={trace}
            perDivY={perDivY}
            perDivX="0.6 s"
            unit="A"
            channel="ch1 · supply current"
            overRange={live.short}
            divsY={SCOPE_DIVS_Y}
          />
          <BreakerHandle
            state={breaker}
            onThrow={powerUp}
            label="main"
            rating={`${VOLTAGE} v`}
            disabled={wonRound}
            className="lg:h-full lg:justify-center"
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <SpecList items={specs} />
          <BenchVerdict verdict={shown} idle={idleText} />
        </div>
      </BenchPanel>

      {round.wireBudget !== null && (
        <div className="mt-3">
          <Meter
            label="Copper billed pin to pin"
            display={`${wireLength} of ${round.wireBudget} cm`}
            fraction={wireLength / round.wireBudget}
            barClass={overWire ? 'bg-rose-500' : 'bg-emerald-500'}
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={undo} disabled={wires.length === 0} aria-label="Undo last wire">
          <Undo2 className="h-4 w-4" />
          Undo
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Remove all wires">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <p className="ml-auto text-xs text-ink-soft dark:text-stone-500">
          The supply is live for testing. Throw the main breaker to run it for real.
        </p>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ wire: wireLength, runs: wires.length }}
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
              ? `Spec met on ${wireLength} cm of copper in ${wires.length} runs. There is a leaner layout.`
              : 'That circuit does exactly what was asked.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
