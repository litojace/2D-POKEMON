# Starter message for the next UI remodel session

Paste the block below as the first message of a new session on
`litojace/2d-pokemon`. Steps 0 and 1 are done (pull request #19).

```text
We are continuing the UI remodel of every screen outside matches. Read first:

1. docs/ui-remodel/PLAN.md – the plan, the owner's decisions, step 1 as built, the PR order.
2. The design: docs/ui-remodel/images/compare/ and images/mockups/, and the mockup
   source in docs/ui-remodel/mockup/ (run: npx vite --config docs/ui-remodel/mockup/vite.config.ts,
   open http://localhost:4180/#shop). The owner approved this design.
3. Step 1's foundation, which every screen must use:
   apps/client/src/ui/tokens.css, ui/components.ts + components.css,
   ui/hub-panel.ts (openHubPanel, askConfirm), server-clock.ts,
   tests/visual/ui-measure.ts and tests/visual/ui-foundation.spec.ts.

Now build step 2: the fitting room (Shop + Wardrobe in one screen), as in the plan
and the mockup:
- Opens inside the Lobby with openHubPanel; the fighter on a stage on the left (reuse the
  live preview, mountShopPreview in shop-preview.ts), the catalogue on the right, the
  action bar bottom right. Shop | Wardrobe switch only changes the catalogue.
- Shop: Today (featured 20%-off pick with countdown, daily picks, bundles, earn-coins line),
  Skins, Mythic Hall, Collections. Buy goes through askConfirm() (owner decision 2), then the
  existing /api/shop/buy; the server's answer is what counts.
- Wardrobe: fighter avatars instead of the dropdown, six slot tabs, OWNED ITEMS ONLY plus a
  "More in the Shop" tile (owner decision 3); try several things, then Equip once or Revert,
  using the existing /api/shop/equip and /api/raids/equip.
- Keep all current rules: prices from shopPrice, Mythic Trials and awakening stages,
  bundles, unlimited-coins testers, raid frame stars.
- Delete the old Shop/Wardrobe markup and the CSS they used (style.css Shop/rarity rules,
  mobile-store.css, wardrobe.css) instead of stacking new rules; move the tests that
  pointed at the old screens (shop-*.spec.ts, cosmetic-displays, portrait-frames,
  frame-level-preview, shop-ui.test.ts, shop-preview.test.ts) to the new screen.
- Low graphics: a still fighter instead of the live rig.

Ground rules (from the owner): all game text in English; the server owns time and money;
buttons in a row equal and moderate in size; fixed HUD boxes; phone landscape without
overlaps; notch and Dynamic Island safe areas; keyboard and touch; reduced motion.
Measure layouts with tests/visual/ui-measure.ts at 1440×900, 1280×720, 844×390 and
852×393 with the island insets.

Process: branch from main, one pull request into main for this step, with before-and-after
screenshots. Before every push run npm run typecheck, npm run test, npm run build and the
visual tests for the screens you changed (set PW_CHROMIUM to the Chromium binary, e.g.
/opt/pw-browsers/chromium-1243/chrome-linux64/chrome). Report plainly what was verified and
what was not. Known: champion-animation.spec.ts times out on a CPU-only machine on main too.
```
