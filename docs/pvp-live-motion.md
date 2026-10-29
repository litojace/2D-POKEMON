# Live PvP motion

Strong hits previously froze every fighter's displayed position and animation
for 55–110 ms while the authoritative server kept moving. Unrelated fights in
FFA/teams could repeatedly trigger this pause; any knockout also slowed all
animation and zoomed the camera while other players were still fighting.

Live combat now uses hit flashes, haptics and a short, bounded local camera
shake without global hit-stop. Knockout slow motion/zoom is reserved for a
non-playing phase. Damage, movement rules and server simulation are unchanged.

Battle nameplates retain unchanged text nodes/title styling. Their movement uses
transforms rather than rewriting left/top, leaving profile preview positioning
unchanged. Text changes still update immediately.

Validation: hit-feel/interpolation unit tests, four-player browser simulation,
and a browser regression that injects attacker/victim/unrelated critical KOs,
checks that the live scene never freezes/slows/zooms, checks stable text nodes
across frames and verifies subsequent name changes.

One local Chromium software-rendered comparison of the existing 5-second
four-player profile measured style recalculation time 0.395 → 0.205 seconds and
layout count 121 → 68. Frame timing was variable; this is evidence of reduced
DOM work, not a phone FPS benchmark or a claim that network latency is fixed.
