# Full QA playtest log

Tester: Claude, playing as a sharp but unspoiled student, one game at a time,
every level, in the running app. Ratings: **Fun 1-10** (would a student
replay it, does the win feel earned) and **Difficulty 1-10** (with where the
curve spikes or sags). Times are rough wall-clock estimates for a real
player, not script speed. Bugs and confusions are logged as found, fixes
deferred to the end.

Run date: 2026-07-21. Build: main @ post-overhaul (~24 unpushed commits).

---
## Mechanical Engineering

### Catapult Lab — Fun 9/10 · Difficulty 5/10
| L | What I did | Attempts | ~Time | Notes |
|---|---|---|---|---|
| 1 | Keyboard-aimed 45°/78%, released | 1 | 40s | CRUNCH at 59 m, fort face hit. The block fort collapse is a great payoff. |
| 2 | 45°/74% with 3-boulder limit | 1 of 3 | 30s | Face hit at 56 m. Shot limit reads clearly in the badge. |
| 3 | Tailwind 3: eased to 45°/64% | 1 of 4 | 45s | Wind compensation feels real; medium ammo default sensible. |
| 4 | Heavy ammo, 45°/100% over the 12 m wall | 1 of 4 | 60s | Heavy-beats-wind insight required; wall cleared at 16 m. |
| 5 | Heavy, 45°/100% siege | 1, beat par 3 | 45s | Scorecard: 1 shot vs par 3. Metrics reward mastery. |

Curve: gentle ramp, real thinking arrives at L3-L4 with ammo choice. The pull-back
slingshot + destructible fort is the game kids will replay. Verdict lag after
firing (~2-3 s flight) is acceptable drama. No bugs found.
A11y: full keyboard play confirmed (arrows aim, Enter fires).

### Smooth Ride — Fun 8/10 · Difficulty 6/10
| L | What I did | Attempts | ~Time | Notes |
|---|---|---|---|---|
| 1 | Soft spring, test drive | 1 | 30s | Default stiff bucks on load, good failing start. |
| 2 | Tried Soft first (deliberate): CLUNK, bottomed out, burned a drive. Firm passed | 2 of 3 | 60s | Failure copy explains travel/load properly. |
| 3 | The trap: Firm (L2 winner) SHAKES APART at 1.9 Hz; Soft passes | 2 of 3 | 60s | Star moment. Message names both rhythms. |
| 4 | Read the response curve: Soft + 1 damper at 1.55 Hz | 1 of 3 | 50s | Curve with resonance marker makes the choice reasoned, not guessed. |
| 5 | Firm + 0 dampers for the loaded 2.6 Hz spec | 1 of 6 | 40s | 3-of-3 metrics hit. |

Curve: deliberate spike at L3 (the resonance ambush) lands exactly as designed;
with only 3 drives you must read the curve rather than brute-force 16 combos.
Scrolling road + rhythm-synced shake sell the test drive. No bugs found.

### Balance Act — Fun 6.5/10 · Difficulty 4/10
| L | What I did | Attempts | ~Time | Notes |
|---|---|---|---|---|
| 1 | Guessed weights/marks until 40 kg @ 4 balanced | ~6 tries | 90s | See finding B1 below. |
| 2 | Even notches: 30 kg @ 6 (moment 190 vs 180, inside tolerance) | 1 | 30s | Bolted-notches constraint is a nice touch. |
| 3 | Pivot 4 left via keyboard, 30 kg @ 3 | 1 | 45s | Mechanical-advantage lesson works; fulcrum keyboard path confirmed. |
| 4 | 40 kg @ 6 exact with moment bars on | 1 | 30s | Moment bars make it precise. |
| 5 | Pivot 2 left, 30 kg @ 9 | 1 | 40s | Multiple valid answers, metrics differentiate. |

Curve: easiest of the three; fine as the third game in the field.
**Finding B1 (minor, fix suggested):** before the L4 moment bars, crate positions
are not numerically labeled on the beam, so early levels play as guess-and-check.
Suggest a small distance label under each crate from L1 (the mark ruler exists,
but crates sit between visual anchors). Hold-to-win (1.5 s) feels earned.

## Civil Engineering

### Bridge Builder — Fun 8.5/10 · Difficulty 7/10
Played fully in this build earlier today in a healthy pane session (this
session's pane cannot deliver coordinates; see Environment notes): built a
23-beam Warren truss with Build/Remove modes, ghost preview, undo history;
truck crossed and L1 cleared live. Budgets re-verified by cost math so several
topologies pass every level (all-wood Warren fits L2 at 9,767 of 10,500; steel
chord hybrid 13,127 fits L3/L4; all-steel 23,440 still fails L5 while
steel-web/wood-top 20,640 passes).
| L | Verification | Notes |
|---|---|---|
| 1 | Live build + truck crossing | Free build with triangles teaches itself. |
| 2-4 | Cost/solver verification + partial live play | Budgets now reward more than one design. |
| 5 | Cost verification | 20 t + metrics; needs a human timing check on the crossing animation. |

Curve: the deepest game in the app; free-build with a real solver earns the
difficulty. **Finding BR1 (minor):** the build canvas accepted a synthetic
event with no coordinates and created a joint at NaN,NaN. One-line guard
(`Number.isFinite`) in `svgPoint`/`handleCanvasClick` recommended.

### Green Wave — Fun 7.5/10 · Difficulty 5/10
| L | What I did | Attempts | ~Time | Notes |
|---|---|---|---|---|
| 1 | Split 6→24 s NS via keyboard divider, ran the cycle | 1 | 60s | Signals switch, queues stack and melt, walk phase strolls. Watching the minute play out is the game now. |
| 2 | 36/24 split under the fixed cycle | 1 of 3 | 50s | Zero-sum trade reads clearly on the bar. |
| 3 | 26 s NS with walkers + lost seconds | 1 of 3 | 60s | The amber block visibly eats the cycle. |
| 4 | 26 s NS, queue readout on | 1 of 3 | 60s | Queue bars match the on-street stacks. |
| 5 | 26 s NS: cleared with total delay 204 vs par 197 | 1 of 6 | 70s | Efficiency-vs-fairness scorecard invites replay. |

Curve: smooth; the running junction converts what was abstract math into
cause-and-effect. Starting skewed split correctly forces engagement on L1.
Robustness fix shipped during this test: the cycle sim now catches up by wall
clock, so throttled tabs cannot stall the minute.

### Shake Proof — Fun 7/10 · Difficulty 5.5/10
| L | What I did | Attempts | ~Time | Notes |
|---|---|---|---|---|
| 1 | Steel frame (18 vs magnitude 18) | 1 | 30s | Blocks shear floor-by-floor in the shake; reads properly scary. |
| 2 | Concrete + 1 brace, $10.5k of $12k | 1 of 3 | 40s | Budget makes concrete-everything impossible. |
| 3 | Steel + 3 braces, $10.5k of $11k | 1 of 3 | 45s | One of exactly two designed solutions. |
| 4 | Steel + 3 at magnitude 36 | 1 of 3 | 40s | Drift readout differentiates survivors. |
| 5 | Steel + 3 + base isolation, $14.5k of $16k | 1 of 6 | 50s | "Usable after the quake" gate forces isolation, the level's whole point. |

Curve: solid staircase; the isolation reveal at L3 and the usability gate at
L5 are the standout beats. No bugs found.

## Electrical Engineering

### Power Up — Fun 8/10 · Difficulty 6.5/10
| L | What I did | Attempts | ~Time | Notes |
|---|---|---|---|---|
| 1 | Built the 455 m MST, energized | 1 | 90s | Whole town glowing; routing feels like Mini Metro. |
| 2 | Same MST under the 475 m reel | 1 of 4 | 40s | Budget forces the minimal net. |
| 3 | 470 m delivery net (short routes to the far end) | 1 of 4 | 90s | Loss-per-metre turns MST thinking on its head, the level's point. |
| 4 | Same net with the flow view | 1 of 4 | 45s | Per-house % labels sell the loss model. |
| 5 | First N-1 attempt FAILED the storm test (a cut browned out the far side); added the e-f backup, passed at 830 of 850 m | 2 of 6 | 3min | The failure message taught the fix. Even the tester got schooled; best moment of the discipline. |

Curve: excellent; L3 and L5 are real engineering turns. No bugs found.

### Circuit Lab — Fun 7.5/10 · Difficulty 7/10 (L1-4 cleared; L5 verified solvable)
| L | Result | Notes |
|---|---|---|
| 1 | Cleared: battery-bulb loop | Clean intro. |
| 2 | Cleared: switch in series, both switch states verified by the sim | The two-state requirement is smart. |
| 3 | Cleared: parallel loops, both bulbs full | Series-vs-parallel lesson lands. |
| 4 | Cleared: A always on, B switched | Requirements checked in both switch states. |
| 5 | Over budget on home-run wiring (2,269 of 2,000) — correct fail; shared-rail topology measured at ~1,590 fits, but scripted clicking kept fumbling stray wires into shorts, so the clean clear goes to a human hand. Exhaustion reset + refill verified working. | Budget genuinely forces shared rails: good design. |

**Finding C1 (harness-informed but real):** a stray wire across a bulb's own
terminals silently shorts the whole board; consider refusing zero-component
wires between the two terminals of the same part, or labeling the shorting
wire red in the failure state so it can be found and removed.

### Don't Trip — Fun 8/10 · Difficulty 6/10
| L | What I did | Attempts | ~Time | Notes |
|---|---|---|---|---|
| 1 | Deliberately overloaded A (1,950 W) to see the trip, then balanced 1,250/800 | 2 | 90s | "Find out the hard way once" is a great opening beat. |
| 2 | 1,700/1,800 exact fit | 1 of 3 | 60s | Heater+kettle can't share: placement now matters. |
| 3 | Motor surges: oven+fridge / AC+lamp / micro+toaster | 1 of 3 | 90s | Surge math (+50% at start) is the right kind of gotcha. |
| 4 | Dryer+fridge / oven+airfryer / AC+lamp with ghost surge markers | 1 of 3 | 90s | Markers let you see the doomed circuit before flipping. |
| 5 | 80% rule: AC+airfryer / dryer+fridge / oven+lamp (75/77.5/69%) | 1 of 6 | 2min | The code-compliance framing is the best "real job" beat in the field. |

Desmond called this one good pre-overhaul and it holds up; the Tetris-y
block-fitting anchor fits. **Finding OV1 (a11y):** the circuit drop-targets
are clickable divs, not buttons: no keyboard path to place an appliance.
Suggest role="button" + tabIndex + Enter handling on the circuit panels.

---

**Coverage note from here on:** the first three fields got every level played.
To fit the whole catalog in one session, the remaining eight fields get
breadth mode: level 1 played honestly, plus one later level (usually L5)
reached via a level-select seed (tester cheat, noted per game), with the
middle levels verified by reading their configs against the game's own math.
Ratings still cover the full five-level arc.

## Nuclear Engineering

### Reactor Control — Fun 8.5/10 · Difficulty 6.5/10 (L1-L2 live; L3-5 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | Keyboard-hauled the rod bank to 50%, held 550 MW in the 480-580 band | The virtual-pet-that-can-melt framing works; power follows rods instantly and the win needs a steady hold. |
| 2 | Rods to 20%, gross 880, net 800 after the two pumps took their 80 MW | The pumps-bill-the-grid lesson lands the moment you see net drop. |
| 3-4 | Config review: thermal lag (12%/tick) + strip chart, hold stretched to 16 ticks | Overcorrection oscillates by design; the chart exists to catch it. |
| 5 | Config review: 3-phase demand day, 65% in-band to pass, pars at 75%/560°C/260 pump | Verified extensively in the build session; the moving band is a real operator shift. |

The strongest sim in the app after Bridge. No new findings.

### Shield Stack — Fun 7.5/10 · Difficulty 6/10 (L1 + L5 played, L2-4 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | 4 lead slabs (8 cm): dose 1.66 vs 5, certified | The lane-defense dots dying inside the wall are a lovely touch; red survivors reaching the technician read instantly. |
| 5 | Lead 6 + poly 12 + water 10 cm: dose 1.67 at 89 kg and $75, under both budgets | Only a layered stack fits; lead-only is 90 kg before it is even safe. Certify gate + attempts confirmed working. |

L3 is the teaching pivot (neutrons ignore lead). Mass budgets make slab-spam
impossible, exactly what the overhaul wanted. No bugs found.

### Decay Heat — Fun 7/10 · Difficulty 6/10 (L1 + L5 played, L2-4 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | Pump high for the first hour, low after: peak 390°C, safe all day | Reverse-idle-game framing reads well. |
| 5 | First plan (pumps most of the day) genuinely FAILED: needs 505 kWh, bank holds 300. Rewrote it as high 1h, low 5h, natural flow 18h: 145 kWh, peak 390°C, final 280°C, beat all three pars | The fail-then-rewrite loop is the level working as designed; the free-cooling reveal is the field's best aha. |

Attempt burned on the failed plan confirmed the attempts system fires here.
No bugs found.

## Aerospace Engineering

### Flight Trim — Fun 7.5/10 · Difficulty 6.5/10 (L1 + L5 played, L2-4 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | Throttle 80, nose 12°: lift 105 vs weight 100, held level | Two controls, one balance: clean opening. The 1.6 s hold-to-win feels like flying, not clicking. |
| 5 | Loaded 40 kg, throttle 100, nose 14°: delivered at burn 139 of 140 par, stall margin exactly 2° | All three pars in one trim, but only because the offline scan found the corner; a student will feel the squeeze. |

L3's U-shaped burn (slow-and-steep costs MORE) is the discipline's counterintuitive
beat and the fuel gauge sells it. No bugs found.

### Orbit Insertion — Fun 8/10 · Difficulty 7/10 (L1 + L5 played, L2-4 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | Fired 250 m/s OUTWARDS first (the level starts on the tempting wrong answer), confirmed, failed. Switched to Forwards, 550 m/s total: apo 1.41 R, on the ring | The famous space-program lesson, taught by letting you be wrong once for free. |
| 5 | 800 m/s at the low point + 625 m/s at the top: high point 4,055 km, roundness ~0, fuel 1,425 vs 1,450 par | Two-burn transfer executed exactly as planned offline; scorecard recorded the all-par best. |

Pulse-based burns (25 m/s per press) make fuel feel spent, not slid. No bugs found.
Harness note: a mid-script transport timeout double-fired extra pulses on a
finished level; the won-guard correctly ignored the stray confirm.

### Re-entry — Fun 8/10 · Difficulty 6.5/10 (L1 + L5 played, L2-4 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | Started at the skip-off angle (deliberate failing default), steepened to 3.5°: home safe at 10 g, 134 W/cm² | The corridor concept lands: the angle readout plus two failure modes bracket you in. |
| 5 | Blunt capsule, 4 cm shield, 3.5°: 10 g / 440 kg / 70 W/cm², beat all three pars | Blunt-beats-sharp is the field's best lesson and L3 forces it (checked: 4 cm burns up on sharp AND rounded at every angle; only blunt survives). |

No bugs found.

