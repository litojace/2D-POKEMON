import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIGHTER_IDS } from "../../packages/shared/src/index";
import { menuShadow } from "../../apps/client/src/fighter-art";
import {
  FOOTPRINT,
  MENU_GROUND_FLAT,
  SHADOW_FLAT,
  footprint,
  footprintScale,
  groundDrop,
} from "../../apps/client/src/ground";
import { SHOP_GROUND_FLAT } from "../../apps/client/src/shop-preview-layout";

/**
 * One ground rule for every view (ground.ts; owner, 27 Nov 2026): a
 * champion's shadow and aura are one ellipse under its body, the same shape
 * for every champion, floaters included, sized by its footprint and placed
 * at its ground point.
 */
const SRC = join(__dirname, "../../apps/client/src");

describe("the ground a champion stands on", () => {
  it("is the same shape for every champion, floaters and standers alike", () => {
    const shapes = new Set(
      FIGHTER_IDS.map((id) => {
        const s = menuShadow(id);
        expect(s.cx).toBe(100);
        expect(s.rx).toBe(footprint(id));
        return (s.ry / s.rx).toFixed(6);
      }),
    );
    expect([...shapes]).toEqual([SHADOW_FLAT.toFixed(6)]);
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
  it("lies on the Shop's plane in every menu", () => {
    expect(MENU_GROUND_FLAT).toBe(SHOP_GROUND_FLAT);
  });
  it("is read from ground.ts by every view, never from a champion's name", () => {
    const preview = readFileSync(join(SRC, "shop-preview.ts"), "utf8");
    expect(preview).toContain("flat = MENU_GROUND_FLAT");
    expect(preview).not.toMatch(/flat = shadow\.ry \/ shadow\.rx/);
    expect(preview).toContain("groundDrop(champion)");
    const battle = readFileSync(join(SRC, "main.ts"), "utf8");
    expect(battle).toContain("groundDrop(p.character)");
    expect(battle).toContain("footprintScale(p.character)");
    // The menu art's shadow has no floater branch any more.
    const art = readFileSync(join(SRC, "fighter-art.ts"), "utf8");
    const shadow = art.slice(
      art.indexOf("export function menuShadow"),
      art.indexOf("export function withSoftGround"),
    );
    expect(shadow).not.toContain("HOVERING");
  });
});
