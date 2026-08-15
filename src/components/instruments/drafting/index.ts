/**
 * The drafting board: the civil field's workspace kit.
 *
 * A civil game is a structural drawing you are producing, not a canvas you are
 * playing on. The conventions every civil game follows:
 *
 * GROUND      Everything sits in a <DraftingSheet> carrying a <TitleBlock>.
 *             The title block is the signature: project, drawing (the level
 *             title), sheet number (S-, T-, Q- plus the level), scale in the
 *             reader's terms, what is being checked, revision count, status.
 *             Status is draft -> revise -> approved and nothing else.
 * INK         Only the sheet vars (see tokens.ts). No Tailwind palette colours
 *             inside a sheet, so light vellum and dark blueprint both hold.
 * CONTROLS    Instruments are <SheetTool> toggles on the sheet edge. Choices
 *             are a <StencilPalette> radio group, arrow keys included. The
 *             drawing field is driven by useSheetCursor: arrows step one grid
 *             module, enter commits at the cursor, escape lets go, delete
 *             removes. The <svg> takes the returned boardProps plus its own
 *             role, aria-label and aria-describedby instructions.
 * READINGS    Quantities are a <Schedule>, never a bar. Geometry is a
 *             <DimString> against a <ScaleBar>. Anything singled out gets a
 *             <Leader> to a lettered note. Prose verdicts are <NoteBlock>s
 *             inside the game's aria-live region.
 * VERDICTS    Failure is redline: <Redline> loops the member in red pencil,
 *             leaders out to the number that broke it, and a <RevisionStamp>
 *             lands while the title block flips to revise. Success is an
 *             <ApprovalStamp> and status approved. No green glow, no colour
 *             coded verdict beyond the red pencil and the blue check.
 * MOTION      Stamps and redlines are the only new animation, and both read
 *             useReducedMotion.
 */

export { DraftingSheet, TitleBlock, type SheetStatus } from './Sheet'
export { SnapGrid, DatumLine, CursorMark, useSheetCursor } from './Grid'
export { DimString, ScaleBar, Leader, Arrowhead } from './Dimension'
export { GroundHatch, PinSupport, RollerSupport, FixedSupport, LoadArrow, GridBubble, SectionMark } from './Symbols'
export { Redline, RevisionStamp, ApprovalStamp, RevisionTriangle } from './Redline'
export {
  Schedule,
  StencilPalette,
  DrawingKey,
  NoteBlock,
  SheetTool,
  type ScheduleColumn,
  type ScheduleRow,
  type ScheduleFoot,
  type StencilOption,
} from './Schedule'
export { INK, LETTER, PEN, TRACK, sheetVars, dimText, wobble } from './tokens'
