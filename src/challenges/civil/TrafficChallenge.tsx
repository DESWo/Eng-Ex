import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { InsightToggle } from '@/components/level/InsightToggle'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const CYCLE = 60 // seconds in one full light cycle
const CARS_PER_GREEN_SECOND = 0.5 // cars that clear the light per green second
const LOST_PER_PHASE = 4 // amber + all-red clearance wasted at every phase change

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
    setup: { label: 'A quiet morning', ns: 10, ew: 7, ped: 0, lostTime: false, queues: false, brief: 'Light traffic from two directions. Give each road enough green and everyone gets through.' },
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
    teach: 'Delay grows with the square of the red time, so favouring the busy road cuts the total wait but leaves the quiet road stuck for ages. Balance it and the totals rise but nobody is stranded. There is no split that wins both.',
    setup: { label: 'Rush hour', ns: 12, ew: 6, ped: 4, lostTime: true, queues: true, brief: 'Sign off the timing plan. Keep the average wait down without leaving one road stranded.' },
    metrics: [
      { id: 'total', label: 'Total delay', goal: 'min', target: 197 },
      { id: 'worst', label: 'Worst-road delay', goal: 'min', target: 108 },
    ],
  },
]

type Phase = 'idle' | 'running' | 'passed' | 'failed'

/** One road's live report card. */
function RoadCard({
  name,
  arriving,
  clearing,
  queue,
  showQueue,
}: {
  name: string
  arriving: number
  clearing: number
  queue: number
  showQueue: boolean
}) {
  const ok = clearing >= arriving
  return (
    <div className={cn('rounded-2xl border-2 p-4', ok ? 'border-stone-200 dark:border-white/10' : 'border-rose-300 dark:border-rose-500/40')}>
      <p className="font-display text-sm font-bold">{name}</p>
      <p className="mt-2 text-sm tabular-nums text-ink-soft dark:text-stone-300">
        <span className="font-bold">{arriving}</span> cars arrive each minute.
        <br />
        Its green clears <span className={cn('font-bold', ok ? '' : 'text-rose-600 dark:text-rose-400')}>{clearing.toFixed(0)}</span> each minute.
      </p>
      {showQueue && (
        <div className="mt-2">
          <div className="h-3 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
            <div
              className={cn('h-full rounded-full', queue > 0 ? 'bg-rose-500' : 'bg-emerald-500')}
              style={{ width: `${Math.min(100, (queue / 12) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs font-semibold text-ink-soft dark:text-stone-400">
            {queue > 0 ? `${queue.toFixed(0)} cars still waiting each minute` : 'queue stays clear'}
          </p>
        </div>
      )}
    </div>
  )
}

export function TrafficChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('traffic', LEVELS)
  const round = lv.level.setup

  const phases = 2 + (round.ped > 0 ? 1 : 0)
  const lost = round.lostTime ? LOST_PER_PHASE * phases : 0
  const available = CYCLE - round.ped - lost

  const [greenNS, setGreenNS] = useState(Math.round(available / 2))
  const [phase, setPhase] = useState<Phase>('idle')
  const [showQueues, setShowQueues] = useState(true)
  const barRef = useRef<HTMLDivElement | null>(null)
  const draggingSplit = useRef(false)
  const completedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const greenEW = available - greenNS

  useEffect(() => {
    setGreenNS(Math.round(available / 2))
    setPhase('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lv.level.n])

  const applySplit = (clientX: number) => {
    const el = barRef.current
    if (!el || phase === 'running') return
    const rect = el.getBoundingClientRect()
    const seconds = ((clientX - rect.left) / rect.width) * CYCLE
    const snapped = Math.round(seconds / 2) * 2
    setGreenNS(Math.max(6, Math.min(available - 6, snapped)))
    setPhase('idle')
  }
  const startSplit = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phase === 'running') return
    draggingSplit.current = true
    barRef.current?.setPointerCapture(e.pointerId)
    applySplit(e.clientX)
  }
  const moveSplit = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingSplit.current) applySplit(e.clientX)
  }
  const endSplit = () => {
    draggingSplit.current = false
  }
  const nudgeSplit = (e: React.KeyboardEvent) => {
    if (phase === 'running') return
    const step = e.shiftKey ? 6 : 2
    if (e.key === 'ArrowLeft') setGreenNS((v) => Math.max(6, v - step))
    else if (e.key === 'ArrowRight') setGreenNS((v) => Math.min(available - 6, v + step))
    else return
    e.preventDefault()
    setPhase('idle')
  }

  const capNS = greenNS * CARS_PER_GREEN_SECOND
  const capEW = greenEW * CARS_PER_GREEN_SECOND
  const okNS = capNS >= round.ns
  const okEW = capEW >= round.ew
  const queueNS = Math.max(0, round.ns - capNS)
  const queueEW = Math.max(0, round.ew - capEW)

  // Delay grows with the square of a road's red time (a standard result).
  const redNS = CYCLE - greenNS
  const redEW = CYCLE - greenEW
  const delayNS = (round.ns * redNS * redNS) / (2 * CYCLE)
  const delayEW = (round.ew * redEW * redEW) / (2 * CYCLE)
  const totalDelay = Math.round(delayNS + delayEW)
  const worstDelay = Math.round(Math.max(delayNS, delayEW))

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const run = () => {
    if (phase === 'running') return
    setPhase('running')
    timerRef.current = setTimeout(() => {
      if (okNS && okEW) {
        setPhase('passed')
        lv.clearLevel(lv.level.metrics ? { total: totalDelay, worst: worstDelay } : undefined)
        if (!completedRef.current) {
          completedRef.current = true
          onComplete()
        }
      } else {
        setPhase('failed')
      }
    }, 2300)
  }

  const reset = () => {
    setGreenNS(Math.round(available / 2))
    setPhase('idle')
  }

  const won = phase === 'passed'
  const carCount = (perMin: number) => Math.max(1, Math.min(7, Math.round(perMin / 3)))

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {phase === 'passed' && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.queues ? <InsightToggle label="queues" on={showQueues} onChange={setShowQueues} /> : undefined}
      />

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
        <div className="flex flex-col items-end gap-2">
          <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
          {round.ped > 0 && (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              Walkers take {round.ped}s{round.lostTime ? `, changes lose ${lost}s` : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Scene: a bird's eye intersection */}
      <div className="overflow-hidden rounded-2xl bg-emerald-100/70 dark:bg-emerald-950/40">
        <svg viewBox="0 0 800 280" className="w-full" role="img" aria-label="Intersection scene">
          <rect x="0" y="190" width="800" height="64" className="fill-stone-500 dark:fill-stone-700" />
          <rect x="360" y="0" width="44" height="280" className="fill-stone-500 dark:fill-stone-700" />
          <line x1="0" y1="222" x2="352" y2="222" strokeDasharray="14 12" strokeWidth="3" className="stroke-amber-300/80" />
          <line x1="412" y1="222" x2="800" y2="222" strokeDasharray="14 12" strokeWidth="3" className="stroke-amber-300/80" />
          <line x1="382" y1="0" x2="382" y2="182" strokeDasharray="14 12" strokeWidth="3" className="stroke-amber-300/80" />

          {Array.from({ length: carCount(round.ns) }, (_, i) => (
            <motion.rect
              key={`ns-${i}`}
              x="372"
              y={20 + i * 32}
              width="20"
              height="26"
              rx="5"
              className={i % 2 === 0 ? 'fill-rose-400' : 'fill-sky-400'}
              animate={phase === 'running' && okNS ? { y: 120 } : { y: 0 }}
              transition={{ duration: 1.9, ease: 'easeIn', delay: i * 0.09 }}
            />
          ))}
          {Array.from({ length: carCount(round.ew) }, (_, i) => (
            <motion.rect
              key={`ew-${i}`}
              x={30 + i * 40}
              y="212"
              width="26"
              height="20"
              rx="5"
              className={i % 2 === 0 ? 'fill-amber-400' : 'fill-violet-400'}
              animate={phase === 'running' && okEW ? { x: 140 } : { x: 0 }}
              transition={{ duration: 1.9, ease: 'easeIn', delay: i * 0.09 }}
            />
          ))}

          <text x="415" y="30" fontSize="14" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-300">
            {round.ns}/min from the north
          </text>
          <text x="30" y="180" fontSize="14" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-300">
            {round.ew}/min from the west
          </text>
        </svg>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <RoadCard name="North-South road" arriving={round.ns} clearing={capNS} queue={queueNS} showQueue={round.queues && showQueues} />
        <RoadCard name="East-West road" arriving={round.ew} clearing={capEW} queue={queueEW} showQueue={round.queues && showQueues} />
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-3 min-h-[2.5rem]">
        {phase === 'passed' && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            Green wave! Both queues melt away{lv.level.metrics ? `, total delay ${totalDelay}.` : '. Nobody honks today.'}
          </motion.p>
        )}
        {phase === 'failed' && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            {!okNS
              ? 'The northbound queue never cleared. It needs more green than it is getting.'
              : 'The westbound queue never cleared. It needs more green than it is getting.'}
          </motion.p>
        )}
      </div>

      {/* Controls: the cycle bar IS the control. Drag the split between the roads. */}
      <div className="mt-2 grid items-end gap-x-6 gap-y-4 sm:grid-cols-[1fr,auto]">
        <div>
          <p className="mb-2 font-display text-sm font-semibold">
            One {CYCLE} second cycle. Drag the divider to share it out.
          </p>
          <div
            ref={barRef}
            onPointerDown={startSplit}
            onPointerMove={moveSplit}
            onPointerUp={endSplit}
            className="relative flex h-9 w-full cursor-ew-resize overflow-hidden rounded-full select-none"
            style={{ touchAction: 'none' }}
          >
            <div className="accent-bg flex h-full items-center justify-center font-display text-xs font-bold text-white" style={{ width: `${(greenNS / CYCLE) * 100}%` }}>
              {greenNS >= 14 ? `NS ${greenNS}s` : ''}
            </div>
            <div className="flex h-full items-center justify-center bg-stone-300 font-display text-xs font-bold text-ink-soft dark:bg-white/15 dark:text-stone-300" style={{ width: `${(greenEW / CYCLE) * 100}%` }}>
              {greenEW >= 14 ? `EW ${greenEW}s` : ''}
            </div>
            {(round.ped > 0 || lost > 0) && (
              <div className="flex h-full flex-1 items-center justify-center bg-amber-400 font-display text-xs font-bold text-amber-950">
                {round.ped + lost >= 12 ? `Walk + lost ${round.ped + lost}s` : ''}
              </div>
            )}
            <div
              role="slider"
              tabIndex={0}
              aria-label="Split between north-south and east-west green time"
              aria-valuenow={greenNS}
              aria-valuemin={6}
              aria-valuemax={available - 6}
              aria-valuetext={`${greenNS} seconds north-south, ${greenEW} east-west`}
              onKeyDown={nudgeSplit}
              className="absolute top-0 h-full w-3 -translate-x-1/2 rounded-full bg-white shadow-clay outline-none ring-ink/20 focus-visible:ring-2 dark:bg-stone-900"
              style={{ left: `${(greenNS / CYCLE) * 100}%` }}
            />
          </div>
          {(round.ped > 0 || lost > 0) && (
            <p className="mt-1.5 text-xs text-ink-soft dark:text-stone-400">
              The amber block is walk time plus the seconds lost at each change. It comes off the top before the roads split what is left.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="accent" size="lg" onClick={run} disabled={phase === 'running'}>
            <Play className="h-5 w-5" fill="currentColor" />
            {phase === 'running' ? 'Running...' : 'Run the lights'}
          </Button>
          <Button variant="ghost" onClick={reset} disabled={phase === 'running'} aria-label="Reset the light timing">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ total: totalDelay, worst: worstDelay }}
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
              ? `Total delay ${totalDelay}, worst road ${worstDelay}. Try trading one against the other.`
              : 'Traffic flows. Nicely timed.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
