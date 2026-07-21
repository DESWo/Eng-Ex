import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Minus, Plus, Package, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import { InsightToggle } from '@/components/level/InsightToggle'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const MAX_PER_STATION = 4

interface Station {
  id: string
  name: string
  /** Seconds for one worker to finish one item. More workers split this. */
  baseTime: number
}

interface AssemblySetup {
  label: string
  stations: Station[]
  workers: number
  targetRate: number
  /** Level 4 on: work-in-progress piles are drawn between stations. */
  wip: boolean
  brief: string
}

const TOY: Station[] = [
  { id: 'body', name: 'Mold body', baseTime: 16 },
  { id: 'wheels', name: 'Add wheels', baseTime: 24 },
  { id: 'paint', name: 'Paint', baseTime: 16 },
  { id: 'box', name: 'Box it', baseTime: 8 },
]
const PHONE: Station[] = [
  { id: 'screen', name: 'Fit screen', baseTime: 18 },
  { id: 'board', name: 'Solder board', baseTime: 24 },
  { id: 'battery', name: 'Battery', baseTime: 12 },
  { id: 'test', name: 'Test', baseTime: 16 },
  { id: 'pack', name: 'Package', baseTime: 8 },
]

const LEVELS: ChallengeLevel<AssemblySetup>[] = [
  {
    n: 1,
    title: 'Staff the line',
    phase: 'play',
    concept: 'Workers speed a station up',
    teach: 'Run it like a kitchen-rush game: stations, hand-offs, and one station always drowning. Items move down the line one station at a time, and every worker you add to a station splits its work. Hit the target rate. There are plenty of people on shift today.',
    setup: { label: 'Toy car factory', stations: TOY.slice(0, 3), workers: 10, targetRate: 5, wip: false, brief: 'A short line with staff to spare. Get it up to speed.' },
  },
  {
    n: 2,
    title: 'The roster is fixed',
    phase: 'understand',
    concept: 'A worker budget',
    teach: 'A longer line and only eight people. Now a worker on one station is a worker missing from another, so where they stand matters as much as how many there are.',
    setup: { label: 'Toy car factory', stations: TOY, workers: 8, targetRate: 5, wip: false, brief: 'The full line, on the roster the factory can actually afford.' },
  },
  {
    n: 3,
    title: 'Feed the bottleneck',
    phase: 'understand',
    concept: 'The slowest station rules',
    teach: 'The line moves exactly as fast as its slowest station and not one item faster. Add people anywhere else and the rate does not move at all, which is the most important sentence in factory design.',
    setup: { label: 'Phone assembly', stations: PHONE, workers: 9, targetRate: 5, wip: false, brief: 'A five-station line with barely enough people. Only one placement pattern works.' },
  },
  {
    n: 4,
    title: 'See the piles',
    phase: 'analyze',
    concept: 'Work in progress',
    teach: 'Turn on the piles. Half-finished items stack up in front of any station slower than the one feeding it. You can now SEE the bottleneck instead of deducing it, exactly like walking the factory floor.',
    setup: { label: 'Phone assembly', stations: PHONE, workers: 10, targetRate: 5.5, wip: true, brief: 'The same line, with the queues drawn where they really form.' },
  },
  {
    n: 5,
    title: 'Balance the line',
    phase: 'optimize',
    concept: 'Idle hands cost money',
    teach: 'A fast line where three stations sit half-idle wastes wages. The best line is BALANCED: every station almost equally busy, nobody waiting. That beats raw speed.',
    setup: { label: 'Phone assembly', stations: PHONE, workers: 12, targetRate: 6, wip: true, brief: 'Hit the contract rate with a line the accountants will also love.' },
    metrics: [
      { id: 'workers', label: 'Workers used', goal: 'min', target: 10 },
      { id: 'util', label: 'Average busyness', goal: 'max', target: 80, unit: '%' },
      { id: 'rate', label: 'Output rate', goal: 'max', target: 6.5, unit: '/min' },
    ],
  },
]

export function AssemblyChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('assembly', LEVELS)
  const round = lv.level.setup

  const [assigned, setAssigned] = useState<Record<string, number>>({})
  const [wonRound, setWonRound] = useState(false)
  const [showWip, setShowWip] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    setAssigned({})
    setWonRound(false)
  }, [lv.level.n])

  const workersOn = (id: string) => assigned[id] ?? 1
  const used = round.stations.reduce((sum, s) => sum + workersOn(s.id), 0)
  const spare = round.workers - used

  // A station's time is its base time split across its workers.
  const timeOf = (s: Station) => s.baseTime / workersOn(s.id)
  // The slowest station is the bottleneck; it sets the whole line's pace.
  const cycleTime = Math.max(...round.stations.map(timeOf))
  const bottleneck = round.stations.reduce((a, b) => (timeOf(b) > timeOf(a) ? b : a))
  const rate = Math.round((60 / cycleTime) * 10) / 10
  // How busy the average station is: 100% means perfectly balanced.
  const utilization = Math.round(
    (round.stations.reduce((sum, st) => sum + timeOf(st) / cycleTime, 0) / round.stations.length) * 100,
  )
  const win = rate >= round.targetRate && spare >= 0

  useEffect(() => {
    if (!win || wonRound) return
    const timer = setTimeout(() => {
      setWonRound(true)
      lv.clearLevel(lv.level.metrics ? { workers: used, util: utilization, rate } : undefined)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win, wonRound, used, utilization, rate])

  const change = (id: string, delta: number) => {
    setAssigned((prev) => {
      const current = prev[id] ?? 1
      const next = Math.max(1, Math.min(MAX_PER_STATION, current + delta))
      if (delta > 0 && spare <= 0) return prev // out of workers
      return { ...prev, [id]: next }
    })
  }

  const reset = () => {
    setAssigned({})
    setWonRound(false)
  }

  const maxTime = Math.max(...round.stations.map((s) => s.baseTime))

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.wip ? <InsightToggle label="piles" on={showWip} onChange={setShowWip} /> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
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
                  <div className="flex flex-col items-center gap-1">
                    <ArrowRight className="h-5 w-5 shrink-0 text-stone-400 dark:text-stone-500" />
                    {round.wip && showWip && (() => {
                      // Items pile up where a slow station follows a faster one.
                      const nextStation = round.stations[i + 1]
                      const pile = Math.max(
                        0,
                        Math.min(5, Math.round((timeOf(nextStation) - time) / 3)),
                      )
                      return pile > 0 ? (
                        <span className="flex flex-col-reverse items-center" aria-label={`${pile} items waiting`}>
                          {Array.from({ length: pile }, (_, k) => (
                            <Package key={k} className="h-4 w-4 -mt-1 text-amber-500" />
                          ))}
                        </span>
                      ) : null
                    })()}
                  </div>
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
        <Button variant="ghost" onClick={reset} aria-label="Reset the line">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Busyness {utilization}%</Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ workers: used, util: utilization, rate }}
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
              ? `${rate}/min with ${used} workers at ${utilization}% busy. Balance it tighter.`
              : 'The line is humming.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
