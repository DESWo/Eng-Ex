import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { Badge } from '@/components/ui/Badge'
import { Meter } from '@/components/ui/Meter'
import { InsightToggle } from '@/components/level/InsightToggle'
import { LevelComplete, LevelHeader } from '@/components/level/LevelShell'
import { Scorecard } from '@/components/level/Scorecard'
import { useLevels } from '@/hooks/useLevels'
import type { ChallengeLevel, ChallengeProps } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------- tuning knobs (edit freely) ------------------- */
const DATA_BITS = 8
const PACKETS = 240 // sample size for the link test
const MAX_CHECK = 8 // slots the packet format leaves for check bits

/** Deterministic noise, so the same settings always give the same result. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

type Outcome = 'clean' | 'corrected' | 'resent' | 'silent'

interface LinkResult {
  counts: Record<Outcome, number>
  outcomes: Outcome[]
  /** Fraction of packets that arrived wrong without anyone noticing. */
  silentRate: number
  /** Useful data bits delivered per bit actually sent. */
  throughput: number
  overhead: number
}

/**
 * Send a batch of packets down a noisy link.
 * One check bit can tell you something broke. Three or more can work out
 * WHICH bit broke, so the receiver repairs it instead of asking again.
 */
function testLink(checkBits: number, noise: number, seed = 12345): LinkResult {
  const rand = rng(seed)
  const total = DATA_BITS + checkBits
  const counts: Record<Outcome, number> = { clean: 0, corrected: 0, resent: 0, silent: 0 }
  const outcomes: Outcome[] = []
  let sentBits = 0

  for (let p = 0; p < PACKETS; p++) {
    let flips = 0
    for (let b = 0; b < total; b++) if (rand() < noise) flips++
    sentBits += total

    let outcome: Outcome
    if (flips === 0) outcome = 'clean'
    else if (checkBits === 0) outcome = 'silent'
    else if (checkBits === 1) outcome = flips % 2 === 1 ? 'resent' : 'silent'
    else if (checkBits === 2) outcome = flips <= 2 ? 'resent' : 'silent'
    else outcome = flips === 1 ? 'corrected' : flips === 2 ? 'resent' : 'silent'

    if (outcome === 'resent') sentBits += total // one retransmission
    counts[outcome]++
    if (outcomes.length < 120) outcomes.push(outcome)
  }

  const delivered = (counts.clean + counts.corrected + counts.resent) * DATA_BITS
  return {
    counts,
    outcomes,
    silentRate: counts.silent / PACKETS,
    throughput: delivered / sentBits,
    overhead: checkBits / DATA_BITS,
  }
}

interface LinkSetup {
  noise: number
  /** Fixed check bits, or null when the player chooses. */
  checkBits: number | null
  /** Highest silent error rate that still counts as a working link. */
  maxSilent: number
  /**
   * False on a link too far away to ask again, where a detected error is just
   * as lost as an undetected one. That is what forces real error correction.
   */
  canResend: boolean
  /** Bits of bandwidth allowed per packet, or null. */
  budget: number | null
  /** Level 4 on: the packet stream readout is available. */
  stream: boolean
  brief: string
}

const LEVELS: ChallengeLevel<LinkSetup>[] = [
  {
    n: 1,
    title: 'Something is wrong',
    phase: 'play',
    concept: 'A check bit catches errors',
    teach: 'The link flips the odd bit and nobody notices, so the data quietly arrives wrong. Add one check bit and the receiver can at least tell that something broke.',
    setup: { noise: 0.012, checkBits: null, maxSilent: 0.02, canResend: true, budget: null, stream: false, brief: 'A sensor link keeps delivering corrupted readings and nothing flags them.' },
  },
  {
    n: 2,
    title: 'Narrow pipe',
    phase: 'understand',
    concept: 'Check bits cost bandwidth',
    teach: 'Every check bit is a bit you are not using for data. On a link this tight you cannot just pile them on, so the protection has to earn its place.',
    setup: { noise: 0.018, checkBits: null, maxSilent: 0.02, canResend: true, budget: 10, stream: false, brief: 'A radio link with barely any bandwidth to spare, and more interference than before.' },
  },
  {
    n: 3,
    title: 'Too far to ask again',
    phase: 'understand',
    concept: 'Detect versus correct',
    teach: 'Spotting an error only helps if you can ask for it again, and a probe hours away cannot. With enough check bits the receiver can work out which bit flipped and repair it on the spot.',
    setup: { noise: 0.015, checkBits: null, maxSilent: 0.03, canResend: false, budget: null, stream: false, brief: 'A deep space probe. A resend request takes hours, so the fix has to happen at the far end.' },
  },
  {
    n: 4,
    title: 'Watch the packets',
    phase: 'analyze',
    concept: 'Where every packet ends up',
    teach: 'Turn on the stream. Each square is one packet: clean, repaired on arrival, sent again, or silently wrong. The red ones are the dangerous ones, because nothing downstream knows they are bad.',
    setup: { noise: 0.015, checkBits: null, maxSilent: 0.03, canResend: false, budget: null, stream: true, brief: 'The same noisy link, packet by packet.' },
  },
  {
    n: 5,
    title: 'Design the protocol',
    phase: 'optimize',
    concept: 'Safety against speed',
    teach: 'More check bits mean fewer silent errors but less room for real data, and resends eat the link too. Find the protection that keeps the data honest without strangling the channel.',
    setup: { noise: 0.03, checkBits: null, maxSilent: 0.05, canResend: true, budget: null, stream: true, brief: 'Choose the error protection this whole mission will run on.' },
    metrics: [
      { id: 'silent', label: 'Silent errors', goal: 'min', target: 1, unit: '%' },
      { id: 'through', label: 'Useful throughput', goal: 'max', target: 62, unit: '%' },
      { id: 'check', label: 'Check bits', goal: 'min', target: 4 },
    ],
  },
]

const OUTCOME_STYLE: Record<Outcome, string> = {
  clean: 'fill-emerald-400',
  corrected: 'fill-sky-400',
  resent: 'fill-amber-400',
  silent: 'fill-rose-500',
}
const OUTCOME_LABEL: Record<Outcome, string> = {
  clean: 'arrived clean',
  corrected: 'repaired on arrival',
  resent: 'caught, sent again',
  silent: 'wrong, nobody noticed',
}

export function ErrorCheckChallenge({ onComplete }: ChallengeProps) {
  const lv = useLevels('error-check', LEVELS)
  const setup = lv.level.setup

  const [checkBits, setCheckBits] = useState(0)
  const [won, setWon] = useState(false)
  const [showStream, setShowStream] = useState(true)
  const completedRef = useRef(false)

  useEffect(() => {
    setCheckBits(setup.checkBits ?? 0)
    setWon(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lv.level.n])

  const bits = setup.checkBits ?? checkBits
  const r = testLink(bits, setup.noise)
  const packetSize = DATA_BITS + bits
  const overBudget = setup.budget !== null && packetSize > setup.budget
  // Where nobody can ask for a resend, a caught error is lost data too.
  const lostRate = setup.canResend
    ? r.silentRate
    : r.silentRate + r.counts.resent / PACKETS
  const solved = lostRate <= setup.maxSilent && !overBudget

  useEffect(() => {
    if (!solved || won) return
    const timer = setTimeout(() => {
      setWon(true)
      lv.clearLevel(
        lv.level.metrics
          ? { silent: r.silentRate * 100, through: r.throughput * 100, check: bits }
          : undefined,
      )
      if (!completedRef.current) {
        completedRef.current = true
        onComplete()
      }
    }, 650)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, won, r.silentRate, r.throughput, bits])

  const reset = () => {
    setCheckBits(setup.checkBits ?? 0)
    setWon(false)
  }

  const COLS = 20

  return (
    <Card className="relative overflow-hidden p-4 sm:p-6">
      {won && <Confetti />}

      <LevelHeader
        lv={lv}
        insight={setup.stream ? <InsightToggle label="packet stream" on={showStream} onChange={setShowStream} /> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-ink-soft dark:text-stone-400">{setup.brief}</p>
        <Badge className="accent-soft accent-text px-4 py-1.5 text-sm">
          Noise {(setup.noise * 100).toFixed(1)}% per bit
        </Badge>
      </div>

      {/* Packet layout + stream */}
      <div className="rounded-2xl bg-stone-100/80 p-4 dark:bg-white/5">
        <p className="mb-2 font-display text-sm font-semibold">
          Packet: {DATA_BITS} data + {bits} check = {packetSize} bits
        </p>
        {/* Build the packet directly: data cells are fixed, check slots are yours. */}
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: DATA_BITS }, (_, i) => (
            <span
              key={`d${i}`}
              title="Data bit"
              className="h-8 w-8 rounded-md bg-stone-400 dark:bg-stone-500"
            />
          ))}
          <span className="mx-1 w-px self-stretch bg-stone-300 dark:bg-white/15" />
          {Array.from({ length: MAX_CHECK }, (_, i) => {
            const filled = i < bits
            return (
              <button
                key={`c${i}`}
                type="button"
                disabled={setup.checkBits !== null}
                onClick={() => setCheckBits(filled ? i : i + 1)}
                aria-pressed={filled}
                aria-label={filled ? `Remove check bit ${i + 1}` : `Add check bit ${i + 1}`}
                className={cn(
                  'h-8 w-8 rounded-md font-display text-xs font-bold transition-colors duration-150 disabled:opacity-40',
                  filled
                    ? 'accent-bg text-white shadow-clay'
                    : 'border-2 border-dashed border-stone-300 text-stone-300 hover:border-stone-400 hover:text-stone-400 dark:border-white/15 dark:text-white/20',
                )}
              >
                {filled ? '✓' : '+'}
              </button>
            )
          })}
        </div>
        {setup.checkBits === null && (
          <p className="mt-2 text-xs text-ink-soft dark:text-stone-400">
            Click an empty slot to add a check bit, or a filled one to take it back out.
          </p>
        )}

        {setup.stream && showStream && (
          <div className="mt-4">
            <p className="mb-2 font-display text-sm font-semibold">Last {r.outcomes.length} packets</p>
            <svg viewBox={`0 0 ${COLS * 16} ${Math.ceil(r.outcomes.length / COLS) * 16}`} className="w-full max-w-md" role="img" aria-label="Packet outcomes">
              {r.outcomes.map((o, i) => (
                <rect
                  key={i}
                  x={(i % COLS) * 16}
                  y={Math.floor(i / COLS) * 16}
                  width="13"
                  height="13"
                  rx="3"
                  className={OUTCOME_STYLE[o]}
                />
              ))}
            </svg>
            <div className="mt-2 flex flex-wrap gap-3">
              {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => (
                <span key={o} className="flex items-center gap-1.5 text-xs text-ink-soft dark:text-stone-400">
                  <svg width="10" height="10" className="shrink-0">
                    <rect width="10" height="10" rx="2" className={OUTCOME_STYLE[o]} />
                  </svg>
                  {OUTCOME_LABEL[o]} ({r.counts[o]})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Verdict */}
      <div aria-live="polite" className="mt-4 min-h-[2.5rem]">
        <p
          className={cn(
            'rounded-xl px-4 py-2.5 text-sm font-semibold',
            solved
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
          )}
        >
          {overBudget
            ? `That packet is ${packetSize} bits and the link only carries ${setup.budget}.`
            : solved
              ? setup.canResend
                ? `Link is trustworthy. ${(lostRate * 100).toFixed(1)}% slipping through unnoticed, ${(r.throughput * 100).toFixed(0)}% of the channel carrying real data.`
                : `Solid. ${r.counts.corrected} packets were repaired right at the probe, and only ${(lostRate * 100).toFixed(1)}% were lost.`
              : bits === 0
                ? `${r.counts.silent} packets arrived corrupted and nothing flagged a single one.`
                : !setup.canResend && r.counts.corrected === 0
                  ? `${(lostRate * 100).toFixed(0)}% of the data is gone. The receiver can tell those packets broke, but out here it cannot ask for them again, so spotting the error is not enough.`
                  : bits < 3
                    ? `Still ${(lostRate * 100).toFixed(1)}% slipping through. Errors are being spotted, but two flips in one packet can cancel out and sneak past.`
                    : `Still ${(lostRate * 100).toFixed(1)}% getting lost. Try more protection.`}
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Meter
          label={setup.canResend ? 'Silent errors' : 'Data lost for good'}
          display={`${(lostRate * 100).toFixed(1)}% of ${(setup.maxSilent * 100).toFixed(1)}% allowed`}
          fraction={Math.min(1, lostRate / (setup.maxSilent * 2))}
          markerFraction={0.5}
          barClass={lostRate <= setup.maxSilent ? 'bg-emerald-500' : 'bg-rose-500'}
        />
        <Meter
          label="Useful throughput"
          display={`${(r.throughput * 100).toFixed(0)}% of the channel`}
          fraction={r.throughput}
          barClass="bg-sky-500"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={reset} aria-label="Reset the protocol">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Badge className="ml-auto">{packetSize} bits per packet</Badge>
      </div>

      {lv.level.metrics && (
        <div className="mt-4">
          <Scorecard
            metrics={lv.level.metrics}
            values={{ silent: r.silentRate * 100, through: r.throughput * 100, check: bits }}
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
              ? `${bits} check bits, ${(r.throughput * 100).toFixed(0)}% throughput. Try trading safety for speed.`
              : 'The link is reliable now.'
          }
          onReplay={reset}
        />
      )}
    </Card>
  )
}
