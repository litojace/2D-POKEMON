import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHARACTERS } from "../../packages/shared/src/index";
import { RAID_BOSSES } from "../../packages/shared/src/raid-roster";
import { siteChampions } from "../../apps/site/tools/champion-data";

// The website (apps/site/README.md): a static page with no build, so these
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

  it("the account page's script is built from its source (node apps/site/tools/build-account.mjs)", async () => {
    const { bundleAccount } =
      await import("../../apps/site/tools/build-account.mjs");
    expect(readFileSync(path.join(SITE, "account/account.js"), "utf8")).toBe(
      await bundleAccount(),
    );
  });
});
