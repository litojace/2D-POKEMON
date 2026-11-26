import { describe, expect, it } from "vitest";
import { drawCollectionAuraBase } from "../../apps/client/src/skins/collection-fx";
import { RAID_AURA_IDS } from "../../apps/client/src/skins/raid-aura-fx";
import { RAID_COSMETICS } from "../../packages/shared/src/raid";

/**
 * The raid bosses' auras (raid-aura-fx.ts), remade in their bosses' looks
 * (owner, 26 Nov: the boss effects were outdated). An aura plays all match
 * long on every phone, so each must stay light: the old ones painted up to
 * about 4,200 aura units² of fills a frame (mostly a floor glow, which the
 * Legendary flourish already gives), these far less.
 */
function recorder() {
  const calls: { key: string; args: number[] }[] = [];
  let area = 0;
  const g: any = new Proxy(
    {},
    {
      get:
        (_t, key: string) =>
        (...args: number[]) => {
          calls.push({ key, args });
          if (key === "fillCircle") area += Math.PI * args[2] ** 2;
          else if (key === "fillEllipse")
            area += (Math.PI * args[2] * args[3]) / 4;
          else if (key === "fillTriangle")
            area +=
              Math.abs(
                (args[2] - args[0]) * (args[5] - args[1]) -
                  (args[4] - args[0]) * (args[3] - args[1]),
              ) / 2;
          else if (key === "fillRect") area += Math.abs(args[2] * args[3]);
          return g;
        },
    },
  );
  return { g, calls, area: () => area };
}

describe("raid auras", () => {
  const raid = Object.entries(RAID_COSMETICS)
    .filter(([, v]) => v.slot === "aura")
    .map(([id]) => id);

  it("every raid boss's aura has its own drawing", () => {
    expect(raid).toHaveLength(7);
    expect([...RAID_AURA_IDS].sort()).toEqual([...raid].sort());
  });

  it("each draws, moves, and holds still with reduced motion", () => {
    for (const id of raid) {
      const at = (now: number, reduced = false) => {
        const r = recorder();
        expect(
          drawCollectionAuraBase(r.g, id, 0, 0, now, reduced, r.g, 18 / 48, 0),
          id,
        ).toBe(true);
        return JSON.stringify(r.calls);
      };
      expect(at(1000), id).not.toBe(at(1900));
      expect(at(1000, true), id).toBe(at(1900, true));
    }
  });

  it("each stays light: little fill a frame, and a bounded number of calls", () => {
    for (const id of raid) {
      let area = 0,
        calls = 0,
        frames = 0;
      for (let now = 0; now < 6000; now += 100) {
        const r = recorder();
        drawCollectionAuraBase(r.g, id, 0, 0, now, false, r.g, 18 / 48, 0);
        area += r.area();
        calls += r.calls.length;
        frames++;
      }
      expect(area / frames, id).toBeLessThan(1200);
      expect(calls / frames, id).toBeLessThan(60);
    }
  });

  it("each puts something on the near side, in front of the fighter", () => {
    for (const id of raid) {
      const back = recorder(),
        front = recorder();
      let inFront = 0;
      for (let now = 0; now < 6000; now += 500) {
        drawCollectionAuraBase(
          back.g,
          id,
          0,
          0,
          now,
          false,
          front.g,
          18 / 48,
          0,
        );
        inFront += front.calls.length;
      }
      expect(inFront, id).toBeGreaterThan(0);
    }
  });
});
