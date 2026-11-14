# Mobile Raid Hall layout

The owner chose a single swipeable row for landscape phones, with the cards
balanced vertically. Desktop keeps its existing four-column, two-row grid.
Card width responds to both available width and height; the gallery scrolls
horizontally within its own box. Safe-area insets continue to come from the
shared lobby/panel layout, including the Dynamic Island and home indicator.

Opening a boss frames its body on both desktop and phone with minimal zoom
(1.04 times stage height, 1.07 for Snoozaku, or enough to cover the width). The face may sit off
center; its horizontal position stays between 20% and 80% of the stage so it
clears both edges. Zoom no longer increases to force the face into the center.
Storm Twins uses the midpoint between both faces. Cards/thumbnails use their
whole-creature crops. Snoozaku's mobile gallery card instead uses the wide
painting with expanded scenery, showing the creature at a smaller scale with real scenery
covering both edges; desktop cards and room banners keep the portrait asset.

## Reference study

- [Pokémon UNITE selection screenshot](https://pokemon-unite.en.uptodown.com/android):
  separate the main creature, roster/team information and confirmation action.
- [Honkai: Star Rail character screen](https://www.hoyolab.com/article/20857894):
  give character art a clear visual region beside a distinct information panel.
- [Supercell's August 2026 release notes](https://supercell.com/brawlstars/en/blog/release-notes/release-notes-august-2026/),
  “Brawler Collection”: its roster was rebuilt to scroll horizontally, with
  smaller cards to expose more choices.

These are layout references rather than copied screens or assets. This game's
painted posters, glass surfaces, navigation and raid actions remain its own.

Verification covers independent face-position measurements for all seven
paintings, one-row mobile card geometry, safe-area layouts, and real CDP touch
swipes along the gallery and through the raid's other scrolling windows.

## Local validation

- After restarting the preview server to clear stale modules, the current
  body framing passed the 844×390 and 1440×900 splash checks across all seven
  bosses, including coverage, safe face position and restrained zoom.
- `raid-hall.test.ts`: 11 unit tests passed; typecheck, production build and
  PWA verification passed.
- After rebasing onto main, all seven selected Chromium visual/touch cases
  passed, covering the seven bosses, mobile layouts, reward pictures and
  real touch swipes at 844×390 and 852×393 with safe-area insets.
- The full desktop touch flow at 1440×900 exceeded its 180-second deadline,
  including an isolated retry. Its captured state was in the simulated raid
  briefing/battle startup. This remains an unresolved validation limitation;
  the desktop poster and Raid Hall layout checks passed separately.
- Phone checks use emulated Chromium viewports, touch input and safe areas;
  they are not physical iOS-device tests.
