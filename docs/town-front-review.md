# Town architecture review

The painted buildings now face straight down the town's north–south axis. Their front steps and eaves stay horizontal; the higher viewpoint is expressed through visible roof and canopy top surfaces. The fountain keeps the same approved placement and stone art.

Screenshots were captured in the real TownScenery renderer with the offline visual harness, rather than composited onto a map:

- [Raid Hall, houses, fountain and Arena Gate](town-front-architecture.webp)
- [Market and cottages](town-front-market.webp)
- [Windmill and Arena Gate](town-front-windmill.webp)
- [Tower and Training Grounds](town-front-tower.webp)
- [Animated fountain water and hovering crystal](fountain-water.gif)

Water runs down both tiers, with travelling highlights, falling droplets, splashes and ripples. The crystal gently hovers above its socket with a cyan halo and glints. Reduced motion freezes both layers.

Validation: client/server typecheck, 73 client tests, client production build, PWA asset checks and both fountain/town browser checks passed. All five town images load from the imported asset files, and the three new architecture images are included in the content-hashed offline precache.
