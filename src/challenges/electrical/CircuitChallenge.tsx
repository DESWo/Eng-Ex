import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import type { ChallengeProps } from '@/lib/types'

/* ---------------------------------------------------------------
 * A tiny circuit simulator. Wires connect terminals; electricity
 * flows if there is an unbroken loop from + back to −.
 * Each win moves to a build with more parts.
 * --------------------------------------------------------------- */

interface Terminal {
  id: string
  x: number
  y: number
}

interface CircuitComponent {
  id: string
  kind: 'battery' | 'bulb' | 'switch' | 'buzzer'
  label: string
  x: number
  y: number
  terminals: [Terminal, Terminal]
}

interface CircuitRound {
  label: string
  brief: string
  components: CircuitComponent[]
  /** Candidate wire routes the player can build, as terminal id pairs. */
  slots: [string, string][]
  successMessage: string
}

const battery = (x: number, y: number): CircuitComponent => ({
  id: 'battery',
  kind: 'battery',
  label: 'Battery',
  x,
  y,
  terminals: [
    { id: 'bat+', x: x + 80, y: y - 40 },
    { id: 'bat-', x: x + 80, y: y + 40 },
  ],
})

const ROUNDS: CircuitRound[] = [
  {
    label: 'Build 1: First light',
    brief: 'Connect the battery to the bulb. Electricity needs a full loop.',
    components: [
      battery(150, 170),
      {
        id: 'bulb',
        kind: 'bulb',
        label: 'Bulb',
        x: 580,
        y: 160,
        terminals: [
          { id: 'bulb_a', x: 510, y: 130 },
          { id: 'bulb_b', x: 510, y: 200 },
        ],
      },
    ],
    slots: [
      ['bat+', 'bulb_a'],
      ['bat-', 'bulb_b'],
      ['bat+', 'bulb_b'],
      ['bat-', 'bulb_a'],
      ['bat+', 'bat-'],
    ],
    successMessage: 'Let there be light! Your first real circuit works.',
  },
  {
    label: 'Build 2: Add a switch',
    brief: 'Wire the switch into the loop so it controls the bulb.',
    components: [
      battery(150, 170),
      {
        id: 'switch',
        kind: 'switch',
        label: 'Switch',
        x: 400,
        y: 80,
        terminals: [
          { id: 'sw_a', x: 335, y: 80 },
          { id: 'sw_b', x: 465, y: 80 },
        ],
      },
      {
        id: 'bulb',
        kind: 'bulb',
        label: 'Bulb',
        x: 620,
        y: 180,
        terminals: [
          { id: 'bulb_a', x: 550, y: 150 },
          { id: 'bulb_b', x: 550, y: 220 },
        ],
      },
    ],
    slots: [
      ['bat+', 'sw_a'],
      ['sw_b', 'bulb_a'],
      ['bulb_b', 'bat-'],
      ['bat+', 'bulb_a'],
      ['sw_b', 'bat-'],
      ['bat+', 'bat-'],
    ],
    successMessage: 'Click! The switch is the boss of the bulb now.',
  },
  {
    label: 'Build 3: The full gadget',
    brief: 'One loop, three parts: switch, bulb, AND buzzer.',
    components: [
      battery(150, 170),
      {
        id: 'switch',
        kind: 'switch',
        label: 'Switch',
        x: 400,
        y: 70,
        terminals: [
          { id: 'sw_a', x: 335, y: 70 },
          { id: 'sw_b', x: 465, y: 70 },
        ],
      },
      {
        id: 'bulb',
        kind: 'bulb',
        label: 'Bulb',
        x: 640,
        y: 160,
        terminals: [
          { id: 'bulb_a', x: 570, y: 130 },
          { id: 'bulb_b', x: 570, y: 200 },
        ],
      },
      {
        id: 'buzzer',
        kind: 'buzzer',
        label: 'Buzzer',
        x: 430,
        y: 285,
        terminals: [
          { id: 'buz_a', x: 355, y: 285 },
          { id: 'buz_b', x: 505, y: 285 },
        ],
      },
    ],
    slots: [
      ['bat+', 'sw_a'],
      ['sw_b', 'bulb_a'],
      ['bulb_b', 'buz_b'],
      ['buz_a', 'bat-'],
      ['bat+', 'bulb_a'],
      ['sw_b', 'buz_b'],
      ['bulb_b', 'bat-'],
      ['bat+', 'bat-'],
    ],
    successMessage: 'Light AND sound. You just built a real gadget.',
  },
]

const slotKey = (a: string, b: string) => `${a}|${b}`

/** Every complete loop from + to −, as the set of components it powers. */
function findLoops(round: CircuitRound, built: string[], switchOn: boolean): Set<string>[] {
  const adj = new Map<string, { to: string; comp: string | null }[]>()
  const addEdge = (a: string, b: string, comp: string | null) => {
    if (!adj.has(a)) adj.set(a, [])
    if (!adj.has(b)) adj.set(b, [])
    adj.get(a)!.push({ to: b, comp })
    adj.get(b)!.push({ to: a, comp })
  }
  for (const [a, b] of round.slots) {
    if (built.includes(slotKey(a, b))) addEdge(a, b, null)
  }
  for (const c of round.components) {
    if (c.kind === 'battery') continue
    if (c.kind === 'switch' && !switchOn) continue
    addEdge(c.terminals[0].id, c.terminals[1].id, c.id)
  }

  const loops: Set<string>[] = []
  const visit = (node: string, visited: Set<string>, comps: Set<string>) => {
    if (node === 'bat-') {
      loops.push(new Set(comps))
      return
    }
    for (const edge of adj.get(node) ?? []) {
      if (visited.has(edge.to)) continue
      visited.add(edge.to)
      if (edge.comp) comps.add(edge.comp)
      visit(edge.to, visited, comps)
      if (edge.comp) comps.delete(edge.comp)
      visited.delete(edge.to)
    }
  }
  visit('bat+', new Set(['bat+']), new Set())
  return loops
}

export function CircuitChallenge({ onComplete }: ChallengeProps) {
  const [roundIndex, setRoundIndex] = useState(0)
  const [built, setBuilt] = useState<string[]>([])
  const [switchOn, setSwitchOn] = useState(false)
  const [wonRound, setWonRound] = useState(false)
  const completedRef = useRef(false)

  const round = ROUNDS[roundIndex % ROUNDS.length]
  const required = round.components.filter((c) => c.kind !== 'battery').map((c) => c.id)
  const hasSwitch = round.components.some((c) => c.kind === 'switch')

  const { short, powered, winNow, winIfOn } = useMemo(() => {
    const loopsIfOn = findLoops(round, built, true)
    const loopsNow = findLoops(round, built, switchOn)
    const isShort = loopsIfOn.some((loop) => loop.size === 0)
    const poweredSet = new Set<string>()
    if (!isShort) loopsNow.forEach((loop) => loop.forEach((id) => poweredSet.add(id)))
    return {
      short: isShort,
      powered: poweredSet,
      winNow: !isShort && loopsNow.some((loop) => required.every((r) => loop.has(r))),
      winIfOn: !isShort && loopsIfOn.some((loop) => required.every((r) => loop.has(r))),
    }
  }, [round, built, switchOn, required])

  useEffect(() => {
    if (winNow && !wonRound) {
      setWonRound(true)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }
  }, [winNow, wonRound, onComplete])

  const toggleWire = (key: string) => {
    setBuilt((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const nextRound = () => {
    setRoundIndex((i) => i + 1)
    setBuilt([])
    setSwitchOn(false)
    setWonRound(false)
  }

  const reset = () => {
    setBuilt([])
    setSwitchOn(false)
  }

  const terminalById = (id: string) => {
    for (const c of round.components) {
      const t = c.terminals.find((term) => term.id === id)
      if (t) return t
    }
    throw new Error(`Unknown terminal ${id}`)
  }


  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft dark:text-stone-400">{round.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
      </div>

      {/* The workbench */}
      <div className="overflow-hidden rounded-2xl bg-stone-100/80 dark:bg-white/5">
        <svg viewBox="0 0 800 360" className="w-full" role="img" aria-label="Circuit workbench">
          {/* wire slots */}
          {round.slots.map(([a, b]) => {
            const key = slotKey(a, b)
            const t1 = terminalById(a)
            const t2 = terminalById(b)
            const isBuilt = built.includes(key)
            return (
              <g
                key={key}
                onClick={() => toggleWire(key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    toggleWire(key)
                  }
                }}
                role="button"
                tabIndex={0}
                aria-pressed={isBuilt}
                aria-label={`Wire between ${a} and ${b}`}
                className="cursor-pointer outline-none"
              >
                <line x1={t1.x} y1={t1.y} x2={t2.x} y2={t2.y} stroke="transparent" strokeWidth="24" />
                {isBuilt ? (
                  <motion.line
                    x1={t1.x}
                    y1={t1.y}
                    x2={t2.x}
                    y2={t2.y}
                    stroke="#d97706"
                    strokeWidth="5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                ) : (
                  <line
                    x1={t1.x}
                    y1={t1.y}
                    x2={t2.x}
                    y2={t2.y}
                    strokeWidth="3"
                    strokeDasharray="5 8"
                    strokeLinecap="round"
                    className="stroke-stone-400 dark:stroke-stone-500"
                    opacity="0.6"
                  />
                )}
              </g>
            )
          })}

          {/* components */}
          {round.components.map((c) => {
            const lit = powered.has(c.id)
            if (c.kind === 'battery') {
              return (
                <g key={c.id}>
                  <rect x={c.x - 55} y={c.y - 55} width="110" height="110" rx="12" className="fill-stone-700 dark:fill-stone-600" />
                  <rect x={c.x - 55} y={c.y - 55} width="110" height="14" rx="7" className="fill-stone-500" />
                  <text x={c.x} y={c.y + 8} textAnchor="middle" fontSize="16" fontWeight="800" className="fill-white font-display">
                    9V
                  </text>
                  <line x1={c.x + 55} y1={c.y - 40} x2={c.x + 80} y2={c.y - 40} strokeWidth="4" className="stroke-stone-500" />
                  <line x1={c.x + 55} y1={c.y + 40} x2={c.x + 80} y2={c.y + 40} strokeWidth="4" className="stroke-stone-500" />
                  <text x={c.x + 96} y={c.y - 34} fontSize="18" fontWeight="800" className="fill-rose-500 font-display">
                    +
                  </text>
                  <text x={c.x + 96} y={c.y + 47} fontSize="18" fontWeight="800" className="fill-ink-soft font-display dark:fill-stone-300">
                    −
                  </text>
                </g>
              )
            }
            if (c.kind === 'bulb') {
              return (
                <g key={c.id}>
                  {lit && <circle cx={c.x} cy={c.y} r="52" fill="#fde047" opacity="0.25" />}
                  <line x1={c.terminals[0].x} y1={c.terminals[0].y} x2={c.x - 10} y2={c.y + 20} strokeWidth="4" className="stroke-stone-500" />
                  <line x1={c.terminals[1].x} y1={c.terminals[1].y} x2={c.x - 4} y2={c.y + 26} strokeWidth="4" className="stroke-stone-500" />
                  <circle cx={c.x} cy={c.y} r="30" className={lit ? 'fill-yellow-300' : 'fill-stone-300 dark:fill-stone-600'} />
                  <rect x={c.x - 10} y={c.y + 24} width="20" height="12" rx="3" className="fill-stone-500" />
                  <path d={`M${c.x - 8} ${c.y + 6} q8 -14 16 0`} fill="none" strokeWidth="2.5" className={lit ? 'stroke-amber-600' : 'stroke-stone-500 dark:stroke-stone-400'} />
                </g>
              )
            }
            if (c.kind === 'switch') {
              const [ta, tb] = c.terminals
              // The lever pivots at terminal A: closed lies flat, open lifts up.
              const angle = switchOn ? 0 : -32
              const len = tb.x - ta.x
              const rad = (angle * Math.PI) / 180
              return (
                <g
                  key={c.id}
                  onClick={() => setSwitchOn((on) => !on)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSwitchOn((on) => !on)
                    }
                  }}
                  role="switch"
                  tabIndex={0}
                  aria-checked={switchOn}
                  aria-label="Toggle the switch"
                  className="cursor-pointer outline-none"
                >
                  <rect x={ta.x - 14} y={ta.y - 34} width={len + 28} height="52" rx="10" fill="transparent" />
                  <line
                    x1={ta.x}
                    y1={ta.y}
                    x2={ta.x + len * Math.cos(rad)}
                    y2={ta.y + len * Math.sin(rad)}
                    strokeWidth="6"
                    strokeLinecap="round"
                    className={switchOn ? 'stroke-emerald-500' : 'stroke-stone-500 dark:stroke-stone-400'}
                  />
                  <text x={(ta.x + tb.x) / 2} y={ta.y - 36} textAnchor="middle" fontSize="13" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                    {switchOn ? 'ON' : 'OFF · tap me'}
                  </text>
                </g>
              )
            }
            // buzzer
            return (
              <g key={c.id}>
                <line x1={c.terminals[0].x} y1={c.terminals[0].y} x2={c.x - 34} y2={c.y} strokeWidth="4" className="stroke-stone-500" />
                <line x1={c.terminals[1].x} y1={c.terminals[1].y} x2={c.x + 34} y2={c.y} strokeWidth="4" className="stroke-stone-500" />
                <path d={`M${c.x - 34} ${c.y + 6} a34 34 0 0 1 68 0 Z`} className={lit ? 'fill-[var(--accent)]' : 'fill-stone-400 dark:fill-stone-600'} />
                <rect x={c.x - 40} y={c.y + 4} width="80" height="8" rx="4" className="fill-stone-500" />
                {lit && (
                  <motion.g
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 0.7, repeat: Infinity }}
                    className="stroke-[var(--accent)]"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                  >
                    <path d={`M${c.x + 44} ${c.y - 22} q10 -12 4 -26`} />
                    <path d={`M${c.x + 56} ${c.y - 16} q14 -16 6 -36`} />
                  </motion.g>
                )}
              </g>
            )
          })}

          {/* terminals on top of everything */}
          {round.components.flatMap((c) =>
            c.terminals.map((t) => (
              <circle key={t.id} cx={t.x} cy={t.y} r="7" strokeWidth="3" className="fill-stone-700 stroke-white dark:fill-stone-300 dark:stroke-night-panel" />
            )),
          )}
        </svg>
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        {short && (
          <p className="rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-300">
            Whoa, short circuit! A wire runs from + straight back to − without passing through
            anything, so all the power races through it. That would overheat fast.
          </p>
        )}
        {!short && wonRound && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
          >
            {round.successMessage}
          </motion.p>
        )}
        {!short && !winNow && winIfOn && hasSwitch && !switchOn && (
          <p className="rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            The loop looks complete, but nothing is running. Something is still holding the current back.
          </p>
        )}
        {!short && !winNow && !winIfOn && powered.size > 0 && (
          <p className="rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            Some power is flowing, but not every part has lit up yet.
          </p>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
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
        <Button variant="ghost" onClick={reset} aria-label="Remove all wires" className="ml-auto">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>
    </Card>
  )
}
