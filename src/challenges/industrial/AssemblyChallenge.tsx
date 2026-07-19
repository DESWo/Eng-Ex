import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Minus, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import type { ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const MAX_PER_STATION = 4

interface Station {
  id: string
  name: string
  /** Seconds for one worker to finish one item. More workers split this. */
  baseTime: number
}

interface AssemblyRound {
  label: string
  stations: Station[]
  workers: number // total workers to place
  targetRate: number // items per minute you must reach
}

/** Each win is a bigger line with a tighter worker budget. */
const ROUNDS: AssemblyRound[] = [
  {
    label: 'Toy car factory',
    workers: 8,
    targetRate: 5,
    stations: [
      { id: 'body', name: 'Mold body', baseTime: 16 },
      { id: 'wheels', name: 'Add wheels', baseTime: 24 },
      { id: 'paint', name: 'Paint', baseTime: 16 },
      { id: 'box', name: 'Box it', baseTime: 8 },
    ],
  },
  {
    label: 'Phone assembly',
    workers: 10,
    targetRate: 6,
    stations: [
      { id: 'screen', name: 'Fit screen', baseTime: 18 },
      { id: 'board', name: 'Solder board', baseTime: 24 },
      { id: 'battery', name: 'Battery', baseTime: 12 },
      { id: 'test', name: 'Test', baseTime: 16 },
      { id: 'pack', name: 'Package', baseTime: 8 },
    ],
  },
]

export function AssemblyChallenge({ onComplete }: ChallengeProps) {
  const [roundIndex, setRoundIndex] = useState(0)
  const round = ROUNDS[roundIndex % ROUNDS.length]

  const [assigned, setAssigned] = useState<Record<string, number>>({})
  const [wonRound, setWonRound] = useState(false)
  const completedRef = useRef(false)

  const workersOn = (id: string) => assigned[id] ?? 1
  const used = round.stations.reduce((sum, s) => sum + workersOn(s.id), 0)
  const spare = round.workers - used

  // A station's time is its base time split across its workers.
  const timeOf = (s: Station) => s.baseTime / workersOn(s.id)
  // The slowest station is the bottleneck; it sets the whole line's pace.
  const cycleTime = Math.max(...round.stations.map(timeOf))
  const bottleneck = round.stations.reduce((a, b) => (timeOf(b) > timeOf(a) ? b : a))
  const rate = Math.round((60 / cycleTime) * 10) / 10
  const win = rate >= round.targetRate && spare >= 0

  useEffect(() => {
    if (win && !wonRound) {
      setWonRound(true)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }
  }, [win, wonRound, onComplete])

  const change = (id: string, delta: number) => {
    setAssigned((prev) => {
      const current = prev[id] ?? 1
      const next = Math.max(1, Math.min(MAX_PER_STATION, current + delta))
      if (delta > 0 && spare <= 0) return prev // out of workers
      return { ...prev, [id]: next }
    })
  }

  const nextRound = () => {
    setRoundIndex((i) => i + 1)
    setAssigned({})
    setWonRound(false)
  }

  const reset = () => {
    setAssigned({})
    setWonRound(false)
  }

  const maxTime = Math.max(...round.stations.map((s) => s.baseTime))

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <ol className="space-y-0.5 text-sm text-ink-soft dark:text-stone-400">
          <li>1. Every item moves down the line one station at a time.</li>
          <li>2. Each worker you add to a station makes that station faster.</li>
          <li>3. Beat the target rate with the workers you have. Watch where things pile up.</li>
        </ol>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
          {round.label} · aim for {round.targetRate}/min
        </Badge>
      </div>

      {/* The line */}
      <div className="overflow-x-auto rounded-2xl bg-stone-100/80 p-4 dark:bg-white/5">
        <div className="flex min-w-max items-stretch gap-2">
          {round.stations.map((s, i) => {
            const time = timeOf(s)
            const isBottleneck = s.id === bottleneck.id
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-32 rounded-2xl border-2 p-3 transition-colors duration-200',
                    isBottleneck
                      ? 'border-rose-400 bg-rose-50 dark:border-rose-500/50 dark:bg-rose-500/10'
                      : 'border-stone-200 bg-white dark:border-white/10 dark:bg-night-panel',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-display text-sm font-bold">{s.name}</p>
                    {isBottleneck && <span className="text-xs font-bold text-rose-500">slow</span>}
                  </div>
                  {/* time bar */}
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
                    <motion.div
                      className={cn('h-full rounded-full', isBottleneck ? 'bg-rose-500' : 'accent-bg')}
                      animate={{ width: `${(time / maxTime) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-ink-soft dark:text-stone-400">{time.toFixed(1)}s each</p>

                  {/* worker stepper */}
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => change(s.id, -1)}
                      disabled={workersOn(s.id) <= 1}
                      aria-label={`Remove worker from ${s.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-stone-200 transition-colors hover:border-stone-300 disabled:opacity-30 dark:border-white/10"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="flex items-center gap-1 font-display text-sm font-bold tabular-nums">
                      {workersOn(s.id)}
                      <span className="text-xs font-normal text-ink-soft dark:text-stone-400">
                        {workersOn(s.id) === 1 ? 'worker' : 'workers'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => change(s.id, 1)}
                      disabled={spare <= 0 || workersOn(s.id) >= MAX_PER_STATION}
                      aria-label={`Add worker to ${s.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-stone-200 transition-colors hover:border-stone-300 disabled:opacity-30 dark:border-white/10"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {i < round.stations.length - 1 && (
                  <ArrowRight className="h-5 w-5 shrink-0 text-stone-400 dark:text-stone-500" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Meter
          label="Output rate"
          display={`${rate} / min (need ${round.targetRate})`}
          fraction={rate / (round.targetRate * 1.3)}
          markerFraction={round.targetRate / (round.targetRate * 1.3)}
          barClass={win ? 'bg-emerald-500' : 'bg-amber-400'}
        />
        <div className="flex items-center gap-3">
          <Badge className={cn('px-4 py-1.5 text-sm', spare === 0 ? 'accent-soft accent-text' : '')}>
            Workers left: {spare} / {round.workers}
          </Badge>
        </div>
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-3 min-h-[2.5rem]">
        {wonRound ? (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            The line is humming! You hit {rate}/min by feeding the bottleneck.
          </motion.p>
        ) : (
          <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-300">
            Right now the line makes {rate}/min. A line can only move as fast as its slowest station.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {wonRound && (
          <Button variant="accent" onClick={nextRound}>
            Next factory
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" onClick={reset} aria-label="Reset the line">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>
    </Card>
  )
}
