import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface MeterProps {
  label: string
  /** Text shown on the right, e.g. "$8,100 of $10,000". */
  display: string
  /** 0 to 1 fill amount. */
  fraction: number
  /** Tailwind class for the fill color, e.g. "bg-emerald-500". */
  barClass: string
  /** Optional 0 to 1 position for a requirement marker line. */
  markerFraction?: number
}

/** Labeled bar used for budgets, strength, wattage, and other resources. */
export function Meter({ label, display, fraction, barClass, markerFraction }: MeterProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-display font-semibold">{label}</span>
        <span className="tabular-nums text-ink-soft dark:text-stone-400">{display}</span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-white/10">
        <motion.div
          className={cn('h-full rounded-full', barClass)}
          animate={{ width: `${Math.min(100, fraction * 100)}%` }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        />
        {markerFraction !== undefined && (
          <span
            aria-hidden
            className="absolute inset-y-0 w-0.5 bg-ink dark:bg-white"
            style={{ left: `${markerFraction * 100}%` }}
          />
        )}
      </div>
    </div>
  )
}
