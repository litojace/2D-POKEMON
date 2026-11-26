import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHARACTERS } from "../../packages/shared/src/index";
import {
  RAID_BOSSES,
  RAID_BOSS_ORDER,
  RAID_REWARDS,
} from "../../packages/shared/src/raid";
import { siteChampions } from "../../apps/site/tools/champion-data";
import {
  CHAMPION_SKINS,
  LOOK_ITEMS,
  itemListPrice,
} from "../../packages/shared/src/shop";

// The website (docs/website.md): a static page with no build, so these
// checks stand in for one. Every file it links exists, it leads into the
// game, it uses only the game's own names, and its facts match the game.
const SITE = path.resolve(__dirname, "../../apps/site");
// Whitespace between and inside tags folded, so the checks don't depend on
// how Prettier wraps the markup.
const html = readFileSync(path.join(SITE, "index.html"), "utf8")
  .replace(/\s+/g, " ")
  .replace(/> </g, "><")
  .replace(/" \/>/g, '"/>');
const css = readFileSync(path.join(SITE, "site.css"), "utf8");
const GAME = "https://play.elementarenausa.com/";

const flatHtml = () => html.replace(/>\s+/g, ">").replace(/\s+</g, "<");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe("website", () => {
  it("every local file the page or its styles use exists", () => {
    const refs = [
      ...[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/(?:srcset|imagesrcset)="([^"]+)"/g)].flatMap((m) =>
        m[1].split(",").map((s) => s.trim().split(/\s+/)[0]),
      ),
      ...[...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]),
    ].filter((r) => !/^(https?:|mailto:|#)/.test(r));
    expect(refs.length).toBeGreaterThan(40);
    for (const r of refs)
      expect(existsSync(path.join(SITE, r.replace(/^\//, ""))), r).toBe(true);
  });

  it("every Play button leads into the game", () => {
    const plays = [
      ...html.matchAll(/<a class="btn btn-play[^"]*" href="([^"]+)"/g),
    ];
    expect(plays.length).toBeGreaterThanOrEqual(3);
    for (const [, href] of plays) expect(href).toBe(GAME);
  });

  it("uses only the game's own names, never another brand", () => {
    for (const f of files(SITE).filter((f) =>
      /\.(html|css|txt|xml|svg|md|mjs|py)$/.test(f),
    ))
      expect(readFileSync(f, "utf8"), f).not.toMatch(/pok[eé]mon/i);
  });

  it("shows every champion with its element, and every raid boss", () => {
    const chars = Object.values(CHARACTERS);
    expect(chars).toHaveLength(18);
    for (const c of chars) {
      const card = html.match(
        new RegExp(`<h3>${c.name}</h3><p class="el">(\\w+)</p>`),
      );
      expect(card?.[1], c.name).toBe(c.element);
      expect(html).toContain(`img/creatures/${c.id}.svg`);
    }
    for (const b of Object.values(RAID_BOSSES)) {
      expect(html, b.name).toContain(
        `<h3>${b.name.replace("&", "&amp;")}</h3>`,
      );
      expect(html).toContain(`<p class="trick">${b.signature}</p>`);
      expect(html).toContain(`img/bosses/${b.id}.webp`);
    }
  });

  it("shows the raid bosses as the game does (npx tsx apps/site/tools/gen-data.ts)", () => {
    // One panel and one pick per boss, in the Raid Hub's order. The game has
    // no boss of the day (every boss is open once Cragmuff is cleared), so
    // the page never names a day.
    const flat = html.replace(/>\s+/g, ">").replace(/\s+</g, "<");
    const panels = [
      ...html.matchAll(/<article class="raid" id="raid-([\w-]+)"/g),
    ].map((m) => m[1]);
    expect(panels).toEqual(RAID_BOSS_ORDER);
    expect(html).not.toMatch(/(Sun|Mon|Tues|Wednes|Thurs|Fri|Satur)days?\b/);
    for (const id of panels) {
      const b = RAID_BOSSES[id as keyof typeof RAID_BOSSES];
      expect(flat).toContain(`<p class="blurb">${b.blurb}</p>`);
      expect(flat).toContain(
        `${b.element} · ${RAID_REWARDS.filter((r) => r.boss === id).length} rewards`,
      );
      expect(html).toContain(`id="pick-${id}" aria-controls="raid-${id}"`);
      for (const w of [768, 1280])
        for (const ext of ["webp", "avif"])
          expect(
            existsSync(path.join(SITE, `img/raids/${id}-${w}.${ext}`)),
            `${id}-${w}.${ext}`,
          ).toBe(true);
    }
  });

  it("names one canonical address everywhere", () => {
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)![1];
    const own = (s: string) =>
      [...s.matchAll(/https:\/\/[^"<\s]+/g)]
        .map((m) => m[0])
        .filter(
          (u) =>
            !u.startsWith(GAME) &&
            !u.includes("schema.org") &&
            !u.includes("sitemaps.org"),
        );
    const addresses = [
      ...own(html),
      ...own(readFileSync(path.join(SITE, "robots.txt"), "utf8")),
      ...own(readFileSync(path.join(SITE, "sitemap.xml"), "utf8")),
    ];
    expect(addresses.length).toBeGreaterThan(5);
    for (const u of addresses) expect(u.startsWith(canonical), u).toBe(true);
  });

  it("has the meta a shared link and a search engine need", () => {
    for (const tag of [
      /<html lang="en"/,
      /<title>[^<]{20,70}<\/title>/,
      /<meta\s+name="description"\s+content="[^"]{80,170}"/,
      /property="og:image" content="https:[^"]+\/og\.jpg"/,
      /name="twitter:card" content="summary_large_image"/,
      /<meta name="viewport" content="[^"]*viewport-fit=cover/,
    ])
      expect(html).toMatch(tag);
    expect(existsSync(path.join(SITE, "og.jpg"))).toBe(true);
  });

  it("its champion data matches the game (npx tsx apps/site/tools/gen-data.ts)", () => {
    const saved = JSON.parse(
      readFileSync(path.join(SITE, "data/champions.json"), "utf8"),
    );
    expect(saved).toEqual(siteChampions());
    for (const c of saved) {
      expect(c.skins.length).toBeGreaterThan(0);
      for (const s of c.skins)
        expect(existsSync(path.join(SITE, `img/skins/${s.id}.svg`)), s.id).toBe(
          true,
        );
      expect(html).toContain(`data-champion="${c.id}"`);
    }
  });

  it("its Shop spotlight shows real Shop pieces, at the Shop's prices (make-shop.py)", () => {
    const spots = [
      ...flatHtml().matchAll(
        /<article class="spot r-(\w+)" id="spot-([\w-]+)"[\s\S]*?<h3>([^<]+)<\/h3>[\s\S]*?<b>([\d,]+)<\/b>\s?coins/g,
      ),
    ];
    expect(spots.length).toBeGreaterThanOrEqual(4);
    const byName = new Map(
      [...CHAMPION_SKINS, ...LOOK_ITEMS].map((i) => [i.name, i]),
    );
    for (const [, rarity, pic, name, price] of spots) {
      const item = byName.get(name);
      expect(item, name).toBeDefined();
      expect(rarity, name).toBe(item!.rarity);
      expect(Number(price.replace(/,/g, "")), name).toBe(
        itemListPrice(item!.id),
      );
      // The loop, its still, and a pick for it.
      for (const f of [`${pic}.webp`, `${pic}-still.webp`]) {
        const file = path.join(SITE, "img/shop", f);
        expect(existsSync(file), f).toBe(true);
        expect(statSync(file).size, f).toBeLessThan(700_000);
      }
      expect(html).toContain(`aria-controls="spot-${pic}"`);
    }
  });

  it("every long page of the game has the back-to-top button (to-top.js)", () => {
    const PUBLIC = path.resolve(__dirname, "../../apps/client/public");
    // One script, the same on both sites.
    expect(readFileSync(path.join(PUBLIC, "to-top.js"), "utf8")).toBe(
      readFileSync(path.join(SITE, "to-top.js"), "utf8"),
    );
    for (const page of [
      path.join(SITE, "index.html"),
      path.join(SITE, "account/index.html"),
      path.join(PUBLIC, "privacy.html"),
      path.join(PUBLIC, "support.html"),
    ])
      expect(readFileSync(page, "utf8"), page).toMatch(
        /<script src="\/?to-top\.js" defer><\/script>/,
      );
    for (const sheet of [
      path.join(SITE, "site.css"),
      path.join(PUBLIC, "legal.css"),
    ])
      expect(readFileSync(sheet, "utf8"), sheet).toContain(".to-top.is-shown");
  });

  it("its Support and Privacy pages are the game's, with Home (node apps/site/tools/legal-pages.mjs)", async () => {
    const { sitePage, siteCss, PAGES } =
      await import("../../apps/site/tools/legal-pages.mjs");
    const PUBLIC = path.resolve(__dirname, "../../apps/client/public");
    expect(readFileSync(path.join(SITE, "legal.css"), "utf8")).toBe(
      siteCss(readFileSync(path.join(PUBLIC, "legal.css"), "utf8")),
    );
    for (const name of PAGES) {
      const source = readFileSync(path.join(PUBLIC, `${name}.html`), "utf8");
      const page = readFileSync(path.join(SITE, name, "index.html"), "utf8");
      expect(page, name).toBe(sitePage(source));
      // A Home button to the website on both copies.
      expect(source).toMatch(
        /<a class="home" href="https:\/\/elementarenausa\.com\/">/,
      );
      expect(page).toMatch(/<a class="home" href="\/">/);
      // Every file the website's copy loads is on the website.
      for (const [, ref] of page.matchAll(/(?:src|href)="(\/[^"#]*)"/g))
        expect(
          existsSync(
            path.join(
              SITE,
              ref.replace(/^\//, ""),
              ref.endsWith("/") ? "index.html" : "",
            ),
          ),
          `${name}: ${ref}`,
        ).toBe(true);
    }
    for (const [, font] of readFileSync(
      path.join(SITE, "legal.css"),
      "utf8",
    ).matchAll(/url\("\/([^"]+)"\)/g))
      expect(existsSync(path.join(SITE, font)), font).toBe(true);
    // The website links its own copies.
    expect(html).toContain('href="/support/"');
    expect(html).toContain('href="/privacy/"');
  });

  it("the account page's script is built from its source (node apps/site/tools/build-account.mjs)", async () => {
    const { bundleAccount } =
      await import("../../apps/site/tools/build-account.mjs");
    expect(readFileSync(path.join(SITE, "account/account.js"), "utf8")).toBe(
      await bundleAccount(),
    );
  });
});
