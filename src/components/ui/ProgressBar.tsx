import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  /** 0 to 100 */
  value: number
  className?: string
  label?: string
}

/** Slim animated progress bar. Fills with the current `--accent` color. */
export function ProgressBar({ value, className, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-white/10', className)}
    >
      <motion.div
        className="h-full rounded-full accent-bg"
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  )
}
