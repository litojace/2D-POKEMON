# Element Arena website (`apps/site`)

These notes live in `docs/` rather than in `apps/site/`, because everything
in `apps/site/` is served to the public as it is.

The public front page for the game: what it is, the champions, modes, raid
bosses, real screenshots, "coming soon" for the apps, and **Play now**
buttons into the game at `https://play.elementarenausa.com/`. Phones come
first (owner, 25 Nov): check portrait and landscape phone sizes before desktop.

It is static HTML and CSS with one small script (`site.js`, no libraries)
and no build step on the server, kept apart from the game: nothing here is imported by `apps/client`, it is not in
the game's build, its precache or its CI build, and the game never loads it.

```
apps/site/
  index.html          the page (all copy lives here)
  site.css            styles: Poster, the game's look (ink, element colours, Anton, Archivo)
  site.js             the pause switch, skin loops, pickers, champion panel, transitions
  fonts/              the game's own woff2 files (OFL licences beside them); Barlow
                      Condensed and DM Sans stay for the Support and Privacy copies
  img/                images made from the game's art by tools/make-images.py;
                      img/skins/ the skin loops' posters and thumbnails
  media/skins/        the skin loops (MP4, 60 frames a second), tools/make-skin-clips.py
  robots.txt, sitemap.xml, favicon.ico, favicon-32.png, icon-192.png, apple-touch-icon.png
  tools/make-images.py   regenerates img/ and the icons from the game's art
  tools/demo.mjs         builds a one-page preview for a claude.ai Artifact
```

## The look: Poster (owner, 27 Nov)

The game moved to Poster for every player (docs/ui-themes.md), so the
website did too, "in a professional style with today's panel transitions".
The tokens are Poster's (`apps/client/src/themes/poster/tokens.css`): ink
`#0d0d0f` and its three lifts, white words, `--dim` greys, the hot red for
stickers and offset shadows, and the game's element colours; nothing is
rounded (the phone mock-up and Apple's sign-in button are the exceptions,
as real objects); shadows are hard offsets, never blur or glass; Anton
capitals for titles, labels and buttons, Archivo for text and numbers that
line up (Anton has no tabular figures). The page's own colour is Electric's
yellow, as the game's gold before a fighter is chosen; a champion card, a
boss or a Shop piece brings its own colour (`--el`). Words on a colour are
ink, as in the game. Pieces taken from the game's screens: the Lobby's
halftone and its huge outlined name (the hero, the champion panel, the
footer), slanted tabs (the nav, the element filter), the red rotated badge
(section stickers, "Free to play"), cards that lift on a hard shadow in
their element's colour, and slanted slab edges (the raid panel, the roster
cards' art).

## Open beta (owner, 28 Nov)

The hero carries an "Open beta" sticker beside "Free to play" (ink with the
page's yellow, leaning the other way), and one line under the buttons: the
game is in open beta, still being added to and polished, and progress
carries over through every update. That last part is true of the code:
progress lives on the server, and nothing plans a wipe (the only reset is
the monthly ranked soft reset, `arena_season_reset()`). The App Store build
of the game shows no beta mark (Apple's Guideline 2.2); that switch is the
game's, not this page's.

## Easy to read (owner, 28 Nov: "đảm bảo nội dung text dễ đọc cho khách hàng")

- **Contrast, measured on the pixels:** `tests/visual/website.spec.ts`
  ("every word reads at AA contrast") shoots each screenful with its words
  hidden and compares every word's colour with the middle of the pixels
  under it (as `poster-contrast.spec.ts` does for the game): WCAG AA, 4.5:1,
  3:1 for large text. It runs over the whole page at 390 × 844 and
  1440 × 900, every Shop piece, and the champion panel in each element's
  colour, top and bottom.
- **No words on texture:** the hero's halftone fades out above its words,
  the outlined "Element Arena" sits behind the painting, and the panel's
  skin count is on an ink block, not the halftone.
- **Sizes:** sentences 16 to 17 px, secondary lines at least 15 px, small
  capital labels at least 14 px; the skill tabs' names are 12.8 px and
  hidden under 480 px wide (the move below names it in full).
- **Words:** US spelling on the page's own copy (center, practice; names
  and descriptions from the game stay as the game writes them), and plain
  lines over gamer shorthand ("beat it once and the other six open", "every
  piece changes your look, never your power"). "Coming soon" is white on the
  red fill: the red as words on ink was 3.65:1.

## Champion data comes from the game

`data/champions.json` (stats, basic attack, three skills, the ultimate,
featured skins), the roster cards, the raid panels and the Shop spotlight in
`index.html` are written from the game's code:

```bash
npx tsx apps/site/tools/gen-data.ts && npx prettier --write apps/site/index.html
```

`tests/unit/site.test.ts` fails when the JSON no longer matches
`packages/shared` (a balance change, a renamed skill, a new skin), so CI
says when to run it. The panel's text is the game's own skill descriptions.

## Ways to play, the raid bosses and the Shop

Skill clips in the champion panel and the "Straight from the game"
screenshot strip were tried and taken out (owner, 26 Nov: they looked too
much like Ways to play). The panel shows the game's own skill text.

### Ways to play: real fights, not paintings

The mode cards show the game itself (owner, 26 Nov: the
painted loading art is decoration, and a feature should show the feature in
play, with skills going off). `scripts/site-clips/scenes.spec.ts` stages each
mode in the real client and simulation (a duel, 2v2, free-for-all, a raid on
Lumiwick, a Spire floor) with every fighter firing its ultimate a tick or two
apart, and writes a frame per tick at three device pixels;
The Plaza is the App Store capture. `make-scenes.py` holds the chosen frame and crop for
each, picked by eye:

```bash
npx playwright test --config scripts/site-clips/playwright.config.ts scripts/site-clips/scenes.spec.ts scripts/site-clips/shop.spec.ts
python3 apps/site/tools/make-scenes.py   # -> apps/site/img/modes/, img/shop/
```

### The Shop spotlight

"Make it yours" is the Shop's window (owner, 26 Nov: Shop items and effects
sell better than raid rewards, mastery and friends; then "the Shop looks
boring"). One piece at a time on a lit stage: its loop from the fitting
room at 60 frames a second (below), light rays turning behind it in its
rarity's colour, sparks rising, its name, collection, kind and line, and
"Try it on in the Shop". Six pieces to pick from under it (three
Legendaries from three collections, two Mythicals, a victory); it turns to
the next every 7 s while on screen and motion is on, until the reader picks
one.

- **No prices, and no word of the game's money** (owner, 27 Nov: "tránh
  nhắc đến số tiền trong game"). The page says what a piece is and that
  every piece is cosmetic, never what it costs; the coin icon and the
  "spend a coin" line are gone. `site.test.ts` ("never names an amount of
  the game's money") fails on "coin" or "gem" in the page's words, on any
  Shop price of 1,000 or more written either way, or on a price in
  `data/champions.json`.
- The words are written by `gen-data.ts` from the catalog
  (`packages/shared/src/shop.ts`: names, rarities, collections, lines,
  `MYTHIC_TRIAL_WINS`); `site.test.ts` fails on a name the Shop doesn't
  sell, a wrong rarity, or a missing loop, poster or thumbnail.
- To show other pieces: `SHOWCASE` (gen-data); a piece that is not a
  featured skin also goes in `SPOTLIGHT_EXTRA` (skins.spec.ts).

### Skins with their effects, at 60 frames a second (owner, 27 Nov)

"Skin tướng nên có đủ hiệu ứng full … tăng số khung hình lên luôn cho
mượt": every look the champion panel shows (the Classic look and the four
featured skins of each champion, 90 loops) and the spotlight's pieces play
as the fitting room plays them, at 60 frames a second. The panel and the
spotlight used still SVGs and 17-frame-a-second WebP loops before.

```bash
npx playwright test --config scripts/site-clips/playwright.config.ts scripts/site-clips/skins.spec.ts --workers=4
python3 apps/site/tools/make-skin-clips.py        # -> media/skins/, img/skins/
```

- **What each loop plays** is the fitting room's own showcase cycle
  (4.4 s, `shop-preview.ts`): a Mythical casts its ultimate at Stage III
  (the "Ultimate" button), a Legendary plays its victory, a victory item
  plays on Voltkit, and the Classic look stands in its idle. The recording
  starts where the stage's clock (`data-animation-time`) crosses a cycle,
  so the loop is one whole cycle; the idle has no cycle, so
  `make-skin-clips.py` finds where it comes back round (the stretches closer
  to the first frame than their neighbours) and takes the shortest nearly
  as close as the best: one breath, 2.6 to 3.4 s (Lumoth's and Terradon's
  ambient effects turn slower, so theirs are about 5.5 to 6 s). Eight frames past the end are blended into the start, so
  nothing jumps where the loop wraps.
- **How 60 frames a second come off a machine that draws a few:** the
  stage runs on Playwright's clock. Time is paused and moved on 16 ms
  between screenshots, so a frame takes as long as the CPU renderer needs
  and every frame is in its place. Steps of 1000/60 ms let two animation
  frames through on every 25th step (Playwright's clock runs them every
  16 ms): the loop jumped 2.5 times a second. With 16 ms steps encoded at
  60 frames a second the loop plays 4% slower than the game, which no one
  can see.
- **One file per loop, H.264 MP4**, 720 x 720, CRF 28 tuned for animation,
  fast start, no sound: an idle 42 to 299 KB (most under 110), a
  Legendary 154 to 391 KB (median 230), a Mythical 253 to 363 KB (median
  296); 21 MB for all 92, and 2.9 MB of posters and thumbnails. VP9 and
  AV1 (WebM) came out larger than H.264 on these stages, and older iPhones
  play no AV1, so there is no WebM. (Playwright's own Chromium has no H.264;
  the cloud container's Chrome for Testing plays it.)
- **Posters and thumbnails:** `img/skins/<name>.webp` is a frame with the
  effect in full (shown until the loop plays, in Low Power Mode, and while
  motion is paused); `<name>-thumb.webp` (192 px, cut closer) is the skin
  strip's and the spotlight picks' picture.
- **Loading:** only a loop on screen plays (IntersectionObserver), the
  spotlight's loops wait with `preload="none"`, and the panel loads the
  look picked. `site.test.ts` checks every look has its loop (under 900 KB),
  poster and thumbnail. The loops and posters don't count toward the fast
  lane's file limit (`scripts/merge-lane.mjs`, `siteAsset`).

### The champion panel

A `<dialog>` in Poster: the champion's colour with halftone and its name
huge and outlined behind a framed stage (the loop of the look on show, its
name in a tag across the frame's corner, the pause switch), the skin strip
(Classic, then the featured skins, rarest first), previous / count / next
under it; the details in an ink column (element tag, name, role, stats as
slanted bars, the Basic / 1 / 2 / 3 / Ult tabs, Play). Two columns on a
wide screen and on a phone held sideways (from 600 px wide when 500 px tall
or less); one column on a phone held upright, the stage under the close
button. It keeps clear of the Dynamic Island (`env(safe-area-inset-*)` in
its width). Under 480 px the skill tabs show their key only (the name is
read out and shown in full below), so no name breaks mid-word.

### Panel transitions

`site.js` wraps each switch in `document.startViewTransition` where the
browser has it (Chrome and Edge 111, Safari 18, Firefox 144; Baseline since
October 2025) and sets `html[data-vt]` so `site.css` picks the animation:

| `data-vt`       | What moves                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| `open`, `close` | the card's portrait grows into the stage and back; the panel wipes in on a slant, the details slide in after it |
| `next`, `prev`  | the details slide out and the next champion's slide in, as whole panels; the stage cuts over                    |
| `look`          | a new skin cuts in on a slant over the old one, then an element-coloured slash crosses the stage                |
| `cut`           | a raid boss or Shop piece cuts in the same way                                                                  |
| `filter`        | the roster's cards move to their new places                                                                     |

The pairs that cut over each other blend normally (not the cross-fade's
plus-lighter, which added the two pictures' colours), the old picture stays
whole under the new one, and the details are clipped to their own column.
Elements that take part in one kind only are named for it alone (a name on
them always would capture them in every transition), and the fixed bar is
named for the page's own transitions so a moving panel stays under it.
Without view transitions a switch is instant, with small CSS entrances.
Checked by slowing every animation to a quarter (CDP
`Animation.setPlaybackRate`) and screenshotting each kind mid-way.

Scroll reveals use CSS scroll-driven animations (`animation-timeline:
view()`, Chrome 115, Safari 26, Firefox 159) on transform and opacity, so
they run on the compositor at the screen's rate; `site.js`'s
IntersectionObserver does it elsewhere. They fill forwards only: an element
below the screen keeps its own look (a full-page capture or a search engine
sees it whole) and takes the first frame as it starts to enter, where no one
sees the change.

On top of the reveals, the page moves with the reader's scroll (owner,
27 and 28 Nov: "words and panels gather in as you reach them, then each
moves off its own way for the next part"), all in `site.css` under
`@supports (animation-timeline: view()) and (animation-range: exit-crossing …)`,
no script:

- a red stripe fills the top bar's yellow edge as you read down
  (`scroll(root)`);
- the hero's painting sinks back and leans as it leaves, and the outlined
  "Element Arena" behind it drifts slower than the page (from 600 px);
- the champion tape is pushed against its own drift (`translate`, on top of
  the drift's `transform`; only the drift waits under a mouse or the
  keyboard);
- section titles wipe out to the left, cards lift away one column after
  another, and the raid and Shop panels ease back as they cross the top
  edge, with no fill, so before and after they are their own selves; the
  words stay whole until most of a box has gone;
- the boss faces come in from above and below in turn; the phone picture
  straightens to its own slight lean as it rises, and tilts away as it goes.

A `view()` timeline follows the nearest scroll container, and
`overflow: hidden` makes one: `.hero`, `.facts` and `.app` clip with
`overflow: clip` instead where these timelines exist (with `display:
flow-root`, the block formatting context hidden gave them), or their
contents would follow a box that never scrolls. Nothing pins a section or
snaps the scroll. `tests/visual/website.spec.ts` ("scroll-driven motion")
checks each follows the page, that paused motion and a browser without the
timelines get the still page, and no sideways scroll at phone sizes.

### Motion and the pause switch

Every loop, the ticker, the rays and the turning spotlight stop with one
switch, shown on each stage (WCAG 2.2.2). The page starts paused on a
device set to Reduce Motion, showing each look's poster, and the switch
plays the loops for a reader who wants them; the choice is kept on the
device (`ea-site-motion`). This differs from the game, where less motion is
the player's switch and never the device's (CLAUDE.md): the game has a
Settings screen to turn it on; the website's first visit has none, so it
follows the device until the reader presses play. `tests/unit/reduced-motion.test.ts`
covers `apps/client` only. When Low Power Mode refuses to start a loop
(`NotAllowedError`), the switch shows play, and a tap starts it.

### Raid bosses

The raid section is a stage with one boss at a time and a picker of all
seven, in the Raid Hub's order (`RAID_BOSS_ORDER`). It says what the game
does: every boss can be raided any day, Cragmuff first, and one Cragmuff
clear opens the other six (`raidUnlocked` in
`apps/client/src/screens/raid-hall-view.ts`). There is no boss of the day:
`RaidBossInfo.day` in `raid-roster.ts` is left over from an older design and
nothing reads it, so the page must not use it (`site.test.ts` fails on a
weekday name). From 600 px wide the splash and its words sit side by side, never on top
of each other, so no word covers a boss's face (owner, 26 Nov); each boss's
`face` in gen-data keeps its face in view where the picture is cut. Only
the boss on show downloads its splash (`img/raids/`,
from the game's raid splash art by `make-images.py`). The panels and picks
are written by `gen-data.ts` between the `raids` and `bosses` markers, so
the names, stars, reward counts (as the boss cards count them), signature
tricks and blurbs come from the game.

## Support and Privacy on the website

`elementarenausa.com/support/` and `/privacy/` are the game's own pages
(`apps/client/public/support.html`, `privacy.html`), copied by
`apps/site/tools/legal-pages.mjs` with this site's paths (owner, 26 Nov:
"put Support and Privacy in the main website"). The game's pages stay the
source: the app and the store listings link to them on
play.elementarenausa.com. Edit those, then run the tool;
`site.test.ts` fails when the copies drift. Both versions have a Home button
in the bar (back to elementarenausa.com) and "Element Arena website" beside
"Back to the game" in the footer.

## What we took from big games' sites

Patterns (no art, text or branding copied; the live sites could not be opened
from the build machine, so this is from what they are known to do):

- League of Legends / Overwatch: a filterable portrait grid; a champion
  view with role, a stat strip and the abilities as a row of tabs (basic,
  skills, ultimate), the ultimate set apart. Here: element chips, a
  `<dialog>` panel, Basic / 1 / 2 / 3 / Ult tabs with arrow keys.
- Valorant: browsing next/previous inside the detail view. Here: ‹ › in
  the panel, and `#champion-<id>` links that open it directly.
- League skins strip: thumbnails that swap the big art. Here: four featured
  skins (rarest first) plus the Wardrobe count.
- Sticky header with the Play button; Play repeated in the hero, the panel
  and the apps section.
- Game sites lean on motion more than any other kind (Muffin Group's
  survey of gaming sites, 2026), but heavy animation costs phones their
  load time (Muzli's 2026 landing-page report). So the motion here is CSS
  and small loops, loaded only when shown: a band of light sweeping the
  hero, the champion ticker (a tap opens the champion), the facts counting
  up, mode pictures leaning in, the Shop spotlight.
- The hero (owner, 26 Nov: "the words cover the art"): the painting is a
  band of its own, cut to the two fighters and the beam, and the words sit
  under it, on phones and desktops alike; no word covers a creature.
- Avoided for speed: autoplay video heroes, preloading every skin or clip,
  canvas/WebGL scroll engines, framework bundles. Motion here moves
  transform and opacity only, scroll reveals start readable, and the pause
  switch (or the device's Reduce Motion, until the reader presses play)
  stops all of it.

Round 5 (27 Nov, Poster). Searched, not opened: the build machine's network
blocked the live sites and web.dev, so this is from search results and
write-ups; marked where it is memory rather than a source.

- Character-select switching is the pattern every big game site shares: a
  strip of portraits swaps one large panel with a slide or cut (Valorant's
  agents, League's champions, Honkai: Star Rail; from memory). Here: the
  roster opens a panel whose portrait grows into the stage, and next /
  previous slide the details as whole panels.
- Skins are shown in motion with short muted loops beside a thumbnail strip
  (League's skin pages and its client's hover videos; Riot moved its client
  to video previews, players having asked to see a skin before buying).
  Here: each look's own fitting-room loop, at 60 frames a second.
- Poster's references (Persona 5's red, black and white boxes, Valorant's
  near-square corners and condensed capitals): one accent on ink, hard
  edges, huge type, a single contrasting colour for the selected item
  (mechanicsofmagic.com on Persona 5; a third-party breakdown of Valorant's
  site). Marvel Rivals' comic gallery was made plainer after players found
  it hard to use (PC Gamer): flourish never at the cost of reading.
- Video, not GIF or animated WebP, for loops (web.dev: a 3.7 MB GIF was a
  551 KB MP4); `muted loop playsinline`, a poster for Low Power Mode, and one
  pause control for everything that moves (WCAG 2.2.2).
- View transitions and scroll-driven animations are where today's sites
  make panels move without a framework; Chrome's case studies are shops
  (Tokopedia), not games. Clip-path is kept to the few panels, transforms
  for the many.

## Images

All art is the game's own: the loading art and raid splash
(`apps/client/src/art/`), the fighter portraits
(`apps/client/public/assets/fighters/*/portrait.svg`) and real gameplay
captures from `scripts/app-store` (docs/app-store-screenshots.md). To
refresh them:

```bash
npx playwright test --config scripts/app-store/playwright.config.ts   # real captures
python3 apps/site/tools/make-images.py                                # needs Pillow 11+
```

The hero is the duel painting (Halcyra's Skyline Lance). The game's copy is a
1536 px lossy WebP, soft on a 3x phone, where the picture is cut to cover and
drawn about 2.5 times its size. The owner sent the lossless original (26 Nov,
`ultimate-halcyra-skyline-lance.png`, also 1536 x 1024), upscaled 2x with
OpenCV's EDSR model to 3072 x 2048; the site's 960 to 2560 px copies come
from that master (`HERO_MASTER=<png> python3 apps/site/tools/make-images.py`,
which skips the larger widths without it). The master is not in the repo
(about 10 MB). Held upright, the hero's `sizes` asks for about 1.1 screen
heights, so a phone picks a copy wide enough for the crop.

## Preview locally

```bash
npx serve apps/site      # or: python3 -m http.server -d apps/site 8080
```

## Hosting

A Render Static Site of its own (pending the owner's approval):

| Setting             | Value                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository / branch | this repo, `main`                                                                                                                                                                                                   |
| Root directory      | `apps/site`                                                                                                                                                                                                         |
| Build command       | `node tools/write-config.mjs` (plain Node, no install)                                                                                                                                                              |
| Publish directory   | `.`                                                                                                                                                                                                                 |
| Env                 | `SITE_SUPABASE_URL`, `SITE_SUPABASE_ANON_KEY` (the game's public values), `SITE_APPLE_SIGN_IN=on` if the game has it                                                                                                |
| Build filter        | include `apps/site/**` only                                                                                                                                                                                         |
| Headers `/*`        | `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy` (below) |
| Custom domains      | `elementarenausa.com`, `www.elementarenausa.com` (Render redirects www to the apex)                                                                                                                                 |

CSP: `default-src 'self'; img-src 'self' data:; style-src 'self';
style-src-attr 'unsafe-inline'; script-src
'self'; connect-src 'self' https://<project>.supabase.co; frame-ancestors
'none'; base-uri 'self'; form-action 'self'` (the JSON-LD block is data, not
script, so `script-src 'self'` still allows it).

The canonical URL, Open Graph URLs and sitemap use
`https://elementarenausa.com/`; Play, Support and Privacy point at `https://play.elementarenausa.com/`.

## When the apps reach the stores

Replace the two "Coming soon" tiles in `#mobile` with the official App Store
and Google Play badges linking to the listings (Apple and Google allow their
badges only for a live listing), and add the app links to the hero.

## Progress (keep current)

Round 5 (owner, 27 Nov: the website in Poster, professional, today's panel
transitions; no amounts of the game's money; skins with their full effects
at a higher frame rate; study famous games' sites):

- [x] Poster across the page and the Account page (tokens, Anton and
      Archivo, halftone, slabs, stickers, hard shadows)
- [x] Every look in the champion panel and every spotlight piece plays its
      fitting-room loop at 60 frames a second (92 MP4 loops, ~20 MB)
- [x] No prices or coin words anywhere; a test keeps it so
- [x] View transitions for the panel, skins, next / previous, raids, the
      spotlight and the filter; scroll-driven reveals; one pause switch
- [x] Checked at 390×844, 375×667, 667×375, 844×390, 852×393 with the
      island inset and 1440×900, and each transition mid-way
- [x] Easy to read (owner, 28 Nov): AA contrast measured on the pixels,
      no words on texture, minimum sizes, plain US wording
- [ ] Support and Privacy keep the game's own look (they are the game's
      pages, copied): restyle them with the game's `legal.css` when the
      game's pages move to Poster

Round 3 (owner, 25 Nov 3:35 PM PT: Arena Dusk; bought elementarenausa.com;
website at the apex, game at play., one session cookie):

- [x] Arena Dusk only; addresses → elementarenausa.com / play.elementarenausa.com
- [x] Account page `/account/` (sign in, Apple, forgot password, change email,
      change or set password, sign out; guests told to add an email in game)
- [x] `packages/shared/src/session-cookie.ts` + `accounts.ts` uses it on
      elementarenausa.com only; unit tests, real-Chromium cross-host check
- [x] typecheck, all unit/integration tests, login visual specs (11) pass
- [ ] Domain session (session_01GGURqQADMUMD98DeB1Czb3) moves the game to
      play. first; agree who merges first (accounts.ts)
- [ ] Owner approves the production list (Render site, DNS, Supabase), then
      create the Static Site, DNS, check HTTPS, sign-in across both hosts
- [ ] SHARE_SITE → https://elementarenausa.com (small PR; tests in share-qr
      and share-card.spec)
- [x] Animated clips of every champion's moves (round 4; later taken out)

Round 4 (owner, 26 Nov: skill clips, a more creative raid section, anything
that helps the game):

- [x] Raid bosses: a stage and a picker in the game's order, cinematic
      entrance (the splash settles, a wind-up ring, the name wipes in).
      A first version showed a "boss of the day" from the unused `day` field;
      the owner caught it (26 Nov): the game has no daily boss, so it was
      dropped. The live page's old line "one is featured each day of the
      week" is gone with it.
- [x] Skill clips (18 × 5) shipped in #518, then taken out with the
      screenshot strip (owner: too close to Ways to play)
- [x] Ways to play with real fights, every ultimate going off (owner,
      26 Nov: not the painted art); a phone held sideways playing a real duel
      in the Mobile section
- [x] Make it yours is now the Shop's window: Legendary and Mythical skins,
      an aura and a victory from the fitting room, names from the catalog
- [x] Raid stage: splash and words side by side, faces never covered
- [x] Hero band (words under the painting), Shop spotlight with loops and
      prices, champion ticker, count-up facts, light sweep; Support and
      Privacy on the website with Home buttons
- [x] A sharper hero from the owner's lossless original, upscaled 2x
- [x] Checked at 390×844, 375×667, 360×800, 667×375, 844×390, 852×393,
      915×412 (phones first, owner 25 Nov) and once at desktop

Round 2 (owner, 25 Nov 3:15 PM PT: motion, interactive champions, an account
area with one-tap Play, QR to the website):

- [x] Research notes (above); data from game code + drift test; element
      filter; champion panel (stats, skills, ultimate, skins, prev/next,
      deep links); hero drift, entrance, scroll reveals, reduced motion
- [x] Account / one-tap Play proposal: `docs/website-accounts.md` (recommends A, same
      origin). **No sign-in code until the owner approves.**
- [ ] Not done: animated clips of each champion's real in-game moves (the
      panel uses the game's vector portraits with CSS motion). Next step
      after the style choice: capture loops from the visual harness,
      loaded only when a panel opens.
- [ ] Waiting for the owner: style, domain/hosting (A or C), Supabase settings
- [ ] Then: build the chosen option, PR (FULL lane if A), Cloudflare CNAME,
      HTTPS check, send the QR session the final URL

Round 1:

- [x] Page, styles, fonts, images from the game's art, real gameplay captures
      (scripts/app-store fixed: Create room moved into the mode menu)
- [x] robots.txt, sitemap.xml, link preview image (og.jpg), favicons
- [x] Checked at 390×844, 844×390, 667×375, 852×393, 1440×900 in all three styles
- [x] Speed: Lighthouse itself was blocked by the session's permissions, so
      measured with Playwright on a throttled phone (4× CPU, slow 4G):
      FCP ≈ 0.9 s, LCP ≈ 0.9 s, CLS 0, 16 requests, 268 KB first load
      (uncompressed server). Contrast: the main text and label colours checked by hand, fixed to ≥ 4.5:1 (not an automated audit).
- [x] Demo published (claude.ai artifact 8pd1gyLZnre9guVQ1EG7PY), sent to the owner
- [ ] **Waiting for the owner:** style (Arena Dusk recommended) and domain
- [ ] Then: keep one style (drop the other two style blocks and heroes),
      set the canonical URL, open the PR, create the Render Static Site,
      add the domain, check HTTPS and links, tell the QR-card session
      (session_01GGURqPpVwxSv9M2de9odTn) the final URL, and the coordinator
      (session_01GGURqSvcdeJjPNb1K3n9YJ) the PR
- [x] Game build unchanged: `npm run build` + `scripts/verify-pwa.mjs` pass,
      entry 1,686,815 bytes (limit 2,400,000), 56 precache entries, no site files
- [ ] PR description must say (coordinator, 25 Nov): **FULL on main's rules
      (72 files), FAST with this PR's rule**; why the exception can't hide game
      files (only `apps/site/` images and fonts, anchored at the repo root;
      tests pin that other images and the site's code still count); and the
      `scripts/app-store/screenshots.spec.ts` fix as a separate item
- [ ] QR hand-off (PR #478, `SHARE_SITE` in `apps/client/src/share-link.ts`):
      send that session the final URL and say whether `?ref=card|result` should
      land on this page or the game (this page is static and ignores `?ref`;
      the game is where it can be counted)
- DNS (checked read-only via the Cloudflare connector, 25 Nov): litojace.com is a
  Cloudflare zone. `litojace.com` and `www` point at a Vercel site (also
  `amatyc`, `pet`); `mathpath` is another Render app; `parena` is a CNAME to
  element-arena-np34.onrender.com (Render routes it to the static site by host).
  So the website takes a new subdomain (proposed `arena.litojace.com`), and a
  cookie on `.litojace.com` would be readable by those other sites.
