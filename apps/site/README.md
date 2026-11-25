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

- [x] Page, styles, images from game art, fonts
- [ ] Real gameplay screenshots (scripts/app-store), robots/sitemap, OG image
- [ ] Screenshots at 390×844, 844×390, 1440×900; Lighthouse mobile ≥ 90
- [ ] Demo artifact with three style directions; send to the owner and the origin session
- [ ] Owner picks a style and the hosting/domain; then create the Render site
