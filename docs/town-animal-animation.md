# Village animal movement

The new side-profile gull illustration was still receiving the old top-view
rotation (`heading + π/2`), which turned a right-facing bird nose-down. Painted
birds now face left/right with a horizontal flip and a small bank capped at
8 degrees. The procedural top-view fallback keeps its own orientation rule.

Previously, hen and gull animation texture keys reused a single illustration;
the puppy alternated two nearly identical poses. They now use 36 distinct
whole illustrated poses. The puppy has eight walk frames plus real sniffing,
standing and sitting poses; both hen coats have walk and feeding sequences;
birds alternate an eight-pose wingbeat with level glides, on independent clocks.

Dog and hen walk cycles follow distance travelled. Acceleration, braking and
hen steering ease into their target velocities. Hens pause independently to
peck and look up; the dog slows before resting or sniffing. Fixed body scales
and feet/body pivots stop per-frame size pumping. Whole poses preserve body
connections without moving rectangular cuts of an illustration.

- [Animated movement demo](town-animal-motion.gif)
- [Actual village view](town-animal-motion-in-game.webp)

Validation: full shared/client/server build; 88 client tests; PWA verification;
actual loaded animation atlas bytes match source; browser checks confirm every
walk, peck and wingbeat sequence has distinct nonempty painted frames; seven
village views inspected without browser errors. iOS WebKit resume validation
is recorded separately from physical iPhone verification.
