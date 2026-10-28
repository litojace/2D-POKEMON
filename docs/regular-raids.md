# Ordinary raids and a compact battle HUD

Boss Rush and Raid of the Day are retired. Their client screens, town portal,
scheduling helpers and executable expedition simulation are removed. Normal
solo/co-op raids, all seven bosses, Peril unlocks, attack practice, retry, revives,
rites, cosmetics and ordinary raid rewards remain available. The training tower
stays as scenery; it no longer opens a Boss Rush menu.

Old clients cannot create an expedition or enable daily mode to bypass Peril
unlocks. Migration 028 guards the service-only reward RPCs and hides daily-board
fields from progress. It updates the existing `daily-1` mission in place to an
ordinary raid clear as Voltkit or Auralynx, retaining its tier, target, reward,
progress and payout state. Six missions, five free changes and the all-six streak
goal are unchanged. No earned progress or inventory is deleted.

On PC and mobile, the boss name sits below the HP strip on the left. The
short objective and Peril/phase metadata share that same row, with the objective
immediately left of Peril. Each has its own grid cell to avoid overlapping.
Twins show two individual HP bars instead of a duplicate aggregate bar. Player
names and HP stack in a small left column below the boss, including solo. Down,
target and trap alerts stay attached to their player and do not resize the court.
Battle has one gear in the upper-right corner; Settings contains Fullscreen and
Practice. Exit test mode remains inside Practice. Team signals open from a small
popover instead of a permanently expanded rail. Mechanic tools follow the real
skill-cluster height (including saved control sizes): mirror/Look away and twin
targets are compact buttons on the same horizontal row near the right edge, above the skills. Somnara
retains its private runes and four calls. The clock sits directly below the
upper-right gear; no bottom status band consumes court height. The repeated element/role caption below fighter art is removed.

A controlled four-player Chromium sample at default controls measured these
court heights before and after the layout change (CSS px):

| Viewport | Boss | Before | After |
| --- | --- | --- | --- |
| 844×390 | Grumblecrag / Prismatail | 280 | 329 |
| 844×390 | Storm Twins | 260 | 329 |
| 844×280 | Grumblecrag / Prismatail | 190 | 225 |
| 844×280 | Storm Twins | 167 | 225 |

This is about 17–35% more court height in these samples, without reducing render
resolution. The full court remains in view. It is a layout measurement, not a
physical-phone FPS measurement.

Validation includes ordinary multiplayer/reconnect and Peril checks, PostgreSQL
mission/reward/permission/replay tests, migration reapplication with earned coins
and six mission slots, all seven boss layouts, stable warning geometry and camera
bounds, mobile touch recovery and browser checks of the trimmed Raid Hub/Journey.

Mobile preview from the real client fixture: [raid HUD](raid-hud-mobile.png).
