import { Link } from 'react-router-dom'

// Inline text links, but tall enough to hit with a thumb.
const quietLink =
  'inline-flex min-h-11 items-center transition-colors hover:text-ink dark:hover:text-stone-200'

export function Footer() {
  return (
    <footer className="border-t border-stone-900/5 dark:border-white/5">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-1 px-6 py-8 text-sm text-ink-soft sm:flex-row dark:text-stone-400">
        <p className="font-display font-bold text-ink dark:text-stone-200">Engineering Explorer</p>
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5">
          <Link to="/teacher" className={quietLink}>
            For teachers
          </Link>
          <Link to="/technical" className={quietLink}>
            Technical notes
          </Link>
          <Link to="/privacy" className={quietLink}>
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  )
}
