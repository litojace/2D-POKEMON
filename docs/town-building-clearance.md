# Town building clearance and ground contact

The grey oval below Arena Gate was paving retained from the previous procedural coliseum. Its dimensions and centre did not match the painted base. The apron now follows the actual bottom ring in warm stone tiles, and the shadow and movement obstacle use that same footprint. The windmill approach runs around the outer wall instead of through the new footprint.

Building source crops, anchors and effect attachments now live in the shared `town-building-layout.ts` module. Tree and shrub placement reserves the complete visible roof, stair and storefront bounds, including maximum canopy size/sway and the windmill's rotating sails. Transparent baking margins are excluded from those bounds.

All three market stalls are spaced apart. The well, Wardrobe mirror, nearby lamp and storage crates have been repositioned to clear building art; their collision, interaction positions, paths and baked shadows move together. The Raid Hall is sized to leave room above its roof inside the map. The shipped ground has been rebaked from the runtime painter and receives a new content hash.

Actual in-game screenshots:

- [Arena Gate and its attached footing](town-clearance-arena.webp)
- [Market and Wardrobe](town-clearance-market.webp)
- [Whole town, including all seven houses](town-clearance-overview.webp)
- [Southern houses](town-clearance-south.webp)

Validation: 78 client tests, 16 town server/movement tests (including reachability of every station), client/server typecheck, the complete shared/client/server production build, PWA checks and the town asset browser check passed. The native town renderer was inspected across seven camera views with no browser errors.
