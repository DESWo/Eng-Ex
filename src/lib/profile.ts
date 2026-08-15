import {
  moveGuestDataInto,
  loadGlobalJson,
  removeGlobal,
  saveGlobalJson,
  scopeHasData,
  setStorageScope,
} from '@/lib/storage'

/**
 * Who is using the app right now.
 *
 * This is deliberately NOT a secure account. There is no server behind the app,
 * so there is nothing to check a password against and nothing to protect the
 * data with. It is a name tag: it tells the app whose progress to load, which
 * is what matters when a class shares one computer. Anything genuinely private
 * should wait until there is a real backend to hold it.
 */
export interface Profile {
  email: string
  /** ISO date the profile was first created on this browser. */
  since: string
}

const KEY = 'profile'

/** Saved work that should follow somebody into a new account. */
const CARRIED_KEYS = ['progress', 'challenges', 'levels', 'reflections']

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

export const normalizeEmail = (value: string) => value.trim().toLowerCase()

/** Storage prefix for one person's saved work. */
const scopeFor = (email: string) => `u:${normalizeEmail(email)}:`

export function loadProfile(): Profile | null {
  const profile = loadGlobalJson<Profile | null>(KEY, null)
  return profile && typeof profile.email === 'string' ? profile : null
}

/**
 * Point storage at whoever is signed in. Must run before React renders,
 * otherwise hooks read the wrong person's saved work on first mount.
 */
export function applyStoredScope() {
  const profile = loadProfile()
  setStorageScope(profile ? scopeFor(profile.email) : '')
}

/** Does this account already hold work on this browser? */
export const accountHasWork = (rawEmail: string) =>
  scopeHasData(scopeFor(rawEmail), CARRIED_KEYS)

/** Is there work saved on the guest slot, waiting to be claimed? */
export const guestHasWork = () => scopeHasData('', CARRIED_KEYS)

export function signIn(rawEmail: string): Profile {
  const email = normalizeEmail(rawEmail)
  const scope = scopeFor(email)
  // A first-time account inherits whatever was played while signed out.
  moveGuestDataInto(scope, CARRIED_KEYS)
  const profile: Profile = { email, since: new Date().toISOString().slice(0, 10) }
  saveGlobalJson(KEY, profile)
  setStorageScope(scope)
  // Signing in by hand is itself proof of who is here, so the stale sign-in
  // check below should not then ask.
  confirmSession()
  return profile
}

export function signOut() {
  removeGlobal(KEY)
  setStorageScope('')
}

/* ---- Stale sign-in ----
   A name tag written into localStorage outlives the person who typed it: the
   next student sits down at a shared computer and quietly plays into someone
   else's progress. sessionStorage dies with the browser tab, so a stored
   profile that this session has not confirmed is worth one question. ---- */

const SESSION_KEY = 'ee:session-confirmed'

export function isSessionConfirmed(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    // No sessionStorage (private mode, blocked storage): asking every load
    // would be worse than not asking, so treat it as confirmed.
    return true
  }
}

export function confirmSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // ignored, same as above
  }
}
