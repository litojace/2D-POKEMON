import { describe, expect, it } from "vitest";
import {
  surfaceMaterial,
  townMaterialFamily,
} from "../../apps/client/src/world-materials";
import {
  bossSurface,
  type BossMaterial,
} from "../../apps/client/src/boss-materials";
import { FIGHTER_IDS } from "@arena/shared";
import { creatureLayers } from "../../apps/client/src/creature-design";

describe("painted world materials", () => {
  it("distinguishes stone, timber, foliage and woven awnings while preserving translucent effects", () => {
    expect(surfaceMaterial("#b9ad95", "ground")).toBe("stone");
    expect(surfaceMaterial("#7a5638", "architecture")).toBe("wood");
    expect(surfaceMaterial("#6f8a3a", "foliage")).toBe("leaves");
    expect(surfaceMaterial("#80d8ed", "market")).toBe("cloth");
    expect(surfaceMaterial("#5f8243", "ground")).toBeNull();
    expect(
      surfaceMaterial("rgba(255,255,255,0.25)", "architecture"),
    ).toBeNull();
    expect(townMaterialFamily("town-fountain-painted-base")).toBeNull();
    expect(townMaterialFamily("town-hen-white-walk-1")).toBeNull();
  });

  it.each<BossMaterial>(["scales", "feathers", "cloud", "velvet", "pearl"])(
    "%s lighting stays inside the original boss ellipse",
    (material) => {
      const ellipses: number[][] = [];
      const g: any = new Proxy(
        {},
        {
          get:
            (_, method) =>
            (...args: number[]) => {
              if (method === "fillEllipse") ellipses.push(args);
              return g;
            },
        },
      );
      bossSurface(g, 100, 80, 120, 90, 0x65bcca, material);
      for (const [x, y, w, h] of ellipses) {
        // An inner ellipse with the same aspect ratio fits if its normalised
        // centre offset plus its radius is at most the original radius.
        expect(
          Math.hypot((x - 100) / 60, (y - 80) / 45) + Math.max(w / 120, h / 90),
        ).toBeLessThanOrEqual(1.00001);
      }
    },
  );

  it("keeps a fading boss's alpha without accumulating translucent layers", () => {
    const calls: unknown[][] = [];
    const g: any = {
      fillStyle: (...a: unknown[]) => {
        calls.push(a);
        return g;
      },
      fillEllipse: () => g,
    };
    bossSurface(g, 0, 0, 100, 80, 0x65bcca, "scales", 0.3);
    expect(calls).toEqual([[0x65bcca, 0.3]]);
  });

  it.each(FIGHTER_IDS)(
    "bakes %s front material without texturing expressions or repainting approved profiles",
    (id) => {
      const front = creatureLayers(id, "down");
      expect(front.layers.body).toContain('class="champion-material"');
      expect(front.layers.eyes).not.toContain('class="champion-material"');
      for (const dir of ["left", "right", "up"] as const) {
        expect(creatureLayers(id, dir).defs).not.toContain("<pattern");
      }
    },
  );
});
