# Engineering Explorer

A playful web app that helps middle and high school students discover which
engineering discipline they enjoy by solving interactive challenges.

Not a school replacement. Not a test. Just exploration.

## Tech stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4 (class based dark mode)
- Framer Motion
- React Router
- lucide-react icons
- No backend. Everything persists to localStorage under the `ee:` prefix.
  Firebase is planned for real accounts later; it would slot in behind
  `src/lib/profile.ts` without touching the games.

## Getting started

```bash
npm install
npm run dev      # start the dev server on http://localhost:5173
npm run build    # typecheck + production build
npm run preview  # preview the production build
```

## How the app works

Three core disciplines (Mechanical, Civil, Electrical) are open from the
start. Nine branch fields (Aerospace, Industrial, Robotics, Environmental,
Structural, Nuclear, Systems, Computer, Chemical) unlock once all three core
fields are fully explored. Teachers can open every field without playing
through them: add `?preview=1` to any URL, or use the toggle on `/teacher`.
Every field follows the same five step flow:

1. **Learn**: a plain language intro plus a video placeholder.
2. **Play**: three games. Beating level 1 of any game unlocks the next step.
3. **Reflect**: three quick questions (enjoyment, difficulty, try another?).
4. **Why it works**: the engineering idea behind each game, in simple words.
5. **Try it at home**: a real-world DIY project that mirrors a challenge,
   with materials, steps, an SVG build diagram, an experiment, and a safety
   note.

### Levels

Every game runs five levels deep, and each level adds exactly one new idea:

1. **Play**: no constraints, win fast, feel the mechanic.
2. **Understand**: the first constraint (a budget, a limit, a deadline).
3. **Analyze**: the counterintuitive engineering concept. Each game's level 3
   is designed so the obvious answer fails: the stiff suspension that won
   level 2 resonates to pieces on the washboard road, lead stops gamma but
   not neutrons, checking quality at the end of the line costs more than not
   checking at all.
4. **Visualize**: an overlay that draws the physics the sim was already
   computing (force diagrams, response curves, queue bars).
5. **Optimize**: three competing metrics, a personal best scorecard, and no
   single right answer.

Mastery is counted in levels: 3 games x 5 levels = 15 per field. The landing
cards and the in-flow challenge picker both show live level progress, and the
tier chip reads Explored / Solid / Mastered (Solid means every game in the
field is past level 3).

### The games

| Discipline | Games |
| --- | --- |
| Mechanical | Catapult Lab, Smooth Ride (suspension resonance), Balance Act |
| Civil | Bridge Builder (real truss solver), Green Wave, Shake Proof |
| Electrical | Power Up (routing + line loss + N-1), Circuit Lab, Don't Trip |
| Aerospace | Trim for Flight, Orbit Insertion, Re-entry |
| Industrial | Assembly Line, Quality Gate, Warehouse Layout |
| Robotics | Robot Arm (real inverse kinematics), Line Follower, Safe Grip |
| Environmental | Clean Stream, Solar Array, Stormwater |
| Structural | Sky High, Beam Section, Foundation |
| Nuclear | Reactor Control (live tick sim), Shield Stack, Decay Heat |
| Systems | Mission Budget, Backup Plan, Critical Path |
| Computer | Logic Lab, Binary Bulbs, Error Check |
| Chemical | Sweet Spot (rate vs equilibrium), Counterflow, The Right Dose |

Several games run genuine simulations: Bridge Builder solves K u = f over a
2D truss stiffness matrix per truck position (`src/challenges/civil/truss.ts`),
Smooth Ride evaluates 1-DOF transmissibility, Robot Arm solves closed-form
inverse kinematics, and Reactor Room is a lagged feedback sim on a 300 ms
tick.

### No sliders

Every game uses a direct-manipulation mechanic instead of sliders: drag the
launch arrow out of the catapult, drag the fulcrum, drag the rod bank, paint
surfaces onto a site grid, click packet slots. `src/hooks/useSvgDrag.ts`
converts pointer events to SVG viewBox coordinates. Every draggable handle
also has a keyboard path (`role="slider"` semantics with arrow keys).

### Profiles

The navbar has a sign-in dialog that takes only an email. There is
deliberately no password: with no server, a password would be security
theatre, and the dialog says so. Signed-in saves live under
`ee:u:<email>:<key>`, guests under bare `ee:<key>`, and guest work moves into
a brand-new account on first sign-in. Theme stays per browser.

Nothing syncs, because there is no server. To move progress to another
computer, the Backup dialog exports a save file or a **transfer code**: the
same save as one line of text you can paste anywhere and paste back later.
Restores are validated key by key and write nothing at all if the file is
damaged, so a half-copied code can never overwrite good progress.

### For teachers

- `/teacher` prints a progress report for whoever is saved on the device:
  levels and stars per field, a per-game breakdown, and the reflection
  answers. It has its own print stylesheet.
- `?preview=1` on any URL unlocks every field for evaluation without touching
  a student's saved work.
- `/privacy` states the posture: no server, no analytics, no third-party
  requests at all (the fonts are self-hosted from `public/fonts`).

## Project structure

```
src/
  data/
    disciplines.ts        <- ALL discipline content and copy. Edit this first.
  challenges/
    registry.ts           <- challenge id -> lazy component + preload
    mechanical/ civil/ electrical/ aerospace/ industrial/ robotics/
    environmental/ structural/ nuclear/ systems/ computer/ chemical/
  components/
    ui/                   <- Button, Card, Badge, Meter, Confetti, etc.
    level/                <- LevelRail, ConceptCard, InsightToggle, Scorecard, LevelShell
    auth/                 <- SignInDialog
    diy/                  <- SVG build diagrams for the DIY projects
    layout/               <- Navbar, Footer
    landing/              <- Hero, HowItWorks, DisciplineCard, DisciplineGrid
    flow/                 <- FlowStepper + the five step components
  pages/                  <- LandingPage, DisciplinePage, AboutPage,
                             TeacherPage, PrivacyPage, NotFoundPage
  hooks/                  <- useTheme, useProgress, useLevels, useLevelCounts,
                             useProfile, useAttempts, useSvgDrag
  lib/                    <- types, storage, mastery, profile, saveFile, accent,
                             preview, sound, animations, utils
```

Games are code-split: each one loads as its own chunk the first time it is
opened, and hovering a challenge chip preloads its chunk.

## Editing the games

Every challenge keeps its tuning knobs at the top of its file, clearly
marked: level definitions, budgets, physics constants, wattages, and the copy
for wins and failures. Changing difficulty is a one line edit. The DIY
projects, intros, and "why it works" content all live in
`src/data/disciplines.ts`.

## Adding a new challenge

1. Build the component in `src/challenges/<field>/`. It receives one prop,
   `onComplete`, called on the first level clear. Use `useLevels` for the
   five level arc and the `components/level/` chrome for the rail and cards.
2. Register it in `src/challenges/registry.ts` (lazy import + named export).
3. Add a `ChallengeRef` (id, title, goal, why points) to that field's entry
   in `src/data/disciplines.ts`.

## Adding a new discipline

Add an entry to `src/data/disciplines.ts` (copy an existing one) and build
its challenges as above. Branch fields set `tier: 'more'` and a `parent`
slug. The landing card, routing, theming, gating, and the five step flow are
all generated from the data file.

## Theming

- Each discipline has one `accent` hex color in `disciplines.ts`. The
  `accent-*` helper classes in `src/index.css` derive light and dark tints
  from it automatically.
- Global colors, fonts, and shadows live in the `@theme` block of
  `src/index.css`.
- Dark mode is class based (`dark` on `<html>`), toggled in the navbar and
  saved to localStorage.
