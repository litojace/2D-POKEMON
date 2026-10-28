# Private-room invitations and PvP knockout flow

Players can open **Invite friends** in either a PvP or raid lobby and send an
invitation from an eligible friend's row. The receiver gets **Join room** and
**Decline**, including while Friends is open. Joining uses the ordinary room
validation: a filled or started room cannot be joined. Invitations expire after
90 seconds, can be resent after 30 seconds, and never automatically leave a room
or interrupt a match. The server checks the authenticated friendship and the
current lobby again after the account lookup. No database migration is needed.

Lock In changes to **Confirming…** until its acknowledgement, then **✓ Locked in**.
The room control reads **Room · Ready up** and glows gently until the player readies.
Reduced motion keeps a static highlight. The mobile room control occupies the
empty left side of the top bar so its 44px target cannot overlap the fighter card.
Compact landscape lobbies use 8–18px of the previously empty bottom margin to
lower the header, room button and roster together without shrinking the preview.
After Lock In, the room button has a filled gold face, a forward arrow and an
outward beacon; reduced motion retains the filled highlight.

A knocked-out PvP fighter cannot move, dash, jump, charge, channel or cast. The
server clears buffered actions immediately and rejects further actions; client
prediction and touch/keyboard/controller input follow the same rule. A burn that
kills a fighter during a tick also cancels their queued action. Already-fired
projectiles retain their normal behavior. Raid crawling and next-round control
remain available.

Knocked-out participants automatically watch a survivor, can switch with the two
arrow buttons, and automatically change targets if the selected fighter is down.
Teams prioritize a living teammate. This keeps the participant's existing room
seat. Its viewing control now sits at the lower left in the space released by
the joystick, alongside the bottom utilities rather than over the upper court.
The phone PvP camera uses a 1.2× follow zoom instead of 1.65×: a 37.5% wider world view at the same viewport size. Projection and combat hitboxes stay in
the same world coordinates. Practice and the full-court raid camera keep their
existing views.

[Confirmed pick](party-lock-mobile.webp) · [Invite friends](party-friends-mobile.webp) · [Incoming invitation](party-invitation-mobile.webp) · [Survivor view](pvp-spectator-mobile.webp) · [Wider PvP view](pvp-view-mobile.webp)

Validation uses the real Socket.IO server with test accounts for authenticated
invites, multi-tab delivery, rejection and room-entry races. Simulation and
prediction regression tests cover knockout actions, lethal burn, spectator target
changes and recovery next round. The real client runs in Chromium and WebKit at
1440×900, 844×390 and 844×280; checks cover an invitation above Friends, confirmed
selection feedback, reachable room actions, sending one invite, camera width,
neutral input packets after knockout and restoring controls next round. Existing
raid viewport and trusted touch-recovery checks cover the shared layout/input
paths. This does not claim a physical iOS/Android device-to-device playtest.

## PvP frame-time and jitter changes

The 4-player profile identified repeated curve triangulation and redundant HUD
writes. Battle WebGL circles and rounded corners now use enough vertices for a
subpixel error bound rather than Phaser's fixed 100 vertices per arc (over 400 for
a tiny rounded HP bar). This is per Graphics instance, retains native Canvas
arcs and authored concave corners, and does not lower the renderer's resolution.
HUD text, styles and accessibility attributes are written when their values
change; the hidden desktop controls are skipped on touch while ultimate-ready
sound/state feedback remains shared.

Remote playback no longer resets its clock to each packet's arrival time. It
uses the least delayed recent arrival as the clock offset and a bounded,
monotonic playhead. Ordered packets arriving late therefore cannot rewind a
steadily moving opponent. The normal 100ms interpolation delay and server
simulation rules remain the same. This improves rendering and visible jitter;
it does not reduce the physical network round-trip time.

A five-second controlled 4-player browser sample measured total scripting time
from 1.43s to 0.75s, and HUD mutations per snapshot from 48.2 to 6.2. Total main
thread task time changed from 2.44s to 2.08s. These are single-run observations in
headless Chromium with software WebGL, not physical-phone FPS guarantees. The
[sample data](pvp-performance-sample.json) includes the workload and CPU samples.
The visual performance test guards snapshot processing and the DOM-update budget
without asserting device-specific FPS or CPU durations.
