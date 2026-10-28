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

A knocked-out PvP fighter cannot move, dash, jump, charge, channel or cast. The
server clears buffered actions immediately and rejects further actions; client
prediction and touch/keyboard/controller input follow the same rule. A burn that
kills a fighter during a tick also cancels their queued action. Already-fired
projectiles retain their normal behavior. Raid crawling and next-round control
remain available.

Knocked-out participants automatically watch a survivor, can switch with the two
arrow buttons, and automatically change targets if the selected fighter is down.
Teams prioritize a living teammate. This keeps the participant's existing room
seat. The phone PvP camera uses a 1.2× follow zoom instead of 1.65×: a 37.5% wider world view at the same viewport size. Projection and combat hitboxes stay in
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
