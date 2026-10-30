# Equipped portrait frames

The avatar beside the player's name, level and XP now uses the equipped frame
in Town, fighter selection and room screens. A shared `framePortrait` wrapper
reuses the exact Wardrobe frame artwork, without changing avatar dimensions or
clipping badges. `AccountUI.syncAvatar` refreshes fighter, skin and frame as one
keyed update, so equip, clear and champion switches are immediate while unchanged
avatars keep their existing DOM nodes.

Spectator lobby avatars use the same framed portrait. Player/raid lobbies and
raid results retain their existing outer-container frame rendering, avoiding
double borders. Shop/champion pickers remain item previews rather than player
identity widgets.

Friends use the verified equipped frame from live Town/room appearance. Migration
`029_friend_portrait_frames.sql` also returns the saved frame to accepted friends
while offline; it reveals no inventory or request cosmetics. A known live clear
overrides saved data, while missing live appearance leaves the saved frame intact.
Unknown/non-frame IDs render the ordinary avatar rather than arbitrary styling.

Migration 029 has been applied to the configured Supabase project; execution
remains limited to authenticated players. A new deployment needs the same migration
after the existing account, friends, raid-loadout and last-online migrations.

Validation covers all catalog frame IDs, worn champion skins, offline friends,
SQL privacy, live appearance updates, and PC/phone layout and equip/clear behavior.
