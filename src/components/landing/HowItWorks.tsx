import { Reveal } from '@/components/ui/Reveal'
import { RoughCircle, RoughLine, RoughPath, RoughRect } from '@/components/ui/Sketchy'

// A small sketch of Bridge Builder at level 3, drawn from what that level
// actually ships: a 16 t convoy, a $14,000 budget. It shows the loop only,
// objective, canvas, readout, run button, so it reads at a glance instead of
// asking to be studied. All coordinates are viewBox units.

const GREEN = '#2fb98b' // civil accent

const FRAME = 'stroke-ink/30 dark:stroke-white/25'
const HAIRLINE = 'stroke-ink/20 dark:stroke-white/15'
const PEN = 'stroke-ink/60 dark:stroke-stone-300'
const SCREEN_TEXT = 'fill-ink dark:fill-stone-200'
const NOTE = 'fill-ink-soft dark:fill-stone-400'
const DOT = 'fill-ink/70 dark:fill-stone-300'

const FINE = { roughness: 0.7, strokeWidth: 1 }
const LIGHT_FILL = { hachureGap: 8, fillWeight: 1 }

const RAIL_X = [28, 44, 60, 76, 92]
const JOINTS = [
  [66, 138],
  [162, 138],
  [258, 138],
  [354, 138],
  [114, 104],
  [210, 104],
  [306, 104],
]

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <Reveal>
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">What a challenge looks like</h2>
        <p className="mt-4 text-ink-soft dark:text-stone-400">
          Every field opens with a short intro, then three challenges. You build something, run it, and read what the
          numbers did. After that the field explains the idea you just used and gives you a version to build at home.
        </p>
      </Reveal>

      <Reveal>
        <figure className="mx-auto mt-10 max-w-md">
          <svg
            viewBox="0 0 420 250"
            className="w-full"
            role="img"
            aria-label="Sketch of the Bridge Builder screen at level 3: a level rail on step three of five, the goal line 'Carry the 16 t convoy across for $14,000', a canvas holding a truss bridge between two banks with a truck waiting on the left, a readout of the worst member force and the money spent, a 'Send the truck' button, and a link to the engineering analysis."
          >
            {/* the screen */}
            <RoughRect x={10} y={10} width={400} height={230} className={FRAME} options={FINE} />

            {/* level rail, third one filled */}
            {RAIL_X.map((cx, i) => (
              <RoughCircle
                key={cx}
                cx={cx}
                cy={32}
                r={5}
                className={i === 2 ? undefined : HAIRLINE}
                stroke={i === 2 ? GREEN : undefined}
                hatchStroke={i === 2 ? GREEN : undefined}
                options={FINE}
              />
            ))}

            <text x={26} y={58} className={`${SCREEN_TEXT} font-display text-[13px] font-bold`}>
              Carry the 16 t convoy across for $14,000
            </text>

            {/* build canvas */}
            <RoughRect x={26} y={68} width={368} height={100} className={HAIRLINE} options={FINE} />
            <RoughRect x={26} y={138} width={40} height={30} className={HAIRLINE} fillClassName={HAIRLINE} options={LIGHT_FILL} />
            <RoughRect x={354} y={138} width={40} height={30} className={HAIRLINE} fillClassName={HAIRLINE} options={LIGHT_FILL} />

            {/* the truss: deck, zigzag web, top chord */}
            <RoughLine x1={66} y1={138} x2={354} y2={138} className={PEN} />
            <RoughPath d="M66 138 L114 104 L162 138 L210 104 L258 138 L306 104 L354 138" className={PEN} />
            <RoughLine x1={114} y1={104} x2={306} y2={104} className={PEN} />
            {JOINTS.map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3} className={DOT} />
            ))}

            {/* the truck, on the left bank */}
            <RoughRect x={32} y={121} width={28} height={15} className={PEN} options={FINE} />
            <circle cx={40} cy={138} r={3.5} className={DOT} />
            <circle cx={52} cy={138} r={3.5} className={DOT} />

            {/* what the run gives back */}
            <text x={26} y={190} className={`${NOTE} font-mono text-[11px]`}>
              Worst member 82% of limit | $11,900 of $14,000
            </text>

            {/* the run button, and the analysis you can open after it */}
            <RoughRect x={26} y={200} width={124} height={28} stroke={GREEN} hatchStroke={GREEN} options={LIGHT_FILL} />
            <text x={88} y={219} textAnchor="middle" className={`${SCREEN_TEXT} font-display text-[12px] font-bold`}>
              Send the truck
            </text>
            <text x={164} y={219} className={`${NOTE} font-mono text-[11px]`}>
              &gt; Engineering analysis
            </text>
          </svg>

          <figcaption className="figure-caption mt-4">
            Bridge Builder, level 3. Sending the truck solves the truss at every position along the deck, so the beam
            that gives out is the one carrying too much.
          </figcaption>
        </figure>
      </Reveal>
    </section>
  )
}
