# Instagram starter pack

The game's first Instagram account, free: a handle, a bio, the profile
picture, nine posts with captions (one of them a Reel), and three weeks of
posting. The owner
creates the account (password, verification codes, CAPTCHA); a Claude
session runs it through Meta's API (owner, 27 Nov: "Running the account"
below).

Rules for everything posted (owner, 27 Nov): only the name Element Arena
and the game's own art and characters. Never compare the game with another
game or company, and never use their names or hashtags.

## Make the pictures

Everything is in the game's look, **Poster** (docs/ui-themes.md, owner,
27 Nov): the fighter's element colour with its halftone, ink slabs with the
white stripe, white clippings with hard offset shadows, skewed ink plates,
the red bar under PLAY, Anton capitals and Archivo text. It is built from
the game itself, never from the website (apps/site), which is redone apart:
its rules and skin names (packages/shared), its fonts
(apps/client/public/assets/fonts), the fighters' drawings
(apps/client/public/assets/fighters), its painted art and real captures.

```bash
VISUAL_UI=poster npx playwright test --config scripts/site-clips/playwright.config.ts scripts/site-clips/scenes.spec.ts
npx playwright test --config scripts/instagram/playwright.config.ts
python3 scripts/instagram/make-reel.py
npx tsx scripts/instagram/make-posts.mjs
```

The first command records the real battles in Poster (the same scenes as
the website's "Ways to play", about 7 minutes; the court is drawn by the
game's canvas, so the look doesn't change it). The second records the
three Mythical skins in the game's fitting room at Stage III, in Poster
(the spec calls `onPlayersLook()`), frame by frame on the page's own clock
(about 6 minutes): standing, then each one's Entrance, Victory and
Ultimate with their effects as the game draws them; the same config's
`music.spec.ts` renders the game's own hub music (the tune the Shop plays)
through the game's synth into `instagram-clips/music.wav`. `make-reel.py`
cuts the recordings into the skins Reel, puts the music under it (faded,
levelled to -14 LUFS) and picks each skin's still at its Ultimate's peak; `make-posts.mjs` (run with tsx, as it reads packages/shared) puts the
stills on post 8.

The pictures land in `instagram/` (not committed): `profile-picture.png`,
each post as `NN-name-feed.jpg` (1080 × 1350, 4:5), `-square.jpg`
(1080 × 1080) and `-story.jpg` (1080 × 1920), and the Reel,
`08-skins-reel.mp4` (1080 × 1920, 30 fps, H.264, 27 s, AAC sound) with its
cover `08-skins-reel-cover.jpg`. Post the **feed** version; use the
**story** version for Stories. The profile grid shows posts cropped to 3:4,
so every word sits 84 px or more from the left and right edges.

To change a post, edit its entry in `POSTS` in
`scripts/instagram/make-posts.mjs`;
`POSTS=6 npx tsx scripts/instagram/make-posts.mjs` makes only that one.

## The profile

- **Handle**, the first one free: `@elementarena`, `@elementarenagame`,
  `@playelementarena`, `@elementarenausa` (matches the website).
- **Name**: Element Arena
- **Category** (professional account): Video Game
- **Bio** (Instagram allows 150 characters; this is 102):

  ```
  Real-time creature battles ⚔️
  18 creatures · 9 elements · 7 raid bosses
  Free to play in your browser 👇
  ```

- **Link**: https://elementarenausa.com
- **Profile picture**: `instagram/profile-picture.png`, the app icon's
  circle-safe drawing (Instagram shows it in a circle).

Switch the account to a **professional account**, type **Business**
(Settings and activity → Account type and tools → Switch to professional
account, free; category Video Game). Business, not Creator: only a Business
account can publish Stories through the API (below). It also unlocks
insights and scheduling.

## The nine posts

Hashtags: at most five per post. Reports since December 2025 say
Instagram caps posts at five; five works under either rule.

### 1. Welcome (painted art, the duel at dusk)

```
Pick an element. Outplay your friends. ⚔️

Element Arena is a real-time creature battle game: 18 original creatures across 9 elements, live 1v1 duels, 2v2 team fights and raid bosses.

Free to play in your browser on phone, tablet or computer. No download. Link in bio.

#ElementArena #indiegame #mobilegame #pvp #browsergame
```

### 2. Duels (real capture)

```
Dodge. Dash. Land the big one. ⚡

Every duel is live: aim your skills, read your rival and time your ultimate. No turns, no waiting.

Play free, link in bio.

#ElementArena #pvp #indiegame #mobilegame #gamedev
```

### 3. The roster

```
18 creatures. 9 elements. 🔥💧⚡🌿

Fire, Water, Electric, Nature, Earth, Light, Shadow, Psychic and Aura, two champions each, every one with its own kit.

Who are you picking first? Tell us in the comments 👇

#ElementArena #indiegame #mobilegame #characterdesign #pvp
```

### 4. Raid boss: Lumiwick (painted art)

```
Seven bosses, seven puzzles. 🏮

Meet Lumiwick, a lantern with a temper. Every raid boss has one trick to learn: solve it solo or bring up to three friends.

Start with Cragmuff: one clear opens the other six.

#ElementArena #raidboss #indiegame #mobilegame #coop
```

### 5. 2v2 teams (real capture)

```
Better with a friend. 🤝

Team up in 2v2, stack your skills and wipe the other side. Tag the friend you'd queue with.

Play free, link in bio.

#ElementArena #pvp #indiegame #mobilegame #multiplayer
```

### 6. Champion spotlight: Pyranda

```
Champion spotlight: Pyranda 🔥

A shy red panda with a flame at the tip of its tail. Lobs burning chestnuts from the back line.

🌰 Chestnut Mortar: a burning chestnut over walls
🔥 Hot Coals: a patch that burns anyone in it
🧱 Ember Curtain: a wall of embers that burns up enemy shots
💥 Chestnut Storm (ultimate): five blasts march across the arena

Who should we spotlight next?

#ElementArena #indiegame #mobilegame #characterdesign #pvp
```

### 7. Free-for-all (real capture)

```
Four fighters. One winner. 🏆

Everyone against everyone in the Ember Forge. Watch your back.

Play free, link in bio.

#ElementArena #pvp #indiegame #mobilegame #battlegame
```

### 8. The Shop: Mythical skins (Reel)

Post `08-skins-reel.mp4` as a **Reel**, with `08-skins-reel-cover.jpg` as
its cover: the three skins' Entrance, Victory and Ultimate with their full
effects, to the game's own hub music. The API can't add Instagram's music
library, so the Reel carries its own sound; posted by hand, a track from
the library may replace it (a Business account gets its commercially
licensed part). `08-skins-feed.jpg` (the three at their
Ultimate's peak) is the still version, for a later post or Story.

```
Walk in a legend. ✨

Ashen Warlord, Abyssal Reaver, Hellforge: Mythical skins with their own entrance, victory and ultimate. Win in them to awaken them, stage by stage. Try anything on before you spend a coin.

All cosmetic, never stronger.

#ElementArena #indiegame #mobilegame #characterdesign #gameart
```

### 9. The Spire (real capture)

```
70 floors. How high can you climb? 🗼

Seven zones of ten floors, with an elite halfway up and a boss at the top of each.

Play free, link in bio.

#ElementArena #indiegame #mobilegame #indiedev #gamedev
```

## Posting plan (US Pacific time)

The plan is `scripts/instagram/plan.json`: each item's time, kind (post,
Reel or story), its file in `apps/site/social/` and its caption. That file,
not this page, is what goes out. Launch with three posts on the first day,
so a visitor from the website finds a full first row, then three a week:
Monday, Wednesday and Friday at 5:40 PM PT (after school and work on the
West Coast, 8:40 PM on the East Coast). The day after each post, its story
version goes up at 11:40 AM PT. The API can't add a link sticker, so stories
point to the link in bio.

| Date (PT)           | Post                   |
| ------------------- | ---------------------- |
| Mon 30 Nov, 5:40 PM | 1. Welcome             |
| Mon 30 Nov, 5:40 PM | 2. Duels               |
| Mon 30 Nov, 5:40 PM | 3. The roster          |
| Wed 2 Dec, 5:40 PM  | 4. Raid boss: Lumiwick |
| Fri 4 Dec, 5:40 PM  | 5. 2v2 teams           |
| Mon 7 Dec, 5:40 PM  | 6. Pyranda             |
| Wed 9 Dec, 5:40 PM  | 7. Free-for-all        |
| Fri 11 Dec, 5:40 PM | 8. The Shop (Reel)     |
| Mon 14 Dec, 5:40 PM | 9. The Spire           |

Launch day's three go out in this order, a minute or so apart, so the grid
(newest first) reads roster, duels, welcome.

Week 4: read Insights (Professional dashboard) for which post reached the
most people, and make more like it: the next champion spotlights, the other
six raid bosses (their art is in `apps/client/src/art/raid-splash/`), and
the first short Reels from the battle captures.

### Scheduling, free

- **Meta Business Suite** (business.facebook.com, or its app): Create post →
  pick the Instagram account → add picture and caption → Schedule. Needs the
  professional account; Business Suite asks to link a Facebook Page (it can
  be a new, empty one). Posts can be scheduled up to 75 days ahead; check that the time zone
  it shows is Pacific time.
- **The Instagram app** also schedules: on the last screen before Share, open More
  options (Advanced settings in older versions) → Schedule this post.

Reply to every comment in the first hour after a post; on a new account
that does more for reach than anything else in the plan.

## Running the account (owner, 27 Nov)

The owner is busy and handed the posting to Claude sessions: "có chứ"
(yes, post it yourself), and both ways of approving, "phòng hờ t quên"
(in case they forget):

- **(a) A plan every two weeks.** The session sends the next two weeks'
  posts (pictures, captions, dates in PT) to the owner, in its own session,
  with that session's link. Once approved, they go out as scheduled.
- **(b) Silence is a yes after 24 hours.** If the owner hasn't answered a
  plan within 24 hours of it being sent, the session posts it as planned.
- **Always the owner's yes first, never by silence:** anything about money
  (prices, coins for real money, in-app purchases), launch or release
  dates, giveaways and contests, partnerships and press, other people's
  pictures or names, and anything legal or about security. Nothing that
  breaks the rules at the top of this page goes out at all.
- **"Dừng" (stop)** from the owner stops all posting and replies at once.

Comments, checked three times a day: thank people, answer the usual
questions (where to play: the link in bio; free: yes, in the browser; the
phone apps: coming soon), and hide spam, scams and abuse. Never promise a
date, a prize or a feature. Complaints, bugs, payments, accounts or
personal data, anyone who seems to be a child sharing personal details,
press and business: no reply from the session; it tells the owner the same
day. Every Sunday the session sends a short report: reach, the best post,
new followers, and what needs the owner.

How it works: Meta's Graph API, the official and free route (never a
password: logging in as a person from a server breaks Instagram's terms and
gets accounts locked).

- **The Meta app** "Element Arena Social" (developers.facebook.com), in the
  business portfolio "elementarena.usa", use case Instagram API, **API setup
  with Unified login** (apps made since late October 2026 no longer offer
  "Instagram login"). Its configuration: a **system-user access token** that
  **never expires**, for the Instagram account @elementarena.usa (id
  `17841460513990684`), with `instagram_basic`,
  `instagram_content_publish`, `instagram_manage_comments` (and
  `instagram_manage_messages`, unused). No App Review: the app serves only
  the owner's own account.
- **The token** is a network secret on the cloud environment ELEMENT_ARENA
  for `graph.facebook.com`: its proxy adds it to every request, so no
  session, file or chat ever holds it. To revoke it, remove it in the
  environment's settings or the system user in the business portfolio.
- **Posting**: `node scripts/instagram/publish.mjs due` posts what is due
  (`list` shows the plan against the account; `due --dry` shows what would
  go; `check <id>` has Meta fetch one item without publishing). Node's
  fetch needs `NODE_USE_ENV_PROXY=1` to go through the cloud's proxy. It
  keeps the rules above: `paused` in plan.json stops everything; nothing
  goes before `approval.approvedAt`, or 24 hours after `approval.sentAt`;
  nothing is posted twice; a post more than 48 hours late, or a story more
  than 20, is left and reported. `tests/unit/instagram-plan.test.ts` checks
  the plan (every file served, captions within the limits and the rules).
- **The pictures** are in `apps/site/social/`, served by the website at
  `https://elementarenausa.com/social/`, where Meta fetches them; a new plan
  copies its files there in the same pull request.
- **Not through the API**: the profile (name, bio, link, picture: the owner
  sets them in the app), music from Instagram's library, link and poll
  stickers, and DMs. So a Reel carries its own sound (the game's own music,
  `music.spec.ts`) and links stay in the bio.
