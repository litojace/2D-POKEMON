import { expect, it } from "vitest";
import {
  drawSkinFx,
  type FxContext,
} from "../../apps/client/src/skins/skin-fx";
import { SKIN_ART } from "../../apps/client/src/skins/skin-art";
import { CHAMPION_SKINS } from "../../packages/shared/src/shop";

/** A Graphics stand-in that counts its drawing calls. */
function graphics() {
  const count = { n: 0 };
  const g: any = new Proxy(
    {},
    {
      get: (_, method) =>
        method === "then" ? undefined : () => (count.n++, g),
    },
  );
  return { g, count };
}
const ctx = (
  g: any,
  under: any,
  now: number,
  extra: Partial<FxContext> = {},
): FxContext => ({
  g,
  under,
  emit: () => {},
  chance: () => false,
  x: 200,
  y: 174,
  headX: 200,
  headY: 120,
  sc: 1,
  now,
  dt: 0.05,
  angle: 0,
  moving: false,
  dashing: false,
  hurt: false,
  defeated: false,
  greeting: false,
  celebrating: false,
  knockedOut: false,
  ultimate: false,
  ambient: false,
  ...extra,
});
const knights = CHAMPION_SKINS.filter((s) => s.rarity === "mythical");

/** Draw calls in each frame after a moment starts, 50 ms apart. */
function moment(skin: string, stage: number, start: Partial<FxContext>) {
  const front = graphics(),
    back = graphics();
  const calls: number[] = [];
  for (let t = 0; t <= 1500; t += 50) {
    const before = front.count.n + back.count.n;
    drawSkinFx(
      ctx(front.g, back.g, 10_000 + t, t === 0 ? start : {}),
      SKIN_ART[skin],
      stage,
    );
    calls.push(front.count.n + back.count.n - before);
  }
  return calls;
}

it("plays every Void Knight's entrance, victory and stage III ultimate, then stops", () => {
  expect(knights).toHaveLength(16);
  for (const { id } of knights) {
    // The resting frame's own drawing (the stage's ambient effects).
    const idle = moment(id, 3, {})[5];
    for (const [start, ms] of [
      [{ greeting: true }, 900],
      [{ celebrating: true }, 1100],
      [{ ultimate: true }, 750],
    ] as const) {
      const calls = moment(id, 3, start);
      // While the moment plays it draws more than the resting frame...
      expect(calls[4], `${id} ${Object.keys(start)[0]}`).toBeGreaterThan(idle);
      // ...and once it is over, the frame is back to rest.
      expect(calls[Math.ceil(ms / 50) + 2], `${id} after`).toBe(idle);
    }
  }
});

it("keeps the signature ultimate for stage III", () => {
  for (const { id } of knights) {
    const stage2 = moment(id, 2, { ultimate: true });
    const idle2 = moment(id, 2, {})[5];
    expect(stage2[4], id).toBe(idle2);
  }
});
