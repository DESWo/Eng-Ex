import { Link, NavLink } from 'react-router-dom'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { cn } from '@/lib/utils'

function LogoMark() {
  return (
    <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden>
      <rect width="64" height="64" rx="16" className="fill-ink dark:fill-stone-100" />
      <path d="M36 8 L17 37 h11 l-5 19 L47 26 H34 Z" fill="#fbbf24" />
    </svg>
  )
}

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-900/5 bg-cream/80 backdrop-blur-md dark:border-white/5 dark:bg-night/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Engineering Explorer home">
          <LogoMark />
          <span className="font-display text-lg font-bold tracking-tight">
            Engineering Explorer
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          <NavLink
            to="/about"
            className={({ isActive }) =>
              cn(
                'rounded-full px-3 py-2 font-display text-sm font-semibold transition-colors duration-200',
                isActive
                  ? 'bg-stone-900/5 text-ink dark:bg-white/10 dark:text-stone-100'
                  : 'text-ink-soft hover:bg-stone-900/5 dark:text-stone-400 dark:hover:bg-white/10',
              )
            }
          >
            About
          </NavLink>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
