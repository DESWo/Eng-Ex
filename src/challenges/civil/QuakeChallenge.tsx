import { useEffect, useMemo, useRef, useState } from 'react'
import { animate, motion, useReducedMotion } from 'framer-motion'
import { Layers, RotateCcw, Waves } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import { InsightToggle } from '@/components/level/InsightToggle'
import { Objective } from '@/components/level/Objective'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import { attemptsFor, useAttempts } from '@/hooks/useAttempts'
import { useSvgDrag } from '@/hooks/useSvgDrag'
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
 * Shake Proof. You get a rack of identical X-braces and a frame that is three
 * bays wide, and you decide which storeys get them. A real shear-building time
 * history (src/challenges/civil/shear.ts) shakes what you built against a
 * seeded ground record and tells you which storey tore.
 *
 * The tuning is built so the answer is the DISTRIBUTION of stiffness up the
 * building, not the amount. What that protects, for anyone editing it:
 *
 * 1. The rack is a fixed count of identical braces, so there is no number to
 *    max out. On level 3, [2,2,2,1,1,1] drops the lobby and [3,2,2,1,1,0]
 *    survives with 40% margin, on the same nine braces.
 * 2. Greedy heuristics all fail somewhere. Spread evenly, level 3 fails at the
 *    lobby. All at the base, it fails at storey 4. Max the storey that failed
 *    last time, it fails at the storey above. Bearings on level 4 do not save
 *    the lobby.
 * 3. Level 3 stands on 16 of 2338 layouts with 3 tests, so guessing does not
 *    work; matching the stiffness profile to the shear profile lands a winner
 *    on 5 of the 8 tapered full-rack layouts.
 * 4. Of all 8024 level 5 designs, none meets all three pars.
 *
 * Every number in the level table below is proven by exhaustive enumeration in
 * scripts/verify-quake.mjs. Run `node scripts/verify-quake.mjs` after touching
 * any constant in this file or in shear.ts.
 */

/* ------------------- tuning knobs (edit freely) ------------------- */

const BRACE_COST = 20000 // one X-brace, installed
const BEARING_COST = 220000 // the whole isolation layer, a procurement decision

/** Drawing scale: a normal 3.4 m storey is 46 px tall. */
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
/** How much of its height the storey that tore loses as it folds. */
const COLLAPSE_SQUASH = 0.55
/** Extra sideways px everything above the failure slides as it comes down. */
const COLLAPSE_LEAN = 24

const SCENE_W = 800
const TOP_PAD = 34
const GROUND_BAND = 76
const SPECTRUM_H = 130
const ISO_LIFT = 26 // px the frame rises when it goes onto bearings
const BEARING_H = 14
const TOWER_X = 302
const BAY_PX = 6.0 * PX_PER_M // one 6 m bay
const TOWER_W = 3 * BAY_PX
const YARD_X = 22
const YARD_COLS = 3
const YARD_PITCH_X = 34
const YARD_PITCH_Y = 27
const PANEL_W = 28
const PANEL_H = 22
const PROFILE_X = 600
const PROFILE_BAR = 118

const money = (n: number) => `$${n.toLocaleString('en-US')}`

/* ------------------- the levels ------------------- */

const uniform = (n: number): Building => ({
  heights: Array<number>(n).fill(H_STOREY),
  open: Array<number>(n).fill(1),
})

/** Six storeys with a tall glazed lobby at the bottom. Levels 3, 4 and 5. */
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
  /** X-braces available. Three is the most any one storey can hold. */
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
    concept: 'One storey tears',
    teach:
      'A building does not tip over like a bottle. One storey tears sideways while everything above it rides along on top. Lean is measured in millimetres of sideways slip for every metre of storey height, and 20 is where the columns give up. Drag X-braces out of the rack into any empty bay. The frame does not care which of the three bays you brace, only how many, so put them where they look right to you.',
    setup: {
      building: uniform(4),
      rack: 12,
      bearings: false,
      budget: null,
      gates: {},
      site: { Tg: 0.9, pga: 0.42, zg: 0.6 },
      badge: 'shallow quake, the ground beats about once a second, 0.42g',
      showSpectrum: false,
      brief: 'Four floors, twelve braces, no budget. Get every storey under the lean limit.',
    },
  },
  {
    n: 2,
    title: 'Four braces, five floors',
    phase: 'understand',
    concept: 'The bottom carries the shove',
    teach:
      'Four braces, five floors, so something goes bare. Every floor above a storey shoves on it when the ground yanks, so the bottom storey carries the whole building and the top storey carries almost nothing. Put the rack where the shove is. Of the 121 ways to lay these four braces out, 21 stand, and every single one of them braces storey 1 and storey 2.',
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
      'This building is already up and you are retrofitting it. The lobby is 5 m tall with glass instead of walls, so it starts at about a fifth of a normal storey. Spreading nine braces evenly is fair and it drops the lobby, because fair is not what the shear profile asks for. Piling all nine on the bottom three fails one storey higher, because you built a cliff and the movement went where the cliff ended. Feed the soft storey more than its share and taper upward.',
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

/** A frozen frame of the shake: where every floor was, and how far it has folded. */
interface Pose {
  /** Displacement of each degree of freedom, metres. */
  disp: number[]
  /** Ground displacement, metres. */
  gnd: number
  /** 0 while it is only leaning, 1 once the storey that tore has folded. */
  collapse: number
}

/** A storey shears into a parallelogram: its floor slides `b`, its base `a`. */
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
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)
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
  /** Pointer-down bookkeeping for the one drag handler on the whole scene. */
  const pressRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const carryRef = useRef<{ from: 'yard' | 'bay' } | null>(null)

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

  /* ------------------- scene geometry ------------------- */

  const isoRoom = round.bearings ? ISO_LIFT : 0
  const towerPx = round.building.heights.reduce((t, h) => t + h * PX_PER_M, 0)
  const groundY = TOP_PAD + towerPx + isoRoom
  const sceneH = groundY + GROUND_BAND + (spec && showSpectrum ? SPECTRUM_H : 0)

  /** Storey boxes as built, bottom-up. Labels and the drift profile use these. */
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

  const collapse = pose?.collapse ?? 0
  const failIdx = settled && shown.fail?.kind === 'drift' ? shown.failIndex : -1
  /** Storey boxes as drawn: the storey that tore loses height as it folds. */
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

  const dofOf = (storey: number) => storey + (shown.isolated ? 1 : 0)
  const gndPx = (pose?.gnd ?? 0) * SCALE
  const dispPx = (dof: number) => (pose?.disp[dof] ?? 0) * SCALE + gndPx
  const lean = (i: number) => (failIdx >= 0 && i >= failIdx ? COLLAPSE_LEAN * collapse : 0)
  const topPx = (i: number) => dispPx(dofOf(i)) + lean(i)
  const botPx = (i: number) => (i === 0 ? (shown.isolated ? dispPx(0) : gndPx) : topPx(i - 1))

  /* ------------------- placing braces ------------------- */

  const bayAt = (x: number, y: number) => {
    if (x < TOWER_X || x > TOWER_X + TOWER_W) return null
    const b = Math.min(2, Math.max(0, Math.floor((x - TOWER_X) / BAY_PX)))
    const s = rowsBase.findIndex((r) => y >= r.yTop && y <= r.yBottom)
    return s === -1 ? null : { s, b }
  }
  const inYard = (x: number, y: number) =>
    x >= YARD_X - 8 &&
    x <= YARD_X + YARD_COLS * YARD_PITCH_X &&
    y <= groundY &&
    y >= groundY - 6 * YARD_PITCH_Y

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

  const drag = useSvgDrag((x, y, done) => {
    if (busy) return
    if (!pressRef.current && !done) {
      pressRef.current = { x, y, moved: false }
      const hit = bayAt(x, y)
      if (hit && bays[hit.s][hit.b]) {
        pull(hit.s, hit.b)
        carryRef.current = { from: 'bay' }
      } else if ((hit || inYard(x, y)) && inRack > 0 && affordable > 0) {
        carryRef.current = { from: 'yard' }
      } else {
        carryRef.current = null
      }
      if (carryRef.current) setGhost({ x, y })
      return
    }
    const press = pressRef.current
    if (!press) return
    if (Math.hypot(x - press.x, y - press.y) > 6) press.moved = true
    if (!done) {
      if (carryRef.current) {
        setGhost({ x, y })
        setHover(bayAt(x, y))
      }
      return
    }
    const carry = carryRef.current
    const moved = press.moved
    pressRef.current = null
    carryRef.current = null
    setGhost(null)
    setHover(null)
    if (!carry) return
    // Tapping an installed brace takes it out, and it is already out.
    if (carry.from === 'bay' && !moved) return
    const target = bayAt(x, y)
    if (!target || bays[target.s][target.b]) return
    if (braces[target.s] >= MAX_PER_STOREY) return
    if (carry.from === 'yard' && (inRack <= 0 || affordable <= 0)) return
    install(target.s, target.b)
  })

  const toggleBay = (s: number, b: number) => {
    if (busy) return
    if (bays[s][b]) pull(s, b)
    else if (inRack > 0 && affordable > 0 && braces[s] < MAX_PER_STOREY) install(s, b)
  }

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
    `Keep every storey under ${DRIFT_CAP * 1000} mm of lean per metre` +
    (round.gates.joltCap !== undefined ? `, every floor under ${round.gates.joltCap} %g` : '') +
    (round.gates.moat !== undefined ? `, the base inside its ${round.gates.moat * 100} cm moat` : '') +
    (round.budget !== null ? `, for ${money(round.budget)} or less` : '')

  const failLine = () => {
    const f = shown.fail
    if (!f) return ''
    if (f.kind === 'drift') {
      return f.value > DRIFT_DISPLAY_CAP
        ? `Storey ${f.storey} tore. It leaned over ${DRIFT_DISPLAY_CAP} mm for every metre of its height and ${f.limit} is the limit. Past about double the limit a real frame is bending permanently and the number stops meaning anything except hopeless.`
        : `Storey ${f.storey} tore. It leaned ${f.value.toFixed(1)} mm for every metre of its height, and ${f.limit} is the limit. Everything above it came down.`
    }
    if (f.kind === 'jolt') {
      return `It stood, but the floors were thrown at ${f.value.toFixed(0)} %g and the scanners take ${f.limit}.`
    }
    return `The bearings ran out of trench. The base slid ${f.value.toFixed(0)} cm and the moat is ${f.limit}.`
  }

  const sceneLabel = `${N} storey frame, three bays wide, ${used} braces installed${isolated ? ', on isolation bearings' : ''}`

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
        status={`${used} of ${round.rack} braces placed${isolated ? ' on bearings' : ''} · your tower sways once in ${shown.T1.toFixed(2)} s`}
        attemptsLeft={att.left}
        met={phase === 'passed'}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
          <Waves className="mr-1 h-4 w-4" />
          {round.badge}
        </Badge>
      </div>

      {/* Scene: the frame, the brace yard, the drift profile */}
      <div className="overflow-hidden rounded-2xl bg-sky-100/70 dark:bg-sky-950/40">
        <svg
          viewBox={`0 0 ${SCENE_W} ${sceneH}`}
          className="w-full touch-none select-none"
          role="img"
          aria-label={sceneLabel}
          {...drag.bind}
        >
          {/* ground, and the moat trench the bearings sit in */}
          <g ref={groundRef}>
            <rect
              x={-60}
              y={groundY}
              width={SCENE_W + 120}
              height={sceneH - groundY}
              className="fill-stone-300 dark:fill-stone-800"
            />
            {Array.from({ length: 40 }, (_, i) => (
              <line
                key={i}
                x1={-60 + i * 24}
                y1={groundY}
                x2={-72 + i * 24}
                y2={groundY + 14}
                strokeWidth="1.5"
                className="stroke-stone-400 dark:stroke-stone-600"
              />
            ))}
            <line
              x1={-60}
              y1={groundY}
              x2={SCENE_W + 60}
              y2={groundY}
              strokeWidth="2.5"
              className="stroke-stone-500 dark:stroke-stone-500"
            />
            {isolated && round.gates.moat !== undefined && (
              <g className="fill-sky-100/70 stroke-stone-500 dark:fill-sky-950/60 dark:stroke-stone-500">
                <rect
                  x={TOWER_X - 12 - round.gates.moat * SCALE}
                  y={groundY}
                  width={round.gates.moat * SCALE}
                  height={ISO_LIFT + 6}
                  strokeWidth="2"
                />
                <rect
                  x={TOWER_X + TOWER_W + 12}
                  y={groundY}
                  width={round.gates.moat * SCALE}
                  height={ISO_LIFT + 6}
                  strokeWidth="2"
                />
              </g>
            )}
          </g>

          {/* the brace yard: one drawn panel per brace left in the rack */}
          <g>
            <text
              x={YARD_X}
              y={groundY + 22}
              fontSize="12"
              fontWeight="700"
              className="fill-ink-soft font-display dark:fill-stone-400"
            >
              rack: {inRack} left
            </text>
            {Array.from({ length: Math.max(0, inRack) }, (_, k) => {
              const col = k % YARD_COLS
              const row = Math.floor(k / YARD_COLS)
              const x = YARD_X + col * YARD_PITCH_X
              const y = groundY - 6 - (row + 1) * YARD_PITCH_Y
              const broke = k >= affordable
              return (
                <g key={k} opacity={broke ? 0.35 : 1} aria-hidden={broke || undefined}>
                  <rect
                    x={x}
                    y={y}
                    width={PANEL_W}
                    height={PANEL_H}
                    rx="2"
                    className="fill-white/70 stroke-slate-500 dark:fill-white/10 dark:stroke-slate-300"
                    strokeWidth="1.5"
                  />
                  <g strokeWidth="2.5" strokeLinecap="round" className="stroke-amber-600 dark:stroke-amber-400">
                    <line x1={x + 3} y1={y + 3} x2={x + PANEL_W - 3} y2={y + PANEL_H - 3} />
                    <line x1={x + PANEL_W - 3} y1={y + 3} x2={x + 3} y2={y + PANEL_H - 3} />
                  </g>
                </g>
              )
            })}
            {affordable < inRack && (
              <text
                x={YARD_X}
                y={groundY + 38}
                fontSize="11"
                fontWeight="600"
                className="fill-rose-600 font-display dark:fill-rose-300"
              >
                the rack is full, the cheque is not
              </text>
            )}
          </g>

          {/* storey labels down the left edge */}
          {rowsBase.map((r, i) => (
            <text
              key={i}
              x={TOWER_X - 12}
              y={r.yTop + r.h / 2 + 4}
              textAnchor="end"
              fontSize="12"
              fontWeight="700"
              className="fill-ink-soft font-display dark:fill-stone-400"
            >
              {round.building.open[i] < 1
                ? `storey ${i + 1}, lobby, ${round.building.heights[i].toFixed(1)} m`
                : `storey ${i + 1}, ${round.building.heights[i].toFixed(1)} m`}
            </text>
          ))}

          {/* the bearings and the base slab */}
          {isolated && (
            <>
              <g ref={bearingRef}>
                {[0.12, 0.38, 0.62, 0.88].map((f) => (
                  <rect
                    key={f}
                    x={TOWER_X + f * TOWER_W - 9}
                    y={groundY - BEARING_H}
                    width="18"
                    height={BEARING_H}
                    rx="3"
                    className="fill-slate-500 stroke-slate-700 dark:fill-slate-400 dark:stroke-slate-200"
                    strokeWidth="1.5"
                  />
                ))}
              </g>
              <g ref={baseRef}>
                <rect
                  x={TOWER_X - 12}
                  y={groundY - ISO_LIFT}
                  width={TOWER_W + 24}
                  height={ISO_LIFT - BEARING_H}
                  rx="2"
                  className="fill-stone-400 stroke-stone-600 dark:fill-stone-600 dark:stroke-stone-300"
                  strokeWidth="1.5"
                />
              </g>
            </>
          )}

          {/* the frame, one sheared group per storey */}
          {rows.map((r, i) => {
            const glass = round.building.open[i] < 1
            const torn = i === failIdx
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
                  className={
                    torn
                      ? 'fill-rose-300/50 dark:fill-rose-500/25'
                      : glass
                        ? 'fill-sky-200/70 dark:fill-sky-400/15'
                        : 'fill-stone-100/80 dark:fill-white/5'
                  }
                />
                {[0, 1, 2, 3].map((j) => (
                  <line
                    key={j}
                    x1={TOWER_X + j * BAY_PX}
                    y1={r.yBottom}
                    x2={TOWER_X + j * BAY_PX}
                    y2={r.yTop}
                    strokeWidth="5"
                    strokeLinecap="round"
                    className={
                      torn ? 'stroke-rose-600' : 'stroke-slate-600 dark:stroke-slate-300'
                    }
                  />
                ))}
                <line
                  x1={TOWER_X - 6}
                  y1={r.yTop}
                  x2={TOWER_X + TOWER_W + 6}
                  y2={r.yTop}
                  strokeWidth="6"
                  strokeLinecap="round"
                  className={torn ? 'stroke-rose-600' : 'stroke-slate-700 dark:stroke-slate-200'}
                />
                {bays[i].map((on, j) =>
                  on ? (
                    <g
                      key={j}
                      strokeWidth="4"
                      strokeLinecap="round"
                      className="stroke-amber-600 dark:stroke-amber-400"
                    >
                      <line
                        x1={TOWER_X + j * BAY_PX + 4}
                        y1={r.yBottom - 3}
                        x2={TOWER_X + (j + 1) * BAY_PX - 4}
                        y2={r.yTop + 3}
                      />
                      <line
                        x1={TOWER_X + (j + 1) * BAY_PX - 4}
                        y1={r.yBottom - 3}
                        x2={TOWER_X + j * BAY_PX + 4}
                        y2={r.yTop + 3}
                      />
                    </g>
                  ) : null,
                )}
              </g>
            )
          })}

          {/* bay hit targets: tap, and the keyboard path */}
          {!busy &&
            rowsBase.map((r, i) =>
              [0, 1, 2].map((j) => (
                <g
                  key={`${i}-${j}`}
                  role="checkbox"
                  tabIndex={0}
                  aria-checked={bays[i][j]}
                  aria-label={`storey ${i + 1}, bay ${j + 1}, ${bays[i][j] ? 'braced' : 'empty'}`}
                  onKeyDown={(e) => {
                    if (e.key !== ' ' && e.key !== 'Enter') return
                    e.preventDefault()
                    toggleBay(i, j)
                  }}
                  className="outline-none"
                >
                  <rect
                    x={TOWER_X + j * BAY_PX + 2}
                    y={r.yTop + 2}
                    width={BAY_PX - 4}
                    height={r.h - 4}
                    rx="3"
                    fill="transparent"
                    className={cn(
                      'transition-colors duration-150',
                      hover && hover.s === i && hover.b === j && !bays[i][j] && braces[i] < MAX_PER_STOREY
                        ? 'fill-amber-400/35 stroke-amber-500'
                        : 'stroke-transparent',
                    )}
                    strokeWidth="2"
                  />
                </g>
              )),
            )}

          {/* the brace under the pointer */}
          {ghost && (
            <g
              className="pointer-events-none stroke-amber-500"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.85"
            >
              <line x1={ghost.x - 24} y1={ghost.y - 16} x2={ghost.x + 24} y2={ghost.y + 16} />
              <line x1={ghost.x + 24} y1={ghost.y - 16} x2={ghost.x - 24} y2={ghost.y + 16} />
            </g>
          )}

          {/* drift profile, always beside the tower */}
          <g>
            <text
              x={PROFILE_X}
              y={TOP_PAD - 12}
              fontSize="12"
              fontWeight="700"
              className="fill-ink-soft font-display dark:fill-stone-400"
            >
              lean, mm per metre
            </text>
            {rowsBase.map((r, i) => {
              const v = outcomeVisible ? shown.lean[i] : 0
              const w = Math.min(1, v / DRIFT_DISPLAY_CAP) * PROFILE_BAR
              const y = r.yTop + r.h / 2 - 6
              return (
                <g key={i}>
                  <rect
                    x={PROFILE_X}
                    y={y}
                    width={PROFILE_BAR}
                    height="12"
                    rx="6"
                    className="fill-stone-200 dark:fill-white/10"
                  />
                  {outcomeVisible && (
                    <rect
                      x={PROFILE_X}
                      y={y}
                      width={Math.max(3, w)}
                      height="12"
                      rx="6"
                      className={
                        v > DRIFT_CAP * 1000
                          ? 'fill-rose-500'
                          : v > DRIFT_CAP * 700
                            ? 'fill-amber-400'
                            : 'fill-emerald-500'
                      }
                    />
                  )}
                  <text
                    x={PROFILE_X + PROFILE_BAR + 8}
                    y={y + 11}
                    fontSize="12"
                    fontWeight="700"
                    className="fill-ink-soft font-mono dark:fill-stone-400"
                  >
                    {outcomeVisible ? leanText(v) : '?'}
                  </text>
                </g>
              )
            })}
            {/* the limit */}
            <line
              x1={PROFILE_X + (PROFILE_BAR * DRIFT_CAP * 1000) / DRIFT_DISPLAY_CAP}
              y1={rowsBase[N - 1].yTop + rowsBase[N - 1].h / 2 - 12}
              x2={PROFILE_X + (PROFILE_BAR * DRIFT_CAP * 1000) / DRIFT_DISPLAY_CAP}
              y2={rowsBase[0].yBottom - 6}
              strokeWidth="2"
              strokeDasharray="4 4"
              className="stroke-ink dark:stroke-white"
            />
            <text
              x={PROFILE_X + (PROFILE_BAR * DRIFT_CAP * 1000) / DRIFT_DISPLAY_CAP}
              y={rowsBase[0].yBottom + 8}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              className="fill-ink font-display dark:fill-stone-200"
            >
              limit {DRIFT_CAP * 1000}
            </text>
          </g>

          <text
            x={SCENE_W - 8}
            y={groundY + 22}
            textAnchor="end"
            fontSize="11"
            fontWeight="600"
            className="fill-ink-soft font-display dark:fill-stone-400"
          >
            sway drawn {EXAGGERATION} times life size
          </text>

          {/*
            Level 4: the ground's own spectrum, with your tower pinned on it.
            Both numbers come out of the same 50 Newmark runs against the same
            record the building was shaken by, so the panel cannot disagree with
            the verdict. The curve is pseudo-acceleration in %g, because %g is
            what the scanner gate is written in; the displacement at the pin is
            printed beside it, because that is what the moat is for. Those two
            move in opposite directions with period, which IS the level.
          */}
          {spec && showSpectrum && (
            <g>
              {(() => {
                const x0 = 96
                const x1 = SCENE_W - 96
                const top = groundY + GROUND_BAND - 2
                const h = SPECTRUM_H - 46
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
                return (
                  <>
                    <rect
                      x={x0 - 88}
                      y={top - 20}
                      width={x1 - x0 + 176}
                      height={h + 50}
                      rx="10"
                      className="fill-white/80 dark:fill-white/5"
                    />
                    <text
                      x={x0 - 80}
                      y={top - 6}
                      fontSize="12"
                      fontWeight="700"
                      className="fill-ink-soft font-display dark:fill-stone-400"
                    >
                      how hard this ground shoves a building of each rhythm, %g. A tall frame
                      amplifies it, but the shape is the same.
                    </text>
                    <line
                      x1={x0}
                      y1={top + h}
                      x2={x1}
                      y2={top + h}
                      strokeWidth="2"
                      className="stroke-stone-400 dark:stroke-stone-500"
                    />
                    <polyline
                      points={spec.T.map((T, i) => `${px(T)},${py(spec.Sa[i])}`).join(' ')}
                      fill="none"
                      strokeWidth="3"
                      style={{ stroke: 'var(--accent)' }}
                    />
                    {cap !== undefined && (
                      <>
                        <line
                          x1={x0}
                          y1={py(cap)}
                          x2={x1}
                          y2={py(cap)}
                          strokeWidth="2"
                          strokeDasharray="5 4"
                          className="stroke-rose-500"
                        />
                        <text
                          x={x0 - 6}
                          y={py(cap) + 4}
                          textAnchor="end"
                          fontSize="11"
                          fontWeight="700"
                          className="fill-rose-600 font-mono dark:fill-rose-300"
                        >
                          {cap} %g
                        </text>
                      </>
                    )}
                    {[0.1, 0.3, 1, 3].map((T) => (
                      <text
                        key={T}
                        x={px(T)}
                        y={top + h + 16}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="600"
                        className="fill-ink-soft font-mono dark:fill-stone-400"
                      >
                        {T} s
                      </text>
                    ))}
                    <line
                      x1={px(round.site.Tg)}
                      y1={top}
                      x2={px(round.site.Tg)}
                      y2={top + h}
                      strokeWidth="2"
                      strokeDasharray="5 4"
                      className="stroke-stone-500 dark:stroke-stone-400"
                    />
                    <text
                      x={px(round.site.Tg)}
                      y={top - 6}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="700"
                      className="fill-ink-soft font-display dark:fill-stone-400"
                    >
                      the ground beats here
                    </text>
                    <line x1={pin} y1={top} x2={pin} y2={top + h} strokeWidth="3" className="stroke-rose-500" />
                    <circle cx={pin} cy={py(saAt)} r="5" className="fill-rose-500" />
                    <text
                      x={pin}
                      y={top + h + 32}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="700"
                      className="fill-rose-600 font-display dark:fill-rose-300"
                    >
                      your tower, {shown.T1.toFixed(2)} s: shoved at {saAt.toFixed(0)} %g, pushed{' '}
                      {sdAt.toFixed(0)} cm
                    </text>
                  </>
                )
              })()}
            </g>
          )}
        </svg>
      </div>

      {/* Verdict */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        {phase === 'passed' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
          >
            It stands. Worst storey leaned {leanText(shown.worstLean)} mm/m at storey{' '}
            {shown.worstStorey}, and the floors took {shown.worstJolt.toFixed(0)} %g.
          </motion.div>
        )}
        {phase === 'failed' && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300"
          >
            {failLine()}
          </motion.p>
        )}
        {phase === 'build' && overBudget && (
          <p className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Over budget by {money(spend - (round.budget ?? 0))}. Take something back out.
          </p>
        )}
      </div>

      {/* Readouts */}
      <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr,1fr]">
        <div className="space-y-3">
          <p aria-live="polite" className="font-display text-sm font-semibold">
            {inRack} {inRack === 1 ? 'brace' : 'braces'} left in the rack
            <span className="ml-2 font-normal text-ink-soft dark:text-stone-400">
              {used} installed, up to {MAX_PER_STOREY} per storey
            </span>
          </p>
          <p className="text-sm text-ink-soft dark:text-stone-400">
            Drag a brace out of the rack into any bay, or tap a bay. Tab to a bay and press space to
            do the same. Your tower weighs {shown.totalMass.toLocaleString('en-US')} tonnes and takes{' '}
            <span className="font-mono font-semibold tabular-nums">{shown.T1.toFixed(2)} s</span> to
            sway once.
          </p>
          {round.bearings && (
            <button
              type="button"
              onClick={() => {
                if (busy) return
                setIsolated((v) => !v)
                playSound('click')
                touched()
              }}
              disabled={busy}
              aria-pressed={isolated}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border-2 px-5 py-2 font-display text-sm font-bold transition-colors duration-200',
                isolated
                  ? 'accent-border accent-soft accent-text'
                  : 'border-stone-200 text-ink-soft hover:border-stone-300 dark:border-white/10 dark:text-stone-400 dark:hover:border-white/25',
              )}
            >
              <Layers className="h-4 w-4" />
              {isolated ? 'On isolation bearings' : 'Put it on isolation bearings'}
              <span className="font-mono font-normal">{money(BEARING_COST)}</span>
            </button>
          )}
        </div>

        <div className="space-y-4">
          {round.budget !== null ? (
            <Meter
              label="Budget"
              display={`${money(spend)} of ${money(round.budget)}`}
              fraction={spend / round.budget}
              barClass={
                overBudget ? 'bg-rose-500' : spend / round.budget > 0.85 ? 'bg-amber-400' : 'bg-emerald-500'
              }
            />
          ) : (
            <p className="font-display text-sm font-semibold text-ink-soft dark:text-stone-400">
              {round.rack} braces at {money(BRACE_COST)} each
              {round.bearings ? `, bearings ${money(BEARING_COST)}` : ''}. Build cost so far:{' '}
              {money(spend)}
            </p>
          )}
          <Meter
            label="Worst storey lean"
            display={
              outcomeVisible
                ? `${leanText(shown.worstLean)} mm/m at storey ${shown.worstStorey}, limit ${DRIFT_CAP * 1000}`
                : 'shake it to find out'
            }
            fraction={outcomeVisible ? Math.min(1, shown.worstLean / DRIFT_DISPLAY_CAP) : 0}
            markerFraction={(DRIFT_CAP * 1000) / DRIFT_DISPLAY_CAP}
            barClass={
              !outcomeVisible
                ? 'accent-bg'
                : shown.worstLean > DRIFT_CAP * 1000
                  ? 'bg-rose-500'
                  : 'bg-emerald-500'
            }
          />
          {(round.gates.joltCap !== undefined || lv.level.metrics) && (
            <Meter
              label="Peak floor jolt"
              display={
                outcomeVisible
                  ? `${shown.worstJolt.toFixed(0)} %g${round.gates.joltCap !== undefined ? ` of ${round.gates.joltCap} allowed` : ''}`
                  : 'shake it to find out'
              }
              fraction={outcomeVisible ? Math.min(1, shown.worstJolt / 160) : 0}
              markerFraction={round.gates.joltCap !== undefined ? round.gates.joltCap / 160 : undefined}
              barClass={
                !outcomeVisible
                  ? 'accent-bg'
                  : round.gates.joltCap !== undefined && shown.worstJolt > round.gates.joltCap
                    ? 'bg-rose-500'
                    : 'bg-emerald-500'
              }
            />
          )}
          {round.gates.moat !== undefined && (
            <Meter
              label={isolated ? 'Bearing slide' : 'Bearing slide (no bearings fitted)'}
              display={
                !isolated
                  ? 'nothing to slide'
                  : outcomeVisible
                    ? `${shown.bearingTravel.toFixed(0)} cm of a ${round.gates.moat * 100} cm moat`
                    : 'shake it to find out'
              }
              fraction={
                isolated && outcomeVisible
                  ? Math.min(1, shown.bearingTravel / (round.gates.moat * 200))
                  : 0
              }
              markerFraction={0.5}
              barClass={
                !outcomeVisible || !isolated
                  ? 'accent-bg'
                  : shown.bearingTravel > round.gates.moat * 100
                    ? 'bg-rose-500'
                    : 'bg-emerald-500'
              }
            />
          )}
          <p className="text-xs text-ink-soft dark:text-stone-400">
            {outcomeVisible
              ? 'The dashed line on the tower marks the lean limit. Every storey has to clear it, not just the average.'
              : 'You can see everything you built. How the ground answers is hidden until you commit.'}
          </p>
        </div>
      </div>

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
              : `It stands. Worst storey leaned ${leanText(shown.worstLean)} mm/m.`
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
