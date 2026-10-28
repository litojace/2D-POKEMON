# Engineering improvement roadmap

This roadmap favors small, behavior-preserving pull requests over a large rewrite. Keep each stage independently reviewable, and let tests define the safety net before changing module boundaries.

## Current technical baseline

Element Arena is a TypeScript/npm-workspaces monorepo: a Phaser/Vite client, an Express/Socket.IO authoritative server, and shared game rules. The repository already has type checks, unit/integration/multiplayer tests, Playwright visual tests, PWA checks, and CI. The main maintenance pressure is concentration of responsibilities in a few large files and the implicit state shared by movement helpers.

Observed hotspots on the current `main` branch include:

- `apps/client/src/main.ts`: application bootstrap, screen flows, networking, rendering orchestration and input coordination.
- `apps/client/src/style.css`: the main stylesheet has grown into a very large all-feature bundle.
- `apps/server/src/server.ts`: socket lifecycle, authentication/session ownership, room orchestration and event handlers share one module.
- `apps/server/src/simulation.ts` and `packages/shared/src/index.ts`: simulation and shared rules are substantial enough that clear module boundaries will help testing and review.
- The README documents that live rooms are in-memory and that one server process is the supported deployment shape.

## Stage 1 — Correctness and repeatable checks

**Goal:** make regressions easier to catch before structural refactors.

1. Keep the existing `typecheck`, `test`, `build`, PWA verification and visual checks required in CI.
2. Add explicit integration coverage for two real Socket.IO clients through create/join/ready, movement, disconnect/reconnect, resume and leave flows. Keep a browser-to-server smoke test separate from visual-only browser tests.
3. Add targeted unit tests for room isolation, mutator effects, input validation, reconnect races, and collision/movement boundaries. Prefer deterministic fixtures and seeded simulations.
4. Formatting debt is known: a full-tree `prettier --check .` run currently reports 112 files needing formatting. Do not make that whole-tree check a required gate until its baseline is cleaned in an intentionally scoped formatting change. Standardize formatting incrementally and add enforcement when the relevant scope is clean.

**Done when:** clean install, type-check, unit/integration tests, production build, PWA verification and visual tests all pass; newly changed files do not increase formatting debt.

## Stage 2 — Make simulation inputs explicit

**Goal:** simulation and prediction should depend on their arguments, not the last room that configured a shared module variable.

1. Pass a `MovementContext` containing obstacles and speed scale through shared movement helpers.
2. Have each server `Arena` derive its own context from its active arena, moving walls and party mutators.
3. Have client prediction pass the matching context explicitly, including raid pillar state and the Double Time mutator.
4. Add regression tests that alternate rooms with different obstacles and speed settings, and compare client-predicted movement against the shared movement rules.

**Done when:** no movement behavior depends on module-global mutable room configuration; room contexts are passed to every movement/collision call that requires them.

## Stage 3 — Split the server along ownership boundaries

Do not move all socket handlers at once. Extract one cohesive feature at a time, keeping event names and payload contracts stable.

Suggested target boundaries:

- **Transport and protocol:** socket setup, event names, payload parsing, acknowledgement/error formatting and rate limits.
- **Identity and sessions:** authorization, active-account ownership, reconnect reservations and session cleanup.
- **Room registry/lifecycle:** create, join, watch, resume, leave, room-code generation and room destruction.
- **Feature handlers:** lobby/readiness, combat inputs, town, raids, friends/invites, account/progression and admin operations.
- **Persistence adapters:** match records, ratings, achievements, missions, shop/rewards and raid progression.

Handlers should accept dependencies rather than reach into file-level maps. Keep `Arena` authoritative and keep trust-sensitive validation on the server.

**Done when:** each feature's happy path, failure path and cleanup behavior can be tested without importing the entire socket bootstrap; network protocol compatibility is maintained.

## Stage 4 — Split the client without changing the game flow

Extract cohesive modules from `main.ts` behind small interfaces:

- application lifecycle and screen/router ownership;
- socket client, reconnect policy and typed request acknowledgements;
- game session and local prediction;
- arena scene/render orchestration;
- menu, lobby and match-result screen controllers;
- input mapping for keyboard, gamepad and touch.

Prefer a single explicit application/session object over more module globals. Keep visual/asset modules independent from gameplay decisions. A screen controller should own its DOM listeners and clean them up on teardown. Do not create a framework or rewrite Phaser just to split files.

**Done when:** each extracted module can be tested with focused collaborators and opening/closing/reconnecting screens does not leak listeners, timers or renderer objects.

## Stage 5 — Split shared rules and protocol contracts

Turn `packages/shared/src/index.ts` into a compatibility barrel over focused modules such as movement/collision, combat/abilities, status and mutator rules, arena geometry, and wire schemas/snapshots. Move one domain at a time; do not duplicate constants between client and server.

Separate internal simulation types from wire-level types where they differ, validate untrusted socket data at the boundary, and keep serialized snapshots explicit. Preserve current exports temporarily to avoid a risky all-at-once import migration.

**Done when:** gameplay constants have one source of truth, client and server consume the same rules, and modules have minimal circular dependencies.

## Stage 6 — Make styling and UI assets maintainable

Split the main stylesheet by stable feature boundaries (base/layout, menus, lobby, battle HUD, dialogs/settings, town, mobile/PWA) and load them in an intentional order. Avoid selectors that depend on accidental DOM nesting; use shared component classes and state attributes where possible.

Keep generated art, hand-authored vector art, source data and compiled assets clearly separated. Document which scripts regenerate which outputs and ensure generated output is reproducible. Do not run a wholesale CSS or art reformat as a side effect of a gameplay refactor.

**Done when:** each screen's styles have a clear owner, duplicate/conflicting selectors are reduced, and visual screenshots show no regressions at desktop and mobile sizes.

## Stage 7 — Measure performance before optimizing

Add lightweight measurements for simulation tick duration, room/player/projectile counts, snapshot size and send frequency, client frame time, asset load time and renderer cleanup. Establish representative scenes and repeatable budgets before changing algorithms.

Optimize only demonstrated bottlenecks. Candidate areas to profile include repeated obstacle calculations, high-frequency DOM work, large CSS parsing, sprite/texture lifetime, projectiles/zones, and snapshot payloads. Keep visual effects cosmetic and bounded by the existing render budget.

**Done when:** performance changes include before/after measurements and do not break input latency, visual fidelity or determinism.

## Stage 8 — Make deployment guarantees explicit

The current design stores live rooms in process memory and documents a single-server deployment. Keep that as an explicit supported constraint unless scaling is a concrete requirement.

Before running multiple server instances, define room ownership and affinity, reconnect routing, shared presence, rate-limit state, recovery semantics and what happens to a match during instance loss. Adding a Socket.IO adapter alone does not make in-memory `Arena` state shared or recoverable. If durable room recovery is needed, design versioned snapshots/event logs and test crash/restart behavior deliberately.

Review environment variable validation, production logging, graceful shutdown, health/readiness endpoints and migration/backup instructions.

**Done when:** operational limits and recovery behavior are documented and tested; scale-out is not claimed until room-state ownership is implemented.

## Stage 9 — Release-quality player testing

Run the existing automated tests plus a checklist on real keyboard, controller, touch and mobile browsers. Exercise signed-in PvP on two devices, screen orientation changes, PWA updates, slow networks, reconnect during every match phase, and leaving during raids/team modes.

Review keyboard navigation, focus management, dialog semantics, readable error messages, reduced-motion behavior and contrast alongside screenshots. Balance simulations are useful signals, not a replacement for real player feedback.

**Done when:** supported platforms and known limitations are documented, and release checks are repeatable.

## Working rules

- One concern per pull request; keep behavior changes separate from mechanical file moves.
- Record a short reason and validation results in each PR description.
- Add regression tests before fixing a reproduced bug where practical.
- Avoid broad changes to game balance while refactoring architecture.
- Keep server validation authoritative; never trust client positions, health, damage or reward requests.
- Measure before optimizing and document trade-offs rather than introducing speculative infrastructure.

## Immediate sequence

1. Finish and validate the movement-context isolation change.
2. Add browser-to-server multiplayer smoke coverage.
3. Extract the room registry/session lifecycle from the server bootstrap.
4. Extract client prediction/network ownership from the main entry point.
5. Split shared rules and CSS incrementally, with compatibility exports and visual checks.
