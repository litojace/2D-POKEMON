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

describe("Legendary signature effects", () => {
  it("gives each Legendary skin its own signature, and Epics only the small glint", () => {
    const legendary = CHAMPION_SKINS.filter((s) => s.rarity === "legendary");
    expect(legendary).toHaveLength(ids.length * 2);
    for (const s of legendary) {
      expect(SKIN_ART[s.id].signature, s.id).toBe(s.id);
      expect(EPIC_SIGNATURES[s.id], s.id).toBeDefined();
    }
    // No other skin carries a moving motif: on a busy court they read as
    // clutter, so they stay a Legendary mark.
    for (const [id, art] of Object.entries(SKIN_ART))
      if (art.signature)
        expect(
          legendary.map((s) => s.id),
          id,
        ).toContain(id);
    for (const s of CHAMPION_SKINS.filter((s) =>
      ["abyssal-expedition", "dream-carnival"].includes(s.collection as string),
    ))
      expect(SKIN_ART[s.id].detail, s.id).toBe("glint");
    const sigs = Object.values(EPIC_SIGNATURES);
    expect(sigs).toHaveLength(36);
    expect(new Set(sigs.map((s) => s.name)).size).toBe(36);
    expect(new Set(sigs.map((s) => s.draw)).size).toBe(36);
  });

  it("gives the new Epics no landing or victory of their own", () => {
    for (const s of CHAMPION_SKINS.filter((s) =>
      ["abyssal-expedition", "dream-carnival"].includes(s.collection as string),
    ))
      for (const moment of ["greeting", "celebrating"] as const) {
        const f = frame(3000, false, Math.PI / 2, { [moment]: true });
        drawSkinFx(f.ctx, { ...SKIN_ART[s.id], trail: undefined }, 1);
        expect(f.emit, `${s.id} ${moment}`).not.toHaveBeenCalled();
      }
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
      // Popping in, held, then gone: the idle frame has none of the motif.
      expect(again(5450), id).not.toBe(fresh(5450));
      expect(again(6500), id).not.toBe(fresh(6500));
      expect(again(7000), id).toBe(fresh(7000));
    }
  });

  it("gives only the Legendary Nova Vanguard suits a hero landing and a victory", () => {
    for (const id of Object.keys(EPIC_SIGNATURES)) {
      const legendary = id.endsWith("-nova-vanguard");
      // Sky Pirates land and win over several frames (tested below).
      if (id.endsWith("-sky-pirates")) continue;
      const art = { ...SKIN_ART[id], trail: undefined };
      // Ambient off: no idle particles, so every emission is the moment's.
      const land = frame(3000, false, Math.PI / 2, { greeting: true });
      drawSkinFx(land.ctx, art, 1);
      const landShapes = land.emit.mock.calls.map(([p]) => p.shape);
      const win = frame(3000, false, Math.PI / 2, { celebrating: true });
      drawSkinFx(win.ctx, art, 1);
      const winCalls = win.emit.mock.calls.map(([p]) => p);
      if (legendary) {
        expect(landShapes, id).toContain("beam");
        // The column of light rises behind the hero, never over its face.
        expect(
          land.emit.mock.calls.find(([p]) => p.shape === "beam")![0].behind,
          id,
        ).toBe(true);
        expect(landShapes, id).toContain("shock");
        expect(
          winCalls.filter((p) => p.shape === "star").length,
          id,
        ).toBeGreaterThanOrEqual(6);
        // Victory sparkles stay behind the fighter, off its face.
        expect(
          winCalls.every((p) => p.behind),
          id,
        ).toBe(true);
        // The motif is summoned for the moment, then leaves.
        const again = (now: number) => {
          land.commands.length = 0;
          drawSkinFx({ ...land.ctx, now, greeting: false }, art, 1);
          return JSON.stringify(land.commands);
        };
        const fresh = (now: number) => {
          const f = frame(now, false);
          drawSkinFx(f.ctx, art, 1);
          return JSON.stringify(f.commands);
        };
        expect(again(3600), id).not.toBe(fresh(3600));
        expect(again(5000), id).toBe(fresh(5000));
      } else {
        expect(land.emit, id).not.toHaveBeenCalled();
        expect(win.emit, id).not.toHaveBeenCalled();
      }
    }
  });

  it("lands Sky Pirates with an anchor and wins with a treasure chest, then clears", () => {
    for (const id of Object.keys(EPIC_SIGNATURES).filter((k) =>
      k.endsWith("-sky-pirates"),
    )) {
      const art = { ...SKIN_ART[id], trail: undefined };
      for (const [moment, ms, shape] of [
        ["greeting", 1100, "shock"],
        ["celebrating", 1400, "coin"],
      ] as const) {
        const f = frame(1000, false, Math.PI / 2, { [moment]: true });
        drawSkinFx(f.ctx, art, 1);
        const idle = frame(1000, false);
        drawSkinFx(idle.ctx, art, 1);
        // Drawn over the next frames: more on the layers than idle.
        expect(f.commands.length, `${id} ${moment}`).toBeGreaterThan(
          idle.commands.length,
        );
        // The anchor bites (or the chest opens) partway through.
        let shapes: string[] = [];
        for (let t = 1016; t < 1000 + ms; t += 16) {
          f.emit.mockClear();
          drawSkinFx({ ...f.ctx, now: t, [moment]: false }, art, 1);
          shapes = shapes.concat(f.emit.mock.calls.map(([p]) => p.shape));
          // Coins and dust stay behind the captain, off its face.
          for (const [p] of f.emit.mock.calls)
            if (p.shape === "coin" || p.shape === "puff")
              expect(p.behind, `${id} ${moment}`).toBe(true);
        }
        expect(shapes, `${id} ${moment}`).toContain(shape);
        // Afterwards the moment is gone: the frame matches an idle one.
        f.commands.length = 0;
        drawSkinFx(
          { ...f.ctx, now: 1000 + ms + 2000, [moment]: false },
          art,
          1,
        );
        const later = frame(1000 + ms + 2000, false);
        drawSkinFx(later.ctx, art, 1);
        expect(JSON.stringify(f.commands), `${id} ${moment}`).toBe(
          JSON.stringify(later.commands),
        );
      }
    }
  });

  it("keeps the champion's motif off the idle frame: idle light lives on the suit", () => {
    for (const id of Object.keys(EPIC_SIGNATURES)) {
      const art = { ...SKIN_ART[id], trail: undefined };
      for (const now of [0, 700, 2900]) {
        const idle = frame(now, false);
        drawSkinFx(idle.ctx, art, 1);
        // Compact: a few calls for the emblem, seam pulse or brim glint.
        expect(idle.commands.length, id).toBeLessThanOrEqual(12);
        const summoned = frame(now + 400, false, Math.PI / 2, {});
        const cast = frame(now, false, Math.PI / 2, { ultimate: true });
        drawSkinFx(cast.ctx, art, 1);
        cast.commands.length = 0;
        drawSkinFx({ ...cast.ctx, now: now + 400, ultimate: false }, art, 1);
        drawSkinFx(summoned.ctx, art, 1);
        expect(cast.commands.length, id).toBeGreaterThan(
          summoned.commands.length,
        );
      }
    }
  });

  it("leaves its own trail while moving, with particles that slow and fade in", () => {
    for (const id of Object.keys(EPIC_SIGNATURES)) {
      const f = frame(1000, false, 0, { moving: true });
      drawSkinFx(f.ctx, SKIN_ART[id], 1);
      const calls = f.emit.mock.calls.map(([p]) => p);
      expect(calls.length, id).toBeGreaterThan(0);
      // Behind the feet, and only one kind of trail (the generic one is off).
      expect(calls.some((p) => p.behind), id).toBe(true);
      expect(calls.length, id).toBeLessThanOrEqual(3);
      const still = frame(1000, false);
      drawSkinFx(still.ctx, SKIN_ART[id], 1);
      expect(still.emit, id).not.toHaveBeenCalled();
    }
  });

  it("never draws a negative size while a motif pops in and out", () => {
    const sizes: Record<string, number[]> = {
      fillCircle: [2],
      strokeCircle: [2],
      arc: [2],
      fillEllipse: [2, 3],
      strokeEllipse: [2, 3],
    };
    for (const id of Object.keys(EPIC_SIGNATURES)) {
      const art = { ...SKIN_ART[id], trail: undefined };
      const cast = frame(1000, true, Math.PI / 2, { ultimate: true });
      drawSkinFx(cast.ctx, art, 1);
      for (let now = 1000; now < 3000; now += 40)
        for (const ambient of [true, false]) {
          cast.commands.length = 0;
          drawSkinFx({ ...cast.ctx, now, ambient, ultimate: false }, art, 1);
          for (const [k, ...args] of cast.commands)
            for (const i of sizes[k as string] ?? [])
              expect(args[i] as number, `${id} ${k as string} @${now}`).toBeGreaterThanOrEqual(0);
          // Fading never pushes alpha out of range.
          for (const [k, ...args] of cast.commands)
            if (k === "fillStyle" || k === "lineStyle") {
              const al = args[k === "fillStyle" ? 1 : 2] as number | undefined;
              if (al !== undefined) expect(al, `${id} ${k as string}`).toBeLessThanOrEqual(1.0001);
              if (al !== undefined) expect(al, `${id} ${k as string}`).toBeGreaterThanOrEqual(0);
            }
        }
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
