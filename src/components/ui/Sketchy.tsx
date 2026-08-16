import { useMemo } from 'react'
import rough from 'roughjs/bin/rough'
import type { Drawable, Options } from 'roughjs/bin/core'
import { cn } from '@/lib/utils'

/**
 * Hand-drawn SVG shapes on top of Rough.js. The generator hands back path data,
 * which these render as plain <path> elements; nothing here touches the DOM.
 * Colors come from Tailwind classes on the group, because a CSS rule outranks
 * the presentation attributes Rough writes.
 *
 * Two things to watch:
 * 1. Rough re-randomizes on every call, so an unseeded shape redraws differently
 *    on each render and visibly crawls. Each component below defaults its seed
 *    from its own geometry.
 * 2. Path data is memoized on geometry, so a shape animating its attributes
 *    every frame regenerates its sketch every frame.
 */

const generator = rough.generator()

/** A small stable integer from a shape's own numbers, used as the Rough seed. */
function seedFrom(...nums: number[]) {
  let h = 2166136261
  for (const n of nums) {
    h ^= Math.round(n * 7)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h % 10000) + 1
}

const BASE: Options = {
  roughness: 1.05,
  bowing: 1.2,
  fillStyle: 'hachure',
  fillWeight: 1.3,
  hachureAngle: -41,
  hachureGap: 5,
  strokeWidth: 1.4,
}

/** Turn a Rough drawable into plain <path> elements. */
function paths(d: Drawable, keyPrefix: string) {
  return generator.toPaths(d).map((p, i) => (
    <path
      key={`${keyPrefix}-${i}`}
      d={p.d}
      fill="none"
      strokeWidth={p.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  ))
}

interface ShapeProps {
  /** Tailwind stroke class for the outline, e.g. "stroke-stone-700". */
  className?: string
  /** Tailwind stroke class for the hatching, e.g. "stroke-amber-400". */
  fillClassName?: string
  /** Literal outline color, for palettes that live in data. Wins over `className`: it lands inline. */
  stroke?: string
  /** Literal hatching color. Presence of either fill prop enables hatching. */
  hatchStroke?: string
  /** Override the pen. */
  options?: Options
  seed?: number
}

interface RoughRectProps extends ShapeProps {
  x: number
  y: number
  width: number
  height: number
}

export function RoughRect({ x, y, width, height, className, fillClassName, stroke, hatchStroke, options, seed }: RoughRectProps) {
  const s = seed ?? seedFrom(x, y, width, height)
  const { hatch, outline } = useMemo(() => {
    const opts = { ...BASE, ...options, seed: s }
    return {
      hatch: fillClassName || hatchStroke
        ? paths(generator.rectangle(x, y, width, height, { ...opts, fill: '#000', stroke: 'none' }), 'h')
        : null,
      outline: paths(generator.rectangle(x, y, width, height, { ...opts, fill: undefined }), 'o'),
    }
  }, [x, y, width, height, fillClassName, hatchStroke, options, s])

  return (
    <>
      {hatch && (
        <g className={cn('fill-none', fillClassName)} style={hatchStroke ? { stroke: hatchStroke } : undefined}>
          {hatch}
        </g>
      )}
      <g className={cn('fill-none', className)} style={stroke ? { stroke } : undefined}>
        {outline}
      </g>
    </>
  )
}

interface RoughCircleProps extends ShapeProps {
  cx: number
  cy: number
  r: number
}

export function RoughCircle({ cx, cy, r, className, fillClassName, stroke, hatchStroke, options, seed }: RoughCircleProps) {
  const s = seed ?? seedFrom(cx, cy, r)
  const { hatch, outline } = useMemo(() => {
    const opts = { ...BASE, ...options, seed: s }
    return {
      hatch: fillClassName || hatchStroke
        ? paths(generator.circle(cx, cy, r * 2, { ...opts, fill: '#000', stroke: 'none' }), 'h')
        : null,
      outline: paths(generator.circle(cx, cy, r * 2, { ...opts, fill: undefined }), 'o'),
    }
  }, [cx, cy, r, fillClassName, hatchStroke, options, s])

  return (
    <>
      {hatch && (
        <g className={cn('fill-none', fillClassName)} style={hatchStroke ? { stroke: hatchStroke } : undefined}>
          {hatch}
        </g>
      )}
      <g className={cn('fill-none', className)} style={stroke ? { stroke } : undefined}>
        {outline}
      </g>
    </>
  )
}

interface RoughLineProps extends ShapeProps {
  x1: number
  y1: number
  x2: number
  y2: number
}

export function RoughLine({ x1, y1, x2, y2, className, stroke, options, seed }: RoughLineProps) {
  const s = seed ?? seedFrom(x1, y1, x2, y2)
  const line = useMemo(
    () => paths(generator.line(x1, y1, x2, y2, { ...BASE, ...options, seed: s }), 'l'),
    [x1, y1, x2, y2, options, s],
  )
  return (
    <g className={cn('fill-none', className)} style={stroke ? { stroke } : undefined}>
      {line}
    </g>
  )
}

interface RoughPathProps extends ShapeProps {
  d: string
}

export function RoughPath({ d, className, fillClassName, stroke, hatchStroke, options, seed }: RoughPathProps) {
  const s = seed ?? seedFrom(d.length, d.charCodeAt(0) || 1)
  const { hatch, outline } = useMemo(() => {
    const opts = { ...BASE, ...options, seed: s }
    return {
      hatch: fillClassName || hatchStroke ? paths(generator.path(d, { ...opts, fill: '#000', stroke: 'none' }), 'h') : null,
      outline: paths(generator.path(d, { ...opts, fill: undefined }), 'o'),
    }
  }, [d, fillClassName, hatchStroke, options, s])

  return (
    <>
      {hatch && (
        <g className={cn('fill-none', fillClassName)} style={hatchStroke ? { stroke: hatchStroke } : undefined}>
          {hatch}
        </g>
      )}
      <g className={cn('fill-none', className)} style={stroke ? { stroke } : undefined}>
        {outline}
      </g>
    </>
  )
}
