import { useEffect, useRef, useState } from 'react'
import { Send, RotateCcw } from 'lucide-react'
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
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const MAX_BITS = 10

interface BinarySetup {
  /** The reading the sensor has to send. */
  target: number
  /** Fixed number of bits, or null when the player chooses the width. */
  width: number | null
  /** Level 3 on: the top bit becomes a sign instead of a value. */
  signed: boolean
  /** Level 4 on: the place value readout is available. */
  places: boolean
  brief: string
}

const LEVELS: ChallengeLevel<BinarySetup>[] = [
  {
    n: 1,
    title: 'Count in bulbs',
    phase: 'play',
    concept: 'Place values double',
    teach: 'It is a lights puzzle with a secret: each bulb is worth twice the one to its right, 1, 2, 4, 8 and so on. Switch on the bulbs that add up to the reading.',
    setup: { target: 22, width: 8, signed: false, places: false, brief: 'A sensor sends its reading as a row of on-or-off signals. Set the bulbs to match.' },
  },
  {
    n: 2,
    title: 'Bulbs cost money',
    phase: 'understand',
    concept: 'How wide does it need to be?',
    teach: 'Every extra bulb is another wire, another pin, and more power forever. Use the fewest that can still reach this reading, because n bulbs only ever get you to 2 to the n, minus one.',
    setup: { target: 200, width: null, signed: false, places: false, brief: 'You are choosing how many signal lines this sensor gets. Fewer is cheaper, but it still has to fit the reading.' },
  },
  {
    n: 3,
    title: 'Below freezing',
    phase: 'understand',
    concept: 'A sign costs a bit',
    teach: 'This sensor has to report negative temperatures, so the leftmost bulb now means "minus" instead of carrying a value. You just gave up half your range to say which way it points.',
    setup: { target: -45, width: null, signed: true, places: false, brief: 'The same sensor, now installed outdoors where it reads below zero.' },
  },
  {
    n: 4,
    title: 'Show the maths',
    phase: 'analyze',
    concept: 'Where the number comes from',
    teach: 'Turn on the place values. Each lit bulb contributes its own number and the total is just the sum. This is the whole of binary, and it is how every value in every computer is stored.',
    setup: { target: -105, width: null, signed: true, places: true, brief: 'A cold-store monitor, with the working shown underneath.' },
  },
  {
    n: 5,
    title: 'Spec the sensor',
    phase: 'optimize',
    concept: 'Width, headroom, and power',
    teach: 'Ship this design. Narrow is cheap but leaves no headroom if readings grow, wide is safe but wasteful, and every lit bulb burns power on a battery that has to last years.',
    setup: { target: 148, width: null, signed: false, places: true, brief: 'Sign off the final sensor: cheap to build, room to grow, and easy on the battery.' },
    metrics: [
      { id: 'width', label: 'Bulbs installed', goal: 'min', target: 9 },
      { id: 'headroom', label: 'Headroom left', goal: 'max', target: 70 },
      { id: 'lit', label: 'Bulbs lit', goal: 'min', target: 4 },
    ],
  },
]

export function BinaryChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('binary', LEVELS)
  const setup = lv.level.setup

  const [width, setWidth] = useState(8)
  // bits[p] is the bulb worth 2^p, so widening the row never disturbs the rest.
  const [bits, setBits] = useState<boolean[]>(() => Array(MAX_BITS).fill(false))
  const [won, setWon] = useState(false)
  const [showPlaces, setShowPlaces] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    setWidth(setup.width ?? 8)
    setBits(Array(MAX_BITS).fill(false))
    setWon(false)
    setVerdict(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lv.level.n])

  const w = setup.width ?? width
  // Drawn most significant first. The top place is the sign once signing is on.
  const places = Array.from({ length: w }, (_, i) => w - 1 - i)
  const signPlace = w - 1
  const signOn = setup.signed && bits[signPlace]

  const magnitude = places.reduce(
    (sum, p) => (setup.signed && p === signPlace ? sum : sum + (bits[p] ? Math.pow(2, p) : 0)),
    0,
  )
  const value = signOn ? -magnitude : magnitude

  const maxMagnitude = Math.pow(2, setup.signed ? w - 1 : w) - 1
  const fits = Math.abs(setup.target) <= maxMagnitude
  const litCount = places.filter((p) => bits[p]).length
  // How much room is left above this reading, as a percentage of the range.
  const headroom = maxMagnitude > 0 ? Math.round(((maxMagnitude - Math.abs(setup.target)) / maxMagnitude) * 100) : 0

  const solved = value === setup.target

  /** Guessing costs: three sends per level, then the board wipes. */
  const att = useAttempts(lv.level.n === 1 ? null : 3, lv.level.n)
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null)

  const reset = () => {
    setBits(Array(MAX_BITS).fill(false))
    setWon(false)
    setVerdict(null)
  }

  /** Commit the pattern down the wire. */
  const send = () => {
    if (won) return
    if (solved) {
      setWon(true)
      setVerdict({ ok: true, text: `The receiver read ${setup.target}. Sent in ${w} bits.` })
      lv.clearLevel(lv.level.metrics ? { width: w, headroom, lit: litCount } : undefined)
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
      return
    }
    const text = !fits
      ? `${w} bulbs only reach ${maxMagnitude}${setup.signed ? ' either way' : ''}, and you need ${Math.abs(setup.target)}. Add another bulb.`
      : `The receiver read ${value}, not ${setup.target}. ${value < setup.target ? 'Too low.' : 'Too high.'}`
    if (att.spend()) {
      reset()
      att.refill()
      setVerdict({ ok: false, text: 'Line reset, bulbs dark. Work the number out in powers of two before the next send.' })
    } else {
      setVerdict({ ok: false, text })
    }
  }

  const toggle = (place: number) => {
    setVerdict(null)
    setBits((b) => b.map((v, j) => (j === place ? !v : v)))
  }

  /** Click an empty socket to wire up more signal lines, or a bulb to pull them out. */
  const setWidthTo = (nextWidth: number) => {
    if (setup.width !== null) return
    const clamped = Math.max(2, Math.min(MAX_BITS, nextWidth))
    // Anything above the new top place is no longer wired in, so switch it off.
    setBits((b) => b.map((v, p) => (p >= clamped ? false : v)))
    setWidth(clamped)
  }

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.places ? <InsightToggle label="place values" on={showPlaces} onChange={setShowPlaces} /> : undefined}
      />

      <Objective
        goal={`Light the bulbs so the wire carries exactly ${setup.target}`}
        status={`${litCount} lit`}
        attemptsLeft={att.left}
        met={won}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">Send {setup.target}</Badge>
      </div>

      {/* Bulbs */}
      <div className="rounded-2xl bg-stone-100/80 p-4 dark:bg-white/5">
        <div className="flex flex-wrap items-end justify-center gap-2 sm:gap-3">
          {Array.from({ length: MAX_BITS }, (_, i) => MAX_BITS - 1 - i).map((place) => {
            const wired = place < w
            const isSign = setup.signed && place === signPlace
            const on = wired && bits[place]
            if (!wired) {
              return (
                <button
                  key={place}
                  type="button"
                  onClick={() => setWidthTo(place + 1)}
                  disabled={setup.width !== null}
                  aria-label={`Wire up a bulb worth ${Math.pow(2, place)}`}
                  className="flex flex-col items-center gap-1.5 disabled:opacity-30"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-stone-300 text-lg font-bold text-stone-300 transition-colors hover:border-stone-400 hover:text-stone-400 dark:border-white/15 dark:text-white/20 sm:h-14 sm:w-14">
                    +
                  </span>
                  <span className="font-display text-xs font-semibold text-stone-300 dark:text-white/25">
                    socket
                  </span>
                </button>
              )
            }
            return (
              <div key={place} className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggle(place)}
                  aria-pressed={on}
                  aria-label={isSign ? 'Sign bulb' : `Bulb worth ${Math.pow(2, place)}`}
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-full border-2 font-display text-sm font-bold transition-colors duration-200 sm:h-14 sm:w-14',
                    on
                      ? isSign
                        ? 'border-rose-400 bg-rose-400 text-white shadow-clay'
                        : 'border-amber-400 bg-amber-300 text-amber-900 shadow-clay'
                      : 'border-stone-300 bg-white text-stone-400 dark:border-white/15 dark:bg-white/5 dark:text-stone-600',
                  )}
                >
                  {on ? 1 : 0}
                </button>
                <span className="font-display text-xs font-semibold tabular-nums text-ink-soft dark:text-stone-400">
                  {isSign ? '±' : Math.pow(2, place)}
                </span>
                {setup.width === null && place === signPlace && w > 2 && (
                  <button
                    type="button"
                    onClick={() => setWidthTo(w - 1)}
                    aria-label="Pull out the top bulb"
                    className="font-display text-[10px] font-bold text-ink-soft underline decoration-dotted hover:text-ink dark:text-stone-500 dark:hover:text-stone-300"
                  >
                    remove
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Working out */}
        {setup.places && showPlaces && (
          <p className="mt-4 text-center font-display text-sm text-ink-soft dark:text-stone-400">
            {litCount === 0 || (signOn && litCount === 1) ? (
              'Nothing lit yet, so the reading is 0.'
            ) : (
              <>
                {signOn && <span className="font-bold text-rose-500">minus </span>}
                {places
                  .filter((p) => !(setup.signed && p === signPlace) && bits[p])
                  .map((p) => Math.pow(2, p))
                  .join(' + ')}{' '}
                = <span className="font-bold text-ink dark:text-stone-200">{value}</span>
              </>
            )}
          </p>
        )}
      </div>

      {/* Verdict: the receiver only reads what you actually send */}
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
            Each bulb is worth its place value. Set the pattern, then send it down the wire.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="accent" size="lg" onClick={send} disabled={won}>
          <Send className="h-5 w-5" />
          Send the number
        </Button>
        <Button variant="ghost" onClick={reset} aria-label="Switch all the bulbs off">
          <RotateCcw className="h-4 w-4" />
          All off
        </Button>
        <Badge className="ml-auto">
          Range {setup.signed ? `-${maxMagnitude} to ${maxMagnitude}` : `0 to ${maxMagnitude}`}
        </Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ width: w, headroom, lit: litCount }}
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
              ? `${setup.target} in ${w} bits with ${litCount} lit. Try a different width.`
              : 'Reading sent.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
