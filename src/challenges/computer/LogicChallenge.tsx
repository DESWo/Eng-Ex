import { useEffect, useRef, useState } from 'react'
import { CheckCheck, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { InsightToggle } from '@/components/level/InsightToggle'
import { Objective } from '@/components/level/Objective'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import { useAttempts } from '@/hooks/useAttempts'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
type Gate = 'AND' | 'OR' | 'XOR'

const evalGate = (gate: Gate, a: boolean, b: boolean) => {
  switch (gate) {
    case 'AND':
      return a && b
    case 'OR':
      return a || b
    case 'XOR':
      return a !== b
  }
}

/** The circuit is a small chain: one main gate, then an optional inverter. */
const evalChain = (gate: Gate | null, invert: boolean, a: boolean, b: boolean) => {
  const mid = gate ? evalGate(gate, a, b) : a
  return invert ? !mid : mid
}

const ROWS: [boolean, boolean][] = [
  [false, false],
  [false, true],
  [true, false],
  [true, true],
]

interface LogicSetup {
  label: string
  goal: string
  /** The behaviour to match, as outputs for the four input rows. */
  truth: [boolean, boolean, boolean, boolean]
  /** Gates on the shelf. */
  options: Gate[]
  /** Level 3 on: the inverter bubble can be clicked onto the output. */
  inverter: boolean
  /** Level 4 on: the truth table fills in as rows are visited. */
  table: boolean
  /** Level 5 on: winning also requires having TESTED all four rows. */
  verify: boolean
  brief: string
}

const LEVELS: ChallengeLevel<LogicSetup>[] = [
  {
    n: 1,
    title: 'Two keys',
    phase: 'play',
    concept: 'AND against OR',
    teach: 'If you have ever wired switches in a block-building game, you have met gates. A gate is a rule about switches. AND wants both on, OR settles for either. Pick the gate that matches the story and flip the switches to check yourself.',
    setup: { label: 'Safe unlock', goal: 'The safe opens only when BOTH keys are turned at once.', truth: [false, false, false, true], options: ['AND', 'OR'], inverter: false, table: false, verify: false, brief: 'A bank safe with two key holders.' },
  },
  {
    n: 2,
    title: 'Exactly one',
    phase: 'understand',
    concept: 'The in-between rule',
    teach: 'Some rules fit neither AND nor OR. "Exactly one" is its own thing: true when the inputs DISAGREE. Engineers use it so often it gets its own gate.',
    setup: { label: 'One-cook kitchen', goal: 'The "busy" sign lights when exactly ONE cook is in. Both in, or neither, and it stays dark.', truth: [false, true, true, false], options: ['AND', 'OR', 'XOR'], inverter: false, table: false, verify: false, brief: 'A kitchen big enough for one cook and no more.' },
  },
  {
    n: 3,
    title: 'No single gate does it',
    phase: 'understand',
    concept: 'Combining gates',
    teach: 'This rule is the OPPOSITE of AND, and no gate on the shelf says that. Click the inverter bubble onto the output and you have built NAND out of two parts, which is how every complex chip is made.',
    setup: { label: 'Machine guard', goal: 'The cutter runs UNLESS both safety covers are open at once.', truth: [true, true, true, false], options: ['AND', 'OR', 'XOR'], inverter: true, table: false, verify: false, brief: 'A rule no single gate on the shelf can express.' },
  },
  {
    n: 4,
    title: 'Fill in the table',
    phase: 'analyze',
    concept: 'The truth table',
    teach: 'Turn on the table. Every row you actually test fills in, and four rows is the WHOLE story: a circuit and its truth table are the same thing written two ways.',
    setup: { label: 'Greenhouse vent', goal: 'The vent opens when the day is NOT hot and NOT humid together, in other words unless both sensors trip.', truth: [true, true, true, false], options: ['AND', 'OR', 'XOR'], inverter: true, table: true, verify: false, brief: 'Same kind of rule, now with the table filling in as you test.' },
  },
  {
    n: 5,
    title: 'Prove it works',
    phase: 'optimize',
    concept: 'Tested means all four rows',
    teach: 'This time the spec IS a truth table, and matching it is not enough: you must flip through all four input rows to prove it. Real engineers do not ship a chip on three rows out of four.',
    setup: { label: 'The spec sheet', goal: 'Match the target table exactly: output on only when both inputs are OFF.', truth: [true, false, false, false], options: ['AND', 'OR', 'XOR'], inverter: true, table: true, verify: true, brief: 'Build to the spec, then prove all four rows before sign-off.' },
    metrics: [
      { id: 'parts', label: 'Parts used', goal: 'min', target: 2 },
      { id: 'tested', label: 'Rows proven', goal: 'max', target: 4 },
      { id: 'swaps', label: 'Gate swaps', goal: 'min', target: 3 },
    ],
  },
]

export function LogicChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('logic', LEVELS)
  const round = lv.level.setup

  const [gate, setGate] = useState<Gate | null>(null)
  const [invert, setInvert] = useState(false)
  const [a, setA] = useState(false)
  const [b, setB] = useState(false)
  const [visited, setVisited] = useState<Set<number>>(new Set([0]))
  const [swaps, setSwaps] = useState(0)
  const [wonRound, setWonRound] = useState(false)
  const [showTable, setShowTable] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    setGate(null)
    setInvert(false)
    setA(false)
    setB(false)
    setVisited(new Set([0]))
    setSwaps(0)
    setWonRound(false)
    setVerdict(null)
  }, [lv.level.n])

  const rowIndex = (ra: boolean, rb: boolean) => (ra ? 2 : 0) + (rb ? 1 : 0)
  const output = evalChain(gate, invert, a, b)

  // Track which rows the player has actually put on the switches.
  useEffect(() => {
    setVisited((prev) => {
      const i = rowIndex(a, b)
      if (prev.has(i)) return prev
      const next = new Set(prev)
      next.add(i)
      return next
    })
  }, [a, b])

  const matches = ROWS.every(([ra, rb], i) => evalChain(gate, invert, ra, rb) === round.truth[i])
  const circuitBuilt = gate !== null || invert
  const proven = !round.verify || visited.size === 4
  const correct = circuitBuilt && matches && proven

  /** Three submissions per level; a guessed gate costs real bench time. */
  const att = useAttempts(lv.level.n === 1 ? null : 3, lv.level.n)
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)

  /** Declare the circuit finished and let the rule book check it. */
  const declare = () => {
    if (wonRound) return
    if (correct) {
      setWonRound(true)
      setVerdict({ ok: true, text: round.inverter && invert ? 'Built it from two parts. That is real logic design.' : 'That is the one!' })
      lv.clearLevel(
        lv.level.metrics
          ? { parts: (gate ? 1 : 0) + (invert ? 1 : 0), tested: visited.size, swaps }
          : undefined,
      )
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const text = !circuitBuilt
      ? 'There is no circuit on the bench yet.'
      : matches && !proven
        ? `You have only proven ${visited.size} of 4 switch combinations. Flip the switches through every row before declaring it.`
        : 'Rejected: the light disagrees with the rule on at least one switch combination. Work through the rows.'
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'Bench cleared. Write the truth table on paper first, then build the gate that matches it.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  const reset = () => {
    setGate(null)
    setInvert(false)
    setA(false)
    setB(false)
    setVisited(new Set([0]))
    setSwaps(0)
    setWonRound(false)
    setVerdict(null)
  }

  const pickGate = (g: Gate) => {
    setGate((prev) => {
      if (prev !== g) setSwaps((n) => n + 1)
      return g
    })
    setWonRound(false)
  }

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={round.table ? <InsightToggle label="truth table" on={showTable} onChange={setShowTable} /> : undefined}
      />

      <Objective
        goal={`Build a circuit that matches the rule on all 4 switch rows${round.verify ? ', and prove every row on the bench' : ''}`}
        status={round.verify ? `${visited.size} of 4 rows tested` : undefined}
        attemptsLeft={att.left}
        met={wonRound}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
      </div>

      {/* The rule */}
      <Card className="accent-softer accent-border mb-4 border-2 p-4">
        <p className="accent-text font-display text-xs font-bold uppercase tracking-widest">The rule</p>
        <p className="mt-1 font-display font-semibold leading-snug">{round.goal}</p>
        {round.verify && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 font-display text-sm font-semibold text-ink-soft dark:text-stone-400">
            Target:
            {ROWS.map(([ra, rb], i) => (
              <span key={i} className="rounded bg-stone-100 px-1.5 py-0.5 tabular-nums dark:bg-white/10">
                {ra ? 1 : 0}
                {rb ? 1 : 0}→{round.truth[i] ? 1 : 0}
              </span>
            ))}
          </p>
        )}
      </Card>

      {/* The gadget: switches -> gate -> optional inverter -> bulb */}
      <div className="overflow-hidden rounded-2xl bg-stone-100/80 dark:bg-white/5">
        <svg viewBox="0 0 800 220" className="w-full" role="img" aria-label="Logic gadget">
          <line x1="180" y1="70" x2="360" y2="90" strokeWidth="4" className={a ? 'stroke-amber-400' : 'stroke-stone-400 dark:stroke-stone-600'} />
          <line x1="180" y1="150" x2="360" y2="130" strokeWidth="4" className={b ? 'stroke-amber-400' : 'stroke-stone-400 dark:stroke-stone-600'} />
          <line x1="500" y1="110" x2="600" y2="110" strokeWidth="4" className={output ? 'stroke-amber-400' : 'stroke-stone-400 dark:stroke-stone-600'} />

          {/* gate box */}
          <rect x="360" y="72" width="110" height="76" rx="12" className="fill-white stroke-stone-300 dark:fill-night-panel dark:stroke-white/15" strokeWidth="2" />
          <text x="415" y="118" textAnchor="middle" fontSize="22" fontWeight="800" className="fill-ink font-display dark:fill-stone-100">
            {gate ?? '?'}
          </text>

          {/* the inverter bubble on the output */}
          {round.inverter && (
            <circle
              cx="484"
              cy="110"
              r="13"
              role="switch"
              aria-checked={invert}
              aria-label="Inverter bubble: flips the output"
              tabIndex={0}
              onClick={() => {
                setInvert((v) => !v)
                setWonRound(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setInvert((v) => !v)
                  setWonRound(false)
                }
              }}
              strokeWidth="3"
              className={cn(
                'cursor-pointer outline-none',
                invert
                  ? 'fill-ink stroke-ink dark:fill-stone-100 dark:stroke-stone-100'
                  : 'fill-white stroke-stone-400 [stroke-dasharray:4_3] dark:fill-night-panel dark:stroke-stone-500',
              )}
            />
          )}
          {round.inverter && (
            <text x="484" y="150" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
              {invert ? 'inverted' : 'click to invert'}
            </text>
          )}

          {/* bulb */}
          {output && <circle cx="640" cy="110" r="42" fill="#fde047" opacity="0.3" />}
          <circle cx="640" cy="110" r="26" className={output ? 'fill-yellow-300' : 'fill-stone-300 dark:fill-stone-600'} />
          <rect x="630" y="134" width="20" height="12" rx="3" className="fill-stone-500" />

          <text x="150" y="76" textAnchor="end" fontSize="14" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">A</text>
          <text x="150" y="156" textAnchor="end" fontSize="14" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">B</text>
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
          className={cn(
            'rounded-full border-2 px-5 py-2 font-display text-sm font-bold transition-colors duration-200',
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
              onClick={() => pickGate(g)}
              aria-pressed={gate === g}
              className={cn(
                'rounded-2xl border-2 px-5 py-2.5 font-display text-sm font-bold transition-colors duration-200',
                gate === g ? 'accent-border accent-soft accent-text' : 'border-stone-200 hover:border-stone-300 dark:border-white/10 dark:hover:border-white/25',
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Truth table that fills in as rows are actually tested */}
      {round.table && showTable && (
        <div className="mt-4 inline-block rounded-2xl border border-stone-200 p-3 dark:border-white/10">
          <table className="text-sm tabular-nums">
            <thead>
              <tr className="text-ink-soft dark:text-stone-400">
                <th className="px-3 font-display font-semibold">A</th>
                <th className="px-3 font-display font-semibold">B</th>
                <th className="px-3 font-display font-semibold">Light</th>
                {round.verify && <th className="px-3 font-display font-semibold">Target</th>}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([ra, rb], i) => {
                const seen = visited.has(rowIndex(ra, rb))
                const out = evalChain(gate, invert, ra, rb)
                const isCurrent = ra === a && rb === b
                return (
                  <tr key={i} className={cn('border-t border-stone-100 dark:border-white/5', isCurrent && 'bg-amber-50 dark:bg-amber-500/10')}>
                    <td className="px-3 text-center">{ra ? '1' : '0'}</td>
                    <td className="px-3 text-center">{rb ? '1' : '0'}</td>
                    <td className={cn('px-3 text-center font-bold', !seen ? 'text-stone-300 dark:text-stone-600' : out ? 'text-amber-500' : 'text-stone-400')}>
                      {seen ? (out ? '1' : '0') : '?'}
                    </td>
                    {round.verify && (
                      <td className={cn('px-3 text-center font-bold', round.truth[i] ? 'text-emerald-500' : 'text-stone-400')}>
                        {round.truth[i] ? '1' : '0'}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-1.5 max-w-56 text-xs text-ink-soft dark:text-stone-400">
            Rows fill in when you actually set the switches to them.
          </p>
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
            Build the circuit, test it with the switches, then declare it done.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={declare} disabled={wonRound}>
          <CheckCheck className="h-5 w-5" />
          Declare it done
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Clear the gate">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        {round.verify && <Badge className="ml-auto">Rows proven: {visited.size} / 4</Badge>}
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ parts: (gate ? 1 : 0) + (invert ? 1 : 0), tested: visited.size, swaps }}
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
              ? `Spec met and proven on all four rows in ${swaps} swap${swaps === 1 ? '' : 's'}.`
              : 'Rule matched.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
