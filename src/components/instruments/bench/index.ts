/**
 * THE BENCH KIT: a schematic and the test gear you measure it with.
 *
 * This is the electrical field's workspace. It is not a theme over the shared
 * card; it is a different piece of equipment with its own verbs. Every
 * electrical game imports from here and follows the conventions below, so a
 * student who learns the bench on one game already knows the next.
 *
 * ── The ground ────────────────────────────────────────────────────────────
 * `BenchPanel` is the equipment: dark anodized face, hairline bevel, case
 * screws, silkscreen header. It sits ON the cream page in light mode and drops
 * a stop at night. Instruments and sheets live inside one, never loose.
 * `SchematicSheet` is the drawing surface inside it: an 8-unit fine grid with a
 * 40-unit major, a drawn border, and a title block bottom right. It is an EDA
 * sheet, deliberately not drafting paper.
 *
 * ── How a control is operated ─────────────────────────────────────────────
 * 1. One tool at a time. `ToolSelector` says what is in the student's hand.
 *    Clicking a pin means whatever the held tool means, never two things.
 * 2. One cursor on the sheet, one tab stop. The sheet is a composite widget:
 *    arrow keys walk the cursor pin to pin with `stepNode`, Enter acts with the
 *    held tool, Escape drops a pending action. Do not scatter tab stops across
 *    a drawing; a mouse user clicks pins directly and gets the same verbs.
 * 3. Committing is physical. `BreakerHandle` is the only "run it" control on the
 *    bench. It throws, and it can throw itself back.
 *
 * ── How a reading is shown ────────────────────────────────────────────────
 * 4. Values are measured, not printed. `ProbeMeter` reads ONE node, the one the
 *    probe is on, with COM on the minus rail. Deciding where to measure is the
 *    skill. Do not print every value permanently on the sheet.
 * 5. Anything that moves over time goes on the `Oscilloscope`, never in a
 *    number: graticule, divisions, per-division labels, sample and hold trace.
 * 6. Every reading has a keyboard path: the meter carries an aria-live region
 *    that speaks the node and value whenever the probe moves or the circuit
 *    changes. Instrument faces are role="img" with the reading in the label.
 *
 * ── How success and failure are expressed ─────────────────────────────────
 * 7. State is in the conductor: dim ink dead, amber carrying, red faulted, with
 *    marching dashes for flow (reduced motion stops them, via `.wire-flow`).
 * 8. Failure is physical before it is textual. The breaker trips to the middle
 *    position and shows its flag; the run that cooked gets `ScorchedRun` char
 *    and soot. `BenchVerdict` then says it in one sentence, in a live region.
 * 9. Per-requirement state is a `SpecList` line with a lamp, never a chip row.
 * 10. Success stamps the sheet (`stamp` on `SchematicSheet`) and the shared
 *     level chrome takes it from there.
 *
 * ── Drawing rules ─────────────────────────────────────────────────────────
 * 11. Conductors run in right angles only (`orthRoute`), leave a pin along its
 *     lead, and hop at every crossing (`findHops`). Wires join ONLY at pins: a
 *     filled `JunctionDot` is the one mark that means joined, and a crossing
 *     never connects. A student should never have to guess.
 * 12. Parts are symbols, not pictures, from `symbols.tsx`, with a reference
 *     designator above (LP1, SW1, CB2) and plain words below.
 * 13. A schematic is not a scale drawing. If a game bills cable, it bills the
 *     physical point-to-point run, not the length of the line on the sheet.
 */

export { BenchPanel, SchematicSheet } from './SchematicSheet'
export { Wire, type WireState } from './Wire'
export { Oscilloscope } from './Oscilloscope'
export { ProbeMeter, ProbeTip, stepNode, type BenchNode, type MeterMode, type MeterReading } from './ProbeMeter'
export { BreakerHandle, type BreakerState } from './Breaker'
export { ScorchedRun, ScorchSmudge } from './Scorch'
export { BenchVerdict, SpecList, StatusLamp, ToolSelector } from './Readouts'
export {
  BreakerSymbol,
  BusSymbol,
  Crosshair,
  GroundSymbol,
  JunctionDot,
  LampSymbol,
  ResistorSymbol,
  SourceSymbol,
  SwitchSymbol,
  TestPoint,
  TransformerSymbol,
} from './symbols'
export { findHops, orthRoute, pathFromPts, routeLength, type Hop, type Lead, type Pt } from './routing'
export { benchDigits, benchLabel, benchSurface, conductor, ink, inkDim } from './theme'
