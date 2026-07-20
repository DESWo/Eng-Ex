import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { InsightToggle } from '@/components/level/InsightToggle'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import { useSvgDrag } from '@/hooks/useSvgDrag'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const L1 = 95 // upper arm length (px)
const L2 = 85 // forearm length (px)
const BASE_X = 400
const BASE_Y = 300
const REACH_TOLERANCE = 18 // how close the gripper must get (px)
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
    title: 'Grab the part',
    phase: 'play',
    concept: 'The arm follows your hand',
    teach: 'Drag the gripper straight to the part. You are moving a point, and the arm works out for itself what angle each joint needs. That calculation is what robot controllers do thousands of times a second.',
    setup: { targets: [{ x: 270, y: 200 }], limits: false, flip: false, envelope: false, brief: 'A part is sitting on the bench. Drag the gripper onto it.' },
  },
  {
    n: 2,
    title: 'Joints have stops',
    phase: 'understand',
    concept: 'Limits and reach',
    teach: 'Real joints do not spin freely. This shoulder cannot swing below the bench and the elbow cannot fold flat, so some points the maths says are reachable simply are not.',
    setup: { targets: [{ x: 450, y: 140 }], limits: true, flip: false, envelope: false, brief: 'A part right out at the edge of what this arm can do.' },
  },
  {
    n: 3,
    title: 'Two ways to get there',
    phase: 'understand',
    concept: 'Elbow up or elbow down',
    teach: 'Almost every point can be reached two ways, with the elbow bent up or bent down. They put the gripper in exactly the same place while the arm occupies completely different space, and here only one of them misses the shelf.',
    setup: { targets: [{ x: 298, y: 170 }], shelf: { x: 345, top: 200 }, limits: true, flip: true, envelope: false, brief: 'The part is behind a shelf. The gripper can reach it, but can the arm?' },
  },
  {
    n: 4,
    title: 'See the reach',
    phase: 'analyze',
    concept: 'The workspace',
    teach: 'Turn on the readout. The shaded ring is every point this arm can physically touch, and the ghost shows the other elbow solution for wherever you are now. Notice the hole in the middle: it cannot fold tightly enough to reach its own base.',
    setup: { targets: [{ x: 470, y: 160 }], shelf: { x: 345, top: 220 }, limits: true, flip: true, envelope: true, brief: 'The same cell, with the arm workspace drawn out.' },
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
      brief: 'A pick-and-place cycle the robot will repeat all day.',
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
  const completedRef = useRef(false)
  const lastPose = useRef<{ shoulder: number; elbow: number } | null>(null)

  useEffect(() => {
    setAim({ x: 300, y: 250 })
    setElbowUp(true)
    setReached([])
    setTravel(0)
    setPeakTorque(0)
    setFlips(0)
    setWon(false)
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

  useEffect(() => {
    if (!onTarget || nextIndex >= setup.targets.length) return
    const timer = setTimeout(() => setReached((r) => (r.length === nextIndex ? [...r, nextIndex] : r)), 450)
    return () => clearTimeout(timer)
  }, [onTarget, nextIndex, setup.targets.length])

  const allDone = reached.length >= setup.targets.length

  useEffect(() => {
    if (!allDone || won) return
    const timer = setTimeout(() => {
      setWon(true)
      lv.clearLevel(
        lv.level.metrics ? { travel, torque: peakTorque, flips } : undefined,
      )
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, 500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone, won, travel, peakTorque, flips])

  const reset = () => {
    setAim({ x: 300, y: 250 })
    setElbowUp(true)
    setReached([])
    setTravel(0)
    setPeakTorque(0)
    setFlips(0)
    setWon(false)
    lastPose.current = null
  }

  const { dragging, bind } = useSvgDrag((x, y) => {
    if (won) return
    setAim({ x: Math.max(40, Math.min(760, x)), y: Math.max(20, Math.min(BASE_Y + 6, y)) })
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        {setup.targets.length > 1 && (
          <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
            Part {Math.min(reached.length + 1, setup.targets.length)} of {setup.targets.length}
          </Badge>
        )}
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-stone-100/80 dark:bg-white/5">
        <svg viewBox="0 0 800 340" className="w-full" role="img" aria-label="Robot arm scene" {...bind}>
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

          {setup.shelf && (
            <rect
              x={setup.shelf.x - 11}
              y={setup.shelf.top}
              width="22"
              height={BASE_Y + 12 - setup.shelf.top}
              rx="3"
              className={pose.blocked ? 'fill-rose-400' : 'fill-stone-400 dark:fill-stone-600'}
            />
          )}

          {/* parts waiting, and the one you are on */}
          {setup.targets.map((t, i) => {
            const done = reached.includes(i)
            const active = i === nextIndex
            return (
              <g key={i}>
                {active && (
                  <circle cx={t.x} cy={t.y} r={REACH_TOLERANCE + 6} fill="none" strokeDasharray="4 5" strokeWidth="2" style={{ stroke: 'var(--accent)' }} opacity="0.6" />
                )}
                <motion.rect
                  x={t.x - 11}
                  y={t.y - 11}
                  width="22"
                  height="22"
                  rx="4"
                  animate={{ scale: active && dist <= REACH_TOLERANCE * 3 ? [1, 1.15, 1] : 1 }}
                  transition={{ duration: 0.5, repeat: active && dist <= REACH_TOLERANCE * 3 ? Infinity : 0 }}
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    fill: done ? '#22c55e' : active ? '#38bdf8' : '#94a3b8',
                  }}
                />
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
            aria-label="Gripper position. Use the arrow keys to move it."
            className={cn('cursor-grab outline-none', dragging ? 'fill-ink/15 dark:fill-white/20' : 'fill-ink/5 dark:fill-white/10')}
          />
          <circle cx={aim.x} cy={aim.y} r="16" fill="none" strokeWidth="1.5" strokeDasharray="3 4" className="stroke-ink/30 dark:stroke-white/30" />
        </svg>
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        <p
          className={cn(
            'rounded-xl px-4 py-2.5 text-sm font-semibold',
            won || allDone
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
              : usable
                ? 'bg-stone-100 text-ink-soft dark:bg-white/5 dark:text-stone-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
          )}
        >
          {allDone
            ? setup.targets.length > 1
              ? `Cycle complete. ${Math.round(travel)}° of joint travel.`
              : 'Grabbed it. The arm solved its own angles.'
            : pose.blocked
              ? `The gripper is in the right place but the arm is going through the shelf.${setup.flip ? ' Try bending the elbow the other way.' : ''}`
              : pose.outOfLimits
                ? 'That pose is past what the joints can hold. The shoulder cannot swing below the bench and the elbow cannot fold flat.'
                : onTarget
                  ? 'Locked on, hold steady.'
                  : dist <= REACH_TOLERANCE * 3
                    ? 'Nearly on it.'
                    : 'Drag the gripper onto the part.'}
        </p>
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
        <Button variant="ghost" onClick={reset} aria-label="Reset the arm">
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
              : 'Nicely picked.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
