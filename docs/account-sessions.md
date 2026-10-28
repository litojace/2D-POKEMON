# One active game connection per account

The most recently authenticated game connection owns the account's live seat.
Opening the account on another device or tab disconnects the previous socket,
removes its town/spectator presence and neutralizes its fighter's inputs through
the normal reconnect handling. A different account is unaffected. Token refresh
on the current connection keeps ownership; a pending authorization on a displaced
connection cannot reclaim it or create a room.

The displaced client shows **Playing on another device**, closes game panels,
and stops rejoining rooms. Its paused state survives a page reload in that tab.
**Play on this device** explicitly reclaims the seat; **Use another account** opens
sign-in. This is a game connection policy, not a global Supabase sign-out. No
Supabase migration or change to stored progress is required. The authority is the
same server process that owns the in-memory rooms.

Sign-in/sign-up results and duplicate Supabase auth callbacks share an in-flight
profile load. Each new profile load resets the gate to **Checking your account**
before notifying the view; the render key includes that loading state. A previous
signed-out check therefore cannot show a profile-error panel while sign-in or
sign-up is still loading. A real failed profile request still offers **Try again**,
which shows loading again and can recover normally. Intentional auth reconnects and cancelled requests from an older
socket do not produce connection-loss/server-timeout toasts. Temporary transport
connection errors retain the reconnecting status, while structured account
errors still show the real sign-in failure.

Validation uses real local Socket.IO connections with fake account verification
and the real browser client with the offline API harness. It covers takeover in
town and mid-match, reconnecting a reserved fighter, different access tokens for
the same account, pending practice/token authorization, invite delivery only to
the current device, repeated auth events while profile loading is held, cancelled
acknowledgements and explicit reclaim after reload. Chromium desktop/mobile and
WebKit checks include visible/reachable controls and account-error feedback.
These are automated checks, not a physical two-phone playtest or a live Supabase
sign-in test.
