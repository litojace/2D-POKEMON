# Notes for Claude sessions

## Running tests quickly

The full visual suite (`tests/visual`, Playwright) has 75 files and is slow
on one machine: the config runs **one worker** on purpose, and the
`panel-scroll` sweeps alone take over half an hour. CI splits it into ten
shards (`.github/workflows/ci.yml`). Locally, don't run all of it: run what
the change touches, in parallel, in the background.

**1. Unit and integration tests first** (about 2–3 minutes for all):

```bash
npx vitest run tests/unit tests/integration
```

Run only the files you touched while working (`npx vitest run tests/integration/bistro.test.ts`).
`tests/integration/farm.test.ts > can be run again without changing any farm`
can fail when the machine is busy (a timing check); if it fails, run that file
alone before treating it as a real failure.

**2. Visual tests: pick the specs for the change.** Find them by the DOM ids,
classes or screen names you changed:

```bash
grep -l "bs-sheet\|fm-sheet" tests/visual/*.spec.ts
```

Then run those with:

- `PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`, the
  Chromium already in the cloud container (don't run `playwright install`);
  check the path with `ls /opt/pw-browsers`.
- `--trace off`: traces cost a lot of CPU.
- `--workers=2`: twice as fast with 4 CPUs. Keep the timing and frame-rate
  specs on one worker, by themselves: `battle-performance`, `pvp-performance`,
  `roster-smooth`, `graphics-quality`, `ui-motion`, `touch-recovery`,
  `cosmetic-displays`.
- `-g "<part of a test title>"` while iterating on one test.

```bash
PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npx playwright test --config tests/visual/playwright.config.ts tests/visual/bistro.spec.ts tests/visual/farm.spec.ts --trace off --workers=2 --reporter=line
```

**3. Keep `panel-scroll.spec.ts` apart.** It sweeps every panel at four
screen sizes. Run it only when a change can affect panel layout or
scrolling, in its own background run, at the same time as the other specs:

```bash
PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npx playwright test --config tests/visual/playwright.config.ts panel-scroll --trace off --workers=2 --reporter=line
```

**4. Long runs go in the background** (`run_in_background`, output to a log
in the scratchpad) with a watch on the log for the `passed`/`failed`
summary. Don't block on them. Meanwhile, the typecheck and build:

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
