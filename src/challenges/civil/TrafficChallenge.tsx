import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Slider } from '@/components/ui/Slider'
import type { ChallengeProps } from '@/lib/types'

/* ------------------- tuning knobs (edit freely) ------------------- */
const CYCLE = 60 // seconds in one full light cycle
const CARS_PER_GREEN_SECOND = 0.5 // cars that clear the light per green second

interface TrafficRound {
  label: string
  ns: number // cars arriving per minute from the north
  ew: number // cars arriving per minute from the west
  /** Seconds per minute reserved for people crossing on foot. */
  ped: number
}

/** Each win brings a new traffic pattern. */
const ROUNDS: TrafficRound[] = [
  { label: 'Morning rush from the suburbs', ns: 18, ew: 8, ped: 0 },
  { label: 'Evening rush heads home', ns: 7, ew: 21, ped: 0 },
  { label: 'Street fair Saturday', ns: 13, ew: 12, ped: 6 },
  { label: 'Stadium night plus a parade', ns: 16, ew: 6, ped: 14 },
]

type Phase = 'idle' | 'running' | 'passed' | 'failed'

/** One road's live report card. */
function RoadCard({
  name,
  arriving,
  clearing,
}: {
  name: string
  arriving: number
  clearing: number
}) {
  return (
    <div className="rounded-2xl border-2 border-stone-200 p-4 dark:border-white/10">
      <p className="font-display text-sm font-bold">{name}</p>
      <p className="mt-2 text-sm tabular-nums text-ink-soft dark:text-stone-300">
        <span className="font-bold">{arriving}</span> cars arrive each minute.
        <br />
        Its green time clears <span className="font-bold">{clearing}</span> each minute.
      </p>
    </div>
  )
}

export function TrafficChallenge({ onComplete }: ChallengeProps) {
  const [roundIndex, setRoundIndex] = useState(0)
  const round = ROUNDS[roundIndex % ROUNDS.length]
  const available = CYCLE - round.ped

  const [greenNS, setGreenNS] = useState(30)
  const [phase, setPhase] = useState<Phase>('idle')
  const completedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const greenEW = available - greenNS
  const capNS = greenNS * CARS_PER_GREEN_SECOND
  const capEW = greenEW * CARS_PER_GREEN_SECOND
  const okNS = capNS >= round.ns
  const okEW = capEW >= round.ew

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const run = () => {
    if (phase === 'running') return
    setPhase('running')
    timerRef.current = setTimeout(() => {
      if (okNS && okEW) {
        setPhase('passed')
        if (!completedRef.current) {
          completedRef.current = true
          onComplete()
        }
      } else {
        setPhase('failed')
      }
    }, 2300)
  }

  const nextRound = () => {
    const next = ROUNDS[(roundIndex + 1) % ROUNDS.length]
    setRoundIndex((i) => i + 1)
    setGreenNS(Math.round((CYCLE - next.ped) / 4) * 2)
    setPhase('idle')
  }

  const reset = () => {
    setGreenNS(30)
    setPhase('idle')
  }

  const carCount = (perMin: number) => Math.max(1, Math.min(7, Math.round(perMin / 3)))

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {phase === 'passed' && <Confetti />}

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <ol className="space-y-0.5 text-sm text-ink-soft dark:text-stone-400">
          <li>1. Cars pour in from two roads. The numbers show how many arrive each minute.</li>
          <li>2. A road only clears cars while its light is green: 1 car every 2 seconds.</li>
          <li>3. Split the minute of green time so BOTH roads keep up, then run the lights.</li>
        </ol>
        <div className="flex flex-col items-end gap-2">
          <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
          {round.ped > 0 && (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              Walkers take {round.ped}s of every minute
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

          {/* north-south queue (drives down) */}
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
          {/* east-west queue (drives right) */}
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

      {/* Live report cards. These update as you drag the slider. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <RoadCard name="North-South road" arriving={round.ns} clearing={capNS} />
        <RoadCard name="East-West road" arriving={round.ew} clearing={capEW} />
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-3 min-h-[2.5rem]">
        {phase === 'passed' && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
          >
            Green wave! Both queues melt away. Nobody honks today.
          </motion.p>
        )}
        {phase === 'failed' && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300"
          >
            {!okNS
              ? 'The northbound queue never cleared. Cars piled up faster than the light let them through.'
              : 'The westbound queue never cleared. Cars piled up faster than the light let them through.'}
          </motion.p>
        )}
      </div>

      {/* Controls */}
      <div className="mt-2 grid items-end gap-x-6 gap-y-4 sm:grid-cols-[1fr,auto]">
        <div>
          <Slider
            label="North-South green time"
            value={greenNS}
            min={10}
            max={available - 10}
            step={2}
            unit="s"
            onChange={(v) => {
              setGreenNS(v)
              setPhase('idle')
            }}
            disabled={phase === 'running'}
          />
          <div className="mt-1 flex h-3 w-full overflow-hidden rounded-full">
            <div className="accent-bg h-full transition-all duration-200" style={{ width: `${(greenNS / CYCLE) * 100}%` }} />
            <div className="h-full flex-1 bg-stone-300 dark:bg-white/15" />
            {round.ped > 0 && (
              <div className="h-full bg-amber-400" style={{ width: `${(round.ped / CYCLE) * 100}%` }} />
            )}
          </div>
          <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-ink-soft dark:text-stone-400">
            <span>North-South {greenNS}s</span>
            <span>East-West {greenEW}s</span>
            {round.ped > 0 && <span className="text-amber-600 dark:text-amber-400">Walkers {round.ped}s</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {phase === 'passed' ? (
            <Button variant="accent" size="lg" onClick={nextRound}>
              Next scenario
              <ArrowRight className="h-5 w-5" />
            </Button>
          ) : (
            <Button variant="accent" size="lg" onClick={run} disabled={phase === 'running'}>
              <Play className="h-5 w-5" fill="currentColor" />
              {phase === 'running' ? 'Running...' : 'Run the lights'}
            </Button>
          )}
          <Button variant="ghost" onClick={reset} disabled={phase === 'running'} aria-label="Reset the light timing">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>
    </Card>
  )
}
