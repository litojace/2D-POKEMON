# Instagram

The game's Instagram, @elementarena.usa: the profile, the posts and the
plan they go out on, run by Claude sessions through Meta's API ("Running
the account" below). The owner created the account and the Meta app.

Rules for everything posted (owner, 27 Nov): only the name Element Arena
and the game's own art and characters. Never compare the game with another
game or company, and never use their names or hashtags.

**The open beta** (owner, 27 Nov): the web game is an open beta, a first
taste before the App Store and Google Play apps, which will bring more
champions, skins and features. So the posts:

- say "open beta", and that it's free in the browser now;
- say the iPhone and Android apps come later, with more, but never give a
  date or promise a particular champion, skin or feature;
- ask players to report bugs: in the game, the gear at the top of the
  Lobby, then **Report a problem** (it needs a free account), or in the
  comments, which the scheduled runs thank and pass on to the owner;
- teach adding the game to the home screen early (the owner: friends keep
  asking how), with screenshots from a real phone, never drawings. The
  game's own steps are in the Menu, **Want fullscreen?**
  (`apps/client/src/fullscreen-help.ts`).

The game itself marks the web version BETA beside its name, never the store
apps (#645, the website session's; `docs/open-beta.md` once it is in).

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
npx playwright test --config scripts/instagram/playwright.config.ts
python3 scripts/instagram/make-reel.py
npx tsx scripts/instagram/make-posts.mjs
```

The first command records, in Poster:

- **the battles** (`battles.spec.ts`, about 8 minutes; `SCENE=duels,ffa`
  for some): the website's scenes (`scripts/site-clips/scenes.ts`, every
  fighter firing its ultimate within a few ticks), but as a phone shows
  them: **the whole screen, with the HUD, joystick, skill buttons and
  scoreboard** (owner, 28 Nov: battle pictures are full screen with every
  button, never cropped to the court), at the owner's iPhone size held
  sideways (956 × 440 at 3×, with the Dynamic Island's safe areas), one
  frame per tick in `instagram-clips/battles/<scene>/`. Pick each post's
  frame by eye: a big move going off, every fighter still in sight
  (`screen(...)` in `make-posts.mjs`);
- **the screens outside battle** (`screens.spec.ts`, `SCREEN=plaza,friends`
  for some): the Plaza during an Orb Shower (the page's clock is set into
  one) with made-up players placed by the Plaza's own coordinates, clear of
  lamp posts and the HUD, and the Friends sheet with made-up friends. Every
  coin count is blurred where it stands (the owner's rule for the website:
  no amounts of the game's money outside the game), so Journey, Ranks and
  mission rewards, which show coin amounts, are not used yet;
- **the three Mythical skins** in the game's fitting room at Stage III, in Poster
  (the spec calls `onPlayersLook()`), frame by frame on the page's own clock
  (about 6 minutes): standing, then each one's Entrance, Victory and
  Ultimate with their effects as the game draws them;
- `music.spec.ts` renders the game's own hub music (the tune the Shop plays)
  through the game's synth into `instagram-clips/music.wav`; `report.spec.ts`
  captures the Menu for post 10.

`make-reel.py`
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

### The home screen how-to (post 11)

Made from the owner's own iPhone screenshots (27 Nov: "a real phone, not
drawings"), which never go in the repo: they show the owner's contacts,
apps and player name. What the posts use from them, scrubbed and cropped,
is committed in `scripts/instagram/phone/`, so any session can rebuild
post 11 with `HOWTO=1 POSTS=0 npx tsx scripts/instagram/make-posts.mjs`. Only
new screenshots (a new iOS) need the raw ones: put them in
`instagram-clips/phone/` (ignored) as the phone named them, then:

```bash
python3 scripts/instagram/phone-howto.py --preview
HOWTO=1 POSTS=0 npx tsx scripts/instagram/make-posts.mjs
```

`phone-howto.py` pixelates and blurs for good what shows other people (the
share sheet's contacts), crops each step and writes where to ring what to
tap (`scripts/instagram/phone/steps.json`; `--preview` draws the rings on
`instagram-clips/phone/steps-preview.jpg` to check). Only Safari's steps and the icon come from
the phone: the game itself is shown from our own battles, the whole
screen with its HUD (`HOWTO_SHOTS` in `make-posts.mjs`: the duel's
lightning field, the four-way fight's chestnut storm), with the icon above
the phone so it covers nothing, never the owner's battle or Lobby
screenshots (the owner, 28 Nov; they also show their player name and
coins). `make-posts.mjs` then makes the carousel, `11-home-screen-1-feed.jpg`
to `-7-feed.jpg` (cover, five steps, done), and a story for each step and
the end, `11-home-screen-story-1.jpg` to `-6.jpg`.
A new iOS that moves a button needs new screenshots and new numbers in
`phone-howto.py`. Android is in the caption only, until someone sends
screenshots from an Android phone.

### Keeping the pictures current (owner, 28 Nov)

Other sessions keep changing the game's look, and the owner wants what goes
out to show the game as it is. A posted picture can't be changed (the API
has no edit), so this is about what is still to come: before an item goes
out, if a merge since its picture was made changed what that picture
shows, retake it, look at it, and ship it before its time. The pictures in
`apps/site/social/` were last made at the commit that last changed them
(`git log -1 -- apps/site/social/<file>`).

| Post                                                                 | Shows of the game                                                                            | Retake with                                         |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 2 Duels, 5 Teams, 7 Free-for-all, 9 Spire, 11's cover and last slide | a real battle, whole screen: court, fighters, effects, HUD and touch controls                | `battles.spec.ts`, then pick the frame again by eye |
| 3 Roster, 6 Pyranda                                                  | the fighters' drawings, names and elements (packages/shared)                                 | `make-posts.mjs`                                    |
| 8 Skins (Reel)                                                       | the Shop's fitting room in Poster, the Mythical skins                                        | `skins.spec.ts`, `make-reel.py`                     |
| 10 Found a bug?                                                      | the gear menu in Poster and Report a problem                                                 | `report.spec.ts`, then `make-posts.mjs`             |
| 11 Play it like an app                                               | the app icon, and Safari's steps (iOS, not the game)                                         | `HOWTO=1 make-posts.mjs`; new iOS: new screenshots  |
| 12 Plaza, 13 Friends                                                 | the Plaza (made-up players placed by world coordinates), the Friends sheet (made-up friends) | `screens.spec.ts`, then pick the frame again by eye |
| 1 Welcome, 4 Lumiwick                                                | paintings only                                                                               | `make-posts.mjs`                                    |

Every post's frame copies Poster (colours, fonts, slabs: the CSS in
`make-posts.mjs`), and captions name places in the game ("the gear, then
Report a problem", "Want fullscreen?"): when Poster's palette or the gear
menu changes, check the frames and the captions too. The sessions changing
the game's look were asked (28 Nov) to tell the Instagram session when
they merge.

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

## The posts

Their captions are in `scripts/instagram/plan.json`, which is what goes out
(`tests/unit/instagram-plan.test.ts` keeps them within the rules: at most
five hashtags, `#ElementArena`, no other game's name, at most 2,200
characters). Reports since December 2025 say Instagram caps posts at five
hashtags; five works under either rule.

| Post                        | Picture                                                                  |
| --------------------------- | ------------------------------------------------------------------------ |
| 1. Welcome                  | the duel at dusk (loading art), "Open beta · free in your browser"       |
| 2. Duels                    | a real duel, the charged beam into the lightning field                   |
| 3. The roster               | the 18 fighters' drawings on their elements' colours                     |
| 4. Raid boss: Lumiwick      | Lumiwick's raid splash                                                   |
| 5. 2v2 teams                | a real 2v2                                                               |
| 6. Champion spotlight       | Pyranda and its kit                                                      |
| 7. Free-for-all             | a real four-way fight in the Ember Forge                                 |
| 8. The Shop: Mythical skins | a Reel (below)                                                           |
| 9. The Spire                | a real Spire floor                                                       |
| 10. Found a bug? Tell us.   | the game's Menu, rings on the gear and Report a problem (report.spec.ts) |
| 11. Play it like an app     | a carousel from a real iPhone: Safari's steps to the home screen (above) |
| 12. The Plaza               | the Plaza in an Orb Shower, with made-up players round the fountain      |
| 13. Bring your friends      | the Friends sheet: a request, Invite, Join and Watch, the friend code    |

**Post 8**: Post `08-skins-reel.mp4` as a **Reel**, with `08-skins-reel-cover.jpg` as
its cover: the three skins' Entrance, Victory and Ultimate with their full
effects, to the game's own hub music. The API can't add Instagram's music
library, so the Reel carries its own sound; posted by hand, a track from
the library may replace it (a Business account gets its commercially
licensed part). `08-skins-feed.jpg` (the three at their
Ultimate's peak) is the still version, for a later post or Story.

## Posting plan (US Pacific time)

The plan is `scripts/instagram/plan.json`: each item's time, kind (post,
carousel, Reel or story), its files in `apps/site/social/` and its caption. That file,
not this page, is what goes out. Launch with three posts on the first day,
so a visitor from the website finds a full first row; a post every day of
launch week, each showing one more of the game's features (owner, 28 Nov:
the first days introduce what the game has); then three a week, Monday,
Wednesday and Friday. Posts go out at 5:40 PM PT (after school and work on
the West Coast, 8:40 PM on the East Coast). The day after each post, its story
version goes up at 11:40 AM PT. The API can't add a link sticker, so stories
point to the link in bio.

| Date (PT)           | Post                     |
| ------------------- | ------------------------ |
| Mon 30 Nov, 5:40 PM | 1. Welcome               |
| Mon 30 Nov, 5:40 PM | 2. Duels                 |
| Mon 30 Nov, 5:40 PM | 11. Play it like an app  |
| Tue 1 Dec, 5:40 PM  | 3. The roster            |
| Wed 2 Dec, 5:40 PM  | 4. Raid boss: Lumiwick   |
| Thu 3 Dec, 5:40 PM  | 12. The Plaza            |
| Fri 4 Dec, 5:40 PM  | 10. Found a bug? Tell us |
| Sat 5 Dec, 5:40 PM  | 13. Bring your friends   |
| Mon 7 Dec, 5:40 PM  | 5. 2v2 teams             |
| Wed 9 Dec, 5:40 PM  | 6. Pyranda               |
| Fri 11 Dec, 5:40 PM | 8. The Shop (Reel)       |
| Mon 14 Dec, 5:40 PM | 7. Free-for-all          |
| Wed 16 Dec, 5:40 PM | 9. The Spire             |

Launch day's three go out in this order, a minute or so apart, so the grid
(newest first) starts with the home screen how-to, which is what a new
player needs first (the owner: friends keep asking how). Its six stories
go up right after (5:45 PM), before any other story; the welcome and duels
stories follow the next morning, and the roster gets its own day.

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
questions (where to play: the link in bio; free: yes, in the browser, an
open beta; the phone apps: later, with more champions, skins and features;
fullscreen: add it to the home screen, the gear then Want fullscreen?), and
hide spam, scams and abuse. Never promise a date, a prize or a feature.
**A bug report** gets a short thank-you ("thanks, passed on to the team")
and goes to the owner with what the player said. Complaints, payments,
accounts or personal data, anyone who seems to be a child sharing personal
details, press and business: no reply from the session; it tells the owner
the same day. Every Sunday the session sends a short report: reach, the best post,
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
  `instagram_content_publish`, `instagram_manage_comments` and
  `instagram_manage_insights` (reach for the weekly report). The
  configuration also grants `instagram_manage_messages`,
  `instagram_manage_events`, `ads_management` and `ads_read`, which nothing
  here uses. No App Review: the app serves only the owner's own account.
- **If the token loses the account** (`me/assigned_instagram_accounts`
  comes back empty: on 27 Nov, linking the account to a Facebook Page while
  editing the profile took it out of the portfolio): add it back in
  business.facebook.com/settings → Instagram profiles, then in the app's
  Unified login setup → Generate access tokens, generate a new token as
  the portfolio's admin, and save it over the old one with the cloud
  environment's credential form. Permissions added to the configuration
  only reach a token generated after them.
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
- **Comments**: `publish.mjs comments` lists the last two weeks' comments
  the account hasn't answered or hidden (JSON lines with each comment's id);
  `reply <comment-id> <text>` answers one, `hide <comment-id>` hides one.
- **The scheduled task** "Element Arena Instagram" (on the owner's account,
  in the ELEMENT_ARENA cloud environment) starts a fresh session at 9:47 AM,
  11:47 AM and 5:47 PM PT every day. Each runs `due`, then goes through
  `comments` by the rules above, and ends with a short report in
  Vietnamese, pushed to the owner's phone when something happened or needs
  them. On Sundays the 5:47 PM run adds the week's report, and a run says
  so when fewer than five days of the plan are left. To stop it: "dừng" to
  any session (it sets `paused` in plan.json, or turns the task off), or
  turn the task off in the Claude app's scheduled tasks.
- **The pictures** are in `apps/site/social/`, served by the website at
  `https://elementarenausa.com/social/`, where Meta fetches them; a new plan
  copies its files there in the same pull request.
- **Not through the API**: the profile (name, bio, link, picture: the owner
  sets them in the app), music from Instagram's library, link and poll
  stickers, and DMs. So a Reel carries its own sound (the game's own music,
  `music.spec.ts`) and links stay in the bio.
