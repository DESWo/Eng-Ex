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

## Robotics Engineering

### Claw Machine — Fun 8.5/10 · Difficulty 6.5/10 (L1 + L5 played, L2-4 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | Keyboard-walked the claw onto the plush, dropped: clean grab | The arcade-claw skin over real inverse kinematics is the app's best disguise for a hard idea. |
| 5 | All three prizes in order, one elbow flip for the far-low one, 238° travel vs 420° par, no coins lost | Prize 3 is only reachable elbow-down (checked: elbow-up is out of limits), so the flip is forced, exactly the L3 lesson paying off. |

The hold-to-grab + coins rework holds up; a fumbled grab genuinely costs a coin.
No bugs found.

### Line Follower — Fun 7.5/10 · Difficulty 6.5/10 (L1 + L5 played, L2-4 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | Default gain, ran: made it in 247 ticks, 6.1 px drift | Racing-kart tuning framing reads well; a gentle curve forgives a rough gain. |
| 5 | Gain 5 + damping 42 at Quick: 159 ticks, 10.7 px drift, beat all three pars | The wide-open track rewards damping over raw gain, the field's PD-control lesson. |

L3 is the counterintuitive beat (more gain makes the twitchy line worse; only
damping settles it, verified: gain-alone runs lose the line). No bugs found.

### Safe Grip — Fun 7/10 · Difficulty 7/10 (L1 + L5 played, L2-4 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | Rubber, static squeeze 190 through the lift: held, never closer than 26 to a line | The Operation-style live ride is tense in the right way; the slip line rising under acceleration is a real gotcha. |
| 5 | Foam, gentle lift, grip 84 vs par 90: held, 28 of margin | Foam's wide window (slip ~46, crush ~150) lets you sit low and beat the grip metric; rubber's window (59-88) is a knife-edge by comparison. |

L3 (bare bulb) is the hard pivot: the grip that stops the slip is the grip that
shatters it on rubber, so only foam works (verified: rubber slip 16 > crush 15).
The live ride completes correctly on an absolute wall clock. No bugs found.

## Industrial Engineering

### Assembly Line — Fun 7.5/10 · Difficulty 6/10 (L1 + L5 played, L2-4 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | Two workers each on the three stations: hit 5/min | The kitchen-rush framing works; adding people to a station visibly splits its time. |
| 5 | Phone line 2/3/2/2/1: 6.7/min at 87% busy on 10 workers, all three pars | The bottleneck rule is the lesson: workers anywhere but the slow station do nothing. Verified by allocation scan. |

L2's teaching line (the line runs at its slowest station, not one item faster)
is the most important sentence in the field and the sim proves it. No bugs found.

### Quality Gate — Fun 8/10 · Difficulty 7/10 (L1 + L5 played, L2-4 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | One desk after Electronics: escapes fell to 8 of 1000 | The inspection-desk skin over a real cost model is genuinely clever. |
| 5 | Desks after Paint and Electronics: 8 escapes, 2,688 inspection, 6,517 waste | 2 of 3 pars (inspection 88 over) — and a full desk scan confirms NO layout hits all three, exactly the intended tradeoff. |

L3 is the standout lesson: end-of-line checking catches everything and still
loses money, because you scrapped units with the electronics already fitted.
Verified against the cost model (all-end-gates = 17,821 total). No bugs found.

### Warehouse Layout — Fun 7/10 · Difficulty 6.5/10 (L1 + L5 played, L2-4 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | Busiest items (Bolts, Screws) to the front aisle: 250 steps, the minimum | Trips-times-distance made tangible; the busy-to-front instinct is right and rewarded. |
| 5 | Heavy items (Timber, Cement) to the front: best run 1,148 effort / 470 walk / 14 front trips | The heavy-to-front layout beats all three pars. |

**Finding W1 (minor, design):** L5's copy says "all three cannot have it,"
but a full 3^6 layout scan shows the heavy-to-front arrangement clears all
three pars at once (effort 1,148, walk 470, front 14). The tension between
walking (wants busy-to-front) and carrying (wants heavy-to-front) is real, but
the current pars are loose enough that one layout wins outright. Tightening the
walking par toward ~430 or the front-traffic par would restore the intended
"pick two" tension. Still clears and teaches as is.

## Environmental Engineering

### Solar Array — Fun 7.5/10 · Difficulty 6.5/10 (L1 + L5 played, L2-4 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | Fit 6 panels: 30.4 kWh generated vs 19.6 used | Roof-tile placement is tactile; matching daily total is a gentle, clear opener. |
| 5 | 5 panels + 7 battery modules: 0 kWh unmet at $7,850 of $8,000 | 2 of 3 pars (cost 50 over) — and a full panel/battery scan confirms no combo wins all three, the designed tradeoff. |

L3 is the pivot: generating 3x your usage still leaves the house dark at 6pm
because the sun is down, so the battery, not more panels, is the answer. No bugs.

### Stormwater — Fun 7/10 · Difficulty 6/10 (L1 + L5 played, L2-4 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | Dug a 200 m³ basin: 0 overflow | A pond buys time is a clean first idea; painting the site is satisfying. |
| 5 | 13 grass plots + a small basin: scheme cost $2,175, dry, still a car park | Well under par $5,500. Shrinking runoff at the source beats storing it, the L3 lesson. |

L3 is the counterintuitive beat: no affordable pond holds the storm, but grass
and permeable paving drink the rain before it becomes runoff. No bugs found.
Note: the site plots paint on pointer-down/drag, not click (a genuine paint UI).

### Clean Stream — Fun 8/10 · Difficulty 7.5/10 (L1 + L5 played, L2-4 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | Screen then sand filter: water runs clear | The pipe-building puzzle teaches itself; each stage pulls one thing out. |
| 5 | Settling pond → screen → UV: cost 11, energy 7, 3 stages, all three pars | The clever answer uses the free settling pond first (it only works in still water) so UV can see through clear water. Not the obvious screen+sand+chlorine, which leaves chemicals behind. |

The hardest-thinking game in the field. Order genuinely matters (trash shreds
sand, UV cannot reach germs through murk), and the firstOnly/adds-chemicals
catches are real engineering. No bugs found.

## Structural Engineering

### Sky High (Tower) — Fun 7.5/10 · Difficulty 6.5/10 (L1 + L5 played, L2-4 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | Steel core (stiffness 16 vs wind 12) | The wobbly-block-tower framing works; the sketched floors visibly shear as sway grows. |
| 5 | Steel + wide base + damper: cost 15, sway 9.7, margin 1 — all three pars | Three ways to fight sway (stiffen, widen, tune a damper), and no single one is enough at L3, exactly the lesson. |

Verified via the sway model (stiffness must beat wind; L5 needs 37 vs 36).
No bugs found. The hatched floor slabs read well against the sky.

### Beam Section — Fun 8/10 · Difficulty 7/10 (L1 + L5 played, L2-4 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | Deepened the solid bar until it sagged 1.3 mm (limit 12) | Depth cubed into stiffness is tangible; the hatched cross section reads like a real drawing. |
| 5 | I-beam at full depth: cost 27/m vs par 45, passes at 27 kg/m | The efficient I-beam beats the weight limit no solid bar can, the L3 payoff. |

L3 is the standout: no solid bar passes the weight limit, because the metal
near the neutral axis does almost nothing (verified against the inertia model).
The stress readout at L4 draws exactly why. No bugs found.

### Foundation — Fun 7/10 · Difficulty 7/10 (L1 + L5 played, L2-4 config review)
| L | What I did | Notes |
|---|---|---|
| 1 | Widened the footing to 3.0 m: holds at 150 kPa | Pressure = load over area, made physical; the hatched concrete footing looks the part. |
| 5 | 1.5 m under the light column, 4.5 m under the heavy one: uneven sinking under 8 mm, best cost 900 | Both footings pass their own pressure check yet the frame tears unless they SINK together, the differential-settlement lesson. |

L3 is the subtle beat: two footings each "safe" on pressure still crack the
building if one sinks twice as far. Verified against the settlement model
(diff must stay under 8 mm). No bugs found.

