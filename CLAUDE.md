# Notes for Claude sessions

## Product UI priorities

Mobile landscape is the primary target for the App Store and Google Play
launch: verify small phones and safe-area insets before desktop polish.
Keep new content driven by shared data rather than floor/boss-specific UI
branches. For Spire updates, follow [the content guide](docs/spire-content-guide.md).

## Running tests quickly

The full visual suite (`tests/visual`, Playwright) has over 100 files and is
slow on one machine: the config runs **one worker** on purpose, and the
`panel-scroll` sweeps alone take over half an hour. CI splits it into eighteen
shards of about equal running time (`.github/workflows/ci.yml`,
`scripts/visual-shards.mjs`, from each test's CI time in
`tests/visual/durations.json`). When the shards drift apart (new or slower
tests), download the `visual-durations` artifact of a green main run over
that file and commit it; `node scripts/visual-shards.mjs --plan 18` shows the
split. Locally, don't run all of it: run what the change touches, in
parallel, in the background.

**1. Unit and integration tests first** (about 2–3 minutes for all):

```bash
npx vitest run tests/unit tests/integration
```

Run only the files you touched while working (`npx vitest run tests/integration/friends.test.ts`).

**2. Visual tests: pick the specs for the change.** Find them by the DOM ids,
classes or screen names you changed:

```bash
grep -l "pz-card\|pz-treats" tests/visual/*.spec.ts
```

Then run those with:

- `PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`, the
  Chromium already in the cloud container (don't run `playwright install`);
  check the path with `ls /opt/pw-browsers`.
- `--trace off`: traces cost a lot of CPU.
- `--workers=2`: twice as fast with 4 CPUs. Keep the timing and frame-rate
  specs on one worker, by themselves: `battle-performance`, `pvp-performance`,
  `roster-smooth`, `graphics-quality`, `ui-motion`, `touch-recovery`,
  `cosmetic-displays`, `panel-open-budget`.
- `-g "<part of a test title>"` while iterating on one test.
- Name spec files by path (`tests/visual/spire.spec.ts`). A bare word is a
  pattern on the whole path, so in a checkout like `/tmp/wt-spire` the word
  `spire` matches every spec.

```bash
PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npx playwright test --config tests/visual/playwright.config.ts tests/visual/lobby.spec.ts tests/visual/plaza.spec.ts --trace off --workers=2 --reporter=line
```

**3. Keep `panel-scroll.spec.ts` apart.** It sweeps every panel at four
screen sizes. Run it only when a change can affect panel layout or
scrolling, in its own background run, at the same time as the other specs:

```bash
PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npx playwright test --config tests/visual/playwright.config.ts panel-scroll --trace off --workers=2 --reporter=line
```

**4. Long runs go in the background** (`run_in_background`, output to a log
in the scratchpad) with a watch on the log for the `passed`/`failed`
summary. Don't block on them. The line reporter writes terminal codes at the
start of lines, so strip them before looking for failures, or a failed test
(`  1) tests/visual/...`) slips past the search:

```bash
sed 's/\x1b\[[0-9;]*[A-Za-z]//g' run.log | grep -E "^\s+[0-9]+\) |^\s+[0-9]+ (passed|failed|flaky)"
```

Don't edit source files while a run is going: the harness's Vite server
reloads the page and tests fail with "Execution context was destroyed".
Meanwhile, the typecheck and build:

```bash
npm run -s typecheck && npm run -s build
```

Other notes:

- The visual harness serves the client from
  `npx vite --config tests/visual/vite.config.ts` on port 4179 and reuses a
  server already running there. After changing the harness or its fakes
  (`tests/visual/*-fake.ts`), stop that server (`pkill -f tests/visual/vite.config`)
  so the next run starts a fresh one.
- `VISUAL_SHOTS=<folder>` saves a screenshot of each `snap()` to look over.
- A visual test that must not pass by luck: break the fix on purpose, check
  that the test fails, then restore the fix.
- Run Prettier only on the files you changed (`npx prettier --write <files>`),
  never on the whole repo.

## Keeping battles smooth on older phones

Older Android phones lag when skills go off: effects add drawing work their
GPU pays for per pixel, on top of the court and fighters. Every new champion, skill, effect or battle UI
must stay within what we already ship. Details and measurements:
`docs/network-performance.md` (sections 5 and 8).

- **New champion, skill or effect:** run `tests/visual/effect-budget.spec.ts`
  (all champions, about 6 minutes; `EFFECT_BUDGET_MEASURE=1` prints each
  champion's glow cover, smoke cover and particles without judging). If a
  kit is over a limit, make the effect lighter (fewer or smaller glows,
  fewer particles, shorter trails). Raise a limit only on purpose, and say
  why in the pull request.
- **Skill effects draw through the effects engine** (`fx-engine.ts`: `fx.g`,
  `fx.floor`, `fx.glow`, `fx.soft`, `fx.burst`, `fx.trail`, or `shot`),
  never with their own scene objects (`tests/unit/effect-rules.test.ts`).
  Only then do the graphics levels, Low's glow budget and the budget test
  see them.
- **Warnings stay full size:** a glow that warns players (a wind-up, a boss
  gathering power) goes inside `fx.essential(() => ...)`, so Low's glow
  budget never shrinks it. Wind-ups (`drawWindup`) and boss art
  (`boss-spell-art.ts`) already are.
- **Battle UI:** never read layout every frame (`offsetWidth`,
  `getBoundingClientRect`, `getComputedStyle` after a style change): measure
  once and cache. `tests/visual/match-flow-budget.spec.ts` counts layout
  reads during a real match, and checks that no fighter art loads mid-fight.
- **Test scenarios that swap in a new arena** in the same page must carry on
  its event numbering (`a.serial = previous.serial`): the client skips
  events whose id it has passed, so a fresh count silently hides casts.
- **Real phones:** the server logs one `arena-perf` line per match (frame
  rate, slowest frames, stutter share, graphics level, device memory and
  cores; no account). Opening the game with `?perf=1` shows the same numbers
  over the battle, for a player to screenshot.

## Database migrations reach production on their own

A push to `main` that adds a file in `supabase/migrations/` applies it to the
production Supabase database (`.github/workflows/migrate.yml`,
`docs/auto-migrations.md`). So a new migration must be safe to run again
(`scripts/check-migrations.mjs <file>` runs it twice on an empty database),
must ship in the same push as the code that needs it, and a migration that
already ran is never edited: add a new one.
