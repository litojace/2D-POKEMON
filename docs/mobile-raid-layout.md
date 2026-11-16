# Mobile Raid Hall layout

The owner chose a single swipeable row for landscape phones, with the cards
balanced vertically. Desktop keeps its existing four-column, two-row grid.
Card width responds to both available width and height; the gallery scrolls
horizontally within its own box. Safe-area insets continue to come from the
shared lobby/panel layout, including the Dynamic Island and home indicator.
Only the seven boss cards appear in the gallery. Boss entry and tab navigation use a short 260 ms slide
and fade, reversed for Back/earlier tabs. Returning restores the gallery's
horizontal scroll and card focus. Navigation responds immediately, cancels
superseded animations, and skips motion with reduced motion or Low graphics.

Opening a boss frames its body on both desktop and phone with minimal zoom
(1.04 times stage height, 1.07 for Snoozaku, or enough to cover the width). The face may sit off
center; its horizontal position stays between 20% and 80% of the stage so it
clears both edges. Zoom no longer increases to force the face into the center.
Storm Twins uses the midpoint between both faces. Cards/thumbnails use their
whole-creature crops. Snoozaku's gallery card instead uses the wide
painting with expanded scenery, showing the creature at a smaller scale with real scenery
covering both edges on mobile and desktop; room banners keep the portrait asset.
Gallery artwork uses small optical scale adjustments: Tidelotl 1.06,
Lumiwick 1.08, and Snoozaku 1.12 on its wider source (previously 1.20 on
mobile and a tightly cropped portrait on desktop). The other four cards
retain their scale. Lumiwick and Snoozaku scale from the top to protect
the flame/nightcap. These card adjustments do not alter detail-page framing.

The detail paintings use `*-lower.webp` variants with painted scenery added
above the original composition. The approved creature, horizontal framing and
zoom stay unchanged; the original painting is shifted down by 32 source pixels
for Cragmuff, 60 for Tidelotl, 64 for Inkpurr/Snoozaku/Lumiwick, 44 for Prismell,
and 48 for Storm Twins. Only the new top scenery is generated; the creature
comes from the original painting. Face coordinates include the same offset.
Gallery portraits and the original wide files remain available unchanged.

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
