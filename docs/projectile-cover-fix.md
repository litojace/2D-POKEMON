# Attacks and stone cover

Two reproduced server bugs let stone cover fail near corners:

- Projectile creation jumped straight to a muzzle 30 pixels from the caster.
  That untested segment could cross a block corner, letting the shot start on
  its far side. A shot already overlapping cover could also move out before
  the first collision check.
- Beams checked only a thin center line instead of their configured radius.
  A beam's visible width could intersect a corner and still damage a target
  beyond it.

`projectileContact` now finds the first circle/rectangle contact along the whole
segment, including rounded corners and arena boundaries. Projectiles sweep the
muzzle segment and every subsequent movement step. Beams stop at the first
contact of their full width and send the clipped endpoint to the client.
Wall impacts use the existing impact/explosion handling and cover checks.

Regression tests reproduce both failures before the fix. They also cover clear
corner shots, fast projectiles, splash occlusion, both travel directions,
arena edges and stationary origins. Ability values, block footprints, damage,
cooldowns and socket message shapes are unchanged.
