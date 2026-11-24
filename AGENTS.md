# Agent rules for Element Arena

These rules apply to any AI coding agent working in this repository (Codex, Claude Code, and others). Read this whole file before starting a task.

## Project at a glance

- Monorepo (npm workspaces, Node 22+): `apps/client` (Phaser + Vite), `apps/server` (Express + Socket.IO), `packages/shared` (rules and data used by both), `supabase/migrations` (database), `tests/` (unit, integration, multiplayer), `scripts/`.
- The game is **server-authoritative**: the server decides hits, damage, cooldowns, scores and rewards. The client only sends inputs and draws what the server says.
- All creatures, art and names are original. Never add assets, names or designs copied from existing games.
- `README.md` and `docs/` describe how features work. Read the relevant doc before changing a system.

## Hard rules

1. **Read before you edit.** Base every claim on code you have read, and cite it as `path:line`. Do not guess.
2. **Do not change gameplay without approval.** This covers balance (damage, cooldowns, HP, speed, knockback), match rules, rewards, prices, progression and anything players see in the UI. If a change looks worthwhile, list it as a proposal and wait.
3. **Keep the server authoritative.** Never move validation, damage, scoring or reward logic to the client, and never trust values the client sends.
4. **Do not break other platforms.** Keep mobile/PWA, touch controls, controller support, key rebinding and safe-area layout working.
5. **Keep changes small and focused.** One concern per change. No drive-by refactors, no reformatting whole files, no renaming for taste. Ask before adding a dependency.
6. **Measure performance work.** Record a number before and after (frame time or FPS, bundle size, object or draw-call count, allocations, network payload size). If you could not measure it, say the gain is unverified.
7. **Never destroy data.** Do not delete files, edit existing Supabase migrations (add a new numbered one instead) or touch `.env` files or secrets.
8. **Git.** Do not commit or push unless asked. When asked, work on a new branch (never directly on `main`), and write short imperative English commit messages in the style of the history, for example `Reduce Mythical skin rendering cost and pause hidden animations`.
9. **Report honestly.** If a check fails, show the output. If you skipped a step or could not verify something, say so plainly.

## Workflow

1. **Survey.** Read the relevant code and docs, then run the checks below to get a baseline. Do not edit anything yet.
2. **Report.** List what you found, ordered by severity: bugs, then performance, then cleanup. For each item give `path:line`, the cause, the proposed fix and its risk. **Stop and wait for approval.**
3. **Fix.** Change only the approved items, one at a time.
4. **Verify.** After each item, every check must pass.
5. **Summarize.** What changed, before/after numbers, what is unverified and what is left. Update `README.md` or `docs/` if behaviour or setup changed.

## Checks

These match CI (`.github/workflows/ci.yml`):

```
npm run typecheck
npm run test
npm run build
node scripts/verify-pwa.mjs
npm run format:check
```

Add or update tests in `tests/` when you fix a bug or change logic in `packages/shared` or `apps/server`.
