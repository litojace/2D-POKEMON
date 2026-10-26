# Painted world materials

This pass brings the procedural scenery closer to the approved limestone and
turquoise fountain. The direction is a painted fantasy world with physical
materials and a consistent upper-left light, retaining the chibi champions.
It is a material and lighting pass, not a replacement of every illustration.

## Coverage

- Town buildings, roofs, plinths and props: mineral flecks, worn edges, timber
  grain, knots and woven awnings. Detail is clipped to each existing surface.
- Trees and shrubs: rounded light and shade, small leaf marks and veins.
  Grass grows in tapered clumps instead of rectangular strokes.
- Roads and squares: reusable bevelled stone paintings with fine mineral detail.
- Eight champions across all facings: subtle fur, scale, feather, stone or velvet
  marks follow the original articulated parts and equipped skin palette.
  Expressions remain clear. Side and back anatomy uses complete articulated
  parts in the same drawing style as the front.
- Seven raid bosses: material-specific body lighting, scale and feather marks,
  pearl highlights, soft cloud shading and mineral detail on rock facets.
  Fade opacity and Gloomshade's light-dependent shadow tell remain intact.
- Existing duel and raid floors already use grained materials and the shared
  camera/sun; their combat markings and stone-block collision areas are retained.

UI, hitboxes, navigation, damage areas and animation timing are unchanged.
All facings now use complete articulated body parts with painted joint overlap;
see [champion anatomy](champion-side-views.md).

## Performance and rebuilding

Town surface patterns are small cached 128-pixel tiles. Buildings and props are
painted once and reused on later visits. Road stones reuse small cached images
instead of running a separate clip/detail pass on every cobble.

The large ground painting is shipped as `public/assets/town/ground.webp`
(3200 × 2000). Town preloads it, avoiding the large canvas painting on phones.
The procedural painter remains the fallback if the asset cannot load.

Regenerate the ground whenever its geometry, materials, shadows or shared town
layout change:

```sh
PLAYWRIGHT_BROWSERS_PATH=/path/to/browsers node scripts/bake-town-ground.mjs
# Or use an installed Chromium:
CHROMIUM_EXECUTABLE=/usr/bin/chromium node scripts/bake-town-ground.mjs
```

The script launches its own temporary Vite server, invokes the real painter and
exports WebP; it does not depend on a running game server or account.

## Review

See [town comparison](materials-comparison.webp),
[fountain plaza](materials-plaza.webp),
[training grounds](materials-training.webp) and
[eight champions](materials-champions.webp), captured from the actual renderer.

Tests cover canvas clipping, holes, transforms, deterministic texture detail,
transparent washes, boss material bounds/fades, all champion materials and skins,
and existing desktop/mobile layouts and animation states.
