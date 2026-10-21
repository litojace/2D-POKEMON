# Visual redesign review

Implementation follows [redesign-plan.md](redesign-plan.md). Only client presentation and documentation change; gameplay and server contracts stay unchanged.

## Phase 1 — tokens and base components

- Added the specified navy, text, accent, danger, radius, easing and element tokens. Preserved `--muted`, `--lime` and `--stadium-red` as aliases.
- Replaced exact matching CSS colors with tokens. Kept alpha variants and fighter palettes intact.
- Added primary/secondary buttons, cards, pills and uppercase section titles without removing existing selectors. Press feedback respects reduced motion.
- Bundled the existing Barlow Condensed and DM Sans typefaces locally, with their licenses, for offline/PWA use.
- Typecheck passed. All 854 tests passed. `npm run dev` reviewed at 1280×720 and 844×390: no horizontal overflow or JavaScript errors.
- `npm run format:check` was run. It was already failing in 81 files before this work; it now reports 78 unchanged files. All files changed in this phase pass Prettier. Formatting server/shared/test files is outside the authorized scope. Two CSS blocks retain their source formatting with `prettier-ignore` because existing regression tests query their literal formatting.

Phase 2 is pending. Stop after Phase 2 for review; Phases 3–8 are not included.
