import { describe, expect, it } from "vitest";
import { WORLD_ART, groundHeight } from "../../packages/shared/src/world-art";
import { paintKit } from "../../apps/client/src/arena-courts";
import { SUN, FOUNTAIN, paintedFountain } from "../../apps/client/src/town-art";
import {
  TOWN,
  TOWN_PLAZA_ROAD,
  TOWN_OBSTACLES,
} from "../../packages/shared/src/town";
import { LOOK_ITEMS } from "../../packages/shared/src/shop";
import { RAID_REWARDS } from "../../packages/shared/src/raid";
import { JOURNEY_ITEMS } from "../../packages/shared/src/journey";
import { drawCollectionAura } from "../../apps/client/src/skins/collection-fx";
import { drawBattleAura } from "../../apps/client/src/battle-aura";
import {
  SHOP_PREVIEW,
  SELECTION_PREVIEW,
  previewAuraScale,
} from "../../apps/client/src/shop-preview-layout";

describe("shared world art perspective", () => {
  it("uses the same ground projection and sun in town, PvP and raid paint kits", () => {
    expect(paintKit.K).toBe(WORLD_ART.groundY);
    expect(paintKit.SUNV).toEqual(WORLD_ART.sun);
    expect([SUN.dx, SUN.dy]).toEqual([WORLD_ART.sun.x, WORLD_ART.sun.y]);
    expect(SUN.alpha).toBe(WORLD_ART.shadow.alpha);
    expect(TOWN_PLAZA_ROAD.ry / TOWN_PLAZA_ROAD.rx).toBeCloseTo(paintKit.K);
    expect(TOWN_PLAZA_ROAD.y).toBe(TOWN.plaza.y);
    for (const bowl of [
      FOUNTAIN.basin,
      FOUNTAIN.pool,
      FOUNTAIN.mid,
      FOUNTAIN.top,
    ]) {
      expect(bowl.ry / bowl.rx).toBeCloseTo(paintKit.K);
    }
  });

  it("anchors the new fountain at its ground plinth rather than its water plane", () => {
    const art = paintedFountain({} as CanvasImageSource, false);
    const sourceScale = art.w / 1402;
    expect(art.ax / sourceScale).toBeCloseTo(712);
    expect(art.ay / sourceScale).toBeCloseTo(738);
    // Authored water plane is near source y=690, above the foot anchor.
    expect((690 - 738) * sourceScale).toBeCloseTo(FOUNTAIN.pool.dy, 0);
    const f = TOWN_OBSTACLES.find((o) => o.kind === "fountain")!;
    expect(f.y).toBe(TOWN_PLAZA_ROAD.y);
  });

  it.each([SHOP_PREVIEW, SELECTION_PREVIEW])(
    "fits projected preview auras below the feet without clipping",
    (frame) => {
      const feetY = frame.y + WORLD_ART.fighterFeet * frame.scale;
      const radiusY = (groundHeight(128) * previewAuraScale(frame)) / 2;
      expect(radiusY).toBeGreaterThan(0);
      expect(feetY + radiusY).toBeLessThanOrEqual(frame.height - 12 + 1e-9);
    },
  );

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
