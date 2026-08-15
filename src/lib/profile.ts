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
 * NOT authentication. There is no server, so there is no password to check and
 * no protection on the data. It only picks which progress to load on a shared
 * computer. Do not store anything private behind it.
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

/** Is there work saved on the guest slot? */
export const guestHasWork = () => scopeHasData('', CARRIED_KEYS)

export function signIn(rawEmail: string): Profile {
  const email = normalizeEmail(rawEmail)
  const scope = scopeFor(email)
  // A first-time account inherits whatever was played while signed out.
  moveGuestDataInto(scope, CARRIED_KEYS)
  const profile: Profile = { email, since: new Date().toISOString().slice(0, 10) }
  saveGlobalJson(KEY, profile)
  setStorageScope(scope)
  // typing the email is itself the confirmation, so don't ask again below
  confirmSession()
  return profile
}

export function signOut() {
  removeGlobal(KEY)
  setStorageScope('')
}

/* ---- Stale sign-in ----
   A profile in localStorage outlives the person who typed it, so on a shared
   computer the next student can play into someone else's progress.
   sessionStorage dies with the tab, so a stored profile this session has not
   confirmed gets one question. ---- */

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
