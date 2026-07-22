/**
 * The app's sound effects, synthesized in the browser.
 *
 * Every sound here is built from oscillators and filtered noise rather than
 * loaded from an audio file. That keeps the whole kit at zero bytes of assets,
 * works offline, and lets each effect be tuned by editing numbers instead of
 * hunting for a new sample.
 *
 * Nothing makes a sound until the player has interacted with the page: browsers
 * refuse to start an AudioContext before a gesture, so the context is created
 * lazily on the first play() call.
 */

const MUTE_KEY = 'ee:muted'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null
let muted = readMuted()
const listeners = new Set<(muted: boolean) => void>()

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

/** Create the audio graph on demand. Returns null if the browser refuses. */
function audio() {
  if (muted) return null
  if (ctx) return { ctx, master: master! }
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
    // A second of white noise, reused by every percussive sound.
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return { ctx, master }
  } catch {
    return null
  }
}

/** A single pitched blip with an exponential decay. */
function tone(
  at: number,
  freq: number,
  dur: number,
  gain: number,
  type: OscillatorType = 'sine',
  bendTo?: number,
) {
  const a = audio()
  if (!a) return
  const osc = a.ctx.createOscillator()
  const env = a.ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, at)
  if (bendTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, bendTo), at + dur)
  env.gain.setValueAtTime(0, at)
  env.gain.linearRampToValueAtTime(gain, at + 0.008)
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(env).connect(a.master)
  osc.start(at)
  osc.stop(at + dur + 0.02)
}

/** A burst of noise shaped by a filter: thuds, crunches, whooshes. */
function noise(
  at: number,
  dur: number,
  gain: number,
  filter: BiquadFilterType,
  freq: number,
  sweepTo?: number,
) {
  const a = audio()
  if (!a || !noiseBuffer) return
  const src = a.ctx.createBufferSource()
  src.buffer = noiseBuffer
  const biq = a.ctx.createBiquadFilter()
  biq.type = filter
  biq.frequency.setValueAtTime(freq, at)
  if (sweepTo !== undefined) biq.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), at + dur)
  biq.Q.value = 1
  const env = a.ctx.createGain()
  env.gain.setValueAtTime(0, at)
  env.gain.linearRampToValueAtTime(gain, at + 0.01)
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(biq).connect(env).connect(a.master)
  src.start(at)
  src.stop(at + dur + 0.02)
}

/**
 * The kit. Each entry schedules its own little arrangement relative to `t`,
 * the moment the sound starts.
 */
const KIT = {
  /** Light tick for picking something up or switching a control. */
  click: (t: number) => tone(t, 880, 0.05, 0.12, 'triangle', 660),
  /** Something set down on the board. */
  place: (t: number) => {
    tone(t, 320, 0.09, 0.16, 'sine', 220)
    noise(t, 0.06, 0.06, 'bandpass', 1600)
  },
  /** A level cleared: a bright three-note rise. */
  levelClear: (t: number) => {
    tone(t, 523, 0.16, 0.16, 'triangle')
    tone(t + 0.1, 659, 0.16, 0.16, 'triangle')
    tone(t + 0.2, 784, 0.42, 0.18, 'triangle')
    tone(t + 0.2, 1047, 0.42, 0.08, 'sine')
  },
  /** A smaller win, for a step that went right without finishing the level. */
  success: (t: number) => {
    tone(t, 659, 0.12, 0.14, 'triangle')
    tone(t + 0.08, 988, 0.24, 0.14, 'triangle')
  },
  /** A test that failed. Low, short, not punishing. */
  fail: (t: number) => {
    tone(t, 220, 0.22, 0.14, 'square', 110)
    noise(t, 0.18, 0.05, 'lowpass', 800, 200)
  },
  /** Out of attempts: the bench gets cleared. */
  reset: (t: number) => {
    noise(t, 0.3, 0.08, 'highpass', 400, 2400)
    tone(t + 0.05, 180, 0.28, 0.1, 'sine', 90)
  },
  /** The catapult arm releasing. */
  whoosh: (t: number) => noise(t, 0.35, 0.12, 'bandpass', 400, 2200),
  /** A heavy object landing on dirt. */
  thud: (t: number) => {
    tone(t, 90, 0.22, 0.3, 'sine', 40)
    noise(t, 0.16, 0.14, 'lowpass', 500, 120)
  },
  /** Timber and stone coming apart. */
  crunch: (t: number) => {
    noise(t, 0.5, 0.2, 'bandpass', 900, 220)
    noise(t + 0.09, 0.36, 0.13, 'bandpass', 1500, 400)
    tone(t + 0.02, 140, 0.3, 0.12, 'square', 60)
  },
  /** Arcade coin drop. */
  coin: (t: number) => {
    tone(t, 988, 0.08, 0.14, 'square')
    tone(t + 0.07, 1319, 0.22, 0.13, 'square')
  },
  /** A breaker tripping, or any electrical fault. */
  zap: (t: number) => {
    noise(t, 0.14, 0.18, 'highpass', 2000)
    tone(t, 140, 0.2, 0.16, 'sawtooth', 50)
  },
  /** Servo movement, for the arm and gripper. */
  servo: (t: number) => tone(t, 420, 0.14, 0.07, 'sawtooth', 300),
}

export type SoundName = keyof typeof KIT

/** Play one effect. Safe to call anywhere; does nothing when muted. */
export function playSound(name: SoundName) {
  const a = audio()
  if (!a) return
  // A tab that was backgrounded can come back with the context suspended.
  if (a.ctx.state === 'suspended') void a.ctx.resume()
  KIT[name](a.ctx.currentTime + 0.01)
}

export function isMuted() {
  return muted
}

export function setMuted(next: boolean) {
  muted = next
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0')
  } catch {
    /* storage can be unavailable; the toggle still works for this session */
  }
  if (next && ctx) void ctx.suspend()
  else if (!next && ctx) void ctx.resume()
  listeners.forEach((fn) => fn(next))
}

/** Subscribe to mute changes, for the navbar toggle. */
export function onMuteChange(fn: (muted: boolean) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
