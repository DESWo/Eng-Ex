# Nuclear control board kit

The workspace for every nuclear game. Not a theme: a set of instruments with
their own interaction verbs. A student who has just come from the bridge should
feel they picked up different equipment.

The reference implementation is `src/challenges/nuclear/ReactorChallenge.tsx`.
Read it before converting `ShieldChallenge` or `DecayHeatChallenge`.

## The rules of this field

**The board is dark in both themes.** It is equipment resting on the notebook
page. Never add `dark:` variants to panel internals; the kit already picks its
own two shades and everything inside it is tuned for a dark face. The page
around it (brief text, `Card`, `LevelHeader`, `Scorecard`, `LevelComplete`)
stays exactly as the rest of the app has it.

**Values are displayed on instruments, never on bars.** A continuously varying
quantity goes on a `Gauge`. A quantity over time goes on the `ChartRecorder`. A
fixed number for the run (a budget, a limit, a setpoint) goes on a `Plate`. A
current number that is not worth a dial goes in a `DigitalWindow`. Do not use
`Meter`, `ProgressBar` or a coloured pill in a nuclear game.

**Trouble is announced by latching annunciators, never by turning a readout
red.** A tile that trips stays lit after the condition clears and is cleared
only by the acknowledge button. That latch is the point: it teaches that a
control room remembers what happened while you were looking elsewhere.

**Controls are physical.** Continuous settings are a `BankLever` you haul.
Discrete settings are `IlluminatedButton` caps that light when selected.
Anything destructive or irreversible is a `GuardedControl`: guard up first, then
the button.

**Copy is operator copy.** Legends are two or three words, sentence case in the
source (the CSS uppercases them), no punctuation. Status sentences are plain
second person. No em dashes. Exclamation marks only for in-game events, e.g.
"Meltdown!".

## Success and failure

- Success: the plant status line turns mint (`text-[#8fe3c4]`), the shared
  `Confetti` and `LevelComplete` do the celebrating. No new win chrome.
- Failure: the status line turns salmon (`text-[#f08678]`) and the matching
  annunciator latches red. Nothing shakes, nothing flashes full screen.
- Warning: amber annunciator plus an amber `tone` on the affected digits. The
  needle itself never changes colour, only the band it sits in.

## Primitives

| Piece | What it is | Keyboard |
| --- | --- | --- |
| `PanelSurface` | The board: brushed slate, bezel, screws, engraved nameplate. `header` takes plates. | n/a |
| `PanelBay` | A recessed group with an engraved legend, `right` for digital repeats. | n/a |
| `Plate` / `DigitalWindow` / `Engraved` | Stamped plate, cut window with mono digits, engraved label. | n/a |
| `Gauge` | Needle on a 220° arc, numbered scale, coloured bands, digital repeat. Needle lags and settles; snaps under reduced motion. | `role="meter"` with `aria-valuetext`, not focusable |
| `useAnnunciators` + `AnnunciatorPanel` | Latching alarm windows plus the ack button. | Ack is a button; each tile carries its state in `sr-only` text; new alarms go through one polite live region |
| `ChartRecorder` | Pens on ruled paper, newest sample at the right edge. | `role="img"` with a sentence summary |
| `BankLever` | Dragged handle in a slot with detent marks. | Arrows, shift+arrows, PageUp/Down, Home/End, `role="slider"` |
| `IlluminatedButton` | Illuminated pushbutton cap. | Native button, `aria-pressed` for mode banks |
| `GuardedControl` | Emergency control under a hinged guard that falls shut. | Two buttons: lift guard, then fire |
| `MimicBoard` / `MimicLamp` | The plant line diagram cut into the board, plus indicator lamps. | `role="img"` with a live summary |

## Wiring the annunciators

```tsx
const ALARMS: AnnunciatorDef[] = [
  { id: 'dose-high', legend: 'Dose above limit', tone: 'red' },
]

// live conditions, read off the same numbers the student sees
const alarms = useAnnunciators(ALARMS, { 'dose-high': dose > setup.safeDose })

// latches belong to one run
useEffect(() => { alarms.reset() }, [lv.level.n, alarms.reset])
```

Keep `ALARMS` at module scope so its identity is stable. The hook reads defs and
conditions through refs and keys its effect on the bit pattern, so a 300 ms tick
does not refire it. Call `reset()` on a level change and on any control that
starts the run over.

## Things not to do

- Do not change any sim constant, threshold, par or attempts allowance to suit
  the board. Presentation only. `ReactorChallenge`'s tick loop is byte identical
  to what it was before the conversion.
- Do not let an alarm condition feed back into the sim. Alarms read state, they
  never write it.
- Do not put a live region on anything that updates every tick. One polite
  region for the status sentence, one inside `AnnunciatorPanel`, and that is it.
- Do not snap a `BankLever` to its detents. Detents are marks the handle clicks
  past, so mouse and keyboard reach exactly the same values a slider would.
