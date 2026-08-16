import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Info, User, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useDialogChrome } from '@/components/auth/useDialogChrome'
import { useProfile } from '@/hooks/useProfile'
import {
  checkProfileName,
  guestHasWork,
  loadProfile,
  MAX_PROFILE_NAME,
  nameHasWork,
} from '@/lib/profile'
import { cn } from '@/lib/utils'

/** Pick which local profile this browser saves under. Not a sign-in. */
export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { switchProfile } = useProfile()
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const problem = checkProfileName(name)
  // An empty box is the starting state, not a mistake, so it only reads as an
  // error once the person has tried to submit or left the field.
  const showError = problem === 'long' || (problem === 'empty' && touched)
  // Guest work only moves into an EMPTY profile, so the banner cannot promise
  // anything until there is a usable name to check against.
  const guestWork = open && !loadProfile() && guestHasWork()
  const carryDecided = guestWork && problem === null
  const profileKeepsItsOwn = carryDecided && nameHasWork(name)

  useDialogChrome(open, panelRef, onClose)

  useEffect(() => {
    if (!open) return
    setName('')
    setTouched(false)
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [open])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (problem !== null) return
    switchProfile(name)
    onClose()
  }

  // Portalled to <body> so the dialog sits outside the app it makes inert.
  return createPortal(
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
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="w-full max-w-md rounded-3xl border border-stone-200/70 bg-white p-6 shadow-clay-lg dark:border-white/10 dark:bg-night-panel"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="profile-title" className="font-display text-xl font-bold tracking-tight">
                  Pick a profile on this device
                </h2>
                <p className="mt-1 text-sm text-ink-soft dark:text-stone-400">
                  A name tells this browser whose work to load when a class shares a computer.
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
              <label htmlFor="profile-name" className="font-display text-sm font-semibold">
                Profile name
              </label>
              <input
                id="profile-name"
                ref={inputRef}
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Alex R"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={showError}
                aria-describedby={showError ? 'profile-error' : 'profile-hint'}
                className={cn(
                  'mt-1.5 w-full rounded-2xl border-2 bg-transparent px-4 py-3 font-display text-base outline-none transition-colors',
                  'placeholder:text-stone-400 dark:placeholder:text-stone-600',
                  showError
                    ? 'border-rose-400 focus:border-rose-500'
                    : 'border-stone-200 focus:border-ink dark:border-white/15 dark:focus:border-stone-300',
                )}
              />
              {showError ? (
                <p
                  id="profile-error"
                  className="mt-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400"
                >
                  {problem === 'long'
                    ? `That is longer than ${MAX_PROFILE_NAME} characters. A first name works fine.`
                    : 'Type a name for this profile. A first name works fine.'}
                </p>
              ) : (
                <p id="profile-hint" className="mt-1.5 text-xs text-ink-soft dark:text-stone-400">
                  Letters, numbers and spaces. Use the same name next time to find your work again.
                </p>
              )}

              {carryDecided &&
                (profileKeepsItsOwn ? (
                  <p className="mt-3 rounded-xl bg-amber-100 px-3.5 py-2.5 text-sm font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
                    That profile already has progress on this device, so it keeps its own work. What
                    you played as a guest stays here under the guest profile, and leaving brings you
                    back to it.
                  </p>
                ) : (
                  <p className="mt-3 rounded-xl bg-emerald-100 px-3.5 py-2.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                    The progress already on this browser will be moved into this profile.
                  </p>
                ))}

              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-stone-100 px-3.5 py-2.5 dark:bg-white/5">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft dark:text-stone-400" />
                <p className="text-xs leading-relaxed text-ink-soft dark:text-stone-400">
                  This is a name tag, not an account. There is no password and no server, your work
                  is saved in this browser only, and anyone using this computer can open it. Do not
                  put anything private in here.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Not now
                </Button>
                <Button type="submit" variant="primary" disabled={problem !== null}>
                  <User className="h-4 w-4" />
                  Use this device profile
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
