import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Eraser, PenLine, RotateCcw, Truck, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { memberKey, solveTruss, type SolveOutcome, type TrussJoint } from '@/challenges/civil/truss'
import { InsightToggle } from '@/components/level/InsightToggle'
import { Objective } from '@/components/level/Objective'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import {
  ApprovalStamp,
  CursorMark,
  DatumLine,
  DimString,
  DraftingSheet,
  DrawingKey,
  GridBubble,
  GroundHatch,
  INK,
  LETTER,
  LoadArrow,
  NoteBlock,
  PEN,
  PinSupport,
  Redline,
  RevisionStamp,
  ScaleBar,
  Schedule,
  SheetTool,
  SnapGrid,
  StencilPalette,
  TRACK,
  TitleBlock,
  useSheetCursor,
  type SheetStatus,
} from '@/components/instruments/drafting'
import { useLevels } from '@/hooks/useLevels'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const VIEW_W = 800
const VIEW_H = 420
const GRID = 40 // build snaps to this grid
const ROAD_Y = 240 // the height the truck drives at
const LEFT_X = 160 // left anchor (edge of the left bank)
const RIGHT_X = 640 // right anchor
const MIN_X = 80
const MAX_X = 720
const MIN_Y = 80
const MAX_Y = 320
const MAX_LEN = 130 // a single beam cannot be longer than this
/**
 * The drawing scale. The 480 px between the two banks is a 24 m river crossing,
 * so 20 px is a meter and the longest legal beam is 6.5 m. Deck sag comes out of
 * the solver in these same px, which is how it becomes centimeters.
 */
const PX_PER_M = 20
/**
 * Deflection is drawn this much larger than life. A dozen centimeters of dip is
 * two px at true scale and nobody would see it, so the sag-limit line and the
 * drawn sag both use this exaggeration and stay comparable to each other.
 */
const SAG_DRAW = 8
/** A sag in centimeters, as px below the road on the drawing. */
const sagLinePx = (cm: number) => (cm / 100) * PX_PER_M * SAG_DRAW

/** Build materials. Steel is far stronger but more than twice the price. */
const MATERIALS = {
  wood: { label: 'Wood', cost: 5, tension: 22, compression: 14, color: '#c89b6b' },
  steel: { label: 'Steel', cost: 12, tension: 50, compression: 38, color: '#9aa7b5' },
} as const
type MaterialId = keyof typeof MATERIALS

interface BridgeSetup {
  label: string
  load: number
  /** Cost cap, or null for free materials. */
  budget: number | null
  /** Materials on the shelf. */
  materials: MaterialId[]
  /** Level 4 on: color beams by push versus pull instead of by how hard they work. */
  forces: boolean
  /** Level 5: the deck may only dip this far under the truck (cm), or null. */
  maxDeflection: number | null
  brief: string
  /**
   * A part-built span to open on, as [x,y] pairs and the beams between them.
   * Level 1 only: it arrives one member short of complete, so the first screen
   * is not an empty canvas over a real solver.
   */
  starter?: { nodes: [number, number][]; links: [number, number][] }
}

/** The Warren truss level 1 opens on, minus one diagonal. */
const STARTER_NODES: [number, number][] = [
  // bottom chord (the road)
  [160, 240], [240, 240], [320, 240], [400, 240], [480, 240], [560, 240], [640, 240],
  // top chord
  [200, 160], [280, 160], [360, 160], [440, 160], [520, 160], [600, 160],
]
/** Indices into STARTER_NODES. The 200-160 to 240-240 diagonal is left out. */
const STARTER_LINKS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],          // road
  [7, 8], [8, 9], [9, 10], [10, 11], [11, 12],             // top chord
  [0, 7], /* [7, 1] missing */ [1, 8], [8, 2], [2, 9], [9, 3],
  [3, 10], [10, 4], [4, 11], [11, 5], [5, 12], [12, 6],    // diagonals
]

const LEVELS: ChallengeLevel<BridgeSetup>[] = [
  {
    n: 1,
    title: 'Triangles hold',
    phase: 'play',
    concept: 'Shapes that keep their shape',
    teach: 'A square frame folds flat under load, but a triangle cannot change shape without changing the length of a beam, so triangles are what hold bridges up. This span is finished except for one diagonal. Find the gap, close it, and the truck gets across.',
    setup: {
      label: 'Delivery van', load: 6, budget: null, materials: ['wood'],
      forces: false, maxDeflection: null,
      brief: 'One diagonal is missing near the left bank. Click the two joints either side of the gap to bridge it.',
      starter: { nodes: STARTER_NODES, links: STARTER_LINKS },
    },
  },
  {
    n: 2,
    title: 'On a budget',
    phase: 'understand',
    concept: 'Every beam costs',
    teach: 'Timber is billed by the length now. The sprawling bridge that worked when it was free suddenly prices itself out, so every beam has to earn its place.',
    setup: { label: 'Loaded semi', load: 10, budget: 10000, materials: ['wood'], forces: false, maxDeflection: null, brief: 'A heavier truck, and the council is paying by the meter.' },
  },
  {
    n: 3,
    title: 'Wood or steel',
    phase: 'understand',
    concept: 'Spend strength where it goes',
    teach: 'Steel is more than twice the price but far stronger. No all-wood bridge can carry this load on budget, so the trick is steel only on the few beams doing the hardest work and wood everywhere else.',
    setup: { label: 'Gravel truck convoy', load: 16, budget: 14000, materials: ['wood', 'steel'], forces: false, maxDeflection: null, brief: 'A load too heavy for timber alone, on a budget too tight for all steel.' },
  },
  {
    n: 4,
    title: 'Push and pull',
    phase: 'analyze',
    concept: 'Tension and compression',
    teach: 'Turn on the force view. Every beam is either being stretched or squashed as the truck rolls over, and the solver knows which. Stretched beams are pulled apart, squashed ones can buckle, and buckling gives out sooner, which is why the two are drawn apart.',
    setup: { label: 'Loaded semi', load: 14, budget: 13800, materials: ['wood', 'steel'], forces: true, maxDeflection: null, brief: 'The same kind of load, with the forces inside every beam drawn out.' },
  },
  {
    n: 5,
    title: 'Strength per dollar',
    phase: 'optimize',
    concept: 'Strong, stiff, and cheap',
    teach: 'The heaviest truck yet, on a budget all-steel cannot meet. Strength and stiffness are not the same thing: a bridge can hold the load and still bounce like a diving board, so this one has to keep the deck within 15 cm as well. Depth is what buys stiffness, steel is what buys strength, and both are billed by the meter.',
    setup: { label: 'Heavy hauler', load: 20, budget: 21000, materials: ['wood', 'steel'], forces: true, maxDeflection: 15, brief: 'Sign off the bridge that goes out to tender: strong, stiff, and no more expensive than it has to be.' },
    // Pars checked offline against the solver itself, across Warren, Pratt and
    // X-braced spans at every legal panel and depth: 18 designs carry the load
    // inside the budget and the sag rule, 7 meet the cost par, 13 keep a fifth
    // of their strength in hand, and only the 6 m deep truss gets to 10 cm. No
    // design takes more than two of the three. The sag metric is a new id
    // because the old 'sag' best was stored in px.
    metrics: [
      { id: 'cost', label: 'Build cost', goal: 'min', target: 16000 },
      { id: 'sagcm', label: 'Deck sag', goal: 'min', target: 10, unit: ' cm' },
      { id: 'spare', label: 'Spare strength', goal: 'max', target: 20, unit: ' %' },
    ],
  },
]

type Phase = 'build' | 'testing' | 'passed' | 'failed'

const jointId = (x: number, y: number) => `j${x}_${y}`
const ANCHOR_L: TrussJoint = { id: jointId(LEFT_X, ROAD_Y), x: LEFT_X, y: ROAD_Y, fixed: true }
const ANCHOR_R: TrussJoint = { id: jointId(RIGHT_X, ROAD_Y), x: RIGHT_X, y: ROAD_Y, fixed: true }

interface TestResult {
  failedAt: string | null
  outcome: SolveOutcome | null
  utilization: Record<string, number>
  force: Record<string, number>
  /** Largest joint movement seen during the crossing, in cm of real deck. */
  peakSag: number
  /** The bent shape at that worst truck position, for drawing a sag failure. */
  sagShape: Record<string, [number, number]> | null
}

export function BridgeChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('bridge', LEVELS)
  const round = lv.level.setup

  const [joints, setJoints] = useState<TrussJoint[]>([ANCHOR_L, ANCHOR_R])
  const [beams, setBeams] = useState<{ key: string; material: MaterialId }[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [material, setMaterial] = useState<MaterialId>('wood')
  const [tool, setToolState] = useState<'build' | 'remove'>('build')
  /** Where the pointer is hovering on the grid, for the placement preview. */
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  /** Bumped when a click is rejected for reach, so the hint can re-announce. */
  const [tooLongTick, setTooLongTick] = useState(0)
  /** Snapshots taken before every change, so undo covers removals too. */
  const [history, setHistory] = useState<{ joints: TrussJoint[]; beams: { key: string; material: MaterialId }[] }[]>([])
  const [phase, setPhase] = useState<Phase>('build')
  const [test, setTest] = useState<TestResult | null>(null)
  const [runId, setRunId] = useState(0)
  const [won, setWon] = useState(false)
  const [showForces, setShowForces] = useState(true)
  const completedRef = useRef(false)
  const handledRunRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const reduced = useReducedMotion()

  const busy = phase === 'testing'

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  // Each level starts on an empty span, and steel snaps back to wood if it is gone.
  useEffect(() => {
    const s = round.starter
    if (s) {
      const nodes = s.nodes.map(([x, y]) => {
        const anchor = x === LEFT_X && y === ROAD_Y ? ANCHOR_L : x === RIGHT_X && y === ROAD_Y ? ANCHOR_R : null
        return anchor ?? { id: jointId(x, y), x, y }
      })
      setJoints(nodes)
      setBeams(s.links.map(([a, b]) => ({ key: memberKey(nodes[a].id, nodes[b].id), material: round.materials[0] })))
    } else {
      setJoints([ANCHOR_L, ANCHOR_R])
      setBeams([])
    }
    setSelected(null)
    setPhase('build')
    setTest(null)
    setWon(false)
    setMaterial(round.materials[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lv.level.n])

  const jointAt = (id: string) => joints.find((j) => j.id === id)
  const beamKeys = beams.map((b) => b.key)
  const materialOf = (key: string) => beams.find((b) => b.key === key)?.material ?? 'wood'
  /** The mark a member carries on the drawing, so a redline can name it. */
  const markOf = (key: string) => `M${beams.findIndex((b) => b.key === key) + 1}`

  const lengthOf = (key: string) => {
    const [a, b] = key.split('|')
    const ja = jointAt(a)
    const jb = jointAt(b)
    if (!ja || !jb) return 0
    return Math.hypot(jb.x - ja.x, jb.y - ja.y)
  }

  const cost = Math.round(
    beams.reduce((sum, b) => sum + lengthOf(b.key) * MATERIALS[b.material].cost, 0),
  )
  const overBudget = round.budget !== null && cost > round.budget

  /* ---------- the road: horizontal beams at road level ---------- */
  const roadBeams = beamKeys.filter((key) => {
    const [a, b] = key.split('|')
    const ja = jointAt(a)
    const jb = jointAt(b)
    return ja && jb && ja.y === ROAD_Y && jb.y === ROAD_Y
  })

  const roadPath = useMemo(() => {
    const adj = new Map<string, string[]>()
    for (const key of roadBeams) {
      const [a, b] = key.split('|')
      adj.set(a, [...(adj.get(a) ?? []), b])
      adj.set(b, [...(adj.get(b) ?? []), a])
    }
    const seen = new Set([ANCHOR_L.id])
    const queue = [ANCHOR_L.id]
    while (queue.length) {
      const cur = queue.pop()!
      for (const next of adj.get(cur) ?? []) {
        if (!seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    if (!seen.has(ANCHOR_R.id)) return null
    return joints
      .filter((j) => seen.has(j.id) && j.y === ROAD_Y)
      .sort((a, b) => a.x - b.x)
      .map((j) => j.id)
  }, [roadBeams, joints]) // eslint-disable-line react-hooks/exhaustive-deps

  const deckComplete = roadPath !== null

  /* ---------- building ---------- */
  const edit = (fn: () => void) => {
    if (busy) return
    setPhase('build')
    setTest(null)
    fn()
  }

  const setTool = (next: 'build' | 'remove') => {
    if (busy) return
    setToolState(next)
    setSelected(null)
    setHover(null)
  }

  const snap = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, Math.round(v / GRID) * GRID))

  /** Pointer event -> snapped grid coordinates in viewBox space. */
  const svgPoint = (event: { clientX: number; clientY: number }) => {
    const svg = svgRef.current
    if (!svg) return null
    // A synthetic or malformed event can arrive without real coordinates. Bail
    // rather than snap NaN into a joint at NaN,NaN that nothing can select or clear.
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null
    const rect = svg.getBoundingClientRect()
    const x = snap(((event.clientX - rect.left) / rect.width) * VIEW_W, MIN_X, MAX_X)
    const y = snap(((event.clientY - rect.top) / rect.height) * VIEW_H, MIN_Y, MAX_Y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    return { x, y }
  }

  const pushHistory = () =>
    setHistory((prev) => [...prev.slice(-49), { joints, beams }])

  /** True if this joint still matters once `remaining` are the only beams. */
  const touchedBy = (id: string, remaining: { key: string }[]) =>
    remaining.some((b) => b.key.split('|').includes(id))

  /** Set a joint, or draw from the glowing one to here. Pointer and keyboard share it. */
  const drawAt = (p: { x: number; y: number }) => {
    if (busy) return
    const id = jointId(p.x, p.y)

    if (selected === id) {
      setSelected(null)
      return
    }

    const from = selected ? jointAt(selected) : null
    const exists = joints.some((j) => j.id === id)
    const len = from ? Math.hypot(p.x - from.x, p.y - from.y) : 0
    const key = from && selected ? memberKey(selected, id) : null

    // Too far for one beam: hop the chain to an existing joint, but never
    // drop a stranded new joint (the preview line shows red out there).
    if (from && len > MAX_LEN) {
      // Say so. Silently ignoring the click reads as a broken app.
      setTooLongTick((n) => n + 1)
      if (exists) edit(() => setSelected(id))
      return
    }

    const addsBeam = key !== null && !beamKeys.includes(key)
    if (!exists || addsBeam) pushHistory()
    edit(() => {
      if (!exists) setJoints((prev) => [...prev, { id, x: p.x, y: p.y }])
      if (addsBeam && key) setBeams((prev) => [...prev, { key, material }])
      setSelected(id)
    })
  }

  const handleCanvasClick = (event: React.MouseEvent<SVGRectElement>) => {
    if (busy || tool !== 'build') return
    const p = svgPoint(event)
    if (!p) return
    board.setCursor(p)
    drawAt(p)
  }

  const removeBeam = (key: string) => {
    if (busy || tool !== 'remove') return
    pushHistory()
    const nextBeams = beams.filter((b) => b.key !== key)
    edit(() => {
      setBeams(nextBeams)
      // Sweep away joints the removed beam was the last to touch.
      setJoints((prev) => prev.filter((j) => j.fixed || touchedBy(j.id, nextBeams)))
    })
  }

  const removeJoint = (id: string) => {
    if (busy || tool !== 'remove') return
    pushHistory()
    const nextBeams = beams.filter((b) => !b.key.split('|').includes(id))
    edit(() => {
      setBeams(nextBeams)
      setJoints((prev) =>
        prev.filter((j) => j.id !== id && (j.fixed || touchedBy(j.id, nextBeams))),
      )
    })
  }

  /**
   * Erasing from the keyboard mirrors drawing: pick one end of the member, then
   * the other, and it goes. Delete takes the whole joint under the cursor.
   */
  const eraseAt = (p: { x: number; y: number }) => {
    if (busy) return
    const id = jointId(p.x, p.y)
    if (!joints.some((j) => j.id === id)) return
    if (!selected || selected === id) {
      setSelected(selected === id ? null : id)
      return
    }
    const key = memberKey(selected, id)
    if (beamKeys.includes(key)) {
      removeBeam(key)
      setSelected(null)
    } else {
      setSelected(id)
    }
  }

  const board = useSheetCursor({
    step: GRID,
    bounds: { minX: MIN_X, maxX: MAX_X, minY: MIN_Y, maxY: MAX_Y },
    start: { x: LEFT_X + GRID, y: ROAD_Y },
    onCommit: (p) => (tool === 'build' ? drawAt(p) : eraseAt(p)),
    onCancel: () => setSelected(null),
    onDelete: (p) => {
      const j = jointAt(jointId(p.x, p.y))
      // The two bank anchors are part of the site, not of your drawing.
      if (tool === 'remove' && j && !j.fixed) removeJoint(j.id)
    },
    disabled: busy,
  })

  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    edit(() => {
      setJoints(last.joints)
      setBeams(last.beams)
      setHistory((prev) => prev.slice(0, -1))
      setSelected(null)
    })
  }

  const reset = () => {
    if (beams.length > 0 || joints.length > 2) pushHistory()
    edit(() => {
      // Reset means "back to how the level started", which on a guided level
      // is the part-built span, not a bare gap.
      const s = round.starter
      if (s) {
        const nodes = s.nodes.map(([x, y]) => {
          const anchor = x === LEFT_X && y === ROAD_Y ? ANCHOR_L : x === RIGHT_X && y === ROAD_Y ? ANCHOR_R : null
          return anchor ?? { id: jointId(x, y), x, y }
        })
        setJoints(nodes)
        setBeams(s.links.map(([a, b]) => ({ key: memberKey(nodes[a].id, nodes[b].id), material: round.materials[0] })))
      } else {
        setJoints([ANCHOR_L, ANCHOR_R])
        setBeams([])
      }
      setSelected(null)
    })
  }

  /* ---------- testing ---------- */
  const capsFor = (key: string) => {
    const m = MATERIALS[materialOf(key)]
    return { tension: m.tension, compression: m.compression }
  }

  const finishTest = (id: number, failedAt: string | null, peakSag: number, spareNow: number) => {
    if (handledRunRef.current === id) return
    handledRunRef.current = id
    const sagOk = round.maxDeflection === null || peakSag <= round.maxDeflection
    if (failedAt === null && sagOk) {
      setPhase('passed')
      setWon(true)
      lv.clearLevel(
        lv.level.metrics ? { cost, sagcm: peakSag, spare: spareNow } : undefined,
      )
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    } else {
      setPhase('failed')
    }
  }

  const runTest = () => {
    if (busy || overBudget || !deckComplete || !roadPath) return
    const utilization: Record<string, number> = {}
    const force: Record<string, number> = {}
    let failedAt: string | null = null
    let outcome: SolveOutcome | null = null
    let peakMove = 0
    let sagShape: Record<string, [number, number]> | null = null

    for (const id of roadPath) {
      if (id === ANCHOR_L.id || id === ANCHOR_R.id) continue
      const result = solveTruss(joints, beamKeys, id, round.load, capsFor)
      for (const [key, util] of Object.entries(result.utilization)) {
        if (util > (utilization[key] ?? 0)) {
          utilization[key] = util
          force[key] = result.forces[key]
        }
      }
      let move = 0
      for (const [dx, dy] of Object.values(result.deflection)) {
        move = Math.max(move, Math.hypot(dx, dy))
      }
      // Keep the shape from the truck position that bends the span hardest, so
      // a sag failure has something to draw.
      if (move > peakMove) {
        peakMove = move
        sagShape = result.deflection
      }
      if (result.status !== 'ok' && failedAt === null) {
        failedAt = id
        outcome = result
      }
    }
    // The solver moves joints in drawing px, and 20 px is a meter of real river.
    const peakSag = Math.round((peakMove / PX_PER_M) * 100)

    const spareNow = Math.round((1 - Math.max(0, ...Object.values(utilization))) * 100)

    const id = runId + 1
    setTest({ failedAt, outcome, utilization, force, peakSag, sagShape })
    setRunId(id)
    setPhase('testing')
    const crossTime = failedAt ? 1.6 : 2.8
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => finishTest(id, failedAt, peakSag, spareNow), crossTime * 1000 + 400)
  }

  /* ---------- drawing ---------- */
  const displaced = useMemo(() => {
    if (phase !== 'failed') return null
    // Nothing snapped on a sag failure, so there is no collapse to draw: bend
    // the span at the same exaggeration the sag-limit line uses, and the deck
    // visibly hangs below it.
    if (!test?.outcome) {
      if (!test?.sagShape) return null
      const map: Record<string, { x: number; y: number }> = {}
      for (const j of joints) {
        const [dx, dy] = test.sagShape[j.id] ?? [0, 0]
        map[j.id] = { x: j.x + dx * SAG_DRAW, y: j.y + dy * SAG_DRAW }
      }
      return map
    }
    const deflection = test.outcome.deflection
    let maxMove = 0
    for (const [dx, dy] of Object.values(deflection)) {
      maxMove = Math.max(maxMove, Math.abs(dx), Math.abs(dy))
    }
    if (maxMove === 0) return null
    const scale = test.outcome.status === 'unstable' ? 46 / maxMove : Math.min(12, 30 / maxMove)
    const map: Record<string, { x: number; y: number }> = {}
    for (const j of joints) {
      const [dx, dy] = deflection[j.id] ?? [0, 0]
      map[j.id] = { x: j.x + dx * scale, y: j.y + dy * scale }
    }
    return map
  }, [phase, test, joints])

  const pos = (id: string) => displaced?.[id] ?? jointAt(id) ?? { x: 0, y: 0 }

  const forceView = round.forces && showForces

  /**
   * The pen a member is drawn with. Before the load has run that is its
   * material; after it, either how hard it worked or which way it was pushed.
   */
  const memberInk = (key: string) => {
    if (phase === 'failed' && test?.outcome?.worst?.key === key) return INK.red
    const util = test?.utilization[key]
    if (util === undefined) return INK.line
    if (forceView) {
      const f = test?.force[key] ?? 0
      if (Math.abs(f) < 0.5) return INK.soft // idle
      return f > 0 ? INK.check : INK.red // pulled = check blue, pushed = red
    }
    if (util >= 1) return INK.red
    if (util >= 0.75) return INK.amber
    if (util >= 0.4) return INK.line
    return INK.soft
  }

  const memberWeight = (key: string, isRoad: boolean) => {
    if (forceView) {
      const util = test?.utilization[key]
      if (util !== undefined) return 2.4 + Math.min(1, util) * 5.5
    }
    const base = materialOf(key) === 'steel' ? PEN.heavy : PEN.member
    return isRoad ? base + 1.2 : base
  }

  /** Squashed members are drawn broken, so push and pull read without color. */
  const memberDash = (key: string) =>
    forceView && (test?.force[key] ?? 0) < -0.5 ? '10 5' : undefined

  /**
   * How much of the hardest-worked beam's strength is still in hand, as a
   * percentage. Only meaningful once the truck has run: a bridge that never
   * carried anything has nothing spare.
   */
  const spare = test ? Math.round((1 - Math.max(0, ...Object.values(test.utilization))) * 100) : 0
  const failMode = test?.outcome?.status === 'unstable' ? 'unstable' : test?.outcome?.worst?.mode
  const sagFailed =
    phase === 'failed' && test?.failedAt === null && round.maxDeflection !== null && (test?.peakSag ?? 0) > round.maxDeflection
  const loadStopX = test?.failedAt ? (jointAt(test.failedAt)?.x ?? RIGHT_X) : VIEW_W + 60
  const leftover = round.budget !== null ? round.budget - cost : 0

  /* ---------- the sheet ---------- */
  const status: SheetStatus = phase === 'passed' ? 'approved' : phase === 'failed' ? 'revise' : 'draft'
  const worstKey = test?.outcome?.worst?.key
  const worstForce = worstKey ? Math.abs(Math.round(test?.force[worstKey] ?? 0)) : 0
  const worstCap = worstKey
    ? failMode === 'tension'
      ? MATERIALS[materialOf(worstKey)].tension
      : MATERIALS[materialOf(worstKey)].compression
    : 0
  const worstUtil = test ? Math.max(0, ...Object.values(test.utilization)) : 0

  // Schedule lines, one per material, reconciled so they add to the number the
  // budget check actually uses.
  const scheduleRows = round.materials
    .map((id) => {
      const mine = beams.filter((b) => b.material === id)
      const px = mine.reduce((sum, b) => sum + lengthOf(b.key), 0)
      return { id, count: mine.length, meters: px / PX_PER_M, amount: Math.round(px * MATERIALS[id].cost) }
    })
    .filter((r) => r.count > 0)
  const drift = cost - scheduleRows.reduce((sum, r) => sum + r.amount, 0)
  if (scheduleRows.length > 0) scheduleRows[0].amount += drift

  const cursorStation = ((board.cursor.x - LEFT_X) / PX_PER_M).toFixed(1)
  const cursorLevel = ((ROAD_Y - board.cursor.y) / PX_PER_M).toFixed(1)
  const cursorJoint = joints.some((j) => j.id === jointId(board.cursor.x, board.cursor.y))

  // Column grid: one bubble every two modules across the crossing.
  const bubbles: { x: number; label: string }[] = []
  for (let x = LEFT_X; x <= RIGHT_X; x += GRID * 2) {
    bubbles.push({ x, label: String.fromCharCode(65 + bubbles.length) })
  }

  // The truss depth, measured off whatever has actually been drawn.
  const topY = joints.reduce((min, j) => Math.min(min, j.y), ROAD_Y)
  const depthM = (ROAD_Y - topY) / PX_PER_M

  /** Redline notes land in the clear water band, on the same side as the mark. */
  const notePlace = (x: number) => ({
    x: Math.max(190, Math.min(610, x + (x <= VIEW_W / 2 ? 80 : -80))),
    y: 348,
  })

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {phase === 'passed' && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.forces ? <InsightToggle label="forces" on={showForces} onChange={setShowForces} /> : undefined}
      />

      <Objective
        goal={`Carry the ${round.load} t ${round.label.toLowerCase()} across${round.budget !== null ? ` for $${round.budget.toLocaleString()} or less` : ''}${round.maxDeflection !== null ? `, with the deck dipping under ${round.maxDeflection} cm` : ''}`}
        status={`the deck ${deckComplete ? 'reaches both banks' : 'does not reach across yet'}`}
        met={won}
      />

      <p className="mb-3 max-w-2xl text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>

      <DraftingSheet
        tools={
          <>
            <SheetTool
              active={tool === 'build'}
              onClick={() => setTool('build')}
              disabled={busy}
              icon={<PenLine className="h-3.5 w-3.5" />}
              label="draw"
            />
            <SheetTool
              active={tool === 'remove'}
              onClick={() => setTool('remove')}
              disabled={busy}
              icon={<Eraser className="h-3.5 w-3.5" />}
              label="erase"
              tone="red"
            />
            <p id="board-help" className="max-w-xl text-[11px] leading-snug text-[var(--dr-ink-soft,#6c6252)]">
              {tool === 'build'
                ? 'Click the board to set a joint, then click on to run a member from the glowing one. Click it again to let go. The deck has to reach both banks at datum level.'
                : 'Click a member to erase it. Click a joint to erase it and everything on it.'}{' '}
              Keyboard: arrow keys walk the grid, enter sets a joint or draws to it, escape lets go, delete erases the joint under the cursor.
            </p>
          </>
        }
        titleBlock={
          <TitleBlock
            project="Riverside crossing"
            drawing={`${lv.level.n}. ${lv.level.title}`}
            sheetNo={`S-0${lv.level.n}`}
            scale="1 square = 2 m"
            checking={`${round.load} t ${round.label.toLowerCase()}${round.budget !== null ? `, $${round.budget.toLocaleString('en-US')} cap` : ', no cost cap'}${round.maxDeflection !== null ? `, ${round.maxDeflection} cm sag max` : ''}`}
            rev={runId}
            status={status}
          />
        }
        footer={
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-[11px] text-[var(--dr-ink-soft,#6c6252)]">
              <span
                role="status"
                aria-live={board.active ? 'polite' : 'off'}
                className={cn(LETTER, 'tabular-nums')}
                style={{ letterSpacing: TRACK.normal }}
              >
                cursor {cursorStation} m along, {cursorLevel} m up · {cursorJoint ? 'joint here' : 'clear'}
              </span>
              <span className={cn(LETTER, 'tabular-nums')} style={{ letterSpacing: TRACK.normal }}>
                {beams.length} members · depth {depthM.toFixed(1)} m
                {test ? ` · worst member ${Math.round(worstUtil * 100)}% of capacity · sag ${test.peakSag} cm` : ''}
              </span>
            </div>

            {test && (
              <DrawingKey
                title="key"
                items={
                  forceView
                    ? [
                        { label: 'pulled apart', sample: <line x1="1" y1="5" x2="25" y2="5" stroke={INK.check} strokeWidth="3" /> },
                        { label: 'squashed', sample: <line x1="1" y1="5" x2="25" y2="5" stroke={INK.red} strokeWidth="3" strokeDasharray="6 3" /> },
                        { label: 'thicker means harder worked', sample: <line x1="1" y1="5" x2="25" y2="5" stroke={INK.line} strokeWidth="5" /> },
                      ]
                    : [
                        { label: 'lightly loaded', sample: <line x1="1" y1="5" x2="25" y2="5" stroke={INK.soft} strokeWidth="2" /> },
                        { label: 'working', sample: <line x1="1" y1="5" x2="25" y2="5" stroke={INK.line} strokeWidth="3" /> },
                        { label: 'near capacity', sample: <line x1="1" y1="5" x2="25" y2="5" stroke={INK.amber} strokeWidth="3" /> },
                        { label: 'over capacity', sample: <line x1="1" y1="5" x2="25" y2="5" stroke={INK.red} strokeWidth="3.5" /> },
                      ]
                }
              />
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {round.materials.length > 1 && (
                <StencilPalette
                  label="material stencil"
                  value={material}
                  onChange={(id) => setMaterial(id as MaterialId)}
                  disabled={busy}
                  options={round.materials.map((id) => ({
                    id,
                    mark: id === 'steel' ? 'S' : 'W',
                    label: MATERIALS[id].label,
                    note: `$${MATERIALS[id].cost * PX_PER_M}/m · holds ${MATERIALS[id].compression}-${MATERIALS[id].tension}`,
                    swatch:
                      id === 'steel' ? (
                        <>
                          <line x1="1" y1="7" x2="25" y2="7" stroke={INK.line} strokeWidth="4.4" />
                          <line x1="13" y1="2" x2="13" y2="12" stroke={INK.paper} strokeWidth="1.4" />
                        </>
                      ) : (
                        <>
                          <line x1="1" y1="7" x2="25" y2="7" stroke={INK.line} strokeWidth="3.2" />
                          {[5, 11, 17, 23].map((x) => (
                            <line key={x} x1={x - 3} y1="10" x2={x} y2="4" stroke={INK.soft} strokeWidth="0.9" />
                          ))}
                        </>
                      ),
                  }))}
                />
              )}
              <Schedule
                title="materials schedule"
                className={round.materials.length > 1 ? undefined : 'sm:col-span-2'}
                columns={[
                  { key: 'mark', label: 'mark' },
                  { key: 'qty', label: 'qty', align: 'right' },
                  { key: 'length', label: 'length', align: 'right' },
                  { key: 'rate', label: 'rate', align: 'right' },
                  { key: 'amount', label: 'amount', align: 'right' },
                ]}
                empty="Nothing scheduled yet. Draw the span and the quantities land here."
                rows={scheduleRows.map((r) => ({
                  key: r.id,
                  cells: {
                    mark: `${r.id === 'steel' ? 'S' : 'W'} ${MATERIALS[r.id].label}`,
                    qty: r.count,
                    length: `${r.meters.toFixed(1)} m`,
                    rate: `$${MATERIALS[r.id].cost * PX_PER_M}/m`,
                    amount: `$${r.amount.toLocaleString('en-US')}`,
                  },
                }))}
                foot={
                  round.budget === null
                    ? [{ label: 'total, materials free this sheet', value: `$${cost.toLocaleString('en-US')}` }]
                    : [
                        { label: 'total', value: `$${cost.toLocaleString('en-US')}` },
                        { label: 'budget', value: `$${round.budget.toLocaleString('en-US')}` },
                        {
                          label: overBudget ? 'over by' : 'left',
                          value: `$${Math.abs(leftover).toLocaleString('en-US')}`,
                          tone: overBudget ? 'over' : 'ok',
                        },
                      ]
                }
              />
            </div>

            {/* Verdicts are lettered notes on the sheet. */}
            <div aria-live="polite" className="min-h-[2.5rem] space-y-2">
              {phase === 'passed' && (
                <NoteBlock n={1} tone="check">
                  It holds. The deck carried {round.load} t
                  {round.budget !== null ? ` for $${cost.toLocaleString('en-US')}` : ''}
                  {round.budget !== null && leftover > 0 ? `, $${leftover.toLocaleString('en-US')} under budget` : ''}. Stamped
                  and signed off.
                </NoteBlock>
              )}
              {sagFailed && (
                <NoteBlock n={1} tone="amber">
                  It held, but the deck dipped {test?.peakSag} cm and the limit is {round.maxDeflection} cm. Nothing broke, it is
                  just too floppy. A deeper truss buys stiffness; more steel on its own does not.
                </NoteBlock>
              )}
              {phase === 'failed' && !sagFailed && failMode === 'unstable' && (
                <NoteBlock n={1} tone="red">
                  The frame folded and dropped the load. Those shapes could not hold themselves rigid, so brace the squares into
                  triangles.
                </NoteBlock>
              )}
              {phase === 'failed' && !sagFailed && failMode === 'tension' && worstKey && (
                <NoteBlock n={1} tone="red">
                  Snap! Member {markOf(worstKey)} was pulled apart under {worstForce} of tension, and it is only good for {worstCap}.
                  {round.materials.length > 1 && materialOf(worstKey) === 'wood'
                    ? ' It is wood: steel takes more than twice the pull.'
                    : ' Add another load path so no single member carries this much.'}
                </NoteBlock>
              )}
              {phase === 'failed' && !sagFailed && failMode === 'compression' && worstKey && (
                <NoteBlock n={1} tone="red">
                  Crunch! Member {markOf(worstKey)} buckled under {worstForce} of compression against a {worstCap} limit. Squeezed
                  members give out sooner than stretched ones.
                  {round.materials.length > 1 && materialOf(worstKey) === 'wood'
                    ? ' That one is wood: swap it to steel or shorten it with a joint.'
                    : ' Shorter members and more triangles spread the squeeze.'}
                </NoteBlock>
              )}
              {phase === 'build' && overBudget && (
                <NoteBlock n={1} tone="red">
                  The schedule is over budget by ${(cost - (round.budget ?? 0)).toLocaleString('en-US')}. Take material out before
                  you run the check.
                </NoteBlock>
              )}
              {tooLongTick > 0 && (
                <motion.div
                  key={tooLongTick}
                  initial={reduced ? { opacity: 1 } : { opacity: 0, y: -4 }}
                  animate={reduced ? { opacity: 1 } : { opacity: [0, 1, 1, 0], y: 0 }}
                  transition={reduced ? { duration: 0 } : { duration: 2.6, times: [0, 0.12, 0.75, 1] }}
                  role="status"
                >
                  <NoteBlock n="reach" tone="amber">
                    That member is longer than 6.5 m. Drop a joint partway and run two shorter ones.
                  </NoteBlock>
                </motion.div>
              )}
            </div>
          </div>
        }
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full touch-none"
          role="application"
          aria-label={`Bridge elevation, sheet S-0${lv.level.n}. ${beams.length} members drawn, deck ${deckComplete ? 'reaches both banks' : 'stops short'}.`}
          aria-describedby="board-help"
          {...board.boardProps}
        >
          <SnapGrid x0={MIN_X} y0={MIN_Y} x1={MAX_X} y1={MAX_Y} step={GRID} major={2} />

          {/* the site: two banks, the water between them */}
          <path d={`M0 ${ROAD_Y} h${LEFT_X} v${VIEW_H - ROAD_Y} H0 Z`} fill={INK.grid} opacity="0.18" />
          <path d={`M${VIEW_W} ${ROAD_Y} h-${VIEW_W - RIGHT_X} v${VIEW_H - ROAD_Y} H${VIEW_W} Z`} fill={INK.grid} opacity="0.18" />
          <GroundHatch x={0} y={ROAD_Y} width={LEFT_X} />
          <GroundHatch x={RIGHT_X} y={ROAD_Y} width={VIEW_W - RIGHT_X} />
          <line x1={LEFT_X} y1={300} x2={RIGHT_X} y2={300} stroke={INK.soft} strokeWidth={PEN.thin} />
          {[316, 330].map((y) => (
            <line key={y} x1={LEFT_X + 30} y1={y} x2={RIGHT_X - 30} y2={y} stroke={INK.soft} strokeWidth={PEN.hair} strokeDasharray="26 18" opacity="0.7" />
          ))}
          <text x={LEFT_X + 12} y={294} className={LETTER} style={{ letterSpacing: TRACK.normal }} fontSize="9" fill={INK.soft}>
            river
          </text>

          {bubbles.map((b) => (
            <GridBubble key={b.label} x={b.x} y={32} label={b.label} leaderTo={MIN_Y - 8} />
          ))}

          <DatumLine x1={MIN_X - 24} x2={MAX_X + 6} y={ROAD_Y} label="datum, deck level" />

          {/* the sag limit for level 5, drawn at the same exaggeration as the sag */}
          {round.maxDeflection !== null && (
            <g className="pointer-events-none">
              <line
                x1={MIN_X}
                y1={ROAD_Y + sagLinePx(round.maxDeflection)}
                x2={MAX_X}
                y2={ROAD_Y + sagLinePx(round.maxDeflection)}
                strokeDasharray="10 5"
                strokeWidth={PEN.dim}
                stroke={INK.amber}
              />
              <text
                x={MAX_X}
                y={ROAD_Y + sagLinePx(round.maxDeflection) + 13}
                textAnchor="end"
                className={LETTER}
                style={{ letterSpacing: TRACK.normal }}
                fontSize="10"
                fill={INK.amber}
              >
                sag limit {round.maxDeflection} cm, drawn x{SAG_DRAW}
              </text>
            </g>
          )}

          <rect
            x="0"
            y="0"
            width={VIEW_W}
            height={VIEW_H}
            fill="transparent"
            onClick={handleCanvasClick}
            onPointerMove={(e) => {
              if (!busy && tool === 'build') setHover(svgPoint(e))
            }}
            onPointerLeave={() => setHover(null)}
            className={busy || tool !== 'build' ? '' : 'cursor-crosshair'}
          />

          {beams.map(({ key }) => {
            const [a, b] = key.split('|')
            const pa = pos(a)
            const pb = pos(b)
            const isRoad = roadBeams.includes(key)
            const removable = tool === 'remove' && !busy
            const util = test?.utilization[key]
            const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }
            const f = test?.force[key] ?? 0
            return (
              // In draw mode members ignore the pointer entirely, so a click
              // near one always places or selects instead of erasing.
              <g
                key={key}
                onClick={(e) => { e.stopPropagation(); removeBeam(key) }}
                className={cn('group', removable && 'cursor-pointer')}
                pointerEvents={removable ? 'auto' : 'none'}
              >
                <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="transparent" strokeWidth="18" />
                <line
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  stroke={memberInk(key)}
                  strokeWidth={memberWeight(key, isRoad)}
                  strokeDasharray={memberDash(key)}
                  strokeLinecap="butt"
                  className={removable ? 'transition-opacity group-hover:opacity-30' : undefined}
                />
                {/* Members worth reading carry their number, on a wipeout. */}
                {(() => {
                  const tag =
                    util === undefined
                      ? null
                      : forceView
                        ? util >= 0.5 ? `${f > 0 ? 't' : 'c'} ${Math.abs(Math.round(f))}` : null
                        : util >= 0.75 ? `${Math.round(util * 100)}%` : null
                  if (!tag) return null
                  const w = tag.length * 6.4 + 6
                  return (
                    <g>
                      <rect x={mid.x - w / 2} y={mid.y - 14} width={w} height="12" fill={INK.paper} />
                      <text x={mid.x} y={mid.y - 5} textAnchor="middle" className={LETTER} fontSize="9" fontWeight="700" fill={memberInk(key)}>
                        {tag}
                      </text>
                    </g>
                  )
                })()}
                {removable && (
                  <line
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    stroke={INK.red}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray="7 5"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  />
                )}
              </g>
            )
          })}

          {/* Where the next joint lands, and the member it would run. */}
          {tool === 'build' && !busy && hover && (() => {
            const from = selected ? jointAt(selected) : null
            const tooFar = from ? Math.hypot(hover.x - from.x, hover.y - from.y) > MAX_LEN : false
            return (
              <g className="pointer-events-none">
                {from && (
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={hover.x}
                    y2={hover.y}
                    stroke={tooFar ? INK.red : INK.check}
                    strokeWidth={PEN.dim}
                    strokeDasharray="8 6"
                  />
                )}
                <circle cx={hover.x} cy={hover.y} r="6" fill="none" stroke={tooFar ? INK.red : INK.check} strokeWidth={PEN.dim} />
                {tooFar && (
                  <text x={hover.x} y={hover.y - 13} textAnchor="middle" className={LETTER} fontSize="10" fontWeight="700" fill={INK.red}>
                    too long for one member
                  </text>
                )}
              </g>
            )
          })()}

          {joints.map((j) => {
            const p = pos(j.id)
            const isSelected = selected === j.id
            const removable = tool === 'remove' && !busy && !j.fixed
            return (
              <g
                key={j.id}
                onClick={(e) => { e.stopPropagation(); removeJoint(j.id) }}
                className={cn('group', removable ? 'cursor-pointer' : 'pointer-events-none')}
                pointerEvents={removable ? 'auto' : 'none'}
              >
                {j.fixed && <PinSupport x={p.x} y={p.y} />}
                {removable && <circle cx={p.x} cy={p.y} r="14" fill="transparent" />}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isSelected ? 5.5 : 4}
                  fill={INK.paper}
                  stroke={isSelected ? INK.check : INK.line}
                  strokeWidth={PEN.dim}
                />
                {isSelected && (
                  <rect x={p.x - 10} y={p.y - 10} width="20" height="20" fill="none" stroke={INK.check} strokeWidth={PEN.thin} strokeDasharray="4 3" />
                )}
                {removable && (
                  <circle cx={p.x} cy={p.y} r="11" fill="none" stroke={INK.red} strokeWidth={PEN.thin} strokeDasharray="4 3" className="opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </g>
            )
          })}

          {/* dimensions: the crossing, and how deep the truss you drew is */}
          <DimString x1={LEFT_X} y1={ROAD_Y} x2={RIGHT_X} y2={ROAD_Y} offset={150} label={`${((RIGHT_X - LEFT_X) / PX_PER_M).toFixed(2)} m clear span`} />
          {topY < ROAD_Y && (
            <DimString x1={LEFT_X} y1={topY} x2={LEFT_X} y2={ROAD_Y} offset={52} label={`${depthM.toFixed(2)} m`} />
          )}
          <ScaleBar x={20} y={398} pxPerUnit={PX_PER_M} units={4} />

          {(phase === 'testing' || phase === 'failed') && (
            <motion.g
              key={runId}
              initial={{ x: LEFT_X - 100, y: 0 }}
              animate={
                phase === 'failed' && test?.failedAt
                  ? { x: loadStopX, y: (displaced?.[test.failedAt]?.y ?? ROAD_Y) - ROAD_Y }
                  : { x: loadStopX, y: 0 }
              }
              transition={
                reduced
                  ? { duration: 0 }
                  : phase === 'failed' && test?.failedAt
                    ? { type: 'spring', stiffness: 200, damping: 15 }
                    : { duration: test?.failedAt ? 1.6 : 2.8, ease: 'linear' }
              }
              className="pointer-events-none"
            >
              <LoadArrow x={0} y={ROAD_Y - 6} length={34 + round.load * 2.4} label={`${round.load} t`} />
            </motion.g>
          )}

          {/* the verdict, drawn on the sheet */}
          {(() => {
            const worst = phase === 'failed' ? test?.outcome?.worst ?? null : null
            if (!worst) return null
            const [a, b] = worst.key.split('|')
            const pa = pos(a)
            const pb = pos(b)
            const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }
            const note = notePlace(mid.x)
            return (
              <Redline
                x={mid.x}
                y={mid.y}
                rx={Math.abs(pb.x - pa.x) / 2 + 15}
                ry={Math.abs(pb.y - pa.y) / 2 + 15}
                noteX={note.x}
                noteY={note.y}
                seed={`${runId}-${worst.key}`}
                rev={runId}
                note={[
                  `${markOf(worst.key)} over capacity`,
                  `${failMode === 'tension' ? 'pull' : 'push'} ${worstForce} against ${worstCap} allowed`,
                  `${Math.round(worstUtil * 100)}% of capacity, ${MATERIALS[materialOf(worst.key)].label.toLowerCase()}`,
                ]}
              />
            )
          })()}
          {phase === 'failed' && test?.outcome?.status === 'unstable' && test.failedAt && (
            <Redline
              x={pos(test.failedAt).x}
              y={pos(test.failedAt).y - 20}
              rx={58}
              ry={48}
              noteX={notePlace(pos(test.failedAt).x).x}
              noteY={notePlace(pos(test.failedAt).x).y}
              seed={`${runId}-fold`}
              rev={runId}
              note={['frame folds here', 'no triangle to hold this bay', 'brace it and run the check again']}
            />
          )}
          {sagFailed && (
            <Redline
              x={(LEFT_X + RIGHT_X) / 2}
              y={ROAD_Y + sagLinePx(test?.peakSag ?? 0) / 2}
              rx={132}
              ry={30}
              noteX={notePlace((LEFT_X + RIGHT_X) / 2).x}
              noteY={notePlace((LEFT_X + RIGHT_X) / 2).y}
              seed={`${runId}-sag`}
              rev={runId}
              note={[`deck sag ${test?.peakSag} cm`, `limit ${round.maxDeflection} cm, nothing broke`]}
            />
          )}
          {phase === 'passed' && (
            <ApprovalStamp x={400} y={112} lines={[`${round.load} t carried`, `rev ${String(runId).padStart(2, '0')}, ${spare}% strength spare`]} />
          )}
          {phase === 'failed' && (
            <RevisionStamp x={400} y={112} lines={[`rev ${String(runId).padStart(2, '0')}`, 'see redline']} />
          )}

          {board.active && !busy && <CursorMark x={board.cursor.x} y={board.cursor.y} tone={tool === 'remove' ? INK.red : INK.check} />}
        </svg>
      </DraftingSheet>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={runTest} disabled={busy || overBudget || !deckComplete}>
          <Truck className="h-5 w-5" />
          {busy ? 'Load crossing...' : 'Run the load check'}
        </Button>
        <Button variant="ghost" onClick={undo} disabled={busy || history.length === 0} aria-label="Undo last change">
          <Undo2 className="h-4 w-4" />
          Undo
        </Button>
        <Button variant="ghost" onClick={reset} disabled={busy} aria-label="Clear the drawing">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={test ? { cost, sagcm: test.peakSag, spare } : { cost }}
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
              ? `Carried ${round.load} t for $${cost.toLocaleString('en-US')}, dipping ${test?.peakSag} cm with ${spare} % strength to spare. Try it leaner, or deeper.`
              : 'Signed off. On you go.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
