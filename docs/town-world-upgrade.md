# Village environment and iOS Home Screen recovery

The village now uses painted tree crowns/trunks, foliage, boulders, lamps, well, storage, notice board, wardrobe mirror, training targets, statue pedestals and animals alongside its painted buildings. Crops fit the existing sprite frames, so the new building/vegetation clearances remain in effect. The pond has a rounded stone shore, submerged pebbles, water-depth shading, lily veins/blossoms, moving caustics, fish, ripples and duck wakes. Ducks swim and dabble independently. Reduced motion freezes the pond movement.

Actual town renderer screenshots:

- [Whole village](town-world-overview.webp)
- [Pond and wildlife](town-world-pond.webp)
- [Market and village props](town-world-market.webp)

Home Screen rendering changes:

- Installed iPhone/iPad apps use at most 1.5 drawing pixels per CSS pixel; normal browsers use at most 2. Pointer conversion and camera scale use the same value.
- Returning to Town disposes the old battle renderer and its DOM labels/observers. It no longer retains every fighter and arena texture alongside Town.
- Source atlases are removed from the GPU after the smaller placed textures have been baked. Closed iOS towns also release the retained painting cache; late statue callbacks are ignored after disposal.
- On foreground/pageshow, paused drawing is resumed and sized again. Lost contexts can restore without navigation; if restoration stalls, an independent recovery panel offers Reload and reconnect without clearing login storage.
- Service-worker navigation fetches fresh entry HTML. Updates wait through the results screen until the player returns to Town/lobby.

Validation: client/server typecheck, 82 client tests, 32 focused unit tests, full shared/client/server build, 74-entry PWA verification, nine Chromium browser checks, and WebKit Home Screen lifecycle checking passed. Chromium also exercised real WebGL context loss/restoration and WebKit checked that the old battle canvas and labels are removed on return to Town. The final village was inspected in seven native camera views with no browser errors. These checks emulate installed-app behavior; they do not prove that every iOS OS-level process-eviction condition is eliminated.
