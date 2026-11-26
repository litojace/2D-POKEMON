# Element Arena website (`apps/site`)

These notes live in `docs/` rather than in `apps/site/`, because everything
in `apps/site/` is served to the public as it is.

The public front page for the game: what it is, the champions, modes, raid
bosses, real screenshots, "coming soon" for the apps, and **Play now**
buttons into the game at `https://parena.litojace.com/`.

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
`https://elementarenausa.com/`; Play, Support and Privacy point at
`https://play.elementarenausa.com/`.

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
- [ ] Later: animated clips of champions' real moves

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
