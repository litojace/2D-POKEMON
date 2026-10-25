# Champion back illustrations

The approved rear designs were prepared as transparent source sheets:
`first-three.png` (Cindrake, Tidefin, Auralynx) and `remaining-five.png`
(Voltkit, Lumoth, Mystowl, Terradon, Duskveil).

Run `node apps/client/scripts/import-back-references.mjs` from the repository
root with Chromium and Playwright available. `PLAYWRIGHT_MODULE` can point to
an installed Playwright module. The importer removes transparent margins,
retains detached accessories, aligns each fighter's feet, and writes cropped
layers and source checksums to `apps/client/src/art/reference-backs.json`.
Source sheets are not deployed. The animation renderer joins these layers into
a continuous surface; the layers provide bone weights and skin decoration.
