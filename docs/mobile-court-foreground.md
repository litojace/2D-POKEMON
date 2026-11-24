# Mobile court foreground

Landscape touch cameras can reveal up to 96 world units below the four PvP
courts, matching the existing 96-unit allowance above the court. This is
presentation only: world height, collision, spawn positions and playable
boundaries remain 900 units. The camera keeps the same zoom and eased tracking;
only its lower clamp extends. Desktop framing and raid overview cameras keep
their existing bounds.

Each court has a static, themed 1600×96 foreground strip, baked at the same
density as its floor and cached once per visited court. Coliseum uses shallow
stone paving, Tide Pools uses offshore water, Ember Forge uses paving and grates,
and Shifting Ruins uses mossy paving. These are not mirrored/upside-down crowds.
The strip starts at world y=900. Cached strips hide when changing court or
entering a raid, and add no per-frame paint or asset download.

Camera unit tests verify symmetric edge clearance, unchanged zoom, coordinate
projection and previous default bounds. Browser checks visit all four lower
edges on normal/short landscape phones and inspect the rendered world bounds,
strip geometry and mode visibility. Existing arena checks cover desktop framing.
