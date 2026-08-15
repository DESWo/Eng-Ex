import type { HTMLAttributes } from 'react'
import { SketchFrame } from '@/components/ui/SketchFrame'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds hover lift + pointer cursor for clickable cards. */
  interactive?: boolean
  /** Hand-drawn border instead of the plain hairline. */
  sketch?: boolean
}

/** The base surface used across the app. */
export function Card({ interactive = false, sketch = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-3xl bg-white shadow-clay border',
        sketch ? 'relative border-transparent' : 'border-stone-200/70 dark:border-white/10',
        'dark:bg-night-panel',
        interactive &&
          'cursor-pointer transition-shadow duration-200 hover:shadow-clay-lg',
        className,
      )}
      {...props}
    >
      {sketch && <SketchFrame />}
      {children}
    </div>
  )
}
