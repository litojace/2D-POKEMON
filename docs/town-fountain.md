# Central plaza fountain

The basin sits at the centre of the circle formed by the eight elemental
markers, sharing the plaza and compass inlay's centre. The fountain collision
uses that same position. The markers stand on a wider concentric ring and stay
clear of the basin.

The new illustration adds carved limestone, weathering at wet joints, bronze
collars, depth in the bowls and refracted light in the water. Transparent animated
water ribbons, falling droplets, landing ripples and a faceted crystal complete
the monument. Two matching image passes put rear streams behind the stone and
near streams in front. A procedural fallback remains available if the image
cannot load. Reduced motion leaves a still fountain.

The compact WebP is included in the offline precache. Source artwork and its
placement notes are in `apps/client/art-source/town/`. Client tests check the
basin against opposite pairs of markers and its clearance from all eight stones;
the town movement tests continue to check collision against the fountain.

[Actual animated scene, still frame](town-fountain.png).
