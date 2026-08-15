import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { LogIn, LogOut, Save } from 'lucide-react'
import { SoundToggle } from '@/components/ui/SoundToggle'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { SignInDialog } from '@/components/auth/SignInDialog'
import { SaveDialog } from '@/components/auth/SaveDialog'
import { useProfile } from '@/hooks/useProfile'
import { confirmSession, isSessionConfirmed } from '@/lib/profile'
import { cn } from '@/lib/utils'

function LogoMark() {
  return (
    <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden>
      <rect width="64" height="64" rx="16" className="fill-ink dark:fill-stone-100" />
      <path d="M36 8 L17 37 h11 l-5 19 L47 26 H34 Z" fill="#fbbf24" />
    </svg>
  )
}

const tabClass = (isActive: boolean) =>
  cn(
    'rounded-full px-3 py-2 font-display text-sm font-semibold transition-colors duration-200',
    isActive
      ? 'bg-stone-900/5 text-ink dark:bg-white/10 dark:text-stone-100'
      : 'text-ink-soft hover:bg-stone-900/5 dark:text-stone-400 dark:hover:bg-white/10',
  )

export function Navbar() {
  const { profile, signOut } = useProfile()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  // A name tag in localStorage outlives whoever typed it, so a stored profile
  // this browser session has not vouched for is worth one question. A guest has
  // no name tag to question, and typing an email is itself the answer.
  const [unconfirmed, setUnconfirmed] = useState(() => !isSessionConfirmed())
  const askWhoIsHere = profile !== null && unconfirmed

  useEffect(() => {
    if (isSessionConfirmed()) setUnconfirmed(false)
  }, [profile])

  const thatIsMe = () => {
    confirmSession()
    setUnconfirmed(false)
  }

  const notMe = () => {
    signOut()
    setUnconfirmed(false)
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-stone-900/5 bg-cream/80 backdrop-blur-md dark:border-white/5 dark:bg-night/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Engineering Explorer home">
            <LogoMark />
            <span className="hidden font-display text-lg font-bold tracking-tight sm:inline">
              Engineering Explorer
            </span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            <NavLink to="/about" className={({ isActive }) => tabClass(isActive)}>
              About
            </NavLink>

            <button
              type="button"
              onClick={() => setSaveOpen(true)}
              title="Back up or restore your progress"
              className={cn(tabClass(false), 'flex items-center gap-1.5')}
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">Backup</span>
            </button>

            {profile ? (
              <div className="flex items-center gap-1">
                <span
                  className="hidden max-w-[11rem] truncate rounded-full bg-stone-900/5 px-3 py-2 font-display text-sm font-semibold text-ink dark:bg-white/10 dark:text-stone-100 sm:block"
                  title={profile.email}
                >
                  {profile.email}
                </span>
                <button
                  type="button"
                  onClick={signOut}
                  aria-label="Sign out"
                  className={cn(tabClass(false), 'flex items-center gap-1.5')}
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                aria-label="Sign in"
                className={cn(tabClass(false), 'flex items-center gap-1.5')}
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Sign in</span>
              </button>
            )}

            <SoundToggle />
            <ThemeToggle />
          </div>
        </div>

        {askWhoIsHere && profile && (
          <div className="border-t border-amber-900/10 bg-amber-100 dark:border-amber-200/15 dark:bg-amber-500/15 print:hidden">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 py-2 sm:px-6">
              <p className="font-display text-sm font-semibold text-amber-900 dark:text-amber-200">
                Signed in as <span className="break-all">{profile.email}</span>. You?
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={thatIsMe}
                  className="rounded-full bg-amber-900/10 px-3 py-1 font-display text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-900/20 dark:bg-amber-200/15 dark:text-amber-200 dark:hover:bg-amber-200/25"
                >
                  {"That's me"}
                </button>
                <button
                  type="button"
                  onClick={notMe}
                  className="rounded-full border border-amber-900/30 px-3 py-1 font-display text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-900/10 dark:border-amber-200/40 dark:text-amber-200 dark:hover:bg-amber-200/10"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <SignInDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <SaveDialog open={saveOpen} onClose={() => setSaveOpen(false)} />
    </>
  )
}
