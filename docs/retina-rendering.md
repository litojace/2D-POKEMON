# Smooth fighter and nameplate rendering

Phaser inferred `pixelArt: true` from the fractional Scale Manager zoom used to
display a high-DPI drawing buffer at CSS size. That implicit setting overrides
`antialias: true`, selects nearest-neighbour sampling and sets pixelated canvas
interpolation. Retina desktop and iPhone therefore showed blocky fighters and
letter outlines even when their textures had enough pixels for the default
view. The same fractional-zoom configuration affected battle rendering.

Town and battle now explicitly set `pixelArt: false`. Their fighter layers use
linear sampling, and the browser interpolates the canvas normally. Existing
native HD building textures can also use their configured mip filters on
high-DPI devices. Source illustrations and rig geometry are unchanged.

Town names and titles update their text texture resolution at zoom/resize
boundaries, up to 6×. Before, maximum desktop zoom magnified 4× text textures
by 1.44×; iPhone magnified 3× text textures by about 1.81× in device pixels.
At the inspected maximum views, the new text textures cover those sizes
without source enlargement. Idle/hover nameplate positions, spacing, colors
and title effects are retained.

Drawing-buffer dimensions and the existing iOS pixel budget are unchanged.
This fixes texture and canvas interpolation; it does not promise unbounded
native-device-pixel rendering at every display size or zoom level.

Captured client comparison: [Retina desktop](retina-rendering-pc.webp) and
[installed iPhone emulation](retina-rendering-mobile.webp). The two sessions
include normal idle animation, so pose and camera settling differ slightly.

Validation: shared/client/server build and PWA precache verification; GPU
filter checks in real Town and battle renderers at desktop DPR 2 and installed
iPhone DPR 3; maximum-zoom text source coverage; Retina architecture mipmaps
and texture budget; existing steady-nameplate and plaque regressions. Chromium
checks cover context restoration and Town → battle → Town disposal. WebKit's
Home Screen resume/return flow also passes; its unsupported context-loss probe
is skipped. Device emulation does not replace physical iPhone testing.
