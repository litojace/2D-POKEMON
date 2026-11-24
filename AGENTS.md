# Notes for Codex and other coding agents

## CLAUDE.md is the rulebook

[CLAUDE.md](CLAUDE.md) holds this repository's rules and process. Read all of
it before you start, and follow it as if it were written to you: product UI
priorities and the screenshot check, the raid boss ids, how to run tests,
the effect and battle performance budgets, migrations, and the merge lanes.
When this file and CLAUDE.md disagree, CLAUDE.md wins. This file only covers
what differs for an agent that is not a Claude session.

## What is different for you

- **Merging.** Do not merge pull requests or push to `main`: `main` is
  production (a merge deploys the game and applies migrations). Work on a
  branch, open a PR, and stop there. In the PR description, give the lane
  from `node scripts/merge-lane.mjs` and its reasons, what you checked and
  what you left out, so a Claude session or the owner can merge it.
- **Coordinating.** You cannot message Claude sessions. Before you change
  files that another open PR changes (`gh pr list`, then `gh pr diff`), leave
  a comment on that PR naming the files, and say in your own PR which PR
  should merge first. Merge `main` into your branch to resolve a conflict;
  never rebase or force-push.
- **Asking the owner.** Ask before anything CLAUDE.md lists under "Still ask
  the owner first" (real-money prices, store listings and legal text, player
  data, secrets and accounts, production settings, security findings).
  Write to the owner in Vietnamese when they write in Vietnamese, and use US
  Pacific time.
- **Tools and paths.** The Chromium path in CLAUDE.md
  (`/opt/pw-browsers/...`) is for Claude's cloud container. Use the Chromium
  in your own environment for `PW_CHROMIUM`, or let Playwright find its own.

## Optimisation and review work

When asked to check or optimise the game:

1. **Survey first.** Read the code and the docs for the area
   (`docs/network-performance.md` for battle performance), and get a
   baseline: typecheck, build, the unit and integration tests, and the
   visual or budget specs for the area. Change nothing yet.
2. **Report.** List what you found, worst first (bugs, then performance,
   then cleanup), each with `path:line`, the cause, the fix you propose and
   its risk.
3. **Fix in small pieces.** One concern per change, with a test that fails
   without the fix. No drive-by refactors or whole-file reformatting.
4. **Measure.** Give numbers before and after (frame time, stutter share,
   glow and particle cover from `effect-budget.spec.ts`, layout reads,
   bundle size). A gain you could not measure is unverified: say so.
5. **Report honestly.** If a check fails, show its output; if you skipped a
   step, say which and why.
