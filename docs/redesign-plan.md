# Visual redesign plan

Goal: make Element Arena look like a current hero-brawler (Brawl Stars, Pokémon Unite, Fortnite lobby) without changing any gameplay, networking, server or database code. This is a client-only, presentation-only project.

## Ground rules

- Touch only `apps/client/` (mostly `src/style.css`, the `*-ui.ts` / `*-view.ts` markup builders, `menu-shell.ts`, `main.ts` markup strings, `fighter-selection.ts`, `battle-dock.ts`, `game-feel.ts`, `menu-motion.ts`).
- Do not touch `apps/server/`, `packages/shared/`, `supabase/` or socket message shapes.
- Keep every existing element `id` and every class/attribute that `tests/` or TypeScript code queries. Search `tests/` and `apps/client/src` for a selector before renaming it. Add new classes rather than renaming old ones when unsure.
- Keep all features reachable: nothing gets deleted from the UI, only restyled or moved.
- For every UI change, double-check spacing, alignment and visual balance in the rendered screen. Scale avatars and text to the space available; avoid tiny content inside oversized cards. Review both desktop and landscape phones, including safe areas, and check long names and selected states for clipping or overlap before calling the change finished.
- Must keep working on: desktop (mouse + keyboard), controller, phone in landscape (PWA, safe-area insets, `rotate-gate`), and touch controls.
- Respect `prefers-reduced-motion`: every new animation needs a reduced-motion fallback.
- After each phase: `npm run typecheck`, `npm test`, `npm run format:check` must pass, and the game must run with `npm run dev` (open `http://localhost:5173`).
- One phase per commit, with a short plain-English commit message.

## Design direction

| Area        | Today                        | Target                                                                                                                       |
| ----------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Layout      | Panels stacked in the centre | Full-screen scenes built around one big featured fighter                                                                     |
| Navigation  | Buttons inside panels        | Slim left rail: Play, Raids, Fighters, Shop, Friends (+ Missions badge)                                                      |
| Top bar     | Gradient strip               | Thin transparent bar: avatar + name + level (left), coins/currency pills + settings (right)                                  |
| Main action | Several similar buttons      | One big gold **PLAY** button bottom-right, mode picker next to it                                                            |
| Type        | DM Sans + Barlow Condensed   | Same fonts. Barlow Condensed 700–800, uppercase, letter-spaced, much larger for headings and fighter names; DM Sans for body |
| Colour      | Navy + gold everywhere       | Navy base + gold accent kept; each screen also tints its background with the featured fighter's element colour               |
| Motion      | Mostly instant               | Screen slide/fade transitions, button press squash, reward reveals                                                           |

### Design tokens (add to `:root` in `style.css`, then migrate old hard-coded colours to them)

```css
--bg-0: #0b1020; /* deepest background */
--bg-1: #121a33; /* panels */
--bg-2: #1a2547; /* raised cards */
--line: #ffffff1f; /* hairlines */
--text: #eef2ff;
--text-dim: #a0afc8; /* same as old --muted */
--accent: #ffd65b; /* same as old --lime */
--accent-ink: #2a1a00;
--danger: #ef4f61;
--radius-sm: 8px;
--radius-lg: 16px;
--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
--ease-pop: cubic-bezier(0.3, 1.5, 0.5, 1);
--element: #ff7a45; /* set per screen from the featured fighter */
/* element colours */
--el-electric: #ffd84a;
--el-fire: #ff7a45;
--el-water: #4fb3ff;
--el-aura: #7fe7ff;
--el-light: #fff1a8;
--el-psychic: #c47dff;
--el-earth: #c8955a;
--el-shadow: #8a6bff;
```

Keep `--muted`, `--lime`, `--stadium-red` as aliases so nothing breaks.

## Phases

### Phase 1: Tokens and base components

- Add the tokens above. Replace hard-coded colours in `style.css` with tokens where it is a straight swap.
- Create shared component classes: `.btn-primary` (big gold, uppercase, press squash), `.btn-secondary` (glass: translucent fill + hairline), `.pill` (currency/badges), `.card` (raised, `--radius-lg`), `.section-title` (Barlow Condensed uppercase).
- Apply them to existing buttons/panels by adding classes, not by renaming.

### Phase 2: Home / main menu (the mockup)

- Full-screen layout: background = `--bg-0` with a soft radial glow in `--element` behind the featured fighter.
- Featured fighter (last picked or favourite) drawn large, centre-right, using the existing fighter art/rig.
- Right side: element label + huge fighter name + mastery tier.
- Left rail navigation; active item gold with a left bar.
- Top bar: avatar, name, level; coin pills; settings icon.
- Bottom-left: season / journey progress bar. Bottom-right: mode picker + big PLAY button.
- Daily missions become a compact card or a badge on the rail, not a big block.
- Landscape phones: rail collapses to icons only; PLAY stays bottom-right inside safe areas.

### Phase 3: Fighter select and lobby

- Roster as large portrait cards (element-coloured background, element badge, mastery ring, equipped skin).
- Selecting a fighter: the big preview on the right swaps with a quick slide + element colour change of the whole screen (`--element`).
- Room panel (code, players, ready state, party rules) becomes a clean side card; Ready is the single `.btn-primary`.
- Keep 1v1 / 2v2 / FFA team colours readable.

### Phase 4: In-match HUD and game feel

- Health bars, names and ultimate meter: smaller, moved to corners, cleaner shapes, element-coloured fills.
- Skill buttons (desktop + touch): circular, cooldown shown as a radial sweep with the seconds number.
- Game feel (in `game-feel.ts` / Phaser scene): short hit-stop on heavy hits, small screen shake, bolder pop-up damage numbers, KO slow-motion flash. All toned down under reduced motion.
- Do not change hitboxes, timings or anything the server checks.

### Phase 5: Results, recap and progression

- Win/lose banner full-width with big type; MVP fighter shown large.
- Stats as clean rows; XP / mastery bars fill with an animation.
- Rematch = `.btn-primary`, back to menu = `.btn-secondary`.

### Phase 6: Shop, raids, friends, settings, dialogs

- Shop: rarity-coloured item cards, big preview, reveal animation on purchase.
- Raid hub: boss cards with boss art large, difficulty chips, clear rewards row.
- Friends, leaderboard, settings, dialogs: same card + button components, consistent spacing.

### Phase 7: Motion and polish pass

- Screen transitions through `menu-motion.ts` (slide/fade, ~200 ms, `--ease-out`).
- Hover/press states on every button; focus-visible rings for keyboard/controller.
- Check every screen at 1920×1080, 1280×720, and phone landscape (e.g. 844×390) with safe areas.

### Phase 8 (separate, optional): Creature art

- Either richer shading/outlines on the existing vector rigs, or drop-in illustrated sprite sheets (see `docs/fighter-assets.md`). Do this independently of phases 1–7.

## Done when

- Every screen uses the shared tokens and components.
- All tests, typecheck and format checks pass.
- Nothing in gameplay, networking or the server changed (`git diff --stat` shows only `apps/client/` and `docs/`).
