import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
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
    teach: 'A product picked forty times a day is walked to forty times a day. Move the busiest products to the front aisle and watch the walking fall.',
    setup: { maxWalk: 280, maxEffort: null, weighted: false, readout: false, brief: 'Pickers are walking miles in this warehouse. Rearrange the aisles.' },
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
    setup: { maxWalk: null, maxEffort: null, weighted: true, readout: true, brief: 'Sign off the layout the warehouse will actually be built to.' },
    metrics: [
      { id: 'effort', label: 'Carrying work', goal: 'min', target: 1250 },
      { id: 'walk', label: 'Walking', goal: 'min', target: 760 },
      { id: 'front', label: 'Front aisle traffic', goal: 'min', target: 32, unit: ' trips' },
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
  }, [lv.level.n])

  const walk = ITEMS.reduce((s, it, i) => s + it.picks * ZONES[zoneOf[i]].distance, 0)
  const effort = ITEMS.reduce((s, it, i) => s + it.picks * ZONES[zoneOf[i]].distance * it.weight, 0)
  const frontTrips = ITEMS.reduce((s, it, i) => s + (zoneOf[i] === 0 ? it.picks : 0), 0)

  const overWalk = setup.maxWalk !== null && walk > setup.maxWalk
  const overEffort = setup.maxEffort !== null && effort > setup.maxEffort
  const solved = !overWalk && !overEffort

  useEffect(() => {
    if (!solved || won) return
    const timer = setTimeout(() => {
      setWon(true)
      lv.clearLevel(lv.level.metrics ? { effort, walk, front: frontTrips } : undefined)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, 650)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, won, effort, walk, frontTrips])

  const reset = () => {
    setZoneOf(START)
    setWon(false)
  }

  const countIn = (z: number) => zoneOf.filter((v) => v === z).length

  /** Moving into a full aisle swaps places with whatever is already there. */
  const place = (item: number, zone: number) => {
    setZoneOf((prev) => {
      if (prev[item] === zone) return prev
      const next = [...prev]
      if (countIn(zone) >= ZONES[zone].slots) {
        const displaced = prev.findIndex((v, i) => v === zone && i !== item)
        if (displaced === -1) return prev
        next[displaced] = prev[item]
      }
      next[item] = zone
      return next
    })
  }

  const maxEffortBar = Math.max(...ITEMS.map((it, i) => it.picks * ZONES[zoneOf[i]].distance * it.weight), 1)

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.readout ? <InsightToggle label="work per product" on={showReadout} onChange={setShowReadout} /> : undefined}
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
                    onClick={() => place(i, zi)}
                    aria-pressed={zoneOf[i] === zi}
                    className={cn(
                      'rounded-full px-3 py-1.5 font-display text-xs font-bold transition-colors duration-200',
                      zoneOf[i] === zi
                        ? 'accent-bg text-white shadow-clay'
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
                  <span className="w-12 text-right font-display text-xs font-bold tabular-nums text-ink-soft dark:text-stone-400">
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
        <p
          className={cn(
            'rounded-xl px-4 py-2.5 text-sm font-semibold',
            solved
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
          )}
        >
          {overWalk
            ? `Pickers are covering ${walk} and the shift allows ${setup.maxWalk}. Busier products need to be closer.`
            : overEffort
              ? `That is ${effort} of carrying work against a target of ${setup.maxEffort}. Look at what the heavy products cost from where they are sitting now.`
              : setup.weighted
                ? `Good layout. ${effort} of carrying work, ${walk} of walking.`
                : `Good layout. ${walk} of walking a day.`}
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {setup.maxWalk !== null && (
          <Meter
            label="Walking"
            display={`${walk} of ${setup.maxWalk}`}
            fraction={walk / (setup.maxWalk * 1.6)}
            markerFraction={1 / 1.6}
            barClass={overWalk ? 'bg-rose-500' : 'bg-emerald-500'}
          />
        )}
        {setup.maxEffort !== null && (
          <Meter
            label="Carrying work"
            display={`${effort} of ${setup.maxEffort}`}
            fraction={effort / (setup.maxEffort * 2)}
            markerFraction={0.5}
            barClass={overEffort ? 'bg-rose-500' : 'bg-emerald-500'}
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={reset} aria-label="Reset the layout">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">
          {setup.weighted ? `${effort} carrying · ${walk} walking` : `${walk} walking`}
        </Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ effort, walk, front: frontTrips }}
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
