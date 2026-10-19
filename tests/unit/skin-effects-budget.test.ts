import { describe, expect, it, vi } from "vitest";
import {
  drawSkinFx,
  type FxContext,
} from "../../apps/client/src/skins/skin-fx";
import { SKIN_ART } from "../../apps/client/src/skins/skin-art";

function frame(now: number, ambient: boolean, defeated = false) {
  const commands: unknown[] = [];
  const graphics = new Proxy(
    {},
    {
      get:
        (_target, method) =>
        (...args: unknown[]) => {
          commands.push([method, ...args]);
          return graphics;
        },
    },
  );
  const emit = vi.fn();
  const context = {
    g: graphics,
    under: graphics,
    emit,
    chance: () => true,
    x: 200,
    y: 174,
    headX: 200,
    headY: 120,
    sc: 1,
    now,
    dt: 1 / 60,
    angle: Math.PI / 2,
    moving: false,
    dashing: false,
    hurt: false,
    defeated,
    greeting: false,
    celebrating: false,
    knockedOut: false,
    ultimate: false,
    ambient,
  } as unknown as FxContext;
  return { context, commands, emit };
}

const mythics = Object.entries(SKIN_ART).filter(([, art]) => art.mythic);
describe("equipped Mythical effect budgets", () => {
  it.each(mythics)(
    "keeps %s ornaments moving outside the particle budget",
    (_id, art) => {
      const before = frame(1000, false);
      const after = frame(1800, false);
      // Isolate the Mythical ornaments from Epic details and movement trails.
      const ornaments = { ...art, detail: undefined, trail: undefined };
      drawSkinFx(before.context, ornaments, 3);
      drawSkinFx(after.context, ornaments, 3);
      expect(before.commands.length).toBeGreaterThan(0);
      expect(after.commands).not.toEqual(before.commands);
      expect(before.emit).not.toHaveBeenCalled();
      expect(after.emit).not.toHaveBeenCalled();
    },
  );
  it.each([
    "cindrake-sunforged",
    "tidefin-moontide",
    "lumoth-starweaver",
    "terradon-world-shell",
  ])("only emits extra %s particles when budgeted", (id) => {
    for (const ambient of [false, true]) {
      const f = frame(1000, ambient);
      drawSkinFx(
        f.context,
        { ...SKIN_ART[id], detail: undefined, trail: undefined },
        3,
      );
      expect(f.emit.mock.calls.length > 0).toBe(ambient);
    }
  });
  it("does not animate defeated fighters' ornaments", () => {
    const f = frame(1000, true, true);
    drawSkinFx(f.context, SKIN_ART["auralynx-celestial-sage"], 3);
    expect(f.commands).toEqual([]);
    expect(f.emit).not.toHaveBeenCalled();
  });
});
