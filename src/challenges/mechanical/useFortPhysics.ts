import { useEffect, useRef, useState } from 'react'
import { Bodies, Composite, Engine, Body } from 'matter-js'

/** One block of the fort, in the scene's own SVG pixel coordinates. */
export interface PhysicsBlock {
  id: string
  x: number
  y: number
  w: number
  h: number
  /** Heavier materials shrug off a glancing hit. */
  mat: 'wood' | 'stone' | 'glass'
}

/** Where each block has ended up, relative to where it was built. */
export interface BlockTransform {
  dx: number
  dy: number
  /** Degrees, for SVG's rotate(deg, cx, cy). */
  rot: number
}

/** The boulder arriving, in scene pixels per second. */
export interface Impact {
  x: number
  y: number
  vx: number
  vy: number
  /** Bumped per shot so the same numbers can fire the sim twice. */
  id: number
}

const DENSITY = { wood: 0.0012, stone: 0.0028, glass: 0.0007 } as const
const RESTITUTION = { wood: 0.12, stone: 0.05, glass: 0.2 } as const

/** How long the collapse is allowed to run before it is left where it lies. */
const RUN_MS = 2600
/** The solver's fixed timestep. Matter is happiest with a steady delta. */
const STEP_MS = 16
/** Most steps one tick may take, so a long stall cannot freeze the page. */
const MAX_CATCHUP_STEPS = 12

/**
 * Rigid-body physics for the catapult fort.
 *
 * The trajectory maths in the game still decides whether a shot is a hit; this
 * only animates the consequence, so no level's solvability depends on the
 * simulation. Feed it an impact and it returns a live transform per block until
 * the dust settles, then holds the final pose.
 */
export function useFortPhysics(blocks: PhysicsBlock[], groundY: number, impact: Impact | null) {
  const [transforms, setTransforms] = useState<Record<string, BlockTransform>>({})
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  // Blocks are rebuilt on every render, so keep them out of the effect's deps
  // and read the current set when a shot actually lands.
  const blocksRef = useRef(blocks)
  blocksRef.current = blocks

  useEffect(() => {
    if (!impact) {
      setTransforms({})
      return
    }
    const built = blocksRef.current
    const engine = Engine.create()
    engine.gravity.y = 1.6

    const ground = Bodies.rectangle(400, groundY + 30, 1600, 60, { isStatic: true, friction: 0.9 })
    const bodies = built.map((b) =>
      Bodies.rectangle(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, {
        density: DENSITY[b.mat],
        restitution: RESTITUTION[b.mat],
        friction: 0.55,
      }),
    )

    // The boulder, arriving on the shot's own heading.
    const speed = Math.hypot(impact.vx, impact.vy) || 1
    const boulder = Bodies.circle(impact.x, impact.y, 9, {
      density: 0.006,
      restitution: 0.25,
      friction: 0.4,
    })
    Body.setVelocity(boulder, { x: (impact.vx / speed) * 26, y: (impact.vy / speed) * 26 })

    Composite.add(engine.world, [ground, ...bodies, boulder])

    const origins = built.map((b) => ({ cx: b.x + b.w / 2, cy: b.y + b.h / 2 }))
    const start = performance.now()
    let last = start
    let simulated = 0

    /**
     * Driven by a timer rather than requestAnimationFrame, because rAF does not
     * run at all in a hidden tab. A student who switches away mid-shot would
     * come back to a fort frozen in mid-air; on a timer the collapse still
     * finishes, just in coarser jumps, and settles into its final pose.
     *
     * The solver only ever sees fixed 16ms steps. Wall-clock time is caught up
     * by taking several of them, capped so a long stall cannot lock the page up.
     */
    const step = () => {
      const now = performance.now()
      const elapsed = Math.min(now - last, STEP_MS * MAX_CATCHUP_STEPS)
      last = now

      for (let t = 0; t < elapsed; t += STEP_MS) {
        Engine.update(engine, STEP_MS)
        simulated += STEP_MS
      }

      const next: Record<string, BlockTransform> = {}
      bodies.forEach((body, i) => {
        next[built[i].id] = {
          dx: body.position.x - origins[i].cx,
          dy: body.position.y - origins[i].cy,
          rot: (body.angle * 180) / Math.PI,
        }
      })
      setTransforms(next)

      if (simulated >= RUN_MS && timerRef.current !== undefined) {
        clearInterval(timerRef.current)
        timerRef.current = undefined
      }
    }
    timerRef.current = setInterval(step, STEP_MS)

    return () => {
      if (timerRef.current !== undefined) clearInterval(timerRef.current)
      Composite.clear(engine.world, false)
      Engine.clear(engine)
    }
    // Only a genuinely new impact restarts the collapse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impact?.id, groundY])

  return transforms
}
