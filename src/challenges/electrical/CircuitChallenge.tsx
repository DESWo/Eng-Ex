import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, RotateCcw, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { simulate, type SimPart } from '@/challenges/electrical/circuitSim'
import type { ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const VOLTAGE = 9
const BULB: Omit<SimPart, 'id'> = { resistance: 6, ratedCurrent: 1.5 } // full at 9V alone
const FULL = 0.9 // counts as "full brightness" at 90% or more
const LIT = 0.15 // anything above this is visibly glowing

type PartKind = 'bulb' | 'switch'

interface BoardPart {
  id: string
  kind: PartKind
  label: string
  x: number
  y: number
}

interface Requirement {
  /** Which bulb this is about. */
  id: string
  want: 'full' | 'off'
  /** Check with every switch open instead of closed. */
  switchesOpen?: boolean
  text: string
}

interface CircuitRound {
  label: string
  brief: string
  parts: BoardPart[]
  requirements: Requirement[]
}

/** Each round adds one new wiring idea. */
const ROUNDS: CircuitRound[] = [
  {
    label: 'Build 1: First light',
    brief: 'Wire the bulb to the battery so it lights up.',
    parts: [{ id: 'b1', kind: 'bulb', label: 'Bulb', x: 420, y: 180 }],
    requirements: [{ id: 'b1', want: 'full', text: 'Bulb glows at full brightness' }],
  },
  {
    label: 'Build 2: Put it on a switch',
    brief: 'The bulb should light, but only while the switch is closed.',
    parts: [
      { id: 's1', kind: 'switch', label: 'Switch', x: 340, y: 95 },
      { id: 'b1', kind: 'bulb', label: 'Bulb', x: 560, y: 190 },
    ],
    requirements: [
      { id: 'b1', want: 'full', text: 'Bulb is full when the switch is closed' },
      { id: 'b1', want: 'off', switchesOpen: true, text: 'Bulb goes out when the switch opens' },
    ],
  },
  {
    label: 'Build 3: Two bulbs, both bright',
    brief: 'Light BOTH bulbs at full brightness from the one battery.',
    parts: [
      { id: 'b1', kind: 'bulb', label: 'Bulb A', x: 430, y: 105 },
      { id: 'b2', kind: 'bulb', label: 'Bulb B', x: 430, y: 265 },
    ],
    requirements: [
      { id: 'b1', want: 'full', text: 'Bulb A at full brightness' },
      { id: 'b2', want: 'full', text: 'Bulb B at full brightness' },
    ],
  },
  {
    label: 'Build 4: Control just one',
    brief: 'Both bulbs full, but the switch must turn off ONLY bulb B.',
    parts: [
      { id: 'b1', kind: 'bulb', label: 'Bulb A', x: 400, y: 100 },
      { id: 'b2', kind: 'bulb', label: 'Bulb B', x: 400, y: 265 },
      { id: 's1', kind: 'switch', label: 'Switch', x: 620, y: 265 },
    ],
    requirements: [
      { id: 'b1', want: 'full', text: 'Bulb A at full brightness' },
      { id: 'b2', want: 'full', text: 'Bulb B at full brightness' },
      { id: 'b1', want: 'full', switchesOpen: true, text: 'Bulb A stays on when the switch opens' },
      { id: 'b2', want: 'off', switchesOpen: true, text: 'Bulb B goes out when the switch opens' },
    ],
  },
]

/* Terminal positions, relative to each part. */
const termOffset = { a: -52, b: 52 }
const terminalId = (partId: string, side: 'a' | 'b') => `${partId}.${side}`
const BAT_P = 'bat.p'
const BAT_N = 'bat.n'
const BAT = { x: 120, y: 185, plus: { x: 170, y: 135 }, minus: { x: 170, y: 235 } }

const wireKey = (a: string, b: string) => [a, b].sort().join('~')

export function CircuitChallenge({ onComplete }: ChallengeProps) {
  const [roundIndex, setRoundIndex] = useState(0)
  const round = ROUNDS[roundIndex % ROUNDS.length]

  const [wires, setWires] = useState<[string, string][]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [switchOn, setSwitchOn] = useState(true)
  const [wonRound, setWonRound] = useState(false)
  const completedRef = useRef(false)

  /** Clear the board in the SAME update as the round change, so a render never
   *  sees wires belonging to parts the new round does not have. */
  const goToRound = (next: number) => {
    setWires([])
    setSelected(null)
    setSwitchOn(true)
    setWonRound(false)
    setRoundIndex(next)
  }

  const bulbs = round.parts.filter((p) => p.kind === 'bulb')
  const switches = round.parts.filter((p) => p.kind === 'switch')

  /** Null when the terminal does not belong to this round (e.g. leftover wires). */
  const terminalPos = (id: string): { x: number; y: number } | null => {
    if (id === BAT_P) return BAT.plus
    if (id === BAT_N) return BAT.minus
    const [partId, side] = id.split('.') as [string, 'a' | 'b']
    const part = round.parts.find((p) => p.id === partId)
    if (!part) return null
    return { x: part.x + termOffset[side], y: part.y }
  }

  /** Run the circuit with switches either closed or open. */
  const runSim = (closed: boolean) => {
    const connections: [string, string][] = [...wires]
    if (closed) {
      for (const s of switches) connections.push([terminalId(s.id, 'a'), terminalId(s.id, 'b')])
    }
    return simulate(
      connections,
      bulbs.map((b) => ({ part: { id: b.id, ...BULB }, a: terminalId(b.id, 'a'), b: terminalId(b.id, 'b') })),
      BAT_P,
      BAT_N,
      VOLTAGE,
    )
  }

  const simClosed = useMemo(() => runSim(true), [wires, round]) // eslint-disable-line react-hooks/exhaustive-deps
  const simOpen = useMemo(() => runSim(false), [wires, round]) // eslint-disable-line react-hooks/exhaustive-deps
  /** What the board is actually doing right now, given the switch position. */
  const live = switchOn ? simClosed : simOpen

  const met = (req: Requirement) => {
    const sim = req.switchesOpen ? simOpen : simClosed
    if (sim.short) return false
    const p = sim.power[req.id] ?? 0
    return req.want === 'full' ? p >= FULL : p < LIT
  }
  const allMet = round.requirements.every(met) && !simClosed.short

  useEffect(() => {
    if (allMet && !wonRound) {
      setWonRound(true)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }
  }, [allMet, wonRound, onComplete])

  const clickTerminal = (id: string) => {
    if (selected === null) {
      setSelected(id)
      return
    }
    if (selected === id) {
      setSelected(null)
      return
    }
    const key = wireKey(selected, id)
    if (!wires.some(([a, b]) => wireKey(a, b) === key)) {
      setWires((prev) => [...prev, [selected, id]])
    }
    setSelected(null)
  }

  const removeWire = (key: string) => setWires((prev) => prev.filter(([a, b]) => wireKey(a, b) !== key))
  const undo = () => {
    setWires((prev) => prev.slice(0, -1))
    setSelected(null)
  }
  const reset = () => {
    setWires([])
    setSelected(null)
    setWonRound(false)
  }
  const nextRound = () => goToRound(roundIndex + 1)

  const allTerminals = [
    BAT_P,
    BAT_N,
    ...round.parts.flatMap((p) => [terminalId(p.id, 'a'), terminalId(p.id, 'b')]),
  ]

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-md">
          <p className="text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
          <p className="mt-1 text-xs text-ink-soft dark:text-stone-500">
            Click a terminal, then another, to run a wire. Click a wire to remove it.
          </p>
        </div>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
      </div>

      {/* Board */}
      <div className="overflow-hidden rounded-2xl bg-stone-100/80 dark:bg-white/5">
        <svg viewBox="0 0 800 360" className="w-full" role="img" aria-label="Circuit board">
          {/* wires */}
          {wires.map(([a, b]) => {
            const pa = terminalPos(a)
            const pb = terminalPos(b)
            const key = wireKey(a, b)
            if (!pa || !pb) return null
            return (
              <g key={key} onClick={() => removeWire(key)} className="cursor-pointer">
                <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="transparent" strokeWidth="16" />
                <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#d97706" strokeWidth="5" strokeLinecap="round" />
              </g>
            )
          })}

          {/* battery */}
          <g>
            <rect x={BAT.x - 34} y={BAT.y - 60} width="68" height="120" rx="10" className="fill-stone-700 dark:fill-stone-600" />
            <text x={BAT.x} y={BAT.y + 6} textAnchor="middle" fontSize="17" fontWeight="800" className="fill-white font-display">
              {VOLTAGE}V
            </text>
            <line x1={BAT.x + 34} y1={BAT.plus.y} x2={BAT.plus.x} y2={BAT.plus.y} strokeWidth="4" className="stroke-stone-500" />
            <line x1={BAT.x + 34} y1={BAT.minus.y} x2={BAT.minus.x} y2={BAT.minus.y} strokeWidth="4" className="stroke-stone-500" />
            <text x={BAT.plus.x + 16} y={BAT.plus.y + 5} fontSize="18" fontWeight="800" className="fill-rose-500 font-display">+</text>
            <text x={BAT.minus.x + 16} y={BAT.minus.y + 6} fontSize="18" fontWeight="800" className="fill-ink-soft font-display dark:fill-stone-300">−</text>
          </g>

          {/* parts */}
          {round.parts.map((part) => {
            if (part.kind === 'bulb') {
              const p = live.short ? 0 : live.power[part.id] ?? 0
              const glow = Math.max(0, Math.min(1, p))
              return (
                <g key={part.id}>
                  <line x1={part.x + termOffset.a} y1={part.y} x2={part.x - 16} y2={part.y} strokeWidth="4" className="stroke-stone-500" />
                  <line x1={part.x + 16} y1={part.y} x2={part.x + termOffset.b} y2={part.y} strokeWidth="4" className="stroke-stone-500" />
                  {glow > LIT && <circle cx={part.x} cy={part.y} r={26 + glow * 16} fill="#fde047" opacity={0.16 + glow * 0.24} />}
                  <circle
                    cx={part.x}
                    cy={part.y}
                    r="22"
                    className={glow > LIT ? '' : 'fill-stone-300 dark:fill-stone-600'}
                    style={glow > LIT ? { fill: `rgb(253, ${200 + Math.round(glow * 40)}, ${71 + Math.round(glow * 60)})` } : undefined}
                  />
                  <text x={part.x} y={part.y + 48} textAnchor="middle" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                    {part.label}
                    {glow > LIT && glow < FULL ? ' (dim)' : ''}
                  </text>
                </g>
              )
            }
            // switch
            const a = { x: part.x + termOffset.a, y: part.y }
            const b = { x: part.x + termOffset.b, y: part.y }
            return (
              <g key={part.id}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={switchOn ? b.x : b.x - 14}
                  y2={switchOn ? b.y : b.y - 26}
                  strokeWidth="5"
                  strokeLinecap="round"
                  className={switchOn ? 'stroke-emerald-500' : 'stroke-stone-400'}
                />
                <rect
                  x={part.x - 46}
                  y={part.y - 34}
                  width="92"
                  height="54"
                  rx="10"
                  fill="transparent"
                  onClick={() => setSwitchOn((v) => !v)}
                  className="cursor-pointer"
                />
                <text x={part.x} y={part.y + 40} textAnchor="middle" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                  {part.label}: {switchOn ? 'closed' : 'open'} (tap)
                </text>
              </g>
            )
          })}

          {/* terminals on top */}
          {allTerminals.map((id) => {
            const p = terminalPos(id)
            const isSel = selected === id
            if (!p) return null
            return (
              <g key={id} onClick={() => clickTerminal(id)} className="cursor-pointer">
                <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isSel ? 8 : 6}
                  className={isSel ? 'fill-[var(--accent)]' : 'fill-stone-600 dark:fill-stone-300'}
                  stroke="white"
                  strokeWidth="2.5"
                />
              </g>
            )
          })}
        </svg>
      </div>

      {/* Requirements checklist */}
      <div className="mt-4 flex flex-wrap gap-2">
        {round.requirements.map((req) => {
          const ok = met(req)
          return (
            <span
              key={req.text}
              className={cn(
                'rounded-full px-3 py-1.5 font-display text-sm font-semibold',
                ok
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-stone-100 text-ink-soft dark:bg-white/10 dark:text-stone-400',
              )}
            >
              {ok ? '✓' : '○'} {req.text}
            </span>
          )
        })}
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-3 min-h-[2.5rem]">
        {simClosed.short ? (
          <p className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Short circuit! A wire runs straight from + back to − with nothing in between, so all the
            power races through it.
          </p>
        ) : wonRound ? (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            That circuit does exactly what was asked. Nice wiring.
          </motion.p>
        ) : (
          <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-300">
            {bulbs.some((b) => (live.power[b.id] ?? 0) > LIT && (live.power[b.id] ?? 0) < FULL)
              ? 'Something is glowing, but not at full strength.'
              : 'Wire the parts up and watch what happens.'}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {wonRound && (roundIndex % ROUNDS.length) < ROUNDS.length - 1 && (
          <Button variant="accent" onClick={nextRound}>
            Next build
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        {wonRound && (roundIndex % ROUNDS.length) === ROUNDS.length - 1 && (
          <Button variant="accent" onClick={nextRound}>
            Start over from build 1
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" onClick={undo} disabled={wires.length === 0} aria-label="Undo last wire">
          <Undo2 className="h-4 w-4" />
          Undo
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Remove all wires">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>
    </Card>
  )
}
