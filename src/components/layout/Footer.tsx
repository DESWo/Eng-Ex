import { Link } from 'react-router-dom'

const quietLink =
  'transition-colors hover:text-ink dark:hover:text-stone-200'

export function Footer() {
  return (
    <footer className="border-t border-stone-900/5 dark:border-white/5">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-10 text-sm text-ink-soft sm:flex-row dark:text-stone-400">
        <p>
          <span className="font-display font-bold text-ink dark:text-stone-200">
            Engineering Explorer
          </span>{' '}
          · Made for curious minds.
        </p>
        <nav aria-label="Footer" className="flex items-center gap-5">
          <Link to="/teacher" className={quietLink}>
            For teachers
          </Link>
          <Link to="/privacy" className={quietLink}>
            Privacy
          </Link>
        </nav>
        <p>Explore. Play. Discover what fits you.</p>
      </div>
    </footer>
  )
}
