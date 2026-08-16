/**
 * Bench tokens.
 *
 * The bench is a piece of test equipment sitting ON the page, so it is dark in
 * both themes. `benchSurface` is the one class string that defines every color
 * the kit reads; put it on the panel root and every child resolves its own
 * colors from there. At night the face drops a stop and the silkscreen dims, so
 * a lit instrument never glares on a dark page.
 *
 * Every consumer reads these through `var(--bench-x, fallback)`, so a missing
 * token degrades to a sane color instead of a black hole.
 */
export const benchSurface = [
  // panel face and the recessed well the sheet and screens sit in
  '[--bench-face:#1c1a22]',
  'dark:[--bench-face:#100f16]',
  '[--bench-recess:#131218]',
  'dark:[--bench-recess:#0a090e]',
  '[--bench-edge:rgba(255,255,255,0.13)]',
  'dark:[--bench-edge:rgba(255,255,255,0.08)]',
  // silkscreen and schematic ink
  '[--bench-ink:#eae7e3]',
  'dark:[--bench-ink:#d6d2cd]',
  '[--bench-dim:#a29b93]',
  'dark:[--bench-dim:#928b84]',
  // conductor states
  '[--bench-live:#f6bf4a]',
  '[--bench-hot:#fde047]',
  '[--bench-fault:#ff6b5c]',
  '[--bench-char:#40140c]',
  // instrument faces
  '[--bench-trace:#6ef2a6]',
  '[--bench-lcd:#101c18]',
  'dark:[--bench-lcd:#0a1512]',
  '[--bench-probe:#e5484d]',
  // sheet grid
  '[--bench-grid:rgba(255,255,255,0.055)]',
  'dark:[--bench-grid:rgba(255,255,255,0.038)]',
  '[--bench-grid-major:rgba(255,255,255,0.115)]',
  'dark:[--bench-grid-major:rgba(255,255,255,0.08)]',
].join(' ')

/** Silkscreen lettering: mono, small, letterspaced, always uppercase. */
export const benchLabel = 'font-mono text-[10px] font-semibold uppercase tracking-[0.16em]'

/** Measured numbers on an instrument face. */
export const benchDigits = 'font-mono tabular-nums'

/** Color a conductor by what it is doing. */
export const conductor = {
  dead: 'var(--bench-dim, #a29b93)',
  live: 'var(--bench-live, #f6bf4a)',
  fault: 'var(--bench-fault, #ff6b5c)',
} as const

export const ink = 'var(--bench-ink, #eae7e3)'
export const inkDim = 'var(--bench-dim, #a29b93)'
