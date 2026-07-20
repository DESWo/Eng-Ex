import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InsightToggleProps {
  /** What the overlay shows, e.g. "forces" or "current flow". */
  label: string
  on: boolean
  onChange: (on: boolean) => void
}

/**
 * The level 4 switch that turns on a game's engineering overlay.
 * Once unlocked it stays available in level 5, where reading it is the point.
 */
export function InsightToggle({ label, on, onChange }: InsightToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-4 py-2',
        'font-display text-sm font-semibold transition-colors duration-200',
        on
          ? 'accent-bg text-white shadow-clay'
          : 'bg-stone-100 text-ink-soft hover:bg-stone-200 dark:bg-white/5 dark:text-stone-400 dark:hover:bg-white/10',
      )}
    >
      {on ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      {on ? `Hide ${label}` : `Show ${label}`}
    </button>
  )
}
