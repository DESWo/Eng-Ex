import { useEffect, useRef, useState } from 'react'
import { Factory, RotateCcw } from 'lucide-react'
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
import { useSvgDrag } from '@/hooks/useSvgDrag'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const WIDTH = 100 // beam width in mm
const E_STEEL = 200000 // stiffness of steel, MPa
const SPAN = 4000 // beam span in mm
const STEEL_KG = 7.85e-3 // kg per mm² per metre

/**
 * How much a section resists bending depends on where the metal sits, not just
 * how much there is. Moving material away from the middle helps enormously,
 * because its contribution grows with the square of its distance out.
 */
const SHAPES = {
  solid: {
    label: 'Solid bar',
    costPerKg: 1.0,
    note: 'Simple and very heavy',
    props: (h: number) => ({ I: (WIDTH * h ** 3) / 12, A: WIDTH * h }),
  },
  ibeam: {
    label: 'I-beam',
    costPerKg: 1.4,
    note: 'Metal pushed to the top and bottom',
    props: (h: number) => {
      const tf = 10
      const tw = 8
      const hi = Math.max(1, h - 2 * tf)
      return { I: (WIDTH * h ** 3) / 12 - ((WIDTH - tw) * hi ** 3) / 12, A: WIDTH * h - (WIDTH - tw) * hi }
    },
  },
  box: {
    label: 'Box section',
    costPerKg: 1.6,
    note: 'Hollow, and stiff when twisted',
    props: (h: number) => {
      const t = 8
      const hi = Math.max(1, h - 2 * t)
      return { I: (WIDTH * h ** 3) / 12 - ((WIDTH - 2 * t) * hi ** 3) / 12, A: WIDTH * h - (WIDTH - 2 * t) * hi }
    },
  },
  tube: {
    label: 'Round tube',
    costPerKg: 1.8,
    note: 'Even all the way round',
    props: (h: number) => {
      const t = 8
      const di = Math.max(1, h - 2 * t)
      return { I: (Math.PI * (h ** 4 - di ** 4)) / 64, A: (Math.PI * (h ** 2 - di ** 2)) / 4 }
    },
  },
} as const
type ShapeId = keyof typeof SHAPES
const SHAPE_IDS = Object.keys(SHAPES) as ShapeId[]

interface SectionSetup {
  /** Load at the middle of the span, in newtons. */
  load: number
  /** Most it may sag, in mm. */
  maxSag: number
  /** Shapes on offer, or just the solid bar early on. */
  shapes: ShapeId[]
  /** Weight allowed per metre, or null. */
  maxKg: number | null
  /** Level 4 on: the stress readout is available. */
  stress: boolean
  brief: string
}

const LEVELS: ChallengeLevel<SectionSetup>[] = [
  {
    n: 1,
    title: 'Stop the sag',
    phase: 'play',
    concept: 'Depth beats everything',
    teach: 'Make the beam deeper and the sag collapses away, because stiffness grows with the cube of the depth. Doubling the depth makes it eight times stiffer.',
    setup: { load: 20000, maxSag: 12, shapes: ['solid'], maxKg: null, stress: false, brief: 'A walkway beam is bouncing underfoot. Make it deep enough to stop sagging.' },
  },
  {
    n: 2,
    title: 'The crane has a limit',
    phase: 'understand',
    concept: 'Weight budget',
    teach: 'A solid bar gets heavy fast, and this one has to be lifted into place. Use the shallowest beam that still passes, because every extra millimetre is dead weight.',
    // 100 kg/m leaves three workable depths. At 80 there is exactly one, which
    // reads as guess-the-number rather than a budget to design against.
    setup: { load: 20000, maxSag: 20, shapes: ['solid'], maxKg: 100, stress: false, brief: 'Same walkway, but the beam has to be craned onto the roof.' },
  },
  {
    n: 3,
    title: 'Change the shape',
    phase: 'understand',
    concept: 'Where the metal sits',
    teach: 'No solid bar can pass this one. The metal near the middle of a section is barely doing anything, so cutting it out and putting it at the top and bottom buys almost all the stiffness for a fraction of the weight.',
    setup: { load: 25000, maxSag: 10, shapes: SHAPE_IDS as unknown as ShapeId[], maxKg: 40, stress: false, brief: 'A longer span with a tight weight limit. Solid steel simply cannot do this.' },
  },
  {
    n: 4,
    title: 'See the stress',
    phase: 'analyze',
    concept: 'The middle does nothing',
    teach: 'Turn on the stress readout. Bending stretches the bottom and squashes the top, and right in the middle there is a line doing nothing at all. That line is why hollow sections work.',
    setup: { load: 25000, maxSag: 10, shapes: SHAPE_IDS as unknown as ShapeId[], maxKg: 45, stress: true, brief: 'The same beam, with the stress across the section drawn out.' },
  },
  {
    n: 5,
    title: 'Order the steel',
    phase: 'optimize',
    concept: 'Stiff, light, and affordable',
    teach: 'Fancy sections cost more per kilogram to roll, and deeper beams need more headroom in the building. Find the section that passes without gold-plating it.',
    setup: { load: 30000, maxSag: 12, shapes: SHAPE_IDS as unknown as ShapeId[], maxKg: 60, stress: true, brief: 'Sign off the beam that goes into the real building.' },
    metrics: [
      { id: 'sag', label: 'Sag under load', goal: 'min', target: 8, unit: ' mm' },
      { id: 'mass', label: 'Weight', goal: 'min', target: 45, unit: ' kg/m' },
      { id: 'cost', label: 'Cost per metre', goal: 'min', target: 45 },
    ],
  },
]

export function BeamSectionChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('beam-section', LEVELS)
  const setup = lv.level.setup

  const [shapeId, setShapeId] = useState<ShapeId>('solid')
  // Starts far too shallow, so the beam visibly sags before the player acts.
  const [depth, setDepth] = useState(80)
  const [won, setWon] = useState(false)
  const [showStress, setShowStress] = useState(true)
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)
  const completedRef = useRef(false)

  useEffect(() => {
    setShapeId(setup.shapes[0])
    setDepth(80)
    setWon(false)
    setVerdict(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lv.level.n])

  const shape = SHAPES[setup.shapes.includes(shapeId) ? shapeId : setup.shapes[0]]
  const { I, A } = shape.props(depth)
  const sag = (setup.load * SPAN ** 3) / (48 * E_STEEL * I)
  const kgPerM = A * STEEL_KG
  const cost = kgPerM * shape.costPerKg

  const tooHeavy = setup.maxKg !== null && kgPerM > setup.maxKg
  const solved = sag <= setup.maxSag && !tooHeavy

  const reset = () => {
    setShapeId(setup.shapes[0])
    setDepth(80)
    setWon(false)
    setVerdict(null)
  }

  /** Send the section to the mill and stand under the result. */
  const order = () => {
    if (won) return
    if (solved) {
      setWon(true)
      setVerdict({ ok: true, text: `Passes. ${sag.toFixed(1)} mm of sag at ${kgPerM.toFixed(0)} kg per metre.` })
      lv.clearLevel(lv.level.metrics ? { sag, mass: kgPerM, cost } : undefined)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const text = tooHeavy && sag <= setup.maxSag
      ? `Stiff enough, but ${kgPerM.toFixed(0)} kg per metre is over the ${setup.maxKg} kg crane limit. ${setup.shapes.length > 1 ? 'A hollow section gets most of this stiffness for far less metal.' : 'Try a shallower beam.'}`
      : `It sagged ${sag.toFixed(1)} mm underfoot and the limit is ${setup.maxSag} mm. Depth is what buys stiffness.`
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'The mill cancelled the order. Back to the 80 mm blank. Depth cubes into stiffness: work out roughly what you need first.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  /** Drag the top edge of the section to make the beam deeper. */
  const { bind } = useSvgDrag((_x, y) => {
    // The section is centred on CY, so half the height is the distance dragged.
    const mm = Math.round(((150 - y) * 2) / 0.62 / 10) * 10
    setVerdict(null)
    setDepth(Math.max(80, Math.min(300, mm)))
  })

  const nudgeDepth = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') setDepth((d) => Math.min(300, d + 10))
    else if (e.key === 'ArrowDown') setDepth((d) => Math.max(80, d - 10))
    else return
    e.preventDefault()
  }

  /* Cross-section drawing, scaled so 300 mm fits the panel. */
  const px = 0.62
  const w = WIDTH * px
  const h = depth * px
  const CX = 190
  const CY = 150
  const x0 = CX - w / 2
  const y0 = CY - h / 2
  const key = setup.shapes.includes(shapeId) ? shapeId : setup.shapes[0]

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.stress ? <InsightToggle label="stress" on={showStress} onChange={setShowStress} /> : undefined}
      />

      <Objective
        goal={`Sag ${setup.maxSag} mm or less${setup.maxKg !== null ? `, beam under ${setup.maxKg} kg/m` : ''}`}
        status={`this section: ${sag.toFixed(1)} mm · ${kgPerM.toFixed(0)} kg/m`}
        attemptsLeft={att.left}
        met={won}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
          {(setup.load / 1000).toFixed(0)} kN over {SPAN / 1000} m
        </Badge>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-stone-100/80 dark:bg-white/5">
        <svg viewBox="0 0 800 260" className="w-full" role="img" aria-label="Beam cross section and sag" {...bind}>
          <text x="190" y="28" textAnchor="middle" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
            Cross section
          </text>

          {/* the section itself */}
          <g className="fill-slate-500 dark:fill-slate-400">
            {key === 'solid' && <rect x={x0} y={y0} width={w} height={h} rx="2" />}
            {key === 'ibeam' && (
              <>
                <rect x={x0} y={y0} width={w} height={10 * px} />
                <rect x={x0} y={y0 + h - 10 * px} width={w} height={10 * px} />
                <rect x={CX - (8 * px) / 2} y={y0 + 10 * px} width={8 * px} height={Math.max(0, h - 20 * px)} />
              </>
            )}
            {key === 'box' && (
              <>
                <rect x={x0} y={y0} width={w} height={8 * px} />
                <rect x={x0} y={y0 + h - 8 * px} width={w} height={8 * px} />
                <rect x={x0} y={y0} width={8 * px} height={h} />
                <rect x={x0 + w - 8 * px} y={y0} width={8 * px} height={h} />
              </>
            )}
            {key === 'tube' && (
              <>
                <circle cx={CX} cy={CY} r={h / 2} />
                <circle cx={CX} cy={CY} r={Math.max(0, h / 2 - 8 * px)} className="fill-stone-100 dark:fill-[#1b222b]" />
              </>
            )}
          </g>

          {/* grab handle on the top edge */}
          <rect
            x={x0 - 6}
            y={y0 - 7}
            width={w + 12}
            height="14"
            rx="7"
            tabIndex={0}
            onKeyDown={nudgeDepth}
            role="slider"
            aria-label="Section depth"
            aria-valuenow={depth}
            aria-valuemin={80}
            aria-valuemax={300}
            aria-valuetext={`${depth} millimetres deep`}
            className="cursor-ns-resize outline-none"
            style={{ fill: 'var(--accent)' }}
            opacity="0.85"
          />

          {/* level 4 overlay: bending stress across the depth */}
          {setup.stress && showStress && (
            <g>
              <line x1={CX - w / 2 - 30} y1={CY} x2={CX + w / 2 + 90} y2={CY} strokeWidth="1.5" strokeDasharray="5 5" className="stroke-stone-500 dark:stroke-stone-400" />
              <text x={CX + w / 2 + 94} y={CY + 4} fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                doing nothing
              </text>
              {/* squashed at the top, stretched at the bottom, zero in the middle */}
              <path d={`M${CX + w / 2 + 12} ${CY} L${CX + w / 2 + 12 + 56} ${y0} L${CX + w / 2 + 12} ${y0} Z`} className="fill-rose-400/70" />
              <path d={`M${CX + w / 2 + 12} ${CY} L${CX + w / 2 + 12 + 56} ${y0 + h} L${CX + w / 2 + 12} ${y0 + h} Z`} className="fill-sky-400/70" />
              <text x={CX + w / 2 + 74} y={y0 - 6} fontSize="11" fontWeight="700" className="fill-rose-600 font-display dark:fill-rose-300">
                squashed
              </text>
              <text x={CX + w / 2 + 74} y={y0 + h + 16} fontSize="11" fontWeight="700" className="fill-sky-700 font-display dark:fill-sky-300">
                stretched
              </text>
            </g>
          )}

          {/* the span, sagging by the computed amount (exaggerated to read) */}
          <text x="600" y="28" textAnchor="middle" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
            The span under load
          </text>
          <path
            d={`M460 110 Q600 ${110 + Math.min(70, sag * 5)} 740 110`}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className={cn(sag <= setup.maxSag ? 'stroke-emerald-500' : 'stroke-amber-500')}
          />
          <line x1="460" y1="110" x2="460" y2="150" strokeWidth="6" className="stroke-stone-400 dark:stroke-stone-600" />
          <line x1="740" y1="110" x2="740" y2="150" strokeWidth="6" className="stroke-stone-400 dark:stroke-stone-600" />
          <path d="M600 60 L600 96 M592 88 L600 98 L608 88" strokeWidth="3" fill="none" className="stroke-ink dark:stroke-stone-300" />
          <text x="600" y={190} textAnchor="middle" fontSize="14" fontWeight="700" className="fill-ink font-display dark:fill-stone-200">
            sags {sag.toFixed(1)} mm
          </text>
          <text x="600" y={212} textAnchor="middle" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
            limit {setup.maxSag} mm
          </text>
        </svg>
      </div>

      {/* Verdict: only after the section is ordered */}
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
            Shape the section, then order it from the mill to see how the span holds up.
          </p>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Meter
          label="Sag"
          display={`${sag.toFixed(1)} of ${setup.maxSag} mm`}
          fraction={Math.min(1, sag / (setup.maxSag * 2))}
          markerFraction={0.5}
          barClass={sag <= setup.maxSag ? 'bg-emerald-500' : 'bg-rose-500'}
        />
        {setup.maxKg !== null && (
          <Meter
            label="Weight"
            display={`${kgPerM.toFixed(0)} of ${setup.maxKg} kg/m`}
            fraction={kgPerM / setup.maxKg}
            barClass={tooHeavy ? 'bg-rose-500' : 'bg-emerald-500'}
          />
        )}
      </div>

      {/* Shape picker */}
      {setup.shapes.length > 1 && (
        <div className="mt-4">
          <p className="mb-2 font-display text-sm font-semibold">Section</p>
          <div className="flex flex-wrap gap-2">
            {setup.shapes.map((id) => {
              const s = SHAPES[id]
              const active = key === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setVerdict(null); setShapeId(id) }}
                  aria-pressed={active}
                  className={cn(
                    'rounded-2xl px-4 py-2.5 text-left font-display text-sm font-semibold transition-colors duration-200',
                    active ? 'accent-bg text-white shadow-clay' : 'bg-stone-100 text-ink-soft hover:bg-stone-200 dark:bg-white/5 dark:text-stone-400 dark:hover:bg-white/10',
                  )}
                >
                  <span className="block">{s.label}</span>
                  <span className={cn('block text-xs font-medium', active ? 'text-white/80' : 'opacity-70')}>{s.note}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <p className="mt-4 text-sm text-ink-soft dark:text-stone-400">
        Drag the top of the section to make the beam deeper. Currently{' '}
        <span className="accent-text font-display font-bold">{depth} mm</span>.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={order} disabled={won}>
          <Factory className="h-5 w-5" />
          Order the section
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Reset the beam">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">
          {kgPerM.toFixed(0)} kg/m · ${cost.toFixed(0)}/m
        </Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard metrics={lv.level.metrics} values={{ sag, mass: kgPerM, cost }} best={lv.best} scored={won} />
        </div>
      )}

      {won && (
        <LevelComplete
          lv={lv}
          message={
            lv.level.metrics
              ? `${sag.toFixed(1)} mm at ${kgPerM.toFixed(0)} kg/m. See if another section beats it.`
              : 'That beam will hold.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
