import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Slider } from '@/components/ui/Slider'
import type { ChallengeProps } from '@/lib/types'

/* ------------------- tuning knobs (edit freely) ------------------- */
const L1 = 95 // upper arm length (px)
const L2 = 85 // forearm length (px)
const BASE_X = 400
const BASE_Y = 300
const REACH_TOLERANCE = 16 // how close the gripper must get (px)

interface ArmRound {
  label: string
  target: { x: number; y: number }
  /** Optional low wall the arm's gripper must reach OVER (x position). */
  shelf?: { x: number; y: number }
}

/** Each win moves the part to a new spot. */
const ROUNDS: ArmRound[] = [
  { label: 'Grab the blue part', target: { x: 270, y: 200 } },
  { label: 'Reach up high', target: { x: 440, y: 145 } },
  { label: 'Over the shelf', target: { x: 300, y: 165 }, shelf: { x: 345, y: 300 } },
  { label: 'Far corner', target: { x: 545, y: 235 } },
]

/** Forward kinematics: where the gripper ends up for two joint angles. */
function gripper(shoulder: number, elbow: number) {
  const a1 = (shoulder * Math.PI) / 180
  const a2 = ((shoulder + elbow) * Math.PI) / 180
  const elbowX = BASE_X + L1 * Math.cos(a1)
  const elbowY = BASE_Y - L1 * Math.sin(a1)
  const handX = elbowX + L2 * Math.cos(a2)
  const handY = elbowY - L2 * Math.sin(a2)
  return { elbowX, elbowY, handX, handY }
}

export function RobotArmChallenge({ onComplete }: ChallengeProps) {
  const [shoulder, setShoulder] = useState(70)
  const [elbow, setElbow] = useState(40)
  const [roundIndex, setRoundIndex] = useState(0)
  const [wonRound, setWonRound] = useState(false)
  const completedRef = useRef(false)

  const round = ROUNDS[roundIndex % ROUNDS.length]
  const { elbowX, elbowY, handX, handY } = gripper(shoulder, elbow)
  const dist = Math.hypot(handX - round.target.x, handY - round.target.y)
  const onTarget = dist <= REACH_TOLERANCE

  useEffect(() => {
    if (!onTarget || wonRound) return
    const timer = setTimeout(() => {
      setWonRound(true)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, 700)
    return () => clearTimeout(timer)
  }, [onTarget, wonRound, onComplete])

  const nextRound = () => {
    setRoundIndex((i) => i + 1)
    setShoulder(70)
    setElbow(40)
    setWonRound(false)
  }

  const reset = () => {
    setShoulder(70)
    setElbow(40)
    setWonRound(false)
  }

  const near = dist <= REACH_TOLERANCE * 3

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">
          Turn the two joints to land the gripper right on the part. Two angles, one target.
        </p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-stone-100/80 dark:bg-white/5">
        <svg viewBox="0 0 800 340" className="w-full" role="img" aria-label="Robot arm scene">
          {/* floor */}
          <line x1="0" y1="312" x2="800" y2="312" strokeWidth="4" className="stroke-stone-300 dark:stroke-stone-600" />

          {/* optional shelf to reach over */}
          {round.shelf && (
            <rect x={round.shelf.x - 10} y={round.shelf.y - 70} width="20" height="70" rx="3" className="fill-stone-400 dark:fill-stone-600" />
          )}

          {/* target part + tolerance ring */}
          <circle cx={round.target.x} cy={round.target.y} r={REACH_TOLERANCE + 6} fill="none" strokeDasharray="4 5" strokeWidth="2" style={{ stroke: 'var(--accent)' }} opacity="0.6" />
          <motion.rect
            x={round.target.x - 11}
            y={round.target.y - 11}
            width="22"
            height="22"
            rx="4"
            animate={{ scale: near ? [1, 1.15, 1] : 1 }}
            transition={{ duration: 0.5, repeat: near ? Infinity : 0 }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center', fill: onTarget ? '#22c55e' : '#38bdf8' }}
          />

          {/* base */}
          <rect x={BASE_X - 28} y={BASE_Y} width="56" height="14" rx="4" className="fill-stone-500 dark:fill-stone-400" />
          <rect x={BASE_X - 16} y={BASE_Y - 12} width="32" height="16" rx="4" className="fill-stone-600 dark:fill-stone-500" />

          {/* upper arm */}
          <line x1={BASE_X} y1={BASE_Y} x2={elbowX} y2={elbowY} strokeWidth="14" strokeLinecap="round" className="stroke-stone-600 dark:stroke-stone-300" />
          {/* forearm */}
          <line x1={elbowX} y1={elbowY} x2={handX} y2={handY} strokeWidth="11" strokeLinecap="round" style={{ stroke: 'var(--accent)' }} />

          {/* joints */}
          <circle cx={BASE_X} cy={BASE_Y} r="9" className="fill-stone-700 dark:fill-stone-200" />
          <circle cx={elbowX} cy={elbowY} r="8" className="fill-stone-700 dark:fill-stone-200" />

          {/* gripper */}
          <g>
            <circle cx={handX} cy={handY} r="7" fill="none" strokeWidth="4" className="stroke-ink dark:stroke-white" />
            <line x1={handX - 9} y1={handY - 6} x2={handX - 3} y2={handY} strokeWidth="3" strokeLinecap="round" className="stroke-ink dark:stroke-white" />
            <line x1={handX + 9} y1={handY - 6} x2={handX + 3} y2={handY} strokeWidth="3" strokeLinecap="round" className="stroke-ink dark:stroke-white" />
          </g>
        </svg>
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        <p
          className={
            wonRound || onTarget
              ? 'rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-ink-soft dark:bg-white/5 dark:text-stone-300'
          }
        >
          {wonRound
            ? 'Grabbed it! Smooth moves, robot engineer.'
            : onTarget
              ? 'Locked on... hold steady!'
              : near
                ? 'So close! Nudge the joints a little.'
                : 'Keep turning the joints to reach the part.'}
        </p>
      </div>

      {/* Controls */}
      <div className="mt-4 grid items-end gap-x-6 gap-y-4 sm:grid-cols-2">
        <Slider label="Shoulder joint" value={shoulder} min={5} max={175} unit="°" onChange={setShoulder} />
        <Slider label="Elbow joint" value={elbow} min={-150} max={150} unit="°" onChange={setElbow} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {wonRound && (
          <Button variant="accent" onClick={nextRound}>
            Next part
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" onClick={reset} aria-label="Reset the arm">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Round {(roundIndex % ROUNDS.length) + 1}</Badge>
      </div>
    </Card>
  )
}
