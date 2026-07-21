import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Turns pointer events anywhere on an <svg> into viewBox coordinates, so a
 * challenge can let people grab and move the actual thing on screen instead of
 * pushing a slider that stands in for it.
 *
 * Attach `bind` to the <svg>. While a drag is live the pointer is captured, so
 * it keeps tracking even when it leaves the element.
 */
export function useSvgDrag(onMove: (x: number, y: number, done: boolean) => void) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [dragging, setDragging] = useState(false)
  // Kept in a ref so the listeners below never go stale.
  const handler = useRef(onMove)
  handler.current = onMove

  const toViewBox = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const vb = svg.viewBox.baseVal
    // The viewBox is scaled to fit the element, so map through that.
    const w = vb.width || rect.width
    const h = vb.height || rect.height
    return {
      x: ((clientX - rect.left) / rect.width) * w + vb.x,
      y: ((clientY - rect.top) / rect.height) * h + vb.y,
    }
  }, [])

  const start = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const p = toViewBox(e.clientX, e.clientY)
      if (!p) return
      try {
        svgRef.current?.setPointerCapture(e.pointerId)
      } catch {
        // A pointer that is already gone (fast tap) cannot be captured; the
        // drag still works, it just stops tracking outside the element.
      }
      setDragging(true)
      handler.current(p.x, p.y, false)
    },
    [toViewBox],
  )

  const move = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragging) return
      const p = toViewBox(e.clientX, e.clientY)
      if (p) handler.current(p.x, p.y, false)
    },
    [dragging, toViewBox],
  )

  const end = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragging) return
      setDragging(false)
      const p = toViewBox(e.clientX, e.clientY)
      if (p) handler.current(p.x, p.y, true)
    },
    [dragging, toViewBox],
  )

  // Releasing outside the window should still finish the drag.
  useEffect(() => {
    if (!dragging) return
    const cancel = () => setDragging(false)
    window.addEventListener('pointercancel', cancel)
    return () => window.removeEventListener('pointercancel', cancel)
  }, [dragging])

  return {
    dragging,
    bind: {
      ref: svgRef,
      onPointerDown: start,
      onPointerMove: move,
      onPointerUp: end,
      style: { touchAction: 'none' as const, cursor: dragging ? 'grabbing' : 'grab' },
    },
  }
}
