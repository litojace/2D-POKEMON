# Raid HUD and phone safe areas

The mobile HUD combined a safe-area left offset with a raw `100% - 56px`
width. With landscape notch insets, the right edge reached the Settings control
instead of reserving both safe areas. This affected every boss; limiting the
Twins' internal bars alone could not correct the containing HUD width.

The HUD now uses left/right insets and automatic width. Both single and twin HP
rows are bounded to their allocated grid area. Party names/alerts and the status
cue remain bounded; the gear and clock stay in their own safe corner.

The phone arena stage/frame now fills the viewport without safe-area padding,
rounded corners or a border. Existing illustrated surroundings cover the space
outside the playable floor, including behind the notch. HUD, touch controls and
revive status still respect safe insets. The overview camera continues to fit
all mechanics below the HUD; playable bounds and combat zoom rules are unchanged.

Downed status is a compact card in the lower-right control corner: short heading,
revive progress, one instruction and the attack name. Detailed attack advice
remains in the guide (and the desktop cause tooltip). The disabled skill cluster
is hidden while downed; crawling still uses the joystick. The card hides and
controls return on revival.

The regression first reproduced the incorrect HUD/gear overlap with 44px phone
insets. It covers all seven bosses, solo and co-op downed states, long teammate
names, Twin Rush practice, short/tall phones, desktop and browser-bar resizing.
Checks assert safe HUD/HP bounds, full-viewport canvas geometry, compact wrapping
and revival progress; Chromium and WebKit runs cover the phone cases.
