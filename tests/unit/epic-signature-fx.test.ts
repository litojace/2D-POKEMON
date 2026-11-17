import { describe, expect, it, vi } from "vitest";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { CHAMPION_SKINS } from "../../packages/shared/src/shop";
import {
  drawSkinFx,
  type FxContext,
} from "../../apps/client/src/skins/skin-fx";
import { SKIN_ART } from "../../apps/client/src/skins/skin-art";
import { EPIC_SIGNATURES } from "../../apps/client/src/skins/epic-signature-fx";

const ids = Object.keys(CHARACTERS) as CharacterId[];
const NEW_EPICS = ["abyssal-expedition", "dream-carnival", "nova-vanguard"];
const angles = [Math.PI / 2, 0, Math.PI, -Math.PI / 2];

function frame(
  now: number,
  ambient: boolean,
  angle = Math.PI / 2,
  extra: Partial<FxContext> = {},
) {
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
  const emit = vi.fn();
  const ctx = {
    g,
    under: g,
    emit,
    chance: () => true,
    x: 200,
    y: 174,
    headX: 200,
    headY: 120,
    sc: 1,
    now,
    dt: 1 / 60,
    angle,
    moving: false,
    dashing: false,
    hurt: false,
    defeated: false,
    greeting: false,
    celebrating: false,
    knockedOut: false,
    ultimate: false,
    ambient,
    ...extra,
  } as FxContext;
  return { ctx, commands, emit };
}
const finite = (commands: unknown[][]) =>
  commands.every((c) =>
    c
      .slice(1)
      .every((v) =>
        typeof v === "number"
          ? Number.isFinite(v)
          : Array.isArray(v)
            ? v.every((p: any) => Number.isFinite(p.x) && Number.isFinite(p.y))
            : true,
      ),
  );

describe("new Epic signature effects", () => {
  it("gives each of the 54 new Epics its own signature, and no other skin one", () => {
    const epics = CHAMPION_SKINS.filter((s) =>
      NEW_EPICS.includes((s as any).collection),
    );
    expect(epics).toHaveLength(ids.length * NEW_EPICS.length);
    for (const s of epics) {
      expect(SKIN_ART[s.id].signature, s.id).toBe(s.id);
      expect(EPIC_SIGNATURES[s.id], s.id).toBeDefined();
    }
    for (const [id, art] of Object.entries(SKIN_ART))
      if (art.signature) expect(epics.map((s) => s.id)).toContain(id);
    const sigs = Object.values(EPIC_SIGNATURES);
    expect(sigs).toHaveLength(54);
    expect(new Set(sigs.map((s) => s.name)).size).toBe(54);
    expect(new Set(sigs.map((s) => s.draw)).size).toBe(54);
  });

  it("stays within the drawing budget in every facing, compact when ambient is off", () => {
    for (const id of Object.keys(EPIC_SIGNATURES))
      for (const angle of angles)
        for (const now of [0, 333, 1250, 2900, 7400]) {
          const art = { ...SKIN_ART[id], trail: undefined };
          const low = frame(now, false, angle);
          drawSkinFx(low.ctx, art, 1);
          expect(low.commands.length, `${id} low`).toBeGreaterThan(0);
          expect(low.commands.length, `${id} low`).toBeLessThanOrEqual(20);
          expect(low.emit, `${id} low`).not.toHaveBeenCalled();
          expect(finite(low.commands), `${id} low`).toBe(true);
          const full = frame(now, true, angle);
          drawSkinFx(full.ctx, art, 1);
          expect(full.commands.length, `${id} full`).toBeLessThanOrEqual(40);
          expect(full.emit.mock.calls.length, `${id} full`).toBeLessThanOrEqual(
            1,
          );
          expect(finite(full.commands), `${id} full`).toBe(true);
        }
  });

  it("animates", () => {
    for (const id of Object.keys(EPIC_SIGNATURES)) {
      const a = frame(400, true),
        b = frame(1170, true);
      drawSkinFx(a.ctx, SKIN_ART[id], 1);
      drawSkinFx(b.ctx, SKIN_ART[id], 1);
      expect(a.commands, id).not.toEqual(b.commands);
    }
  });

  it("swells for an ultimate with one burst in its own shape, then settles", () => {
    for (const id of Object.keys(EPIC_SIGNATURES)) {
      const art = { ...SKIN_ART[id], trail: undefined };
      const cast = frame(5000, true, Math.PI / 2, { ultimate: true });
      drawSkinFx(cast.ctx, art, 1);
      const shapes = cast.emit.mock.calls.map(([p]) => p.shape);
      expect(shapes, id).toContain("shock");
      expect(
        shapes.filter((s) => s === EPIC_SIGNATURES[id].burst).length,
        id,
      ).toBeGreaterThanOrEqual(6);
      expect(cast.emit.mock.calls.length, id).toBeLessThanOrEqual(14);
      // On the same Graphics, the motif is larger mid-swell and back to
      // normal once the swell is over.
      const again = (now: number) => {
        cast.commands.length = 0;
        drawSkinFx({ ...cast.ctx, now, ultimate: false }, art, 1);
        return JSON.stringify(cast.commands);
      };
      const fresh = (now: number) => {
        const f = frame(now, true);
        drawSkinFx(f.ctx, art, 1);
        return JSON.stringify(f.commands);
      };
      expect(again(5450), id).not.toBe(fresh(5450));
      expect(again(6000), id).toBe(fresh(6000));
    }
  });

  it("draws nothing for a defeated fighter", () => {
    for (const id of Object.keys(EPIC_SIGNATURES)) {
      const f = frame(500, true, Math.PI / 2, { defeated: true });
      drawSkinFx(f.ctx, { ...SKIN_ART[id], trail: undefined }, 1);
      expect(f.commands).toEqual([]);
      expect(f.emit).not.toHaveBeenCalled();
    }
  });
});
