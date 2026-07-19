import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, RotateCcw, Wind } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import type { ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const CORES = {
  wood: { label: 'Wood core', cost: 3, stiff: 8, fill: '#c89b6b' },
  steel: { label: 'Steel core', cost: 6, stiff: 16, fill: '#9aa7b5' },
  concrete: { label: 'Concrete core', cost: 9, stiff: 24, fill: '#b6b1a9' },
} as const

const DAMPER_COST = 5
const DAMPER_STIFF = 12
const WIDE_COST = 4
const WIDE_STIFF = 9

type CoreId = keyof typeof CORES

interface TowerRound {
  label: string
  wind: number
  budget: number
  floors: number
}

/** Each win builds taller in rougher wind. */
const ROUNDS: TowerRound[] = [
  { label: 'Gentle breeze', wind: 14, budget: 12, floors: 5 },
  { label: 'City gusts', wind: 26, budget: 16, floors: 7 },
  { label: 'Hurricane season', wind: 40, budget: 22, floors: 9 },
]

export function TowerChallenge({ onComplete }: ChallengeProps) {
  const [coreId, setCoreId] = useState<CoreId>('wood')
  const [damper, setDamper] = useState(false)
  const [wide, setWide] = useState(false)
  const [roundIndex, setRoundIndex] = useState(0)
  const [wonRound, setWonRound] = useState(false)
  const completedRef = useRef(false)

  const round = ROUNDS[roundIndex % ROUNDS.length]
  const core = CORES[coreId]
  const cost = core.cost + (damper ? DAMPER_COST : 0) + (wide ? WIDE_COST : 0)
  const stiffness = core.stiff + (damper ? DAMPER_STIFF : 0) + (wide ? WIDE_STIFF : 0)
  const overBudget = cost > round.budget
  const strongEnough = stiffness >= round.wind
  const win = strongEnough && !overBudget

  useEffect(() => {
    if (!win || wonRound) return
    const timer = setTimeout(() => {
      setWonRound(true)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [win, wonRound, onComplete])

  const nextRound = () => {
    setRoundIndex((i) => i + 1)
    setCoreId('wood')
    setDamper(false)
    setWide(false)
    setWonRound(false)
  }

  const reset = () => {
    setCoreId('wood')
    setDamper(false)
    setWide(false)
    setWonRound(false)
  }

  // Sway amplitude grows when wind beats stiffness.
  const sway = Math.max(1.5, Math.min(16, (round.wind - stiffness) * 0.9 + 2))
  const floorH = 22
  const towerH = round.floors * floorH
  const baseY = 300
  const topY = baseY - towerH

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">
          Design a skyscraper that barely sways in the wind, without overspending. Stiffness has to
          beat the wind.
        </p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
          <Wind className="mr-1 h-4 w-4" />
          {round.label} · wind {round.wind}
        </Badge>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-sky-100/70 dark:bg-sky-950/40">
        <svg viewBox="0 0 800 340" className="w-full" role="img" aria-label="Skyscraper scene">
          {/* wind streaks */}
          {[60, 110, 160].map((y) => (
            <motion.line
              key={y}
              x1="40"
              y1={y}
              x2="180"
              y2={y}
              strokeWidth="3"
              strokeLinecap="round"
              className="stroke-sky-300 dark:stroke-sky-700"
              animate={{ x1: [40, 90], x2: [180, 230], opacity: [0.2, 0.7, 0.2] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: y / 200 }}
            />
          ))}

          {/* ground */}
          <rect x="0" y={baseY} width="800" height="40" className="fill-emerald-200 dark:fill-emerald-950" />

          {/* the tower sways around its base */}
          <motion.g
            style={{ transformBox: 'view-box', transformOrigin: `400px ${baseY}px` }}
            animate={{ rotate: [-sway * 0.1, sway * 0.1, -sway * 0.1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* wide base outriggers */}
            {wide && (
              <>
                <line x1="400" y1={baseY} x2="356" y2={baseY} strokeWidth="6" className="stroke-stone-500 dark:stroke-stone-400" />
                <line x1="400" y1={baseY} x2="444" y2={baseY} strokeWidth="6" className="stroke-stone-500 dark:stroke-stone-400" />
                <line x1="374" y1={topY + towerH * 0.55} x2="356" y2={baseY} strokeWidth="5" className="stroke-stone-500 dark:stroke-stone-400" />
                <line x1="426" y1={topY + towerH * 0.55} x2="444" y2={baseY} strokeWidth="5" className="stroke-stone-500 dark:stroke-stone-400" />
              </>
            )}

            {/* tower body */}
            <rect x="374" y={topY} width="52" height={towerH} rx="4" fill={core.fill} />
            {Array.from({ length: round.floors }, (_, i) => (
              <line key={i} x1="374" y1={topY + i * floorH + floorH} x2="426" y2={topY + i * floorH + floorH} className="stroke-black/10" strokeWidth="1.5" />
            ))}
            {Array.from({ length: round.floors * 2 }, (_, i) => {
              const col = i % 2
              const row = Math.floor(i / 2)
              return (
                <rect key={i} x={382 + col * 22} y={topY + row * floorH + 6} width="12" height="10" rx="2" className="fill-sky-200/80 dark:fill-sky-900" />
              )
            })}

            {/* tuned mass damper: a pendulum weight near the top */}
            {damper && (
              <g>
                <line x1="400" y1={topY + 10} x2="400" y2={topY + 34} strokeWidth="2" className="stroke-stone-500" />
                <motion.circle
                  cx="400"
                  cy={topY + 40}
                  r="9"
                  className="fill-stone-600 dark:fill-stone-300"
                  animate={{ cx: [394, 406, 394] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              </g>
            )}
          </motion.g>
        </svg>
      </div>

      {/* Meters */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Meter
          label="Budget"
          display={`$${cost} of $${round.budget}`}
          fraction={cost / round.budget}
          barClass={overBudget ? 'bg-rose-500' : cost / round.budget > 0.9 ? 'bg-amber-400' : 'bg-emerald-500'}
        />
        <Meter
          label="Stiffness"
          display={`${stiffness} vs wind ${round.wind}`}
          fraction={stiffness / 48}
          markerFraction={round.wind / 48}
          barClass={strongEnough ? 'bg-emerald-500' : 'bg-amber-400'}
        />
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-3 min-h-[2.5rem]">
        {wonRound ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            Rock steady! It barely sways.
            {round.budget - cost >= 2 && (
              <Badge className="bg-emerald-200 text-emerald-900 dark:bg-emerald-500/25 dark:text-emerald-200">
                ${round.budget - cost} under budget
              </Badge>
            )}
          </motion.div>
        ) : overBudget ? (
          <p className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Over budget. This design costs more than you are allowed to spend.
          </p>
        ) : (
          <p className="rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            The tower sways too much in this wind. Its stiffness ({stiffness}) could not stand up to the gusts ({round.wind}).
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <div>
          <p className="mb-2 font-display text-sm font-semibold">1. Pick a core</p>
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(CORES) as CoreId[]).map((id) => {
              const c = CORES[id]
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCoreId(id)}
                  className={cn(
                    'rounded-2xl border-2 p-3 text-left transition-colors duration-200',
                    coreId === id ? 'accent-border accent-soft' : 'border-stone-200 hover:border-stone-300 dark:border-white/10 dark:hover:border-white/25',
                  )}
                >
                  <span className="mb-1 block h-2.5 w-8 rounded-full" style={{ backgroundColor: c.fill }} />
                  <span className="font-display text-sm font-bold">{c.label}</span>
                  <span className="block text-xs tabular-nums text-ink-soft dark:text-stone-400">
                    ${c.cost} · stiff {c.stiff}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <p className="mb-2 font-display text-sm font-semibold">2. Add upgrades</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setWide((v) => !v)}
              aria-pressed={wide}
              className={cn(
                'rounded-full border-2 px-4 py-2 font-display text-sm font-bold transition-colors duration-200',
                wide ? 'accent-border accent-soft accent-text' : 'border-stone-200 text-ink-soft hover:border-stone-300 dark:border-white/10 dark:text-stone-400',
              )}
            >
              Wide base +{WIDE_STIFF} (${WIDE_COST})
            </button>
            <button
              type="button"
              onClick={() => setDamper((v) => !v)}
              aria-pressed={damper}
              className={cn(
                'rounded-full border-2 px-4 py-2 font-display text-sm font-bold transition-colors duration-200',
                damper ? 'accent-border accent-soft accent-text' : 'border-stone-200 text-ink-soft hover:border-stone-300 dark:border-white/10 dark:text-stone-400',
              )}
            >
              Damper +{DAMPER_STIFF} (${DAMPER_COST})
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-soft dark:text-stone-400">
            A damper is a heavy weight up top that swings against the sway. Real skyscrapers use them.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {wonRound && (
          <Button variant="accent" onClick={nextRound}>
            Taller tower
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" onClick={reset} aria-label="Reset the tower">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Round {(roundIndex % ROUNDS.length) + 1}</Badge>
      </div>
    </Card>
  )
}
