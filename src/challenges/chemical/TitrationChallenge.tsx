import { useEffect, useRef, useState } from 'react'
import { Droplet, RotateCcw } from 'lucide-react'
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
const V_EQ = 50 // mL of base to reach the equivalence point
const PKA = 5 // weak acid, so there is a gentle buffer region before the cliff
const BASE_CONC = 0.1 // mol/L
const FLASK_VOL = 50 // mL of acid in the flask
const MAX_BASE = 70

/**
 * A weak acid neutralised by a strong base: the textbook titration curve.
 *
 * For the first stretch the flask sits in its buffer region and pours barely
 * move the reading. Then, right at the equivalence point, the curve goes almost
 * vertical: a single drop throws it from the safe band up into alkali. The
 * whole skill is feeling when to switch from big confident pours to tiny ones,
 * because pH is a logarithm and the last drop is nothing like the first.
 */
const pHof = (baseAdded: number) => {
  if (baseAdded <= 0) return 0.5 * (PKA - Math.log10(BASE_CONC))
  if (baseAdded < V_EQ) return PKA + Math.log10(baseAdded / (V_EQ - baseAdded))
  if (Math.abs(baseAdded - V_EQ) < 1e-9) return 8.7
  const oh = (BASE_CONC * (baseAdded - V_EQ)) / 1000 / ((FLASK_VOL + baseAdded) / 1000)
  return Math.min(13.5, 14 + Math.log10(oh))
}

interface TitrationSetup {
  /** Acceptable pH band [low, high] to pour the batch away safely. */
  band: [number, number]
  /** Level 4 on: the titration curve is available. */
  curve: boolean
  brief: string
}

const LEVELS: ChallengeLevel<TitrationSetup>[] = [
  {
    n: 1,
    title: 'Take the edge off',
    phase: 'play',
    concept: 'Base cancels acid',
    teach: 'The flask holds a sharp acid, coloured red. Add base a pour at a time and it climbs towards safe, turning green in the middle. Get the flask into the safe band, anywhere in it, and stop.',
    setup: { band: [4.5, 7], curve: false, brief: 'A beaker of acid too harsh to pour down the drain. Soften it into the safe range.' },
  },
  {
    n: 2,
    title: 'Do not overshoot',
    phase: 'understand',
    concept: 'Past the band is alkali',
    teach: 'Keep pouring and the flask shoots past safe into alkali, which is just as bad as the acid you started with. You get only a few tries before the batch is spoiled, so ease up as you get close.',
    setup: { band: [5, 6.5], curve: false, brief: 'The same acid, and a supervisor who bins any batch that overshoots.' },
  },
  {
    n: 3,
    title: 'The cliff at the end',
    phase: 'understand',
    concept: 'pH is a logarithm',
    teach: 'Watch what happens near the top of the range: pours that barely moved the reading now swing it hard, because the curve turns almost vertical at the equivalence point. pH is a logarithm, so the last drop does ten times what the first one did.',
    setup: { band: [5.5, 6.3], curve: false, brief: 'A tighter band, sitting right where the curve starts to go vertical.' },
  },
  {
    n: 4,
    title: 'Read the curve',
    phase: 'analyze',
    concept: 'The titration curve',
    teach: 'Turn on the readout. It plots pH against how much base you have poured, and you can see the gentle buffer stretch give way to the near-vertical cliff. Chemists read exactly this curve to know where to stop.',
    setup: { band: [5.8, 6.4], curve: true, brief: 'The same flask, with the titration curve drawn as you pour.' },
  },
  {
    n: 5,
    title: 'Hit the mark',
    phase: 'optimize',
    concept: 'Accurate, lean, and quick',
    teach: 'Land in the middle of the band, using as little base as possible and in as few pours as you can manage. Every drop of reagent costs money, and every pour costs time on the line.',
    setup: { band: [6, 6.6], curve: true, brief: 'Neutralise the batch to spec: dead in the band, without wasting reagent.' },
    metrics: [
      { id: 'offset', label: 'Distance from band centre', goal: 'min', target: 2, unit: ' (×0.1 pH)' },
      { id: 'reagent', label: 'Base used', goal: 'min', target: 48, unit: ' mL' },
      { id: 'pours', label: 'Pours', goal: 'min', target: 8 },
    ],
  },
]

export function TitrationChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('titration', LEVELS)
  const setup = lv.level.setup

  const [base, setBase] = useState(0)
  const [pours, setPours] = useState(0)
  const [won, setWon] = useState(false)
  const [showCurve, setShowCurve] = useState(true)
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)
  const completedRef = useRef(false)

  useEffect(() => {
    setBase(0)
    setPours(0)
    setWon(false)
    setVerdict(null)
  }, [lv.level.n])

  const ph = pHof(base)
  const inBand = ph >= setup.band[0] && ph <= setup.band[1]
  const bandMid = (setup.band[0] + setup.band[1]) / 2
  const offset = Math.round(Math.abs(ph - bandMid) * 10)

  const reset = () => {
    setBase(0)
    setPours(0)
    setWon(false)
    setVerdict(null)
  }

  const pour = (ml: number) => {
    if (won) return
    setVerdict(null)
    setBase((b) => Math.max(0, Math.min(MAX_BASE, b + ml)))
    setPours((p) => p + 1)
  }

  /** Call the batch done and let the inspector check the pH. */
  const check = () => {
    if (won) return
    if (inBand) {
      setWon(true)
      setVerdict({ ok: true, text: `Safe. pH ${ph.toFixed(2)} after ${base} mL and ${pours} pours.` })
      lv.clearLevel(lv.level.metrics ? { offset, reagent: base, pours } : undefined)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const text = ph > setup.band[1]
      ? `pH ${ph.toFixed(2)}: overshot past the band into alkali. That close to the cliff, one pour flips it. Ease off.`
      : `pH ${ph.toFixed(2)}: still too acid, the band is ${setup.band[0]} to ${setup.band[1]}. Keep pouring, gently as you near the top.`
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'Batch neutralised to waste, fresh acid in the flask. Creep up on the cliff this time.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  /* Scene: a beaker whose colour tracks pH, plus an optional curve. */
  const W = 800
  const H = 240
  // pH colour: red (acid) -> green (safe) -> indigo (alkali)
  const phColor = (p: number) => {
    if (p < bandMid) { const f = Math.max(0, p / bandMid); return `rgb(${Math.round(230 - f * 100)}, ${Math.round(70 + f * 140)}, ${Math.round(60 + f * 20)})` }
    const f = Math.min(1, (p - bandMid) / (14 - bandMid))
    return `rgb(${Math.round(130 - f * 70)}, ${Math.round(210 - f * 130)}, ${Math.round(90 + f * 130)})`
  }
  const fillH = 90 + (base / MAX_BASE) * 30

  const CX0 = 380
  const CX1 = 740
  const CY0 = 40
  const CY1 = 190
  const bx = (b: number) => CX0 + (b / MAX_BASE) * (CX1 - CX0)
  const py = (p: number) => CY1 - (p / 14) * (CY1 - CY0)
  const curvePts = Array.from({ length: MAX_BASE * 2 + 1 }, (_, i) => { const b = i / 2; return `${bx(b)},${py(pHof(b))}` }).join(' ')

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.curve ? <InsightToggle label="pH curve" on={showCurve} onChange={setShowCurve} /> : undefined}
      />

      <Objective
        goal={`Bring the flask to pH ${setup.band[0]} to ${setup.band[1]}`}
        status={`now pH ${ph.toFixed(2)} · ${base} mL added`}
        attemptsLeft={att.left}
        met={won}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">Safe band {setup.band[0]}–{setup.band[1]}</Badge>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl blueprint">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Titration flask">
          {/* burette dripping base */}
          <rect x="150" y="10" width="14" height="70" rx="3" className="fill-stone-300 dark:fill-stone-600" />
          <line x1="157" y1="80" x2="157" y2="118" strokeWidth="2" strokeDasharray="3 5" className="stroke-sky-400" />
          <text x="157" y="30" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">base</text>

          {/* beaker */}
          <path d="M90 120 L90 210 Q90 224 104 224 L210 224 Q224 224 224 210 L224 120 Z" className="fill-stone-100/60 stroke-stone-400 dark:fill-white/5 dark:stroke-stone-500" strokeWidth="2.5" />
          <rect x="92" y={222 - fillH} width="130" height={fillH} rx="4" style={{ fill: phColor(ph) }} opacity="0.85" />
          <text x="157" y="180" textAnchor="middle" fontSize="26" fontWeight="800" className="fill-white font-display">{ph.toFixed(1)}</text>
          <text x="157" y="200" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-white/80 font-display">pH</text>

          {/* titration curve */}
          {setup.curve && showCurve && (
            <g>
              <rect x={CX0} y={py(setup.band[1])} width={CX1 - CX0} height={py(setup.band[0]) - py(setup.band[1])} className="fill-emerald-400/15" />
              <polyline points={curvePts} fill="none" strokeWidth="3" className="stroke-violet-500" />
              <line x1={bx(base)} y1={CY0} x2={bx(base)} y2={CY1} strokeWidth="1.5" className="stroke-ink/40 dark:stroke-white/40" />
              <circle cx={bx(base)} cy={py(ph)} r="5" className="fill-violet-600 dark:fill-violet-300" />
              <text x={CX0} y={CY1 + 16} fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">base added →</text>
              <text x={CX0 - 6} y={py(7) + 4} textAnchor="end" fontSize="11" fontWeight="700" className="fill-ink-soft font-mono dark:fill-stone-400">7</text>
            </g>
          )}
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
            Pour base until the flask is in the band, then call it done. Big pours early, tiny ones near the cliff.
          </p>
        )}
      </div>

      <div className="mt-3">
        <Meter
          label="pH"
          display={`${ph.toFixed(2)} · band ${setup.band[0]}–${setup.band[1]}`}
          fraction={ph / 14}
          markerFraction={bandMid / 14}
          barClass={inBand ? 'bg-emerald-500' : ph < setup.band[0] ? 'bg-rose-500' : 'bg-violet-500'}
        />
      </div>

      {/* Controls: coarse and fine pours */}
      <div className="mt-4">
        <p className="mb-2 font-display text-sm font-semibold">Add base</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" onClick={() => pour(10)} disabled={won}>+10 mL</Button>
          <Button variant="soft" onClick={() => pour(5)} disabled={won}>+5 mL</Button>
          <Button variant="soft" onClick={() => pour(1)} disabled={won}>+1 mL</Button>
          <Button variant="ghost" onClick={reset} aria-label="Empty the flask">
            <RotateCcw className="h-4 w-4" />
            Empty
          </Button>
          <Badge className="ml-auto self-center">{base} mL · {pours} pours</Badge>
        </div>
      </div>

      <div className="mt-4">
        <Button variant="accent" size="lg" onClick={check} disabled={won}>
          <Droplet className="h-5 w-5" />
          Call it done
        </Button>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard metrics={lv.level.metrics} values={{ offset, reagent: base, pours }} best={lv.best} scored={won} />
        </div>
      )}

      {won && (
        <LevelComplete
          lv={lv}
          message={
            lv.level.metrics
              ? `pH ${ph.toFixed(2)} on ${base} mL in ${pours} pours. Try landing it leaner.`
              : 'Safe to handle now. Nicely judged.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
