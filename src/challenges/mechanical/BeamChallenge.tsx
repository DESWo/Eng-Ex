import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { InsightToggle } from '@/components/level/InsightToggle'
import { Objective } from '@/components/level/Objective'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import { useSvgDrag } from '@/hooks/useSvgDrag'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const ALL_MARKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const EVEN_MARKS = [2, 4, 6, 8, 10]

/** Cargo sits at a negative mark (left of centre), the counterweight at a positive one. */
interface Crate {
  weight: number
  pos: number
}

interface BeamSetup {
  crates: Crate[]
  /** Marks the counterweight is allowed to sit on. */
  notches: number[]
  /** Counterweight masses in the bin. */
  weights: number[]
  /** Level 3 on: the pivot itself becomes a control. */
  movablePivot: boolean
  /** How close the twists must match to count as balanced. */
  tolerance: number
  /** Level 4 on: moment bars are available. */
  moments: boolean
}

const LEVELS: ChallengeLevel<BeamSetup>[] = [
  {
    n: 1,
    title: 'Level it out',
    phase: 'play',
    concept: 'Weight times distance',
    teach: 'It is the playground seesaw, played precisely. A heavy crate close in can be balanced by a light one far out. Slide your counterweight until the beam sits flat.',
    setup: {
      crates: [{ weight: 30, pos: -6 }],
      notches: ALL_MARKS,
      weights: [10, 20, 30, 40, 50],
      movablePivot: false,
      // Deliberately loose: level 1 should reward poking at it, not precision.
      tolerance: 20,
      moments: false,
    },
  },
  {
    n: 2,
    title: 'Bolted notches',
    phase: 'understand',
    concept: 'Fixed positions',
    teach: 'The counterweight now only bolts to the even marks. The exact spot you want is often missing, so the mass you pick has to make up the difference.',
    setup: {
      crates: [
        { weight: 20, pos: -8 },
        { weight: 10, pos: -3 },
      ],
      notches: EVEN_MARKS,
      weights: [10, 20, 30, 40, 50],
      movablePivot: false,
      tolerance: 10,
      moments: false,
    },
  },
  {
    n: 3,
    title: 'Move the pivot',
    phase: 'understand',
    concept: 'Mechanical advantage',
    teach: 'Your heaviest counterweight is only 30 kg and the cargo is 50 kg, so no position wins. Slide the pivot toward the cargo instead: shortening its arm is how a crowbar lifts what your arms cannot.',
    setup: {
      crates: [{ weight: 50, pos: -8 }],
      notches: ALL_MARKS,
      weights: [10, 20, 30],
      movablePivot: true,
      tolerance: 10,
      moments: false,
    },
  },
  {
    n: 4,
    title: 'See the twist',
    phase: 'analyze',
    concept: 'Moment bars',
    teach: 'Turn on the bars. Each one is that crate’s weight multiplied by its distance from the pivot, which engineers call a moment. Balance means the two sides add up to the same total.',
    setup: {
      crates: [
        { weight: 40, pos: -5 },
        { weight: 20, pos: -2 },
      ],
      notches: ALL_MARKS,
      weights: [10, 20, 30, 40, 50],
      movablePivot: true,
      tolerance: 10,
      moments: true,
    },
  },
  {
    n: 5,
    title: 'Lift it cheap',
    phase: 'optimize',
    concept: 'Three costs at once',
    teach: 'Balance the load, but a huge counterweight is expensive, a long beam is expensive, and rebuilding the pivot is expensive too. There are several balanced answers here and they are not equally good.',
    setup: {
      crates: [
        { weight: 50, pos: -8 },
        { weight: 20, pos: -4 },
      ],
      notches: ALL_MARKS,
      weights: [10, 20, 30, 40, 50],
      movablePivot: true,
      tolerance: 10,
      moments: true,
    },
    metrics: [
      { id: 'mass', label: 'Counterweight', goal: 'min', target: 30, unit: ' kg' },
      { id: 'reach', label: 'Arm length', goal: 'min', target: 9, unit: ' marks' },
      { id: 'shift', label: 'Pivot moved', goal: 'min', target: 3, unit: ' marks' },
    ],
  },
]

/* ------------------- scene constants (SVG pixels) ------------------- */
const CENTER_X = 400
const BEAM_Y = 170
const GROUND_Y = 296
const PX_PER_MARK = 34
/** Moment bars hang from this line, with every value on one shared baseline below. */
const BAR_TOP = 330
const BAR_MAX_H = 50
const BAR_LABEL_Y = BAR_TOP + BAR_MAX_H + 16

export function BeamChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('beam', LEVELS)
  const round = lv.level.setup

  const [weight, setWeight] = useState(20)
  const [mark, setMark] = useState(5)
  const [pivot, setPivot] = useState(0)
  const [wonRound, setWonRound] = useState(false)
  const [showMoments, setShowMoments] = useState(true)
  const completedRef = useRef(false)
  // Set when the gesture began on the fulcrum, so dragging elsewhere does nothing.
  const grabbedPivot = useRef(false)

  /** Every level starts from a neutral setup. */
  useEffect(() => {
    setWeight(20)
    setMark(round.notches.includes(5) ? 5 : round.notches[0])
    setPivot(0)
    setWonRound(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lv.level.n])

  // A moment is weight times distance from the pivot. Left of the pivot is negative.
  const crateMoments = round.crates.map((c) => c.weight * (c.pos - pivot))
  const counterMoment = weight * (mark - pivot)
  const net = crateMoments.reduce((s, m) => s + m, 0) + counterMoment
  const balanced = Math.abs(net) <= round.tolerance
  const tilt = Math.max(-11, Math.min(11, net / 18))

  const reach = Math.abs(mark - pivot)
  const shift = Math.abs(pivot)

  // Hold the balance for a moment before it counts, so sweeping
  // the slider through the sweet spot is not an instant win.
  useEffect(() => {
    if (!balanced || wonRound) return
    const timer = setTimeout(() => {
      setWonRound(true)
      lv.clearLevel(lv.level.metrics ? { mass: weight, reach, shift } : undefined)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, 1500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balanced, wonRound, weight, reach, shift])

  const reset = () => {
    setWeight(20)
    setMark(round.notches.includes(5) ? 5 : round.notches[0])
    setPivot(0)
    setWonRound(false)
  }

  const counterSize = 24 + weight * 0.4
  const pivotPx = CENTER_X + pivot * PX_PER_MARK

  /** Slide the fulcrum itself rather than pushing a number. */
  const { bind } = useSvgDrag((x, _y, done) => {
    if (!round.movablePivot || !grabbedPivot.current) return
    setPivot(Math.max(-4, Math.min(4, Math.round((x - CENTER_X) / PX_PER_MARK))))
    if (done) grabbedPivot.current = false
  })

  const nudgePivot = (e: React.KeyboardEvent) => {
    if (!round.movablePivot) return
    if (e.key === 'ArrowLeft') setPivot((v) => Math.max(-4, v - 1))
    else if (e.key === 'ArrowRight') setPivot((v) => Math.min(4, v + 1))
    else return
    e.preventDefault()
  }

  // Moment bars are drawn in a static layer so they stay readable while the beam tilts.
  const bars = [
    ...round.crates.map((c, i) => ({
      key: `c${i}`,
      x: CENTER_X + c.pos * PX_PER_MARK,
      moment: crateMoments[i],
      cargo: true,
    })),
    { key: 'counter', x: CENTER_X + mark * PX_PER_MARK, moment: counterMoment, cargo: false },
  ]
  const maxBar = Math.max(120, ...bars.map((b) => Math.abs(b.moment)))
  const showBars = round.moments && showMoments

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={
          round.moments ? (
            <InsightToggle label="moments" on={showMoments} onChange={setShowMoments} />
          ) : undefined
        }
      />

      <Objective
        goal={`Hold the beam level for a moment (net twist within ${round.tolerance})`}
        met={wonRound}
      />

      <p className="mb-4 text-sm text-ink-soft dark:text-stone-400">
        Cargo landed on the left side. Use one counterweight on the right to get the beam level and
        keep it there.
      </p>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-sky-100/70 dark:bg-sky-950/40">
        <svg
          viewBox={`0 0 800 ${showBars ? BAR_LABEL_Y + 12 : GROUND_Y + 22}`}
          className="w-full"
          role="img"
          aria-label="Balance beam scene"
          {...bind}
        >
          {/* ground + pivot */}
          <rect x="0" y={GROUND_Y} width="800" height="10" className="fill-emerald-200 dark:fill-emerald-950" />
          <path
            d={`M${pivotPx - 34} ${GROUND_Y} L${pivotPx} ${BEAM_Y + 8} L${pivotPx + 34} ${GROUND_Y} Z`}
            className={cn('fill-stone-500 dark:fill-stone-500', round.movablePivot && 'cursor-grab')}
            onPointerDown={() => {
              grabbedPivot.current = true
            }}
            tabIndex={round.movablePivot ? 0 : undefined}
            onKeyDown={nudgePivot}
            role={round.movablePivot ? 'slider' : undefined}
            aria-label={round.movablePivot ? 'Fulcrum position' : undefined}
            aria-valuenow={round.movablePivot ? pivot : undefined}
            aria-valuemin={round.movablePivot ? -4 : undefined}
            aria-valuemax={round.movablePivot ? 4 : undefined}
          />
          {round.movablePivot && (
            <text x={pivotPx} y={GROUND_Y + 26} textAnchor="middle" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
              drag the pivot
            </text>
          )}

          {/* everything on the beam tilts together around the pivot */}
          <g
            style={{
              transformBox: 'view-box',
              transformOrigin: `${pivotPx}px ${BEAM_Y}px`,
              transform: `rotate(${tilt}deg)`,
              transition: 'transform 0.5s cubic-bezier(0.34, 1.2, 0.64, 1)',
            }}
          >
            <rect
              x={CENTER_X - 10.5 * PX_PER_MARK}
              y={BEAM_Y - 6}
              width={21 * PX_PER_MARK}
              height="12"
              rx="6"
              className="fill-amber-700 dark:fill-amber-600"
            />
            {/* position marks */}
            {ALL_MARKS.map((m) => (
              <g key={m}>
                <line x1={CENTER_X - m * PX_PER_MARK} y1={BEAM_Y - 6} x2={CENTER_X - m * PX_PER_MARK} y2={BEAM_Y + 6} strokeWidth="2" className="stroke-amber-900/40 dark:stroke-amber-950/60" />
                <line x1={CENTER_X + m * PX_PER_MARK} y1={BEAM_Y - 6} x2={CENTER_X + m * PX_PER_MARK} y2={BEAM_Y + 6} strokeWidth="2" className="stroke-amber-900/40 dark:stroke-amber-950/60" />
              </g>
            ))}

            {/* cargo crates */}
            {round.crates.map((crate, i) => {
              const size = 24 + crate.weight * 0.4
              const x = CENTER_X + crate.pos * PX_PER_MARK
              return (
                <g key={i}>
                  <rect x={x - size / 2} y={BEAM_Y - 6 - size} width={size} height={size} rx="5" className="fill-stone-500 dark:fill-stone-400" />
                  <text x={x} y={BEAM_Y - 6 - size / 2 + 5} textAnchor="middle" fontSize="14" fontWeight="700" className="fill-white font-display">
                    {crate.weight}
                  </text>
                </g>
              )
            })}

            {/* the player's counterweight */}
            <g>
              <rect
                x={CENTER_X + mark * PX_PER_MARK - counterSize / 2}
                y={BEAM_Y - 6 - counterSize}
                width={counterSize}
                height={counterSize}
                rx="5"
                style={{ fill: 'var(--accent)' }}
              />
              <text
                x={CENTER_X + mark * PX_PER_MARK}
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

          {/* level 4 overlay: each item's moment, drawn flat so it stays readable */}
          {showBars && (
            <g>
              <text x="46" y={BAR_TOP - 12} fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                Twist from each load (weight × distance from pivot)
              </text>
              <line x1="40" y1={BAR_TOP} x2="760" y2={BAR_TOP} className="stroke-stone-400/50 dark:stroke-stone-600" strokeWidth="1.5" />
              {bars.map((b) => {
                const h = Math.max(2, (Math.abs(b.moment) / maxBar) * BAR_MAX_H)
                return (
                  <g key={b.key}>
                    <rect
                      x={b.x - 11}
                      y={BAR_TOP}
                      width="22"
                      height={h}
                      rx="3"
                      className={b.cargo ? 'fill-stone-500 dark:fill-stone-400' : ''}
                      style={b.cargo ? undefined : { fill: 'var(--accent)' }}
                      opacity="0.9"
                    />
                    <text x={b.x} y={BAR_LABEL_Y} textAnchor="middle" fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                      {Math.abs(Math.round(b.moment))}
                    </text>
                  </g>
                )
              })}
            </g>
          )}
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
            Perfectly balanced! Both sides twist by about{' '}
            {Math.abs(Math.round(crateMoments.reduce((s, m) => s + m, 0)))}.
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
              : net < 0
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
            {round.weights.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeight(w)}
                aria-pressed={weight === w}
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

        <div>
          <p className="mb-2 font-display text-sm font-semibold">Distance from the middle</p>
          <div className="flex flex-wrap gap-2">
            {round.notches.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMark(m)}
                aria-pressed={mark === m}
                className={cn(
                  'h-9 w-9 rounded-full border-2 font-display text-sm font-bold tabular-nums transition-colors duration-200',
                  mark === m
                    ? 'accent-border accent-soft accent-text'
                    : 'border-stone-200 text-ink-soft hover:border-stone-300 dark:border-white/10 dark:text-stone-400 dark:hover:border-white/25',
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={reset} aria-label="Reset the beam">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Net twist: {Math.round(net)}</Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ mass: weight, reach, shift }}
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
              ? `Balanced with a ${weight} kg weight ${reach} marks out. Can you do it cheaper?`
              : 'Level. Nicely done.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
