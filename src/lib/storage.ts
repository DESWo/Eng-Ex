/**
 * Tiny localStorage wrapper.
 * Everything the app remembers (theme, progress, reflections) lives under
 * the "ee:" prefix, so it is easy to inspect or clear in DevTools.
 */
const PREFIX = 'ee:'

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable (private mode). The app still works without it.
  }
}
