import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import type { ChallengeProps } from '@/lib/types'
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
}

/** The filter stages you can switch on, in flow order. */
const STAGES: Stage[] = [
  { id: 'screen', name: 'Screen', removes: 'trash', cost: 3 },
  { id: 'sand', name: 'Sand filter', removes: 'dirt', cost: 4 },
  { id: 'carbon', name: 'Carbon filter', removes: 'chemicals', cost: 5 },
  { id: 'uv', name: 'UV light', removes: 'germs', cost: 6 },
]

interface WaterRound {
  label: string
  pollutants: Pollutant[]
  budget: number
}

/** Each win sends dirtier water down the pipe on a tight budget. */
const ROUNDS: WaterRound[] = [
  { label: 'Muddy creek', pollutants: ['trash', 'dirt'], budget: 9 },
  { label: 'Storm runoff', pollutants: ['trash', 'dirt', 'germs'], budget: 15 },
  { label: 'Factory outflow', pollutants: ['dirt', 'chemicals', 'germs'], budget: 16 },
]

export function WaterChallenge({ onComplete }: ChallengeProps) {
  const [roundIndex, setRoundIndex] = useState(0)
  const round = ROUNDS[roundIndex % ROUNDS.length]

  const [active, setActive] = useState<string[]>([])
  const [wonRound, setWonRound] = useState(false)
  const completedRef = useRef(false)

  const activeStages = STAGES.filter((s) => active.includes(s.id))
  const cost = activeStages.reduce((sum, s) => sum + s.cost, 0)
  const removed = new Set(activeStages.map((s) => s.removes))
  const remaining = round.pollutants.filter((p) => !removed.has(p))
  const overBudget = cost > round.budget
  const win = remaining.length === 0 && !overBudget

  useEffect(() => {
    if (win && !wonRound) {
      setWonRound(true)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }
  }, [win, wonRound, onComplete])

  const toggle = (id: string) => setActive((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))

  const nextRound = () => {
    setRoundIndex((i) => i + 1)
    setActive([])
    setWonRound(false)
  }

  const reset = () => {
    setActive([])
    setWonRound(false)
  }

  // Water clarity for the scene: 0 dirty ... 1 clean.
  const clarity = round.pollutants.length === 0 ? 1 : 1 - remaining.length / round.pollutants.length

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">
          Dirty water flows in from the left. Switch on the filter stages that remove what is in it,
          without blowing the budget.
        </p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
      </div>

      {/* What is in the water */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-display text-xs font-bold uppercase tracking-widest text-ink-soft dark:text-stone-400">
          In the water:
        </span>
        {round.pollutants.map((p) => {
          const gone = removed.has(p)
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
      </div>

      {/* Scene: pipe with stages */}
      <div className="overflow-hidden rounded-2xl bg-sky-100/70 dark:bg-sky-950/40">
        <svg viewBox="0 0 800 180" className="w-full" role="img" aria-label="Water treatment pipe">
          {/* pipe */}
          <rect x="0" y="70" width="800" height="44" className="fill-slate-300/60 dark:fill-slate-700/60" />
          {/* dirty inlet */}
          <rect x="0" y="74" width="120" height="36" fill="#8a6d3b" opacity="0.85" />
          {/* clean outlet, opacity grows with clarity */}
          <motion.rect x="680" y="74" width="120" height="36" fill="#38bdf8" animate={{ opacity: 0.3 + clarity * 0.6 }} />

          {/* stages */}
          {STAGES.map((s, i) => {
            const x = 150 + i * 130
            const on = active.includes(s.id)
            return (
              <g key={s.id}>
                <rect
                  x={x}
                  y="52"
                  width="90"
                  height="80"
                  rx="10"
                  fill={on ? POLLUTANTS[s.removes].color : 'transparent'}
                  opacity={on ? 0.85 : 1}
                  className={on ? '' : 'stroke-stone-400 dark:stroke-stone-500'}
                  strokeWidth={on ? 0 : 2}
                  strokeDasharray={on ? undefined : '5 5'}
                />
                <text x={x + 45} y="96" textAnchor="middle" fontSize="12" fontWeight="700" className={on ? 'fill-white' : 'fill-ink-soft dark:fill-stone-400'}>
                  {s.name}
                </text>
                <text x={x + 45} y="146" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                  {on ? 'ON' : `$${s.cost}`}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Budget */}
      <div className="mt-4">
        <Meter
          label="Budget"
          display={`$${cost} of $${round.budget}`}
          fraction={cost / round.budget}
          barClass={overBudget ? 'bg-rose-500' : 'bg-emerald-500'}
        />
      </div>

      {/* Stage toggles */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAGES.map((s) => {
          const on = active.includes(s.id)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              aria-pressed={on}
              className={cn(
                'rounded-2xl border-2 p-3 text-left transition-colors duration-200',
                on ? 'accent-border accent-soft' : 'border-stone-200 hover:border-stone-300 dark:border-white/10 dark:hover:border-white/25',
              )}
            >
              <span className="mb-1 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: POLLUTANTS[s.removes].color }} />
                <span className="font-display text-sm font-bold">{s.name}</span>
              </span>
              <span className="block text-xs text-ink-soft dark:text-stone-400">
                removes {POLLUTANTS[s.removes].label.toLowerCase()} · ${s.cost}
              </span>
            </button>
          )
        })}
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-3 min-h-[2.5rem]">
        {wonRound ? (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            Crystal clear and under budget. Safe to drink!
          </motion.p>
        ) : overBudget ? (
          <p className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Over budget. This many stages costs more than you are allowed to spend.
          </p>
        ) : (
          <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-300">
            Still in the water: {remaining.map((p) => POLLUTANTS[p].label).join(', ') || 'nothing, nice!'}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {wonRound && (
          <Button variant="accent" onClick={nextRound}>
            Next source
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" onClick={reset} aria-label="Switch off all stages">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Round {(roundIndex % ROUNDS.length) + 1}</Badge>
      </div>
    </Card>
  )
}
