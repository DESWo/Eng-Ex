import {
  moveGuestDataInto,
  loadGlobalJson,
  removeGlobal,
  saveGlobalJson,
  scopeHasData,
  setStorageScope,
} from '@/lib/storage'

/**
 * Which local profile is in use right now.
 *
 * NOT authentication. There is no server, so there is no password to check and
 * no protection on the data. It only picks which progress to load on a shared
 * computer. Do not store anything private behind it.
 */
export interface Profile {
  /** As typed, for display. */
  name: string
  /** Lowercased, whitespace-collapsed name. Identity for save-file matching. */
  key: string
  /**
   * Storage prefix this profile owns. STORED, never re-derived from the name:
   * a profile created under the old email flow keeps its `u:<email>:` keys
   * forever, while profiles created since get a `p:` scope.
   */
  scope: string
  /** ISO date the profile was first created on this browser. */
  since: string
  /**
   * @deprecated Equals `key`. Compat shim so files outside this change still
   * compile: saveFile.ts, SaveDialog.tsx, TeacherPage.tsx, App.tsx. Point them
   * at `name` (display) or `key` (identity) and delete this.
   */
  email: string
}

const KEY = 'profile'

/** Saved work that should follow somebody into a new profile. */
const CARRIED_KEYS = ['progress', 'challenges', 'levels', 'reflections']

/** Long enough for "Alexandra Rodriguez-Smith", short enough to fit a chip. */
export const MAX_PROFILE_NAME = 40

/** Trim and collapse runs of whitespace, so "Bob  Smith " displays as typed. */
export const cleanProfileName = (value: string) => value.replace(/\s+/g, ' ').trim()

/** Identity form: two students typing the same name land on the same work. */
export const normalizeProfileName = (value: string) => cleanProfileName(value).toLowerCase()

/**
 * @deprecated Old name for normalizeProfileName, still imported by saveFile.ts.
 * Emails hold no internal whitespace, so legacy save files compare identically.
 */
export const normalizeEmail = normalizeProfileName

export type NameProblem = 'empty' | 'long' | null

/** Only empty and absurd are rejected. Any short text is a fine profile name. */
export function checkProfileName(value: string): NameProblem {
  const name = cleanProfileName(value)
  if (name.length === 0) return 'empty'
  if (name.length > MAX_PROFILE_NAME) return 'long'
  return null
}

/* ---- Scopes ---- */

/** FNV-1a, base36. Keeps two different names off the same storage keys. */
function hash36(value: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/**
 * A readable slug plus a hash of the full name. The slug alone is not
 * collision-safe ("Bob!" and "Bob?" both slug to "bob") and goes empty for a
 * name with no ASCII letters, which would land on the guest scope.
 */
function derivedScope(normalized: string): string {
  const slug = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/, '')
  return `p:${slug ? `${slug}-` : ''}${hash36(normalized)}:`
}

/** The prefix the old email flow wrote: ee:u:<normalized-email>:<key>. */
const legacyScope = (normalized: string) => `u:${normalized}:`

/**
 * Only used to spot a pre-rename stored record, which could only hold an
 * address because the old dialog rejected anything else. Never applied to what
 * somebody types now.
 */
const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

/**
 * Where a typed name's work lives. An address that already has work under the
 * old email scope keeps it, so somebody who leaves a migrated profile and types
 * the same thing again does not land on an empty slate.
 */
export function scopeForName(rawName: string): string {
  const normalized = normalizeProfileName(rawName)
  const legacy = legacyScope(normalized)
  if (scopeHasData(legacy, CARRIED_KEYS)) return legacy
  return derivedScope(normalized)
}

/* ---- Load, migrate, apply ---- */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null)

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Read the stored profile, upgrading old and half-written shapes on the way
 * through. Anything unrecognisable resolves to null, which is the guest slot:
 * a broken record must not throw before the first render.
 */
export function loadProfile(): Profile | null {
  const raw = loadGlobalJson<unknown>(KEY, null)
  if (!isObject(raw)) return null

  // Pre-rename records carried only `email`; it is the display name now.
  const name = cleanProfileName(str(raw.name) ?? str(raw.email) ?? '')
  if (!name) return null

  const key = normalizeProfileName(name)
  // A record with no scope is either pre-rename (an address, whose work is
  // under u:<email>: and stays there even when empty) or a damaged newer one,
  // which scopeForName resolves back to whichever scope actually holds work.
  const scope = str(raw.scope) ?? (looksLikeEmail(key) ? legacyScope(key) : scopeForName(key))

  return { name, key, scope, since: str(raw.since) ?? today(), email: key }
}

/**
 * Point storage at the current profile. Must run before React renders,
 * otherwise hooks read the wrong profile's saved work on first mount. Also the
 * one place the migrated shape is written back, so the upgrade happens once
 * rather than on every read.
 */
export function applyStoredScope() {
  const profile = loadProfile()
  setStorageScope(profile?.scope ?? '')
  if (profile) saveGlobalJson(KEY, profile)
}

/** Does this name already hold work on this browser? */
export const nameHasWork = (rawName: string) => scopeHasData(scopeForName(rawName), CARRIED_KEYS)

/** Is there work saved on the guest slot? */
export const guestHasWork = () => scopeHasData('', CARRIED_KEYS)

/** Start using a named profile on this device. Existing work is picked up. */
export function switchProfile(rawName: string): Profile {
  const name = cleanProfileName(rawName)
  const key = normalizeProfileName(name)
  const scope = scopeForName(name)
  // A first-time profile inherits whatever was played as a guest.
  moveGuestDataInto(scope, CARRIED_KEYS)
  const profile: Profile = { name, key, scope, since: today(), email: key }
  saveGlobalJson(KEY, profile)
  setStorageScope(scope)
  // typing the name is itself the confirmation, so don't ask again below
  confirmSession()
  return profile
}

/** Back to the guest slot. The profile's own work stays on this browser. */
export function leaveProfile() {
  removeGlobal(KEY)
  setStorageScope('')
}

/* ---- Stale profile ----
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
