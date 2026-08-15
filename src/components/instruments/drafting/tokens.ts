/**
 * Drafting board tokens.
 *
 * Light: vellum and graphite. Dark: blueprint stock and chalk. Every primitive
 * in this kit reads these custom properties, so a sheet carrying `sheetVars`
 * themes the whole drawing, including the SVG inside it.
 */

export const sheetVars = [
  '[--dr-paper:#f5efe1]',
  '[--dr-paper-2:#ece3d2]',
  '[--dr-ink:#2e2a23]',
  '[--dr-ink-soft:#6c6252]',
  '[--dr-grid:#cbbfa8]',
  '[--dr-grid-major:#a99a7c]',
  '[--dr-red:#c0362c]',
  '[--dr-amber:#a97a12]',
  '[--dr-check:#1d5f9e]',
  'dark:[--dr-paper:#101820]',
  'dark:[--dr-paper-2:#16202b]',
  'dark:[--dr-ink:#dbe7f2]',
  'dark:[--dr-ink-soft:#93a6b8]',
  'dark:[--dr-grid:#26374a]',
  'dark:[--dr-grid-major:#35506b]',
  'dark:[--dr-red:#ff7a6a]',
  'dark:[--dr-amber:#e0b356]',
  'dark:[--dr-check:#6fb7ff]',
].join(' ')

/** Pen weights, in viewBox px. A drawing has four and only four. */
export const PEN = {
  hair: 0.5,
  thin: 0.9,
  dim: 1.1,
  member: 3.2,
  heavy: 4.4,
} as const

/** Drafting lettering: mono, upper case, letterspaced. */
export const LETTER = 'font-mono uppercase'
export const TRACK = { wide: '0.18em', normal: '0.07em' } as const

/** Ink roles, as var() strings ready for stroke/fill. */
export const INK = {
  line: 'var(--dr-ink)',
  soft: 'var(--dr-ink-soft)',
  grid: 'var(--dr-grid)',
  gridMajor: 'var(--dr-grid-major)',
  red: 'var(--dr-red)',
  amber: 'var(--dr-amber)',
  check: 'var(--dr-check)',
  paper: 'var(--dr-paper)',
} as const

/** A measured value, lettered the way a drawing letters it. */
export const dimText = (value: number, unit = 'm', digits = 2) =>
  `${value.toFixed(digits)} ${unit}`

/**
 * Deterministic wobble in [-1, 1] from a seed. Freehand redline marks need to
 * look drawn by hand without moving every render.
 */
export function wobble(seed: string, i: number) {
  let h = 2166136261
  for (let k = 0; k < seed.length; k++) h = Math.imul(h ^ seed.charCodeAt(k), 16777619)
  h = Math.imul(h ^ i, 16777619)
  return (((h >>> 0) % 2000) / 1000) - 1
}
