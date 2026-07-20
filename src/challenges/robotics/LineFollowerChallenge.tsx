import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import { InsightToggle } from '@/components/level/InsightToggle'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import { useSvgDrag } from '@/hooks/useSvgDrag'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const X0 = 40 // start of the track
const X1 = 760 // finish line
const Y0 = 160 // middle of the scene
const GAIN_SCALE = 0.00006 // slider units -> steering per pixel of error
const DAMP_SCALE = 0.0016 // slider units -> steering per pixel of error change
const MAX_RATE = 0.14 // the steering motor cannot slew faster than this
const MAX_ANGLE = 0.6 // and the bot cannot crab more sideways than this

interface Track {
  amp: number
  wave: number
  /** Optional second ripple, which makes the line genuinely twitchy. */
  amp2?: number
  wave2?: number
}

const TRACKS = {
  easy: { amp: 34, wave: 150 } as Track,
  mid: { amp: 48, wave: 105 } as Track,
  hard: { amp: 52, wave: 80, amp2: 18, wave2: 33 } as Track,
}

const centerline = (x: number, t: Track) =>
  Y0 + t.amp * Math.sin((x - X0) / t.wave) + (t.amp2 ? t.amp2 * Math.sin((x - X0) / t.wave2!) : 0)

interface LineSetup {
  track: Track
  /** How far off the line the bot may stray before it loses sight of it. */
  lane: number
  /** Fixed drive speed, or null when the player chooses it. */
  speed: number | null
  /** Level 3 on: the damping slider appears. */
  damping: boolean
  /** Battery the steering may spend, or null for no limit. */
  battery: number | null
  /** Level 4 on: the error trace is available. */
  trace: boolean
  brief: string
}

const LEVELS: ChallengeLevel<LineSetup>[] = [
  {
    n: 1,
    title: 'Follow the line',
    phase: 'play',
    concept: 'Steering strength',
    teach: 'The bot sees how far it has drifted off the line and steers back. Turn the steering strength up until it can hold a gentle curve.',
    setup: {
      track: TRACKS.easy,
      lane: 60,
      speed: 3,
      damping: false,
      battery: null,
      trace: false,
      brief: 'A delivery bot follows a painted line across the warehouse floor. Get it to the far wall.',
    },
  },
  {
    n: 2,
    title: 'One battery charge',
    phase: 'understand',
    concept: 'Steering costs power',
    teach: 'Every correction runs the steering motor, and the motor drains the battery. Hard steering keeps you dead on the line but will not make it to the wall.',
    setup: {
      track: TRACKS.easy,
      lane: 60,
      speed: 3,
      damping: false,
      battery: 300,
      trace: false,
      brief: 'Same route, but the bot is down to its last charge. Finish without flattening the battery.',
    },
  },
  {
    n: 3,
    title: 'The twitchy line',
    phase: 'understand',
    concept: 'Damping',
    teach: 'On a narrow lane, steering harder makes it worse: the bot overshoots and weaves. Damping reacts to how fast the error is changing rather than how big it is, which catches the overshoot before it happens.',
    setup: {
      track: TRACKS.hard,
      lane: 30,
      speed: 5,
      damping: true,
      battery: null,
      trace: false,
      brief: 'A tight, twisting line down a narrow aisle at full speed. Steering strength alone will not save this one.',
    },
  },
  {
    n: 4,
    title: 'Read the wobble',
    phase: 'analyze',
    concept: 'The error trace',
    teach: 'Turn on the trace. It plots how far off the line the bot was at every moment. A good controller settles to a flat line, a twitchy one rings like a plucked string.',
    setup: {
      track: TRACKS.mid,
      lane: 35,
      speed: 4,
      damping: true,
      battery: null,
      trace: true,
      brief: 'Same bot, with the engineering readout switched on. Tune it until the trace goes quiet.',
    },
  },
  {
    n: 5,
    title: 'Race day',
    phase: 'optimize',
    concept: 'Fast, smooth, or cheap',
    teach: 'Pick your speed too. Fast finishes wobble more, dead smooth runs burn battery, and gentle runs are slow. There is no setting that wins all three.',
    setup: {
      track: TRACKS.hard,
      lane: 60,
      speed: null,
      damping: true,
      battery: null,
      trace: true,
      brief: 'The warehouse wants the round trip quick, accurate, and cheap. Find your compromise.',
    },
    metrics: [
      { id: 'time', label: 'Run time', goal: 'min', target: 190, unit: ' ticks' },
      { id: 'wobble', label: 'Average drift', goal: 'min', target: 12, unit: ' px' },
      { id: 'battery', label: 'Battery used', goal: 'min', target: 900 },
    ],
  },
]

interface RunResult {
  ok: boolean
  /** Why it ended, for the verdict line. */
  reason: 'finished' | 'lost-line' | 'flat-battery'
  xs: number[]
  ys: number[]
  errs: number[]
  ticks: number
  wobble: number
  battery: number
}

/**
 * Drive the bot down the track one tick at a time.
 * Steering is proportional to the error plus a damping term on how fast the
 * error is changing, which is the same idea as a real PD controller.
 */
function simulate(gain: number, damp: number, speed: number, setup: LineSetup): RunResult {
  let x = X0
  let y = Y0
  let heading = 0
  let prevErr = 0
  let first = true
  let sumSq = 0
  let effort = 0
  const xs: number[] = []
  const ys: number[] = []
  const errs: number[] = []

  for (let tick = 0; tick < 2000; tick++) {
    if (x >= X1) {
      return {
        ok: true,
        reason: 'finished',
        xs,
        ys,
        errs,
        ticks: tick,
        wobble: Math.sqrt(sumSq / Math.max(1, tick)),
        battery: effort * 100,
      }
    }

    const err = centerline(x, setup.track) - y
    const dErr = first ? 0 : err - prevErr
    first = false
    prevErr = err

    let rate = gain * GAIN_SCALE * err + damp * DAMP_SCALE * dErr
    rate = Math.max(-MAX_RATE, Math.min(MAX_RATE, rate))
    heading = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, heading + rate))

    y += speed * Math.sin(heading)
    x += speed * Math.cos(heading)
    sumSq += err * err
    effort += Math.abs(rate)
    xs.push(x)
    ys.push(y)
    errs.push(err)

    if (Math.abs(err) > setup.lane) {
      return { ok: false, reason: 'lost-line', xs, ys, errs, ticks: tick, wobble: Math.sqrt(sumSq / (tick + 1)), battery: effort * 100 }
    }
    if (setup.battery !== null && effort * 100 > setup.battery) {
      return { ok: false, reason: 'flat-battery', xs, ys, errs, ticks: tick, wobble: Math.sqrt(sumSq / (tick + 1)), battery: effort * 100 }
    }
  }
  return { ok: false, reason: 'lost-line', xs, ys, errs, ticks: 2000, wobble: Math.sqrt(sumSq / 2000), battery: effort * 100 }
}

/** The track drawn as a shaded lane with a dashed centreline. */
function TrackPath({ track, lane }: { track: Track; lane: number }) {
  const pts: string[] = []
  for (let x = X0; x <= X1; x += 6) pts.push(`${x},${centerline(x, track)}`)
  const d = `M ${pts.join(' L ')}`
  return (
    <>
      <path d={d} fill="none" strokeWidth={lane * 2} className="stroke-stone-300/60 dark:stroke-white/10" strokeLinecap="round" />
      <path d={d} fill="none" strokeWidth="3" strokeDasharray="10 10" className="stroke-stone-500 dark:stroke-stone-400" strokeLinecap="round" />
    </>
  )
}

export function LineFollowerChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('line-follower', LEVELS)
  const setup = lv.level.setup

  const [gain, setGain] = useState(40)
  const [damp, setDamp] = useState(0)
  const [speed, setSpeed] = useState(4)
  const [result, setResult] = useState<RunResult | null>(null)
  const [running, setRunning] = useState(false)
  const [runId, setRunId] = useState(0)
  const [won, setWon] = useState(false)
  const [showTrace, setShowTrace] = useState(true)
  const completedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  useEffect(() => {
    setGain(40)
    setDamp(setup.damping ? 30 : 0)
    setSpeed(4)
    setResult(null)
    setRunning(false)
    setWon(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lv.level.n])

  const driveSpeed = setup.speed ?? speed

  /** One point on the map sets both terms at once. */
  const { bind: tuneBind } = useSvgDrag((x, y) => {
    if (running) return
    setGain(Math.max(5, Math.min(100, Math.round(((x - 26) / 184) * 95 + 5))))
    if (setup.damping) setDamp(Math.max(0, Math.min(100, Math.round(((150 - y) / 140) * 100))))
  })
  const nudgeTune = (e: React.KeyboardEvent) => {
    if (running) return
    const s = e.shiftKey ? 10 : 3
    if (e.key === 'ArrowRight') setGain((v) => Math.min(100, v + s))
    else if (e.key === 'ArrowLeft') setGain((v) => Math.max(5, v - s))
    else if (e.key === 'ArrowUp' && setup.damping) setDamp((v) => Math.min(100, v + s))
    else if (e.key === 'ArrowDown' && setup.damping) setDamp((v) => Math.max(0, v - s))
    else return
    e.preventDefault()
  }

  const go = () => {
    if (running) return
    const run = simulate(gain, setup.damping ? damp : 0, driveSpeed, setup)
    setResult(run)
    setRunId((i) => i + 1)
    setRunning(true)
    // The bot animates along the path; settle the verdict when it arrives.
    const duration = Math.min(3.2, Math.max(1.2, run.ticks / 90))
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setRunning(false)
      if (!run.ok) return
      setWon(true)
      lv.clearLevel(
        lv.level.metrics ? { time: run.ticks, wobble: run.wobble, battery: run.battery } : undefined,
      )
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, duration * 1000 + 150)
  }

  const reset = () => {
    setResult(null)
    setWon(false)
    setRunning(false)
  }

  const duration = result ? Math.min(3.2, Math.max(1.2, result.ticks / 90)) : 1
  const showTraceNow = setup.trace && showTrace && result !== null
  const TRACE_TOP = 300
  const TRACE_H = 70

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={
          setup.trace ? <InsightToggle label="error trace" on={showTrace} onChange={setShowTrace} /> : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">Lane ±{setup.lane} px</Badge>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-stone-100/80 dark:bg-white/5">
        <svg
          viewBox={`0 0 800 ${showTraceNow ? TRACE_TOP + TRACE_H + 26 : 300}`}
          className="w-full"
          role="img"
          aria-label="Line following robot"
        >
          <TrackPath track={setup.track} lane={setup.lane} />

          {/* finish line */}
          <line x1={X1} y1={Y0 - 90} x2={X1} y2={Y0 + 90} strokeWidth="4" strokeDasharray="8 8" style={{ stroke: 'var(--accent)' }} />
          <text x={X1 - 6} y={Y0 - 98} textAnchor="end" fontSize="13" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
            Finish
          </text>

          {/* the path the bot actually drove */}
          {result && (
            <polyline
              points={result.xs.map((x, i) => `${x},${result.ys[i]}`).join(' ')}
              fill="none"
              strokeWidth="2.5"
              style={{ stroke: 'var(--accent)' }}
              opacity="0.75"
            />
          )}

          {/* where it lost the line */}
          {result && !result.ok && result.xs.length > 0 && (
            <circle
              cx={result.xs[result.xs.length - 1]}
              cy={result.ys[result.ys.length - 1]}
              r="10"
              className="fill-rose-500"
              opacity="0.85"
            />
          )}

          {/* the bot */}
          {result ? (
            <motion.rect
              key={runId}
              width="22"
              height="14"
              rx="4"
              className="fill-ink dark:fill-stone-200"
              initial={{ x: X0 - 11, y: Y0 - 7 }}
              animate={{ x: result.xs.map((x) => x - 11), y: result.ys.map((y) => y - 7) }}
              transition={{ duration, ease: 'linear' }}
            />
          ) : (
            <rect x={X0 - 11} y={Y0 - 7} width="22" height="14" rx="4" className="fill-ink dark:fill-stone-200" />
          )}

          {/* level 4 overlay: how far off the line, tick by tick */}
          {showTraceNow && result && (
            <g>
              <text x="40" y={TRACE_TOP - 10} fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                Distance off the line, over the whole run
              </text>
              <rect x="40" y={TRACE_TOP} width={X1 - X0} height={TRACE_H} rx="6" className="fill-white/60 dark:fill-white/5" />
              <line
                x1="40"
                y1={TRACE_TOP + TRACE_H / 2}
                x2={X1}
                y2={TRACE_TOP + TRACE_H / 2}
                strokeWidth="1.5"
                strokeDasharray="6 6"
                className="stroke-stone-400 dark:stroke-stone-600"
              />
              <polyline
                points={result.errs
                  .map((e, i) => {
                    const px = 40 + (i / Math.max(1, result.errs.length - 1)) * (X1 - X0)
                    const py = TRACE_TOP + TRACE_H / 2 - Math.max(-1, Math.min(1, e / setup.lane)) * (TRACE_H / 2 - 4)
                    return `${px},${py}`
                  })
                  .join(' ')}
                fill="none"
                strokeWidth="2"
                style={{ stroke: 'var(--accent)' }}
              />
              <text x="46" y={TRACE_TOP + TRACE_H / 2 - 4} fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                on the line
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Verdict */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        {result && !running && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'rounded-xl px-4 py-2.5 text-sm font-semibold',
              result.ok
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
            )}
          >
            {result.ok
              ? `Made it in ${result.ticks} ticks, drifting ${result.wobble.toFixed(1)} px on average.`
              : result.reason === 'flat-battery'
                ? 'Battery flat before the wall. Those corrections were too aggressive to keep up all the way.'
                : setup.damping && damp < 15
                  ? 'Lost the line. It kept overshooting and weaving wider each time. Try adding damping.'
                  : 'Lost the line. The bot drifted further off than its sensor can see.'}
          </motion.p>
        )}
      </div>

      {/* Battery gauge */}
      {setup.battery !== null && (
        <div className="mt-3">
          <Meter
            label="Battery"
            display={result ? `${Math.round(result.battery)} of ${setup.battery} used` : `${setup.battery} available`}
            fraction={result ? result.battery / setup.battery : 0}
            barClass={result && result.battery > setup.battery ? 'bg-rose-500' : 'bg-emerald-500'}
          />
        </div>
      )}

      {/* Pick a point on the tuning map rather than pushing two numbers. */}
      <div className="mt-4 grid items-start gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 font-display text-sm font-semibold">
            Controller tuning{' '}
            <span className="font-normal text-ink-soft dark:text-stone-400">
              · strength {gain}
              {setup.damping ? `, damping ${damp}` : ''}
            </span>
          </p>
          <svg viewBox="0 0 220 180" className="w-full max-w-[240px]" role="img" aria-label="Controller tuning map" {...tuneBind}>
            <rect x="26" y="10" width="184" height="140" rx="8" className="fill-stone-100 dark:fill-white/5" />
            {/* twitchy corner: lots of steering, no damping */}
            {setup.damping && (
              <path d="M26 150 L120 150 L26 60 Z" className="fill-rose-400/25" />
            )}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <line key={f} x1={26 + f * 184} y1="10" x2={26 + f * 184} y2="150" strokeWidth="1" className="stroke-stone-300/60 dark:stroke-white/10" />
            ))}
            <circle
              cx={26 + ((gain - 5) / 95) * 184}
              cy={setup.damping ? 150 - (damp / 100) * 140 : 80}
              r="11"
              tabIndex={0}
              onKeyDown={nudgeTune}
              role="application"
              aria-label={`Tuning. Strength ${gain}${setup.damping ? `, damping ${damp}` : ''}. Arrow keys adjust.`}
              className="cursor-grab outline-none"
              style={{ fill: 'var(--accent)' }}
            />
            <text x="118" y="168" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
              steering strength
            </text>
            {setup.damping && (
              <text x="14" y="80" textAnchor="middle" fontSize="11" fontWeight="700" transform="rotate(-90 14 80)" className="fill-ink-soft font-display dark:fill-stone-400">
                damping
              </text>
            )}
            {setup.damping && (
              <text x="40" y="142" fontSize="9" fontWeight="700" className="fill-rose-500 font-display">
                weaves
              </text>
            )}
          </svg>
        </div>

        {setup.speed === null && (
          <div>
            <p className="mb-2 font-display text-sm font-semibold">Drive speed</p>
            <div className="flex flex-wrap gap-2">
              {[
                { v: 3, label: 'Careful' },
                { v: 4, label: 'Normal' },
                { v: 5, label: 'Quick' },
              ].map((g) => (
                <button
                  key={g.v}
                  type="button"
                  disabled={running}
                  onClick={() => setSpeed(g.v)}
                  aria-pressed={speed === g.v}
                  className={cn(
                    'rounded-full px-4 py-2 font-display text-sm font-semibold transition-colors duration-200 disabled:opacity-40',
                    speed === g.v
                      ? 'accent-bg text-white shadow-clay'
                      : 'bg-stone-100 text-ink-soft hover:bg-stone-200 dark:bg-white/5 dark:text-stone-400 dark:hover:bg-white/10',
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={go} disabled={running}>
          <Play className="h-5 w-5" fill="currentColor" />
          {running ? 'Driving...' : 'Run the bot'}
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Clear the run">
          <RotateCcw className="h-4 w-4" />
          Clear
        </Button>
        {setup.speed !== null && <Badge className="ml-auto">Speed locked at {setup.speed}</Badge>}
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{
              time: result?.ticks ?? 0,
              wobble: result?.wobble ?? 0,
              battery: result?.battery ?? 0,
            }}
            best={lv.best}
            scored={won}
          />
        </div>
      )}

      {won && !running && (
        <LevelComplete
          lv={lv}
          message={
            lv.level.metrics
              ? `${result?.ticks} ticks, ${result?.wobble.toFixed(1)} px drift. Now try a different compromise.`
              : 'Clean run. The bot never lost the line.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
