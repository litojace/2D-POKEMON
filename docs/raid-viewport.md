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
  for the controls. The middle of every marked warning and moonlight pool
  (`FRAME_CORE`, 65% of its radius: icon, order dots, crescent) also stays
  clear of the touch controls themselves: when the framed view would put one
  under the joystick or a button, the camera pans across the room the frame
  leaves and, if it must, pulls out toward the whole court's zoom
  (`raidFramePlacement`), keeping your raider clear of the controls' columns
  (below) throughout. Each control's box is measured with `ControlSides`. When those span the court it is the whole court; sweeps
  (Breaker, Tidal Wave) and dreams (their rune pads are laid out clear of the
  dream panel in the whole-court view) always are. The zoom stays between the whole court's
  and the follow camera's. Which moments are court-wide is
  data, not per-boss code: `view: "court"` on the attack in `RAID_ATTACKS`
  (`packages/shared/src/raid.ts`), any warning at least 400 px across, and
  running mechanics whose answer may be anywhere (a dream's rune pads, the
  Quiet Zone, polarity partners, Mirror Charge, an airborne Lumiwick's braziers,
  Prismatail's light-relay mirrors, so that fight is always framed). A new attack whose safe spot
  can be off screen (islands, pads, a marked raider, braziers, a chain of
  leaps that chases a raider like Shade Pounce) gets
  `view: "court"`; a dodge that only needs the floor around the raider does not.
- The off-screen boss gets the PvP arrow circling the raider. Off-screen allies
  get a small arrow in the allies' blue (as on their nameplates, whatever their
  champion's colour) at the screen's edge (`ally-bearings.ts`); a downed ally's
  turns red with a pulsing "!", so a reviver knows where to run.
- **Clear of the touch controls.** The joystick's and skill buttons' reach in
  from each side is measured once per layout (`ControlSides`, on the first raid
  frame after `fitRenderer` or after the controls are laid out again,
  `TouchControls.onLayout`). Your raider always stands between them, with
  about a fighter's half-width to spare; the court may scroll past the screen's
  edge for that, showing the dim scenery round it. The boss is kept clear too
  when both fit. A court-wide frame keeps your raider clear as well, zooming out
  only as far as that needs.
  When the boss still ends up under the buttons or the joystick, it gets the
  off-screen arrow, and right-side ally arrows sit by the buttons (never under
  them or over the clock).
- **Prismatail's Turn mirror / Look away** on phones are one round contextual
  button in the touch cluster's slot, left of skill 1 (above it on a narrow
  screen; `mobileLayout`'s `context`), as action games put an interact prompt
  by the skills. It shows only when usable: Turn mirror by a mirror, Look away
  while Glare winds up (taking the slot, with the wind-up as a gold ring). The
  follow camera keeps your raider clear of the slot. Desktop keeps both as
  labelled buttons.
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

## Phones: the shared top corners

Every raid and every Spire floor share one top layout on landscape phones
(owner, 21 Nov 2026), whatever the boss, now and in later updates:

- The quick-chat button in the top-left corner and the gear in the
  top-right, both 4px in from the safe area, the same size and height.
- The boss's (or floor's) HUD between them, with the same 56px clear on
  both sides, so its bar is centred on screen.
- Under them: the party's health on the left (screens/raid-party.css), the
  clock on the right (see-through glass, no blur: battles stay blur-free).
- A boss's own actions in the touch cluster's contextual slot by skill 1.

The rules use only `battle-raid` and `touch-mode` (no boss or floor
selectors), so a new boss or floor gets them as it is. Keep boss- and
floor-specific UI out of these corners. `tests/visual/raid-corners.spec.ts`
checks every boss in `RAID_BOSS_ORDER` (a new one is checked without a test
change), a Spire wave floor and boss floor, with and without the Dynamic
Island's insets.
