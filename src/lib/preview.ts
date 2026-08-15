import { useSyncExternalStore } from 'react'
import { loadGlobalJson, removeGlobal, saveGlobalJson } from '@/lib/storage'

/**
 * Teacher preview: one browser-wide flag that opens every locked field.
 * Stored unscoped (plain "ee:preview", not under a student's prefix), so
 * turning it on writes nothing into anyone's saved work.
 */
const KEY = 'preview'
const EVENT = 'ee:preview'

export function isPreviewOn(): boolean {
  return loadGlobalJson<boolean>(KEY, false) === true
}

export function setPreview(on: boolean) {
  if (on) saveGlobalJson(KEY, true)
  else removeGlobal(KEY)
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  return () => window.removeEventListener(EVENT, onChange)
}

/** Live view of the flag, so the unlock gates and the banner follow the toggle. */
export function usePreview(): boolean {
  return useSyncExternalStore(subscribe, isPreviewOn)
}
