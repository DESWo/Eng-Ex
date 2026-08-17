# Architecture notes

Working notes for whoever edits this next. The README covers what the app is;
this file covers where things live.

## Layout

```
src/
  data/disciplines.ts     all discipline content and copy
  challenges/
    registry.ts           challenge id -> lazy component + preload
    <field>/              one folder per field
  components/
    ui/                   Button, Card, Badge, Meter, Confetti
    level/                LevelRail, ConceptCard, InsightToggle, Scorecard, LevelShell
    flow/                 FieldIntro, ChallengeList, SupportingMaterial and the
                          pieces inside it (WhyItWorks, ReflectionQuestions,
                          DiyProject, PostLevelWhy)
    landing/ layout/ auth/ diy/ instruments/
  pages/                  LandingPage, DisciplinePage, ChallengePage, AboutPage,
                          TeacherPage, TechnicalNotesPage, PrivacyPage, NotFoundPage
  hooks/                  useTheme, useProgress, useLevels, useLevelCounts,
                          useProfile, useAttempts, useSvgDrag
  lib/                    types, storage, mastery, profile, saveFile, accent,
                          sound, animations, utils
```

Content is data, not JSX. Challenge copy, field descriptions, and the DIY
projects all live in `src/data/disciplines.ts`. Edit there first.

Games are code split. Each one loads as its own chunk when first opened, and
hovering a challenge chip preloads it.

## Field flow

All twelve fields are open from the first visit. The landing page groups them
as three core fields (Mechanical, Civil, Electrical) and nine branch fields,
but that is reading order, not gating.

A field page is the intro, the three games, and the supporting material
(the idea behind each game, three reflection questions, and a DIY project).
Progress still tracks the five historical step keys (intro, challenge,
reflection, learn, diy) in `ee:progress`, so old saves keep their meaning.

## Level arc

Each game has five levels and each level adds one thing:

1. no constraints
2. one constraint (budget, limit, deadline)
3. the case where the obvious answer fails
4. an overlay drawing the physics the sim was already computing
5. three competing metrics and a personal best scorecard

Mastery counts levels: 3 games x 5 levels = 15 per field. The tier chip reads
Explored / Solid / Mastered, where Solid means every game in the field is past
level 3.

## Storage

Everything persists to localStorage under the `ee:` prefix. A named profile's
work goes to `ee:p:<slug>-<hash>:<key>` (profiles created under the old email
flow keep their `ee:u:<email>:<key>` scope forever), guests use bare
`ee:<key>`, and guest work is moved into a new profile on first switch. Theme
is per browser, not per profile.

Renaming a storage key is a data migration, not a refactor.

Restores from a save file or transfer code are validated key by key and write
nothing if the payload is damaged, so a half-copied code cannot overwrite good
progress.

Firebase is planned but absent. If accounts arrive they go behind
`src/lib/profile.ts`. Do not thread auth through the challenge components.

## Theming

- Each field has one `accent` hex in `disciplines.ts`. The `accent-*` helpers in
  `src/index.css` derive light and dark tints from it with `color-mix`.
- Global colors, fonts, and shadows are in the `@theme` block of
  `src/index.css`.
- Tailwind v4, class-based dark mode (`dark` on `<html>`). There is no
  `tailwind.config.js`.

## Adding a challenge

1. Build the component in `src/challenges/<field>/`. It takes one prop,
   `onComplete`, called on the first level clear. Use `useLevels` for the level
   arc and `components/level/` for the rail and cards.
2. Register it in `src/challenges/registry.ts` (lazy import plus named export).
3. Add a `ChallengeRef` (id, title, goal, why points) to that field's entry in
   `src/data/disciplines.ts`.

Tuning knobs sit at the top of each challenge file: level definitions, budgets,
physics constants, win and failure copy. Difficulty changes are usually one
line.

## Adding a field

Add an entry to `src/data/disciplines.ts`, copying an existing one, then build
its challenges. Branch fields set `tier: 'more'` and a `parent` slug. The landing
card, routing, theming, gating, and the five step flow are generated from the
data file.

## Verification

```bash
npm run lint     # oxlint
npm run build    # tsc -b && vite build, this is the typecheck
npm run verify   # every scripts/verify-*.mjs physics guard
```

Run all three after a series of edits. The verify scripts mirror constants out
of the challenge components and re-read the component text to prove the mirror
still matches, so changing a tuned constant means updating the matching script
in the same commit. CI runs all three on every push and nothing deploys red.
