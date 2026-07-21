import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Droplets, RotateCcw, X } from 'lucide-react'
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
type Pollutant = 'trash' | 'dirt' | 'chemicals' | 'germs'

const POLLUTANTS: Record<Pollutant, { label: string; color: string }> = {
  trash: { label: 'Trash', color: '#78716c' },
  dirt: { label: 'Dirt', color: '#b45309' },
  chemicals: { label: 'Chemicals', color: '#a3e635' },
  germs: { label: 'Germs', color: '#f43f5e' },
}

interface Stage {
  id: string
  name: string
  removes: Pollutant
  cost: number
  energy: number
  /** Pollutants that must already be gone, or this stage clogs. */
  needsGone?: Pollutant[]
  /** Only works as the very first stage (still water). */
  firstOnly?: boolean
  /** A pollutant this stage puts INTO the water. */
  adds?: Pollutant
  note: string
}

const STAGES: Stage[] = [
  { id: 'settling', name: 'Settling pond', removes: 'dirt', cost: 2, energy: 0, firstOnly: true, note: 'Free to run, but only works as the first stage, in still water' },
  { id: 'screen', name: 'Screen', removes: 'trash', cost: 3, energy: 1, note: 'Catches the big stuff anywhere in the line' },
  { id: 'sand', name: 'Sand filter', removes: 'dirt', cost: 4, energy: 2, needsGone: ['trash'], note: 'Clogs instantly if trash reaches it' },
  { id: 'carbon', name: 'Carbon filter', removes: 'chemicals', cost: 5, energy: 4, needsGone: ['dirt'], note: 'Fine pores, so dirt blinds it' },
  { id: 'chlorine', name: 'Chlorine', removes: 'germs', cost: 3, energy: 1, adds: 'chemicals', note: 'Cheap, but leaves chemicals behind it' },
  { id: 'uv', name: 'UV light', removes: 'germs', cost: 6, energy: 6, needsGone: ['dirt'], note: 'Light cannot reach germs through murky water' },
]
const stageById = (id: string) => STAGES.find((s) => s.id === id)!

interface PipeResult {
  clean: boolean
  left: Pollutant[]
  clogged: string[]
  cost: number
  energy: number
  /** What is still in the water after each placed stage, for the readout. */
  afterEach: Pollutant[][]
}

/** Walk the water through the stages in the order they are placed. */
function runPipe(order: string[], water: Pollutant[], clogging: boolean): PipeResult {
  const left = new Set<Pollutant>(water)
  const clogged: string[] = []
  const afterEach: Pollutant[][] = []

  order.forEach((id, i) => {
    const s = stageById(id)
    const blocked =
      (s.firstOnly && i !== 0) ||
      (clogging && s.needsGone !== undefined && s.needsGone.some((p) => left.has(p)))
    if (blocked) clogged.push(id)
    else {
      left.delete(s.removes)
      if (s.adds) left.add(s.adds)
    }
    afterEach.push([...left])
  })

  return {
    clean: left.size === 0,
    left: [...left],
    clogged,
    cost: order.reduce((a, id) => a + stageById(id).cost, 0),
    energy: order.reduce((a, id) => a + stageById(id).energy, 0),
    afterEach,
  }
}

interface WaterSetup {
  label: string
  pollutants: Pollutant[]
  /** Stage ids on the shelf this level. */
  shelf: string[]
  budget: number | null
  /** Level 3 on: wrong order clogs stages. */
  clogging: boolean
  /** Level 4 on: the per-stage readout is available. */
  readout: boolean
  brief: string
}

const LEVELS: ChallengeLevel<WaterSetup>[] = [
  {
    n: 1,
    title: 'Filter it out',
    phase: 'play',
    concept: 'A stage per pollutant',
    teach: 'Each treatment stage pulls one thing out of the water. Add the stages that match what is floating in it, and the outflow runs clear.',
    setup: { label: 'Muddy creek', pollutants: ['trash', 'dirt'], shelf: ['screen', 'sand'], budget: null, clogging: false, readout: false, brief: 'A creek full of litter and mud. Build a line that cleans it.' },
  },
  {
    n: 2,
    title: 'The works has a budget',
    phase: 'understand',
    concept: 'Only what you need',
    teach: 'More stages always means cleaner, and this plant cannot afford them all. Notice the cheap germ killer has a catch written on the tin: it leaves chemicals behind, and removing those costs more than the saving.',
    setup: { label: 'Storm runoff', pollutants: ['trash', 'dirt', 'germs'], shelf: ['screen', 'sand', 'chlorine', 'carbon', 'uv'], budget: 13, clogging: false, readout: false, brief: 'Runoff with germs in it, and a budget that will not stretch to everything.' },
  },
  {
    n: 3,
    title: 'Order is everything',
    phase: 'understand',
    concept: 'Wrong order, dead stages',
    teach: 'The exact same stages now clog if the water reaches them in the wrong state. Trash shreds a sand filter, and UV light cannot reach germs through murky water. Coarse to fine is the rule in every real plant.',
    setup: { label: 'Storm runoff', pollutants: ['trash', 'dirt', 'germs'], shelf: ['screen', 'sand', 'chlorine', 'carbon', 'uv'], budget: 13, clogging: true, readout: false, brief: 'Same water, same budget, but now the plumbing order actually matters.' },
  },
  {
    n: 4,
    title: 'Follow the water',
    phase: 'analyze',
    concept: 'What each stage really does',
    teach: 'Turn on the readout to see what is still in the water after every stage. A clogged stage shows itself immediately: the water leaves it exactly as dirty as it arrived.',
    setup: { label: 'Factory outflow', pollutants: ['trash', 'dirt', 'chemicals', 'germs'], shelf: ['settling', 'screen', 'sand', 'carbon', 'chlorine', 'uv'], budget: 20, clogging: true, readout: true, brief: 'The nastiest water yet, with the whole pipeline instrumented.' },
  },
  {
    n: 5,
    title: 'Run it for a decade',
    phase: 'optimize',
    concept: 'Cheap to build, cheap to run',
    teach: 'Energy is the bill that never stops. The settling pond costs nothing to run but only works first in line, chlorine is cheap but pollutes, and UV is clean but hungry. The best plant here is not the obvious one.',
    setup: { label: 'The town supply', pollutants: ['trash', 'dirt', 'germs'], shelf: ['settling', 'screen', 'sand', 'carbon', 'chlorine', 'uv'], budget: null, clogging: true, readout: true, brief: 'Design the plant the town will pay to run for the next ten years.' },
    metrics: [
      { id: 'cost', label: 'Build cost', goal: 'min', target: 12 },
      { id: 'energy', label: 'Energy per day', goal: 'min', target: 7 },
      { id: 'stages', label: 'Stages used', goal: 'min', target: 3 },
    ],
  },
]

export function WaterChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('water', LEVELS)
  const round = lv.level.setup

  /** The pipeline, in flow order. */
  const [order, setOrder] = useState<string[]>([])
  const [wonRound, setWonRound] = useState(false)
  const [showReadout, setShowReadout] = useState(true)
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)
  const completedRef = useRef(false)

  useEffect(() => {
    setOrder([])
    setWonRound(false)
    setVerdict(null)
  }, [lv.level.n])

  const r = runPipe(order, round.pollutants, round.clogging)
  const overBudget = round.budget !== null && r.cost > round.budget
  const win = r.clean && !overBudget

  /** Open the taps and drink the result. */
  const openTaps = () => {
    if (wonRound) return
    if (win) {
      setWonRound(true)
      setVerdict({ ok: true, text: `Crystal clear${round.budget !== null ? ' and under budget' : ''}. Safe to drink!` })
      lv.clearLevel(
        lv.level.metrics ? { cost: r.cost, energy: r.energy, stages: order.length } : undefined,
      )
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const text = overBudget
      ? `Over budget: this pipeline costs $${r.cost} and the plant can spend ${round.budget}.`
      : r.clogged.length > 0
        ? `${r.clogged.map((id) => stageById(id).name).join(' and ')} ${r.clogged.length > 1 ? 'are' : 'is'} ruined by the state of the water reaching ${r.clogged.length > 1 ? 'them' : 'it'}. Coarse to fine is the rule.`
        : `Not safe yet. Still in the water: ${r.left.map((pl) => POLLUTANTS[pl].label).join(', ')}.`
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'The health inspector shut the taps off. Empty pipeline. Match each stage to a pollutant before rebuilding.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  const addStage = (id: string) => {
    if (order.includes(id)) return
    setOrder((prev) => [...prev, id])
    setWonRound(false)
    setVerdict(null)
  }
  const removeStage = (id: string) => {
    setOrder((prev) => prev.filter((s) => s !== id))
    setWonRound(false)
    setVerdict(null)
  }
  const move = (id: string, dir: -1 | 1) => {
    setOrder((prev) => {
      const i = prev.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
    setWonRound(false)
  }

  const reset = () => {
    setOrder([])
    setWonRound(false)
    setVerdict(null)
  }

  const clarity = round.pollutants.length === 0 ? 1 : 1 - r.left.length / round.pollutants.length

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.readout ? <InsightToggle label="water readout" on={showReadout} onChange={setShowReadout} /> : undefined}
      />

      <Objective
        goal={`Outflow clean enough to drink${round.budget !== null ? ` for $${round.budget} or less` : ''}`}
        status={`still in the water: ${r.left.length === 0 ? 'nothing' : r.left.map((pl) => POLLUTANTS[pl].label).join(', ')} · $${r.cost}`}
        attemptsLeft={att.left}
        met={wonRound}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
      </div>

      {/* What is in the water */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft dark:text-stone-400">
          In the water:
        </span>
        {round.pollutants.map((p) => {
          const gone = !r.left.includes(p)
          return (
            <span
              key={p}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-display font-semibold transition-opacity',
                gone
                  ? 'bg-emerald-100 text-emerald-800 line-through opacity-70 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-stone-100 text-ink-soft dark:bg-white/10 dark:text-stone-300',
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: POLLUTANTS[p].color }} />
              {POLLUTANTS[p].label}
            </span>
          )
        })}
        {r.left.filter((p) => !round.pollutants.includes(p)).map((p) => (
          <span key={p} className="flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 font-display text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: POLLUTANTS[p].color }} />
            {POLLUTANTS[p].label} (added by a stage!)
          </span>
        ))}
      </div>

      {/* The pipeline, in flow order */}
      <div className="overflow-x-auto rounded-2xl bg-sky-100/70 p-4 dark:bg-sky-950/40">
        <div className="flex min-w-max items-stretch gap-2">
          <div className="flex w-16 flex-col items-center justify-center rounded-xl bg-[#8a6d3b]/80 px-2 py-3 text-center">
            <span className="font-display text-xs font-bold text-white">dirty in</span>
          </div>

          {order.length === 0 && (
            <div className="flex items-center rounded-xl border-2 border-dashed border-stone-300 px-6 text-sm font-semibold text-ink-soft dark:border-white/20 dark:text-stone-400">
              Add stages below. Water flows left to right.
            </div>
          )}

          {order.map((id, i) => {
            const s = stageById(id)
            const isClogged = r.clogged.includes(id)
            return (
              <div
                key={id}
                className={cn(
                  'flex w-40 flex-col rounded-xl border-2 p-2.5',
                  isClogged
                    ? 'border-rose-400 bg-rose-50 dark:border-rose-500/50 dark:bg-rose-500/10'
                    : 'border-transparent bg-white dark:bg-white/10',
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="flex items-center gap-1.5 font-display text-sm font-bold">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: POLLUTANTS[s.removes].color }} />
                    {s.name}
                  </span>
                  <button type="button" onClick={() => removeStage(id)} aria-label={`Remove ${s.name}`} className="rounded p-0.5 text-ink-soft hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-white/10">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className={cn('mt-1 text-xs font-semibold', isClogged ? 'text-rose-600 dark:text-rose-300' : 'text-ink-soft dark:text-stone-400')}>
                  {isClogged
                    ? s.firstOnly && i !== 0
                      ? 'needs still water: put it first'
                      : 'CLOGGED by what is still in the water'
                    : `removes ${POLLUTANTS[s.removes].label.toLowerCase()}${s.adds ? `, adds ${POLLUTANTS[s.adds].label.toLowerCase()}` : ''}`}
                </p>
                {round.readout && showReadout && (
                  <div className="mt-1.5 flex items-center gap-1">
                    <span className="text-[10px] font-bold uppercase text-ink-soft dark:text-stone-500">after:</span>
                    {r.afterEach[i].length === 0 ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300">clean</span>
                    ) : (
                      r.afterEach[i].map((p) => (
                        <span key={p} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: POLLUTANTS[p].color }} title={POLLUTANTS[p].label} />
                      ))
                    )}
                  </div>
                )}
                <div className="mt-auto flex justify-between pt-1.5">
                  <button type="button" onClick={() => move(id, -1)} disabled={i === 0} aria-label={`Move ${s.name} upstream`} className="rounded p-0.5 text-ink-soft hover:bg-stone-100 disabled:opacity-25 dark:text-stone-400 dark:hover:bg-white/10">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => move(id, 1)} disabled={i === order.length - 1} aria-label={`Move ${s.name} downstream`} className="rounded p-0.5 text-ink-soft hover:bg-stone-100 disabled:opacity-25 dark:text-stone-400 dark:hover:bg-white/10">
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}

          <motion.div
            className="flex w-16 flex-col items-center justify-center rounded-xl px-2 py-3 text-center"
            animate={{ backgroundColor: r.clean ? 'rgba(56,189,248,0.9)' : `rgba(56,189,248,${0.25 + clarity * 0.4})` }}
          >
            <span className="font-display text-xs font-bold text-white">{r.clean ? 'clean!' : 'out'}</span>
          </motion.div>
        </div>
      </div>

      {/* Shelf */}
      <div className="mt-4">
        <p className="mb-2 font-display text-sm font-semibold">Stages on the shelf</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {round.shelf.map((id) => {
            const s = stageById(id)
            const placed = order.includes(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => (placed ? removeStage(id) : addStage(id))}
                aria-pressed={placed}
                className={cn(
                  'rounded-2xl border-2 p-3 text-left transition-colors duration-200',
                  placed ? 'accent-border accent-soft' : 'border-stone-200 hover:border-stone-300 dark:border-white/10 dark:hover:border-white/25',
                )}
              >
                <span className="mb-1 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: POLLUTANTS[s.removes].color }} />
                  <span className="font-display text-sm font-bold">{s.name}</span>
                </span>
                <span className="block text-xs text-ink-soft dark:text-stone-400">
                  ${s.cost} · {s.energy} energy · {s.note}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {round.budget !== null && (
        <div className="mt-4">
          <Meter
            label="Build budget"
            display={`$${r.cost} of $${round.budget}`}
            fraction={r.cost / round.budget}
            barClass={overBudget ? 'bg-rose-500' : 'bg-emerald-500'}
          />
        </div>
      )}

      {/* Feedback */}
      <div aria-live="polite" className="mt-3 min-h-[2.5rem]">
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
            Build the pipeline in flow order, then open the taps for the inspector's verdict.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={openTaps} disabled={wonRound}>
          <Droplets className="h-5 w-5" />
          Open the taps
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Clear the pipeline">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">
          ${r.cost} · {r.energy} energy
        </Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ cost: r.cost, energy: r.energy, stages: order.length }}
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
              ? `Clean water on ${r.energy} energy a day. There is a cleverer line to find.`
              : 'The outflow runs clear.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
