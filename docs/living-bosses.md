# Living raid bosses

All seven raid encounters now use detailed painted anatomy in the style of the
Raid Hall sculptures, with living colours, mineral facets, scales, fur, feathers,
and translucent storm glass.

[Actual animated rigs](living-bosses-motion.mp4) ·
[All seven bosses](living-bosses.webp) ·
[Desktop raid](living-bosses-desktop.webp) ·
[iPhone WebKit raid](living-bosses-iphone.webp)

The motion recording calls the real battle painters, using server-created
snapshots with idle, windup and exposed poses. It is a review stage, not gameplay
footage. The desktop and iPhone images show the actual client raid scene.

Complete anatomical parts rotate about overlapping joints. The head and torso
are never sliced into moving horizontal bands. Existing presentation clocks,
sounds, floor telegraphs, decoy tells, exposed-core indicators, defeat sequences,
and encounter state remain authoritative. Tidewyrm coils behind its head when
stranded; both facings keep the neck covered and the body over its ground shadow. The old vector art is a network-failure
fallback. The current encounter's atlas is loaded on demand; previous boss atlases
are released when an expedition changes encounters.

Validation: production build and PWA cache verification; 1,058 root tests and
94 client tests; seven focused Chromium browser checks and three WebKit checks cover
animation, pause/reduced motion, immutable snapshots, stale-clone/submerge cleanup,
fades, atlas replacement/revisit, failed asset requests, and real desktop/iPhone
raid rendering.

Source PNGs and exporter details are in
[`apps/client/art-source/bosses/articulated`](../apps/client/art-source/bosses/articulated/README.md).
