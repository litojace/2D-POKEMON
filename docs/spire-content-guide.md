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

## The battle screen is shared

Spire floors fight on the raid screen (`#raid-hud`, the quick-chat button,
the gear), so the raid layout applies to every floor, released or not:
on phones the quick-chat button sits in the top-left corner and the gear in
the top-right, with the floor's or boss's HUD between them and the same room
on both sides; under them, the party's health on the left and the clock on
the right. A boss's own actions go in the touch cluster's contextual slot by
skill 1 (`mobileLayout`'s `context`), shown only when usable. Keep floor- and
boss-specific UI out of those corners and that slot's neighbourhood, and add
no floor-number or boss-ID selectors for them; `tests/visual/raid-corners.spec.ts`
checks every boss in `RAID_BOSS_ORDER` and a wave and a boss floor
(docs/raid-viewport.md).

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
