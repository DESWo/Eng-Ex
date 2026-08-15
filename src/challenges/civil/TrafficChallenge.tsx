import { useEffect, useRef, useState } from 'react'
import { Layers, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { InsightToggle } from '@/components/level/InsightToggle'
import { Objective } from '@/components/level/Objective'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import {
  ApprovalStamp,
  Arrowhead,
  CursorMark,
  DimString,
  DraftingSheet,
  DrawingKey,
  INK,
  LETTER,
  Leader,
  NoteBlock,
  PEN,
  Redline,
  RevisionStamp,
  ScaleBar,
  Schedule,
  SheetTool,
  SnapGrid,
  TRACK,
  TitleBlock,
  useSheetCursor,
  type ScheduleColumn,
  type ScheduleFoot,
  type SheetStatus,
} from '@/components/instruments/drafting'
import { useLevels } from '@/hooks/useLevels'
import { attemptsFor, useAttempts } from '@/hooks/useAttempts'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const CYCLE = 60 // seconds in one full light cycle
const CARS_PER_GREEN_SECOND = 0.5 // cars that clear the light per green second
const LOST_PER_PHASE = 4 // amber + all-red clearance wasted at every phase change
const SIM_SPEED = 9 // the one-minute cycle plays out this many times faster on screen
const TICK_MS = 50 // animation tick

interface TrafficSetup {
  label: string
  ns: number // cars arriving per minute from the north
  ew: number // cars arriving per minute from the west
  /** Seconds per cycle reserved for people crossing on foot. */
  ped: number
  /** Level 3 on: every phase change wastes clearance seconds. */
  lostTime: boolean
  /** Level 4 on: the queue readout is available. */
  queues: boolean
  brief: string
}

const LEVELS: ChallengeLevel<TrafficSetup>[] = [
  {
    n: 1,
    title: 'Share the green',
    phase: 'play',
    concept: 'Green time clears cars',
    teach: 'A road only clears cars while its light is green, one car every two seconds. Drag the divider so both roads get enough green to keep up, then run the lights.',
    setup: { label: 'A quiet morning', ns: 14, ew: 10, ped: 0, lostTime: false, queues: false, brief: 'Light traffic from two directions. Give each road enough green and everyone gets through.' },
  },
  {
    n: 2,
    title: 'One minute, no more',
    phase: 'understand',
    concept: 'The cycle is fixed',
    teach: 'There is only one minute of green to share, so every second you give one road is a second taken from the other. Now the two directions are competing for the same time.',
    setup: { label: 'The morning rush', ns: 17, ew: 11, ped: 0, lostTime: false, queues: false, brief: 'Heavier traffic, and the cycle is fixed at a minute. Now the split really matters.' },
  },
  {
    n: 3,
    title: 'Lost seconds',
    phase: 'understand',
    concept: 'Every change wastes time',
    teach: 'When the lights change, a few seconds are lost to amber and all-red before anyone moves. Adding a pedestrian phase adds another changeover, so more phases means less green for everyone. Pedestrians are not free.',
    setup: { label: 'Market day', ns: 13, ew: 7, ped: 6, lostTime: true, queues: false, brief: 'A pedestrian crossing joins the cycle, and each phase change quietly eats a few seconds.' },
  },
  {
    n: 4,
    title: 'Watch the queues',
    phase: 'analyze',
    concept: 'Where the backup forms',
    teach: 'Turn on the queue readout. It shows how many cars are still waiting on each approach. A road that clears keeps its bar short, one that cannot keeps growing, and you can see the trouble before you even run it.',
    setup: { label: 'School run', ns: 12, ew: 8, ped: 4, lostTime: true, queues: true, brief: 'The same junction, with the waiting queues drawn out on each approach.' },
  },
  {
    n: 5,
    title: 'Keep the town moving',
    phase: 'optimize',
    concept: 'Efficient or fair',
    teach: 'Delay grows with the square of the red time, so favouring the busy road cuts the total wait but leaves the quiet road stuck for ages. Balance it and the totals rise but nobody is stranded. There is no split that wins both. Waiting is counted in car-seconds: ten cars held for one second each is ten car-seconds, and so is one car held for ten.',
    setup: { label: 'Rush hour', ns: 12, ew: 6, ped: 4, lostTime: true, queues: true, brief: 'Sign off the timing plan. Keep the total wait down without leaving one road stranded.' },
    // Five splits clear both roads (NS 24s through 32s). Par on the total wants
    // NS 30 or 32, par on the worst road wants NS 28 or 30, and NS 30 misses the
    // worst-road par by 2 car-seconds, so no split takes both.
    metrics: [
      { id: 'total', label: 'Total delay', goal: 'min', target: 196, unit: ' car-seconds' },
      { id: 'worst', label: 'Worst-road delay', goal: 'min', target: 104, unit: ' car-seconds' },
    ],
  },
]

type Phase = 'idle' | 'running' | 'passed' | 'failed'

/* ------------------- sheet geometry ------------------- */
const VIEW_W = 800
const VIEW_H = 440
/** One second of cycle time, in drawing px along the timing band. */
const PX_PER_S = 11
/** A grid module is two seconds, which is also what the changeover snaps to. */
const STEP = 2 * PX_PER_S
const BAND_X = 60 // t = 0
const BAND_Y = 300
const BAND_H = 40
const BAND_W = CYCLE * PX_PER_S
const CURSOR_Y = BAND_Y + BAND_H / 2
/** Cycle seconds to a station along the band. */
const tx = (s: number) => BAND_X + s * PX_PER_S

/* the junction, in plan */
const JX = 300 // north-south centreline
const JY = 200 // east-west centreline
const LANE = 22 // half a carriageway
const NS_STOP = JY - LANE - 4
const EW_STOP = JX - LANE - 4
const CAR = 13 // a vehicle, nose to tail
const PITCH = 16 // stop line spacing in a standing queue
const ZEB_X = 336 // the crossing, on the east arm

/** A vehicle waiting on the north approach, drawn in plan. */
function CarNS({ y }: { y: number }) {
  return (
    <g aria-hidden>
      <rect x={JX - 9} y={y} width="18" height={CAR} rx="2" fill={INK.paper} stroke={INK.line} strokeWidth={PEN.thin} />
      <line x1={JX - 9} y1={y + 4} x2={JX + 9} y2={y + 4} stroke={INK.soft} strokeWidth={PEN.hair} />
    </g>
  )
}

/** A vehicle waiting on the west approach. */
function CarEW({ x }: { x: number }) {
  return (
    <g aria-hidden>
      <rect x={x} y={JY - 9} width={CAR} height="18" rx="2" fill={INK.paper} stroke={INK.line} strokeWidth={PEN.thin} />
      <line x1={x + CAR - 4} y1={JY - 9} x2={x + CAR - 4} y2={JY + 9} stroke={INK.soft} strokeWidth={PEN.hair} />
    </g>
  )
}

/** A signal head with two aspects. Nothing is lit until the lights are running. */
function SignalHead({
  x,
  y,
  vertical,
  mark,
  running,
  go,
}: {
  x: number
  y: number
  vertical: boolean
  mark: string
  running: boolean
  go: boolean
}) {
  const w = vertical ? 18 : 34
  const h = vertical ? 34 : 18
  const stop = vertical ? { cx: x + 9, cy: y + 10 } : { cx: x + 10, cy: y + 9 }
  const goAt = vertical ? { cx: x + 9, cy: y + 24 } : { cx: x + 24, cy: y + 9 }
  const lit = (on: boolean, tone: string) => (on ? tone : INK.paper)
  return (
    <g aria-hidden>
      <rect x={x} y={y} width={w} height={h} rx="3" fill={INK.paper} stroke={INK.line} strokeWidth={PEN.thin} />
      <circle cx={stop.cx} cy={stop.cy} r="5" fill={lit(running && !go, INK.red)} stroke={INK.red} strokeWidth={PEN.hair} />
      <circle cx={goAt.cx} cy={goAt.cy} r="5" fill={lit(go, INK.check)} stroke={INK.check} strokeWidth={PEN.hair} />
      <text
        x={vertical ? x + 9 : x - 5}
        y={vertical ? y - 5 : y + 13}
        textAnchor={vertical ? 'middle' : 'end'}
        className={LETTER}
        style={{ letterSpacing: TRACK.normal }}
        fontSize="9"
        fill={INK.soft}
      >
        {mark}
      </text>
    </g>
  )
}

/** A stage on the key: who moves, who is held, and for how long. */
function StageKey({
  x,
  y,
  kind,
  name,
  detail,
  live,
}: {
  x: number
  y: number
  kind: 'ns' | 'ew' | 'walk'
  name: string
  detail: string
  live: boolean
}) {
  const cx = x + 34
  const cy = y + 31
  return (
    <g aria-hidden className="pointer-events-none">
      <rect
        x={x}
        y={y}
        width="200"
        height="62"
        fill="none"
        stroke={live ? INK.line : INK.soft}
        strokeWidth={live ? PEN.thin : PEN.hair}
        strokeDasharray={live ? undefined : '5 4'}
        opacity={live ? 1 : 0.7}
      />
      {/* the junction, kerbs broken through the middle */}
      <path
        d={`M${cx - 26} ${cy - 9} H${cx - 9} M${cx + 9} ${cy - 9} H${cx + 26} M${cx - 26} ${cy + 9} H${cx - 9} M${cx + 9} ${cy + 9} H${cx + 26}`}
        stroke={INK.soft}
        strokeWidth={PEN.hair}
        fill="none"
      />
      <path
        d={`M${cx - 9} ${cy - 24} V${cy - 9} M${cx - 9} ${cy + 9} V${cy + 24} M${cx + 9} ${cy - 24} V${cy - 9} M${cx + 9} ${cy + 9} V${cy + 24}`}
        stroke={INK.soft}
        strokeWidth={PEN.hair}
        fill="none"
      />
      {kind === 'ns' && (
        <>
          <line x1={cx} y1={cy - 22} x2={cx} y2={cy + 16} stroke={INK.line} strokeWidth={PEN.dim} />
          <Arrowhead x={cx} y={cy + 22} ux={0} uy={1} size={7} fill={INK.line} />
          <line x1={cx - 9} y1={cy - 9} x2={cx - 9} y2={cy + 9} stroke={INK.line} strokeWidth={PEN.member} />
        </>
      )}
      {kind === 'ew' && (
        <>
          <line x1={cx - 22} y1={cy} x2={cx + 16} y2={cy} stroke={INK.line} strokeWidth={PEN.dim} />
          <Arrowhead x={cx + 22} y={cy} ux={1} uy={0} size={7} fill={INK.line} />
          <line x1={cx - 9} y1={cy - 9} x2={cx + 9} y2={cy - 9} stroke={INK.line} strokeWidth={PEN.member} />
        </>
      )}
      {kind === 'walk' && (
        <>
          {[13, 17, 21, 25].map((d) => (
            <line key={d} x1={cx + d} y1={cy - 9} x2={cx + d} y2={cy + 9} stroke={INK.line} strokeWidth={PEN.dim} />
          ))}
          <line x1={cx - 9} y1={cy - 9} x2={cx - 9} y2={cy + 9} stroke={INK.line} strokeWidth={PEN.member} />
          <line x1={cx - 9} y1={cy - 9} x2={cx + 9} y2={cy - 9} stroke={INK.line} strokeWidth={PEN.member} />
        </>
      )}
      <text x={x + 70} y={y + 28} className={LETTER} style={{ letterSpacing: TRACK.wide }} fontSize="10" fontWeight="700" fill={INK.line}>
        {name}
      </text>
      <text x={x + 70} y={y + 43} className={LETTER} style={{ letterSpacing: TRACK.normal }} fontSize="9" fill={INK.soft}>
        {detail}
      </text>
    </g>
  )
}

export function TrafficChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('traffic', LEVELS)
  const round = lv.level.setup

  const phases = 2 + (round.ped > 0 ? 1 : 0)
  const lost = round.lostTime ? LOST_PER_PHASE * phases : 0
  const available = CYCLE - round.ped - lost

  const [greenNS, setGreenNS] = useState(6)
  const [phase, setPhase] = useState<Phase>('idle')
  /** Where we are inside the running cycle, in cycle seconds (0..CYCLE). */
  const [simT, setSimT] = useState(0)
  /**
   * Cars still at each stop line when the cycle ended. A passing plan does not
   * empty the junction, so the scene has to keep showing the leftovers.
   */
  const [settled, setSettled] = useState<{ ns: number; ew: number } | null>(null)
  const simQ = useRef({ ns: 0, ew: 0 })
  const simInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)
  const [showQueues, setShowQueues] = useState(true)
  const [showStages, setShowStages] = useState(true)
  /** Runs of the lights so far, which is the revision this sheet is at. */
  const [runs, setRuns] = useState(0)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const draggingSplit = useRef(false)
  const completedRef = useRef(false)

  const greenEW = available - greenNS

  useEffect(() => {
    setGreenNS(6)
    setPhase('idle')
    setSettled(null)
    setRuns(0)
    board.setCursor({ x: tx(6), y: CURSOR_Y })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lv.level.n])

  /** Book the changeover at `seconds` into the cycle. Snaps to the 2 s module. */
  function setChangeover(seconds: number) {
    if (phase === 'running' || !Number.isFinite(seconds)) return
    const snapped = Math.round(seconds / 2) * 2
    const next = Math.max(6, Math.min(available - 6, snapped))
    setGreenNS(next)
    board.setCursor({ x: tx(next), y: CURSOR_Y })
    setPhase('idle')
    setSettled(null)
  }

  /** Pointer station on the band, in cycle seconds. */
  const bandSeconds = (clientX: number) => {
    const svg = svgRef.current
    if (!svg || !Number.isFinite(clientX)) return null
    const rect = svg.getBoundingClientRect()
    if (rect.width === 0) return null
    return (((clientX - rect.left) / rect.width) * VIEW_W - BAND_X) / PX_PER_S
  }

  const startSplit = (e: React.PointerEvent<SVGRectElement>) => {
    if (phase === 'running') return
    draggingSplit.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    const s = bandSeconds(e.clientX)
    if (s !== null) setChangeover(s)
  }
  const moveSplit = (e: React.PointerEvent<SVGRectElement>) => {
    if (!draggingSplit.current) return
    const s = bandSeconds(e.clientX)
    if (s !== null) setChangeover(s)
  }
  const endSplit = () => {
    draggingSplit.current = false
  }

  const capNS = greenNS * CARS_PER_GREEN_SECOND
  const capEW = greenEW * CARS_PER_GREEN_SECOND
  const okNS = capNS >= round.ns
  const okEW = capEW >= round.ew
  const queueNS = Math.max(0, round.ns - capNS)
  const queueEW = Math.max(0, round.ew - capEW)

  // Delay grows with the square of a road's red time (a standard result).
  // Arrivals are steady, so a road piles up (arrivals per second) x red, half of
  // them wait the full red: (cars/min / CYCLE) x red^2 / 2 car-seconds per cycle.
  const redNS = CYCLE - greenNS
  const redEW = CYCLE - greenEW
  const delayNS = (round.ns * redNS * redNS) / (2 * CYCLE)
  const delayEW = (round.ew * redEW * redEW) / (2 * CYCLE)
  const totalDelay = Math.round(delayNS + delayEW)
  const worstDelay = Math.round(Math.max(delayNS, delayEW))

  const run = () => {
    if (phase === 'running') return
    setPhase('running')
    setRuns((r) => r + 1)
    setSimT(0)
    setSettled(null)
    simQ.current = { ns: 0, ew: 0 }
    if (simInterval.current) clearInterval(simInterval.current)
    let t = 0
    let last = performance.now()
    simInterval.current = setInterval(() => {
      // Wall-clock time, so a janky tab cannot stretch the minute out.
      const now = performance.now()
      // Cap the catch-up at 4 real seconds per tick: a throttled background
      // tab advances in coarse steps instead of stalling the whole minute.
      const dt = Math.min(4, (now - last) / 1000) * SIM_SPEED
      last = now
      t += dt
      // Arrivals trickle in the whole minute; the stop line only clears on green.
      const q = simQ.current
      q.ns += (round.ns / 60) * dt
      q.ew += (round.ew / 60) * dt
      if (t < greenNS) q.ns = Math.max(0, q.ns - CARS_PER_GREEN_SECOND * dt)
      else if (t < greenNS + greenEW) q.ew = Math.max(0, q.ew - CARS_PER_GREEN_SECOND * dt)
      setSimT(Math.min(CYCLE, t))
      if (t >= CYCLE) {
        if (simInterval.current) clearInterval(simInterval.current)
        setSettled({ ns: q.ns, ew: q.ew })
        if (okNS && okEW) {
          setPhase('passed')
          lv.clearLevel(lv.level.metrics ? { total: totalDelay, worst: worstDelay } : undefined)
          if (!completedRef.current) {
            completedRef.current = true
            onComplete()
          }
        } else {
          if (att.spend()) {
            setGreenNS(6)
            board.setCursor({ x: tx(6), y: CURSOR_Y })
            att.refill()
          }
          setPhase('failed')
        }
      }
    }, TICK_MS)
  }

  const reset = () => {
    if (simInterval.current) clearInterval(simInterval.current)
    setGreenNS(6)
    board.setCursor({ x: tx(6), y: CURSOR_Y })
    setPhase('idle')
    setSimT(0)
    setSettled(null)
  }

  useEffect(() => () => {
    if (simInterval.current) clearInterval(simInterval.current)
  }, [])

  /**
   * The changeover is drawn, so it is driven from the board: arrows walk the
   * mark along the band, enter books it there, escape puts it back, delete
   * rubs the plan out.
   */
  const board = useSheetCursor({
    step: STEP,
    bounds: { minX: tx(6), maxX: tx(available - 6), minY: CURSOR_Y, maxY: CURSOR_Y },
    start: { x: tx(6), y: CURSOR_Y },
    onCommit: (p) => setChangeover((p.x - BAND_X) / PX_PER_S),
    onCancel: () => board.setCursor({ x: tx(greenNS), y: CURSOR_Y }),
    onDelete: () => reset(),
    disabled: phase === 'running',
  })

  /* What the signals show right now, derived from where we are in the cycle. */
  const running = phase === 'running'
  const nsGo = running && simT < greenNS
  const ewGo = running && simT >= greenNS && simT < greenNS + greenEW
  const walkNow = running && simT >= greenNS + greenEW && round.ped > 0
  const qNS = running ? simQ.current.ns : 0
  const qEW = running ? simQ.current.ew : 0
  // Preview stack before the first run, live queue while running, leftovers
  // after. Do not snap back to the preview: it contradicts the banner.
  const shownQNS = running ? qNS : settled ? settled.ns : round.ns / 3
  const shownQEW = running ? qEW : settled ? settled.ew : round.ew / 3

  const won = phase === 'passed'

  // Capacity verdict is held back until the lights have run, except on level 1
  // (teaching the split) and level 4 (reading the queue bars).
  const outcomeVisible = lv.level.n === 1 || lv.level.n === 4 || phase === 'passed' || phase === 'failed'

  /* ---------- the sheet ---------- */
  const status: SheetStatus = phase === 'passed' ? 'approved' : phase === 'failed' ? 'revise' : 'draft'
  const tail = round.ped + lost // walk time plus the seconds lost at each change
  const booked = greenNS + greenEW + tail
  const showQueue = round.queues && showQueues
  const cursorSeconds = Math.round((board.cursor.x - BAND_X) / PX_PER_S)
  const parTotal = lv.level.metrics?.find((m) => m.id === 'total')?.target ?? 0
  const parWorst = lv.level.metrics?.find((m) => m.id === 'worst')?.target ?? 0

  const approachColumns: ScheduleColumn[] = [
    { key: 'mark', label: 'approach' },
    { key: 'arrives', label: 'arrives', align: 'right' },
    { key: 'green', label: 'green', align: 'right' },
    { key: 'clears', label: 'clears', align: 'right' },
    ...(showQueue ? [{ key: 'queue', label: 'left waiting', align: 'right' } as ScheduleColumn] : []),
    ...(lv.level.metrics ? [{ key: 'delay', label: 'delay', align: 'right' } as ScheduleColumn] : []),
  ]

  const approachRow = (
    mark: string,
    arriving: number,
    green: number,
    clearing: number,
    queue: number,
    delay: number,
    ok: boolean,
  ) => ({
    key: mark,
    over: outcomeVisible && !ok,
    cells: {
      mark,
      arrives: `${arriving}/min`,
      green: `${green} s`,
      clears: outcomeVisible ? `${clearing.toFixed(0)}/min` : 'run the lights',
      queue: queue > 0 ? `${queue.toFixed(0)}/min` : 'clears',
      delay: outcomeVisible ? `${Math.round(delay)} car-s` : 'run the lights',
    },
  })

  const approachFoot: ScheduleFoot[] = lv.level.metrics
    ? [
        { label: 'total delay', value: outcomeVisible ? `${totalDelay} car-s` : 'run the lights' },
        { label: 'par', value: `${parTotal} car-s` },
        {
          label: 'worst road against its par',
          value: outcomeVisible ? `${worstDelay} of ${parWorst} car-s` : 'run the lights',
          tone: outcomeVisible ? (worstDelay <= parWorst ? 'ok' : 'over') : 'normal',
        },
      ]
    : [
        { label: 'cars arriving each minute', value: `${round.ns + round.ew}` },
        { label: 'cars cleared each minute', value: outcomeVisible ? `${(capNS + capEW).toFixed(0)}` : 'run the lights' },
        {
          label: 'short on the worst approach',
          value: outcomeVisible ? `${Math.max(0, round.ns - capNS, round.ew - capEW).toFixed(0)}/min` : 'run the lights',
          tone: outcomeVisible ? (okNS && okEW ? 'ok' : 'over') : 'normal',
        },
      ]

  const cycleRows = [
    { key: 'ns', cells: { item: 'a · north-south green', from: '0 s', secs: `${greenNS} s` } },
    { key: 'ew', cells: { item: 'b · east-west green', from: `${greenNS} s`, secs: `${greenEW} s` } },
    ...(round.ped > 0
      ? [{ key: 'walk', cells: { item: 'c · walk phase', from: `${greenNS + greenEW} s`, secs: `${round.ped} s` } }]
      : []),
    ...(lost > 0
      ? [{ key: 'lost', cells: { item: `lost at ${phases} changes`, from: `${greenNS + greenEW + round.ped} s`, secs: `${lost} s` } }]
      : []),
  ]

  const stages: { kind: 'ns' | 'ew' | 'walk'; name: string; detail: string; live: boolean }[] = [
    { kind: 'ns', name: 'stage 1', detail: `north-south, ${greenNS} s`, live: nsGo },
    { kind: 'ew', name: 'stage 2', detail: `east-west, ${greenEW} s`, live: ewGo },
    ...(round.ped > 0
      ? [{ kind: 'walk' as const, name: 'stage 3', detail: `walk, ${round.ped} s`, live: walkNow }]
      : []),
  ]

  const markX = tx(greenNS) // where the changeover is booked
  const nsCars = Math.min(9, Math.round(shownQNS))
  const ewCars = Math.min(9, Math.round(shownQEW))

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {phase === 'passed' && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.queues ? <InsightToggle label="queues" on={showQueues} onChange={setShowQueues} /> : undefined}
      />

      <Objective
        goal={`Split the green so both roads clear their queues before the cycle ends (NS ${round.ns} cars/min, EW ${round.ew})`}
        status={`your split: ns ${greenNS} s green, ew ${greenEW} s`}
        attemptsLeft={att.left}
        met={phase === 'passed'}
      />

      <p className="mb-3 max-w-2xl text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>

      <DraftingSheet
        tools={
          <>
            <SheetTool
              active={showStages}
              onClick={() => setShowStages((v) => !v)}
              icon={<Layers className="h-3.5 w-3.5" />}
              label="stage key"
            />
            <p id="band-help" className="max-w-xl text-[11px] leading-snug text-[var(--dr-ink-soft,#6c6252)]">
              Drag the changeover mark along the timing band to share the minute out. Everything left of the mark is green for
              the north-south road, everything right of it up to the walk block is green for the east-west road. Keyboard: arrow
              keys walk the mark in 2 s steps, enter books the changeover there, escape puts it back, delete rubs out the plan.
            </p>
          </>
        }
        titleBlock={
          <TitleBlock
            project="Fifth and Main junction"
            drawing={`${lv.level.n}. ${lv.level.title}`}
            sheetNo={`T-0${lv.level.n}`}
            scale="1 square = 2 s"
            checking={`${round.label.toLowerCase()}, ns ${round.ns}/min, ew ${round.ew}/min${round.ped > 0 ? `, walk ${round.ped} s` : ''}${lost > 0 ? `, lost ${lost} s` : ''}`}
            rev={runs}
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
                cursor {cursorSeconds} s into the cycle · changeover booked at {greenNS} s
              </span>
              <span className={cn(LETTER, 'tabular-nums')} style={{ letterSpacing: TRACK.normal }}>
                cycle {CYCLE} s · booked {booked} s{running ? ` · running, ${Math.floor(simT)} s` : ''}
              </span>
            </div>

            <DrawingKey
              title="key"
              items={[
                {
                  label: 'north-south green',
                  sample: (
                    <>
                      <rect x="0.5" y="0.5" width="25" height="9" fill="none" stroke={INK.line} strokeWidth="0.6" />
                      <path d="M4 9.5 L9 0.5 M11 9.5 L16 0.5 M18 9.5 L23 0.5" stroke={INK.line} strokeWidth="0.6" fill="none" />
                    </>
                  ),
                },
                {
                  label: 'east-west green',
                  sample: (
                    <>
                      <rect x="0.5" y="0.5" width="25" height="9" fill="none" stroke={INK.line} strokeWidth="0.6" />
                      <path d="M4 0.5 L9 9.5 M11 0.5 L16 9.5 M18 0.5 L23 9.5" stroke={INK.line} strokeWidth="0.6" fill="none" />
                    </>
                  ),
                },
                ...(round.ped > 0
                  ? [
                      {
                        label: 'walk phase',
                        sample: (
                          <>
                            <rect x="0.5" y="0.5" width="25" height="9" fill="none" stroke={INK.line} strokeWidth="0.6" />
                            <path d="M6 1 v8 M11 1 v8 M16 1 v8 M21 1 v8" stroke={INK.soft} strokeWidth="0.9" fill="none" />
                          </>
                        ),
                      },
                    ]
                  : []),
                ...(lost > 0
                  ? [
                      {
                        label: 'lost at each change',
                        sample: (
                          <>
                            <rect x="0.5" y="0.5" width="25" height="9" fill="none" stroke={INK.line} strokeWidth="0.6" />
                            <path d="M3 9.5 L8 0.5 M11 9.5 L16 0.5 M19 9.5 L24 0.5 M3 0.5 L8 9.5 M11 0.5 L16 9.5 M19 0.5 L24 9.5" stroke={INK.soft} strokeWidth="0.5" fill="none" />
                          </>
                        ),
                      },
                    ]
                  : []),
                {
                  label: 'changeover mark',
                  sample: (
                    <>
                      <line x1="13" y1="1" x2="13" y2="9" stroke={INK.line} strokeWidth="2.4" />
                      <path d="M9 1 H17 L13 5 Z" fill={INK.line} />
                    </>
                  ),
                },
              ]}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Schedule
                title="cycle time schedule"
                columns={[
                  { key: 'item', label: 'phase' },
                  { key: 'from', label: 'starts', align: 'right' },
                  { key: 'secs', label: 'seconds', align: 'right' },
                ]}
                rows={cycleRows}
                foot={[
                  { label: 'booked', value: `${booked} s` },
                  { label: 'cycle', value: `${CYCLE} s` },
                  { label: 'variance', value: `${CYCLE - booked} s`, tone: CYCLE - booked === 0 ? 'ok' : 'over' },
                ]}
              />
              <Schedule
                title="approach schedule"
                columns={approachColumns}
                rows={[
                  approachRow('a · north-south', round.ns, greenNS, capNS, queueNS, delayNS, okNS),
                  approachRow('b · east-west', round.ew, greenEW, capEW, queueEW, delayEW, okEW),
                ]}
                foot={approachFoot}
              />
            </div>

            {tail > 0 && (
              <NoteBlock n="cycle" tone="amber">
                The last block of the band is walk time plus the seconds lost at each change. It comes off the minute before the
                two roads split what is left, so a third stage costs every road green.
              </NoteBlock>
            )}

            {/* Verdicts are lettered notes on the sheet. */}
            <div aria-live="polite" className="min-h-[2.5rem] space-y-2">
              {phase === 'passed' && (
                <NoteBlock n={1} tone="check">
                  Green wave! Neither queue grows: each road clears a full minute of traffic inside its own green. The cars still
                  at the line arrived after it went red and go first next cycle.
                  {lv.level.metrics ? ` Total delay ${totalDelay} car-seconds, worst road ${worstDelay}.` : ' Nobody honks today.'}
                </NoteBlock>
              )}
              {phase === 'failed' && (
                <NoteBlock n={1} tone="red">
                  {!okNS
                    ? `The northbound queue never cleared. ${round.ns} cars arrive each minute and ${capNS.toFixed(0)} get through, so it needs more green than it is getting.`
                    : `The westbound queue never cleared. ${round.ew} cars arrive each minute and ${capEW.toFixed(0)} get through, so it needs more green than it is getting.`}
                </NoteBlock>
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
          aria-label={`Signal timing sheet T-0${lv.level.n}, ${round.label.toLowerCase()}. North-south green ${greenNS} seconds, east-west green ${greenEW} seconds${round.ped > 0 ? `, walk ${round.ped} seconds` : ''}${lost > 0 ? `, ${lost} seconds lost at the changes` : ''}, in a ${CYCLE} second cycle.`}
          aria-describedby="band-help"
          {...board.boardProps}
        >
          <defs>
            <pattern id="tr-hatch-ns" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="7" stroke={INK.line} strokeWidth={PEN.hair} />
            </pattern>
            <pattern id="tr-hatch-ew" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <line x1="0" y1="0" x2="0" y2="7" stroke={INK.line} strokeWidth={PEN.hair} />
            </pattern>
            <pattern id="tr-hatch-walk" width="7" height="7" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="7" stroke={INK.soft} strokeWidth={PEN.thin} />
            </pattern>
            <pattern id="tr-hatch-lost" width="6" height="6" patternUnits="userSpaceOnUse">
              <path d="M0 0 L6 6 M0 6 L6 0" stroke={INK.soft} strokeWidth={PEN.hair} fill="none" />
            </pattern>
          </defs>

          {/* ---------- the junction, in plan ---------- */}
          {/* kerbs, broken through the junction box */}
          <path
            d={`M0 ${JY - LANE} H${JX - LANE} M${JX + LANE} ${JY - LANE} H560 M0 ${JY + LANE} H${JX - LANE} M${JX + LANE} ${JY + LANE} H560`}
            stroke={INK.line}
            strokeWidth={PEN.thin}
            fill="none"
          />
          <path
            d={`M${JX - LANE} 20 V${JY - LANE} M${JX - LANE} ${JY + LANE} V272 M${JX + LANE} 20 V${JY - LANE} M${JX + LANE} ${JY + LANE} V272`}
            stroke={INK.line}
            strokeWidth={PEN.thin}
            fill="none"
          />
          {/* centrelines */}
          <path
            d={`M10 ${JY} H${JX - LANE - 14} M${JX + LANE + 14} ${JY} H556 M${JX} 24 V${JY - LANE - 14} M${JX} ${JY + LANE + 14} V268`}
            stroke={INK.soft}
            strokeWidth={PEN.hair}
            strokeDasharray="12 8"
            fill="none"
          />
          {/* stop lines */}
          <line x1={JX - LANE} y1={NS_STOP} x2={JX + LANE} y2={NS_STOP} stroke={INK.line} strokeWidth={PEN.member} />
          <line x1={EW_STOP} y1={JY - LANE} x2={EW_STOP} y2={JY + LANE} stroke={INK.line} strokeWidth={PEN.member} />
          {/* break lines where the roads run off the sheet */}
          <path
            d={`M560 ${JY - LANE} l-6 11 l12 22 l-6 11 M${JX - LANE} 272 l11 -6 l22 12 l11 -6`}
            stroke={INK.soft}
            strokeWidth={PEN.thin}
            fill="none"
          />
          {/* north point */}
          <g aria-hidden>
            <line x1={40} y1={72} x2={40} y2={40} stroke={INK.soft} strokeWidth={PEN.thin} />
            <Arrowhead x={40} y={34} ux={0} uy={-1} size={9} fill={INK.soft} />
            <text x={40} y={86} textAnchor="middle" className={LETTER} style={{ letterSpacing: TRACK.wide }} fontSize="10" fill={INK.soft}>
              n
            </text>
          </g>

          {/* the crossing on the east arm */}
          {round.ped > 0 && (
            <g aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <rect
                  key={i}
                  x={ZEB_X + i * 9}
                  y={JY - LANE + 3}
                  width="5"
                  height={LANE * 2 - 6}
                  fill={walkNow ? INK.line : 'none'}
                  stroke={INK.line}
                  strokeWidth={PEN.hair}
                  opacity={walkNow ? 0.85 : 1}
                />
              ))}
              {walkNow && (
                <g>
                  <circle cx={ZEB_X + 20} cy={JY - LANE - 16} r="4" fill="none" stroke={INK.line} strokeWidth={PEN.thin} />
                  <path
                    d={`M${ZEB_X + 20} ${JY - LANE - 12} v9 M${ZEB_X + 16} ${JY - LANE - 8} h8 M${ZEB_X + 20} ${JY - LANE - 3} l-4 6 M${ZEB_X + 20} ${JY - LANE - 3} l4 6`}
                    stroke={INK.line}
                    strokeWidth={PEN.thin}
                    fill="none"
                  />
                </g>
              )}
            </g>
          )}

          {/* queued vehicles, standing back from each stop line */}
          {Array.from({ length: nsCars }, (_, i) => (
            <CarNS key={`qns-${i}`} y={NS_STOP - 6 - CAR - i * PITCH} />
          ))}
          {Array.from({ length: ewCars }, (_, i) => (
            <CarEW key={`qew-${i}`} x={EW_STOP - 6 - CAR - i * PITCH} />
          ))}

          {/* the movement running right now */}
          {nsGo && (
            <g aria-hidden>
              <line x1={JX} y1={JY - LANE + 4} x2={JX} y2={258} stroke={INK.line} strokeWidth={PEN.dim} />
              <Arrowhead x={JX} y={266} ux={0} uy={1} size={10} fill={INK.line} />
            </g>
          )}
          {ewGo && (
            <g aria-hidden>
              <line x1={JX - LANE + 4} y1={JY} x2={452} y2={JY} stroke={INK.line} strokeWidth={PEN.dim} />
              <Arrowhead x={460} y={JY} ux={1} uy={0} size={10} fill={INK.line} />
            </g>
          )}

          <SignalHead x={250} y={140} vertical mark="a" running={running} go={nsGo} />
          <SignalHead x={236} y={226} vertical={false} mark="b" running={running} go={ewGo} />

          {/* what arrives, on leaders */}
          <Leader x={JX} y={40} toX={380} toY={34} />
          <text x={384} y={38} className={LETTER} style={{ letterSpacing: TRACK.normal }} fontSize="10" fill={INK.soft}>
            north approach, {round.ns}/min
          </text>
          <Leader x={90} y={JY + LANE} toX={60} toY={258} />
          <text x={64} y={262} className={LETTER} style={{ letterSpacing: TRACK.normal }} fontSize="10" fill={INK.soft}>
            west approach, {round.ew}/min
          </text>

          {/* ---------- the stage key ---------- */}
          {showStages &&
            stages.map((s, i) => (
              <StageKey key={s.kind} x={580} y={30 + i * 70} kind={s.kind} name={s.name} detail={s.detail} live={s.live} />
            ))}

          {/* ---------- the timing band ---------- */}
          <SnapGrid x0={BAND_X} y0={BAND_Y} x1={BAND_X + BAND_W} y1={BAND_Y + BAND_H} step={STEP} major={5} />

          {[
            // The block is lettered with the stage it is; the dimension under it
            // carries the seconds, the way a drawing splits naming from sizing.
            { key: 'ns', from: 0, to: greenNS, fill: 'url(#tr-hatch-ns)', label: 'stage 1 north-south' },
            { key: 'ew', from: greenNS, to: greenNS + greenEW, fill: 'url(#tr-hatch-ew)', label: 'stage 2 east-west' },
            { key: 'walk', from: greenNS + greenEW, to: greenNS + greenEW + round.ped, fill: 'url(#tr-hatch-walk)', label: 'walk' },
            { key: 'lost', from: greenNS + greenEW + round.ped, to: CYCLE, fill: 'url(#tr-hatch-lost)', label: 'lost' },
          ]
            .filter((b) => b.to > b.from)
            .map((b) => {
              const x = tx(b.from)
              const w = (b.to - b.from) * PX_PER_S
              return (
                <g key={b.key} aria-hidden>
                  <rect x={x} y={BAND_Y} width={w} height={BAND_H} fill={INK.paper} opacity="0.9" />
                  <rect x={x} y={BAND_Y} width={w} height={BAND_H} fill={b.fill} stroke={INK.line} strokeWidth={PEN.thin} />
                  {w > b.label.length * 6 + 12 && (
                    <text
                      x={x + w / 2}
                      y={BAND_Y + BAND_H / 2 + 3.5}
                      textAnchor="middle"
                      className={LETTER}
                      style={{ letterSpacing: TRACK.normal }}
                      fontSize="10"
                      fontWeight="700"
                      fill={INK.line}
                    >
                      {b.label}
                    </text>
                  )}
                </g>
              )
            })}

          <text x={BAND_X} y={286} className={LETTER} style={{ letterSpacing: TRACK.wide }} fontSize="10" fill={INK.soft}>
            stage timing, one cycle
          </text>

          {/* the changeover you are booking, and where the keyboard is pointing */}
          {board.active && Math.abs(board.cursor.x - markX) > 1 && (
            <line
              x1={board.cursor.x}
              y1={BAND_Y - 8}
              x2={board.cursor.x}
              y2={BAND_Y + BAND_H + 8}
              stroke={INK.check}
              strokeWidth={PEN.dim}
              strokeDasharray="6 5"
              className="pointer-events-none"
            />
          )}
          <g aria-hidden className="pointer-events-none">
            <line x1={markX} y1={BAND_Y - 12} x2={markX} y2={BAND_Y + BAND_H + 12} stroke={INK.line} strokeWidth={PEN.member} />
            <path d={`M${markX - 6} ${BAND_Y - 12} H${markX + 6} L${markX} ${BAND_Y - 2} Z`} fill={INK.line} />
          </g>

          {/* where the cycle has got to */}
          {running && (
            <g aria-hidden className="pointer-events-none">
              <line x1={tx(Math.min(CYCLE, simT))} y1={BAND_Y - 6} x2={tx(Math.min(CYCLE, simT))} y2={BAND_Y + BAND_H + 6} stroke={INK.check} strokeWidth={PEN.dim} />
              <circle cx={tx(Math.min(CYCLE, simT))} cy={BAND_Y - 8} r="3.5" fill={INK.check} />
            </g>
          )}

          {/* drag anywhere on the band to move the changeover */}
          <rect
            x={BAND_X - 12}
            y={BAND_Y - 16}
            width={BAND_W + 24}
            height={BAND_H + 32}
            fill="transparent"
            onPointerDown={startSplit}
            onPointerMove={moveSplit}
            onPointerUp={endSplit}
            onPointerCancel={endSplit}
            className={running ? undefined : 'cursor-ew-resize'}
          />

          <DimString x1={tx(0)} y1={BAND_Y + BAND_H} x2={tx(greenNS)} y2={BAND_Y + BAND_H} offset={22} label={`ns green ${greenNS} s`} />
          <DimString x1={tx(greenNS)} y1={BAND_Y + BAND_H} x2={tx(greenNS + greenEW)} y2={BAND_Y + BAND_H} offset={22} label={`ew green ${greenEW} s`} />
          {tail > 0 && (
            <DimString x1={tx(greenNS + greenEW)} y1={BAND_Y + BAND_H} x2={tx(CYCLE)} y2={BAND_Y + BAND_H} offset={22} label={`walk + lost ${tail} s`} />
          )}
          <DimString x1={tx(0)} y1={BAND_Y + BAND_H} x2={tx(CYCLE)} y2={BAND_Y + BAND_H} offset={58} label={`cycle ${CYCLE} s`} />

          <ScaleBar x={BAND_X} y={420} pxPerUnit={PX_PER_S} units={10} unit="s" />

          {/* ---------- the verdict, drawn on the sheet ---------- */}
          {phase === 'failed' && !okNS && (
            <Redline
              x={JX}
              y={100}
              rx={30}
              ry={72}
              noteX={170}
              noteY={70}
              seed={`${runs}-ns`}
              rev={runs}
              note={['approach a backs up', `${round.ns} cars arrive, ${capNS.toFixed(0)} clear`, 'stage 1 needs more green']}
            />
          )}
          {phase === 'failed' && okNS && !okEW && (
            <Redline
              x={190}
              y={JY}
              rx={76}
              ry={26}
              noteX={350}
              noteY={258}
              seed={`${runs}-ew`}
              rev={runs}
              note={['approach b backs up', `${round.ew} cars arrive, ${capEW.toFixed(0)} clear`, 'stage 2 needs more green']}
            />
          )}
          {phase === 'passed' && (
            <ApprovalStamp
              x={445}
              y={130}
              lines={[`${round.ns + round.ew} cars a minute cleared`, `rev ${String(runs).padStart(2, '0')}, ${CYCLE} s cycle`]}
            />
          )}
          {phase === 'failed' && (
            <RevisionStamp x={445} y={130} lines={[`rev ${String(runs).padStart(2, '0')}`, 'see redline']} />
          )}

          {board.active && !running && <CursorMark x={board.cursor.x} y={CURSOR_Y} />}
        </svg>
      </DraftingSheet>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={run} disabled={phase === 'running'}>
          <Play className="h-5 w-5" fill="currentColor" />
          {phase === 'running' ? 'Running...' : 'Run the lights'}
        </Button>
        <Button variant="ghost" onClick={reset} disabled={phase === 'running'} aria-label="Reset the light timing">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={outcomeVisible ? { total: totalDelay, worst: worstDelay } : {}}
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
              ? `Total delay ${totalDelay} car-seconds, worst road ${worstDelay}. Try trading one against the other.`
              : 'Traffic flows. Nicely timed.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
