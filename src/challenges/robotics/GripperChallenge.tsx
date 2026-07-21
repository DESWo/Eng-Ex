import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpFromLine, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
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
const GRAVITY = 10
const FORCE_SCALE = 4 // keeps the numbers in a comfortable slider range
const MAX_GRIP = 200

/** Gripper pads. Grippier pads need less squeeze, softer pads spread the squeeze out. */
const PADS = {
  steel: { label: 'Steel', mu: 0.35, crushMul: 0.7, note: 'Hard and slippery' },
  rubber: { label: 'Rubber', mu: 0.9, crushMul: 1.0, note: 'Grippy all-rounder' },
  foam: { label: 'Soft foam', mu: 1.15, crushMul: 1.7, note: 'Grippy, and spreads the squeeze' },
} as const
type PadId = keyof typeof PADS
const PAD_IDS = Object.keys(PADS) as PadId[]

interface Payload {
  label: string
  /** Heavier things need more squeeze before they slip. */
  mass: number
  /** Squeeze this hard with rubber pads and it breaks. */
  crush: number
  /** Drawn width and height in the scene. */
  w: number
  h: number
  fill: string
}

const PAYLOADS = {
  can: { label: 'Soup can', mass: 3, crush: 340, w: 54, h: 76, fill: 'fill-stone-400 dark:fill-stone-500' },
  egg: { label: 'Egg', mass: 0.5, crush: 48, w: 44, h: 56, fill: 'fill-amber-100 dark:fill-amber-200' },
  // Crush is set just under the rubber slip force, so rubber is strictly impossible
  // rather than solvable on a single exact value.
  bulb: { label: 'Light bulb', mass: 0.3, crush: 15, w: 42, h: 58, fill: 'fill-yellow-200 dark:fill-yellow-300' },
  jar: { label: 'Glass jar', mass: 1.2, crush: 88, w: 58, h: 74, fill: 'fill-sky-200 dark:fill-sky-300' },
} as const

interface GripSetup {
  payload: Payload
  /** Fixed pad, or null when the player chooses. */
  pad: PadId | null
  /** Fixed lift acceleration, or null when the player chooses. */
  accel: number | null
  /** Level 4 on: the force window is available. */
  window: boolean
  brief: string
}

const LEVELS: ChallengeLevel<GripSetup>[] = [
  {
    n: 1,
    title: 'Pick it up',
    phase: 'play',
    concept: 'Grip enough to hold',
    teach: 'It is the steady-hand buzzer game, played with real force. Squeeze too gently and the can slides straight out of the gripper. Turn the grip up until it holds.',
    setup: { payload: PAYLOADS.can, pad: 'rubber', accel: 2, window: false, brief: 'A warehouse gripper needs to lift a soup can off the belt.' },
  },
  {
    n: 2,
    title: 'Handle with care',
    phase: 'understand',
    concept: 'A crush limit',
    teach: 'An egg has a ceiling as well as a floor. Too little grip and it slips, too much and it cracks, so now you are aiming for a window instead of a minimum.',
    setup: { payload: PAYLOADS.egg, pad: 'rubber', accel: 2, window: false, brief: 'Same gripper, but the next item on the belt is an egg.' },
  },
  {
    n: 3,
    title: 'Change the pads',
    phase: 'understand',
    concept: 'Pad material',
    teach: 'This bulb cannot be held with rubber at all: the grip it takes to stop the slip is the grip that shatters it. A grippier, softer pad needs less squeeze AND spreads it over more glass.',
    setup: { payload: PAYLOADS.bulb, pad: null, accel: 2, window: false, brief: 'A bare light bulb. Rubber pads will not do it, so swap them.' },
  },
  {
    n: 4,
    title: 'See the window',
    phase: 'analyze',
    concept: 'Slip and crush lines',
    teach: 'Turn on the force window. The lower line is where it slips, the upper line is where it breaks, and you want to sit in the middle of the gap rather than clinging to either edge.',
    setup: { payload: PAYLOADS.jar, pad: null, accel: 2, window: true, brief: 'A full glass jar, with the engineering readout switched on.' },
  },
  {
    n: 5,
    title: 'Beat the cycle time',
    phase: 'optimize',
    concept: 'Speed eats your margin',
    teach: 'You set the lift speed too. Snatching it up fast means the jar throws its own weight around and needs far more grip, which pushes you towards the crush line. Fast, safe, and gentle pull against each other.',
    setup: { payload: PAYLOADS.jar, pad: null, accel: null, window: false, brief: 'The line wants jars moved quickly, without breakages, on a gripper that is not wearing itself out.' },
    metrics: [
      { id: 'time', label: 'Lift time', goal: 'min', target: 12 },
      { id: 'margin', label: 'Safety margin', goal: 'max', target: 20 },
      { id: 'grip', label: 'Grip force', goal: 'min', target: 90 },
    ],
  },
]

/** Squeeze needed before the payload slips out, given the pads and how hard we accelerate. */
const slipForce = (p: Payload, pad: PadId, accel: number) =>
  (FORCE_SCALE * p.mass * (GRAVITY + accel)) / PADS[pad].mu

/** Squeeze that breaks it, which softer pads raise by spreading the load. */
const crushForce = (p: Payload, pad: PadId) => p.crush * PADS[pad].crushMul

export function GripperChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('gripper', LEVELS)
  const setup = lv.level.setup

  const [grip, setGrip] = useState(30)
  const [padId, setPadId] = useState<PadId>('rubber')
  const [accel, setAccel] = useState(3)
  const [won, setWon] = useState(false)
  const [showWindow, setShowWindow] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    setGrip(30)
    setPadId(setup.pad ?? 'rubber')
    setAccel(setup.accel ?? 3)
    setWon(false)
    setVerdict(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lv.level.n])

  const pad = setup.pad ?? padId
  const a = setup.accel ?? accel
  const slip = slipForce(setup.payload, pad, a)
  const crush = crushForce(setup.payload, pad)
  // When slip meets crush there is no safe grip at all, so "impossible" and
  // "held" must never both be true.
  const impossible = slip >= crush
  const held = !impossible && grip >= slip && grip <= crush
  const margin = Math.min(grip - slip, crush - grip)
  const liftTime = 60 / (2 + a)

  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  const att = useAttempts(attemptsFor(lv.level), lv.level.n)

  /** Actually lift the item. Slip and crush only reveal themselves in the air. */
  const lift = () => {
    if (won) return
    if (held) {
      setWon(true)
      setVerdict({ ok: true, text: `Held safely, with ${Math.round(margin)} of margin on the tighter side.` })
      lv.clearLevel(lv.level.metrics ? { time: liftTime, margin, grip } : undefined)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const text = impossible
      ? `These pads cannot do it: the item starts breaking at ${Math.round(crush)} before it stops slipping at ${Math.round(slip)}. Try a different pad.`
      : grip < slip
        ? `It slipped out on the way up. This setup needs at least ${Math.round(slip)} of grip.`
        : `Crushed it. Anything over ${Math.round(crush)} is too much here.`
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'The bin of broken stock is full. Line reset. Slip depends on weight, pad, and speed; crush only on the item. Think it through.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  const reset = () => {
    setGrip(30)
    setPadId(setup.pad ?? 'rubber')
    setAccel(setup.accel ?? 3)
    setWon(false)
    setVerdict(null)
  }

  /** Drag along the force bar to squeeze harder or softer. */
  const { bind } = useSvgDrag((x) => {
    const f = ((x - 80) / 640) * MAX_GRIP
    setGrip(Math.max(0, Math.min(MAX_GRIP, Math.round(f))))
  })
  const nudgeGrip = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2
    if (e.key === 'ArrowRight') setGrip((g) => Math.min(MAX_GRIP, g + step))
    else if (e.key === 'ArrowLeft') setGrip((g) => Math.max(0, g - step))
    else return
    e.preventDefault()
  }

  const state: 'slipping' | 'crushed' | 'held' = grip < slip ? 'slipping' : grip > crush ? 'crushed' : 'held'

  /* Scene geometry */
  const CX = 400
  const TOP = 60
  const obj = setup.payload
  // The jaws close in as grip rises, and the payload rides up once it is held.
  const jawGap = obj.w / 2 + 10 - Math.min(8, (grip / MAX_GRIP) * 14)
  const objY = state === 'held' && won ? TOP + 40 : state === 'slipping' ? TOP + 150 : TOP + 96

  const WIN_Y = 260
  const WIN_W = 640
  const WIN_X = 80
  const toX = (f: number) => WIN_X + Math.min(1, f / MAX_GRIP) * WIN_W

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.window ? <InsightToggle label="force window" on={showWindow} onChange={setShowWindow} /> : undefined}
      />

      <Objective
        goal={`Lift the ${setup.payload.label.toLowerCase()} without slipping or crushing`}
        status={`grip set to ${grip}`}
        attemptsLeft={att.left}
        met={won}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{obj.label}</Badge>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-stone-100/80 dark:bg-white/5">
        <svg
          viewBox="0 0 800 340"
          className="w-full"
          role="img"
          aria-label="Robot gripper"
          {...bind}
        >
          {/* gantry */}
          <rect x={CX - 70} y="18" width="140" height="16" rx="8" className="fill-stone-400 dark:fill-stone-600" />
          <line x1={CX} y1="34" x2={CX} y2={TOP} strokeWidth="8" className="stroke-stone-400 dark:stroke-stone-600" />

          {/* jaws */}
          {[-1, 1].map((side) => (
            <rect
              key={side}
              x={CX + side * jawGap - (side === 1 ? 0 : 14)}
              y={TOP + 70}
              width="14"
              height="56"
              rx="4"
              className="fill-stone-500 dark:fill-stone-400"
              style={{ transition: 'x 0.25s ease-out' }}
            />
          ))}
          <rect x={CX - jawGap - 14} y={TOP + 54} width={jawGap * 2 + 28} height="16" rx="6" className="fill-stone-600 dark:fill-stone-500" />

          {/* the payload */}
          <motion.g animate={{ y: objY - (TOP + 96) }} transition={{ type: 'spring', stiffness: 180, damping: 20 }}>
            <rect
              x={CX - obj.w / 2}
              y={TOP + 96}
              width={obj.w}
              height={obj.h}
              rx={state === 'crushed' ? 4 : 10}
              className={cn(obj.fill, state === 'crushed' && 'opacity-60')}
            />
            {state === 'crushed' && (
              <g className="stroke-rose-600" strokeWidth="2.5" strokeLinecap="round">
                <line x1={CX - 14} y1={TOP + 110} x2={CX + 8} y2={TOP + 132} />
                <line x1={CX + 10} y1={TOP + 108} x2={CX - 6} y2={TOP + 140} />
              </g>
            )}
          </motion.g>

          {/* belt */}
          <rect x="60" y={TOP + 176} width="680" height="12" rx="6" className="fill-stone-300 dark:fill-white/10" />

          {/* The squeeze control. Level 4 reveals what the safe gap actually is. */}
          {(
            <g>
              <text x={WIN_X} y={WIN_Y - 14} fontSize="12" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                {setup.window && showWindow ? 'Force window for these pads' : 'Drag the squeeze'}
              </text>
              <rect x={WIN_X} y={WIN_Y} width={WIN_W} height="18" rx="9" className="fill-stone-200 dark:bg-white/10 dark:fill-white/10" />
              {!impossible && setup.window && showWindow && (
                <rect
                  x={toX(slip)}
                  y={WIN_Y}
                  width={Math.max(0, toX(crush) - toX(slip))}
                  height="18"
                  rx="9"
                  className="fill-emerald-400/70"
                />
              )}
              {/* slip line */}
              {setup.window && showWindow && <line x1={toX(slip)} y1={WIN_Y - 6} x2={toX(slip)} y2={WIN_Y + 24} strokeWidth="2.5" className="stroke-amber-600" />}
              {setup.window && showWindow && (
                <text x={toX(slip)} y={WIN_Y + 40} textAnchor="middle" fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                  slips below {Math.round(slip)}
                </text>
              )}
              {/* crush line */}
              {setup.window && showWindow && <line x1={toX(crush)} y1={WIN_Y - 6} x2={toX(crush)} y2={WIN_Y + 24} strokeWidth="2.5" className="stroke-rose-600" />}
              {setup.window && showWindow && (
                <text x={toX(crush)} y={WIN_Y + 40} textAnchor="middle" fontSize="11" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                  breaks above {Math.round(crush)}
                </text>
              )}
              {/* the squeeze itself, which you drag */}
              <circle
                cx={toX(grip)}
                cy={WIN_Y + 9}
                r="13"
                tabIndex={0}
                onKeyDown={nudgeGrip}
                role="slider"
                aria-label="Grip force"
                aria-valuenow={grip}
                aria-valuemin={0}
                aria-valuemax={MAX_GRIP}
                className="cursor-ew-resize fill-ink outline-none dark:fill-white"
              />
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
          <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-300">
            Set the grip, then lift. Slip and crush only show themselves in the air.
          </p>
        )}
      </div>

      {/* Pad picker */}
      {setup.pad === null && (
        <div className="mt-4">
          <p className="mb-2 font-display text-sm font-semibold">Gripper pads</p>
          <div className="flex flex-wrap gap-2">
            {PAD_IDS.map((id) => {
              const spec = PADS[id]
              const active = padId === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPadId(id)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-2xl px-4 py-2.5 text-left font-display text-sm font-semibold transition-colors duration-200',
                    active
                      ? 'accent-bg text-white shadow-clay'
                      : 'bg-stone-100 text-ink-soft hover:bg-stone-200 dark:bg-white/5 dark:text-stone-400 dark:hover:bg-white/10',
                  )}
                >
                  <span className="block">{spec.label}</span>
                  <span className={cn('block text-xs font-medium', active ? 'text-white/80' : 'opacity-70')}>
                    {spec.note}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {setup.accel === null && (
        <div className="mt-4">
          <p className="mb-2 font-display text-sm font-semibold">Lift speed</p>
          <div className="flex flex-wrap gap-2">
            {[
              { v: 0, label: 'Crawl' },
              { v: 2, label: 'Steady' },
              { v: 4, label: 'Brisk' },
              { v: 6, label: 'Snatch' },
            ].map((g) => (
              <button
                key={g.v}
                type="button"
                onClick={() => setAccel(g.v)}
                aria-pressed={accel === g.v}
                className={cn(
                  'rounded-full px-4 py-2 font-display text-sm font-semibold transition-colors duration-200',
                  accel === g.v
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

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={lift} disabled={won}>
          <ArrowUpFromLine className="h-5 w-5" />
          Lift it
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Reset the gripper">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        {setup.accel === null && <Badge className="ml-auto">Lift takes {liftTime.toFixed(1)}s</Badge>}
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ time: liftTime, margin: Math.max(0, margin), grip }}
            best={lv.best}
            scored={won}
          />
        </div>
      )}

      {won && (
        <LevelComplete
          lv={lv}
          message={
            lv.level.metrics
              ? `Lifted in ${liftTime.toFixed(1)}s with ${Math.round(margin)} to spare. Try shaving the time.`
              : 'Held it. Nothing slipped, nothing broke.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
