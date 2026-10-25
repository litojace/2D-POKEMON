# Central plaza fountain

The full monument's silhouette is centred on the plaza, rather than placing only
its basin at the centre. The authoritative fountain collision moves with the
visible basin. Eight element stones stand on a wider concentric ring and stay
clear of it; the compass inlay follows the same radius.

The new illustration adds carved limestone, weathering at wet joints, bronze
collars, depth in the bowls and refracted light in the water. Transparent animated
water ribbons, falling droplets, landing ripples and a faceted crystal complete
the monument. Two matching image passes put rear streams behind the stone and
near streams in front. A procedural fallback remains available if the image
cannot load. Reduced motion leaves a still fountain.

The compact WebP is included in the offline precache. Source artwork and its
placement notes are in `apps/client/art-source/town/`. Client tests check the
visual centre and clearance between the basin collision and all eight stones;
the town movement tests continue to check collision against the fountain.

[Actual animated scene, still frame](town-fountain.png).
