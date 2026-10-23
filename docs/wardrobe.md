# Wardrobe

Open **Wardrobe** from the home navigation rail or the Shop header. Choose a
fighter to see their complete equipped appearance, with separate slots for their
champion skin, shared colours, aura, entrance, victory and portrait frame.

The inventory combines owned Shop skins and collection pieces with earned boss
cosmetics. Champion skins are filtered to the chosen fighter; shared items remain
available across the roster. Champion skins take priority over the Colours slot,
and the wearing list explains when colours are covered.

Selecting an item tries it on without saving. **Equip**, **Take off**, and the
remove buttons in Currently wearing use the existing account endpoints. The
wearing list updates from saved account data. Failed saves leave the outfit
unchanged. Portrait frames have their own portrait sample; Entrance and Victory
controls replay the complete outfit's effects. Original skins remain available.

The inventory and wearing panel scroll independently, with the selected-item
information and save action fixed below them. Fighter arrows, native selection,
keyboard focus, controller confirmation/scrolling/Back, safe areas and reduced
motion are supported. Browsing changes only the preview and selected-card state;
the inventory stays mounted and only one live preview renderer runs.

On landscape phones, the fighter switcher and category strip stay pinned while
their columns scroll. The fighter's name is centered between equal-width arrows.
The default outfit summary is hidden; selecting an item reveals its save controls,
and save feedback uses a small status bar instead of restoring the outfit summary.

## Shop colour correction

Collection colour thumbnails previously used hue-rotation CSS filters while the
live rig used its authored three-tone palette. Static Shop and wardrobe art now
use an sRGB SVG filter generated from the same palette and luminance weights as
the rig. Eyes retain their original colours. Browser pixel comparisons cover 22
palettes with six sample colours each, within two RGB levels of the live pixel
transform. These filters also keep loading artwork consistent with the preview.

## Validation

- Typecheck, client production build, 948 root tests and 38 client tests pass.
- Twelve new client tests cover earned inventory, per-fighter skins, shared slots,
  non-mutating try-ons, colour precedence, awakening stages and explicit actions.
- Browser checks cover 1440 × 900, 1280 × 720, 844 × 390 and 568 × 320,
  all eight fighters, save failures, empty inventories, one-renderer cleanup,
  stable inventory nodes, safe areas, controller input and closing during loading.
- Changed files pass Prettier. The repository-wide check still flags existing
  formatting in untouched files.

No server, shared package, database, socket or gameplay changes are required.

Review images: [desktop](wardrobe-desktop.png), [phone](wardrobe-mobile.png),
[matched Shop colours](shop-colours-matched.png).
