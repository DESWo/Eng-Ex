/**
 * WCAG-aware text color for content sitting ON an accent-colored surface.
 *
 * Ten of the twelve discipline accents are too light for white text at the
 * 4.5:1 AA threshold (the nuclear yellow is barely 1.9:1), so each accent
 * scope also sets `--accent-ink`, and the `.on-accent` class uses it. The two
 * accents that fail both directions were darkened at the source instead
 * (#7b6cf0 → #7163dd, #6366f1 → #6164ec) so white passes on them.
 */
import type { CSSProperties } from 'react'

const INK = '#1c1917'
const WHITE = '#ffffff'

const luminance = (hex: string) => {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

const inkCache = new Map<string, string>()

/** '#ffffff' when white text meets AA on this accent, otherwise the app ink. */
export function accentInk(accentHex: string): string {
  let ink = inkCache.get(accentHex)
  if (!ink) {
    ink = contrast(1.0, luminance(accentHex)) >= 4.5 ? WHITE : INK
    inkCache.set(accentHex, ink)
  }
  return ink
}

/** The style object for anything that scopes a discipline accent. */
export function accentVars(accentHex: string) {
  return { '--accent': accentHex, '--accent-ink': accentInk(accentHex) } as CSSProperties
}
