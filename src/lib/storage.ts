/**
 * Tiny localStorage wrapper.
 * Everything the app remembers (theme, progress, reflections) lives under
 * the "ee:" prefix, so it is easy to inspect or clear in DevTools.
 *
 * When somebody is signed in, their saved work also sits under a scope of
 * their own, so two students sharing a computer never overwrite each other.
 */
const PREFIX = 'ee:'

let scope = ''

/** Called once before React renders, and again whenever the profile changes. */
export function setStorageScope(next: string) {
  scope = next
}

const scoped = (key: string) => PREFIX + scope + key

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(scoped(key))
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(scoped(key), JSON.stringify(value))
    // Let live views (picker chips, mastery bars) refresh without a remount.
    window.dispatchEvent(new CustomEvent(SAVE_EVENT, { detail: key }))
  } catch {
    // Storage can be unavailable (private mode). The app still works without it.
  }
}

/** Fired on window after every scoped save; detail is the unscoped key. */
export const SAVE_EVENT = 'ee:save'

/** The raw stored string for a scoped key, for useSyncExternalStore snapshots. */
export function rawSnapshot(key: string): string | null {
  try {
    return localStorage.getItem(scoped(key))
  } catch {
    return null
  }
}

/* ---- Unscoped access, for things that belong to the browser rather than to
       one person: the theme, and the record of who is signed in. ---- */

export function loadGlobalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveGlobalJson(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // ignored, same as above
  }
}

export function removeGlobal(key: string) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // ignored
  }
}

/**
 * Move work done while signed out into a brand new account, so signing in for
 * the first time never looks like it wiped everything.
 *
 * It MOVES rather than copies on purpose. If the guest slot were left behind,
 * the next student to sign in on a shared computer would inherit the previous
 * one's progress. Accounts that already hold data are returning users, so they
 * keep what is theirs and the guest slot is left untouched for its real owner.
 */
export function moveGuestDataInto(targetScope: string, keys: string[]): boolean {
  try {
    const alreadyHasData = keys.some((k) => localStorage.getItem(PREFIX + targetScope + k) !== null)
    if (alreadyHasData) return false

    const moved: string[] = []
    for (const key of keys) {
      const from = localStorage.getItem(PREFIX + key)
      if (from === null) continue
      localStorage.setItem(PREFIX + targetScope + key, from)
      moved.push(key)
    }
    for (const key of moved) localStorage.removeItem(PREFIX + key)
    return moved.length > 0
  } catch {
    return false
  }
}
