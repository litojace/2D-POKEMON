# Updating the Spire

Mobile landscape is the primary UI target. Keep controls at least 44 px,
respect safe-area insets, wrap long encounter names, and keep the climb
button visible while content scrolls. Desktop adapts from the same content.

## Where changes belong

- `packages/shared/src/spire.ts`: zones, floors, optional `description`,
  enemies, rewards, tuning and `SPIRE_BUILT_TOP` (the playable release cap).
  Encounter-specific instructions belong on the floor's `description`.
- `packages/shared/src/raid-roster.ts`: canonical raid boss names and IDs.
  Preserve existing IDs when renaming a boss; saved progress uses them.
- `apps/client/src/screens/spire-model.ts`: pure derivation of progress,
  floor states, encounter previews, rewards and zone groups. No HTML or CSS.
- `apps/client/src/screens/spire-view.ts`: reusable markup for those models.
- `apps/client/src/screens/raid-hall.ts`: selection, navigation and local
  scrolling. A floor preview never changes the checkpoint used to start.
- `apps/client/src/screens/spire.css`: layout and touch controls. Avoid
  floor-number selectors and rules depending on a paragraph's position.

## Adding a zone or boss floor

Define the zone and floors in shared data, with the boss ID, floor name,
roster and optional encounter description. Add the tuning and rewards, then
raise `SPIRE_BUILT_TOP` only when the encounters are playable. The Hub will
list the released zones and their floors automatically. Milestones and the
painting's dots show one zone at a time, so more zones do not crowd mobile.
The selected floor is revealed by scrolling its strip, not the page.

UI support does not implement new combat mechanics or database rewards.
Wire new encounters into the server's Spire arena/rooms, asset loading and
boss briefing as needed. Prepare database migrations for new rewards and
checkpoint/release limits; keep shared data and persisted rewards in sync.
Do not publish unfinished floors merely to preview their UI.

## Checks

Run `tests/unit/spire-hall.test.ts` and `tests/unit/spire.test.ts`, typecheck
and build. `tests/fixtures/spire-catalogue.ts` simulates unreleased zones and
long labels without changing production's release cap. Its tests verify
multi-zone expansion and boss data do not inherit Zone 1's instructions.

For UI changes run the tile/page tests in `tests/visual/spire.spec.ts`,
including the small phone and Dynamic Island cases. Run the Spire scroll
sweep separately with `SWEEP_ONLY=spire` and the `hub panels scroll` tests
in `tests/visual/panel-scroll.spec.ts`. Use a persistent harness Vite server
when running multiple Playwright commands; a command-owned server stops
when that command finishes.
