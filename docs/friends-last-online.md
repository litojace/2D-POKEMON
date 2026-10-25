# Friends: last online

Offline friend cards now show `Last online just now`, elapsed minutes, hours or
days, then a local calendar date for older sightings. A semantic `time` element
includes the exact date and time in the viewer's locale. Current online activity
remains authoritative. Missing history displays `Offline`; older players' dates
are not invented or inferred from their profile creation time. Labels keep aging
while the panel is open, including during a failed refresh, and the existing
focus, search, filter and scroll preservation remains in use.

`supabase/migrations/027_friends_last_online.sql` has been applied and verified on
the hosted Supabase project. It adds nullable `arena_profiles.last_online_at`, a self-only
`arena_touch_presence()` RPC using the database clock, and `lastOnline` in the
existing accepted-friends response. The timestamp stays private from nonfriends,
pending requests and anonymous users. Reapplying the migration preserves history.

The server records authenticated connections, throttles heartbeat writes to at
most once a minute per account, and forces a final write when the last connected
tab closes. Current presence still comes from live sockets. A bounded cache helps
with reconnects/database failures; persistence survives server restarts. Refreshed
tokens are used, duplicate pending final writes are coalesced, and idle cached
entries do not retain tokens. Presence RPCs have an eight-second network timeout,
and a clean server shutdown waits for its final writes. Unrecorded history starts
when a player next connects to the updated server; online clients also refresh
their sighting during the existing account checks.

Verification covers SQL ownership/permissions, request privacy, unknown history,
reapplication, multiple tabs, disconnects, restart persistence, late login, forged
identity input, write throttling, cache bounds, date boundaries and clock skew.
Browser checks at 1280×720, 844×390 and 568×320 cover status labels, exact dates,
long names, action spacing and focus/search preservation.

Review: [desktop](friends-last-online-desktop.png),
[landscape phone](friends-last-online-mobile.png).
