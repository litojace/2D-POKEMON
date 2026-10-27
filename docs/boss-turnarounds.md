# Living boss turnarounds

All seven bosses now show front, rear, left and right views as they travel or aim
an attack. Emberwing has all four directions in flight and on the ground, with
an animated wingbeat in each flying view. Tidewyrm has both swimming and low
stranded turnarounds; Fizz and Crackle retain their own colours and expressions.
All action poses remain complete authored creatures with connected anatomy.

[All boss views](boss-turnarounds.webp) ·
[Emberwing changing direction in combat](boss-turnarounds-combat.mp4)

Moving bosses face their travel direction. A live windup and its strike face the
locked warning geometry, so a steering update cannot turn its body away from the
actual cone or charge. Small diagonal changes do not cause rapid flipping; paused/dead bosses
hold their heading. Reduced motion retains the correct direction without moving
secondary details. The mirrored profiles preserve the same foot/talon pivot.

The gallery uses the actual battle painters on a plain review background. The
combat capture runs the actual client and server cast handlers in the local
visual harness, without an account/rewards connection. Source/export instructions
are in [the art README](../apps/client/art-source/bosses/directions/README.md).

Validation covers the screen-space heading rules, attack priority, diagonal
hysteresis, pause/death/retry, all view/pose mappings, grounded and flying phoenix
frames, current-encounter texture retention, interrupted casts and production
PWA caching. Desktop Chromium and mobile WebKit checks exercise the actual raid.
