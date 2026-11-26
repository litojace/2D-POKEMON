import { describe, expect, it } from "vitest";
import { drawCollectionVictory } from "../../apps/client/src/skins/collection-fx";
import { RAID_VICTORY_IDS } from "../../apps/client/src/skins/raid-victory-fx";
import { RAID_COSMETICS } from "../../packages/shared/src/raid";

/**
 * The raid bosses' victories (raid-victory-fx.ts), remade 26 Nov. In a
 * match the fighter's name and health bar cover about 79 to 119 units over
 * the effect's origin, 65 either side: Crescent Bow's moon, Twin Spark's
 * pair and Sweet Dreams' baku used to settle there, hidden on a phone.
 */
type Box = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  key: string;
  color: number;
  alpha: number;
  r?: number;
};
function recorder() {
  const fills: Box[] = [];
  let color = 0,
    alpha = 1;
  const box = (key: string, xs: number[], ys: number[], r?: number) =>
    fills.push({
      key,
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      y0: Math.min(...ys),
      y1: Math.max(...ys),
      color,
      alpha,
      r,
    });
  const g: any = new Proxy(
    {},
    {
      get:
        (_t, key: string) =>
        (...a: any[]) => {
          if (key === "fillStyle") [color, alpha] = [a[0], a[1] ?? 1];
          else if (key === "fillCircle" || key === "arc")
            box(
              key,
              [a[0] - a[2], a[0] + a[2]],
              [a[1] - a[2], a[1] + a[2]],
              a[2],
            );
          else if (key === "fillEllipse")
            box(
              key,
              [a[0] - a[2] / 2, a[0] + a[2] / 2],
              [a[1] - a[3] / 2, a[1] + a[3] / 2],
            );
          else if (key === "fillTriangle")
            box(key, [a[0], a[2], a[4]], [a[1], a[3], a[5]]);
          else if (key === "fillRect")
            box(key, [a[0], a[0] + a[2]], [a[1], a[1] + a[3]]);
          else if (key === "fillPoints")
            box(
              key,
              a[0].map((p: any) => p.x),
              a[0].map((p: any) => p.y),
            );
          return g;
        },
    },
  );
  return { g, fills };
}
/** Every frame of a finale, at scale 1 round the origin. */
function play(id: string) {
  const frames: Box[][] = [];
  const dt = 1 / 30;
  for (let t = 0; t <= 3; t += dt) {
    const r = recorder();
    drawCollectionVictory(
      r.g,
      r.g,
      () => {},
      () => true,
      id,
      0,
      0,
      1,
      t,
      dt,
      t === 0,
    );
    frames.push(r.fills);
  }
  return frames;
}

describe("raid victories", () => {
  const raid = Object.entries(RAID_COSMETICS)
    .filter(([, v]) => v.slot === "victory")
    .map(([id]) => id);

  it("draws the five that were weak; Rainbow Fan stays, Rockslide Flex is the rig's", () => {
    expect(raid).toHaveLength(7);
    expect([...RAID_VICTORY_IDS].sort()).toEqual(
      raid
        .filter((id) => id !== "rainbow-fan" && id !== "rockslide-flex")
        .sort(),
    );
  });

  it("each moves, and is over after three seconds", () => {
    for (const id of raid) {
      const frames = play(id).map((f) => JSON.stringify(f));
      expect(frames[24], id).not.toBe(frames[48]);
      const r = recorder();
      drawCollectionVictory(
        r.g,
        r.g,
        () => {},
        () => true,
        id,
        0,
        0,
        1,
        3.1,
        1 / 30,
        false,
      );
      expect(r.fills, id).toEqual([]);
    }
  });

  it("nothing solid settles behind a match's name and health bar", () => {
    // Feather Fall's lanterns float up through it, in flight: not checked.
    for (const id of [
      ...RAID_VICTORY_IDS.filter((v) => v !== "feather-fall"),
      "rockslide-flex",
    ]) {
      const over = play(id)
        .flat()
        .filter(
          (b) =>
            b.alpha >= 0.3 &&
            b.x1 > -60 &&
            b.x0 < 60 &&
            b.y0 < -80 &&
            b.y1 > -118,
        );
      expect(over.slice(0, 3), id).toEqual([]);
    }
  });

  it("Crescent Bow's moon is one crescent, never a disc with a dark one over it", () => {
    const dark = (c: number) =>
      ((c >> 16) & 255) < 64 && ((c >> 8) & 255) < 64 && (c & 255) < 64;
    const discs = play("crescent-bow")
      .flat()
      .filter((b) => b.key === "fillCircle" && dark(b.color) && (b.r ?? 0) > 8);
    expect(discs).toEqual([]);
  });

  it("Rockslide Flex's crystals stand clear of the rig's rock pile", () => {
    // rig.ts drawPile: stones about 28 units either side, drawn first.
    const crystals = play("rockslide-flex")
      .flat()
      .filter((b) => b.key === "fillPoints");
    expect(crystals.length).toBeGreaterThan(0);
    expect(crystals.filter((b) => b.x1 > -32 && b.x0 < 32)).toEqual([]);
  });
});
