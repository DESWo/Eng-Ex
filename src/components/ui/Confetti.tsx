import { useMemo } from 'react'
import { motion } from 'framer-motion'

const COLORS = ['#f2695c', '#2fb98b', '#7b6cf0', '#fbbf24', '#38bdf8', '#f472b6']

interface Piece {
  left: number
  delay: number
  color: string
  spin: number
  duration: number
  size: number
  drift: number
}

/**
 * Lightweight celebration burst, no extra libraries.
 * Render it inside a relatively positioned container when something is won.
 */
export function Confetti({ count = 36 }: { count?: number }) {
  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.3,
        color: COLORS[i % COLORS.length],
        spin: 180 + Math.random() * 540,
        duration: 1.5 + Math.random() * 1,
        size: 6 + Math.random() * 7,
        drift: (Math.random() - 0.5) * 140,
      })),
    [count],
  )

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[inherit]">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute -top-3 block rounded-[2px]"
          style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.55, backgroundColor: p.color }}
          initial={{ y: -12, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: 560, x: p.drift, rotate: p.spin, opacity: [1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  )
}
