import type { ReactNode } from 'react'
import type { Difficulty } from '@/lib/types'
import { cn } from '@/lib/utils'

const difficultyStyles: Record<Difficulty, string> = {
  Beginner: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  Intermediate: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  Advanced: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
}

interface BadgeProps {
  children: ReactNode
  className?: string
}

/** Small rounded pill for labels and stats. */
export function Badge({ children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-display font-semibold',
        'bg-stone-100 text-ink-soft dark:bg-white/10 dark:text-stone-300',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function DifficultyBadge({ level }: { level: Difficulty }) {
  return <Badge className={difficultyStyles[level]}>{level}</Badge>
}
