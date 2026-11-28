import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The Instagram plan (docs/instagram.md, "Running the account"):
// scripts/instagram/publish.mjs posts each item from apps/site/social/,
// which the website serves for Meta to fetch. These checks keep the plan
// postable and within the owner's rules before it goes out on its own.
const ROOT = path.resolve(__dirname, "../..");
const plan = JSON.parse(
  readFileSync(path.join(ROOT, "scripts/instagram/plan.json"), "utf8"),
);
const SOCIAL = path.join(ROOT, "apps/site/social");

describe("instagram plan", () => {
  it("serves every picture and video it posts from the website", () => {
    expect(plan.mediaBase).toBe("https://elementarenausa.com/social/");
    for (const p of plan.posts)
      for (const f of [p.image, p.video, p.cover].filter(Boolean)) {
        const file = path.join(SOCIAL, f);
        expect(existsSync(file), f).toBe(true);
        // Meta takes JPEG pictures only, and fetches them over the web.
        if (f !== p.video) expect(f, f).toMatch(/\.jpg$/);
        expect(statSync(file).size, f).toBeLessThan(
          f === p.video ? 20_000_000 : 8_000_000,
        );
      }
  });

  it("gives each item one kind, a time in Pacific time and a unique id", () => {
    const ids = new Set();
    for (const p of plan.posts) {
      expect(["feed", "reel", "story"], p.id).toContain(p.kind);
      // -08:00 in winter, -07:00 in summer: always US Pacific.
      expect(p.at, p.id).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:00-0[78]:00$/);
      expect(Number.isNaN(Date.parse(p.at)), p.id).toBe(false);
      expect(ids.has(p.id), p.id).toBe(false);
      ids.add(p.id);
      if (p.kind === "reel") expect(p.video && p.cover, p.id).toBeTruthy();
      else expect(p.image, p.id).toBeTruthy();
    }
  });

  it("keeps captions within Instagram's limits and the owner's rules", () => {
    const firstLines = new Set();
    for (const p of plan.posts.filter((p: any) => p.kind !== "story")) {
      expect(p.caption.length, p.id).toBeLessThanOrEqual(2200);
      // At most five hashtags (Instagram's cap since December 2025).
      expect((p.caption.match(/#\w+/g) ?? []).length, p.id).toBeLessThanOrEqual(
        5,
      );
      expect(p.caption, p.id).toContain("#ElementArena");
      // Only the game's own name: no other game, company or their tags.
      expect(p.caption, p.id).not.toMatch(/pok[eé]mon|nintendo/i);
      // publish.mjs knows a post is up by its first line: each is unique.
      const first = p.caption.split("\n")[0].trim();
      expect(firstLines.has(first), p.id).toBe(false);
      firstLines.add(first);
    }
  });

  it("can be stopped and waits for the owner", () => {
    expect(typeof plan.paused).toBe("boolean");
    expect(Number.isNaN(Date.parse(plan.approval.sentAt))).toBe(false);
  });
});
