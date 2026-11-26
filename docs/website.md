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
  site.css            styles; the game's tokens (navy, gold, Barlow Condensed, DM Sans)
  fonts/              the game's own woff2 files (OFL licences beside them)
  img/                images made from the game's art by tools/make-images.py
  robots.txt, sitemap.xml, favicon.ico, favicon-32.png, icon-192.png, apple-touch-icon.png
  tools/make-images.py   regenerates img/ and the icons from the game's art
  tools/demo.mjs         builds the demo page with the style switcher
```

## Champion data comes from the game

`data/champions.json` (stats, basic attack, three skills, the ultimate,
featured skins), the skin pictures in `img/skins/` and the roster cards in
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
boring"). One piece at a time on a lit stage: a loop of the fitting room
itself (the idle, the effect blooming), light rays turning behind it in its
rarity's colour, sparks rising, its name, collection, line and price in
coins, and "Try it on in the Shop". Six pieces to pick from under it (three
Legendaries from three collections, two Mythicals, a victory); it turns to
the next every 7 s while on screen, until the reader picks one.

- The loops: `scripts/site-clips/shop.spec.ts` records each piece's stage
  through Chrome's screencast (about 17 frames a second, with each frame's
  time; a screenshot per frame managed three), on a 1600 x 1000 window so
  the stage is drawn large. `make-shop.py` cuts a square round the fighter
  and writes `img/shop/<name>.webp` (about 300 to 550 KB, only the piece on
  show loads) and `<name>-still.webp` (the picks, and reduced motion).
- The words are written by `gen-data.ts` from the catalog
  (`packages/shared/src/shop.ts`: names, rarities, collections, lines,
  `itemListPrice`, `MYTHIC_TRIAL_WINS`); `site.test.ts` fails on a name the
  Shop doesn't sell, a wrong rarity or price, or a missing loop.
- To show other pieces: `SHOWCASE` (gen-data), `ITEMS` (shop.spec) and
  `CROPS` (make-shop), with the same names.

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
  canvas/WebGL scroll engines, framework bundles. Motion here is CSS (hero
  drift and entrance, card lift, panel float), scroll reveals start
  readable, and `prefers-reduced-motion` turns all of it off.

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
