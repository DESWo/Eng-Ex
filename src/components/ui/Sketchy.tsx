import { useMemo } from 'react'
import rough from 'roughjs/bin/rough'
import type { Drawable, Options } from 'roughjs/bin/core'
import { cn } from '@/lib/utils'

/**
 * Hand-drawn SVG shapes, for scenes that should look sketched in an engineer's
 * notebook rather than laid out by a machine.
 *
 * Rough.js generates the wobble, but nothing here touches the DOM: the
 * generator hands back path data, which these components render as ordinary
 * <path> elements. Colors come from Tailwind classes on the group, because a
 * CSS rule outranks the presentation attributes Rough writes.
 *
 * Two rules matter when using these:
 *
 * 1. Always pass a stable `seed`. Rough re-randomizes on every call, so an
 *    unseeded shape would redraw itself differently on each React render and
 *    visibly crawl. Every component below defaults its seed from its own
 *    geometry, which keeps a shape steady while still making neighbours differ.
 * 2. Keep these on things that change at human speed. The path data is memoized
 *    on geometry, so a shape animating attributes every frame would regenerate
 *    its sketch every frame too.
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

export function RoughRect({ x, y, width, height, className, fillClassName, options, seed }: RoughRectProps) {
  const s = seed ?? seedFrom(x, y, width, height)
  const { hatch, outline } = useMemo(() => {
    const opts = { ...BASE, ...options, seed: s }
    return {
      hatch: fillClassName
        ? paths(generator.rectangle(x, y, width, height, { ...opts, fill: '#000', stroke: 'none' }), 'h')
        : null,
      outline: paths(generator.rectangle(x, y, width, height, { ...opts, fill: undefined }), 'o'),
    }
  }, [x, y, width, height, fillClassName, options, s])

  return (
    <>
      {hatch && <g className={cn('fill-none', fillClassName)}>{hatch}</g>}
      <g className={cn('fill-none', className)}>{outline}</g>
    </>
  )
}

interface RoughCircleProps extends ShapeProps {
  cx: number
  cy: number
  r: number
}

export function RoughCircle({ cx, cy, r, className, fillClassName, options, seed }: RoughCircleProps) {
  const s = seed ?? seedFrom(cx, cy, r)
  const { hatch, outline } = useMemo(() => {
    const opts = { ...BASE, ...options, seed: s }
    return {
      hatch: fillClassName
        ? paths(generator.circle(cx, cy, r * 2, { ...opts, fill: '#000', stroke: 'none' }), 'h')
        : null,
      outline: paths(generator.circle(cx, cy, r * 2, { ...opts, fill: undefined }), 'o'),
    }
  }, [cx, cy, r, fillClassName, options, s])

  return (
    <>
      {hatch && <g className={cn('fill-none', fillClassName)}>{hatch}</g>}
      <g className={cn('fill-none', className)}>{outline}</g>
    </>
  )
}

interface RoughLineProps extends ShapeProps {
  x1: number
  y1: number
  x2: number
  y2: number
}

export function RoughLine({ x1, y1, x2, y2, className, options, seed }: RoughLineProps) {
  const s = seed ?? seedFrom(x1, y1, x2, y2)
  const line = useMemo(
    () => paths(generator.line(x1, y1, x2, y2, { ...BASE, ...options, seed: s }), 'l'),
    [x1, y1, x2, y2, options, s],
  )
  return <g className={cn('fill-none', className)}>{line}</g>
}

interface RoughPathProps extends ShapeProps {
  d: string
}

export function RoughPath({ d, className, fillClassName, options, seed }: RoughPathProps) {
  const s = seed ?? seedFrom(d.length, d.charCodeAt(0) || 1)
  const { hatch, outline } = useMemo(() => {
    const opts = { ...BASE, ...options, seed: s }
    return {
      hatch: fillClassName ? paths(generator.path(d, { ...opts, fill: '#000', stroke: 'none' }), 'h') : null,
      outline: paths(generator.path(d, { ...opts, fill: undefined }), 'o'),
    }
  }, [d, fillClassName, options, s])

  return (
    <>
      {hatch && <g className={cn('fill-none', fillClassName)}>{hatch}</g>}
      <g className={cn('fill-none', className)}>{outline}</g>
    </>
  )
}
