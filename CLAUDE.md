# Engineering Explorer

Student-facing app that helps middle and high schoolers find which engineering
discipline they enjoy, through round-based interactive challenges. React 19 +
TypeScript + Vite + Tailwind v4. No backend. See @README.md for the stack.

## Commands

```bash
npm run dev       # http://localhost:5173
npm run lint      # oxlint
npm run build     # tsc -b && vite build, this is also the typecheck
```

`npm run build` is the verification loop: it typechecks and bundles. Run it plus
`npm run lint` after a series of edits.

## Gotchas

- **All content lives in `src/data/disciplines.ts`.** Challenge copy, discipline
  descriptions, and the DIY projects are data, not JSX. Add or edit content there
  rather than in components.
- **The challenges are real simulations, not quizzes.** The truss challenge solves
  an actual statically determinate truss. If a change makes a challenge easier to
  render but less physically honest, that is a regression.
- **Everything persists to localStorage under the `ee:` prefix.** There is no
  server and no account. Clearing that prefix wipes a student's progress, so treat
  a storage-key rename as a data migration, not a refactor.
- Firebase is planned but absent. If accounts arrive, they slot in behind
  `src/lib/profile.ts` without touching the games. Do not thread auth through the
  challenge components.
- Tailwind v4 with class-based dark mode. There is no `tailwind.config.js`; theme
  config lives in CSS.

## Layout

```
src/data/disciplines.ts   all content
src/challenges/           one folder per discipline, the interactive rounds
src/lib/mastery.ts        scoring and star ratings
src/lib/storage.ts        the ee: localStorage layer
src/pages/                routed screens
```
