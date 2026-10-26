# Village ground materials

`materials.png` is the unmodified 1254 × 1254 generated source, four equal
627 × 627 panels: meadow, packed earth, warm limestone cobbles, honed slabs.
It is used only by `scripts/bake-town-ground.mjs`; the game downloads the
finished, content-hashed `src/art/town-ground.webp`.

The ground painter keeps the real map, fountain, entrances and obstacle
coordinates. Roads offset in the unprojected ground plane before applying
`WORLD_ART.groundY`. Paving has one global texture origin across roads and
courts, with open kerbs where lanes meet courts. Plaza rings rotate in the
ground plane rather than rotating already flattened stones.

Grass uses wrapped, softly blended samples to remove mirrored tile motifs.
Soil fades into the turf; tree roots get subtle contact earth. Building courts
use `architecturePlacement` so their steps match the painted foundations.
The fallback painter uses the same geometry and palette without source art.

Rebuild from repository root:

```sh
CHROMIUM_EXECUTABLE=/usr/bin/chromium node scripts/bake-town-ground.mjs
```

Rebaking changes the image hash, including its PWA precache revision. No extra
terrain atlas or live ground-painting pass is added to phones.
