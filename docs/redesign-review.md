# Visual redesign review

Implementation follows [redesign-plan.md](redesign-plan.md). Only client presentation and documentation change; gameplay and server contracts stay unchanged.

## Phase 1 — tokens and base components

- Added the specified navy, text, accent, danger, radius, easing and element tokens. Preserved `--muted`, `--lime` and `--stadium-red` as aliases.
- Replaced exact matching CSS colors with tokens. Kept alpha variants and fighter palettes intact.
- Added primary/secondary buttons, cards, pills and uppercase section titles without removing existing selectors. Press feedback respects reduced motion.
- Bundled the existing Barlow Condensed and DM Sans typefaces locally, with their licenses, without depending on an external font request.
- Typecheck passed. All 854 tests passed. `npm run dev` reviewed at 1280×720 and 844×390: no horizontal overflow or JavaScript errors.
- `npm run format:check` was run. It was already failing in 81 files before this work; it now reports 78 unchanged files. All files changed in this phase pass Prettier. Formatting server/shared/test files is outside the authorized scope. Two CSS blocks retain their source formatting with `prettier-ignore` because existing regression tests query their literal formatting.

## Phase 2 — home scene

- Replaced the home screen with a full-height navy scene, a large front-facing fighter using the existing artwork, an element-colored glow, uppercase fighter name and actual mastery tier. The last picked fighter is remembered locally.
- Added the left navigation rail, gold active marker, compact daily-mission badge, thin account/avatar/level/currency header, direct settings shortcut, season progress and a bottom-right mode picker with a single gold PLAY action.
- Kept every existing literal element ID. The original fighter selection remains reachable in its own panel; joining, spectating, AI difficulty, bot battles and solo testing remain in Play options. Existing lobby markup and network actions are reused.
- Added focus containment and Escape/close behavior for the home panels, keyboard mode navigation, and home controller focus/confirm/back/settings navigation. The UI controller loop stops outside home and never changes battle inputs.
- Reserved safe areas, collapsed the phone rail to icons, constrained the artwork to avoid overlapping controls, kept featured artwork mounted during wallet/XP refreshes, and honored reduced motion.
- Included the original local font files in the PWA static precache; the installed app uses the new navy theme color.
- Typecheck and all 854 tests passed. The client production build and PWA verification passed. Browser review at 1280×720, 844×390 and 568×320 covered all eight fighter selections, every mode, feature entry points, panel focus, controller confirm/navigation, reduced motion, simulated safe areas, portrait rotation gate and returning from the existing duel/team/FFA lobbies. No page errors or horizontal overflow were found.
- `npm run format:check` still reports 76 pre-existing failures in untouched files; the original baseline was 81. All client/documentation files changed by this redesign pass Prettier. Protected files and the repository's formatting command/ignore rules were not changed.

Review screenshots use an in-browser sample profile because no Supabase credentials are available in this environment. No fixture or authentication bypass is shipped:

- [Desktop home, 1280×720](redesign-phase2-desktop.png)
- [Landscape phone home, 844×390](redesign-phase2-mobile.png)

Stopped after Phase 2 for review. Phases 3–8 are not included.
