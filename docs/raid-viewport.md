# Full-viewport raid presentation

Boss fights and boss skill practice share a fixed overview camera. The drawing
surface fills the available battle stage on desktop and landscape touch devices.
The health display overlays this surface, and the camera fits the entire
1600 × 900 fighting floor below its measured bottom edge, with a 6 CSS px gap.
Uniform scale preserves circular warnings and hitboxes. Player movement, casting,
downing and knockouts do not pan or zoom the raid camera. Browser-bar resizing
and changes in HUD height recalculate the available view at the renderer's density.

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
