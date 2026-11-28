// The Support and Privacy pages on the website (elementarenausa.com/support/
// and /privacy/), made from the game's own pages so there is one text to
// keep: apps/client/public/support.html and privacy.html stay the source
// (the app and the store listings link to them on play.elementarenausa.com).
//
//   node apps/site/tools/legal-pages.mjs
//
// Writes apps/site/support/index.html, privacy/index.html and legal.css, and
// copies a font they use that the website doesn't have yet. tests/unit/site.test.ts
// fails when the website's copies no longer match their source.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const game = path.resolve(site, "../client/public");
const GAME = "https://play.elementarenausa.com/";

/** The website's copy of one of the game's pages. */
export function sitePage(html) {
  return (
    html
      // The game's "/" (Play, back to the game) is the game's address here...
      .replaceAll('href="/"', `href="${GAME}"`)
      // ...and the logo and Home mean this site's own front page.
      .replaceAll('href="https://elementarenausa.com/"', 'href="/"')
      .replace(
        '<a class="brand" href="' + GAME + '">',
        '<a class="brand" href="/">',
      )
      .replaceAll(/href="\/(support|privacy)\.html(#[^"]*)?"/g, 'href="/$1/$2"')
      .replaceAll("/icons/arena-192.png", "/icon-192.png")
      .replaceAll("/icons/apple-touch-icon.png", "/apple-touch-icon.png")
  );
}
/** The website's copy of the pages' stylesheet: the same, with this site's paths. */
export function siteCss(css) {
  return css
    .replaceAll("/assets/fonts/", "/fonts/")
    .replaceAll(
      "/assets/backgrounds/elemental-horizon-small.webp",
      "/img/elemental-horizon-small.webp",
    );
}

export const PAGES = ["support", "privacy"];

function write() {
  for (const name of PAGES) {
    const html = readFileSync(path.join(game, `${name}.html`), "utf8");
    mkdirSync(path.join(site, name), { recursive: true });
    writeFileSync(path.join(site, name, "index.html"), sitePage(html));
  }
  writeFileSync(
    path.join(site, "legal.css"),
    siteCss(readFileSync(path.join(game, "legal.css"), "utf8")),
  );
  // What the stylesheet loads that the website doesn't have yet.
  const css = readFileSync(path.join(site, "legal.css"), "utf8");
  for (const [, file] of css.matchAll(/url\("\/fonts\/([^"]+)"\)/g))
    if (!existsSync(path.join(site, "fonts", file)))
      copyFileSync(
        path.join(game, "assets/fonts", file),
        path.join(site, "fonts", file),
      );
  console.log("wrote /support/, /privacy/ and legal.css");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) write();
