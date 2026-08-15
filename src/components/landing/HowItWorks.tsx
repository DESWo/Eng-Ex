import { Reveal } from '@/components/ui/Reveal'
import { RoughCircle, RoughLine, RoughPath, RoughRect } from '@/components/ui/Sketchy'

// The sketch is Bridge Builder at level 3, drawn from what that level actually
// ships: a 16 t convoy, a $14,000 budget, wood at $5 a length, steel at $12.
// All coordinates are viewBox units.

const GREEN = '#2fb98b' // civil accent

const FRAME = 'stroke-ink/30 dark:stroke-white/25'
const HAIRLINE = 'stroke-ink/20 dark:stroke-white/15'
const PEN = 'stroke-ink/60 dark:stroke-stone-300'
const LEADER = 'stroke-ink/30 dark:stroke-white/25'
const SCREEN_TEXT = 'fill-ink dark:fill-stone-200'
const NOTE = 'fill-ink-soft dark:fill-stone-400'
const DOT = 'fill-ink/70 dark:fill-stone-300'

const FINE = { roughness: 0.7, strokeWidth: 1 }
const LOOSE = { roughness: 1.7, strokeWidth: 0.9, bowing: 0.6 }
const LIGHT_FILL = { hachureGap: 8, fillWeight: 1 }

const RAIL_X = [168, 184, 200, 216, 232]
const JOINTS = [
  [208, 200],
  [304, 200],
  [400, 200],
  [492, 200],
  [256, 160],
  [352, 160],
  [448, 160],
]

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <Reveal>
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">What a challenge looks like</h2>
        <p className="mt-4 text-ink-soft dark:text-stone-400">
          Every field opens with a short intro, then three challenges. You build something, run it, and see whether it
          holds. After that the field explains the idea you just used and gives you a version to build at home.
        </p>
      </Reveal>

      <Reveal>
        <figure className="mt-10">
          <div className="-mx-6 overflow-x-auto px-6 pb-1 sm:mx-0 sm:px-0">
            <svg
              viewBox="0 0 700 400"
              className="w-full min-w-[600px]"
              role="img"
              aria-label="Sketch of the Bridge Builder screen at level 3: a level rail on step three of five, the goal line 'Carry the 16 t convoy across for $14,000', a canvas holding a truss bridge between two banks with a truck waiting on the left, buttons for wood at $5 a length and steel at $12, a bar showing how much of the budget is spent, and a 'Send the truck' button."
            >
              {/* the screen */}
              <RoughRect x={150} y={34} width={400} height={310} className={FRAME} options={FINE} />

              {/* level rail, third one filled */}
              {RAIL_X.map((cx, i) => (
                <RoughCircle
                  key={cx}
                  cx={cx}
                  cy={58}
                  r={5}
                  className={i === 2 ? undefined : HAIRLINE}
                  stroke={i === 2 ? GREEN : undefined}
                  hatchStroke={i === 2 ? GREEN : undefined}
                  options={FINE}
                />
              ))}

              <text x={164} y={90} className={`${SCREEN_TEXT} font-display text-[13px] font-bold`}>
                Carry the 16 t convoy across for $14,000
              </text>

              {/* build canvas */}
              <RoughRect x={164} y={100} width={372} height={140} className={HAIRLINE} options={FINE} />
              <RoughRect x={164} y={200} width={44} height={40} className={HAIRLINE} fillClassName={HAIRLINE} options={LIGHT_FILL} />
              <RoughRect x={492} y={200} width={44} height={40} className={HAIRLINE} fillClassName={HAIRLINE} options={LIGHT_FILL} />

              {/* the truss: deck, zigzag web, top chord */}
              <RoughLine x1={208} y1={200} x2={492} y2={200} className={PEN} />
              <RoughPath d="M208 200 L256 160 L304 200 L352 160 L400 200 L448 160 L492 200" className={PEN} />
              <RoughLine x1={256} y1={160} x2={448} y2={160} className={PEN} />
              {JOINTS.map(([cx, cy]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3} className={DOT} />
              ))}

              {/* the truck, on the left bank */}
              <RoughRect x={170} y={182} width={30} height={16} className={PEN} options={FINE} />
              <circle cx={178} cy={200} r={3.5} className={DOT} />
              <circle cx={192} cy={200} r={3.5} className={DOT} />

              {/* materials */}
              <RoughRect x={164} y={254} width={76} height={30} className={FRAME} options={FINE} />
              <RoughRect x={248} y={254} width={76} height={30} className={FRAME} options={FINE} />
              <text x={174} y={273} className={`${SCREEN_TEXT} text-[11px] font-semibold`}>
                Wood $5
              </text>
              <text x={258} y={273} className={`${SCREEN_TEXT} text-[11px] font-semibold`}>
                Steel $12
              </text>

              {/* budget bar */}
              <text x={344} y={258} className={`${NOTE} font-mono text-[10px]`}>
                $11,900 of $14,000
              </text>
              <RoughRect x={344} y={264} width={140} height={12} stroke={GREEN} hatchStroke={GREEN} options={LIGHT_FILL} />
              <RoughRect x={344} y={264} width={192} height={12} className={FRAME} options={FINE} />

              {/* the run button */}
              <RoughRect x={164} y={300} width={126} height={30} stroke={GREEN} hatchStroke={GREEN} options={LIGHT_FILL} />
              <text x={227} y={320} textAnchor="middle" className={`${SCREEN_TEXT} font-display text-[12px] font-bold`}>
                Send the truck
              </text>

              {/* callouts */}
              <RoughLine x1={138} y1={58} x2={160} y2={58} className={LEADER} options={LOOSE} />
              <text x={134} y={62} textAnchor="end" className={`${NOTE} text-[12px]`}>
                level 3 of 5
              </text>

              <RoughLine x1={138} y1={88} x2={161} y2={86} className={LEADER} options={LOOSE} />
              <text x={134} y={88} textAnchor="end" className={`${NOTE} text-[12px]`}>
                the goal, in tons
                <tspan x={134} dy={14}>
                  and dollars
                </tspan>
              </text>

              <RoughLine x1={138} y1={164} x2={250} y2={161} className={LEADER} options={LOOSE} />
              <text x={134} y={150} textAnchor="end" className={`${NOTE} text-[12px]`}>
                you place every
                <tspan x={134} dy={14}>
                  joint and beam
                </tspan>
                <tspan x={134} dy={14}>
                  yourself
                </tspan>
              </text>

              <RoughLine x1={556} y1={268} x2={539} y2={269} className={LEADER} options={LOOSE} />
              <text x={560} y={264} className={`${NOTE} text-[12px]`}>
                what you have
                <tspan x={560} dy={14}>
                  spent so far
                </tspan>
              </text>

              <RoughLine x1={206} y1={334} x2={206} y2={364} className={LEADER} options={LOOSE} />
              <text x={196} y={378} className={`${NOTE} text-[12px]`}>
                sends the truck across
              </text>
            </svg>
          </div>

          <figcaption className="figure-caption mt-4">
            Bridge Builder, level 3. Sending the truck solves the truss at every position along the deck, so the beam
            that gives out is the one carrying too much.
          </figcaption>
        </figure>
      </Reveal>
    </section>
  )
}
