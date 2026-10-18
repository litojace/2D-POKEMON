import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { CHAMPION_SKINS, LOOK_ITEMS } from "../../packages/shared/src/shop";
import { SKIN_ART, fighterSkillColor, wornArt } from "../../apps/client/src/skins/skin-art";
import { creatureSvg, paletteFor } from "../../apps/client/src/creature-design";
import { rigAssets, skinSuffix } from "../../apps/client/src/animation/assets";
import { SKINS } from "../../apps/client/src/animation/cosmetics";
import { drawCollectionAura, drawCollectionVictory, playCollectionEntrance } from "../../apps/client/src/skins/collection-fx";

const ids = Object.keys(CHARACTERS) as CharacterId[];
const DIRS = ["down", "up", "left", "right"] as const;
/** A Graphics stand-in that accepts any chained drawing call. */
const graphics = (): any =>
  new Proxy({}, { get: (_t, key) => (key === "then" ? undefined : () => graphics()) });

describe("champion skin art", () => {
  it("has art for exactly the 56 skins in the catalog", () => {
    expect(Object.keys(SKIN_ART).sort()).toEqual(CHAMPION_SKINS.map((s) => s.id).sort());
  });

  it("gives each rarity what the design promises", () => {
    for (const s of CHAMPION_SKINS) {
      const art = SKIN_ART[s.id];
      const extras = !!(art.pattern || art.accessories?.length || art.stageAccessories?.length);
      if (s.rarity === "common") expect([extras, !!art.trail, art.skill, art.mythic], s.id).toEqual([false, false, undefined, undefined]);
      if (s.rarity === "rare") expect([extras, !!art.trail, art.mythic], s.id).toEqual([true, true, undefined]);
      if (s.rarity === "epic") expect([extras, !!art.trail, typeof art.skill, !!art.detail, art.mythic], s.id).toEqual([true, true, "number", true, undefined]);
      if (s.rarity === "mythical") expect([!!art.trail, typeof art.skill, !!art.mythic], s.id).toEqual([true, "number", true]);
    }
  });

  it("draws every skin in every facing as well-formed SVG with its own palette", () => {
    for (const s of CHAMPION_SKINS)
      for (const dir of DIRS)
        for (const stage of [1, 3]) {
          const svg = creatureSvg(s.champion, dir, undefined, undefined, "normal", { skin: s.id, stage });
          expect(svg, `${s.id} ${dir}`).not.toMatch(/NaN|undefined|Infinity/);
          expect(svg).toContain(`${s.champion}-${dir}-${s.id}-body`);
          expect(svg).toContain(`stroke="${paletteFor(s.champion, { skin: s.id }).dark}"`);
          // Every mask or filter id is defined once per drawing.
          const defined = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
          expect(new Set(defined).size).toBe(defined.length);
          for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) expect(defined, `${s.id} ${dir}`).toContain(ref);
        }
  });

  it("only applies a skin to the champion it was made for", () => {
    const base = creatureSvg("cindrake", "down");
    expect(creatureSvg("cindrake", "down", undefined, undefined, "normal", { skin: "voltkit-midnight" })).toBe(base);
    expect(skinSuffix("cindrake", { skin: "voltkit-midnight", stage: 1 })).toBe("");
    expect(wornArt("cindrake", { skin: "voltkit-neon-arcade" })).toBeUndefined();
    expect(fighterSkillColor({ character: "voltkit", championLooks: { voltkit: { skin: "voltkit-neon-arcade", stage: 1 } } })).toBe(0xff4fd8);
    expect(fighterSkillColor({ character: "voltkit", championLooks: { voltkit: { skin: "voltkit-midnight", stage: 1 } } })).toBeUndefined();
  });

  it("keys Awakening stages only when the art changes with them", () => {
    expect(skinSuffix("voltkit", { skin: "voltkit-midnight", stage: 1 })).toBe("~voltkit-midnight");
    expect(skinSuffix("voltkit", { skin: "voltkit-stormcrown", stage: 2 })).toBe("~voltkit-stormcrown");
    expect(skinSuffix("voltkit", { skin: "voltkit-stormcrown", stage: 3 })).toBe("~voltkit-stormcrown~3");
  });

  it("never changes a fighter's size, pivots or placement (fairness)", () => {
    for (const s of CHAMPION_SKINS) {
      const shape = (a: ReturnType<typeof rigAssets>[number]) => [a.width, a.height, a.originX, a.originY, a.x, a.y];
      const base = rigAssets(s.champion).map(shape);
      const skinned = rigAssets(s.champion, { skin: s.id, stage: 3 });
      expect(skinned.map(shape), s.id).toEqual(base);
      expect(new Set(skinned.map((a) => a.key)).size).toBe(skinned.length);
      expect(skinned.every((a) => a.key.includes(`~${s.id}`))).toBe(true);
    }
  });
});

describe("collection pieces", () => {
  const css = readFileSync("apps/client/src/style.css", "utf8");
  it("every piece has something to show in play or in portraits", () => {
    for (const item of LOOK_ITEMS) {
      const g = graphics();
      const emitted: unknown[] = [];
      const emit = (p: unknown) => emitted.push(p);
      if (item.slot === "skin") expect(SKINS, item.id).toContain(item.id);
      if (item.slot === "aura") expect(drawCollectionAura(g, item.id, 0, 0, 1000, false), item.id).toBe(true);
      if (item.slot === "entrance") {
        expect(playCollectionEntrance(emit, item.id, 0, 0, 1), item.id).toBe(true);
        expect(emitted.length).toBeGreaterThan(0);
      }
      if (item.slot === "victory")
        expect(drawCollectionVictory(g, g, emit, () => true, item.id, 0, 0, 1, 0.5, 0.016, true), item.id).toBe(true);
      if (item.slot === "frame") expect(css, item.id).toContain(`[data-raid-cosmetic~="${item.id}"]`);
      if (item.slot !== "frame") expect(css, item.id).toContain(`[data-cosmetic="${item.id}"]`);
    }
  });
});

describe("raid cosmetics", () => {
  const css = readFileSync("apps/client/src/style.css", "utf8");
  /** Grumblecrag's originals are drawn by the rig and main.ts directly. */
  const special = ["mountain-aura", "mountainborn", "rockslide-flex"];
  it("every raid reward in an appearance slot is drawn somewhere", async () => {
    const { RAID_REWARDS } = await import("../../packages/shared/src/raid");
    for (const r of RAID_REWARDS) {
      if (r.slot === "title" || special.includes(r.id)) continue;
      const g = graphics();
      const emitted: unknown[] = [];
      const emit = (p: unknown) => emitted.push(p);
      if (r.slot === "skin") expect(SKINS, r.id).toContain(r.id);
      if (r.slot === "aura") expect(drawCollectionAura(g, r.id, 0, 0, 1000, false), r.id).toBe(true);
      if (r.slot === "entrance") {
        expect(playCollectionEntrance(emit, r.id, 0, 0, 1), r.id).toBe(true);
        expect(emitted.length).toBeGreaterThan(0);
      }
      if (r.slot === "victory")
        expect(drawCollectionVictory(g, g, emit, () => true, r.id, 0, 0, 1, 1, 0.2, true), r.id).toBe(true);
      if (r.slot === "frame") expect(css, r.id).toContain(`[data-raid-cosmetic~="${r.id}"]`);
      expect(css, r.id).toContain(`[data-cosmetic="${r.id}"]`);
    }
  });
});
