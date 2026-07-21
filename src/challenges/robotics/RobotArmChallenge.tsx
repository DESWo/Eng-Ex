import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Grab, RotateCcw } from 'lucide-react'
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
import { useSvgDrag } from '@/hooks/useSvgDrag'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const L1 = 95 // upper arm length (px)
const L2 = 85 // forearm length (px)
const BASE_X = 400
const BASE_Y = 300
const REACH_TOLERANCE = 14 // how close the gripper must get (px)
const GRAB_RADIUS = 46 // you must grab the claw itself to drag it (px)
const SHOULDER_MIN = 5
const SHOULDER_MAX = 175
const ELBOW_MIN = 20 // cannot fold the forearm flat against the upper arm
const ELBOW_MAX = 160

interface Pose {
  shoulder: number
  elbow: number
  elbowX: number
  elbowY: number
  handX: number
  handY: number
  /** True when the maths gives a pose the joints cannot actually hold. */
  outOfLimits: boolean
  /** True when a link passes through the shelf. */
  blocked: boolean
}

interface Shelf {
  x: number
  top: number
}

/** Where the gripper ends up for a given pair of joint angles. */
function forward(shoulder: number, elbow: number) {
  const a1 = (shoulder * Math.PI) / 180
  const a2 = ((shoulder + elbow) * Math.PI) / 180
  const elbowX = BASE_X + L1 * Math.cos(a1)
  const elbowY = BASE_Y - L1 * Math.sin(a1)
  return { elbowX, elbowY, handX: elbowX + L2 * Math.cos(a2), handY: elbowY - L2 * Math.sin(a2) }
}

/** Does a straight link pass through the shelf? Sampled, which is plenty here. */
function hitsShelf(x1: number, y1: number, x2: number, y2: number, shelf: Shelf | undefined) {
  if (!shelf) return false
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    const x = x1 + (x2 - x1) * t
    const y = y1 + (y2 - y1) * t
    if (Math.abs(x - shelf.x) <= 11 && y >= shelf.top && y <= BASE_Y + 12) return true
  }
  return false
}

/**
 * Inverse kinematics: given a point, work out the joint angles that put the
 * gripper there. There are almost always TWO answers, elbow up and elbow down,
 * which is the whole lesson of level 3.
 */
function solve(targetX: number, targetY: number, elbowUp: boolean, limits: boolean, shelf?: Shelf): Pose {
  const dx = targetX - BASE_X
  const dy = BASE_Y - targetY
  const reach = Math.hypot(dx, dy)
  // Past the arm's reach, stretch straight at the point instead of failing.
  const d = Math.max(Math.abs(L1 - L2) + 0.5, Math.min(L1 + L2 - 0.5, reach))

  const cosElbow = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2)
  const elbowMag = (Math.acos(Math.max(-1, Math.min(1, cosElbow))) * 180) / Math.PI
  const elbow = elbowUp ? elbowMag : -elbowMag

  const a2 = (elbow * Math.PI) / 180
  const shoulder =
    (Math.atan2(dy, dx) * 180) / Math.PI -
    (Math.atan2(L2 * Math.sin(a2), L1 + L2 * Math.cos(a2)) * 180) / Math.PI

  const k = forward(shoulder, elbow)
  const outOfLimits =
    limits &&
    (shoulder < SHOULDER_MIN ||
      shoulder > SHOULDER_MAX ||
      Math.abs(elbow) < ELBOW_MIN ||
      Math.abs(elbow) > ELBOW_MAX)
  const blocked =
    hitsShelf(BASE_X, BASE_Y, k.elbowX, k.elbowY, shelf) ||
    hitsShelf(k.elbowX, k.elbowY, k.handX, k.handY, shelf)

  return { shoulder, elbow, ...k, outOfLimits, blocked }
}

interface ArmSetup {
  /** Parts to pick up, in order. */
  targets: { x: number; y: number }[]
  shelf?: Shelf
  /** Level 2 on: the joints have real stops. */
  limits: boolean
  /** Level 3 on: the elbow can be flipped to the other solution. */
  flip: boolean
  /** Level 4 on: the workspace readout is available. */
  envelope: boolean
  brief: string
}

const LEVELS: ChallengeLevel<ArmSetup>[] = [
  {
    n: 1,
    title: 'Grab the prize',
    phase: 'play',
    concept: 'The arm follows your hand',
    teach: 'It is the arcade claw machine, wearing its true name: a robot arm. Drag the claw straight onto the prize. You move a point, and the arm works out for itself what angle each joint needs, the calculation real robot controllers run thousands of times a second.',
    setup: { targets: [{ x: 270, y: 200 }], limits: false, flip: false, envelope: false, brief: 'A plush prize sits on the cabinet floor. Drag the claw onto it.' },
  },
  {
    n: 2,
    title: 'Joints have stops',
    phase: 'understand',
    concept: 'Limits and reach',
    teach: 'Real joints do not spin freely. This shoulder cannot swing below the bench and the elbow cannot fold flat, so some points the maths says are reachable simply are not.',
    setup: { targets: [{ x: 450, y: 140 }], limits: true, flip: false, envelope: false, brief: 'A prize right out at the edge of what this claw can do.' },
  },
  {
    n: 3,
    title: 'Two ways to get there',
    phase: 'understand',
    concept: 'Elbow up or elbow down',
    teach: 'Almost every point can be reached two ways, with the elbow bent up or bent down. They put the gripper in exactly the same place while the arm occupies completely different space, and here only one of them misses the shelf.',
    setup: { targets: [{ x: 298, y: 170 }], shelf: { x: 345, top: 200 }, limits: true, flip: true, envelope: false, brief: 'The prize is behind a stack of boxes. The claw can reach it, but can the arm?' },
  },
  {
    n: 4,
    title: 'See the reach',
    phase: 'analyze',
    concept: 'The workspace',
    teach: 'Turn on the readout. The shaded ring is every point this arm can physically touch, and the ghost shows the other elbow solution for wherever you are now. Notice the hole in the middle: it cannot fold tightly enough to reach its own base.',
    setup: { targets: [{ x: 470, y: 160 }], shelf: { x: 345, top: 220 }, limits: true, flip: true, envelope: true, brief: 'The same cabinet, with the arm workspace drawn out.' },
  },
  {
    n: 5,
    title: 'Run the cycle',
    phase: 'optimize',
    concept: 'Travel, strain, and flips',
    teach: 'Three parts, one after another. Every degree the joints turn is time, reaching far out strains the shoulder, and flipping the elbow mid-cycle means stopping and rearranging the whole arm.',
    setup: {
      targets: [
        { x: 300, y: 205 },
        { x: 470, y: 150 },
        { x: 545, y: 240 },
      ],
      limits: true,
      flip: true,
      envelope: true,
      brief: 'Three prizes, one clean run: the pick-and-place cycle a factory arm repeats all day.',
    },
    metrics: [
      { id: 'travel', label: 'Joint travel', goal: 'min', target: 420, unit: '°' },
      { id: 'torque', label: 'Peak shoulder load', goal: 'min', target: 150 },
      { id: 'flips', label: 'Elbow flips', goal: 'min', target: 1 },
    ],
  },
]

export function RobotArmChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('robot-arm', LEVELS)
  const setup = lv.level.setup

  // The point you are dragging. The arm chases it.
  const [aim, setAim] = useState({ x: 300, y: 250 })
  const [elbowUp, setElbowUp] = useState(true)
  const [reached, setReached] = useState<number[]>([])
  const [travel, setTravel] = useState(0)
  const [peakTorque, setPeakTorque] = useState(0)
  const [flips, setFlips] = useState(0)
  const [won, setWon] = useState(false)
  const [showEnvelope, setShowEnvelope] = useState(true)
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)
  /** Coins in the slot: each failed grab eats one, arcade rules. */
  const att = useAttempts(lv.level.n === 1 ? null : 3, lv.level.n)
  const completedRef = useRef(false)
  const lastPose = useRef<{ shoulder: number; elbow: number } | null>(null)
  // A drag gesture only moves the claw if it started ON the claw.
  const gestureLive = useRef(false)
  const gestureGrabbed = useRef(false)

  useEffect(() => {
    setAim({ x: 300, y: 250 })
    setElbowUp(true)
    setReached([])
    setTravel(0)
    setPeakTorque(0)
    setFlips(0)
    setWon(false)
    setVerdict(null)
    lastPose.current = null
  }, [lv.level.n])

  const pose = solve(aim.x, aim.y, elbowUp, setup.limits, setup.shelf)
  const usable = !pose.outOfLimits && !pose.blocked

  // Add up how far the joints have turned, and how hard the shoulder is working.
  useEffect(() => {
    const prev = lastPose.current
    if (prev) {
      setTravel((t) => t + Math.abs(pose.shoulder - prev.shoulder) + Math.abs(pose.elbow - prev.elbow))
    }
    lastPose.current = { shoulder: pose.shoulder, elbow: pose.elbow }
    if (usable) setPeakTorque((p) => Math.max(p, Math.abs(pose.handX - BASE_X)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose.shoulder, pose.elbow])

  // Touching a part with a legal pose collects it.
  const nextIndex = reached.length
  const target = setup.targets[Math.min(nextIndex, setup.targets.length - 1)]
  const dist = Math.hypot(pose.handX - target.x, pose.handY - target.y)
  const onTarget = usable && dist <= REACH_TOLERANCE

  const allDone = reached.length >= setup.targets.length

  /** Drop the claw. Arcade rules: it closes on whatever is exactly under it. */
  const grab = () => {
    if (won || allDone) return
    if (onTarget) {
      const nowReached = [...reached, nextIndex]
      setReached(nowReached)
      if (nowReached.length >= setup.targets.length) {
        setWon(true)
        setVerdict({ ok: true, text: setup.targets.length > 1 ? 'Cycle complete. Every prize in the chute.' : 'Got it! The claw closed right on the prize.' })
        lv.clearLevel(
          lv.level.metrics ? { travel, torque: peakTorque, flips } : undefined,
        )
        if (!completedRef.current) {
          completedRef.current = true
          onComplete()
        }
      } else {
        setVerdict({ ok: true, text: `Prize ${nowReached.length} of ${setup.targets.length} in the chute. Next one.` })
      }
      return
    }
    const text = !usable
      ? pose.blocked
        ? 'The claw closed on air: the arm is fouling the shelf in this pose. Try the other elbow.'
        : 'The claw closed on air: the joints cannot actually hold that pose.'
      : `The claw closed on air, ${Math.round(dist)} px off the prize.`
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'Out of coins. The machine resets with a wink. Line the claw up properly before you drop it.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  const reset = () => {
    setVerdict(null)
    setAim({ x: 300, y: 250 })
    setElbowUp(true)
    setReached([])
    setTravel(0)
    setPeakTorque(0)
    setFlips(0)
    setWon(false)
    lastPose.current = null
  }

  const { dragging, bind } = useSvgDrag((x, y, done) => {
    if (won) return
    if (!gestureLive.current) {
      // First sample of a new gesture: it counts only if it starts on the claw.
      gestureLive.current = true
      gestureGrabbed.current = Math.hypot(x - pose.handX, y - pose.handY) <= GRAB_RADIUS
    }
    if (gestureGrabbed.current) {
      setAim({ x: Math.max(40, Math.min(760, x)), y: Math.max(20, Math.min(BASE_Y + 6, y)) })
    }
    if (done) gestureLive.current = false
  })

  const nudge = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 12 : 4
    const d: Record<string, [number, number]> = {
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
    }
    const move = d[e.key]
    if (!move) return
    e.preventDefault()
    setAim((a) => ({ x: Math.max(40, Math.min(760, a.x + move[0])), y: Math.max(20, Math.min(BASE_Y + 6, a.y + move[1])) }))
  }

  const flipElbow = () => {
    setElbowUp((u) => !u)
    setFlips((f) => f + 1)
  }

  const ghost = setup.envelope && showEnvelope ? solve(aim.x, aim.y, !elbowUp, setup.limits, setup.shelf) : null

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.envelope ? <InsightToggle label="workspace" on={showEnvelope} onChange={setShowEnvelope} /> : undefined}
      />

      <Objective
        goal={setup.targets.length > 1 ? `Pick up all ${setup.targets.length} prizes, in order, one clean grab each` : 'Line the claw up on the prize and drop it: one clean grab'}
        status={`prizes in the chute: ${reached.length} of ${setup.targets.length}`}
        attemptsLeft={att.left}
        met={won}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        {setup.targets.length > 1 && (
          <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
            Prize {Math.min(reached.length + 1, setup.targets.length)} of {setup.targets.length}
          </Badge>
        )}
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-stone-100/80 dark:bg-white/5">
        <svg viewBox="0 0 800 340" className="w-full" role="img" aria-label="Claw machine scene" {...bind}>
          {/* level 4 overlay: everywhere the arm can physically touch */}
          {setup.envelope && showEnvelope && (
            <>
              <circle cx={BASE_X} cy={BASE_Y} r={L1 + L2} className="fill-sky-400/10" />
              <circle cx={BASE_X} cy={BASE_Y} r={L1 + L2} fill="none" strokeWidth="1.5" strokeDasharray="5 6" className="stroke-sky-400/60" />
              <circle cx={BASE_X} cy={BASE_Y} r={Math.abs(L1 - L2) + 30} className="fill-stone-100 dark:fill-[#1b222b]" />
              <circle cx={BASE_X} cy={BASE_Y} r={Math.abs(L1 - L2) + 30} fill="none" strokeWidth="1.5" strokeDasharray="5 6" className="stroke-sky-400/60" />
            </>
          )}

          <line x1="0" y1="312" x2="800" y2="312" strokeWidth="4" className="stroke-stone-300 dark:stroke-stone-600" />

          {/* a stack of prize boxes the arm must not sweep through */}
          {setup.shelf && (
            <g className={pose.blocked ? 'fill-rose-400' : 'fill-amber-300/90 dark:fill-amber-700'}>
              {(() => {
                const boxes = []
                let y = BASE_Y + 12
                let n = 0
                while (y - 26 >= setup.shelf!.top - 2) {
                  y -= 26
                  boxes.push(<rect key={n} x={setup.shelf!.x - 11} y={y} width="22" height="24" rx="3" />)
                  boxes.push(
                    <line
                      key={`r${n}`}
                      x1={setup.shelf!.x}
                      y1={y}
                      x2={setup.shelf!.x}
                      y2={y + 24}
                      strokeWidth="4"
                      className={pose.blocked ? 'stroke-rose-500' : 'stroke-amber-400 dark:stroke-amber-600'}
                    />,
                  )
                  n++
                }
                return boxes
              })()}
            </g>
          )}

          {/* plush prizes waiting, and the one you are going for */}
          {setup.targets.map((t, i) => {
            const done = reached.includes(i)
            const active = i === nextIndex
            const tone = done ? '#22c55e' : ['#fb7185', '#38bdf8', '#fbbf24'][i % 3]
            return (
              <g key={i}>
                {active && (
                  <circle cx={t.x} cy={t.y} r={REACH_TOLERANCE + 6} fill="none" strokeDasharray="4 5" strokeWidth="2" style={{ stroke: 'var(--accent)' }} opacity="0.6" />
                )}
                <motion.g
                  animate={{ scale: active && dist <= REACH_TOLERANCE * 3 ? [1, 1.12, 1] : 1 }}
                  transition={{ duration: 0.5, repeat: active && dist <= REACH_TOLERANCE * 3 ? Infinity : 0 }}
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                  opacity={done ? 0.55 : 1}
                >
                  {/* a small teddy: ears, head, body */}
                  <circle cx={t.x - 6} cy={t.y - 9} r="3.5" fill={tone} />
                  <circle cx={t.x + 6} cy={t.y - 9} r="3.5" fill={tone} />
                  <circle cx={t.x} cy={t.y - 4} r="8" fill={tone} />
                  <ellipse cx={t.x} cy={t.y + 8} rx="9" ry="8" fill={tone} />
                  <ellipse cx={t.x} cy={t.y + 9} rx="4.5" ry="4" className="fill-white/60" />
                  <circle cx={t.x - 3} cy={t.y - 5} r="1.2" className="fill-ink" />
                  <circle cx={t.x + 3} cy={t.y - 5} r="1.2" className="fill-ink" />
                </motion.g>
              </g>
            )
          })}

          {/* the other elbow solution, shown faintly */}
          {ghost && !ghost.outOfLimits && (
            <g opacity="0.28">
              <line x1={BASE_X} y1={BASE_Y} x2={ghost.elbowX} y2={ghost.elbowY} strokeWidth="12" strokeLinecap="round" className="stroke-stone-500" strokeDasharray="6 7" />
              <line x1={ghost.elbowX} y1={ghost.elbowY} x2={ghost.handX} y2={ghost.handY} strokeWidth="9" strokeLinecap="round" className="stroke-stone-500" strokeDasharray="6 7" />
            </g>
          )}

          <rect x={BASE_X - 28} y={BASE_Y} width="56" height="14" rx="4" className="fill-stone-500 dark:fill-stone-400" />
          <rect x={BASE_X - 16} y={BASE_Y - 12} width="32" height="16" rx="4" className="fill-stone-600 dark:fill-stone-500" />

          {/* the arm itself */}
          <line
            x1={BASE_X}
            y1={BASE_Y}
            x2={pose.elbowX}
            y2={pose.elbowY}
            strokeWidth="14"
            strokeLinecap="round"
            className={usable ? 'stroke-stone-600 dark:stroke-stone-300' : 'stroke-rose-400'}
          />
          <line
            x1={pose.elbowX}
            y1={pose.elbowY}
            x2={pose.handX}
            y2={pose.handY}
            strokeWidth="11"
            strokeLinecap="round"
            style={{ stroke: usable ? 'var(--accent)' : '#fb7185' }}
          />
          <circle cx={BASE_X} cy={BASE_Y} r="9" className="fill-stone-700 dark:fill-stone-200" />
          <circle cx={pose.elbowX} cy={pose.elbowY} r="8" className="fill-stone-700 dark:fill-stone-200" />

          {/* gripper, and the handle you drag */}
          <g>
            <circle cx={pose.handX} cy={pose.handY} r="7" fill="none" strokeWidth="4" className="stroke-ink dark:stroke-white" />
            <line x1={pose.handX - 9} y1={pose.handY - 6} x2={pose.handX - 3} y2={pose.handY} strokeWidth="3" strokeLinecap="round" className="stroke-ink dark:stroke-white" />
            <line x1={pose.handX + 9} y1={pose.handY - 6} x2={pose.handX + 3} y2={pose.handY} strokeWidth="3" strokeLinecap="round" className="stroke-ink dark:stroke-white" />
          </g>
          <circle
            cx={aim.x}
            cy={aim.y}
            r="16"
            tabIndex={0}
            onKeyDown={nudge}
            role="application"
            aria-label="Claw position. Use the arrow keys to move it."
            className={cn('cursor-grab outline-none', dragging ? 'fill-ink/15 dark:fill-white/20' : 'fill-ink/5 dark:fill-white/10')}
          />
          <circle cx={aim.x} cy={aim.y} r="16" fill="none" strokeWidth="1.5" strokeDasharray="3 4" className="stroke-ink/30 dark:stroke-white/30" />

          {/* the cabinet: glass shine and an arcade frame, drawn over everything */}
          <g className="pointer-events-none">
            <line x1="120" y1="30" x2="40" y2="130" strokeWidth="10" strokeLinecap="round" className="stroke-white/20 dark:stroke-white/10" />
            <line x1="160" y1="30" x2="96" y2="110" strokeWidth="5" strokeLinecap="round" className="stroke-white/20 dark:stroke-white/10" />
            <rect x="6" y="6" width="788" height="328" rx="16" fill="none" strokeWidth="12" className="stroke-rose-400/90 dark:stroke-rose-500/80" />
          </g>
        </svg>
      </div>

      {/* Feedback */}
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
        ) : pose.blocked ? (
          <p className="rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            The arm is going through the boxes.{setup.flip ? ' Try bending the elbow the other way.' : ''}
          </p>
        ) : pose.outOfLimits ? (
          <p className="rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            That pose is past what the joints can hold. The shoulder cannot swing below the floor and the elbow cannot fold flat.
          </p>
        ) : (
          <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-300">
            Grab the claw itself to steer it. Judge the drop by eye, arcade rules: no meter tells you when you are lined up.
          </p>
        )}
      </div>

      {/* Controls: a discrete pose choice, not a dial */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {setup.flip && (
          <button
            type="button"
            onClick={flipElbow}
            className="accent-soft accent-text rounded-full px-4 py-2 font-display text-sm font-semibold transition-colors hover:brightness-105"
          >
            Elbow {elbowUp ? 'up' : 'down'}, flip it
          </button>
        )}
        <Button variant="accent" size="lg" onClick={grab} disabled={won}>
          <Grab className="h-5 w-5" />
          Drop the claw
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Reset the claw">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">
          Shoulder {Math.round(pose.shoulder)}° · Elbow {Math.round(pose.elbow)}°
        </Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ travel, torque: peakTorque, flips }}
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
              ? `${Math.round(travel)}° of travel with ${flips} elbow ${flips === 1 ? 'flip' : 'flips'}. Try a tidier route.`
              : 'Prize secured.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
