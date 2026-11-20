# Full-viewport raid presentation

Boss fights and boss skill practice share a fixed overview camera. The drawing
surface fills the available battle stage on desktop and landscape touch devices.
The health display overlays this surface, and the camera fits the entire
1600 × 900 fighting floor below its measured bottom edge, with a 6 CSS px gap.
Uniform scale preserves circular warnings and hitboxes. On desktop, portrait
and with reduced motion, player movement, casting, downing and knockouts do not
pan or zoom the raid camera. Browser-bar resizing and changes in HUD height
recalculate the available view at the renderer's density.

## Phones in landscape: the follow camera

On a landscape phone (touch, at most 600 CSS px tall; tablets keep the overview) the whole court made fighters tiny and easy to lose
(owner, 20 Nov 2026), so raids and the Spire follow the raider there
(`RaidCamera` in `apps/client/src/raid-camera.ts`):

- The court covers the space below the HUD, then 1.2× closer (as in mobile
  PvP): fighters draw about 1.5–1.7× the size of the whole-court view. The
  court's top edge never goes under the HUD.
- The view leans 35% of the way toward the nearest boss, but the raider always
  stays inside the middle 62% of the view. A downed raider's camera stays on them.
- **Court-wide mechanics pull out** while they are marked, and the camera
  comes back in half a second after the last one. It frames only what the
  moment needs (`raidFrame`): every raider and boss, every marked warning, and
  the pieces its answer lies on (rune pads, islands, mirrors and skylights,
  braziers, the Quiet Zone, the polarity pad, lanterns and moonlight), padded
  for a fighter's art and name and keeping 7% of the screen clear at each side
  for the controls. When those span the court it is the whole court; sweeps
  (Breaker, Tidal Wave) always are. The zoom stays between the whole court's
  and the follow camera's. Which moments are court-wide is
  data, not per-boss code: `view: "court"` on the attack in `RAID_ATTACKS`
  (`packages/shared/src/raid.ts`), any warning at least 400 px across, and
  running mechanics whose answer may be anywhere (a dream's rune pads, the
  Quiet Zone, polarity partners, Mirror Charge, an airborne Lumiwick's braziers,
  Prismatail's light-relay mirrors, so that fight is always framed). A new attack whose safe spot
  can be off screen (islands, pads, a marked raider, braziers) gets
  `view: "court"`; a dodge that only needs the floor around the raider does not.
- The off-screen boss gets the PvP arrow circling the raider. Off-screen allies
  get a small arrow in their colour at the screen's edge (`ally-bearings.ts`); a
  downed ally's is red with a pulsing "!", so a reviver knows where to run.
- Players who prefer the overview tick **Whole court in raids** in Settings →
  Controls (phones only; `raidCourt` in the saved controls). The Ascendant
  specs that read the whole arena against the HUD and touch controls choose it.

Dim mirrored continuations of the current floor fill the newly exposed perimeter.
Eight images reuse the selected baked floor texture, including asynchronous art
refreshes; they introduce no extra image downloads or floor bakes. The brighter
central floor and its existing border define the fighting area. The perimeter is
scenery: collision bounds, spawns, boss mechanics and server coordinates remain
unchanged. Leaving a raid hides these images and restores the existing PvP/solo
practice camera and desktop HUD placement.

The visual layout checks cover all seven bosses in normal and skill-practice
states, small phone/browser-bar sizes and desktop shapes. They verify the HUD gap,
all four fighting-floor corners, unchanged camera position when a learner moves
to the edge, mechanic-control alignment, and the scene's shared floor textures.
