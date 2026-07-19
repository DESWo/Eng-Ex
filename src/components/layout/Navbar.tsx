import { Link } from 'react-router-dom'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

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
        <ThemeToggle />
      </div>
    </header>
  )
}
