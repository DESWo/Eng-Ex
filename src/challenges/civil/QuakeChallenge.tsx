import { useEffect, useMemo, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import { Eraser, PenLine, RotateCcw, Waves } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
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
  Leader,
  LoadArrow,
  NoteBlock,
  PEN,
  Redline,
  RevisionStamp,
  ScaleBar,
  Schedule,
  SheetTool,
  StencilPalette,
  TRACK,
  TitleBlock,
  useSheetCursor,
  type SheetStatus,
} from '@/components/instruments/drafting'
import { useLevels } from '@/hooks/useLevels'
import { attemptsFor, useAttempts } from '@/hooks/useAttempts'
import { playSound } from '@/lib/sound'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  DRIFT_CAP,
  DT,
  H_LOBBY,
  H_STOREY,
  MAX_PER_STOREY,
  OPEN_LOBBY,
  groundRecord,
  runDesign,
  spectrum,
} from './shear'
import type { Building, Gates, Outcome } from './shear'

/**
 * Shake Proof, drawn as a structural frame elevation on a drafting sheet.
 *
 * You have a rack of identical X-braces and a frame that is three bays wide, and
 * you decide which stories get them. A real shear-building time history
 * (src/challenges/civil/shear.ts) shakes what you drew against a seeded ground
 * record and tells you which story tore.
 *
 * The tuning is built so the answer is the DISTRIBUTION of stiffness up the
 * building, not the amount. What that protects, for anyone editing it:
 *
 * 1. The rack is a fixed count of identical braces, so there is no number to
 *    max out. On level 3, [2,2,2,1,1,1] drops the lobby and [3,2,2,1,1,0]
 *    survives with 40% margin, on the same nine braces.
 * 2. Greedy heuristics all fail somewhere. Spread evenly, level 3 fails at the
 *    lobby. All at the base, it fails at story 4. Max the story that failed
 *    last time, it fails at the story above. Bearings on level 4 do not save
 *    the lobby.
 * 3. Level 3 stands on 16 of 2338 layouts with 3 tests, so guessing does not
 *    work; matching the stiffness profile to the shear profile lands a winner
 *    on 5 of the 8 tapered full-rack layouts.
 * 4. Of all 8024 level 5 designs, none meets all three pars.
 *
 * Every number in the level table below is proven by exhaustive enumeration in
 * scripts/verify-quake.mjs. Run `node scripts/verify-quake.mjs` after touching
 * any constant in this file or in shear.ts.
 *
 * Drawing conventions come from src/components/instruments/drafting/index.ts.
 * The board is a frame elevation, so it is gridded the way an elevation is
 * gridded: column-line bubbles across the top, level datums across the stories.
 * There is no square snap grid, because the glazed lobby is 5 m and the stories
 * above it are 3.4 m, and no uniform square is honest about both.
 */

/* ------------------- tuning knobs (edit freely) ------------------- */

const BRACE_COST = 20000 // one X-brace, installed
const BEARING_COST = 220000 // the whole isolation layer, a procurement decision

/** Drawing scale: a normal 3.4 m story is 46 px tall. */
const PX_PER_M = 46 / H_STOREY
/** Sway is drawn this many times life size, the same on every level and design. */
const EXAGGERATION = 4
const SCALE = PX_PER_M * EXAGGERATION
/** Seconds of record played either side of the moment the building peaks. */
const PLAY_HALF = 1.75
/**
 * The model is linear elastic. Past double the limit it is doing arithmetic
 * about a building that already stopped existing, so the readout stops there.
 */
const DRIFT_DISPLAY_CAP = 40
/** How much of its height the story that tore loses as it folds. */
const COLLAPSE_SQUASH = 0.55
/** Extra sideways px everything above the failure slides as it comes down. */
const COLLAPSE_LEAN = 24

/* ------------------- sheet layout ------------------- */

const SCENE_W = 800
const TOP_PAD = 54
const GROUND_BAND = 104
const SPECTRUM_H = 152
const ISO_LIFT = 26 // px the frame rises when it goes onto bearings
const BEARING_H = 14
const TOWER_X = 250
const BAY_M = 6.0 // one bay, m
const BAY_PX = BAY_M * PX_PER_M
const TOWER_W = 3 * BAY_PX
/** The story drift diagram, drawn beside the elevation like a real one. */
const DRIFT_X = 596
const DRIFT_W = 128
/** Braces still on the stencil sheet, cut out along the top edge. */
const STOCK_X = 20
const STOCK_Y = 20
const STOCK_PITCH = 15
const STOCK_W = 12
const STOCK_H = 11

const money = (n: number) => `$${n.toLocaleString('en-US')}`

/* ------------------- the levels ------------------- */

const uniform = (n: number): Building => ({
  heights: Array<number>(n).fill(H_STOREY),
  open: Array<number>(n).fill(1),
})

/** Six stories with a tall glazed lobby at the bottom. Levels 3, 4 and 5. */
const LOBBY_6: Building = {
  heights: [H_LOBBY, H_STOREY, H_STOREY, H_STOREY, H_STOREY, H_STOREY],
  open: [OPEN_LOBBY, 1, 1, 1, 1, 1],
}

interface Site {
  /** The rhythm the ground shakes at, seconds per beat. */
  Tg: number
  /** Peak ground acceleration, in g. */
  pga: number
  /** Site bandwidth: 0.6 broadband rock, 0.35 a valley ringing at one note. */
  zg: number
}

interface QuakeSetup {
  building: Building
  /** X-braces available. Three is the most any one story can hold. */
  rack: number
  /** Bearings on the menu this level. */
  bearings: boolean
  budget: number | null
  gates: Gates
  site: Site
  /** Three site facts in one line. If this is not read, level 4 looks arbitrary. */
  badge: string
  /** Level 4 only: the response spectrum panel. */
  showSpectrum: boolean
  brief: string
}

const LEVELS: ChallengeLevel<QuakeSetup>[] = [
  {
    n: 1,
    title: 'Braces stop the lean',
    phase: 'play',
    concept: 'One story tears',
    teach:
      'A building does not tip over like a bottle. One story tears sideways while everything above it rides along on top. Lean is measured in millimeters of sideways slip for every meter of story height, and 20 is where the columns give up. Take the brace pencil and draw an X into any empty bay. The frame does not care which of the three bays you brace, only how many, so put them where they look right to you.',
    setup: {
      building: uniform(4),
      rack: 12,
      bearings: false,
      budget: null,
      gates: {},
      site: { Tg: 0.9, pga: 0.42, zg: 0.6 },
      badge: 'shallow quake, the ground beats about once a second, 0.42g',
      showSpectrum: false,
      brief: 'Four floors, twelve braces, no budget. Get every story under the lean limit.',
    },
  },
  {
    n: 2,
    title: 'Four braces, five floors',
    phase: 'understand',
    concept: 'The bottom carries the shove',
    teach:
      'Four braces, five floors, so something goes bare. Every floor above a story shoves on it when the ground yanks, so the bottom story carries the whole building and the top story carries almost nothing. Put the rack where the shove is. Of the 121 ways to lay these four braces out, 21 stand, and every single one of them braces story 1 and story 2.',
    setup: {
      building: uniform(5),
      rack: 4,
      bearings: false,
      budget: null,
      gates: {},
      site: { Tg: 1.0, pga: 0.36, zg: 0.6 },
      badge: 'shallow quake, a one second beat, 0.36g',
      showSpectrum: false,
      brief: 'One more floor and eight fewer braces. Something has to go bare.',
    },
  },
  {
    n: 3,
    title: 'The glass lobby',
    phase: 'understand',
    concept: 'The weak link moves',
    teach:
      'This building is already up and you are retrofitting it. The lobby is 5 m tall with glass instead of walls, so it starts at about a fifth of a normal story. Spreading nine braces evenly is fair and it drops the lobby, because fair is not what the shear profile asks for. Piling all nine on the bottom three fails one story higher, because you built a cliff and the movement went where the cliff ended. Feed the soft story more than its share and taper upward.',
    setup: {
      building: LOBBY_6,
      rack: 9,
      bearings: false,
      budget: null,
      gates: {},
      site: { Tg: 1.2, pga: 0.5, zg: 0.6 },
      badge: 'deep soft valley, rings at 1.2 s, 0.50g',
      showSpectrum: false,
      brief: 'A built hospital with a known flaw, nine braces, and a valley that rings.',
    },
  },
  {
    n: 4,
    title: 'Bearings are not a get out',
    phase: 'analyze',
    concept: 'Your rhythm against the ground',
    teach:
      'Your building has a rhythm and so does the ground. Bearings under the base make yours slow, which moves it away from the ground’s, and the floors go quiet. Turn on the spectrum to see how hard this ground pushes a building of every rhythm, with your own marked on it. Worth knowing: earthquake load is not pushed on you from outside, it is your own mass times your own acceleration, which is why quiet floors and small forces are the same thing. The scanners in this hospital are rated to 60 %g, and bearings on their own still let the lobby tear.',
    setup: {
      building: LOBBY_6,
      rack: 14,
      bearings: true,
      budget: 300000,
      gates: { moat: 0.3, joltCap: 60 },
      site: { Tg: 0.45, pga: 0.46, zg: 0.35 },
      badge: 'firm ground close to the fault, a sharp 0.45 second beat, 0.46g',
      showSpectrum: true,
      brief: 'Same building, sharper ground, and a scanner suite that cannot be shaken.',
    },
  },
  {
    n: 5,
    title: 'Sign off the hospital',
    phase: 'optimize',
    concept: 'Nothing wins everything',
    teach:
      'Standing up is the cheap part. Braces low and hard keep the building still and hammer the floors. Bearings make the floors quiet and let the whole building wander a foot sideways. Cash buys either one and never both. Decide what a hospital needs most and defend it.',
    setup: {
      building: LOBBY_6,
      rack: 14,
      bearings: true,
      budget: null,
      gates: { moat: 0.3 },
      site: { Tg: 0.55, pga: 0.5, zg: 0.35 },
      badge: 'firm ground, a 0.55 second beat, 0.50g',
      showSpectrum: false,
      brief: 'No budget cap, five tests, and three targets that pull against each other.',
    },
    // Pars proven by exhaustive enumeration over all 8024 designs (see
    // scripts/verify-quake.mjs): 3775 stand, and of those 578 meet the cost
    // par, 1177 the jolt par and 521 the travel par. 313 meet exactly two.
    // ZERO meet all three.
    //
    // Worst lean is NOT scored here and stays the pass/fail gate: in this model
    // bearings win both lean and jolt, so those two cannot be opposed. Travel
    // is the metric a bearing loses at.
    //
    // The metric ids changed with this rework and must not go back. The retired
    // `cost` bests came from a $16,000 budget and would render forever as an
    // unbeatable record against a $500,000 one. The challenge id stays `quake`
    // so saved level clears survive.
    metrics: [
      { id: 'spend', label: 'Build cost', goal: 'min', target: 240000 },
      { id: 'jolt', label: 'Peak floor jolt', goal: 'min', target: 35, unit: ' %g' },
      { id: 'travel', label: 'How far it moves', goal: 'min', target: 22, unit: ' cm' },
    ],
  },
]

type Phase = 'build' | 'shaking' | 'passed' | 'failed'
/** The instrument in your hand: the brace pencil, or the eraser. */
type Tool = 'brace' | 'strip'

/** A frozen frame of the shake: where every floor was, and how far it has folded. */
interface Pose {
  /** Displacement of each degree of freedom, meters. */
  disp: number[]
  /** Ground displacement, meters. */
  gnd: number
  /** 0 while it is only leaning, 1 once the story that tore has folded. */
  collapse: number
}

/** A story shears into a parallelogram: its floor slides `b`, its base `a`. */
const shear = (a: number, b: number, yBottom: number, h: number) => {
  const slope = (b - a) / Math.max(6, h)
  return `matrix(1,0,${(-slope).toFixed(5)},1,${(a + slope * yBottom).toFixed(3)},0)`
}

const leanText = (v: number) => (v > DRIFT_DISPLAY_CAP ? `over ${DRIFT_DISPLAY_CAP}` : v.toFixed(1))

export function QuakeChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('quake', LEVELS)
  const round = lv.level.setup
  const N = round.building.heights.length

  const [bays, setBays] = useState<boolean[][]>(() =>
    Array.from({ length: N }, () => [false, false, false]),
  )
  const [isolated, setIsolated] = useState(false)
  const [phase, setPhase] = useState<Phase>('build')
  const [pose, setPose] = useState<Pose | null>(null)
  const [result, setResult] = useState<Outcome | null>(null)
  const [showSpectrum, setShowSpectrum] = useState(true)
  const [tool, setTool] = useState<Tool>('brace')
  const [hover, setHover] = useState<{ s: number; b: number } | null>(null)
  const [runId, setRunId] = useState(0)

  const reduced = useReducedMotion()
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)
  const completedRef = useRef(false)
  const handledRunRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Pending bench-clear after the test pool ran dry. */
  const refillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const collapseRef = useRef<{ stop: () => void } | null>(null)
  const storeyRefs = useRef<(SVGGElement | null)[]>([])
  const baseRef = useRef<SVGGElement | null>(null)
  const bearingRef = useRef<SVGGElement | null>(null)
  const groundRef = useRef<SVGGElement | null>(null)

  const stopEverything = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    collapseRef.current?.stop()
    collapseRef.current = null
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }
  useEffect(
    () => () => {
      stopEverything()
      if (refillTimerRef.current) clearTimeout(refillTimerRef.current)
    },
    [],
  )

  // Every level starts from a bare frame on solid ground.
  useEffect(() => {
    if (refillTimerRef.current) {
      clearTimeout(refillTimerRef.current)
      refillTimerRef.current = null
    }
    stopEverything()
    setBays(Array.from({ length: N }, () => [false, false, false]))
    setIsolated(false)
    setPhase('build')
    setPose(null)
    setResult(null)
    setTool('brace')
    setHover(null)
  }, [lv.level.n, N])

  /* ------------------- the design and its earthquake ------------------- */

  const braces = useMemo(() => bays.map((row) => row.filter(Boolean).length), [bays])
  const used = braces.reduce((a, b) => a + b, 0)
  const inRack = round.rack - used
  const spend = used * BRACE_COST + (isolated ? BEARING_COST : 0)
  const overBudget = round.budget !== null && spend > round.budget
  const affordable =
    round.budget === null ? Infinity : Math.max(0, Math.floor((round.budget - spend) / BRACE_COST))

  const rec = useMemo(() => groundRecord(round.site), [round.site])
  const outcome = useMemo(
    () => runDesign(round.building, { braces, isolated }, rec, round.gates),
    [round.building, round.gates, braces, isolated, rec],
  )
  const spec = useMemo(
    () => (round.showSpectrum ? spectrum(rec) : null),
    [round.showSpectrum, rec],
  )

  const busy = phase === 'shaking'
  const settled = phase === 'passed' || phase === 'failed'

  // The outcome stays hidden until the shake has run. Level 1 shows it while
  // the controls are new, level 4 is the readout level. The period readout is
  // live everywhere, since it is a property of the design, not the earthquake.
  const outcomeVisible = lv.level.n === 1 || lv.level.n === 4 || settled
  /** The verdict describes the run that happened, not the current bench state. */
  const shown = settled && result ? result : outcome

  /* ------------------- drawing geometry ------------------- */

  const isoRoom = round.bearings ? ISO_LIFT : 0
  const towerPx = round.building.heights.reduce((t, h) => t + h * PX_PER_M, 0)
  const groundY = TOP_PAD + towerPx + isoRoom
  const sceneH = groundY + GROUND_BAND + (spec && showSpectrum ? SPECTRUM_H : 0)

  /** Story boxes as built, bottom-up. Dimensions and the drift diagram use these. */
  const rowsBase = useMemo(() => {
    const out: { yTop: number; yBottom: number; h: number }[] = []
    let y = groundY - (isolated ? ISO_LIFT : 0)
    for (const h of round.building.heights) {
      const px = h * PX_PER_M
      out.push({ yBottom: y, yTop: y - px, h: px })
      y -= px
    }
    return out
  }, [round.building.heights, groundY, isolated])

  const bayCentreX = (b: number) => TOWER_X + (b + 0.5) * BAY_PX
  const storeyCentreY = (s: number) => rowsBase[s].yTop + rowsBase[s].h / 2
  /** Bays are a whole module wide, so a board x maps straight onto one. */
  const bayIndexAtX = (x: number) => Math.max(0, Math.min(2, Math.round((x - TOWER_X) / BAY_PX - 0.5)))
  /**
   * The level swap resets `bays` in an effect, so for one render the drawing can
   * be a story taller than the state behind it. Read every cell through here.
   */
  const bracedAt = (s: number, b: number) => bays[s]?.[b] ?? false
  /** Which story a board y lands in. Nearest center, so it never returns nothing. */
  const storeyAtY = (y: number) => {
    let best = 0
    let bd = Infinity
    for (let i = 0; i < rowsBase.length; i++) {
      const d = Math.abs(rowsBase[i].yTop + rowsBase[i].h / 2 - y)
      if (d < bd) {
        bd = d
        best = i
      }
    }
    return best
  }

  /* ------------------- drawing braces ------------------- */

  /** Any edit hides the verdict again and cancels a pending bench-clear. */
  const touched = () => {
    if (refillTimerRef.current) {
      clearTimeout(refillTimerRef.current)
      refillTimerRef.current = null
      att.refill()
    }
    setPhase('build')
    setPose(null)
    setResult(null)
  }

  const install = (s: number, b: number) => {
    setBays((prev) => prev.map((row, i) => (i === s ? row.map((v, j) => (j === b ? true : v)) : row)))
    playSound('place')
    touched()
  }
  const pull = (s: number, b: number) => {
    setBays((prev) => prev.map((row, i) => (i === s ? row.map((v, j) => (j === b ? false : v)) : row)))
    playSound('click')
    touched()
  }

  const canInstall = (s: number, b: number) =>
    !bracedAt(s, b) && inRack > 0 && affordable > 0 && (braces[s] ?? 0) < MAX_PER_STOREY

  /** The pencil draws, the eraser strips. Same rules the old bench enforced. */
  const drawAt = (s: number, b: number) => {
    if (busy || bracedAt(s, b)) return
    if (canInstall(s, b)) install(s, b)
  }
  const stripAt = (s: number, b: number) => {
    if (busy || !bracedAt(s, b)) return
    pull(s, b)
  }
  const clickCell = (s: number, b: number) => {
    if (tool === 'strip') stripAt(s, b)
    else drawAt(s, b)
  }

  const board = useSheetCursor({
    step: BAY_PX,
    bounds: {
      minX: bayCentreX(0),
      maxX: bayCentreX(2),
      minY: storeyCentreY(N - 1),
      maxY: storeyCentreY(0),
    },
    start: { x: bayCentreX(1), y: storeyCentreY(0) },
    onCommit: (p) => clickCell(storeyAtY(p.y), bayIndexAtX(p.x)),
    // Nothing is held on this board, so escape puts the eraser down.
    onCancel: () => setTool('brace'),
    onDelete: (p) => stripAt(storeyAtY(p.y), bayIndexAtX(p.x)),
    disabled: busy,
  })
  const setCursor = board.setCursor

  const cs = storeyAtY(board.cursor.y)
  const cb = bayIndexAtX(board.cursor.x)

  // Arrows step one module. Sideways that is one bay, which the hook already
  // does; upward it is one story, and stories are not all the same height.
  const boardKeys = (e: React.KeyboardEvent) => {
    if (busy) return
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      board.setActive(true)
      const next = Math.max(0, Math.min(N - 1, cs + (e.key === 'ArrowUp' ? 1 : -1)))
      setCursor((c) => ({ x: c.x, y: storeyCentreY(next) }))
      return
    }
    board.boardProps.onKeyDown(e)
  }

  // The frame lifts by ISO_LIFT when it goes onto bearings, and the cursor has
  // to ride with it or it silently lands a story out.
  const isoRef = useRef(isolated)
  useEffect(() => {
    if (isoRef.current === isolated) return
    const shift = isolated ? -ISO_LIFT : ISO_LIFT
    isoRef.current = isolated
    setCursor((c) => ({ x: c.x, y: c.y + shift }))
  }, [isolated, setCursor])

  const rowsRef = useRef(rowsBase)
  rowsRef.current = rowsBase
  useEffect(() => {
    const r = rowsRef.current[0]
    isoRef.current = false
    setCursor({ x: bayCentreX(1), y: r.yTop + r.h / 2 })
  }, [lv.level.n, setCursor])

  const setFoundation = (id: string) => {
    if (busy) return
    setIsolated(id === 'bearings')
    playSound('click')
    touched()
  }

  /* ------------------- the drawn frame ------------------- */

  const collapse = pose?.collapse ?? 0
  const failIdx = settled && shown.fail?.kind === 'drift' ? shown.failIndex : -1
  /** Story boxes as drawn: the story that tore loses height as it folds. */
  const rows = useMemo(() => {
    if (collapse === 0 || failIdx < 0) return rowsBase
    const out: { yTop: number; yBottom: number; h: number }[] = []
    let y = rowsBase[0].yBottom
    round.building.heights.forEach((h, i) => {
      const px = h * PX_PER_M * (i === failIdx ? 1 - COLLAPSE_SQUASH * collapse : 1)
      out.push({ yBottom: y, yTop: y - px, h: px })
      y -= px
    })
    return out
  }, [rowsBase, collapse, failIdx, round.building.heights])

  const dofOf = (story: number) => story + (shown.isolated ? 1 : 0)
  const gndPx = (pose?.gnd ?? 0) * SCALE
  const dispPx = (dof: number) => (pose?.disp[dof] ?? 0) * SCALE + gndPx
  const lean = (i: number) => (failIdx >= 0 && i >= failIdx ? COLLAPSE_LEAN * collapse : 0)
  const topPx = (i: number) => dispPx(dofOf(i)) + lean(i)
  const botPx = (i: number) => (i === 0 ? (shown.isolated ? dispPx(0) : gndPx) : topPx(i - 1))

  /* ------------------- the shake ------------------- */

  const finishShake = (id: number, out: Outcome) => {
    if (handledRunRef.current === id) return
    handledRunRef.current = id
    // The hidden-tab fallback below must not fire after this and stomp the
    // frozen pose back to upright halfway through the collapse.
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setResult(out)
    if (out.stands) {
      setPhase('passed')
      lv.clearLevel(
        lv.level.metrics ? { spend, jolt: out.worstJolt, travel: out.travel } : undefined,
      )
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    } else {
      setPhase('failed')
      if (out.fail?.kind === 'drift') {
        playSound('crunch')
        if (reduced) setPose((p) => (p ? { ...p, collapse: 1 } : p))
        else {
          collapseRef.current = animate(0, 1, {
            duration: 0.5,
            ease: 'easeIn',
            onUpdate: (v) => setPose((p) => (p ? { ...p, collapse: v } : p)),
          })
        }
      }
      // Running dry clears the bench, but not before they have seen what tore.
      if (att.spend()) {
        refillTimerRef.current = setTimeout(() => {
          refillTimerRef.current = null
          reset()
          att.refill()
        }, 3400)
      }
    }
  }

  /** Write one frame of the record straight onto the SVG, no React in the loop. */
  const writeFrame = (out: Outcome, step: number, boxes: typeof rowsBase) => {
    const g = rec.d[step] * SCALE
    const at = (dof: number) => out.history[dof][step] * SCALE + g
    groundRef.current?.setAttribute('transform', `translate(${g.toFixed(3)},0)`)
    if (out.isolated) {
      baseRef.current?.setAttribute('transform', `translate(${at(0).toFixed(3)},0)`)
      bearingRef.current?.setAttribute('transform', shear(g, at(0), groundY, BEARING_H))
    }
    for (let i = 0; i < N; i++) {
      const a = i === 0 ? (out.isolated ? at(0) : g) : at(out.isolated ? i : i - 1)
      storeyRefs.current[i]?.setAttribute(
        'transform',
        shear(a, at(out.isolated ? i + 1 : i), boxes[i].yBottom, boxes[i].h),
      )
    }
  }
  const landOn = (out: Outcome, step: number) =>
    setPose({
      disp: out.history.map((h) => h[step]),
      gnd: rec.d[step],
      collapse: 0,
    })

  const shake = () => {
    if (busy || overBudget) return
    if (refillTimerRef.current) {
      clearTimeout(refillTimerRef.current)
      refillTimerRef.current = null
      att.refill()
    }
    const out = outcome
    const id = runId + 1
    setRunId(id)
    setResult(null)
    setPose(null)
    setPhase('shaking')
    playSound('whoosh')

    // Twenty seconds of record is too long to watch, so play PLAY_HALF either
    // side of the peak, at 1x real time.
    const half = Math.round(PLAY_HALF / DT)
    const freeze = out.failStep >= 0 ? out.failStep : -1
    const anchor = freeze >= 0 ? freeze : out.peakStep
    const from = Math.max(0, anchor - (freeze >= 0 ? 2 * half : half))
    const to = Math.min(rec.n - 1, freeze >= 0 ? freeze : anchor + half)
    const boxes = rowsBase

    if (reduced) {
      // Anyone who asked for less motion gets no playback at all: the building
      // is drawn frozen at the moment it leaned furthest, and the verdict lands.
      landOn(out, anchor)
      timerRef.current = setTimeout(() => finishShake(id, out), 300)
      return
    }
    const t0 = performance.now()
    const tick = (now: number) => {
      const step = Math.min(to, from + Math.round((now - t0) / 1000 / DT))
      writeFrame(out, step, boxes)
      if (step >= to) {
        rafRef.current = null
        landOn(out, step)
        finishShake(id, out)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    // A throttled or hidden tab stops firing frames; the verdict still lands.
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(
      () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        landOn(out, to)
        finishShake(id, out)
      },
      ((to - from) * DT + 1.4) * 1000,
    )
  }

  const reset = () => {
    stopEverything()
    setBays(Array.from({ length: N }, () => [false, false, false]))
    setIsolated(false)
    setPhase('build')
    setPose(null)
    setResult(null)
  }

  /* ------------------- copy ------------------- */

  const goal =
    `Keep every story under ${DRIFT_CAP * 1000} mm of lean per meter` +
    (round.gates.joltCap !== undefined ? `, the floors under ${round.gates.joltCap} %g` : '') +
    (round.gates.moat !== undefined ? `, bearings inside their ${round.gates.moat * 100} cm moat` : '') +
    (round.budget !== null ? `, for ${money(round.budget)} or less` : '')

  const failLine = () => {
    const f = shown.fail
    if (!f) return ''
    if (f.kind === 'drift') {
      return f.value > DRIFT_DISPLAY_CAP
        ? `Story ${f.story} tore. It leaned over ${DRIFT_DISPLAY_CAP} mm for every meter of its height and ${f.limit} is the limit. Past about double the limit a real frame is bending permanently and the number stops meaning anything except hopeless.`
        : `Story ${f.story} tore. It leaned ${f.value.toFixed(1)} mm for every meter of its height, and ${f.limit} is the limit. Everything above it came down.`
    }
    if (f.kind === 'jolt') {
      return `It stood, but the floors were thrown at ${f.value.toFixed(0)} %g and the scanners take ${f.limit}.`
    }
    return `The bearings ran out of trench. The base slid ${f.value.toFixed(0)} cm and the moat is ${f.limit}.`
  }

  /* ------------------- the sheet ------------------- */

  const status: SheetStatus = phase === 'passed' ? 'approved' : phase === 'failed' ? 'revise' : 'draft'
  const driftLimit = DRIFT_CAP * 1000
  const limitX = DRIFT_X + (DRIFT_W * driftLimit) / DRIFT_DISPLAY_CAP
  const columnX = [0, 1, 2, 3].map((j) => TOWER_X + j * BAY_PX)
  /** Moat width in drawing px, at the same exaggeration the sway is drawn at. */
  const moatPx = round.gates.moat !== undefined ? round.gates.moat * SCALE : null
  /** Floor elevations bottom-up, meters above the ground datum. */
  const elevations = round.building.heights.reduce<number[]>((acc, h) => {
    acc.push((acc[acc.length - 1] ?? 0) + h)
    return acc
  }, [])

  const checking =
    `${round.site.pga.toFixed(2)}g at ${round.site.Tg} s, drift ${driftLimit} mm/m` +
    (round.gates.joltCap !== undefined ? `, jolt ${round.gates.joltCap} %g` : '') +
    (round.gates.moat !== undefined ? `, moat ${round.gates.moat * 100} cm` : '') +
    (round.budget !== null ? `, ${money(round.budget)} cap` : '')

  /** Story rows read top down, the way a drawing is read. */
  const storeyRows = rowsBase
    .map((_, i) => i)
    .reverse()
    .map((i) => {
      const over = outcomeVisible && shown.lean[i] > driftLimit
      return {
        key: `s${i}`,
        over,
        cells: {
          mark: `s${i + 1}`,
          story: `${round.building.heights[i].toFixed(1)} m${round.building.open[i] < 1 ? ' glazed' : ''}`,
          braces: `${braces[i] ?? 0} of ${MAX_PER_STOREY}`,
          drift: outcomeVisible ? leanText(shown.lean[i]) : '?',
          allow: String(driftLimit),
        },
      }
    })

  const checkRows: { key: string; over: boolean; cells: Record<string, string> }[] = [
    {
      key: 'drift',
      over: outcomeVisible && shown.worstLean > driftLimit,
      cells: {
        check: 'worst story drift',
        value: outcomeVisible ? `${leanText(shown.worstLean)} mm/m at s${shown.worstStorey}` : 'shake it to find out',
        allow: `${driftLimit} mm/m`,
        result: outcomeVisible ? (shown.worstLean > driftLimit ? 'over' : 'ok') : '-',
      },
    },
  ]
  if (round.gates.joltCap !== undefined || lv.level.metrics) {
    const cap = round.gates.joltCap
    checkRows.push({
      key: 'jolt',
      over: outcomeVisible && cap !== undefined && shown.worstJolt > cap,
      cells: {
        check: 'peak floor jolt',
        value: outcomeVisible ? `${shown.worstJolt.toFixed(0)} %g` : 'shake it to find out',
        allow: cap !== undefined ? `${cap} %g` : 'not gated',
        result: outcomeVisible ? (cap === undefined ? 'noted' : shown.worstJolt > cap ? 'over' : 'ok') : '-',
      },
    })
  }
  if (round.gates.moat !== undefined) {
    const moatCm = round.gates.moat * 100
    checkRows.push({
      key: 'moat',
      over: outcomeVisible && isolated && shown.bearingTravel > moatCm,
      cells: {
        check: 'bearing slide',
        value: !isolated
          ? 'no bearings drawn'
          : outcomeVisible
            ? `${shown.bearingTravel.toFixed(0)} cm`
            : 'shake it to find out',
        allow: `${moatCm} cm`,
        result: !isolated ? 'n/a' : outcomeVisible ? (shown.bearingTravel > moatCm ? 'over' : 'ok') : '-',
      },
    })
  }

  /** Redline notes land in the ground band, clear of the frame and the dims. */
  const NOTE_X = 206
  const noteY = groundY + 62

  const stampY = TOP_PAD + Math.min(90, towerPx / 2)

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {phase === 'passed' && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={
          spec ? (
            <InsightToggle label="the ground's spectrum" on={showSpectrum} onChange={setShowSpectrum} />
          ) : undefined
        }
      />

      <Objective
        goal={goal}
        status={`${used} of ${round.rack} braces drawn${isolated ? ' over bearings' : ''} · your tower sways once in ${shown.T1.toFixed(2)} s`}
        attemptsLeft={att.left}
        met={phase === 'passed'}
      />

      <p className="mb-3 max-w-2xl text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>

      <DraftingSheet
        tools={
          <>
            <SheetTool
              active={tool === 'brace'}
              onClick={() => setTool('brace')}
              disabled={busy}
              icon={<PenLine className="h-3.5 w-3.5" />}
              label={`brace, ${inRack} left`}
            />
            <SheetTool
              active={tool === 'strip'}
              onClick={() => setTool('strip')}
              disabled={busy}
              icon={<Eraser className="h-3.5 w-3.5" />}
              label="strip"
              tone="red"
            />
            <p id="quake-board-help" className="max-w-xl text-[11px] leading-snug text-[var(--dr-ink-soft,#6c6252)]">
              {tool === 'brace'
                ? `Click an empty bay to draw an X-brace into it. Up to ${MAX_PER_STOREY} per story, and the stock along the top edge is all you get.`
                : 'Click a braced bay to rub the brace out and put it back in stock.'}{' '}
              Keyboard: left and right walk the bays, up and down walk the stories, enter draws or strips at the cursor, delete strips whatever the tool, escape puts the eraser down.
            </p>
          </>
        }
        titleBlock={
          <TitleBlock
            project="Civic hospital tower"
            drawing={`${lv.level.n}. ${lv.level.title}`}
            sheetNo={`Q-0${lv.level.n}`}
            scale={`meters, sway drawn x${EXAGGERATION}`}
            checking={checking}
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
                cursor story {cs + 1}, bay {cb + 1} · {bracedAt(cs, cb) ? 'braced' : 'empty'}
              </span>
              <span className={cn(LETTER, 'tabular-nums')} style={{ letterSpacing: TRACK.normal }}>
                {N} stories · {shown.totalMass.toLocaleString('en-US')} t · sways once in{' '}
                {shown.T1.toFixed(2)} s{isolated ? ' · on bearings' : ' · fixed base'}
              </span>
            </div>

            <DrawingKey
              title="key"
              items={[
                {
                  label: 'brace you drew',
                  sample: (
                    <>
                      <line x1="2" y1="9" x2="24" y2="1" stroke={INK.line} strokeWidth={PEN.member} />
                      <line x1="2" y1="1" x2="24" y2="9" stroke={INK.line} strokeWidth={PEN.member} />
                    </>
                  ),
                },
                {
                  label: 'bare frame',
                  sample: (
                    <>
                      <line x1="4" y1="1" x2="4" y2="9" stroke={INK.line} strokeWidth={PEN.thin} />
                      <line x1="22" y1="1" x2="22" y2="9" stroke={INK.line} strokeWidth={PEN.thin} />
                      <line x1="2" y1="1" x2="24" y2="1" stroke={INK.line} strokeWidth={PEN.dim} />
                    </>
                  ),
                },
                {
                  label: 'drift limit',
                  sample: <line x1="1" y1="5" x2="25" y2="5" stroke={INK.red} strokeWidth={PEN.dim} strokeDasharray="5 3" />,
                },
              ]}
            />

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-3">
                {round.bearings && (
                  <StencilPalette
                    label="foundation detail"
                    value={isolated ? 'bearings' : 'fixed'}
                    onChange={setFoundation}
                    disabled={busy}
                    options={[
                      {
                        id: 'fixed',
                        mark: 'F',
                        label: 'Fixed base',
                        note: 'columns cast straight into rock, no cost',
                        swatch: (
                          <>
                            <line x1="1" y1="6" x2="25" y2="6" stroke={INK.line} strokeWidth={PEN.dim} />
                            {[3, 9, 15, 21].map((x) => (
                              <line key={x} x1={x} y1="12" x2={x + 4} y2="6" stroke={INK.soft} strokeWidth={PEN.hair} />
                            ))}
                          </>
                        ),
                      },
                      {
                        id: 'bearings',
                        mark: 'B',
                        label: 'Isolation bearings',
                        note: `${money(BEARING_COST)} for the whole layer`,
                        swatch: (
                          <>
                            <line x1="1" y1="3" x2="25" y2="3" stroke={INK.line} strokeWidth={PEN.dim} />
                            {[5, 13, 21].map((x) => (
                              <rect key={x} x={x - 3} y="4" width="6" height="5" fill="none" stroke={INK.line} strokeWidth={PEN.hair} />
                            ))}
                            <line x1="1" y1="11" x2="25" y2="11" stroke={INK.soft} strokeWidth={PEN.hair} />
                          </>
                        ),
                      },
                    ]}
                  />
                )}
                <Schedule
                  title="story schedule"
                  columns={[
                    { key: 'mark', label: 'mark' },
                    { key: 'story', label: 'story' },
                    { key: 'braces', label: 'braces', align: 'right' },
                    { key: 'drift', label: 'drift mm/m', align: 'right' },
                    { key: 'allow', label: 'allow', align: 'right' },
                  ]}
                  rows={storeyRows}
                  foot={
                    round.budget === null
                      ? [
                          { label: 'braces drawn', value: `${used} of ${round.rack}` },
                          { label: 'build cost, no cap this sheet', value: money(spend) },
                        ]
                      : [
                          { label: 'braces drawn', value: `${used} of ${round.rack}` },
                          { label: 'build cost', value: money(spend) },
                          { label: 'budget', value: money(round.budget) },
                          {
                            label: overBudget ? 'over by' : 'left',
                            value: money(Math.abs(round.budget - spend)),
                            tone: overBudget ? 'over' : 'ok',
                          },
                        ]
                  }
                />
              </div>

              <Schedule
                title="acceptance checks"
                columns={[
                  { key: 'check', label: 'check' },
                  { key: 'value', label: 'measured', align: 'right' },
                  { key: 'allow', label: 'allowed', align: 'right' },
                  { key: 'result', label: 'result', align: 'right' },
                ]}
                rows={checkRows}
                foot={[
                  {
                    label: outcomeVisible ? 'every story has to clear it, not the average' : 'hidden until you shake it',
                    value: outcomeVisible ? (shown.stands ? 'all clear' : 'see redline') : '?',
                    tone: outcomeVisible ? (shown.stands ? 'ok' : 'over') : 'normal',
                  },
                ]}
              />
            </div>

            {/* Verdicts are lettered notes on the sheet. */}
            <div aria-live="polite" className="min-h-[2.5rem] space-y-2">
              {phase === 'passed' && (
                <NoteBlock n={1} tone="check">
                  It stands. The worst story leaned {leanText(shown.worstLean)} mm/m at story {shown.worstStorey}, and the
                  floors took {shown.worstJolt.toFixed(0)} %g. Stamped and signed off.
                </NoteBlock>
              )}
              {phase === 'failed' && (
                <NoteBlock n={1} tone="red">
                  {failLine()}
                </NoteBlock>
              )}
              {phase === 'build' && overBudget && (
                <NoteBlock n={1} tone="red">
                  The schedule is over budget by {money(spend - (round.budget ?? 0))}. Strip something out before you run the
                  shake.
                </NoteBlock>
              )}
              {phase === 'build' && !overBudget && affordable < inRack && (
                <NoteBlock n={1} tone="amber">
                  The rack is full but the cheque is not. You can afford {affordable} more of the {inRack} braces still in
                  stock, and the rest are drawn dashed.
                </NoteBlock>
              )}
            </div>
          </div>
        }
      >
        <svg
          viewBox={`0 0 ${SCENE_W} ${Math.round(sceneH)}`}
          className="w-full touch-none select-none"
          role="application"
          aria-label={`Frame elevation, sheet Q-0${lv.level.n}. ${N} stories, three bays wide, ${used} braces drawn${isolated ? ', on isolation bearings' : ', fixed base'}. Cursor at story ${cs + 1}, bay ${cb + 1}, ${bracedAt(cs, cb) ? 'braced' : 'empty'}.`}
          aria-describedby="quake-board-help"
          {...board.boardProps}
          onKeyDown={boardKeys}
        >
          {/* what is left on the stencil sheet, cut out along the top edge */}
          <g aria-hidden>
            <text x={STOCK_X} y={13} className={LETTER} style={{ letterSpacing: TRACK.wide }} fontSize="9" fill={INK.soft}>
              brace stock, {inRack} of {round.rack}
            </text>
            {Array.from({ length: Math.max(0, inRack) }, (_, k) => {
              const x = STOCK_X + k * STOCK_PITCH
              const broke = k >= affordable
              return (
                <g key={k} opacity={broke ? 0.45 : 1}>
                  <rect
                    x={x}
                    y={STOCK_Y}
                    width={STOCK_W}
                    height={STOCK_H}
                    fill="none"
                    stroke={INK.soft}
                    strokeWidth={PEN.hair}
                    strokeDasharray={broke ? '2 2' : undefined}
                  />
                  <path
                    d={`M${x + 2} ${STOCK_Y + 2} L${x + STOCK_W - 2} ${STOCK_Y + STOCK_H - 2} M${x + STOCK_W - 2} ${STOCK_Y + 2} L${x + 2} ${STOCK_Y + STOCK_H - 2}`}
                    stroke={broke ? INK.soft : INK.line}
                    strokeWidth={PEN.thin}
                    strokeDasharray={broke ? '2 2' : undefined}
                  />
                </g>
              )
            })}
          </g>

          {/* column lines, the way an elevation is gridded */}
          {columnX.map((x, j) => (
            <GridBubble key={j} x={x} y={32} label={String.fromCharCode(65 + j)} leaderTo={TOP_PAD - 6} />
          ))}

          {/* level datums, ground first so the frame draws over them */}
          <DatumLine x1={TOWER_X - 8} x2={TOWER_X + TOWER_W + 86} y={groundY} label="ground +0.00" />
          {rowsBase.map((r, i) => (
            <DatumLine
              key={i}
              x1={TOWER_X - 8}
              x2={TOWER_X + TOWER_W + 86}
              y={r.yTop}
              label={`${i === N - 1 ? 'roof' : `l${i + 1}`} +${elevations[i].toFixed(2)}`}
            />
          ))}

          {/* the site, and the brace yard sliding with it once the record plays */}
          <g ref={groundRef}>
            <GroundHatch x={-60} y={groundY} width={SCENE_W + 120} depth={10} spacing={9} />
            <text
              x={16}
              y={groundY + 42}
              className={LETTER}
              style={{ letterSpacing: TRACK.normal }}
              fontSize="9"
              fill={INK.soft}
            >
              site record: {round.badge}
            </text>
            <LoadArrow
              x={TOWER_X - 26}
              y={groundY + 22}
              length={70}
              ux={1}
              uy={0}
              label={`${round.site.pga.toFixed(2)} g`}
              tone={INK.soft}
            />
            {isolated && moatPx !== null && (
              <g>
                {[TOWER_X - 12 - moatPx, TOWER_X + TOWER_W + 12].map((x) => (
                  <rect
                    key={x}
                    x={x}
                    y={groundY}
                    width={moatPx}
                    height={ISO_LIFT + 6}
                    fill="none"
                    stroke={INK.soft}
                    strokeWidth={PEN.thin}
                    strokeDasharray="4 3"
                  />
                ))}
                <text
                  x={TOWER_X + TOWER_W + 18 + moatPx}
                  y={groundY + ISO_LIFT + 2}
                  className={LETTER}
                  style={{ letterSpacing: TRACK.normal }}
                  fontSize="9"
                  fill={INK.soft}
                >
                  moat {(round.gates.moat ?? 0) * 100} cm each side
                </text>
              </g>
            )}
          </g>

          {/* the bearings and the base slab */}
          {isolated && (
            <>
              <g ref={bearingRef}>
                {[0.12, 0.38, 0.62, 0.88].map((f) => (
                  <g key={f}>
                    <rect
                      x={TOWER_X + f * TOWER_W - 9}
                      y={groundY - BEARING_H}
                      width="18"
                      height={BEARING_H}
                      fill="none"
                      stroke={INK.line}
                      strokeWidth={PEN.thin}
                    />
                    {[4, 7.5, 11].map((dy) => (
                      <line
                        key={dy}
                        x1={TOWER_X + f * TOWER_W - 9}
                        y1={groundY - BEARING_H + dy}
                        x2={TOWER_X + f * TOWER_W + 9}
                        y2={groundY - BEARING_H + dy}
                        stroke={INK.soft}
                        strokeWidth={PEN.hair}
                      />
                    ))}
                  </g>
                ))}
              </g>
              <g ref={baseRef}>
                <rect
                  x={TOWER_X - 12}
                  y={groundY - ISO_LIFT}
                  width={TOWER_W + 24}
                  height={ISO_LIFT - BEARING_H}
                  fill={INK.grid}
                  fillOpacity="0.3"
                  stroke={INK.line}
                  strokeWidth={PEN.dim}
                />
              </g>
            </>
          )}

          {/* the frame, one sheared group per story */}
          {rows.map((r, i) => {
            const glass = round.building.open[i] < 1
            const torn = i === failIdx
            const ink = torn ? INK.red : INK.line
            return (
              <g
                key={i}
                ref={(el) => {
                  storeyRefs.current[i] = el
                }}
                transform={shear(botPx(i), topPx(i), r.yBottom, r.h)}
              >
                <rect
                  x={TOWER_X}
                  y={r.yTop}
                  width={TOWER_W}
                  height={r.h}
                  fill={torn ? INK.red : INK.grid}
                  fillOpacity={torn ? 0.2 : 0.12}
                />
                {/* a glazed story is drawn as mullions, not as infill */}
                {glass &&
                  Array.from({ length: 11 }, (_, m) => TOWER_X + ((m + 1) * TOWER_W) / 12).map((x) => (
                    <line
                      key={x}
                      x1={x}
                      y1={r.yBottom - 2}
                      x2={x}
                      y2={r.yTop + 2}
                      stroke={INK.soft}
                      strokeWidth={PEN.hair}
                    />
                  ))}
                {columnX.map((x, j) => (
                  <line key={j} x1={x} y1={r.yBottom} x2={x} y2={r.yTop} stroke={ink} strokeWidth={PEN.member} />
                ))}
                <line
                  x1={TOWER_X - 6}
                  y1={r.yTop}
                  x2={TOWER_X + TOWER_W + 6}
                  y2={r.yTop}
                  stroke={ink}
                  strokeWidth={PEN.heavy}
                />
                {bays[i].map((on, j) =>
                  on ? (
                    <g key={j} stroke={ink} strokeWidth={PEN.heavy} strokeLinecap="butt">
                      <line
                        x1={TOWER_X + j * BAY_PX + 3}
                        y1={r.yBottom - 2}
                        x2={TOWER_X + (j + 1) * BAY_PX - 3}
                        y2={r.yTop + 2}
                      />
                      <line
                        x1={TOWER_X + (j + 1) * BAY_PX - 3}
                        y1={r.yBottom - 2}
                        x2={TOWER_X + j * BAY_PX + 3}
                        y2={r.yTop + 2}
                      />
                    </g>
                  ) : null,
                )}
              </g>
            )
          })}

          {/* what the instrument in your hand would do to the bay under it */}
          {!busy && hover && (
            <g className="pointer-events-none">
              {tool === 'brace' && canInstall(hover.s, hover.b) && (
                <g stroke={INK.check} strokeWidth={PEN.dim} strokeDasharray="6 4">
                  <line
                    x1={TOWER_X + hover.b * BAY_PX + 3}
                    y1={rowsBase[hover.s].yBottom - 2}
                    x2={TOWER_X + (hover.b + 1) * BAY_PX - 3}
                    y2={rowsBase[hover.s].yTop + 2}
                  />
                  <line
                    x1={TOWER_X + (hover.b + 1) * BAY_PX - 3}
                    y1={rowsBase[hover.s].yBottom - 2}
                    x2={TOWER_X + hover.b * BAY_PX + 3}
                    y2={rowsBase[hover.s].yTop + 2}
                  />
                </g>
              )}
              {tool === 'strip' && bays[hover.s][hover.b] && (
                <rect
                  x={TOWER_X + hover.b * BAY_PX + 3}
                  y={rowsBase[hover.s].yTop + 3}
                  width={BAY_PX - 6}
                  height={rowsBase[hover.s].h - 6}
                  fill="none"
                  stroke={INK.red}
                  strokeWidth={PEN.thin}
                  strokeDasharray="5 3"
                />
              )}
            </g>
          )}

          {/* bay hit targets. The keyboard path is the sheet cursor above. */}
          {!busy &&
            rowsBase.map((r, i) =>
              [0, 1, 2].map((j) => (
                <rect
                  key={`${i}-${j}`}
                  x={TOWER_X + j * BAY_PX + 2}
                  y={r.yTop + 2}
                  width={BAY_PX - 4}
                  height={r.h - 4}
                  fill="transparent"
                  className={tool === 'brace' ? 'cursor-crosshair' : bays[i][j] ? 'cursor-pointer' : undefined}
                  onClick={() => clickCell(i, j)}
                  onPointerEnter={() => setHover({ s: i, b: j })}
                  onPointerLeave={() => setHover(null)}
                />
              )),
            )}

          {/* dimensions: every story, then the whole building */}
          {rowsBase.map((r, i) => (
            <DimString
              key={i}
              x1={TOWER_X}
              y1={r.yBottom}
              x2={TOWER_X}
              y2={r.yTop}
              offset={-52}
              label={`${round.building.heights[i].toFixed(2)} m`}
            />
          ))}
          <DimString
            x1={TOWER_X}
            y1={rowsBase[0].yBottom}
            x2={TOWER_X}
            y2={rowsBase[N - 1].yTop}
            offset={-108}
            label={`${elevations[N - 1].toFixed(2)} m`}
          />
          <DimString
            x1={TOWER_X}
            y1={groundY}
            x2={TOWER_X + TOWER_W}
            y2={groundY}
            offset={28}
            label={`${(3 * BAY_M).toFixed(2)} m, three bays`}
          />
          <ScaleBar x={TOWER_X + TOWER_W + 96} y={groundY + 78} pxPerUnit={PX_PER_M} units={4} />

          {/* story drift diagram, read against the limit line */}
          <g className="pointer-events-none" aria-hidden>
            <text
              x={DRIFT_X}
              y={TOP_PAD - 24}
              className={LETTER}
              style={{ letterSpacing: TRACK.wide }}
              fontSize="9"
              fill={INK.soft}
            >
              story drift, mm per meter
            </text>
            <line
              x1={DRIFT_X}
              y1={rowsBase[N - 1].yTop}
              x2={DRIFT_X}
              y2={rowsBase[0].yBottom}
              stroke={INK.soft}
              strokeWidth={PEN.thin}
            />
            <line
              x1={limitX}
              y1={rowsBase[N - 1].yTop - 8}
              x2={limitX}
              y2={rowsBase[0].yBottom + 4}
              stroke={INK.red}
              strokeWidth={PEN.dim}
              strokeDasharray="6 4"
            />
            <text
              x={limitX}
              y={rowsBase[0].yBottom + 16}
              textAnchor="middle"
              className={LETTER}
              style={{ letterSpacing: TRACK.normal }}
              fontSize="9"
              fill={INK.red}
            >
              limit {driftLimit}
            </text>
            {rowsBase.map((r, i) => {
              const v = outcomeVisible ? shown.lean[i] : 0
              const w = Math.min(1, v / DRIFT_DISPLAY_CAP) * DRIFT_W
              const y = r.yTop + r.h / 2
              const over = outcomeVisible && shown.lean[i] > driftLimit
              return (
                <g key={i}>
                  {outcomeVisible && (
                    <line
                      x1={DRIFT_X}
                      y1={y}
                      x2={DRIFT_X + Math.max(2, w)}
                      y2={y}
                      stroke={over ? INK.red : INK.line}
                      strokeWidth={PEN.member}
                    />
                  )}
                  <text
                    x={DRIFT_X + DRIFT_W + 8}
                    y={y + 3.5}
                    className="font-mono tabular-nums"
                    fontSize="9.5"
                    fill={over ? INK.red : INK.soft}
                  >
                    {outcomeVisible ? leanText(v) : '?'}
                  </text>
                </g>
              )
            })}
          </g>

          {/*
            Level 4: the ground's own spectrum, with your tower pinned on it.
            Both numbers come out of the same 50 Newmark runs against the same
            record the building was shaken by, so the panel cannot disagree with
            the verdict. The curve is pseudo-acceleration in %g, because %g is
            what the scanner gate is written in; the displacement at the pin is
            lettered beside it, because that is what the moat is for. Those two
            move in opposite directions with period, which IS the level.
          */}
          {spec && showSpectrum && (
            <g className="pointer-events-none" aria-hidden>
              {(() => {
                const x0 = 150
                const x1 = 700
                const top = groundY + GROUND_BAND - 4
                const h = SPECTRUM_H - 62
                const maxSa = Math.max(...spec.Sa) * 1.12
                const px = (T: number) =>
                  x0 + ((Math.log(T) - Math.log(0.1)) / (Math.log(3) - Math.log(0.1))) * (x1 - x0)
                const py = (v: number) => top + h - (v / maxSa) * h
                const T1 = Math.min(3, Math.max(0.1, shown.T1))
                const pin = px(T1)
                // Read the curve at the tower's own period, straight line between
                // the two computed points either side of it.
                const k = Math.max(1, spec.T.findIndex((t) => t >= T1))
                const f = (T1 - spec.T[k - 1]) / (spec.T[k] - spec.T[k - 1])
                const saAt = spec.Sa[k - 1] + f * (spec.Sa[k] - spec.Sa[k - 1])
                const sdAt = spec.Sd[k - 1] + f * (spec.Sd[k] - spec.Sd[k - 1])
                const cap = round.gates.joltCap
                const right = pin < (x0 + x1) / 2
                const nx = right ? pin + 96 : pin - 96
                const ny = top + 18
                return (
                  <>
                    <rect
                      x={60}
                      y={top - 26}
                      width={SCENE_W - 120}
                      height={h + 56}
                      fill={INK.paper}
                      stroke={INK.soft}
                      strokeWidth={PEN.thin}
                    />
                    <text
                      x={72}
                      y={top - 12}
                      className={LETTER}
                      style={{ letterSpacing: TRACK.wide }}
                      fontSize="9"
                      fill={INK.soft}
                    >
                      detail 1: how hard this ground shoves a building of each rhythm, %g
                    </text>
                    <line x1={x0} y1={top + h} x2={x1} y2={top + h} stroke={INK.soft} strokeWidth={PEN.thin} />
                    <polyline
                      points={spec.T.map((T, i) => `${px(T)},${py(spec.Sa[i])}`).join(' ')}
                      fill="none"
                      stroke={INK.line}
                      strokeWidth={PEN.member}
                    />
                    {cap !== undefined && (
                      <>
                        <line
                          x1={x0}
                          y1={py(cap)}
                          x2={x1}
                          y2={py(cap)}
                          stroke={INK.red}
                          strokeWidth={PEN.dim}
                          strokeDasharray="6 4"
                        />
                        <text
                          x={x0 - 6}
                          y={py(cap) + 3.5}
                          textAnchor="end"
                          className={LETTER}
                          style={{ letterSpacing: TRACK.normal }}
                          fontSize="9"
                          fill={INK.red}
                        >
                          {cap} %g allowed
                        </text>
                      </>
                    )}
                    {[0.1, 0.3, 1, 3].map((T) => (
                      <text
                        key={T}
                        x={px(T)}
                        y={top + h + 14}
                        textAnchor="middle"
                        className={LETTER}
                        style={{ letterSpacing: TRACK.normal }}
                        fontSize="9"
                        fill={INK.soft}
                      >
                        {T} s
                      </text>
                    ))}
                    <line
                      x1={px(round.site.Tg)}
                      y1={top}
                      x2={px(round.site.Tg)}
                      y2={top + h}
                      stroke={INK.soft}
                      strokeWidth={PEN.thin}
                      strokeDasharray="6 4"
                    />
                    <text
                      x={px(round.site.Tg)}
                      y={top - 2}
                      textAnchor="middle"
                      className={LETTER}
                      style={{ letterSpacing: TRACK.normal }}
                      fontSize="9"
                      fill={INK.soft}
                    >
                      the ground beats here
                    </text>
                    <line x1={pin} y1={top} x2={pin} y2={top + h} stroke={INK.check} strokeWidth={PEN.dim} />
                    <Leader x={pin} y={py(saAt)} toX={nx} toY={ny} tone={INK.check} />
                    <text
                      x={nx + (right ? 4 : -4)}
                      y={ny + 3.5}
                      textAnchor={right ? 'start' : 'end'}
                      className={LETTER}
                      style={{ letterSpacing: TRACK.normal }}
                      fontSize="9.5"
                      fontWeight="700"
                      fill={INK.check}
                    >
                      your tower, {shown.T1.toFixed(2)} s
                    </text>
                    <text
                      x={nx + (right ? 4 : -4)}
                      y={ny + 15}
                      textAnchor={right ? 'start' : 'end'}
                      className={LETTER}
                      style={{ letterSpacing: TRACK.normal }}
                      fontSize="9"
                      fill={INK.check}
                    >
                      shoved at {saAt.toFixed(0)} %g, pushed {sdAt.toFixed(0)} cm
                    </text>
                  </>
                )
              })()}
            </g>
          )}

          {/* the verdict, marked up on the sheet */}
          {phase === 'failed' && shown.fail?.kind === 'drift' && failIdx >= 0 && (
            <Redline
              x={TOWER_X + TOWER_W / 2}
              y={rows[failIdx].yTop + rows[failIdx].h / 2}
              rx={TOWER_W / 2 + 16}
              ry={Math.max(20, rows[failIdx].h / 2 + 12)}
              noteX={NOTE_X}
              noteY={noteY}
              seed={`${runId}-drift-${failIdx}`}
              rev={runId}
              note={[
                `story ${shown.fail.story} tore`,
                `drift ${leanText(shown.fail.value)} mm/m against ${shown.fail.limit} allowed`,
                'everything above it came down',
              ]}
            />
          )}
          {phase === 'failed' && shown.fail?.kind === 'jolt' && (
            <Redline
              x={TOWER_X + TOWER_W / 2}
              y={rowsBase[N - 1].yTop + 6}
              rx={TOWER_W / 2 + 16}
              ry={26}
              noteX={NOTE_X}
              noteY={noteY}
              seed={`${runId}-jolt`}
              rev={runId}
              note={[
                'floors thrown too hard',
                `${shown.fail.value.toFixed(0)} %g against ${shown.fail.limit} allowed`,
                'the scanners do not survive this',
              ]}
            />
          )}
          {phase === 'failed' && shown.fail?.kind === 'moat' && (
            <Redline
              x={TOWER_X + TOWER_W / 2}
              y={groundY - ISO_LIFT / 2}
              rx={TOWER_W / 2 + 26}
              ry={22}
              noteX={NOTE_X}
              noteY={noteY}
              seed={`${runId}-moat`}
              rev={runId}
              note={[
                'bearings out of trench',
                `base slid ${shown.fail.value.toFixed(0)} cm against a ${shown.fail.limit} cm moat`,
                'widen the moat or stiffen the frame',
              ]}
            />
          )}
          {phase === 'passed' && (
            <ApprovalStamp
              x={SCENE_W / 2 + 60}
              y={stampY}
              lines={[
                `worst drift ${leanText(shown.worstLean)} mm/m`,
                `rev ${String(runId).padStart(2, '0')}, floors ${shown.worstJolt.toFixed(0)} %g`,
              ]}
            />
          )}
          {phase === 'failed' && (
            <RevisionStamp x={SCENE_W / 2 + 60} y={stampY} lines={[`rev ${String(runId).padStart(2, '0')}`, 'see redline']} />
          )}

          {board.active && !busy && (
            <CursorMark
              x={bayCentreX(cb)}
              y={storeyCentreY(cs)}
              tone={tool === 'strip' ? INK.red : INK.check}
            />
          )}
        </svg>
      </DraftingSheet>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={shake} disabled={busy || overBudget}>
          <Waves className="h-5 w-5" />
          {busy ? 'Shaking...' : 'Shake it!'}
        </Button>
        <Button variant="ghost" onClick={reset} disabled={busy} aria-label="Strip the frame back to bare">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={
              outcomeVisible
                ? { spend, jolt: shown.worstJolt, travel: shown.travel }
                : { spend }
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
              ? `Signed off at ${money(spend)}, ${shown.worstJolt.toFixed(0)} %g on the floors and ${shown.travel.toFixed(0)} cm of movement. Now go and win a different one.`
              : `It stands. Worst story leaned ${leanText(shown.worstLean)} mm/m.`
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
