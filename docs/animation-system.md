# Animation system

The original-creature architecture, state handling, asset pipeline, implementation status and artwork requirements are documented in [the original creature overhaul guide](original-creatures.md).

Run `npm run dev` and open `/animation-preview.html` to test all eight fighters, four directions, every animation state, playback speed, attack/hurt interruption and reduced motion. The lab uses the same asset factory and renderer as the game and is excluded from production.

Current animation is articulated shaded-vector work. It has independent limbs/features, not just a bounced whole image. Artist-authored directional PNG frames, sprite sheets and atlases can replace it through each fighter's `animations.json`.
