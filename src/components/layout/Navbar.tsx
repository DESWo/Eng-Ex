import {
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, NavLink } from 'react-router-dom'
import {
  ChevronDown,
  GraduationCap,
  Info,
  LogOut,
  Save,
  Shield,
  User,
  UserPlus,
  Wrench,
} from 'lucide-react'
import { SoundToggle } from '@/components/ui/SoundToggle'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { ProfileDialog } from '@/components/auth/SignInDialog'
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
    'flex min-h-11 items-center gap-1.5 rounded-full px-3 py-2 font-display text-sm font-semibold transition-colors duration-200',
    isActive
      ? 'bg-stone-900/5 text-ink dark:bg-white/10 dark:text-stone-100'
      : 'text-ink-soft hover:bg-stone-900/5 dark:text-stone-400 dark:hover:bg-white/10',
  )

const menuItemClass =
  'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left font-display text-sm font-semibold text-ink-soft transition-colors duration-200 hover:bg-stone-900/5 dark:text-stone-300 dark:hover:bg-white/10'

/** Everything a student does not need at the top level. */
function SiteMenu({ onBackup }: { onBackup: () => void }) {
  const { profile, leaveProfile } = useProfile()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const close = (returnFocus = true) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  // Anything focusable in the panel is a menu item, including the two toggles.
  const items = () =>
    Array.from(panelRef.current?.querySelectorAll<HTMLElement>('a[href], button') ?? [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      // A click outside is not a keyboard exit, so leave focus where it landed.
      setOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Opening with a key should land on an item, but the panel only exists after
  // the render that opens it, so the focus is queued rather than done inline.
  const pendingFocus = useRef<'first' | 'last' | null>(null)
  useEffect(() => {
    if (!open || !pendingFocus.current) return
    const list = items()
    ;(pendingFocus.current === 'first' ? list[0] : list[list.length - 1])?.focus()
    pendingFocus.current = null
  }, [open])

  const onTriggerKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const where = e.key === 'ArrowDown' ? 'first' : 'last'
    if (open) {
      const list = items()
      ;(where === 'first' ? list[0] : list[list.length - 1])?.focus()
    } else {
      pendingFocus.current = where
      setOpen(true)
    }
  }

  const onPanelKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    const list = items()
    if (list.length === 0) return
    e.preventDefault()
    const here = list.indexOf(document.activeElement as HTMLElement)
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? list.length - 1
          : here === -1
            ? e.key === 'ArrowDown'
              ? 0
              : list.length - 1
            : (here + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length
    list[next]?.focus()
  }

  // Tabbing past the last item leaves the menu, so it should not stay open.
  const onBlurOut = (e: ReactFocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
  }

  return (
    <div className="relative" onBlur={onBlurOut}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={onTriggerKeyDown}
        aria-expanded={open}
        aria-controls="site-menu"
        className={cn(tabClass(false), open && 'bg-stone-900/5 dark:bg-white/10')}
      >
        <span>Menu</span>
        <ChevronDown
          className={cn('h-4 w-4 motion-safe:transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="site-menu"
            ref={panelRef}
            onKeyDown={onPanelKeyDown}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100vh-6rem)] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-stone-900/10 bg-cream p-1.5 shadow-clay dark:border-white/10 dark:bg-night"
          >
            {/* Close first, so focus is back on the trigger when the dialog
                records what to restore focus to. */}
            <button
              type="button"
              onClick={() => {
                close()
                onBackup()
              }}
              className={menuItemClass}
            >
              <Save className="h-4 w-4 shrink-0" aria-hidden />
              Back up or restore
            </button>
            {profile && (
              <button
                type="button"
                onClick={() => {
                  close()
                  leaveProfile()
                }}
                className={menuItemClass}
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                Leave this profile
              </button>
            )}

            <div className="my-1.5 border-t border-stone-900/10 dark:border-white/10" />

            <Link to="/about" onClick={() => close(false)} className={menuItemClass}>
              <Info className="h-4 w-4 shrink-0" aria-hidden />
              About
            </Link>
            <Link to="/teacher" onClick={() => close(false)} className={menuItemClass}>
              <GraduationCap className="h-4 w-4 shrink-0" aria-hidden />
              For teachers
            </Link>
            <Link to="/technical" onClick={() => close(false)} className={menuItemClass}>
              <Wrench className="h-4 w-4 shrink-0" aria-hidden />
              Technical notes
            </Link>
            <Link to="/privacy" onClick={() => close(false)} className={menuItemClass}>
              <Shield className="h-4 w-4 shrink-0" aria-hidden />
              Privacy
            </Link>

            <div className="my-1.5 border-t border-stone-900/10 dark:border-white/10" />

            {/* The toggles keep their own labels and pressed state; the row text
                names what the control is for. */}
            <div className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-3">
              <span className="font-display text-sm font-semibold text-ink-soft dark:text-stone-300">
                Sound
              </span>
              <SoundToggle />
            </div>
            <div className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-3">
              <span className="font-display text-sm font-semibold text-ink-soft dark:text-stone-300">
                Theme
              </span>
              <ThemeToggle />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Navbar() {
  const { profile, leaveProfile } = useProfile()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  // A stored profile outlives the session that created it, so on a shared
  // machine ask once whether it is still the same person. Guests have nothing
  // to confirm.
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
    leaveProfile()
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
          <div className="flex items-center gap-1 sm:gap-2">
            <NavLink to="/" end className={({ isActive }) => tabClass(isActive)}>
              Explore
            </NavLink>

            {profile ? (
              // The name is also the way to switch, so a shared machine never
              // has to leave a profile just to hand over.
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                aria-label={`Switch profile, using ${profile.name}`}
                title={`Using ${profile.name}. Click to switch.`}
                className={tabClass(false)}
              >
                <User className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden max-w-[9rem] truncate sm:inline">{profile.name}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                aria-label="Pick a profile on this device"
                className={tabClass(false)}
              >
                <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Profile</span>
              </button>
            )}

            <SiteMenu onBackup={() => setSaveOpen(true)} />
          </div>
        </div>

        {askWhoIsHere && profile && (
          <div className="border-t border-amber-900/10 bg-amber-100 dark:border-amber-200/15 dark:bg-amber-500/15 print:hidden">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 py-2 sm:px-6">
              <p className="font-display text-sm font-semibold text-amber-900 dark:text-amber-200">
                This device is set to <span className="break-all">{profile.name}</span>. You?
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
                  Not me
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <ProfileDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <SaveDialog open={saveOpen} onClose={() => setSaveOpen(false)} />
    </>
  )
}
