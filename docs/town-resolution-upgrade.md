# Village sharpness, roster portrait and Champions' Obelisk

The small buildings previously came from roughly 392px-wide cells. At the
1440×900 desktop default view, a cottage occupies approximately 662 physical
pixels on a 2× display. The new cottage sources retain about 949 horizontal
pixels within their normalized runtime frames. Original master detail varies
by building; this is not a blanket claim of 4K source art.

Buildings, tree crowns/trunks and eligible street props now reuse their source
texture frames directly. The old canvas reduction before camera enlargement
has been removed for these objects. Each cottage reuses its variant's texture
rather than allocating a new canvas. Power-of-two architecture storage enables
trilinear mip filtering, keeping roof tiles stable when zooming out. GPU storage
aspect ratios are restored to the canonical world geometry when drawn.

The fountain uses its full master, with two images sharing one source. A native
geometry mask retains the original upper-layer silhouette, so water trajectories,
column placement and foot contact remain aligned.

Small installed iPhone views use a 2× buffer (previously 1.5×), while large iPad
windows are limited to about two million buffer pixels. Battle retains its own
1.5× iOS limit. Resizing updates both the buffer and its CSS scale. Existing
renderer recovery, battle disposal and safe PWA update behavior are retained.
This improves rendering density; it is not an unbounded native-device-pixel mode.

Terradon's roster crop changes from `22 -8 156 156` to `30 3 140 140`, giving its
head more presence while keeping its eye line within one pixel of the other
portraits in the desktop review. Its sprout remains visible. Champion anatomy
and the full fighter preview are unchanged.

The Champions' Obelisk now uses a detailed ivory stone, gold and amethyst
illustration, fitted to its existing 116×322 reserved sprite and ground anchor.

Town cast shadows are slightly darker (opacity 0.43 instead of 0.34) and less
diffuse, including the rebaked ground layer. Boss names are positioned from the
gold plaque's actual source rectangle; measured glyph bounds determine fitting
and optical centering. Two-word names use two lines within the same plaque.

Player names and titles follow the character's map position independently of
the animated rig. Idle hover, bob and jump motion no longer move the lettering.
Floating characters retain fixed clearance above the top of their idle pose;
the existing name/title gap and title effects remain intact.

Actual client captures:

- [Desktop default, after](town-hd-pc.webp) / [before](town-hd-before-pc.webp)
- [iOS Home Screen default](town-hd-mobile.webp)
- [Roster](town-hd-roster.webp)
- [Village and new obelisk](town-hd-overview.webp)
- [Boss plaques and stronger shadows](town-hd-bosses.webp)

Validation: full build and PWA verification; 1,058 root tests and 94 client unit
tests; browser checks for loaded HD bytes, native source reuse, actual mipmap
filtering, shared fountain source/mask, GPU texture estimate below 140 MiB,
and roster eye alignment. Chromium tests cover context loss/restoration and
Town → battle → Town disposal. Additional browser checks measure every boss
name against its plaque bounds and verify that Duskveil's name/title stay
steady across idle animation while following map movement. WebKit checks cover iPhone/iPad viewport changes
and resume/return behavior. Seven town views plus default and maximum zoom on
1× desktop, 2× desktop and installed-iPhone emulation were inspected without
browser errors. Physical iPhone/iPad testing remains separate from emulation.
