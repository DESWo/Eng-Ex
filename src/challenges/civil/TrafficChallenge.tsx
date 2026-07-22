import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { InsightToggle } from '@/components/level/InsightToggle'
import { Objective } from '@/components/level/Objective'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import { useAttempts } from '@/hooks/useAttempts'
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

  const [greenNS, setGreenNS] = useState(6)
  const [phase, setPhase] = useState<Phase>('idle')
  /** Where we are inside the running cycle, in cycle seconds (0..CYCLE). */
  const [simT, setSimT] = useState(0)
  const simQ = useRef({ ns: 0, ew: 0 })
  const simInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const att = useAttempts(lv.level.n === 1 ? null : 3, lv.level.n)
  const [showQueues, setShowQueues] = useState(true)
  const barRef = useRef<HTMLDivElement | null>(null)
  const draggingSplit = useRef(false)
  const completedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const greenEW = available - greenNS

  useEffect(() => {
    setGreenNS(6)
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
    setSimT(0)
    simQ.current = { ns: 0, ew: 0 }
    if (simInterval.current) clearInterval(simInterval.current)
    let t = 0
    let last = performance.now()
    simInterval.current = setInterval(() => {
      // Wall-clock time, so a janky tab cannot stretch the minute out.
      const now = performance.now()
      const dt = Math.min(0.4, (now - last) / 1000) * SIM_SPEED
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
    setPhase('idle')
    setSimT(0)
  }

  useEffect(() => () => {
    if (simInterval.current) clearInterval(simInterval.current)
  }, [])

  /* What the signals show right now, derived from where we are in the cycle. */
  const running = phase === 'running'
  const nsGo = running && simT < greenNS
  const ewGo = running && simT >= greenNS && simT < greenNS + greenEW
  const walkNow = running && simT >= greenNS + greenEW && round.ped > 0
  const qNS = running ? simQ.current.ns : 0
  const qEW = running ? simQ.current.ew : 0

  const won = phase === 'passed'

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {phase === 'passed' && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.queues ? <InsightToggle label="queues" on={showQueues} onChange={setShowQueues} /> : undefined}
      />

      <Objective
        goal={`Give both roads enough green to clear their traffic (NS needs ${round.ns}/min, EW ${round.ew}/min; a road clears ${CARS_PER_GREEN_SECOND} car per green second)`}
        status={`this split clears NS ${capNS.toFixed(0)}/min, EW ${capEW.toFixed(0)}/min`}
        attemptsLeft={att.left}
        met={phase === 'passed'}
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

      {/* Scene: the junction actually runs the cycle you set */}
      <div className="overflow-hidden rounded-2xl bg-emerald-100/70 dark:bg-emerald-950/40">
        <svg viewBox="0 0 800 300" className="w-full" role="img" aria-label="Intersection running the light cycle">
          {/* roads */}
          <rect x="0" y="200" width="800" height="64" className="fill-stone-500 dark:fill-stone-700" />
          <rect x="360" y="0" width="44" height="300" className="fill-stone-500 dark:fill-stone-700" />
          <line x1="0" y1="232" x2="352" y2="232" strokeDasharray="14 12" strokeWidth="3" className="stroke-amber-300/80" />
          <line x1="412" y1="232" x2="800" y2="232" strokeDasharray="14 12" strokeWidth="3" className="stroke-amber-300/80" />
          <line x1="382" y1="0" x2="382" y2="192" strokeDasharray="14 12" strokeWidth="3" className="stroke-amber-300/80" />

          {/* zebra crossing, striped while the walk phase is on */}
          {round.ped > 0 && (
            <g>
              {[0, 1, 2, 3, 4].map((i) => (
                <rect key={i} x={412 + i * 9} y="206" width="5" height="52" rx="2" className={walkNow ? 'fill-white' : 'fill-white/35'} />
              ))}
              {walkNow && (
                <motion.circle
                  r="7"
                  cx="434"
                  className="fill-amber-300"
                  initial={{ cy: 196 }}
                  animate={{ cy: 268 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                />
              )}
            </g>
          )}

          {/* signal heads: one facing each road, wired to the real cycle position */}
          <g>
            <rect x="330" y="150" width="22" height="44" rx="7" className="fill-stone-800 dark:fill-stone-900" />
            <circle cx="341" cy="163" r="7" className={running && !nsGo ? 'fill-rose-500' : 'fill-rose-900/40'} />
            <circle cx="341" cy="181" r="7" className={nsGo ? 'fill-emerald-400' : 'fill-emerald-900/40'} />
            <text x="341" y="142" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-300">NS</text>
          </g>
          <g>
            <rect x="415" y="150" width="44" height="22" rx="7" className="fill-stone-800 dark:fill-stone-900" />
            <circle cx="428" cy="161" r="7" className={running && !ewGo ? 'fill-rose-500' : 'fill-rose-900/40'} />
            <circle cx="446" cy="161" r="7" className={ewGo ? 'fill-emerald-400' : 'fill-emerald-900/40'} />
            <text x="470" y="166" fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-300">EW</text>
          </g>

          {/* queued cars: one rect per waiting car, stacked back from the stop line */}
          {Array.from({ length: Math.min(9, Math.round(running ? qNS : round.ns / 3)) }, (_, i) => (
            <rect key={`qns-${i}`} x="366" y={168 - i * 32} width="14" height="24" rx="4" className={i % 2 === 0 ? 'fill-rose-400' : 'fill-sky-400'} />
          ))}
          {Array.from({ length: Math.min(9, Math.round(running ? qEW : round.ew / 3)) }, (_, i) => (
            <rect key={`qew-${i}`} x={330 - i * 38} y="236" width="24" height="14" rx="4" className={i % 2 === 0 ? 'fill-amber-400' : 'fill-violet-400'} />
          ))}

          {/* cars streaming through while their light is green */}
          {nsGo && (
            <motion.rect
              key="flow-ns"
              x="384"
              width="14"
              height="24"
              rx="4"
              className="fill-sky-400"
              initial={{ y: 150 }}
              animate={{ y: 310 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            />
          )}
          {ewGo && (
            <motion.rect
              key="flow-ew"
              y="210"
              width="24"
              height="14"
              rx="4"
              className="fill-amber-400"
              initial={{ x: 330 }}
              animate={{ x: 820 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            />
          )}

          {/* cycle clock */}
          {running && (
            <g>
              <rect x="640" y="20" width="140" height="34" rx="10" className="fill-white/80 dark:fill-black/40" />
              <text x="710" y="42" textAnchor="middle" fontSize="15" fontWeight="700" className="fill-ink font-display tabular-nums dark:fill-stone-100">
                {Math.floor(simT)}s / {CYCLE}s
              </text>
            </g>
          )}
          <text x="415" y="30" fontSize="14" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-300">
            {round.ns}/min from the north
          </text>
          <text x="30" y="188" fontSize="14" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-300">
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
