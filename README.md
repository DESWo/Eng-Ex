# Engineering Explorer

A playful web app that helps middle and high school students discover which
engineering discipline they enjoy by solving fun, interactive challenges.

Not a school replacement. Not a test. Just exploration.

## Tech stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4 (class based dark mode)
- Framer Motion
- React Router
- lucide-react icons
- Firebase: planned for later (accounts and saved progress). For now everything
  persists to localStorage under the `ee:` prefix.

## Getting started

```bash
npm install
npm run dev      # start the dev server on http://localhost:5173
npm run build    # typecheck + production build
npm run preview  # preview the production build
```

## How the app works

Every discipline follows the same five step flow:

1. **Learn**: a plain language intro plus a video placeholder.
2. **Play**: three interactive challenges. Beating any one unlocks the next
   step; beating all three is bragging rights. Every challenge rotates to a
   harder round after each win (new targets, budgets, loads, or parts).
3. **Reflect**: three quick questions (enjoyment, difficulty, try another?).
4. **Why it works**: the engineering idea behind the win, in simple words.
5. **Try it at home**: a real-world DIY project that mirrors the challenge,
   with materials, steps, an experiment, and a safety note.

Progress (20% per step) and reflection answers are saved locally, so the
landing page cards show real progress.

## The challenges

| Discipline | Challenge | What you do |
| --- | --- | --- |
| Mechanical | Catapult Lab | Projectile physics. Later rounds add walls to clear and wind. |
| Mechanical | Gear It Up | Gear ratios to hit a physical goal (cooling, drying, lift). Later rounds chain compound gears. |
| Mechanical | Balance Act | Torque balance with a counterweight on a beam. |
| Civil | Bridge Builder | Design a real truss. A stiffness solver computes member forces; beams snap in tension and buckle in compression. |
| Civil | Green Wave | Split green light time so both roads clear their queues. Later rounds reserve time for pedestrians. |
| Civil | Shake Proof | Frame, braces, and base isolation vs earthquakes, under budget. |
| Electrical | Power Up | Route power lines to five houses with limited wire (graph puzzle). |
| Electrical | Circuit Lab | Wire real circuits: battery, bulb, switch, buzzer. Detects short circuits and incomplete loops. |
| Electrical | Don't Trip | Distribute appliances across breaker circuits without overloading any. |

The Bridge Builder runs a genuine 2D truss stiffness solver
(`src/challenges/civil/truss.ts`): every beam is an axial spring, K u = f is
solved per truck position, and member forces are checked against tension and
compression limits. Mechanisms (not enough triangles) are detected as runaway
deflection.

## Project structure

```
src/
  data/
    disciplines.ts        <- ALL discipline content and copy. Edit this first.
  challenges/
    registry.ts           <- challenge id -> component map
    mechanical/           <- Catapult Lab, Gear It Up, Balance Act
    civil/                <- Bridge Builder (+ truss.ts solver), Green Wave, Shake Proof
    electrical/           <- Power Up, Circuit Lab, Don't Trip
  components/
    ui/                   <- Button, Card, Badge, Slider, Meter, Confetti, etc.
    layout/               <- Navbar, Footer
    landing/              <- Hero, HowItWorks, DisciplineCard, DisciplineGrid
    flow/                 <- FlowStepper + the five step components
  pages/                  <- LandingPage, DisciplinePage, NotFoundPage
  hooks/                  <- useTheme, useProgress
  lib/                    <- types, storage, animations, utils
```

## Editing the games

Every challenge keeps its tuning knobs at the top of its file, clearly marked:
round definitions, budgets, physics constants, gear teeth, wattages, and the
copy for wins and failures. Changing difficulty is a one line edit. The DIY
projects, intros, and "why it works" content all live in
`src/data/disciplines.ts`.

## Adding a new discipline

1. Build challenge components in `src/challenges/<name>/`. Each receives one
   prop, `onComplete`, called when the player first solves it.
2. Register them in `src/challenges/registry.ts` under unique ids.
3. Add a new entry to `src/data/disciplines.ts` (copy an existing one) and
   list your challenge ids.

The landing card, routing, theming, and the five step flow are generated from
the data file.

## Theming

- Each discipline has one `accent` hex color in `disciplines.ts`. The
  `accent-*` helper classes in `src/index.css` derive light and dark tints
  from it automatically.
- Global colors, fonts, and shadows live in the `@theme` block of
  `src/index.css`.
- Dark mode is class based (`dark` on `<html>`), toggled in the navbar and
  saved to localStorage.
