# Painted world materials

The direction is a painted fantasy world with physical materials and a
consistent upper-left light, retaining the chibi champions.
It is a material and lighting pass, not a replacement of every illustration.

## Coverage

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

## Review

See [eight champions](materials-champions.webp), captured from the actual
renderer.

Tests cover canvas clipping, holes, transforms, deterministic texture detail,
transparent washes, boss material bounds/fades, all champion materials and skins,
and existing desktop/mobile layouts and animation states.
