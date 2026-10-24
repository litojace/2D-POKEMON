# Saved outfits in town

Town players now use the same saved champion skin, Awakening stage, Colours and
aura as the wardrobe and the shared fighter renderer. A champion skin takes
priority over Colours; removing it reveals the Colours still saved underneath.
Removing an aura clears its ground effect. Auras remain anchored to the ground
while a champion jumps, and nameplates follow the posed fighter.

The server reads `arena_my_looks` and `arena_raid_progress` with the player's own
access token, then sends the verified wardrobe slots in the optional `look` field
of the existing town profile. The client still submits only its selected fighter.
It cannot choose another account's appearance or claim unowned cosmetics.
Equipment API changes refresh nearby viewers as well as the wearer, without a
rejoin. Failed lookups retain the last verified outfit. Late results cannot
overwrite a newer save, fighter selection or town visit; unchanged profiles are
not resent. The optional level lookup does not block cosmetics.

Town keeps the old complete outfit visible until the new skin's textures finish
loading. Repeated switches cannot install an outdated rig. Equipped entrance
animations play on arrival and on the Wave emote; GG uses the equipped victory
animation. Movement interrupts these poses as it does in the existing renderer.
Portrait frames remain portrait decorations rather than floating above bodies.
Reduced motion retains the saved artwork and a still aura, without spinning or
particle effects. All visitors retain their skin ornaments and aura; extra
Mythical ambient particles are limited to the wearer and three nearby visitors.

This is cosmetic synchronization. It requires the matching server and client
release, but no SQL migration. Town movement, collisions, speed, jump rules and
combat values are unchanged. Checks cover authenticated multiplayer equipment
changes, forged look payloads, partial failures, stale responses, all eight
champions with stage III Mythics, colour precedence, aura removal, direction
changes, emotes, reduced motion, crowd rendering, and closing during a skin load.

Review images: [desktop](town-outfits-desktop.png),
[landscape phone](town-outfits-mobile.png).
