import { useEffect, useRef, useState } from 'react'
import { CalendarCheck, RotateCcw } from 'lucide-react'
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
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const ITEMS = [
  { name: 'Bolts', picks: 40, weight: 1 },
  { name: 'Paint', picks: 12, weight: 8 },
  { name: 'Timber', picks: 8, weight: 25 },
  { name: 'Screws', picks: 30, weight: 1 },
  { name: 'Cement', picks: 6, weight: 40 },
  { name: 'Tape', picks: 20, weight: 1 },
]

/** Three aisles, each holding two products. */
const ZONES = [
  { name: 'Front', distance: 1, slots: 2 },
  { name: 'Middle', distance: 3, slots: 2 },
  { name: 'Back', distance: 6, slots: 2 },
]

/** A deliberately mediocre starting layout, so nothing clears on load. */
const START = [0, 0, 1, 1, 2, 2]

interface SlotSetup {
  /** Walking limit for the shift, or null. */
  maxWalk: number | null
  /** Carrying effort limit, which only appears once weight matters. */
  maxEffort: number | null
  /** Level 3 on: how heavy each item is starts counting. */
  weighted: boolean
  /** Level 4 on: the per item readout is available. */
  readout: boolean
  brief: string
}

const LEVELS: ChallengeLevel<SlotSetup>[] = [
  {
    n: 1,
    title: 'Put the busy stuff close',
    phase: 'play',
    concept: 'Trips times distance',
    teach: 'It is a tidying game scored in footsteps. A product picked forty times a day is walked to forty times a day. Move the busiest products to the front aisle and watch the walking fall.',
    // 290, not 280: with quietest-first eviction, three of the twelve moves
    // from the starting layout improve the walk (Tape to Front 282, Screws to
    // Front 286, Tape to Middle 286) and all three clear 290. At 280 every
    // first move failed, so level 1 opened on a puzzle where the correct idea
    // looked wrong. 290 keeps it a one-move lesson and leaves level 2's 260
    // to demand the tight layout.
    setup: { maxWalk: 290, maxEffort: null, weighted: false, readout: false, brief: 'Pickers are walking miles in this warehouse. Rearrange the aisles.' },
  },
  {
    n: 2,
    title: 'Beat the shift',
    phase: 'understand',
    concept: 'A walking budget',
    teach: 'Orders have to be out by the end of the shift, and walking is the slowest part of picking. Only the tightest arrangement of the busy products gets there in time.',
    setup: { maxWalk: 260, maxEffort: null, weighted: false, readout: false, brief: 'Same warehouse, and the vans leave at five whether the orders are ready or not.' },
  },
  {
    n: 3,
    title: 'Some of it is heavy',
    phase: 'understand',
    concept: 'Carrying, not just walking',
    teach: 'Cement is picked six times a day and weighs forty kilos. Tape is picked twenty times and weighs almost nothing. Once you count what pickers are actually carrying, the rarely picked heavy things belong nearest the door, which is the opposite of what trip counts alone say.',
    setup: { maxWalk: null, maxEffort: 1300, weighted: true, readout: false, brief: 'Pickers are complaining about their backs, not their feet.' },
  },
  {
    n: 4,
    title: 'See the load',
    phase: 'analyze',
    concept: 'Effort per product',
    teach: 'Turn on the readout. Each product shows the real work it costs: how often it is fetched, multiplied by how far, multiplied by how heavy. The biggest bars are rarely the busiest products.',
    setup: { maxWalk: null, maxEffort: 1250, weighted: true, readout: true, brief: 'The same aisles, with the carrying work shown per product.' },
  },
  {
    n: 5,
    title: 'Lay out the warehouse',
    phase: 'optimize',
    concept: 'Backs, feet, and traffic',
    teach: 'Heavy things want the front to save backs, busy things want the front to save time, and a busy front aisle jams up with pickers. All three cannot have it.',
    // The 300 walking floor is the sign-off itself: the untouched starting
    // layout walks 322, so doing nothing fails, while ten of the ninety
    // possible layouts still clear it.
    setup: { maxWalk: 300, maxEffort: null, weighted: true, readout: true, brief: 'Sign off the layout the warehouse will actually be built to.' },
    metrics: [
      // Pick-two pars, checked by enumerating every layout under the 300
      // walking floor. Each pair of pars is beatable by exactly one layout
      // (2626/268, 2646/60, 270/60) and no layout beats all three at once,
      // so the scorecard is a genuine trade and not a checklist.
      { id: 'effort', label: 'Carrying work', goal: 'min', target: 2650 },
      { id: 'walk', label: 'Walking', goal: 'min', target: 270 },
      { id: 'front', label: 'Front aisle traffic', goal: 'min', target: 60, unit: ' trips' },
    ],
  },
]

export function WarehouseChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('warehouse', LEVELS)
  const setup = lv.level.setup

  const [zoneOf, setZoneOf] = useState<number[]>(START)
  const [won, setWon] = useState(false)
  const [showReadout, setShowReadout] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    setZoneOf(START)
    setWon(false)
    setVerdict(null)
  }, [lv.level.n])

  const walk = ITEMS.reduce((s, it, i) => s + it.picks * ZONES[zoneOf[i]].distance, 0)
  const effort = ITEMS.reduce((s, it, i) => s + it.picks * ZONES[zoneOf[i]].distance * it.weight, 0)
  const frontTrips = ITEMS.reduce((s, it, i) => s + (zoneOf[i] === 0 ? it.picks : 0), 0)

  const overWalk = setup.maxWalk !== null && walk > setup.maxWalk
  const overEffort = setup.maxEffort !== null && effort > setup.maxEffort
  const solved = !overWalk && !overEffort

  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)
  // Levels 2, 3 and 5 keep the totals secret until a picking day has actually run.
  const outcomeVisible = lv.level.n === 1 || lv.level.n === 4 || verdict !== null || won

  /** Lock the layout in and run a picking day against it. */
  const runDay = () => {
    if (won) return
    if (solved) {
      setWon(true)
      setVerdict({
        ok: true,
        text: setup.weighted
          ? `Good layout. ${effort} of carrying work, ${walk} of walking.`
          : `Good layout. ${walk} of walking a day.`,
      })
      lv.clearLevel(lv.level.metrics ? { effort, walk, front: frontTrips } : undefined)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const text = overWalk
      ? `Pickers covered ${walk} against an allowance of ${setup.maxWalk}. Busier products need to be closer.`
      : `That day cost ${effort} of carrying work against a target of ${setup.maxEffort}. Look at what the heavy products cost from where they sit.`
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'The pickers filed a grievance. Original layout restored. Multiply picks by distance for each product before moving anything.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  const reset = () => {
    setZoneOf(START)
    setWon(false)
    setVerdict(null)
  }

  const countIn = (z: number) => zoneOf.filter((v) => v === z).length

  /** Moving into a full aisle swaps places with whatever is already there. */
  const place = (item: number, zone: number) => {
    setZoneOf((prev) => {
      if (prev[item] === zone) return prev
      const next = [...prev]
      if (countIn(zone) >= ZONES[zone].slots) {
        // Evict the QUIETEST product in the target aisle, not the first one in
        // the list. findIndex evicted whichever product was declared earliest,
        // which is the busiest, so following the level's own advice ("move the
        // busiest products to the front") kicked an even busier product out of
        // the front aisle and made the walk worse.
        const occupants = prev
          .map((v, i) => ({ i, v }))
          .filter(({ i, v }) => v === zone && i !== item)
        if (occupants.length === 0) return prev
        const displaced = occupants.reduce((quietest, o) =>
          ITEMS[o.i].picks < ITEMS[quietest.i].picks ? o : quietest,
        ).i
        next[displaced] = prev[item]
      }
      next[item] = zone
      return next
    })
  }

  const maxEffortBar = Math.max(...ITEMS.map((it, i) => it.picks * ZONES[zoneOf[i]].distance * it.weight), 1)

  // Every level carries at least one floor, so the goal line never renders
  // empty; level 5 adds the scorecard trade on top of its walking floor.
  const floors = [
    setup.maxWalk !== null && `walking under ${setup.maxWalk}`,
    setup.maxEffort !== null && `carrying work under ${setup.maxEffort}`,
  ].filter(Boolean).join(' and ')
  const goal = floors.charAt(0).toUpperCase() + floors.slice(1)
    + (lv.level.metrics ? ', then trade the three scorecard numbers' : '')

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.readout ? <InsightToggle label="work per product" on={showReadout} onChange={setShowReadout} /> : undefined}
      />

      <Objective
        goal={goal}
        status={outcomeVisible
          ? `this layout: ${walk} walking${setup.weighted ? ` · ${effort} carrying` : ''}`
          : 'run a picking day to count the cost'}
        attemptsLeft={att.left}
        met={won}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
          {ZONES.map((z) => `${z.name} ${z.distance}`).join(' · ')}
        </Badge>
      </div>

      {/* Products and where they sit */}
      <div className="space-y-2 rounded-2xl bg-stone-100/80 p-4 dark:bg-white/5">
        {ITEMS.map((it, i) => {
          const work = it.picks * ZONES[zoneOf[i]].distance * it.weight
          return (
            <div key={it.name} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-3 py-2.5 dark:bg-white/5">
              <div className="min-w-[8.5rem]">
                <p className="font-display text-sm font-bold">{it.name}</p>
                <p className="text-xs text-ink-soft dark:text-stone-400">
                  {it.picks} picks{setup.weighted ? ` · ${it.weight} kg` : ''}
                </p>
              </div>

              <div className="flex gap-1.5">
                {ZONES.map((z, zi) => (
                  <button
                    key={z.name}
                    type="button"
                    onClick={() => { setVerdict(null); place(i, zi) }}
                    aria-pressed={zoneOf[i] === zi}
                    className={cn(
                      'rounded-full px-3 py-1.5 font-display text-xs font-bold transition-colors duration-200',
                      zoneOf[i] === zi
                        ? 'accent-bg on-accent shadow-clay'
                        : 'bg-stone-100 text-ink-soft hover:bg-stone-200 dark:bg-white/10 dark:text-stone-400',
                    )}
                  >
                    {z.name}
                  </button>
                ))}
              </div>

              {setup.readout && showReadout && (
                <div className="flex flex-1 items-center gap-2" style={{ minWidth: 120 }}>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
                    <div className="accent-bg h-full rounded-full" style={{ width: `${(work / maxEffortBar) * 100}%` }} />
                  </div>
                  <span className="w-12 text-right text-xs font-bold font-mono tabular-nums text-ink-soft dark:text-stone-400">
                    {work}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Verdict */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        {verdict ? (
          <p
            className={cn(
              'rounded-xl px-4 py-2.5 text-sm font-semibold',
              verdict.ok
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
            )}
          >
            {verdict.text}
          </p>
        ) : (
          <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-300">
            Arrange the aisles, then run a picking day against the layout.
          </p>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {setup.maxWalk !== null && (
          <Meter
            label="Walking"
            display={outcomeVisible ? `${walk} of ${setup.maxWalk}` : `? of ${setup.maxWalk}`}
            fraction={outcomeVisible ? walk / (setup.maxWalk * 1.6) : 0}
            markerFraction={1 / 1.6}
            barClass={!outcomeVisible ? 'accent-bg' : overWalk ? 'bg-rose-500' : 'bg-emerald-500'}
          />
        )}
        {setup.maxEffort !== null && (
          <Meter
            label="Carrying work"
            display={outcomeVisible ? `${effort} of ${setup.maxEffort}` : `? of ${setup.maxEffort}`}
            fraction={outcomeVisible ? effort / (setup.maxEffort * 2) : 0}
            markerFraction={0.5}
            barClass={!outcomeVisible ? 'accent-bg' : overEffort ? 'bg-rose-500' : 'bg-emerald-500'}
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={runDay} disabled={won}>
          <CalendarCheck className="h-5 w-5" />
          Run a picking day
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Reset the layout">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">
          {!outcomeVisible
            ? 'run a day to measure it'
            : setup.weighted ? `${effort} carrying · ${walk} walking` : `${walk} walking`}
        </Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={outcomeVisible ? { effort, walk, front: frontTrips } : {}}
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
              ? `${effort} carrying, ${walk} walking. Try trading one against the other.`
              : 'That layout will save a lot of steps.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
