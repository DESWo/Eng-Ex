/**
 * Look of the nuclear control board.
 *
 * The board is dark in BOTH themes: it is a piece of equipment resting on the
 * notebook page, not a themed card. Light mode gets a slightly lighter slate so
 * it reads as painted steel rather than a hole cut in the paper.
 *
 * Everything here is a plain string or number, so Tailwind's scanner keeps the
 * classes and any nuclear game can import them.
 */

import type { CSSProperties } from 'react'

export type LampTone = 'red' | 'amber' | 'green' | 'white'

export interface LampInk {
  /** Lens color when the lamp is energised. */
  lit: string
  /** Halo painted behind a lit lens. */
  glow: string
  /** Lens color when dark. */
  off: string
  /** Engraved legend on a lit lens. */
  legendOn: string
  /** Engraved legend on a dark lens. */
  legendOff: string
}

/** Control-room lamp colors. Amber warns, red trips, green is normal, white is status. */
export const LAMP: Record<LampTone, LampInk> = {
  red: { lit: '#e0574a', glow: 'rgb(224 87 74 / 0.5)', off: '#3a2523', legendOn: '#2a0d0a', legendOff: '#c9a49e' },
  amber: { lit: '#e6a72e', glow: 'rgb(230 167 46 / 0.5)', off: '#3a3121', legendOn: '#2a1c00', legendOff: '#cbb590' },
  green: { lit: '#48a878', glow: 'rgb(72 168 120 / 0.45)', off: '#1f3129', legendOn: '#04210f', legendOff: '#9dc0ae' },
  white: { lit: '#dde4ea', glow: 'rgb(221 228 234 / 0.35)', off: '#2a3037', legendOn: '#12171c', legendOff: '#aab6c1' },
}

/** Board surfaces, as class strings. */
export const board = {
  /** The panel itself: brushed slate with a bezel. */
  panel: 'bg-[#2b3137] dark:bg-[#171b1f] border border-black/40 dark:border-black/60',
  /** A recessed sub-area of the board that instruments sit in. */
  bay: 'bg-[#20262b] dark:bg-[#101417] border border-black/40',
  /** A cut-out window: gauge faces, digital repeats, chart paper. */
  recess: 'bg-[#0e1215] border border-black/60',
  /** Hairline used between rows of the board. */
  divider: 'border-white/8',
}

/** Brushed-steel texture for the panel face. Vertical grain, very low contrast. */
export const brushed: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(90deg, rgb(255 255 255 / 0.022) 0 1px, rgb(0 0 0 / 0.03) 1px 3px),' +
    'linear-gradient(180deg, rgb(255 255 255 / 0.05), rgb(0 0 0 / 0.18))',
  boxShadow:
    'inset 0 1px 0 rgb(255 255 255 / 0.10), inset 0 -2px 6px rgb(0 0 0 / 0.45), 0 14px 30px -14px rgb(0 0 0 / 0.6)',
}

/** Inset shadow for anything cut into the board. */
export const recessShadow: CSSProperties = {
  boxShadow: 'inset 0 2px 6px rgb(0 0 0 / 0.65), inset 0 -1px 0 rgb(255 255 255 / 0.06)',
}

/** Engraved legend text: small, uppercase, wide letterspacing, cut into the metal. */
export const engravedClass =
  'font-body text-[10px] leading-tight font-semibold uppercase tracking-[0.18em] text-slate-400'

export const engravedStyle: CSSProperties = {
  textShadow: '0 1px 0 rgb(255 255 255 / 0.07), 0 -1px 0 rgb(0 0 0 / 0.6)',
}

/** Every measured number on the board is mono and tabular. */
export const digitClass = 'font-mono tabular-nums text-[#d8e2e6]'

/** Ink for schematic lines drawn on the board (mimic diagrams, chart rules). */
export const INK = {
  line: '#6c7a85',
  lineDim: '#3d474f',
  face: '#e7e2d6',
  faceDim: '#cdc7b9',
  paper: '#e9e4d7',
  paperRule: '#c3b8a3',
  text: '#93a1ac',
  textBright: '#d8e2e6',
}

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/** Point on a dial arc. 0 degrees is east and angles grow counter-clockwise. */
export function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) }
}

/** Arc path swept clockwise on screen, from `fromDeg` down to `toDeg`. */
export function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number) {
  const a = polar(cx, cy, r, fromDeg)
  const b = polar(cx, cy, r, toDeg)
  const large = Math.abs(fromDeg - toDeg) > 180 ? 1 : 0
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}
