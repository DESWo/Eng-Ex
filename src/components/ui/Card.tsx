import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds hover lift + pointer cursor for clickable cards. */
  interactive?: boolean
}

/** The rounded, softly shadowed surface used across the whole app. */
export function Card({ interactive = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-3xl bg-white shadow-clay border border-stone-200/70',
        'dark:bg-night-panel dark:border-white/10',
        interactive &&
          'cursor-pointer transition-shadow duration-200 hover:shadow-clay-lg',
        className,
      )}
      {...props}
    />
  )
}
