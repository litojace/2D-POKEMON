# Painted plaza fountain

`fountain.png` is the transparent source illustration. The deployed copy is
`public/assets/town/fountain.webp`, resized to 800 pixels wide at WebP quality 90.
The original source stays unchanged.

In source coordinates the basin centre is (660, 766). The runtime scale is
114 / 470 world units per source pixel. `paintedFountain` uses identical source
pixels for both passes: the full monument behind the water and a masked column
and bowls above rear streams. This keeps water behind solid stone while near
streams remain in front. Water and the crystal are animated separately.
