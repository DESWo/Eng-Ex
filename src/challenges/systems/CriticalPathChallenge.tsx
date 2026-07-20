import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
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
/** Two chains of work that split after the design and rejoin at testing. */
const TASKS = [
  { id: 'design', name: 'Design', days: 3, after: [] as string[], maxCrash: 1, perDay: 8 },
  { id: 'frame', name: 'Build frame', days: 6, after: ['design'], maxCrash: 3, perDay: 5 },
  { id: 'order', name: 'Order parts', days: 2, after: ['design'], maxCrash: 1, perDay: 3 },
  { id: 'assemble', name: 'Assemble', days: 5, after: ['frame'], maxCrash: 3, perDay: 6 },
  { id: 'software', name: 'Software', days: 3, after: ['order'], maxCrash: 2, perDay: 3 },
  { id: 'test', name: 'Test', days: 2, after: ['assemble', 'software'], maxCrash: 1, perDay: 10 },
]

interface Schedule {
  finish: number
  cost: number
  /** Per task: when it can start, and how many days it could slip without hurting. */
  rows: { id: string; start: number; days: number; slack: number; critical: boolean }[]
  worstSqueeze: number
}

/**
 * Walk the tasks forwards to find the earliest each can start, then backwards
 * to find how much slack each one has. Anything with zero slack is on the
 * critical path, and only those tasks decide when the project finishes.
 */
function schedule(crash: Record<string, number>): Schedule {
  const dur: Record<string, number> = {}
  for (const t of TASKS) dur[t.id] = t.days - (crash[t.id] ?? 0)

  const start: Record<string, number> = {}
  const end: Record<string, number> = {}
  for (const t of TASKS) {
    start[t.id] = t.after.reduce((m, p) => Math.max(m, end[p] ?? 0), 0)
    end[t.id] = start[t.id] + dur[t.id]
  }
  const finish = Math.max(...TASKS.map((t) => end[t.id]))

  // Latest each task could finish without pushing the project out.
  const latestEnd: Record<string, number> = {}
  for (let i = TASKS.length - 1; i >= 0; i--) {
    const t = TASKS[i]
    const successors = TASKS.filter((s) => s.after.includes(t.id))
    latestEnd[t.id] = successors.length
      ? Math.min(...successors.map((s) => (latestEnd[s.id] ?? finish) - dur[s.id]))
      : finish
  }

  const rows = TASKS.map((t) => {
    const slack = latestEnd[t.id] - end[t.id]
    return { id: t.id, start: start[t.id], days: dur[t.id], slack, critical: slack <= 0 }
  })

  const cost = TASKS.reduce((s, t) => s + (crash[t.id] ?? 0) * t.perDay, 0)
  const worstSqueeze = Math.max(0, ...TASKS.map((t) => ((crash[t.id] ?? 0) / t.days) * 100))
  return { finish, cost, rows, worstSqueeze }
}

interface PathSetup {
  /** Days the project must finish within. */
  deadline: number
  /** Money available to speed things up, or null. */
  budget: number | null
  /** Level 4 on: the slack readout is available. */
  readout: boolean
  brief: string
}

const LEVELS: ChallengeLevel<PathSetup>[] = [
  {
    n: 1,
    title: 'Pull the date in',
    phase: 'play',
    concept: 'Paying to go faster',
    teach: 'Put more people on a task and it finishes sooner, for a price. Shorten something until the project lands inside the deadline.',
    setup: { deadline: 14, budget: null, readout: false, brief: 'A robot build is running two days late before it has even started.' },
  },
  {
    n: 2,
    title: 'Overtime costs money',
    phase: 'understand',
    concept: 'A crash budget',
    teach: 'Speeding a task up means overtime, extra hires, or rush shipping. There is only so much of that to go round, so it has to land where it counts.',
    setup: { deadline: 13, budget: 20, readout: false, brief: 'The same build, with finance watching the overtime column.' },
  },
  {
    n: 3,
    title: 'The path that matters',
    phase: 'understand',
    concept: 'Slack does nothing',
    teach: 'Some tasks are waiting around anyway. Speeding those up feels productive and moves the finish date by exactly zero days, because a different chain of work is what the project is really waiting on.',
    setup: { deadline: 10, budget: 40, readout: false, brief: 'A hard deadline. Money spent on the wrong task here buys nothing at all.' },
  },
  {
    n: 4,
    title: 'See the slack',
    phase: 'analyze',
    concept: 'Critical and spare',
    teach: 'Turn on the readout. Tasks with slack have room to slip without hurting anyone. The ones with none are the critical path, and shortening the project means shortening those.',
    setup: { deadline: 10, budget: 45, readout: true, brief: 'The same plan with slack and the critical path marked.' },
  },
  {
    n: 5,
    title: 'Commit to a date',
    phase: 'optimize',
    concept: 'Fast, cheap, or safe',
    teach: 'The cheapest days to buy come from squeezing one task hard, but a task compressed to its limit is the one most likely to blow up. Spreading the squeeze is safer and dearer.',
    setup: { deadline: 12, budget: null, readout: true, brief: 'Give the customer a date you can actually hit.' },
    metrics: [
      { id: 'days', label: 'Project length', goal: 'min', target: 10, unit: ' days' },
      { id: 'cost', label: 'Overtime spend', goal: 'min', target: 35 },
      { id: 'squeeze', label: 'Worst compression', goal: 'min', target: 60, unit: '%' },
    ],
  },
]

const DAY_PX = 34

export function CriticalPathChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('critical-path', LEVELS)
  const setup = lv.level.setup

  // Nothing shortened, so every level opens past its deadline.
  const [crash, setCrash] = useState<Record<string, number>>({})
  const [won, setWon] = useState(false)
  const [showReadout, setShowReadout] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    setCrash({})
    setWon(false)
  }, [lv.level.n])

  const s = schedule(crash)
  const overBudget = setup.budget !== null && s.cost > setup.budget
  const solved = s.finish <= setup.deadline && !overBudget

  // Money spent on tasks that were never holding the project up.
  const wastedSpend = TASKS.reduce((sum, t) => {
    const row = s.rows.find((r) => r.id === t.id)!
    return sum + (row.slack > 0 ? (crash[t.id] ?? 0) * t.perDay : 0)
  }, 0)

  useEffect(() => {
    if (!solved || won) return
    const timer = setTimeout(() => {
      setWon(true)
      lv.clearLevel(
        lv.level.metrics ? { days: s.finish, cost: s.cost, squeeze: s.worstSqueeze } : undefined,
      )
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, 650)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, won, s.finish, s.cost, s.worstSqueeze])

  const reset = () => {
    setCrash({})
    setWon(false)
  }

  const bump = (id: string, delta: number) => {
    const task = TASKS.find((t) => t.id === id)!
    setCrash((prev) => ({
      ...prev,
      [id]: Math.max(0, Math.min(task.maxCrash, (prev[id] ?? 0) + delta)),
    }))
  }

  const chartW = Math.max(...s.rows.map((r) => r.start + r.days)) * DAY_PX + 60

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.readout ? <InsightToggle label="slack" on={showReadout} onChange={setShowReadout} /> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">Due in {setup.deadline} days</Badge>
      </div>

      {/* Gantt chart */}
      <div className="overflow-x-auto rounded-2xl bg-stone-100/80 p-4 dark:bg-white/5">
        <svg viewBox={`0 0 ${chartW} ${TASKS.length * 34 + 34}`} style={{ minWidth: 520 }} className="w-full" role="img" aria-label="Project schedule">
          {/* deadline marker */}
          <line
            x1={60 + setup.deadline * DAY_PX}
            y1="4"
            x2={60 + setup.deadline * DAY_PX}
            y2={TASKS.length * 34 + 10}
            strokeWidth="2"
            strokeDasharray="6 6"
            className="stroke-rose-500"
          />
          <text x={60 + setup.deadline * DAY_PX + 5} y={TASKS.length * 34 + 26} fontSize="11" fontWeight="700" className="fill-rose-600 font-display dark:fill-rose-300">
            due
          </text>

          {s.rows.map((r, i) => {
            const t = TASKS.find((x) => x.id === r.id)!
            const y = i * 34 + 8
            const showSlack = setup.readout && showReadout && r.slack > 0
            return (
              <g key={r.id}>
                <text x="0" y={y + 15} fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                  {t.name}
                </text>
                {showSlack && (
                  <rect
                    x={60 + (r.start + r.days) * DAY_PX}
                    y={y + 3}
                    width={r.slack * DAY_PX}
                    height="18"
                    rx="4"
                    className="fill-stone-300/70 dark:fill-white/10"
                  />
                )}
                <rect
                  x={60 + r.start * DAY_PX}
                  y={y + 3}
                  width={r.days * DAY_PX}
                  height="18"
                  rx="4"
                  className={cn(
                    setup.readout && showReadout
                      ? r.critical
                        ? 'fill-rose-500'
                        : 'fill-sky-400'
                      : 'fill-slate-500 dark:fill-slate-400',
                  )}
                />
                <text x={60 + r.start * DAY_PX + 6} y={y + 16} fontSize="11" fontWeight="700" className="fill-white font-display">
                  {r.days}d
                </text>
                {showSlack && (
                  <text x={60 + (r.start + r.days) * DAY_PX + 5} y={y + 16} fontSize="10" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                    {r.slack}d spare
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Verdict */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        <p
          className={cn(
            'rounded-xl px-4 py-2.5 text-sm font-semibold',
            solved
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
          )}
        >
          {overBudget
            ? `Overtime is at ${s.cost} and the budget is ${setup.budget}.`
            : solved
              ? `Delivered in ${s.finish} days for ${s.cost} of overtime.`
              : wastedSpend > 0
                ? `Still ${s.finish} days. You have spent ${wastedSpend} speeding up work that was waiting around anyway, so the finish date has not moved a single day.`
                : `Still ${s.finish} days, and the deadline is ${setup.deadline}.`}
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Meter
          label="Project length"
          display={`${s.finish} of ${setup.deadline} days`}
          fraction={s.finish / (setup.deadline * 1.7)}
          markerFraction={1 / 1.7}
          barClass={s.finish <= setup.deadline ? 'bg-emerald-500' : 'bg-rose-500'}
        />
        {setup.budget !== null && (
          <Meter
            label="Overtime"
            display={`${s.cost} of ${setup.budget}`}
            fraction={s.cost / setup.budget}
            barClass={overBudget ? 'bg-rose-500' : 'bg-emerald-500'}
          />
        )}
      </div>

      {/* Crash controls */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {TASKS.map((t) => {
          const used = crash[t.id] ?? 0
          const row = s.rows.find((r) => r.id === t.id)!
          return (
            <div key={t.id} className="flex items-center gap-2 rounded-2xl bg-stone-100 px-3 py-2 dark:bg-white/5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-bold">{t.name}</p>
                <p className="text-xs text-ink-soft dark:text-stone-400">
                  {t.perDay} a day{setup.readout && showReadout && row.slack > 0 ? ` · ${row.slack}d spare` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => bump(t.id, -1)}
                disabled={used === 0}
                aria-label={`Slow ${t.name} back down`}
                className="rounded-full bg-white p-1.5 text-ink-soft transition-colors disabled:opacity-30 dark:bg-white/10 dark:text-stone-400"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-14 text-center font-display text-xs font-bold tabular-nums">
                {used === 0 ? '0 days' : `-${used} d`}
              </span>
              <button
                type="button"
                onClick={() => bump(t.id, 1)}
                disabled={used === t.maxCrash}
                aria-label={`Speed ${t.name} up`}
                className="accent-bg rounded-full p-1.5 text-white transition-opacity hover:brightness-110 disabled:opacity-30"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={reset} aria-label="Reset the plan">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">
          {s.finish} days · {s.cost} overtime
        </Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ days: s.finish, cost: s.cost, squeeze: s.worstSqueeze }}
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
              ? `${s.finish} days for ${s.cost}. Try buying those days somewhere else.`
              : 'That date is achievable.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
