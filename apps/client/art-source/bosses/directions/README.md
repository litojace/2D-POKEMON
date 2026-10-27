# Complete boss turnarounds

These 18 transparent PNG masters add true front/rear/profile artwork to all seven
living raid bosses. Each 2×2 sheet contains whole-creature ready, anticipation,
strike and recovery poses in reading order. The Storm Twins sheets are 4×2: four
gold poses on top, four blue poses below. The grounded serpent sheet alternates
front/back by column; it holds a low resting pose rather than rearing up.

The existing whole-pose atlases remain in use. Tidewyrm's original drawings are
its right profile; Somnara's original drawings are its left profile. Their new
sheets supply genuine front and rear views. Prismatail also has a symmetric
frontal fan and two-eyed face. The other creatures retain their existing fronts and add rear/profile sheets. Emberwing has separate flight and
grounded turnarounds with visible side beaks and no face/white breast on the back.
Left/right profile mirroring applies to a complete creature, including its face,
body, wings, tail, feet and anchor; it never rotates a head separately.

Run `python scripts/export-boss-directions.py` with Pillow, numpy and scipy from
the repository root. The exporter separates whole connected character drawings,
preserves their native pixels and soft alpha edges, packs one additional atlas
per encounter and writes explicit view/mode/pose mappings to
`raid-directions-frames.json`. Each atlas stays below 4096 pixels per dimension.
The client keeps only the active encounter's original and directional atlases;
changing encounters or leaving the raid releases both. Artwork loading failures
retain the existing complete base/vector fallback without unlimited retries.

`BossFacing` follows server movement while travelling, aims toward the target
using the locked warning geometry during attacks, holds heading through a pause/death, and uses angular hysteresis
and a short turn interval to avoid diagonal flicker. Orientation still updates
in reduced-motion mode because it communicates travel/attack direction. Facing
selection changes no combat position, collision, warning geometry or damage.
