# Champion skill effects

All 40 roster moves now layer material accents over their existing authored
animations. Basics have restrained tapered wakes and short contact beats;
specials add distinct cast/impact shapes and moving ground inscriptions;
ultimates add a delayed second crown of fragments. Each element has its own
silhouette: forked electricity, flame blades, water crests, crystal facets,
wing petals, constellation stars, fractured stone and hooked shadow wisps.

The primary colour still comes from the equipped champion skin. Projectile,
beam, zone, melee and explosion dimensions come from the actual ability passed
by the snapshot/event, including EX and rite modifications. Server damage,
collision, range, cooldowns and cast timing are unchanged. Ground inscriptions
remain within the existing hit area; decorative travelling tails do not add a
new damaging perimeter. Effects and timed impacts sort behind stone cover.

`skill-fx-signatures.ts` decorates all eight kits after the authored ultimate
passes. `fx-engine.ts` runs kit timelines on shared, depth-sorted Graphics layers
instead of creating an empty Graphics object and tween for each cast. Timelines,
particles and sprite pools are bounded, and scene shutdown removes callbacks.
Core cast timelines take precedence over optional accents when saturated.

Compact screens and coarse pointers use lower limits: 280 physical particles,
64 glow sprites, 32 floor glows, 40 soft sprites and 32 active timelines (up to
eight optional accents). The per-frame decoration budget reserves work for cast
and impact beats even when projectiles fill the screen. Reduced motion skips
these new ornamental layers while retaining the authored core feedback.

Validation covers every roster move and EX impacts on desktop/mobile, real
four-player combat, unchanged ability data, cover ordering, pool reuse,
saturation, scene cleanup and reduced motion. The isolated review stage in
`tests/visual/harness/skill-fx-review.ts` renders the real effect code at repeatable
phases; it is not part of the shipped game.
