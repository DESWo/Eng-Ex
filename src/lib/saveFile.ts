import { loadJson, removeJson, saveJson } from '@/lib/storage'
import { loadProfile, normalizeProfileName } from '@/lib/profile'
import { disciplines } from '@/data/disciplines'
import { LEVELS_PER_CHALLENGE } from '@/lib/mastery'

/**
 * Export and import of a student's progress, since it otherwise only exists in
 * one browser's localStorage. The transfer code at the bottom is the same
 * payload as text, for machines that cannot download a file.
 *
 * Both are stopgaps for the Firebase seam behind src/lib/profile.ts.
 */

/** Everything a person's progress lives in. Mirrors CARRIED_KEYS in profile.ts. */
const SAVE_KEYS = ['progress', 'challenges', 'levels', 'reflections'] as const

/** Best stars on one level, so a full field is 3 games x 5 levels x 3 stars. */
const MAX_STARS = 3

export interface SaveFile {
  app: 'engineering-explorer'
  version: 1
  savedAt: string
  account: string | null
  /** Plain-language progress, so a teacher opening the file reads it, not JSON. */
  summary: Record<string, string>
  data: Record<string, unknown>
}

/** The slice of the levels store the summary reads. */
type LevelStore = Record<string, { cleared?: number[]; stars?: Record<string, number> }>

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** What a bad value actually is, so the error message can name it. */
const describe = (value: unknown) =>
  value === null ? 'empty' : Array.isArray(value) ? 'a list' : `a ${typeof value}`

/** Levels cleared and stars earned, per field, in sentences. Never read back in. */
function summarize(levels: unknown): Record<string, string> {
  const store = (isPlainObject(levels) ? levels : {}) as LevelStore
  const summary: Record<string, string> = {}
  let allCleared = 0
  let allStars = 0
  let allTotal = 0

  for (const discipline of disciplines) {
    const total = discipline.challenges.length * LEVELS_PER_CHALLENGE
    let cleared = 0
    let stars = 0
    for (const challenge of discipline.challenges) {
      const entry = store[challenge.id]
      const done = Array.isArray(entry?.cleared) ? entry.cleared : []
      cleared += new Set(done.filter((n) => n >= 1 && n <= LEVELS_PER_CHALLENGE)).size
      for (const value of Object.values(entry?.stars ?? {})) {
        if (typeof value === 'number') stars += Math.min(value, MAX_STARS)
      }
    }
    allCleared += cleared
    allStars += stars
    allTotal += total
    // Untouched fields would be twelve lines of zeroes; only report real work.
    if (cleared > 0 || stars > 0) {
      summary[discipline.name] =
        `${cleared} of ${total} levels cleared, ${stars} of ${total * MAX_STARS} stars`
    }
  }

  summary['All fields'] =
    allCleared === 0
      ? 'Nothing cleared yet'
      : `${allCleared} of ${allTotal} levels cleared, ${allStars} of ${allTotal * MAX_STARS} stars`
  return summary
}

export function buildSave(): SaveFile {
  const data: Record<string, unknown> = {}
  for (const k of SAVE_KEYS) data[k] = loadJson<unknown>(k, null)
  return {
    app: 'engineering-explorer',
    version: 1,
    savedAt: new Date().toISOString(),
    // The display name, so a teacher opening the file sees "Alex R", not a
    // lowercased key. Matching on restore normalizes both sides, and legacy
    // files that stored an email address normalize to themselves.
    account: loadProfile()?.name ?? null,
    summary: summarize(data.levels),
    data,
  }
}

export function downloadSave() {
  const save = buildSave()
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `engineering-explorer-save-${save.savedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export type ParsedSave = { ok: true; save: SaveFile } | { ok: false; error: string }

/**
 * Read a save file WITHOUT touching storage.
 *
 * The input is hand-editable text that has been through a downloads folder or
 * an email, so none of it is trusted. Validating the shape here means a bad
 * file fails with a message instead of half-writing over real progress.
 */
export function parseSave(raw: string): ParsedSave {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'That file could not be read as a save file.' }
  }
  if (!isPlainObject(parsed) || parsed.app !== 'engineering-explorer') {
    return { ok: false, error: 'That file is not an Engineering Explorer save.' }
  }
  if (parsed.version !== 1) {
    return {
      ok: false,
      error: `That save is version ${JSON.stringify(parsed.version)}, and this app reads version 1.`,
    }
  }
  if (!isPlainObject(parsed.data)) {
    return { ok: false, error: 'That save file has no progress inside it.' }
  }
  for (const k of SAVE_KEYS) {
    const value = parsed.data[k]
    if (value === null || value === undefined) continue
    if (!isPlainObject(value)) {
      return {
        ok: false,
        error: `That save file is damaged: "${k}" should be a set of entries and is ${describe(value)}.`,
      }
    }
  }
  // `summary` and any other extra keys are ignored
  return { ok: true, save: parsed as unknown as SaveFile }
}

/** Is this save from the profile (or guest slot) that is in use right now? */
export function saveMatchesCurrentAccount(save: SaveFile): boolean {
  const mine = loadProfile()?.key ?? null
  const theirs = typeof save.account === 'string' ? normalizeProfileName(save.account) : null
  return mine === theirs
}

/**
 * Write a parsed save into the CURRENT account (or guest slot), replacing what
 * is there. A key missing from the file is CLEARED, not left behind, so a
 * restore is an overwrite and not a merge. Pass only a save from parseSave.
 * Caller should reload the page afterwards so every hook re-reads.
 */
export function applySave(save: SaveFile) {
  for (const k of SAVE_KEYS) {
    const value = save.data[k]
    if (isPlainObject(value)) saveJson(k, value)
    else removeJson(k)
  }
}

/* ---- Transfer code: the same save as one line of text ---- */

/** base64url, so the code survives a URL bar, an email, or a chat message. */
export function buildTransferCode(): string {
  const bytes = new TextEncoder().encode(JSON.stringify(buildSave()))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Back to JSON text, or null if the code was cut short or mangled in transit. */
export function decodeTransferCode(code: string): string | null {
  try {
    const b64 = code.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
    if (!b64) return null
    const binary = atob(b64)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}
