import { expect, it } from "vitest";
import {
  drawSkinFx,
  type FxContext,
  type FxParticle,
} from "../../apps/client/src/skins/skin-fx";
import { SKIN_ART } from "../../apps/client/src/skins/skin-art";

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

for (const skin of ["tidefin-moontide", "cindrake-sunforged"]) {
  it(`${skin} puts each ring's far arc and rising particles behind the fighter`, () => {
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
    };
    drawSkinFx(ctx, SKIN_ART[skin], 3);
    const groundY = ctx.y + 20 * ctx.sc;
    expect(front.paths.length).toBeGreaterThan(0);
    expect(back.paths.length).toBe(front.paths.length);
    for (let i = 0; i < front.paths.length; i++) {
      const near = front.paths[i],
        far = back.paths[i];
      expect(near.length).toBe(33);
      expect(far.length).toBe(33);
      expect(near.every((p) => p.y >= groundY - 1e-8)).toBe(true);
      expect(far.every((p) => p.y <= groundY + 1e-8)).toBe(true);
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
