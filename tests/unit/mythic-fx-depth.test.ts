import { expect, it } from "vitest";
import {
  drawSkinFx,
  type FxContext,
  type FxParticle,
} from "../../apps/client/src/skins/skin-fx";
import { SKIN_ART } from "../../apps/client/src/skins/skin-art";
import { WORLD_ART } from "../../packages/shared/src/world-art";

function graphics() {
  const paths: { x: number; y: number }[][] = [];
  let path: { x: number; y: number }[] = [];
  const g: any = new Proxy(
    {},
    {
      get:
        (_, method) =>
        (...args: number[]) => {
          if (method === "beginPath") paths.push((path = []));
          if (method === "moveTo" || method === "lineTo")
            path.push({ x: args[0], y: args[1] });
          return g;
        },
    },
  );
  return { g, paths };
}

for (const [skin, flat] of [
  ["tidefin-moontide", undefined],
  ["cindrake-sunforged", undefined],
  // The fitting room's flatter floor (SHOP_GROUND_FLAT).
  ["tidefin-moontide", 26 / 128],
  ["cindrake-sunforged", 26 / 128],
] as const) {
  it(`${skin} puts each ring's far arc and rising particles behind the fighter (flat ${flat ?? "arena"})`, () => {
    const front = graphics(),
      back = graphics(),
      particles: FxParticle[] = [];
    const ctx: FxContext = {
      g: front.g,
      under: back.g,
      emit: (p) => particles.push(p),
      chance: () => true,
      x: 200,
      y: 174,
      headX: 200,
      headY: 130,
      sc: 2.1,
      now: 1234,
      dt: 0.016,
      angle: Math.PI / 2,
      moving: false,
      dashing: false,
      hurt: false,
      defeated: false,
      greeting: false,
      celebrating: false,
      knockedOut: false,
      ultimate: false,
      ambient: true,
      flat,
    };
    drawSkinFx(ctx, SKIN_ART[skin], 3);
    // Rings lie on the shadow: centred on the feet, on the same ground plane.
    const groundY = ctx.y + WORLD_ART.fighterFeet * ctx.sc;
    const ground = flat ?? WORLD_ART.groundY;
    expect(front.paths.length).toBeGreaterThan(0);
    expect(back.paths.length).toBe(front.paths.length);
    for (let i = 0; i < front.paths.length; i++) {
      const near = front.paths[i],
        far = back.paths[i];
      expect(near.length).toBe(33);
      expect(far.length).toBe(33);
      expect(near.every((p) => p.y >= groundY - 1e-8)).toBe(true);
      expect(far.every((p) => p.y <= groundY + 1e-8)).toBe(true);
      const rx = Math.abs(near[0].x - near.at(-1)!.x) / 2;
      const ry = Math.max(...near.map((p) => p.y)) - groundY;
      expect(ry / rx).toBeCloseTo(ground, 3);
      expect(near.at(-1)!.x).toBeCloseTo(far[0].x);
      expect(far.at(-1)!.x).toBeCloseTo(near[0].x);
    }
    expect(particles.length).toBeGreaterThan(0);
    const rising = particles.filter(
      (p) => p.shape === (skin.startsWith("tidefin") ? "bubble" : "dot"),
    );
    expect(rising.length).toBeGreaterThan(0);
    expect(rising.every((p) => p.behind)).toBe(true);
  });
}
