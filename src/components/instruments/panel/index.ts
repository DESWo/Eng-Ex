/**
 * The nuclear control board kit. Every nuclear game builds its workspace from
 * these, so the three of them read as one piece of equipment.
 * Conventions are in README.md next to this file.
 */
export { PanelSurface, PanelBay, Plate, DigitalWindow, Engraved } from './PanelSurface'
export { Gauge } from './Gauge'
export type { GaugeBand } from './Gauge'
export { AnnunciatorPanel } from './Annunciator'
export { useAnnunciators } from './useAnnunciators'
export type { AnnunciatorDef, AnnunciatorState, AnnunciatorStatus, AnnunciatorTile } from './useAnnunciators'
export { ChartRecorder } from './ChartRecorder'
export type { RecorderPen } from './ChartRecorder'
export { BankLever, IlluminatedButton, GuardedControl } from './Controls'
export { MimicBoard, MimicLamp } from './Mimic'
export { LAMP, INK, board, brushed, recessShadow, engravedClass, engravedStyle, digitClass, clamp01, polar, arcPath } from './tokens'
export type { LampTone, LampInk } from './tokens'
