# Engineering Explorer

A browser app for trying out twelve engineering fields. Each field has three
small simulations, five levels deep, plus a short intro, a few reflection
questions, and a project you can build at home. Everything runs client side and
saves to localStorage. There is no server and no account.

Live: https://deswo.github.io/Eng-Ex/

## The interesting parts

The games are simulations rather than quizzes with pictures. The ones worth
looking at:

- **Bridge Builder** (`src/challenges/civil/truss.ts`) is a 2D truss stiffness
  solver. It assembles `K u = f` from whatever joints and members you drew,
  solves it with Gaussian elimination and partial pivoting, and re-solves at
  every road joint as the truck crosses, keeping the worst member force it sees.
  Too few triangles and the deflections blow up, which is how it detects a
  mechanism.
- **Robot Arm** solves closed-form inverse kinematics for a two-link arm. Both
  the elbow-up and elbow-down solutions, with joint limits and a shelf to reach
  around.
- **Smooth Ride** evaluates 1-DOF transmissibility. The stiff suspension that
  wins level 2 is the one that shakes apart on the washboard road in level 3,
  because the road frequency lands near its natural frequency.
- **Reactor Control** runs a lagged feedback sim on a 300 ms tick. The core
  closes a fraction of the gap to demand each tick, so chasing the setpoint
  overshoots it.
- **The Right Dose** computes a weak acid titration curve from a pKa, so the
  buffer region is gentle and the equivalence point is nearly vertical.

Also worth noting: no game uses a slider. Every control is direct manipulation
(drag the launch arrow, drag the fulcrum, drag the rod bank, paint surfaces onto
a site grid), and every draggable handle has an arrow-key path.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build, this is also the typecheck
```

React 19, TypeScript, Vite, Tailwind v4, Framer Motion, roughjs.

## Status

Playable end to end. Twelve fields, 36 games, five levels each. `/teacher`
prints a per-student progress report, and `?preview=1` on any URL unlocks every
field without touching saved work.

What is not done:

- No sync. Progress is localStorage in one browser. Getting it to another
  computer means exporting a save file or a transfer code and pasting it in by
  hand. Automatic sync needs a backend, and there is no backend.
- No accounts in the real sense. Sign-in takes an email and no password, which
  only namespaces the save key. It is not security and the dialog says so.
- Most fields have no intro video. The slot renders nothing when empty.
- Content is written for middle and high school readers and has not been
  reviewed by a teacher.

Notes on the code layout, theming, and how to add a field are in
[docs/architecture.md](docs/architecture.md).
