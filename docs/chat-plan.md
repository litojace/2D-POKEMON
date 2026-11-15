# In-game chat

The owner approved this plan on 15 Nov 2026 (Pacific Time), with the
recommended choices: quick chat only on the Plaza, opponents see each
other's emotes in a battle (with a mute), and the raid's team signals
join the battle's quick-chat button. Friends' direct messages are a later
phase.

## Channels

| Channel | Who is in it                                                      | Typing                       | Quick chat                                                              | Kept                         |
| ------- | ----------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------- | ---------------------------- |
| party   | The Lobby party (up to 4), wherever its members are               | Accounts, chat set to "free" | Yes                                                                     | Server memory, last 50 lines |
| room    | A private room (1v1, 2v2, FFA, raid), from joining to the results | Before and after the battle  | Yes; in a battle teammates see phrases and calls, opponents only emotes | Server memory                |
| place   | Everyone in the same Plaza copy; everyone on a Farm               | No (strangers)               | Yes, as bubbles over heads                                              | Server memory                |

No world or global chat, no guild chat, no voice. Guests use quick chat
only. A player's chat setting is free, quick (quick chat only) or off.

## Quick chat

`packages/shared/src/chat.ts` holds the catalogue. Clients send an id
(`gg`, `wave`), never text, so quick lines need no filter.

- Emotes (10): the Plaza's and the Farm's together.
- Phrases: Hi!, GG, Thanks!, Well played!, Nice!, Oops, Ready!, Let's go!,
  One more?, Wait for me, BRB.
- Calls, in a battle, for teammates: Attack!, Fall back, Help me, On my way,
  Group up, Careful!
- Raid signals (Stack on me, Revive me, Bait here) stay as they work now,
  in the same button.

## Filter and limits

`packages/shared/src/chat-filter.ts`: the name filter's words are masked
with `*`, links, email addresses and phone numbers are refused, and
invisible characters are removed. The server is the judge; the client runs
the same code only to warn first. Limits are in `CHAT_LIMITS`: 120
characters, one typed line every 1.2 s and 6 in 10 s, one quick line a
second, and the same line not again within 30 s.

## Moderation (App Store Review Guideline 1.2)

- Filter: the above, on the server.
- Report: tap a name in chat, then Report. The server attaches the lines
  itself (the reporter can't edit them). Three different players reporting
  someone within an hour stops that player chatting for an hour until an
  admin looks.
- Block: `arena_blocks` (migration 110). The server delivers nothing
  between two players when either one blocked the other.
- Contact: `support.html` and the privacy policy's address.
- Typing stays behind the server flag `CHAT_FREE_TEXT` until reporting
  ships.

## Phone layout

The chat button sits in the hub header (Lobby, Plaza, Farm, Bistro), 12 px
right of the profile chip. The gap there is 64 px at 667×375, 92 px at
844×390, 84 px at 852×393 and 124 px at 932×430. The chat opens as a drawer
from the left, `min(360px, 46vw)` wide. In a battle there is no drawer: a
quick-chat button sits top left, opposite the settings button.

## Steps

1. Shared catalogue and filter (this file, `chat.ts`, `chat-filter.ts`).
2. Server: `ChatHub` for party and room channels.
3. Client: the chat button and drawer.
4. Quick chat on the Plaza and the Farm; their emote buttons go.
5. Quick chat in battles; the raid's team-signals button goes.
6. Reporting, auto-mute, chat bans, the chat setting, migration (not
   applied until the owner says so), privacy and support pages.
7. Later: friends' direct messages.
