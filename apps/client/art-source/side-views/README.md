# Approved side-view sources

These are the original reference sheets selected by the user. Runtime side
views copy their illustrations instead of approximating them with new shapes.

- `first-four.png`: Voltkit, Cindrake, Tidefin and Auralynx.
- `last-four.png`: Lumoth, Mystowl, Terradon and Duskveil.

To reimport, install ImageMagick and make Playwright/Chromium available, then run
`node apps/client/scripts/import-side-references.mjs` from the repository root.
Set `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` if they are not at the usual paths.
Format the generated JSON with the repository's Prettier command afterward.

The import records each source's SHA-256 checksum. It copies and partitions the
source pixels, with background matting and hidden joint/eye backing paint.
These source sheets are kept outside `public/` and are not deployed.
