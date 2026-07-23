import { useEffect, useRef, useState } from 'react'
import { RotateCcw, Thermometer } from 'lucide-react'
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
const NTU_PER_SEG = 0.5 // heat-transfer units each section of pipe adds
const MAX_SEG = 8
const HOT_IN = 90 // °C
const COLD_IN = 20 // °C

type Flow = 'same' | 'opposite'

/**
 * Two fluids swapping heat through a shared wall, with balanced flows (Cr = 1).
 *
 * The whole lesson lives in the direction. Run them the SAME way and both ends
 * chase one middle temperature, so the swap stalls halfway: effectiveness can
 * never pass 50%, however long the pipe. Run them OPPOSITE ways and every
 * slice always has a fresh temperature gap to work against, so it climbs all
 * the way to 100%. Same hardware, twice the heat.
 */
const effectiveness = (flow: Flow, segments: number) => {
  const ntu = segments * NTU_PER_SEG
  return flow === 'opposite' ? ntu / (1 + ntu) : (1 - Math.exp(-2 * ntu)) / 2
}

interface ExchangerSetup {
  /** Fraction of the available heat that must move across, 0..1. */
  target: number
  /** Sections of pipe allowed, or null. */
  maxSegments: number | null
  /** Flow direction is fixed until the player is trusted to pick. */
  fixedFlow: Flow | null
  /** Level 4 on: the temperature-profile readout is available. */
  profile: boolean
  brief: string
}

const LEVELS: ChallengeLevel<ExchangerSetup>[] = [
  {
    n: 1,
    title: 'Swap the heat',
    phase: 'play',
    concept: 'Direction matters',
    teach: 'A hot pipe and a cold pipe run next to each other and trade heat through the wall. You choose which way each fluid flows and how long the pipes run. Get enough heat across to the cold side.',
    setup: { target: 0.45, maxSegments: null, fixedFlow: null, profile: false, brief: 'Waste hot water leaving a factory. Use it to pre-warm the cold water coming in.' },
  },
  {
    n: 2,
    title: 'Pipe costs money',
    phase: 'understand',
    concept: 'Longer is dearer',
    teach: 'Every section of exchanger is more metal, more floor space, and more to clean. Hit the target with as few sections as the physics allows rather than just building it long.',
    setup: { target: 0.55, maxSegments: 6, fixedFlow: null, profile: false, brief: 'The same swap, now with an accountant counting the pipe sections.' },
  },
  {
    n: 3,
    title: 'Same way hits a wall',
    phase: 'understand',
    concept: 'The 50% ceiling',
    teach: 'Run both fluids the SAME way and they both race towards one shared temperature in the middle, where the swap stops. That caps you at half the heat no matter how long the pipe. Only running them OPPOSITE ways breaks past it.',
    setup: { target: 0.66, maxSegments: 7, fixedFlow: null, profile: false, brief: 'A target no same-direction exchanger can ever reach. Find the way through.' },
  },
  {
    n: 4,
    title: 'Read the profile',
    phase: 'analyze',
    concept: 'Temperature along the pipe',
    teach: 'Turn on the readout. It draws both fluids\' temperatures down the length of the exchanger. Same-way, the lines rush together and flatten. Opposite-way, they stay a steady gap apart the whole run, which is why they keep trading.',
    setup: { target: 0.7, maxSegments: 8, fixedFlow: null, profile: true, brief: 'The same exchanger, with the temperatures drawn along its length.' },
  },
  {
    n: 5,
    title: 'Spec the exchanger',
    phase: 'optimize',
    concept: 'Heat, metal, and pumping',
    teach: 'More sections recover more heat but cost metal and shove the fluid harder, which costs pumping power forever. Recover what the process needs on the least pipe you can get away with.',
    setup: { target: 0.68, maxSegments: 8, fixedFlow: null, profile: true, brief: 'Design the heat exchanger the plant will build: hot enough, small enough, cheap to run.' },
    metrics: [
      { id: 'heat', label: 'Heat recovered', goal: 'max', target: 72, unit: '%' },
      { id: 'sections', label: 'Pipe sections', goal: 'min', target: 5 },
      { id: 'pumping', label: 'Pumping power', goal: 'min', target: 50 },
    ],
  },
]

export function HeatExchangerChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('heat-exchanger', LEVELS)
  const setup = lv.level.setup

  const [flow, setFlow] = useState<Flow>('same')
  const [segments, setSegments] = useState(3)
  const [won, setWon] = useState(false)
  const [showProfile, setShowProfile] = useState(true)
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)
  const completedRef = useRef(false)

  useEffect(() => {
    setFlow(setup.fixedFlow ?? 'same')
    setSegments(3)
    setWon(false)
    setVerdict(null)
  }, [lv.level.n, setup.fixedFlow])

  const eff = effectiveness(flow, segments)
  const pumping = segments * segments * 2 // grows fast with length
  const overSeg = setup.maxSegments !== null && segments > setup.maxSegments
  const solved = eff >= setup.target && !overSeg

  const reset = () => {
    setFlow(setup.fixedFlow ?? 'same')
    setSegments(3)
    setWon(false)
    setVerdict(null)
  }

  /** Commission the exchanger and see how much heat actually crosses. */
  const commission = () => {
    if (won) return
    if (solved) {
      setWon(true)
      setVerdict({ ok: true, text: `Working. ${Math.round(eff * 100)}% of the heat crossed over on ${segments} sections.` })
      lv.clearLevel(lv.level.metrics ? { heat: Math.round(eff * 100), sections: segments, pumping } : undefined)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const text = overSeg
      ? `That is ${segments} sections and the limit is ${setup.maxSegments}. It has to fit in less.`
      : flow === 'same' && setup.target > 0.5
        ? `Stuck at ${Math.round(eff * 100)}%. Same-direction flow tops out near 50% however long you build it. Turn one fluid around.`
        : `Only ${Math.round(eff * 100)}% crossed, and the target is ${Math.round(setup.target * 100)}%. It needs more length.`
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'Rig drained and reset. Think about which way the fluids should run before you rebuild.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  /* Scene: two pipes, colored by temperature, arrows for flow direction. */
  const W = 800
  const H = 220
  const PIPE_X0 = 90
  const PIPE_X1 = 710
  const len = PIPE_X1 - PIPE_X0
  const hotY = 70
  const coldY = 150
  // temperature along the pipe (fraction of the run, 0..1)
  const hotAt = (u: number) => {
    // hot fluid always enters at its inlet; cools by eff over the run
    const drop = eff * (HOT_IN - COLD_IN)
    return HOT_IN - drop * u
  }
  const coldAt = (u: number) => {
    const rise = eff * (HOT_IN - COLD_IN)
    // opposite flow: cold enters at the far (right) end, so its axis is mirrored
    const uu = flow === 'opposite' ? 1 - u : u
    return COLD_IN + rise * uu
  }
  const tempColor = (t: number) => {
    const f = (t - COLD_IN) / (HOT_IN - COLD_IN)
    return `rgb(${Math.round(60 + f * 195)}, ${Math.round(120 - f * 70)}, ${Math.round(220 - f * 180)})`
  }

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.profile ? <InsightToggle label="temperature profile" on={showProfile} onChange={setShowProfile} /> : undefined}
      />

      <Objective
        goal={`Move at least ${Math.round(setup.target * 100)}% of the heat across${setup.maxSegments !== null ? ` on ${setup.maxSegments} sections or fewer` : ''}`}
        status={`this rig: ${Math.round(eff * 100)}% crossed · ${segments} sections`}
        attemptsLeft={att.left}
        met={won}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">Hot {HOT_IN}° · Cold {COLD_IN}°</Badge>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl blueprint">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Heat exchanger">
          {/* pipe segments, colored by local temperature */}
          {Array.from({ length: MAX_SEG }, (_, i) => {
            const active = i < segments
            const u0 = i / MAX_SEG
            const x = PIPE_X0 + u0 * len
            const w = len / MAX_SEG - 2
            return (
              <g key={i} opacity={active ? 1 : 0.15}>
                <rect x={x} y={hotY - 16} width={w} height="32" style={{ fill: tempColor(hotAt(u0 + 0.5 / MAX_SEG)) }} />
                <rect x={x} y={coldY - 16} width={w} height="32" style={{ fill: tempColor(coldAt(u0 + 0.5 / MAX_SEG)) }} />
              </g>
            )
          })}

          {/* flow-direction arrows */}
          <g className="fill-ink dark:fill-white">
            <text x={PIPE_X0 - 8} y={hotY + 5} textAnchor="end" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">hot</text>
            <path d={`M${PIPE_X1 - 20} ${hotY - 26} l14 6 l-14 6 Z`} />
            <text x={PIPE_X0 - 8} y={coldY + 5} textAnchor="end" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">cold</text>
            {flow === 'opposite' ? (
              <path d={`M${PIPE_X0 + 20} ${coldY + 26} l-14 -6 l14 -6 Z`} />
            ) : (
              <path d={`M${PIPE_X1 - 20} ${coldY + 26} l14 6 l-14 6 Z`} />
            )}
          </g>

          {/* temperature profile readout */}
          {setup.profile && showProfile && (
            <g>
              <polyline
                points={Array.from({ length: 21 }, (_, i) => { const u = i / 20; return `${PIPE_X0 + u * len},${196 - ((hotAt(u) - COLD_IN) / (HOT_IN - COLD_IN)) * 30}` }).join(' ')}
                fill="none" strokeWidth="2.5" className="stroke-rose-500"
              />
              <polyline
                points={Array.from({ length: 21 }, (_, i) => { const u = i / 20; return `${PIPE_X0 + u * len},${196 - ((coldAt(u) - COLD_IN) / (HOT_IN - COLD_IN)) * 30}` }).join(' ')}
                fill="none" strokeWidth="2.5" className="stroke-sky-500"
              />
            </g>
          )}

          {/* outlet temperatures */}
          <text x={PIPE_X1 + 6} y={hotY + 5} fontSize="12" fontWeight="800" className="fill-rose-600 font-display dark:fill-rose-300">{Math.round(hotAt(1))}°</text>
          <text x={flow === 'opposite' ? PIPE_X0 - 8 : PIPE_X1 + 6} y={coldY + 5} textAnchor={flow === 'opposite' ? 'end' : 'start'} fontSize="12" fontWeight="800" className="fill-sky-600 font-display dark:fill-sky-300">{Math.round(coldAt(flow === 'opposite' ? 0 : 1))}°</text>
        </svg>
      </div>

      {/* Verdict */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
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
            Pick the flow direction and the length, then commission the rig.
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-stone-100 p-3 dark:bg-white/5">
          <p className="mb-2 font-display text-sm font-semibold">Flow direction</p>
          <div className="flex gap-2">
            {(['same', 'opposite'] as Flow[]).map((f) => (
              <button
                key={f}
                type="button"
                disabled={setup.fixedFlow !== null}
                onClick={() => { setVerdict(null); setFlow(f) }}
                aria-pressed={flow === f}
                className={cn(
                  'flex-1 rounded-xl px-3 py-2 font-display text-sm font-semibold transition-colors duration-200 disabled:opacity-40',
                  flow === f ? 'accent-bg text-white shadow-clay' : 'bg-white text-ink-soft hover:bg-stone-200 dark:bg-white/5 dark:text-stone-400 dark:hover:bg-white/10',
                )}
              >
                {f === 'same' ? 'Same way' : 'Opposite ways'}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-stone-100 p-3 dark:bg-white/5">
          <p className="mb-2 font-display text-sm font-semibold">
            Length <span className="font-mono font-bold accent-text">{segments} sections</span>
          </p>
          <div className="flex gap-2">
            <Button variant="soft" onClick={() => { setVerdict(null); setSegments((s) => Math.max(1, s - 1)) }} disabled={segments <= 1}>− shorter</Button>
            <Button variant="soft" onClick={() => { setVerdict(null); setSegments((s) => Math.min(MAX_SEG, s + 1)) }} disabled={segments >= MAX_SEG}>longer +</Button>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Meter
          label="Heat recovered"
          display={`${Math.round(eff * 100)}% of ${Math.round(setup.target * 100)}% needed`}
          fraction={eff / Math.max(0.01, setup.target)}
          barClass={eff >= setup.target ? 'bg-emerald-500' : 'bg-amber-500'}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={commission} disabled={won}>
          <Thermometer className="h-5 w-5" />
          Commission the rig
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Reset the rig">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Pumping {pumping}</Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard metrics={lv.level.metrics} values={{ heat: Math.round(eff * 100), sections: segments, pumping }} best={lv.best} scored={won} />
        </div>
      )}

      {won && (
        <LevelComplete
          lv={lv}
          message={
            lv.level.metrics
              ? `${Math.round(eff * 100)}% on ${segments} sections. Try recovering it on less.`
              : 'Heat swapped. That is free energy the plant used to throw away.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
