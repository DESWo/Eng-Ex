import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import type { ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const INPUT_RPM = 60 // the motor always spins at this speed
const TOOTH_OPTIONS = [8, 12, 16, 24, 32, 48]
const GAUGE_MAX = 420 // top of the airflow gauge

interface GearRound {
  label: string
  mission: string
  /** The fan speed range (RPM) where the mission succeeds. */
  band: [number, number]
  tooSlow: string
  tooFast: string
  success: string
  /** Later rounds chain TWO gear pairs for bigger speed changes. */
  compound: boolean
}

/** Each win brings a new machine that needs a different airflow. */
const ROUNDS: GearRound[] = [
  {
    label: 'Server room rescue',
    mission: 'The computers are cooking. Spin the fan fast enough to cool them, but not so fast the rack rattles.',
    band: [80, 105],
    tooSlow: 'Too slow. The servers are overheating!',
    tooFast: 'Too fast! The whole rack is rattling.',
    success: 'Perfect airflow. The servers settle at a cool 24°C.',
    compound: false,
  },
  {
    label: 'Paint drying duty',
    mission: 'Fresh paint wants a soft, slow breeze. A gale will streak it.',
    band: [15, 25],
    tooSlow: 'Barely a whisper. This paint will take all week.',
    tooFast: 'Too much wind! The paint is streaking.',
    success: 'A gentle breeze. The paint dries perfectly smooth.',
    compound: false,
  },
  {
    label: 'Wind tunnel test',
    mission: 'The model plane needs a serious gale. Chain both gear pairs to multiply your speed.',
    band: [220, 260],
    tooSlow: 'Not enough wind. The model just sits there.',
    tooFast: 'Way too much! The model ripped off its stand.',
    success: 'A perfect gale. The model flies steady on its wires.',
    compound: true,
  },
  {
    label: 'Egg incubator',
    mission: 'Chicks need barely-moving warm air. Gear WAY down.',
    band: [8, 12],
    tooSlow: 'The air is completely still. Too stuffy.',
    tooFast: 'A draft! The eggs are getting cold.',
    success: 'A whisper of warm air. Happy eggs.',
    compound: true,
  },
  {
    label: 'Hovercraft lift-off',
    mission: 'Maximum lift! Multiply the motor speed as hard as you can, within reason.',
    band: [340, 380],
    tooSlow: 'Not enough lift. The hovercraft sits on the floor.',
    tooFast: 'The skirt blew out! Slightly less, pilot.',
    success: 'Lift-off! The hovercraft floats on its cushion of air.',
    compound: true,
  },
]

/** A stylized gear. The dashed ring reads as teeth and shows the spin. */
function Gear({
  cx,
  cy,
  teeth,
  rpm,
  direction,
  colorClass,
  scale = 1,
}: {
  cx: number
  cy: number
  teeth: number
  rpm: number
  direction: 1 | -1
  colorClass: string
  scale?: number
}) {
  const r = (14 + teeth * 0.9) * scale
  const toothLength = (2 * Math.PI * r) / (teeth * 2)
  return (
    <motion.g
      key={`${teeth}-${Math.round(rpm)}`}
      animate={{ rotate: 360 * direction }}
      transition={{ repeat: Infinity, ease: 'linear', duration: 60 / Math.max(Math.abs(rpm), 1) }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        strokeWidth={10 * scale}
        strokeDasharray={`${toothLength} ${toothLength}`}
        className={colorClass}
      />
      <circle cx={cx} cy={cy} r={Math.max(6, r - 7 * scale)} className="fill-white/60 dark:fill-white/10" />
      {[0, 45, 90, 135].map((deg) => (
        <line
          key={deg}
          x1={cx - (r - 8) * Math.cos((deg * Math.PI) / 180)}
          y1={cy - (r - 8) * Math.sin((deg * Math.PI) / 180)}
          x2={cx + (r - 8) * Math.cos((deg * Math.PI) / 180)}
          y2={cy + (r - 8) * Math.sin((deg * Math.PI) / 180)}
          strokeWidth={5 * scale}
          strokeLinecap="round"
          className={colorClass}
        />
      ))}
      <circle cx={cx} cy={cy} r="7" className="fill-stone-100 dark:fill-night-panel" />
    </motion.g>
  )
}

function ToothPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (teeth: number) => void
}) {
  return (
    <div>
      <p className="mb-2 font-display text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-2">
        {TOOTH_OPTIONS.map((teeth) => (
          <button
            key={teeth}
            type="button"
            onClick={() => onChange(teeth)}
            className={cn(
              'rounded-full border-2 px-3.5 py-1.5 font-display text-sm font-bold tabular-nums transition-colors duration-200',
              value === teeth
                ? 'accent-border accent-soft accent-text'
                : 'border-stone-200 text-ink-soft hover:border-stone-300 dark:border-white/10 dark:text-stone-400 dark:hover:border-white/25',
            )}
          >
            {teeth}
          </button>
        ))}
      </div>
    </div>
  )
}

export function GearChallenge({ onComplete }: ChallengeProps) {
  const [driver, setDriver] = useState(24)
  const [mid1, setMid1] = useState(24) // cluster gear meshing with the driver
  const [mid2, setMid2] = useState(24) // smaller gear on the same axle
  const [fan, setFan] = useState(24)
  const [roundIndex, setRoundIndex] = useState(0)
  const [wonRound, setWonRound] = useState(false)
  const completedRef = useRef(false)

  const round = ROUNDS[roundIndex % ROUNDS.length]
  const midSpeed = (INPUT_RPM * driver) / mid1
  const speed = round.compound ? (midSpeed * mid2) / fan : (INPUT_RPM * driver) / fan
  const [bandLow, bandHigh] = round.band
  const inBand = speed >= bandLow && speed <= bandHigh

  useEffect(() => {
    if (inBand && !wonRound) {
      setWonRound(true)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }
  }, [inBand, wonRound, onComplete])

  const resetGears = () => {
    setDriver(24)
    setMid1(24)
    setMid2(24)
    setFan(24)
  }

  const nextRound = () => {
    setRoundIndex((i) => i + 1)
    resetGears()
    setWonRound(false)
  }

  /* Scene geometry. Gears mesh edge to edge. */
  const gearR = (teeth: number) => 14 + teeth * 0.9
  const smallR = (teeth: number) => (14 + teeth * 0.9) * 0.62
  const driverX = round.compound ? 190 : 280
  const clusterX = driverX + gearR(driver) + gearR(mid1)
  const fanX = round.compound
    ? clusterX + smallR(mid2) + gearR(fan)
    : driverX + gearR(driver) + gearR(fan)

  // Gauge on a square root scale so slow bands stay visible.
  const gaugePos = (rpm: number) => Math.min(1, Math.sqrt(rpm) / Math.sqrt(GAUGE_MAX))

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {wonRound && <Confetti />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{round.mission}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">{round.label}</Badge>
      </div>

      {/* Scene */}
      <div className="overflow-hidden rounded-2xl bg-stone-100/80 dark:bg-white/5">
        <svg viewBox="0 0 800 300" className="w-full" role="img" aria-label="Gear train scene">
          <rect x="40" y="115" width="90" height="70" rx="10" className="fill-stone-400 dark:fill-stone-600" />
          <rect x="50" y="130" width="30" height="8" rx="4" className="fill-stone-200 dark:fill-stone-500" />
          <text x="85" y="215" textAnchor="middle" fontSize="14" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
            Motor · {INPUT_RPM} RPM
          </text>
          <line x1="130" y1="150" x2={driverX} y2="150" strokeWidth="10" strokeLinecap="round" className="stroke-stone-400 dark:stroke-stone-600" />

          <Gear cx={driverX} cy={150} teeth={driver} rpm={INPUT_RPM} direction={1} colorClass="stroke-amber-500 fill-amber-500" />

          {round.compound && (
            <>
              {/* the cluster: big gear and small gear share one axle */}
              <Gear cx={clusterX} cy={150} teeth={mid1} rpm={midSpeed} direction={-1} colorClass="stroke-teal-500 fill-teal-500" />
              <Gear cx={clusterX} cy={150} teeth={mid2} rpm={midSpeed} direction={-1} scale={0.62} colorClass="stroke-teal-700 fill-teal-700" />
              <text x={clusterX} y="245" textAnchor="middle" fontSize="13" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
                Cluster (two gears, one axle)
              </text>
            </>
          )}

          <Gear
            cx={fanX}
            cy={150}
            teeth={fan}
            rpm={speed}
            direction={round.compound ? 1 : -1}
            colorClass="stroke-[var(--accent)] fill-[var(--accent)]"
          />
          <motion.g
            key={`fan-${Math.round(speed)}`}
            animate={{ rotate: round.compound ? 360 : -360 }}
            transition={{ repeat: Infinity, ease: 'linear', duration: 60 / Math.max(speed, 1) }}
          >
            {[0, 120, 240].map((deg) => (
              <ellipse
                key={deg}
                cx={fanX + 24 * Math.cos((deg * Math.PI) / 180)}
                cy={150 + 24 * Math.sin((deg * Math.PI) / 180)}
                rx="18"
                ry="8"
                transform={`rotate(${deg} ${fanX + 24 * Math.cos((deg * Math.PI) / 180)} ${150 + 24 * Math.sin((deg * Math.PI) / 180)})`}
                className="fill-sky-300/90 dark:fill-sky-500/60"
              />
            ))}
          </motion.g>
          <text x={fanX} y="272" textAnchor="middle" fontSize="14" fontWeight="700" className="fill-ink-soft font-display dark:fill-stone-400">
            Fan
          </text>
        </svg>
      </div>

      {/* Mission gauge */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-ink-soft dark:text-stone-400">
          <span>Too slow</span>
          <span className="tabular-nums">
            {Math.round(speed)} RPM · {INPUT_RPM} × {driver}/{round.compound ? mid1 : fan}
            {round.compound ? ` × ${mid2}/${fan}` : ''}
          </span>
          <span>Too fast</span>
        </div>
        <div className="relative h-4 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
          {/* the green zone where the mission succeeds */}
          <div
            className="absolute inset-y-0 rounded-full bg-emerald-400/80"
            style={{
              left: `${gaugePos(bandLow) * 100}%`,
              width: `${(gaugePos(bandHigh) - gaugePos(bandLow)) * 100}%`,
            }}
          />
          <motion.span
            className="absolute inset-y-0 w-1.5 rounded-full bg-ink dark:bg-white"
            animate={{ left: `${gaugePos(speed) * 100}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 24 }}
          />
        </div>
      </div>

      {/* Feedback */}
      <div aria-live="polite" className="mt-3 min-h-[2.5rem]">
        <motion.p
          key={wonRound ? 'win' : speed < bandLow ? 'slow' : 'fast'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'rounded-xl px-4 py-2.5 text-sm font-semibold',
            inBand
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
          )}
        >
          {inBand ? round.success : speed < bandLow ? round.tooSlow : round.tooFast}
        </motion.p>
      </div>

      {/* Controls */}
      <div className={cn('mt-4 grid gap-4', round.compound ? 'sm:grid-cols-2' : 'sm:grid-cols-2')}>
        <ToothPicker label="Motor gear teeth" value={driver} onChange={setDriver} />
        {round.compound && <ToothPicker label="Cluster big gear teeth" value={mid1} onChange={setMid1} />}
        {round.compound && <ToothPicker label="Cluster small gear teeth" value={mid2} onChange={setMid2} />}
        <ToothPicker label="Fan gear teeth" value={fan} onChange={setFan} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {wonRound && (
          <Button variant="accent" onClick={nextRound}>
            Next machine
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" onClick={resetGears} aria-label="Reset the gears">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">Round {(roundIndex % ROUNDS.length) + 1}</Badge>
      </div>
    </Card>
  )
}
