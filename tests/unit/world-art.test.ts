import { describe, expect, it } from "vitest";
import { WORLD_ART, groundHeight } from "../../packages/shared/src/world-art";
import { paintKit } from "../../apps/client/src/arena-courts";
import { LOOK_ITEMS } from "../../packages/shared/src/shop";
import { RAID_REWARDS } from "../../packages/shared/src/raid";
import { JOURNEY_ITEMS } from "../../packages/shared/src/journey";
import { drawCollectionAura } from "../../apps/client/src/skins/collection-fx";
import { drawBattleAura } from "../../apps/client/src/battle-aura";
import {
  SHOP_PREVIEW,
  SELECTION_PREVIEW,
  previewAuraScale,
  SHOP_SHADOW,
  SHOP_GROUND_FLAT,
} from "../../apps/client/src/shop-preview-layout";

describe("shared world art perspective", () => {
  it("shares ground projection and sun direction with the courts", () => {
    expect(paintKit.K).toBe(WORLD_ART.groundY);
    expect(paintKit.SUNV).toEqual(WORLD_ART.sun);
  });

  it.each([SHOP_PREVIEW, SELECTION_PREVIEW])(
    "fits projected preview auras below the feet without clipping",
    (frame) => {
      const feetY = frame.y + WORLD_ART.fighterFeet * frame.scale;
      const radiusY = (128 * SHOP_GROUND_FLAT * previewAuraScale(frame)) / 2;
      expect(radiusY).toBeGreaterThan(0);
      expect(feetY + radiusY).toBeLessThanOrEqual(frame.height - 12 + 1e-9);
    },
  );

  it("lays fitting-room auras on the shadow's plane, wider than the shadow", () => {
    expect(SHOP_GROUND_FLAT).toBeCloseTo(
      SHOP_SHADOW.height / SHOP_SHADOW.width,
    );
    const ellipses: number[][] = [];
    const g: any = new Proxy(
      {},
      {
        get:
          (_target, method) =>
          (...args: number[]) => {
            if (method === "fillEllipse" || method === "strokeEllipse")
              ellipses.push(args);
            return g;
          },
      },
    );
    for (const item of LOOK_ITEMS.filter((i) => i.slot === "aura"))
      drawCollectionAura(g, item.id, 0, 0, 0, true, g, SHOP_GROUND_FLAT);
    expect(ellipses.length).toBeGreaterThan(0);
    for (const [, , width, height] of ellipses.filter((e) => e[2] > 20))
      expect(height / width).toBeCloseTo(SHOP_GROUND_FLAT);
    // The ring (about 96 aura units across) reaches past the shadow.
    expect(96 * previewAuraScale(SHOP_PREVIEW)).toBeGreaterThan(
      SHOP_SHADOW.width,
    );
  });

  it.each([
    "electric",
    "fire",
    "water",
    "aura",
    "light",
    "psychic",
    "earth",
    "shadow",
  ])("projects %s battle aura rings onto the same ground plane", (element) => {
    const ellipses: number[][] = [];
    const g: any = new Proxy(
      {},
      {
        get:
          (_target, method) =>
          (...args: number[]) => {
            if (method === "fillEllipse" || method === "strokeEllipse")
              ellipses.push(args);
            return g;
          },
      },
    );
    drawBattleAura(g, element, 100, 100, 2);
    for (const [, , width, height] of ellipses.filter((e) => e[2] > 20)) {
      expect(height).toBeCloseTo(groundHeight(width));
    }
  });

  const auras = [...LOOK_ITEMS, ...RAID_REWARDS, ...JOURNEY_ITEMS].filter(
    (i) => i.slot === "aura" && i.id !== "mountain-aura",
  );
  it.each(auras)(
    "projects the $id ground aura consistently in every screen",
    (item) => {
      const ellipses: number[][] = [];
      const g: any = new Proxy(
        {},
        {
          get:
            (_target, method) =>
            (...args: number[]) => {
              if (method === "fillEllipse" || method === "strokeEllipse")
                ellipses.push(args);
              return g;
            },
        },
      );
      expect(drawCollectionAura(g, item.id, 0, 0, 1000, true)).toBe(true);
      for (const [, , width, height] of ellipses.filter(
        (args) => args[2] >= 70,
      )) {
        expect(height).toBeCloseTo(groundHeight(width));
      }
    },
  );
});
