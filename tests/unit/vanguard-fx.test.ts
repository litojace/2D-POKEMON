import { describe, expect, it, vi } from "vitest";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  drawSkinFx,
  type FxContext,
} from "../../apps/client/src/skins/skin-fx";
import { SKIN_ART } from "../../apps/client/src/skins/skin-art";
import { vanguardMarks } from "../../apps/client/src/skins/vanguard-fx";
const ids = Object.keys(CHARACTERS) as CharacterId[];
const dirs = ["down", "left", "right", "up"] as const;
function frame(now: number, ambient: boolean, defeated = false) {
  const commands: unknown[][] = [];
  const g: any = new Proxy(
    {},
    {
      get:
        (_t, k) =>
        (...args: unknown[]) => {
          commands.push([k, ...args]);
          return g;
        },
    },
  );
  const emit = vi.fn(),
    mount = vi.fn((_part: string, x: number, y: number) => ({
      x: 1000 + x,
      y: 1000 + y,
    }));
  const ctx = {
    g,
    under: g,
    emit,
    mount,
    chance: () => true,
    x: 200,
    y: 180,
    headX: 200,
    headY: 120,
    sc: 1,
    now,
    dt: 1 / 60,
    angle: 0,
    moving: false,
    dashing: false,
    hurt: false,
    defeated,
    greeting: false,
    celebrating: false,
    knockedOut: false,
    ultimate: false,
    ambient,
    facing: "down",
  } as FxContext;
  return { ctx, commands, emit, mount };
}
describe("Nova Vanguard idle effects", () => {
  it("animates each costume within a small drawing budget without ambient particles", () => {
    for (const id of ids) {
      const a = frame(300, true),
        b = frame(1400, true);
      drawSkinFx(a.ctx, SKIN_ART[`${id}-nova-vanguard`], 1);
      drawSkinFx(b.ctx, SKIN_ART[`${id}-nova-vanguard`], 1);
      expect(a.commands.length, id).toBeGreaterThan(0);
      expect(a.commands.length, id).toBeLessThanOrEqual(32);
      expect(b.commands.length, id).toBeLessThanOrEqual(32);
      expect(a.commands, id).not.toEqual(b.commands);
      expect(a.emit).not.toHaveBeenCalled();
      expect(b.emit).not.toHaveBeenCalled();
      expect(a.mount).toHaveBeenCalled();
    }
  });
  it("suppresses details when ambient effects are off or the fighter is defeated", () => {
    for (const id of ids)
      for (const [ambient, defeated] of [
        [false, false],
        [true, true],
      ]) {
        const f = frame(500, ambient, defeated);
        drawSkinFx(f.ctx, SKIN_ART[`${id}-nova-vanguard`], 1);
        expect(f.commands).toEqual([]);
        expect(f.emit).not.toHaveBeenCalled();
      }
  });
  it("uses finite joint coordinates and bounded small ornaments in every facing", () => {
    for (const id of ids)
      for (const dir of dirs)
        for (const now of [0, 400, 1200, 2600]) {
          const marks = vanguardMarks(id, dir, now);
          expect(marks.length, id).toBeGreaterThan(0);
          expect(marks.length, id).toBeLessThanOrEqual(6);
          for (const m of marks) {
            for (const v of [m.x, m.y, m.x2, m.y2, m.radius, m.alpha])
              expect(Number.isFinite(v)).toBe(true);
            expect(m.radius).toBeLessThanOrEqual(7);
            expect(m.alpha).toBeGreaterThanOrEqual(0);
            expect(m.alpha).toBeLessThanOrEqual(0.8);
          }
        }
  });
});
