# Element Arena website (landing page)

The public front page for the game: what it is, the champions, modes, raid
bosses, real screenshots, "coming soon" for the apps, and **Play now**
buttons into the game at `https://parena.litojace.com/`.

It is plain static HTML and CSS with no build step and no JavaScript, kept
apart from the game: nothing here is imported by `apps/client`, it is not in
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

Proposed: a separate Render Static Site with root directory `apps/site`, no
build command, publish directory `.`, and a build filter on `apps/site/**`
so game merges don't redeploy it (and the game's Static Site can ignore
`apps/site/**`). Domain: see the proposal in the PR; the canonical URL,
Open Graph URLs and sitemap use `https://litojace.com/` until the owner
picks one (search for it in `index.html`, `robots.txt` and `sitemap.xml`).

## When the apps reach the stores

Replace the two "Coming soon" tiles in `#mobile` with the official App Store
and Google Play badges linking to the listings (Apple and Google allow their
badges only for a live listing), and add the app links to the hero.

## Progress (keep current)

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
