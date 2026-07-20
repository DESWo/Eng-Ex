import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Info, LogIn, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useProfile } from '@/hooks/useProfile'
import { isValidEmail, loadProfile, normalizeEmail } from '@/lib/profile'
import { cn } from '@/lib/utils'

/** Is there already work saved on this browser that has not been claimed yet? */
function hasUnclaimedProgress() {
  try {
    return ['ee:progress', 'ee:challenges', 'ee:levels'].some((k) => localStorage.getItem(k) !== null)
  } catch {
    return false
  }
}

export function SignInDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signIn } = useProfile()
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const valid = isValidEmail(email)
  // Explain the problem as soon as there is enough typed to judge. Waiting for
  // a blur leaves the Continue button greyed out with no reason given.
  const showError = !valid && (touched ? email.trim().length > 0 : email.trim().length > 3)
  // Only worth mentioning the carry-over when it will actually happen.
  const willCarry = open && !loadProfile() && hasUnclaimedProgress()

  useEffect(() => {
    if (!open) return
    setEmail('')
    setTouched(false)
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!valid) return
    signIn(normalizeEmail(email))
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm dark:bg-black/60"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="signin-title"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="w-full max-w-md rounded-3xl border border-stone-200/70 bg-white p-6 shadow-clay-lg dark:border-white/10 dark:bg-night-panel"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="signin-title" className="font-display text-xl font-bold tracking-tight">
                  Save your progress
                </h2>
                <p className="mt-1 text-sm text-ink-soft dark:text-stone-400">
                  Enter your email so the app knows whose work to load.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1.5 text-ink-soft transition-colors hover:bg-stone-900/5 dark:text-stone-400 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} noValidate>
              <label htmlFor="signin-email" className="font-display text-sm font-semibold">
                Email
              </label>
              <input
                id="signin-email"
                ref={inputRef}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={showError}
                aria-describedby={showError ? 'signin-error' : undefined}
                className={cn(
                  'mt-1.5 w-full rounded-2xl border-2 bg-transparent px-4 py-3 font-display text-base outline-none transition-colors',
                  'placeholder:text-stone-400 dark:placeholder:text-stone-600',
                  showError
                    ? 'border-rose-400 focus:border-rose-500'
                    : 'border-stone-200 focus:border-ink dark:border-white/15 dark:focus:border-stone-300',
                )}
              />
              {showError && (
                <p id="signin-error" className="mt-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400">
                  That does not look like an email address. Check for a missing @ or a typo.
                </p>
              )}

              {willCarry && (
                <p className="mt-3 rounded-xl bg-emerald-100 px-3.5 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                  The progress already on this browser will be moved into your account.
                </p>
              )}

              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-stone-100 px-3.5 py-2.5 dark:bg-white/5">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft dark:text-stone-400" />
                <p className="text-xs leading-relaxed text-ink-soft dark:text-stone-400">
                  There is no password, because there is no server yet. Your work is saved in this
                  browser only, and anyone using this computer can open it. Do not put anything
                  private in here.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Not now
                </Button>
                <Button type="submit" variant="primary" disabled={!valid}>
                  <LogIn className="h-4 w-4" />
                  Continue
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
