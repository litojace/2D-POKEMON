# Private-room invitations and PvP knockout flow

Players can open **Invite friends** in either a PvP or raid lobby and send an
invitation from an eligible friend's row. Room & ready uses this action in place
of room-code copying and invite-link sharing. In raid lobbies it sits above the
party roster; there is a single Invite friends button. The receiver gets **Join room** and
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

## Parties that last (Nov 2026)

Before, a party fell apart easily: the server dropped a member the moment
their connection did (a locked phone, an app switch), a friend invited
into a room was never in a party, and a member left in the old room missed
the leader's next one. Each time the team had to leave and invite again,
while the Lobby could still show the friend "in party". The party now
works like a team in most team games (Valorant, League of Legends, Brawl
Stars): it is the lasting unit and rooms come and go under it.

- **A short drop keeps your place.** A member whose last connection closes
  stays in the party for 60 s (`PARTY_AWAY_MS`, like the room's reconnect
  grace), shown faded with "reconnecting". Back in time, they are in the
  party again and their new tab is sent it straight away.
- **The party knows its room.** The leader's open room is in the party
  state (`room`). Members on the Lobby follow it at once; a member in
  another room follows between matches (lobby or results, never during a
  fight). A member who steps out of the party's room stays in the party
  and gets **Rejoin room** on the party bar (PLAY does the same) instead of
  being pulled back in. When the leader leaves the room, the party stays
  together with no room until the leader opens the next one.
- **A room invitation makes a party.** Joining a room through a friend's
  invitation puts you in that friend's party, so going back to the Lobby
  keeps you together. Joining by a code alone does not.
- **Invite buttons tell the truth.** The party state lists its open
  invitations, and the client remembers room invitations for their 90 s;
  every Invite button (Friends, Invite a friend, Raids, the Plaza) says
  **Invited** until the friend answers or it lapses, and **In party** /
  **In your room** once they are with you. A Decline (party or room)
  reaches the sender, whose button can then be used again.
- **The leader stands in the middle.** On every member's Lobby the leader
  is the big fighter in the middle with their name under it; you stand
  beside them, labelled "You" (a tap opens Fighters), and the arrows that
  step your own fighter wait. Only the leader sees the + Invite seats.

No database migration: parties stay in the server's memory. Tests:
`tests/multiplayer/party.test.ts` (drop and return, the party's room,
room invitation → party, Decline) and `tests/visual/lobby.spec.ts`
(member's stage, Rejoin, Invited / In party).

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
steadily moving opponent. The server simulation rules remain the same. This
improves rendering and visible jitter; it does not reduce the physical network
round-trip time. (Later: the fixed 100ms delay became an adaptive 80–200ms
delay with a rate-limited playhead, and the server applies one input per tick;
see [networking and battle performance](network-performance.md).)

A five-second controlled 4-player browser sample measured total scripting time
from 1.43s to 0.75s, and HUD mutations per snapshot from 48.2 to 6.2. Total main
thread task time changed from 2.44s to 2.08s. These are single-run observations in
headless Chromium with software WebGL, not physical-phone FPS guarantees. The
[sample data](pvp-performance-sample.json) includes the workload and CPU samples.
The visual performance test guards snapshot processing and the DOM-update budget
without asserting device-specific FPS or CPU durations.
