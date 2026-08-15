# The bench kit

The electrical field's workspace: a schematic sheet plus the test gear you
measure it with. Import everything from `@/components/instruments/bench`.
`index.ts` carries the full conventions list; this is the map.

## Files

| file | what it gives you |
| --- | --- |
| `theme.ts` | `benchSurface` (the one class string that defines every token), `benchLabel`, `benchDigits`, `conductor`, `ink` |
| `SchematicSheet.tsx` | `BenchPanel` (the equipment shell) and `SchematicSheet` (fine grid, drawn border, title block bottom left, pass stamp top right) |
| `routing.ts` | `orthRoute`, `findHops`, `pathFromPts`, `routeLength` |
| `Wire.tsx` | `Wire`: right angles, hops, dead/live/fault, marching flow |
| `symbols.tsx` | source, lamp, switch, resistor, breaker, bus, transformer, ground, test point, junction dot, crosshair, `Silk` |
| `Oscilloscope.tsx` | graticule, divisions, per-division labels, sample-and-hold trace |
| `ProbeMeter.tsx` | the meter, the probe drawn on the sheet, `stepNode` for arrow keys |
| `Breaker.tsx` | `BreakerHandle`: three positions and a trip flag |
| `Scorch.tsx` | `ScorchedRun`, `ScorchSmudge` for anything that cooked |
| `Readouts.tsx` | `ToolSelector`, `SpecList`, `BenchVerdict`, `StatusLamp` |

## The five rules that make it one system

1. **One tool at a time.** `ToolSelector` says what is in the student's hand.
   A pin does whatever the held tool means, never two things at once.
2. **One cursor, one tab stop.** Arrow keys walk the sheet with `stepNode`,
   Enter uses the tool, Delete cuts at the cursor, Escape drops a pending pick.
   Do not scatter tab stops over a drawing.
3. **Values are measured, not printed.** The meter reads the ONE node the probe
   is on, COM on the minus rail, and speaks it through its live region. Deciding
   where to measure is the skill.
4. **Time goes on the scope.** Anything that moves over time gets a trace with
   divisions and per-division labels, never a bare number.
5. **Failure is physical first.** The breaker trips to mid position and shows
   its flag, the run that cooked gets char and soot, and only then does
   `BenchVerdict` say it in one sentence.

## Drawing

Conductors run in right angles, leave a pin along its lead, and hop at every
crossing. Wires join ONLY at pins: a filled junction dot is the one mark that
means joined. Parts are symbols with a designator above (LP1, SW1, CB2) and
plain words below. Pass `avoid` boxes and a stable `lane` (hash the conductor
id, never its index) to `orthRoute` so runs step around bodies and do not stack.

A schematic is not a scale drawing. If a game bills cable, it bills the physical
point-to-point run, not the length of the line on the sheet.

## House rules

- `benchSurface` goes on the panel root; children read `var(--bench-*)` with a
  fallback, so a missing token degrades instead of going black.
- Dark in both themes, a stop deeper at night.
- Motion: the flow overlay uses the app's `.wire-flow` class, which already
  stops under prefers-reduced-motion. Anything else checks `useReducedMotion`.
- Copy on the bench is lower case mono silkscreen; sentences live in the verdict.
