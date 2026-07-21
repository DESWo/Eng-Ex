import { loadJson, saveJson } from '@/lib/storage'
import { loadProfile } from '@/lib/profile'

/**
 * Progress lives only in the browser, and browsers lose data: cleared
 * history, a different computer, a school machine that wipes itself. A save
 * file is the escape hatch: download your progress, load it anywhere.
 */

/** Everything a person's progress lives in. Mirrors CARRIED_KEYS in profile.ts. */
const SAVE_KEYS = ['progress', 'challenges', 'levels', 'reflections'] as const

export interface SaveFile {
  app: 'engineering-explorer'
  version: 1
  savedAt: string
  account: string | null
  data: Record<string, unknown>
}

export function buildSave(): SaveFile {
  const data: Record<string, unknown> = {}
  for (const k of SAVE_KEYS) data[k] = loadJson<unknown>(k, null)
  return {
    app: 'engineering-explorer',
    version: 1,
    savedAt: new Date().toISOString(),
    account: loadProfile()?.email ?? null,
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

/**
 * Write a save file's contents into the CURRENT account (or guest slot).
 * Returns an error message, or null on success. The caller should reload the
 * page afterwards so every hook re-reads the restored state.
 */
export function applySave(raw: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return 'That file could not be read as a save file.'
  }
  const save = parsed as Partial<SaveFile>
  if (save?.app !== 'engineering-explorer' || typeof save.data !== 'object' || save.data === null) {
    return 'That file is not an Engineering Explorer save.'
  }
  for (const k of SAVE_KEYS) {
    const v = (save.data as Record<string, unknown>)[k]
    if (v !== null && v !== undefined) saveJson(k, v)
  }
  return null
}
