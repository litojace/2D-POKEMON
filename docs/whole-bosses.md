# Complete living raid bosses

This records the initial whole-pose upgrade. The current four-direction artwork
and combat capture are in [boss turnarounds](boss-turnarounds.md).

All seven encounters now use complete authored creature poses, including
Gloomshade and both Storm Twins. A whole pose replaces the previous collection of
independently rotated anatomical parts. Tidewyrm and Prismatail have continuously
painted head-to-neck silhouettes; Emberwing's face is level and its shoulders are
part of its complete wings/body drawing.

- Four complete ready, anticipation, strike and recovery poses per creature.
- Separate flying/grounded phoenix drawings and a low stranded serpent drawing.
- Whole-surface breathing, flexible wing edges and tendrils, with a short frame
  blend. No horizontal slicing of body artwork.
- Server telegraphs drive anticipation and release. Elemental ribbons, fragments,
  glows and a four-frame authored impact flipbook finish each cast.
- Paused combat holds its pose/effect age; reduced motion keeps a stable whole
  sprite. Copies and submerged bosses disappear with their original layers.
- Only the active encounter's body atlas stays loaded, alongside the shared
  4 MiB impact atlas. Scene shutdown releases both; failed art requests retain
  the existing vector fallback without an unlimited retry loop.

[All seven bosses](whole-bosses.webp) ·
[Motion study using the actual battle painters](whole-bosses-motion.mp4) ·
[Emberwing in the actual combat client](whole-bosses-combat.mp4)

The roster study uses server-created snapshots and the production painters, on a
plain review background. The combat clip uses the actual client, actual server
simulation and actual cast handlers through the local visual harness; heroes
have extra health only in that capture fixture. Neither fixture connects to a
player account or grants rewards. It is a presentation change: boss mechanics,
telegraph hit areas, damage, player movement and rewards are unchanged.

Source masters and export instructions:
[whole poses](../apps/client/art-source/bosses/whole/README.md) and
[spell flipbook](../apps/client/art-source/bosses/spells/README.md).

Validation: TypeScript, client art/lifecycle unit tests, server/shared unit tests,
production build and PWA asset verification, plus Chromium desktop/mobile and
WebKit iPhone presentation checks. The browser silhouette check follows connected
opaque pixels from the serpent/peacock head into the body in every pose. Browser
checks also cover interrupted casts, pause/reduced motion, expedition texture
changes, submerging, copies, grounded serpent facing and asset-failure fallback.
