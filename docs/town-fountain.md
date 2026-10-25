# Central plaza fountain

The basin sits at the centre of the circle formed by the eight elemental
markers, sharing the compass inlay's centre. The fountain collision uses that
same position. The markers stand on a wider concentric ring and stay clear of
the basin. The outer circular road has its own visual centre, 56 world pixels
farther up, framing the fountain's full height. Its cobbles, moss and perimeter
lamps follow that centre; signposts remain beside the roads at their new exits.

The new illustration adds carved limestone, weathering at wet joints, bronze
collars, depth in the bowls and refracted light in the water. Transparent animated
water ribbons, falling droplets, landing ripples and a faceted crystal complete
the monument. Both cascades start at their painted rims and accelerate toward
the pool below. Highlights, small splashes and spreading rings share the same
impact clock; varied stream widths and phases avoid a uniform curtain of water.
Two matching image passes put rear streams behind the stone and
near streams in front. A procedural fallback remains available if the image
cannot load. Reduced motion leaves a still fountain.

The compact WebP is included in the offline precache. Source artwork and its
placement notes are in `apps/client/art-source/town/`. Client tests check the
basin against opposite pairs of markers and its clearance from all eight stones,
the full monument's framing within the road, and perimeter lamp placement;
the town movement tests continue to check collision against the fountain.
Water tests also cover rim alignment, landing bounds, downward acceleration and
reduced motion. A browser check verifies visible movement at both cascade levels
and identical frames with reduced motion enabled.

[Actual animated scene, still frame](town-fountain.png).
[Water animation close-up](fountain-water.gif).
