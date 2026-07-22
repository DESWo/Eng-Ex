import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ClipboardCheck, RotateCcw, Wind } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import { InsightToggle } from '@/components/level/InsightToggle'
import { Objective } from '@/components/level/Objective'
import { RoughRect } from '@/components/ui/Sketchy'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import { attemptsFor, useAttempts } from '@/hooks/useAttempts'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
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

interface TowerSetup {
  label: string
  wind: number
  /** Budget, or null while money is no object. */
  budget: number | null
  floors: number
  /** Which upgrades are on the menu yet. */
  upgrades: boolean
  /** Level 4 on: the sway readout is available. */
  swayReadout: boolean
  brief: string
}

/** How far the top floor swings: wind against stiffness. */
const swayOf = (wind: number, stiffness: number) =>
  Math.round(((wind * 10) / Math.max(1, stiffness)) * 10) / 10

const LEVELS: ChallengeLevel<TowerSetup>[] = [
  {
    n: 1,
    title: 'Stand up straight',
    phase: 'play',
    concept: 'Tall things sway',
    teach: 'It is the wobbly block-tower game, scaled up to a real building. Wind pushes hardest at the top, and a bendy core lets the whole stack wave around. Pick a core stiff enough to beat the breeze. Spend whatever you like.',
    setup: { label: 'Gentle breeze', wind: 12, budget: null, floors: 5, upgrades: false, swayReadout: false, brief: 'A five-storey block on an open site. Stop it waving at the neighbours.' },
  },
  {
    n: 2,
    title: 'The developer calls',
    phase: 'understand',
    concept: 'Stiffness per dollar',
    teach: 'Concrete solves everything and costs the most per point of stiffness. With a real budget, the strongest core is no longer automatically the right one.',
    setup: { label: 'City gusts', wind: 26, budget: 12, floors: 6, upgrades: true, swayReadout: false, brief: 'A taller block in gustier air, and now every dollar is argued over.' },
  },
  {
    n: 3,
    title: 'More than one trick',
    phase: 'understand',
    concept: 'Three ways to fight sway',
    teach: 'A stiffer core resists the wind, a wide base braces against it, and a tuned damper is a huge weight up top that swings against the sway. No core alone survives this level, so the upgrades stop being optional extras.',
    setup: { label: 'Storm front', wind: 30, budget: 14, floors: 7, upgrades: true, swayReadout: false, brief: 'Wind no core can beat alone. Time to combine tricks.' },
  },
  {
    n: 4,
    title: 'Feel the top floor',
    phase: 'analyze',
    concept: 'The sway readout',
    teach: 'Turn on the readout. Two towers that both survive can move very differently: the number is how far the top floor swings, and the people up there feel every bit of it.',
    setup: { label: 'Storm front', wind: 32, budget: 15, floors: 8, upgrades: true, swayReadout: true, brief: 'Same storm, with the top-floor movement measured.' },
  },
  {
    n: 5,
    title: 'Nine floors, no seasickness',
    phase: 'optimize',
    concept: 'Standing is the easy part',
    teach: 'The wind is survivable several ways now, and they are not equal: the cheap one sways enough to slosh coffee nine floors up. Keep it stiff enough to be comfortable without gold-plating the core.',
    setup: { label: 'Hurricane season', wind: 36, budget: 20, floors: 9, upgrades: true, swayReadout: true, brief: 'Sign off the tower people will actually live in.' },
    metrics: [
      { id: 'cost', label: 'Build cost', goal: 'min', target: 16 },
      { id: 'sway', label: 'Top-floor sway', goal: 'min', target: 9.8 },
      { id: 'margin', label: 'Stiffness margin', goal: 'max', target: 1 },
    ],
  },
]

export function TowerChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('tower', LEVELS)
  const round = lv.level.setup

  const [coreId, setCoreId] = useState<CoreId>('wood')
  const [damper, setDamper] = useState(false)
  const [wide, setWide] = useState(false)
  const [wonRound, setWonRound] = useState(false)
  const [showSway, setShowSway] = useState(true)
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)
  const completedRef = useRef(false)

  useEffect(() => {
    setCoreId('wood')
    setDamper(false)
    setWide(false)
    setWonRound(false)
    setVerdict(null)
  }, [lv.level.n])

  const core = CORES[coreId]
  const cost = core.cost + (damper ? DAMPER_COST : 0) + (wide ? WIDE_COST : 0)
  const stiffness = core.stiff + (damper ? DAMPER_STIFF : 0) + (wide ? WIDE_STIFF : 0)
  const overBudget = round.budget !== null && cost > round.budget
  const strongEnough = stiffness >= round.wind
  const swayTop = swayOf(round.wind, stiffness)
  const win = strongEnough && !overBudget

  /** Put your name on the drawings and let the storm answer. */
  const signOff = () => {
    if (wonRound) return
    if (win) {
      setWonRound(true)
      setVerdict({ ok: true, text: 'Rock steady. The storm leans on it and it barely moves.' })
      lv.clearLevel(
        lv.level.metrics ? { cost, sway: swayTop, margin: stiffness - round.wind } : undefined,
      )
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const text = overBudget
      ? `Rejected: this design costs $${cost} and the developer capped it at $${round.budget}.`
      : `It failed the wind test: stiffness ${stiffness} against gusts of ${round.wind}. The top floors whipped around.`
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'Out of wind-tunnel slots. Back to the plain wood core. Compare stiffness per dollar before the next run.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  const reset = () => {
    setCoreId('wood')
    setDamper(false)
    setWide(false)
    setWonRound(false)
    setVerdict(null)
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

      <LevelHeader
        lv={lv}
        insight={round.swayReadout ? <InsightToggle label="sway" on={showSway} onChange={setShowSway} /> : undefined}
      />

      <Objective
        goal={`Beat wind ${round.wind} with stiffness${round.budget !== null ? ` on a $${round.budget} budget` : ''}`}
        status={`this design: stiffness ${stiffness} · $${cost}`}
        attemptsLeft={att.left}
        met={wonRound}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
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

            {/* tower body: a stack of floor blocks that shear apart as sway grows */}
            {Array.from({ length: round.floors }, (_, i) => {
              const row = round.floors - 1 - i // 0 = bottom block
              const heightFrac = (row + 1) / round.floors
              // Higher blocks slide further out of line, block-tower style.
              const shear = Math.sin(row * 2.1) * Math.min(7, sway * 0.55) * heightFrac
              const y = baseY - (row + 1) * floorH
              return (
                <g key={i}>
                  <RoughRect
                    x={374 + shear}
                    y={y}
                    width={52}
                    height={floorH - 2}
                    stroke="rgba(0,0,0,0.45)"
                    hatchStroke={core.fill}
                  />
                  <rect x={382 + shear} y={y + 6} width="12" height="10" rx="2" className="fill-sky-200/80 dark:fill-sky-900" />
                  <rect x={404 + shear} y={y + 6} width="12" height="10" rx="2" className="fill-sky-200/80 dark:fill-sky-900" />
                </g>
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
        {round.budget !== null ? (
          <Meter
            label="Budget"
            display={`$${cost} of $${round.budget}`}
            fraction={cost / round.budget}
            barClass={overBudget ? 'bg-rose-500' : cost / round.budget > 0.9 ? 'bg-amber-400' : 'bg-emerald-500'}
          />
        ) : (
          <p className="self-center font-display text-sm font-semibold text-ink-soft dark:text-stone-400">
            No budget this level. Cost so far: ${cost}
          </p>
        )}
        <Meter
          label="Stiffness"
          display={`${stiffness} vs wind ${round.wind}`}
          fraction={stiffness / 48}
          markerFraction={round.wind / 48}
          barClass={strongEnough ? 'bg-emerald-500' : 'bg-amber-400'}
        />
        {round.swayReadout && showSway && (
          <Meter
            label="Top-floor sway"
            display={`${swayTop}`}
            fraction={Math.min(1, swayTop / 20)}
            barClass={swayTop <= 9.8 ? 'bg-emerald-500' : 'bg-amber-400'}
          />
        )}
      </div>

      {/* Verdict: the storm only speaks after you sign off */}
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
          <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-400">
            Pick a core, add tricks if the budget allows, then sign off the design to face the storm.
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
                  onClick={() => { setVerdict(null); setCoreId(id) }}
                  className={cn(
                    'rounded-2xl border-2 p-3 text-left transition-colors duration-200',
                    coreId === id ? 'accent-border accent-soft' : 'border-stone-200 hover:border-stone-300 dark:border-white/10 dark:hover:border-white/25',
                  )}
                >
                  <span className="mb-1 block h-2.5 w-8 rounded-full" style={{ backgroundColor: c.fill }} />
                  <span className="font-display text-sm font-bold">{c.label}</span>
                  <span className="block text-xs font-mono tabular-nums text-ink-soft dark:text-stone-400">
                    ${c.cost} · stiff {c.stiff}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        {round.upgrades && (
        <div>
          <p className="mb-2 font-display text-sm font-semibold">2. Add upgrades</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setVerdict(null); setWide((v) => !v) }}
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
              onClick={() => { setVerdict(null); setDamper((v) => !v) }}
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
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={signOff} disabled={wonRound}>
          <ClipboardCheck className="h-5 w-5" />
          Sign off the design
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Reset the tower">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">{round.floors} floors</Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ cost, sway: swayTop, margin: stiffness - round.wind }}
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
              ? `Stands at ${swayTop} of sway for $${cost}. Try another combination.`
              : 'Rock steady. Build on.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
