# Champion selection remodel

The home fighter drawer and PvP/raid lobbies now share a large animated showcase
and a bottom strip containing all eight fighters. Equipped Shop artwork and idle
animations use the existing shared preview renderer; there is only one live rig.
The element glow, static rays and outlined fighter name frame the artwork without
cropping tall crests or adding extra animated canvases.

Standing fighters have a feathered shadow with contact shading at their paws;
hovering fighters retain a softer floor beneath them. The background rays converge
at that ground plane and follow its rendered position when the panel resizes.
The SVG effects and animated canvas share the same frame on phones and desktop.
Element, range and role badges also share their height and text alignment.
Portrait-frame ornaments remain on avatars and the wardrobe frame sample instead
of floating above the full-size Home fighter.

The overview shows the fighter's description, range, role and comparative health,
speed and basic DPS bars. On larger screens the complete skill kit sits beneath
the overview; skill buttons highlight and scroll to their descriptions. Compact
screens retain Full kit for all four abilities, the basic attack, combo and shared
movement instructions. Values,
cooldowns, descriptions and key labels come from the current game definitions and
control preferences, rather than the example values in the supplied mockups.

Portraits preview a fighter without changing the player's confirmed champion.
**LOCK IN** confirms the preview; the accessible label includes the fighter's name.
The check on a portrait identifies the currently confirmed fighter. Lobby Ready
remains a separate action, and unreadying stays available while browsing. A new
preview must be confirmed before readying up.

On landscape phones the portrait strip stays below the showcase, filters open a
larger touch palette, and Full kit expands across the stage. Details scroll inside
their own region while Lock in stays visible. Existing room, invite, team, raid
challenge, Ready and Leave controls remain reachable through the room drawer.

Keyboard users can tab between controls and use Left/Right/Home/End on portraits.
Escape and controller Back dismiss the frontmost filter, full kit or skill detail
before closing the picker. Controller focus and scrolling use the same elements.
Reduced motion keeps the existing still preview behavior and disables transitions.

Validation covers 1440 × 900 and 1280 × 720 desktop, 844 × 390 and 568 × 320
landscape phones, safe-area insets, rapid browsing, filters, explicit confirmation,
repeated skill/full-kit changes, late mastery updates, visible actions and room
drawer controls. Browser fixtures remain outside production source.

Review images: [desktop](champion-picker-desktop.png),
[phone](champion-picker-mobile.png).
