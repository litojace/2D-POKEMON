import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIGHTER_IDS } from "../../packages/shared/src/index";
import { creatureSvg } from "../../apps/client/src/creature-design";
import { menuShadow } from "../../apps/client/src/fighter-art";
import {
  FOOTPRINT,
  GROUND_FLAT,
  footprint,
  footprintScale,
  groundDrop,
} from "../../apps/client/src/ground";
import { PLAZA_AURA_FLAT } from "../../apps/client/src/plaza/plaza-cosmetics";

/**
 * One ground rule for every view (ground.ts; owner, 27 and 28 Nov 2026): a
 * champion's shadow and aura are one ellipse under its body, the same shape
 * for every champion, floaters included, sized by its footprint and placed
 * at its ground point; and every view uses the battle's flatness, from one
 * constant, so it is changed in one place.
 */
const SRC = join(__dirname, "../../apps/client/src");
const read = (file: string) => readFileSync(join(SRC, file), "utf8");

describe("the ground a champion stands on", () => {
  it("is the battle's shape: 48 wide to 18 high", () => {
    expect(GROUND_FLAT).toBe(18 / 48);
  });
  it("is the same shape for every champion, floaters and standers alike", () => {
    const shapes = new Set(
      FIGHTER_IDS.map((id) => {
        const s = menuShadow(id);
        expect(s.cx).toBe(100);
        expect(s.rx).toBe(footprint(id));
        return (s.ry / s.rx).toFixed(6);
      }),
    );
    expect([...shapes]).toEqual([GROUND_FLAT.toFixed(6)]);
  });
  it("is the menu art's own shadow too (cards, VS screen, results, the runner)", () => {
    for (const id of FIGHTER_IDS)
      for (const dir of ["down", "right"] as const) {
        const svg = creatureSvg(id, dir);
        const m = svg.match(
          /<ellipse class="fighter-shadow" cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)" ry="([\d.]+)"/,
        );
        expect(m, `${id} ${dir}`).not.toBeNull();
        const [, , cy, rx, ry] = m!.map(Number);
        expect(ry / rx).toBeCloseTo(GROUND_FLAT, 6);
        expect(rx).toBe(footprint(id));
        expect(cy).toBeCloseTo(menuShadow(id).cy, 6);
      }
  });
  it("sits on one feet line, lower only by a champion's own drop", () => {
    const lines = FIGHTER_IDS.map((id) => menuShadow(id).cy - groundDrop(id));
    expect(Math.max(...lines) - Math.min(...lines)).toBeLessThan(2.5);
    for (const id of FIGHTER_IDS) {
      expect(groundDrop(id)).toBeGreaterThanOrEqual(0);
      expect(groundDrop(id)).toBeLessThanOrEqual(14);
    }
  });
  it("is never narrower than the standard footprint, nor much wider", () => {
    for (const id of FIGHTER_IDS) {
      expect(footprint(id)).toBeGreaterThanOrEqual(FOOTPRINT);
      expect(footprintScale(id)).toBeLessThanOrEqual(1.25);
    }
  });
  it("has one flatness in the Plaza and battle, and the Shop's own shadow is the champion's ellipse", () => {
    expect(PLAZA_AURA_FLAT).toBe(GROUND_FLAT);
    const preview = read("shop-preview.ts");
    const floor = preview.slice(
      preview.indexOf("paintFloor() {"),
      preview.indexOf("update(_time"),
    );
    expect(floor).toContain("footprint(champion)");
    expect(floor).toContain("width * GROUND_FLAT");
  });
  it("is read from ground.ts by every view, never from a champion's name or a number of its own", () => {
    const views = [
      "main.ts",
      "shop-preview.ts",
      "shop-preview-layout.ts",
      "fighter-art.ts",
      "creature-design.ts",
      "cosmetic-fx-preview.ts",
      "plaza/plaza-scene.ts",
      "plaza/plaza-cosmetics.ts",
    ];
    for (const file of views) {
      const src = read(file);
      expect(src, file).toContain("GROUND_FLAT");
      // No view keeps a flatness of its own for a champion's ground.
      expect(src, file).not.toMatch(/\b18 \/ 48\b|\b26 \/ 128\b/);
      expect(src, file).not.toMatch(
        /MENU_GROUND_FLAT|SHOP_GROUND_FLAT|SHADOW_FLAT/,
      );
    }
    const preview = read("shop-preview.ts");
    expect(preview).toContain("flat = GROUND_FLAT");
    expect(preview).not.toMatch(/flat = shadow\.ry \/ shadow\.rx/);
    expect(preview).toContain("groundDrop(champion)");
    const battle = read("main.ts");
    expect(battle).toContain("groundDrop(p.character)");
    expect(battle).toContain("footprintScale(p.character)");
    expect(battle).toContain("48 * GROUND_FLAT");
    const plaza = read("plaza/plaza-scene.ts");
    expect(plaza).toContain("plazaGround(b.character)");
    expect(plaza).toContain("24 * GROUND_FLAT");
    const worn = read("plaza/plaza-cosmetics.ts");
    expect(worn).toContain("plazaGround(b.character)");
    // The menu art's shadow has no floater branch.
    const art = read("fighter-art.ts");
    const shadow = art.slice(
      art.indexOf("export function menuShadow"),
      art.indexOf("export function withSoftGround"),
    );
    expect(shadow).not.toContain("HOVERING");
  });
});
