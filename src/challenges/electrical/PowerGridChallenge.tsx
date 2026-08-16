import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useReducedMotion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import { InsightToggle } from '@/components/level/InsightToggle'
import { Objective } from '@/components/level/Objective'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import {
  BenchPanel,
  BenchVerdict,
  BreakerHandle,
  BusSymbol,
  Crosshair,
  GroundSymbol,
  JunctionDot,
  LampSymbol,
  Oscilloscope,
  ProbeMeter,
  ProbeTip,
  SchematicSheet,
  ScorchedRun,
  Silk,
  SpecList,
  TestPoint,
  ToolSelector,
  TransformerSymbol,
  Wire,
  benchLabel,
  conductor,
  findHops,
  ink,
  inkDim,
  orthRoute,
  pathFromPts,
  routeLength,
  stepNode,
  type BenchNode,
  type Box,
  type BreakerState,
  type Lead,
  type MeterReading,
  type Pt,
} from '@/components/instruments/bench'
import { useLevels } from '@/hooks/useLevels'
import { attemptsFor, useAttempts } from '@/hooks/useAttempts'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const LOSS_PER_M = 0.15 // percent of supply lost per meter of wire traveled

interface GridSetup {
  label: string
  budget: number | null
  closed: string[]
  /** Minimum delivery a house needs, or null when any connection counts. */
  threshold: number | null
  /** Level 4 on: line load and losses are drawn. */
  flow: boolean
  /** Level 5 on: the network must survive any single line failing. */
  n1: boolean
  brief: string
}

const LEVELS: ChallengeLevel<GridSetup>[] = [
  {
    n: 1,
    title: 'Light the town',
    phase: 'play',
    concept: 'Everyone needs a path',
    teach: 'Think subway-map puzzle: clean routes, nothing wasted. Electricity only reaches a house that has an unbroken run of wire back to the plant. Build routes until every window glows. Copper is free today.',
    setup: { label: 'Willow Creek', budget: null, closed: [], threshold: null, flow: false, n1: false, brief: 'A new town with no grid at all. Connect every home.' },
  },
  {
    n: 2,
    title: 'The copper runs short',
    phase: 'understand',
    concept: 'Shared trunks beat spokes',
    teach: 'Wire is priced by the meter now, and running a private line to each house wastes it. Let houses share trunk lines and the same town connects for far less.',
    setup: { label: 'Copper shortage', budget: 475, closed: [], threshold: null, flow: false, n1: false, brief: 'The same town on a tight reel of wire. The cheapest possible network barely fits.' },
  },
  {
    n: 3,
    title: 'The far end flickers',
    phase: 'understand',
    concept: 'Wires leak',
    teach: 'Power fades along every meter it travels, so a house at the end of a long daisy-chain gets a brown-out even though it is connected. The SHORTEST network and a network that DELIVERS are not the same thing.',
    setup: { label: 'The brown-out', budget: 520, closed: [], threshold: 60, flow: false, n1: false, brief: 'The cheapest network from last time now leaves the far houses flickering. Route for delivery, not just length.' },
  },
  {
    n: 4,
    title: 'Watch the load',
    phase: 'analyze',
    concept: 'Flow and losses',
    teach: 'Turn on the readout. Thicker lines carry more homes, and the warm glow shows where power is being lost. The busiest line is the one whose failure would hurt most, remember it.',
    setup: { label: 'The brown-out II', budget: 540, closed: [], threshold: 60, flow: true, n1: false, brief: 'The same delivery problem, with the load on every line made visible.' },
  },
  {
    n: 5,
    title: 'Survive the storm',
    phase: 'optimize',
    concept: 'One line will fail',
    teach: 'A tree is the cheapest network and the worst one: cut any line and everything behind it goes dark. Build loops so every home has a second way back to the plant, and spend as little extra as you can.',
    setup: { label: 'Storm season', budget: 850, closed: [], threshold: 55, flow: true, n1: true, brief: 'The storm will take one line, and nobody knows which. The town must stay lit anyway.' },
    // Pars come from enumerating all 2^17 line sets against the formulas above:
    // 257 designs survive the storm on budget. The lean loops (705 to 720 m,
    // 11 lines) all leave the weakest house at exactly 65%, and pushing any
    // house to 66% or better costs over 730 m and a twelfth line. No design
    // beats all three.
    metrics: [
      { id: 'wire', label: 'Wire used', goal: 'min', target: 720, unit: ' m' },
      { id: 'weakest', label: 'Weakest house gets', goal: 'max', target: 66, unit: '%' },
      { id: 'lines', label: 'Lines built', goal: 'min', target: 11 },
    ],
  },
]

/* ---- Sheet geometry. Display only: a one-line diagram is not a scale
   drawing, and every span is billed off EDGES, never off the drawn route. ---- */
const SHEET = { w: 900, h: 480 }
const SUB = { x: 56, y: 259 }
const BUS = { x: 118, y0: 150, len: 218 }
const COLS = [300, 470, 640, 810]
const ROW = { top: 176, bot: 330 }
const LAMP = { top: 124, bot: 396 }
/** Height each plant feeder taps the bus at, so three feeders leave in order. */
const TAP: Record<string, number> = { a: 200, b: 320, c: 290 }

interface GridNode {
  id: string
  /** Lowercase place name; copy says "the old mill", the silkscreen matches. */
  name: string
  x: number
  y: number
  kind: 'plant' | 'house'
}

const NODES: GridNode[] = [
  { id: 'plant', name: 'power plant', x: BUS.x, y: SUB.y, kind: 'plant' },
  { id: 'a', name: 'orchard house', x: COLS[0], y: ROW.top, kind: 'house' },
  { id: 'b', name: 'old mill', x: COLS[0], y: ROW.bot, kind: 'house' },
  { id: 'c', name: 'crossroads house', x: COLS[1], y: ROW.top, kind: 'house' },
  { id: 'd', name: 'south meadow', x: COLS[1], y: ROW.bot, kind: 'house' },
  { id: 'e', name: 'north ridge', x: COLS[2], y: ROW.top, kind: 'house' },
  { id: 'f', name: 'east barn', x: COLS[2], y: ROW.bot, kind: 'house' },
  { id: 'g', name: 'hilltop house', x: COLS[3], y: ROW.top, kind: 'house' },
  { id: 'h', name: 'ferry cottage', x: COLS[3], y: ROW.bot, kind: 'house' },
]

/** Possible wire routes. Cost is the wire length in meters. */
const EDGES: { a: string; b: string; cost: number }[] = [
  { a: 'plant', b: 'a', cost: 55 },
  { a: 'plant', b: 'b', cost: 60 },
  { a: 'plant', b: 'c', cost: 75 },
  { a: 'a', b: 'c', cost: 45 },
  { a: 'a', b: 'b', cost: 90 },
  { a: 'b', b: 'c', cost: 70 },
  { a: 'b', b: 'd', cost: 80 },
  { a: 'c', b: 'd', cost: 70 },
  { a: 'c', b: 'e', cost: 60 },
  { a: 'c', b: 'f', cost: 65 },
  { a: 'd', b: 'f', cost: 60 },
  { a: 'd', b: 'h', cost: 95 },
  { a: 'e', b: 'f', cost: 75 },
  { a: 'e', b: 'g', cost: 55 },
  { a: 'f', b: 'g', cost: 60 },
  { a: 'f', b: 'h', cost: 70 },
  { a: 'g', b: 'h', cost: 60 },
]

const edgeId = (e: { a: string; b: string }) => `${e.a}|${e.b}`
const nodeById = (id: string) => NODES.find((n) => n.id === id)!

/** Reference designators: the bus, then L1 to L8 down the feeder. */
const DESIG: Record<string, string> = NODES.reduce(
  (map, n, i) => {
    map[n.id] = n.kind === 'plant' ? 'BUS' : `L${i}`
    return map
  },
  {} as Record<string, string>,
)

/** Shortest wire-distance from the plant to every reachable node. */
function distances(built: string[]): Record<string, number> {
  const dist: Record<string, number> = { plant: 0 }
  const queue: [string, number][] = [['plant', 0]]
  while (queue.length) {
    queue.sort((x, y) => x[1] - y[1])
    const [u, du] = queue.shift()!
    if (du > (dist[u] ?? Infinity)) continue
    for (const e of EDGES) {
      if (!built.includes(edgeId(e))) continue
      const v = e.a === u ? e.b : e.b === u ? e.a : null
      if (!v) continue
      const nd = du + e.cost
      if (nd < (dist[v] ?? Infinity)) {
        dist[v] = nd
        queue.push([v, nd])
      }
    }
  }
  return dist
}

/** Percent of full power a house receives, after line losses. */
const deliveredTo = (built: string[], houseId: string): number => {
  const d = distances(built)[houseId]
  return d === undefined ? 0 : Math.max(0, 100 - LOSS_PER_M * d)
}

/** Which nodes can currently reach the power plant through built wires. */
function poweredNodes(built: string[]): Set<string> {
  const lit = new Set(['plant'])
  const queue = ['plant']
  while (queue.length > 0) {
    const current = queue.pop()!
    for (const e of EDGES) {
      if (!built.includes(edgeId(e))) continue
      const next = e.a === current ? e.b : e.b === current ? e.a : null
      if (next && !lit.has(next)) {
        lit.add(next)
        queue.push(next)
      }
    }
  }
  return lit
}

/* --------------------------- drawing the sheet --------------------------- */

/** Keep-outs: the substation, every tap, and every lamp with its lettering. */
const AVOID: Box[] = [
  { x0: 20, y0: 120, x1: 132, y1: 400 },
  ...NODES.filter((n) => n.kind === 'house').flatMap((n) => [
    { x0: n.x - 28, y0: n.y - 24, x1: n.x + 28, y1: n.y + 24 },
    n.y === ROW.top
      ? { x0: n.x - 50, y0: 56, x1: n.x + 50, y1: 152 }
      : { x0: n.x - 50, y0: 354, x1: n.x + 50, y1: 474 },
  ]),
]

interface End {
  pt: Pt
  lead: Lead
}

/**
 * Where a conductor leaves each end of a corridor. The rule everywhere: turn in
 * the empty band between the two rows, never on a row line where a tap sits.
 */
function endsOf(e: { a: string; b: string }): [End, End] {
  const A = nodeById(e.a)
  const B = nodeById(e.b)
  if (A.kind === 'plant') {
    return [
      { pt: { x: BUS.x, y: TAP[B.id] ?? A.y }, lead: 'right' },
      { pt: { x: B.x, y: B.y }, lead: 'right' },
    ]
  }
  const a: Pt = { x: A.x, y: A.y }
  const b: Pt = { x: B.x, y: B.y }
  if (A.x === B.x) {
    const down = A.y < B.y
    return [
      { pt: a, lead: down ? 'down' : 'up' },
      { pt: b, lead: down ? 'up' : 'down' },
    ]
  }
  if (A.y === B.y) {
    if (Math.abs(COLS.indexOf(A.x) - COLS.indexOf(B.x)) === 1) {
      const right = A.x < B.x
      return [
        { pt: a, lead: right ? 'right' : 'left' },
        { pt: b, lead: right ? 'left' : 'right' },
      ]
    }
    // a span that skips a tap detours out of its row
    const out: Lead = A.y === ROW.top ? 'down' : 'up'
    return [
      { pt: a, lead: out },
      { pt: b, lead: out },
    ]
  }
  // diagonal: leave toward the far tap, arrive from beyond it
  const dir: Lead = A.x < B.x ? 'right' : 'left'
  return [
    { pt: a, lead: dir },
    { pt: b, lead: dir },
  ]
}

/** Stable per-corridor spread, hashed off the id rather than the index. */
const hashOf = (s: string) => [...s].reduce((n, c) => n + c.charCodeAt(0), 0)

/** Half way along a drawn route, for hanging the span label. */
function midOf(pts: Pt[]): Pt {
  const half = routeLength(pts) / 2
  let run = 0
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    if (run + seg >= half && seg > 0) {
      const t = (half - run) / seg
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }
    }
    run += seg
  }
  return pts[pts.length - 1]
}

/** Every surveyed corridor, drawn once: the routes never depend on play. */
const CORRIDORS = EDGES.map((e) => {
  const id = edgeId(e)
  const h = hashOf(id)
  const [from, to] = endsOf(e)
  const pts = orthRoute(from.pt, from.lead, to.pt, to.lead, {
    avoid: AVOID,
    lane: (h % 3) - 1,
    stub: 14 + (h % 3) * 6,
  })
  return { id, e, pts, mid: midOf(pts) }
})

/** A house: a tap on the line, a drop, and the lamp it feeds. */
function ServiceDrop({
  node,
  glow,
  fed,
  status,
}: {
  node: GridNode
  glow: number
  fed: boolean
  status: { text: string; tone: string } | null
}) {
  const top = node.y === ROW.top
  const lampY = top ? LAMP.top : LAMP.bot
  const dropTo = top ? lampY + 17 : lampY - 17
  return (
    <g>
      <line
        x1={node.x}
        y1={node.y}
        x2={node.x}
        y2={dropTo}
        stroke={fed ? conductor.live : conductor.dead}
        strokeWidth="2.6"
      />
      <LampSymbol x={node.x} y={lampY} lead={17} glow={glow} />
      <Silk x={node.x} y={top ? lampY - 46 : lampY + 34} text={DESIG[node.id]} track={1.2} />
      <Silk x={node.x} y={top ? lampY - 28 : lampY + 52} text={node.name} tone={inkDim} />
      {status && <Silk x={node.x} y={top ? lampY - 64 : lampY + 70} text={status.text} tone={status.tone} />}
    </g>
  )
}

const SCOPE_DIVS_Y = 8
const SAMPLES = 60

type Tool = 'crew' | 'probe' | 'clamp'

export function PowerGridChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('power-grid', LEVELS)
  const round = lv.level.setup

  const [built, setBuilt] = useState<string[]>([])
  const [celebrate, setCelebrate] = useState(false)
  const [showFlow, setShowFlow] = useState(true)
  const completedRef = useRef(false)

  /* Bench state: which tool is in hand, where the cursor sits, which tap is
     held, what the probe or clamp is on, and what the main breaker is doing. */
  const [tool, setTool] = useState<Tool>('crew')
  const [cursor, setCursor] = useState('plant')
  const [held, setHeld] = useState<string | null>(null)
  const [probeAt, setProbeAt] = useState<string | null>(null)
  const [clampOn, setClampOn] = useState<string | null>(null)
  const [breaker, setBreaker] = useState<BreakerState>('open')
  const [stormCut, setStormCut] = useState<string | null>(null)
  const [chatter, setChatter] = useState<string | null>(null)
  const [sheetFocus, setSheetFocus] = useState(false)

  useEffect(() => {
    setBuilt([])
    setCelebrate(false)
    setWonRound(false)
    setVerdict(null)
    setTool('crew')
    setCursor('plant')
    setHeld(null)
    setProbeAt(null)
    setClampOn(null)
    setBreaker('open')
    setStormCut(null)
    setChatter(null)
  }, [lv.level.n])
  const openEdges = EDGES.filter((e) => !round.closed.includes(edgeId(e)))
  const used = openEdges.filter((e) => built.includes(edgeId(e))).reduce((sum, e) => sum + e.cost, 0)
  const lit = useMemo(() => poweredNodes(built), [built])
  const houses = NODES.filter((n) => n.kind === 'house')
  const delivery = useMemo(() => {
    const map: Record<string, number> = {}
    for (const h of houses) map[h.id] = deliveredTo(built, h.id)
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built])
  const threshold = round.threshold ?? 0
  const served = (id: string) =>
    round.threshold === null ? lit.has(id) : delivery[id] >= threshold
  const litCount = houses.filter((h) => served(h.id)).length
  const allLit = litCount === houses.length
  const weakest = Math.min(...houses.map((h) => delivery[h.id]))
  const overBudget = round.budget !== null && used > round.budget

  // Level 5: pull each built line in turn and see whether the town survives.
  const survivesAnyCut = useMemo(() => {
    if (!round.n1) return true
    for (const cut of built) {
      const rest = built.filter((e) => e !== cut)
      const ok = houses.every((h) => deliveredTo(rest, h.id) >= threshold)
      if (!ok) return false
    }
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built, round.n1, threshold])

  const solvedNow = allLit && !overBudget && survivesAnyCut

  const [wonRound, setWonRound] = useState(false)
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)

  /** Throw the main breaker and see what the town thinks. */
  const energize = () => {
    if (wonRound) return
    if (solvedNow) {
      setWonRound(true)
      setCelebrate(true)
      setBreaker('closed')
      setStormCut(null)
      setVerdict({ ok: true, text: `The whole town is glowing!${round.budget !== null ? ` ${round.budget - used} m of wire to spare.` : ''}` })
      lv.clearLevel(
        lv.level.metrics
          ? { wire: used, weakest: Math.round(weakest), lines: built.length }
          : undefined,
      )
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    // Replay the storm against every built line, so the message can name the
    // single cut that darkens the most houses.
    let worstCut: { a: string; b: string; dark: number } | null = null
    if (round.n1 && !survivesAnyCut) {
      for (const cut of built) {
        const rest = built.filter((e) => e !== cut)
        const dark = houses.filter((h) => deliveredTo(rest, h.id) < threshold).length
        if (dark > (worstCut?.dark ?? 0)) {
          const [a, b] = cut.split('|')
          worstCut = { a, b, dark }
        }
      }
    }
    const text =
      allLit && !overBudget && round.n1 && !survivesAnyCut && worstCut
        ? `Everyone is lit today, but the storm test cut the line from the ${nodeById(worstCut.a).name} to the ${nodeById(worstCut.b).name} and ${worstCut.dark === 1 ? 'one home' : `${worstCut.dark} homes`} dropped below ${threshold}%. Every home needs a second route.`
        : !allLit && round.threshold !== null && houses.every((h) => lit.has(h.id))
          ? 'Every home is connected, but the far ones got a brown-out. Power fades with every meter, so give the far end a shorter route.'
          : allLit && overBudget
            ? `Every home is lit, but ${used} m of wire is over the ${round.budget} m reel.`
            : !allLit
              ? `${houses.length - litCount} home${houses.length - litCount === 1 ? ' is' : 's are'} still dark.`
              : 'The grid failed its acceptance test.'
    // The breaker says no before the sentence does, and the line the storm took
    // gets marked on the sheet.
    setBreaker('tripped')
    setStormCut(worstCut ? edgeId(worstCut) : null)
    if (att.spend()) {
      reset()
      att.refill()
      setBreaker('tripped')
      setVerdict({ ok: false, text: 'The utility pulled the crew. Poles bare again. Sketch the shortest routes that still deliver before rebuilding.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  const toggle = (id: string) => {
    setVerdict(null)
    setChatter(null)
    setStormCut(null)
    if (!wonRound) setBreaker('open')
    setBuilt((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]))
  }

  const reset = () => {
    setBuilt([])
    setCelebrate(false)
    setWonRound(false)
    setVerdict(null)
    setHeld(null)
    setClampOn(null)
    setBreaker('open')
    setStormCut(null)
    setChatter(null)
  }

  /** Homes whose cheapest route to the plant would lose this line. */
  const loadOf = (id: string): number => {
    if (!round.flow) return 0
    const rest = built.filter((e) => e !== id)
    return houses.filter((h) => delivery[h.id] > 0 && deliveredTo(rest, h.id) < delivery[h.id] - 0.01).length
  }

  /* ------------------------- sheet and readouts ------------------------- */

  const corridors = useMemo(() => CORRIDORS.filter((c) => !round.closed.includes(c.id)), [round])
  const hops = useMemo(
    () => findHops(corridors.filter((c) => built.includes(c.id))),
    [corridors, built],
  )

  const nodes: BenchNode[] = useMemo(
    () => NODES.map((n) => ({ id: n.id, x: n.x, y: n.y, label: `${DESIG[n.id]} ${n.name}` })),
    [],
  )

  /** How many lines land on each tap. Two or more is a junction. */
  const landings = useMemo(() => {
    const count: Record<string, number> = {}
    for (const c of corridors) {
      if (!built.includes(c.id)) continue
      count[c.e.a] = (count[c.e.a] ?? 0) + 1
      count[c.e.b] = (count[c.e.b] ?? 0) + 1
    }
    return count
  }, [corridors, built])

  const corridorBetween = (x: string, y: string) =>
    openEdges.find((e) => (e.a === x && e.b === y) || (e.a === y && e.b === x))

  /* Scope: on a delivery round the weakest house, otherwise homes served. */
  const scopeOnDelivery = round.threshold !== null
  const signal = scopeOnDelivery ? Math.max(0, weakest) : litCount
  const perDivY = scopeOnDelivery ? 12.5 : 1
  const [trace, setTrace] = useState<number[]>(() => new Array(SAMPLES).fill(0))
  const reduced = useReducedMotion()
  const signalRef = useRef(signal)
  signalRef.current = signal

  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => setTrace((t) => [...t.slice(1), signalRef.current]), 100)
    return () => clearInterval(id)
  }, [reduced])
  // Reduced motion gets no sweep, so the trace steps only when the grid does.
  useEffect(() => {
    if (reduced) setTrace((t) => [...t.slice(1), signal])
  }, [reduced, signal])
  useEffect(() => setTrace(new Array(SAMPLES).fill(0)), [lv.level.n])

  /* Meter: one tap at a time, or one line in the clamp jaws. */
  const clamped = clampOn ? corridors.find((c) => c.id === clampOn && built.includes(c.id)) : undefined
  // the clamp reading stays on the face until the probe takes the meter back
  const onClamp = tool === 'clamp' || (tool === 'crew' && clamped !== undefined)
  const reading = useMemo((): MeterReading => {
    if (onClamp) {
      if (!clamped) {
        return { value: '- - -', unit: 'homes', note: 'nothing in the jaws', state: 'none' }
      }
      const homes = loadOf(clamped.id)
      return {
        value: String(homes),
        unit: 'homes',
        node: `${DESIG[clamped.e.a]} to ${DESIG[clamped.e.b]}`,
        note: `${clamped.e.cost} m span`,
        state: homes > 0 ? 'ok' : 'none',
      }
    }
    if (!probeAt) {
      return { value: '- - -', unit: '%', note: 'probe in its holster', state: 'none' }
    }
    const node = nodeById(probeAt)
    const tag = `${DESIG[node.id]} ${node.name}`
    if (node.kind === 'plant') {
      return { value: '100.0', unit: '%', node: tag, note: 'straight off the bars' }
    }
    if (!lit.has(node.id)) {
      return { value: '- - -', unit: '%', node: tag, note: 'no path back to the bus', state: 'none' }
    }
    const pct = delivery[node.id]
    const meters = Math.round(distances(built)[node.id] ?? 0)
    return {
      value: pct.toFixed(1),
      unit: '%',
      node: tag,
      note:
        round.threshold === null
          ? `${meters} m of line from the bus`
          : `${meters} m of line · floor ${round.threshold}%`,
      state: round.threshold !== null && pct < threshold ? 'over' : 'ok',
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClamp, clamped, probeAt, built, lit, delivery, round, threshold])

  const spoken = (id: string) => nodeById(id).name

  const announce =
    chatter ??
    (tool === 'crew'
      ? held
        ? `Line crew holding the ${spoken(held)}. Move to another tap and press enter to string or cut that line.`
        : `Line crew on the ${spoken(cursor)}. Press enter to hold this tap.`
      : tool === 'clamp'
        ? clamped
          ? `Clamp on the line from the ${spoken(clamped.e.a)} to the ${spoken(clamped.e.b)}. ${reading.value} homes lean on it.`
          : held
            ? `Clamp holding the ${spoken(held)}. Move to the tap at the other end of the line and press enter.`
            : `Clamp on the ${spoken(cursor)}. Press enter to hold this tap.`
        : probeAt
          ? `Probe on ${reading.node}. ${reading.value === '- - -' ? 'No reading' : `${reading.value} percent of nominal`}. ${reading.note}.`
          : 'Probe parked. Move it onto a tap to take a reading.')

  /* ------------------------- bench controls ------------------------- */

  /** Use the held tool at a tap. Two taps make a line; the probe reads one. */
  const act = (id: string) => {
    setCursor(id)
    setChatter(null)
    if (tool === 'probe') {
      setProbeAt(id)
      setClampOn(null)
      return
    }
    if (held === null) {
      setHeld(id)
      return
    }
    if (held === id) {
      setHeld(null)
      return
    }
    const e = corridorBetween(held, id)
    setHeld(null)
    if (!e) {
      setChatter(`No surveyed route from the ${spoken(held)} to the ${spoken(id)}. Poles only stand where the survey says.`)
      return
    }
    if (tool === 'clamp') {
      if (!built.includes(edgeId(e))) {
        setChatter(`No line built from the ${spoken(e.a)} to the ${spoken(e.b)} yet, so there is nothing to clamp.`)
        return
      }
      setClampOn(edgeId(e))
      setProbeAt(null)
      return
    }
    toggle(edgeId(e))
  }

  /** Clicking a corridor does whatever the held tool means. */
  const hitCorridor = (id: string, e: { a: string; b: string }) => {
    setCursor(e.a)
    setChatter(null)
    setHeld(null)
    if (tool === 'probe') {
      setProbeAt(e.a)
      setClampOn(null)
      return
    }
    if (tool === 'clamp') {
      if (!built.includes(id)) {
        setChatter(`No line built from the ${spoken(e.a)} to the ${spoken(e.b)} yet, so there is nothing to clamp.`)
        return
      }
      setClampOn(id)
      setProbeAt(null)
      return
    }
    toggle(id)
  }

  const onSheetKey = (event: KeyboardEvent) => {
    const dirs: Record<string, 'left' | 'right' | 'up' | 'down'> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
    }
    if (event.key in dirs) {
      event.preventDefault()
      const next = stepNode(nodes, cursor, dirs[event.key])
      if (!next) return
      setCursor(next)
      setChatter(null)
      if (tool === 'probe') setProbeAt(next)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      act(cursor)
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      const last = [...built]
        .reverse()
        .find((id) => corridors.some((c) => c.id === id && (c.e.a === cursor || c.e.b === cursor)))
      if (last) toggle(last)
      return
    }
    if (event.key === 'Escape') setHeld(null)
  }

  const cursorNode = nodeById(cursor)
  const probeNode = probeAt ? nodeById(probeAt) : null
  const flowing = round.flow && showFlow

  const specs = [
    {
      text:
        round.threshold === null
          ? `all ${houses.length} homes have a path back to the bus`
          : `all ${houses.length} homes hold ${round.threshold}% or better`,
      met: allLit,
    },
    ...(round.budget !== null
      ? [{ text: `wire on the reel: ${used} of ${round.budget} m`, met: !overBudget }]
      : []),
    // The lamp pairs the storm test with delivery, since surviving a cut means
    // nothing while homes are already short. The win check is unchanged.
    ...(round.n1 ? [{ text: 'the town stays lit with any one line cut', met: survivesAnyCut && allLit }] : []),
  ]

  const browning = houses.some((h) => lit.has(h.id) && !served(h.id))
  const idleText = browning
    ? 'Something is connected but not getting enough. Probe the far taps.'
    : 'String the lines, then throw the main breaker for the acceptance test.'

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {celebrate && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.flow ? <InsightToggle label="line load" on={showFlow} onChange={setShowFlow} /> : undefined}
      />

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <Objective
          goal={`Light every home${round.threshold !== null ? ` with delivery ${round.threshold}% or better` : ''}${round.budget !== null ? ` on ${round.budget} m of wire` : ''}${round.n1 ? ', and survive losing any one line' : ''}`}
          status={`${litCount} of ${houses.length} homes served · ${used} m used`}
          attemptsLeft={att.left}
          met={wonRound}
        />

        <div className="max-w-md">
          <p className="text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
          <p className="mt-1 text-xs text-ink-soft dark:text-stone-500">
            Hold the line crew and pick two taps to string or cut that line. Hold the probe to read one
            tap at a time. Arrow keys walk the cursor tap to tap, enter uses the tool, delete cuts the
            line at that tap. Spans are billed on the surveyed run, not the line drawn on the sheet.
          </p>
        </div>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
      </div>

      <BenchPanel
        title="grid bench 01 · town feeder"
        meta={
          <>
            <span className={cn(benchLabel, 'text-[var(--bench-dim,#a29b93)]')}>
              {built.length} lines · {used} m
            </span>
            <ToolSelector
              value={tool}
              onChange={(id) => {
                setTool(id)
                setHeld(null)
                setChatter(null)
                if (id === 'probe') {
                  setProbeAt(cursor)
                  setClampOn(null)
                }
                if (id === 'clamp') setProbeAt(null)
              }}
              options={[
                { id: 'crew' as const, label: 'line crew', hint: 'String or cut the line between two taps' },
                { id: 'probe' as const, label: 'meter probe', hint: 'Read what one tap is getting' },
                ...(round.flow
                  ? [{ id: 'clamp' as const, label: 'clamp', hint: 'Read how many homes lean on one line' }]
                  : []),
              ]}
            />
          </>
        }
      >
        <SchematicSheet
          viewBox={`0 0 ${SHEET.w} ${SHEET.h}`}
          width={SHEET.w}
          height={SHEET.h}
          label={`Town one-line diagram, level ${lv.level.n}: ${round.label}. ${built.length} lines built, ${litCount} of ${houses.length} homes served.`}
          titleBlock={[
            `grid lab · ${round.label}`,
            `sheet ${lv.level.n} of 5 · one-line`,
            `${built.length} lines · ${used} m`,
          ]}
          stamp={wonRound ? 'accepted' : undefined}
        >
          {/* surveyed corridors nobody has built yet */}
          {corridors
            .filter((c) => !built.includes(c.id))
            .map((c) => (
              <g key={`survey-${c.id}`} onClick={() => hitCorridor(c.id, c.e)} className="cursor-pointer">
                <path d={pathFromPts(c.pts)} fill="none" stroke="transparent" strokeWidth="16" />
                <path
                  d={pathFromPts(c.pts)}
                  fill="none"
                  stroke={inkDim}
                  strokeWidth="1.6"
                  strokeDasharray="7 8"
                  opacity="0.45"
                />
                <Silk x={c.mid.x} y={c.mid.y + 4} text={`${c.e.cost} m`} size={11} tone={inkDim} />
              </g>
            ))}

          {/* load shadow: the more homes lean on a line, the heavier it sits */}
          {flowing &&
            corridors
              .filter((c) => built.includes(c.id) && loadOf(c.id) > 0)
              .map((c) => (
                <path
                  key={`load-${c.id}`}
                  d={pathFromPts(c.pts, hops[c.id])}
                  fill="none"
                  stroke={conductor.live}
                  strokeWidth={4 + loadOf(c.id) * 2.2}
                  strokeOpacity={0.18 + Math.min(0.22, loadOf(c.id) * 0.04)}
                  strokeLinecap="round"
                  aria-hidden
                />
              ))}

          {/* built lines */}
          {corridors
            .filter((c) => built.includes(c.id))
            .map((c) => {
              const energized = lit.has(c.e.a) && lit.has(c.e.b)
              return (
                <g key={c.id} onClick={() => hitCorridor(c.id, c.e)} className="cursor-pointer">
                  <path d={pathFromPts(c.pts, hops[c.id])} fill="none" stroke="transparent" strokeWidth="16" />
                  <Wire
                    pts={c.pts}
                    hops={hops[c.id]}
                    state={stormCut === c.id ? 'fault' : energized ? 'live' : 'dead'}
                    flow={energized}
                  />
                  <Silk
                    x={c.mid.x}
                    y={c.mid.y + 4}
                    text={`${c.e.cost} m`}
                    size={11}
                    tone={clampOn === c.id ? 'var(--bench-probe, #e5484d)' : ink}
                  />
                </g>
              )
            })}

          {/* the line the storm took */}
          {stormCut &&
            corridors
              .filter((c) => c.id === stormCut)
              .map((c) => <ScorchedRun key={`char-${c.id}`} pts={c.pts} hops={hops[c.id]} />)}

          {/* substation: transformer, bus, earth */}
          <g>
            <TransformerSymbol x={SUB.x} y={SUB.y} designator="T1" />
            <line x1={SUB.x + 15} y1={SUB.y} x2={BUS.x} y2={SUB.y} stroke={ink} strokeWidth="2.2" />
            <line x1={SUB.x} y1={SUB.y + 24} x2={SUB.x} y2={SUB.y + 47} stroke={ink} strokeWidth="2.2" />
            <GroundSymbol x={SUB.x} y={SUB.y + 47} />
            <Silk x={SUB.x + 4} y={SUB.y + 83} text="power plant" tone={inkDim} />
            {/* the bus is fed by the plant, so it is live whether or not you built anything */}
            <BusSymbol x={BUS.x} y={BUS.y0} length={BUS.len} vertical label="town bus" live />
          </g>

          {/* houses */}
          {houses.map((h) => (
            <ServiceDrop
              key={h.id}
              node={h}
              fed={lit.has(h.id)}
              glow={served(h.id) ? Math.max(0.55, Math.min(1, delivery[h.id] / 100)) : 0}
              status={
                !lit.has(h.id)
                  ? { text: 'dark', tone: inkDim }
                  : !served(h.id)
                    ? { text: 'brown-out', tone: 'var(--bench-fault, #ff6b5c)' }
                    : null
              }
            />
          ))}

          {/* taps: every one is a test point, a filled dot means lines meet */}
          {NODES.map((n) => (
            <g key={n.id} onClick={() => act(n.id)} className="cursor-pointer">
              <circle cx={n.x} cy={n.y} r="16" fill="transparent" />
              <TestPoint
                x={n.x}
                y={n.y}
                state={held === n.id ? 'armed' : probeAt === n.id ? 'probed' : 'idle'}
                r={(landings[n.id] ?? 0) >= 2 ? 6.5 : 5.5}
              />
              {(landings[n.id] ?? 0) >= 2 && <JunctionDot x={n.x} y={n.y} live={lit.has(n.id)} />}
            </g>
          ))}

          {probeNode && <ProbeTip x={probeNode.x} y={probeNode.y} />}

          {/* one cursor, one tab stop: the keyboard path to every tap */}
          <g
            role="button"
            tabIndex={0}
            aria-label={`Sheet cursor on ${DESIG[cursor]} ${cursorNode.name}, holding the ${tool === 'probe' ? 'meter probe' : tool === 'clamp' ? 'clamp meter' : 'line crew'}. Arrow keys move tap to tap, enter uses the tool, delete cuts the line at this tap.`}
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter Delete Escape"
            onKeyDown={onSheetKey}
            onFocus={() => setSheetFocus(true)}
            onBlur={() => setSheetFocus(false)}
            className="outline-none"
          >
            {/* the cursor carries its own focus ring, since the sheet has no outline */}
            {sheetFocus && (
              <circle
                cx={cursorNode.x}
                cy={cursorNode.y}
                r="23"
                fill="none"
                stroke="var(--accent, #7163dd)"
                strokeWidth="1.6"
                strokeDasharray="3 5"
                opacity="0.9"
              />
            )}
            <Crosshair x={cursorNode.x} y={cursorNode.y} />
          </g>
        </SchematicSheet>

        <div className="mt-3 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto]">
          <ProbeMeter reading={reading} mode={onClamp ? 'DCA' : 'DCV'} announce={announce} />
          <Oscilloscope
            samples={trace}
            perDivY={perDivY}
            perDivX="0.6 s"
            unit={scopeOnDelivery ? '%' : 'homes'}
            channel={scopeOnDelivery ? 'ch1 · weakest house' : 'ch1 · homes served'}
            divsY={SCOPE_DIVS_Y}
          />
          <BreakerHandle
            state={breaker}
            onThrow={energize}
            label="main feed"
            disabled={wonRound}
            className="lg:h-full lg:justify-center"
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <SpecList items={specs} />
          <BenchVerdict verdict={verdict} idle={idleText} />
        </div>
      </BenchPanel>

      {round.budget !== null && (
        <div className="mt-3">
          <Meter
            label="Wire billed on the surveyed run"
            display={`${used} of ${round.budget} m`}
            fraction={used / round.budget}
            barClass={overBudget ? 'bg-rose-500' : 'bg-emerald-500'}
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={reset} aria-label="Remove all wires">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <p className="ml-auto text-xs text-ink-soft dark:text-stone-500">
          The bus is live while you build. Throw the main breaker to run the acceptance test.
        </p>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ wire: used, weakest: Math.round(Math.max(0, weakest)), lines: built.length }}
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
              ? `Storm-proof on ${used} m of wire. Try trimming a loop.`
              : 'The whole town glows.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
