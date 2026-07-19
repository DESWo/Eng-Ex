import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Slider } from '@/components/ui/Slider'
import type { ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const WEIGHT_OPTIONS = [10, 20, 30, 40, 50] // kg
const TOLERANCE = 10 // how close the twist totals must be to count as balanced

interface Crate {
  weight: number
  /** Position mark 1 to 10, measured out from the pivot on the LEFT side. */
  mark: number
}

/** Each win loads new cargo onto the left side. */
const ROUNDS: { crates: Crate[] }[] = [
  { crates: [{ weight: 30, mark: 6 }] },
  { crates: [{ weight: 20, mark: 8 }, { weight: 10, mark: 3 }] },
  { crates: [{ weight: 50, mark: 7 }] },
  { crates: [{ weight: 40, mark: 5 }, { weight: 20, mark: 2 }] },
  { crates: [{ weight: 50, mark: 8 }, { weight: 10, mark: 5 }] },
]

/* ------------------- scene constants (SVG pixels) ------------------- */
const PIVOT_X = 400
const BEAM_Y = 200
const PX_PER_MARK = 34

export function BeamChallenge({ onComplete }: ChallengeProps) {
  const [roundIndex, setRoundIndex] = useState(0)
  const [weight, setWeight] = useState(20)
  const [mark, setMark] = useState(5)
  const [wonRound, setWonRound] = useState(false)
  const completedRef = useRef(false)

  const round = ROUNDS[roundIndex % ROUNDS.length]
  const leftTwist = round.crates.reduce((sum, c) => sum + c.weight * c.mark, 0)
  const rightTwist = weight * mark
  const diff = rightTwist - leftTwist
  const balanced = Math.abs(diff) <= TOLERANCE
  // Positive diff tips the beam to the right (clockwise).
  const tilt = Math.max(-11, Math.min(11, diff / 18))

  // Hold the balance for a moment before it counts, so sweeping
  // the slider through the sweet spot is not an instant win.
  useEffect(() => {
    if (!balanced || wonRound) return
    const timer = setTimeout(() => {
      setWonRound(true)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [balanced, wonRound, onComplete])

  const nextRound = () => {
    setRoundIndex((i) => i + 1)
    setWeight(20)
    setMark(5)
    setWonRound(false)
  }

  const reset = () => {
    setWeight(20)
    setMark(5)
  }

  const counterSize = 24 + weight * 0.4

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <p className="mb-4 text-sm text-ink-soft dark:text-stone-400">
        Cargo landed on the left side. Use one counterweight on the right to get the beam level and
        keep it there.
      </p>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-sky-100/70 dark:bg-sky-950/40">
        <svg viewBox="0 0 800 330" className="w-full" role="img" aria-label="Balance beam scene">
          {/* ground + pivot */}
          <rect x="0" y="290" width="800" height="40" className="fill-emerald-200 dark:fill-emerald-950" />
          <path d={`M${PIVOT_X - 34} 290 L${PIVOT_X} ${BEAM_Y + 8} L${PIVOT_X + 34} 290 Z`} className="fill-stone-500 dark:fill-stone-500" />

          {/* everything on the beam tilts together around the pivot */}
          <g
            style={{
              transformBox: 'view-box',
              transformOrigin: `${PIVOT_X}px ${BEAM_Y}px`,
              transform: `rotate(${tilt}deg)`,
              transition: 'transform 0.5s cubic-bezier(0.34, 1.2, 0.64, 1)',
            }}
          >
            <rect x={PIVOT_X - 10.5 * PX_PER_MARK} y={BEAM_Y - 6} width={21 * PX_PER_MARK} height="12" rx="6" className="fill-amber-700 dark:fill-amber-600" />
            {/* position marks */}
            {Array.from({ length: 10 }, (_, i) => i + 1).map((m) => (
              <g key={m}>
                <line x1={PIVOT_X - m * PX_PER_MARK} y1={BEAM_Y - 6} x2={PIVOT_X - m * PX_PER_MARK} y2={BEAM_Y + 6} strokeWidth="2" className="stroke-amber-900/40 dark:stroke-amber-950/60" />
                <line x1={PIVOT_X + m * PX_PER_MARK} y1={BEAM_Y - 6} x2={PIVOT_X + m * PX_PER_MARK} y2={BEAM_Y + 6} strokeWidth="2" className="stroke-amber-900/40 dark:stroke-amber-950/60" />
              </g>
            ))}

            {/* cargo crates on the left */}
            {round.crates.map((crate, i) => {
              const size = 24 + crate.weight * 0.4
              const x = PIVOT_X - crate.mark * PX_PER_MARK
              return (
                <g key={i}>
                  <rect x={x - size / 2} y={BEAM_Y - 6 - size} width={size} height={size} rx="5" className="fill-stone-500 dark:fill-stone-400" />
                  <text x={x} y={BEAM_Y - 6 - size / 2 + 5} textAnchor="middle" fontSize="14" fontWeight="700" className="fill-white font-display">
                    {crate.weight}
                  </text>
                </g>
              )
            })}

            {/* the player's counterweight on the right */}
            <g>
              <rect
                x={PIVOT_X + mark * PX_PER_MARK - counterSize / 2}
                y={BEAM_Y - 6 - counterSize}
                width={counterSize}
                height={counterSize}
                rx="5"
                style={{ fill: 'var(--accent)' }}
              />
              <text
                x={PIVOT_X + mark * PX_PER_MARK}
                y={BEAM_Y - 6 - counterSize / 2 + 5}
                textAnchor="middle"
                fontSize="14"
                fontWeight="700"
                className="fill-white font-display"
              >
                {weight}
              </text>
            </g>
          </g>
        </svg>
      </div>

      {/* Readout */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        {wonRound ? (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
          >
            Perfectly balanced! Left twist {leftTwist}, right twist {rightTwist}.
          </motion.p>
        ) : (
          <p
            className={cn(
              'rounded-xl px-4 py-2.5 text-sm font-semibold',
              balanced
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-stone-100 text-ink-soft dark:bg-white/5 dark:text-stone-300',
            )}
          >
            {balanced
              ? 'Steady... hold it there!'
              : diff < 0
                ? 'The cargo side is dropping. It out-twists your counterweight right now.'
                : 'Your counterweight side is dropping. It out-twists the cargo right now.'}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 grid items-end gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 font-display text-sm font-semibold">Counterweight (kg)</p>
          <div className="flex flex-wrap gap-2">
            {WEIGHT_OPTIONS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeight(w)}
                className={cn(
                  'rounded-full border-2 px-4 py-1.5 font-display text-sm font-bold tabular-nums transition-colors duration-200',
                  weight === w
                    ? 'accent-border accent-soft accent-text'
                    : 'border-stone-200 text-ink-soft hover:border-stone-300 dark:border-white/10 dark:text-stone-400 dark:hover:border-white/25',
                )}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
        <Slider label="Distance from the middle" value={mark} min={1} max={10} onChange={setMark} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {wonRound && (
          <Button variant="accent" onClick={nextRound}>
            New cargo
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" onClick={reset} aria-label="Reset the counterweight">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Round {(roundIndex % ROUNDS.length) + 1}</Badge>
      </div>
    </Card>
  )
}
