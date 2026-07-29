import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Three stars per level: one for solving it, and two more for solving it
 * without the hint and without stepping away and coming back.
 */
export function Stars({
  earned,
  size = 'sm',
  className,
}: {
  earned: number
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  const box = size === 'xs' ? 'h-2.5 w-2.5' : size === 'md' ? 'h-5 w-5' : 'h-3.5 w-3.5'
  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={`${earned} of 3 stars`}
    >
      {[1, 2, 3].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={cn(
            box,
            n <= earned
              ? 'fill-amber-400 text-amber-400'
              : 'fill-transparent text-stone-300 dark:text-stone-600',
          )}
        />
      ))}
    </span>
  )
}

/** Why the player got the rating they got, in one short line. */
export function starReason(earned: number): string {
  if (earned >= 3) return 'Solved cold, no hint. Three stars.'
  if (earned === 2) return 'Solved it. Two stars: you came back to it.'
  return 'Solved it. One star: the hint helped.'
}
