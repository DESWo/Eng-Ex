import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import type { ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
type Gate = 'AND' | 'OR' | 'XOR' | 'NOT'

const evalGate = (gate: Gate, a: boolean, b: boolean) => {
  switch (gate) {
    case 'AND':
      return a && b
    case 'OR':
      return a || b
    case 'XOR':
      return a !== b
    case 'NOT':
      return !a
  }
}

const GATE_HINT: Record<Gate, string> = {
  AND: 'ON only when BOTH inputs are on',
  OR: 'ON when EITHER input is on',
  XOR: 'ON when the inputs are DIFFERENT',
  NOT: 'flips input A: ON becomes off',
}

interface LogicRound {
  label: string
  goal: string
  answer: Gate
  options: Gate[]
}

/** Each win is a new logic rule to match. */
const ROUNDS: LogicRound[] = [
  {
    label: 'Safe unlock',
    goal: 'The safe opens only when BOTH keys are turned at once.',
    answer: 'AND',
    options: ['AND', 'OR'],
  },
  {
    label: 'Hallway light',
    goal: 'The light turns on if EITHER switch is flipped.',
    answer: 'OR',
    options: ['AND', 'OR', 'NOT'],
  },
  {
    label: 'One-cook kitchen',
    goal: 'The sign says "busy" when exactly ONE cook is in, but not when both or neither are.',
    answer: 'XOR',
    options: ['AND', 'OR', 'XOR'],
  },
  {
    label: 'Night light',
    goal: 'The lamp is ON when it is NOT bright out (input A off).',
    answer: 'NOT',
    options: ['AND', 'OR', 'XOR', 'NOT'],
  },
]

export function LogicChallenge({ onComplete }: ChallengeProps) {
  const [roundIndex, setRoundIndex] = useState(0)
  const round = ROUNDS[roundIndex % ROUNDS.length]

  const [gate, setGate] = useState<Gate | null>(null)
  const [a, setA] = useState(false)
  const [b, setB] = useState(false)
  const [wonRound, setWonRound] = useState(false)
  const completedRef = useRef(false)

  const singleInput = gate === 'NOT'
  const output = gate ? evalGate(gate, a, b) : false
  const correct = gate === round.answer

  useEffect(() => {
    if (correct && !wonRound) {
      setWonRound(true)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }
  }, [correct, wonRound, onComplete])

  const nextRound = () => {
    setRoundIndex((i) => i + 1)
    setGate(null)
    setA(false)
    setB(false)
    setWonRound(false)
  }

  const reset = () => {
    setGate(null)
    setA(false)
    setB(false)
    setWonRound(false)
  }

  const rows = singleInput
    ? [[false], [true]]
    : [
        [false, false],
        [false, true],
        [true, false],
        [true, true],
      ]

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">
          Pick the logic gate that matches the rule. Flip the switches to test how your gate behaves.
        </p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
      </div>

      {/* The rule */}
      <Card className="accent-softer accent-border mb-4 border-2 p-4">
        <p className="accent-text font-display text-xs font-bold uppercase tracking-widest">The rule</p>
        <p className="mt-1 font-display font-semibold leading-snug">{round.goal}</p>
      </Card>

      {/* The gadget: switches -> gate -> bulb */}
      <div className="overflow-hidden rounded-2xl bg-stone-100/80 dark:bg-white/5">
        <svg viewBox="0 0 800 220" className="w-full" role="img" aria-label="Logic gadget">
          {/* wires */}
          <line x1="180" y1="70" x2="360" y2="90" strokeWidth="4" className={a ? 'stroke-amber-400' : 'stroke-stone-400 dark:stroke-stone-600'} />
          {!singleInput && (
            <line x1="180" y1="150" x2="360" y2="130" strokeWidth="4" className={b ? 'stroke-amber-400' : 'stroke-stone-400 dark:stroke-stone-600'} />
          )}
          <line x1="470" y1="110" x2="600" y2="110" strokeWidth="4" className={output ? 'stroke-amber-400' : 'stroke-stone-400 dark:stroke-stone-600'} />

          {/* gate box */}
          <rect x="360" y="72" width="110" height="76" rx="12" className="fill-white stroke-stone-300 dark:fill-night-panel dark:stroke-white/15" strokeWidth="2" />
          <text x="415" y="118" textAnchor="middle" fontSize="22" fontWeight="800" className="fill-ink font-display dark:fill-stone-100">
            {gate ?? '?'}
          </text>

          {/* bulb */}
          {output && <circle cx="640" cy="110" r="42" fill="#fde047" opacity="0.3" />}
          <circle cx="640" cy="110" r="26" className={output ? 'fill-yellow-300' : 'fill-stone-300 dark:fill-stone-600'} />
          <rect x="630" y="134" width="20" height="12" rx="3" className="fill-stone-500" />

          {/* input labels */}
          <text x="150" y="76" textAnchor="end" fontSize="14" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">A</text>
          {!singleInput && (
            <text x="150" y="156" textAnchor="end" fontSize="14" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">B</text>
          )}
        </svg>
      </div>

      {/* Switch toggles */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setA((v) => !v)}
          className={cn(
            'rounded-full border-2 px-5 py-2 font-display text-sm font-bold transition-colors duration-200',
            a ? 'border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'border-stone-200 text-ink-soft dark:border-white/10 dark:text-stone-400',
          )}
        >
          Switch A: {a ? 'ON' : 'off'}
        </button>
        <button
          type="button"
          onClick={() => setB((v) => !v)}
          disabled={singleInput}
          className={cn(
            'rounded-full border-2 px-5 py-2 font-display text-sm font-bold transition-colors duration-200 disabled:opacity-40',
            b ? 'border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'border-stone-200 text-ink-soft dark:border-white/10 dark:text-stone-400',
          )}
        >
          Switch B: {b ? 'ON' : 'off'}
        </button>
        <span className="font-display text-sm font-semibold text-ink-soft dark:text-stone-400">
          Light: <span className={output ? 'text-amber-500' : ''}>{output ? 'ON' : 'off'}</span>
        </span>
      </div>

      {/* Gate picker */}
      <div className="mt-4">
        <p className="mb-2 font-display text-sm font-semibold">Choose a gate</p>
        <div className="flex flex-wrap gap-2">
          {round.options.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGate(g)}
              aria-pressed={gate === g}
              className={cn(
                'rounded-2xl border-2 px-4 py-2 text-left transition-colors duration-200',
                gate === g ? 'accent-border accent-soft accent-text' : 'border-stone-200 hover:border-stone-300 dark:border-white/10 dark:hover:border-white/25',
              )}
            >
              <span className="font-display text-sm font-bold">{g}</span>
              <span className="block text-xs text-ink-soft dark:text-stone-400">{GATE_HINT[g]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Live truth table for the chosen gate */}
      {gate && (
        <div className="mt-4 inline-block rounded-2xl border border-stone-200 p-3 dark:border-white/10">
          <table className="text-sm tabular-nums">
            <thead>
              <tr className="text-ink-soft dark:text-stone-400">
                <th className="px-3 font-display font-semibold">A</th>
                {!singleInput && <th className="px-3 font-display font-semibold">B</th>}
                <th className="px-3 font-display font-semibold">Light</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const out = evalGate(gate, r[0], r[1] ?? false)
                return (
                  <tr key={i} className="border-t border-stone-100 dark:border-white/5">
                    <td className="px-3 text-center">{r[0] ? '1' : '0'}</td>
                    {!singleInput && <td className="px-3 text-center">{r[1] ? '1' : '0'}</td>}
                    <td className={cn('px-3 text-center font-bold', out ? 'text-amber-500' : 'text-stone-400')}>{out ? '1' : '0'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Feedback */}
      <div aria-live="polite" className="mt-3 min-h-[2.5rem]">
        {wonRound ? (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            That is the one! A <span className="font-bold">{round.answer}</span> gate does exactly that.
          </motion.p>
        ) : gate && !correct ? (
          <p className="rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            Not quite. Flip the switches and compare this gate's lights to the rule.
          </p>
        ) : (
          <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-300">
            Pick a gate to see how it behaves.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {wonRound && (
          <Button variant="accent" onClick={nextRound}>
            Next gadget
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" onClick={reset} aria-label="Clear the gate">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Round {(roundIndex % ROUNDS.length) + 1}</Badge>
      </div>
    </Card>
  )
}
