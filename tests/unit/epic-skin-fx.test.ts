import { describe, expect, it, vi } from "vitest";
import { CHAMPION_SKINS } from "../../packages/shared/src/shop";
import { SKIN_ART } from "../../apps/client/src/skins/skin-art";
import { EPIC_SIGNATURES } from "../../apps/client/src/skins/epic-signatures";
import { epicSignatureFrame } from "../../apps/client/src/skins/epic-skin-fx";
import {
  drawSkinFx,
  type FxContext,
} from "../../apps/client/src/skins/skin-fx";
import { drawEpicCanvasFx } from "../../apps/client/src/skins/epic-canvas-fx";
const epics = CHAMPION_SKINS.filter((s) => s.rarity === "epic"),
  dirs = ["down", "left", "right", "up"] as const;
function frame(
  now: number,
  ambient: boolean,
  moving = false,
  defeated = false,
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
    chance: () => false,
    x: 200,
    y: 180,
    headX: 200,
    headY: 120,
    sc: 1,
    now,
    dt: 1 / 60,
    angle: 0,
    travelAngle: Math.PI / 2,
    moving,
    dashing: moving,
    hurt: false,
    defeated,
    greeting: false,
    celebrating: false,
    knockedOut: false,
    ultimate: false,
    ambient,
    facing: "down",
    flat: 0.55,
  } as FxContext;
  return { ctx, commands, emit, mount };
}
describe("personal Epic skin signatures", () => {
  it("covers every Epic, including original and Cyber skins, and leaves other rarities alone", () => {
    expect(epics).toHaveLength(90);
    expect(Object.keys(EPIC_SIGNATURES).sort()).toEqual(
      epics.map((s) => s.id).sort(),
    );
    for (const s of CHAMPION_SKINS)
      expect(SKIN_ART[s.id].epicFx, s.id).toBe(
        s.rarity === "epic" ? s.id : undefined,
      );
    expect(
      new Set(Object.values(EPIC_SIGNATURES).map((s) => s.title)).size,
    ).toBe(90);
  });
  it("has 90 different primary geometries rather than recolours or metadata changes", () => {
    const signatures = epics.map((s) =>
      epicSignatureFrame(
        s.id,
        {
          now: 0,
          facing: "down",
          moving: false,
          dashing: false,
          ambient: false,
        },
        SKIN_ART[s.id],
      ).map((m) => ({
        kind: m.kind,
        plane: m.plane,
        points: m.points,
        closed: m.closed,
        radius: m.radius,
      })),
    );
    expect(new Set(signatures.map((s) => JSON.stringify(s))).size).toBe(90);
  });
  it("keeps the essential identity visible on Low, with no idle particles", () => {
    for (const s of epics)
      for (const ambient of [false, true])
        for (const now of [300, 1400]) {
          const f = frame(now, ambient);
          drawSkinFx(f.ctx, SKIN_ART[s.id], 1);
          expect(f.commands.length, s.id).toBeGreaterThan(0);
          expect(f.commands.length, s.id).toBeLessThanOrEqual(
            ambient ? 64 : 20,
          );
          expect(f.emit).not.toHaveBeenCalled();
        }
  });
  it("animates every signature and stops ornament drawing after defeat", () => {
    for (const s of epics) {
      const a = frame(300, true),
        b = frame(1400, true),
        dead = frame(300, true, false, true);
      drawSkinFx(a.ctx, SKIN_ART[s.id], 1);
      drawSkinFx(b.ctx, SKIN_ART[s.id], 1);
      drawSkinFx(dead.ctx, SKIN_ART[s.id], 1);
      expect(a.commands, s.id).not.toEqual(b.commands);
      expect(a.mount).toHaveBeenCalled();
      expect(dead.commands).toEqual([]);
      expect(dead.emit).not.toHaveBeenCalled();
    }
  });
  it("has bounded finite ornaments, stays below faces and budgets movement wakes", () => {
    for (const s of epics)
      for (const facing of dirs)
        for (const now of [0, 400, 1200, 2600]) {
          for (const ambient of [false, true]) {
            const plan = epicSignatureFrame(
              s.id,
              { now, facing, moving: true, dashing: true, ambient },
              SKIN_ART[s.id],
            );
            expect(plan.length, s.id).toBeLessThanOrEqual(20);
            for (const m of plan) {
              for (const p of m.points)
                expect(p.every(Number.isFinite)).toBe(true);
              expect(Number.isFinite(m.alpha)).toBe(true);
              expect(m.alpha).toBeGreaterThanOrEqual(0);
              expect(m.alpha).toBeLessThanOrEqual(1);
              expect(m.radius).toBeLessThanOrEqual(11);
              if (!ambient) expect(m.essential).toBe(true);
              if (m.plane === "rig")
                for (const [, y] of m.points)
                  expect(
                    m.anchor[1] + (y - m.radius) * 2,
                    s.id,
                  ).toBeGreaterThan(120);
            }
          }
          const f = frame(now, true, true);
          f.ctx.facing = facing;
          drawSkinFx(f.ctx, SKIN_ART[s.id], 1);
          expect(f.commands.length, s.id).toBeLessThanOrEqual(64);
          expect(f.emit).not.toHaveBeenCalled();
        }
  });
  it("rotates the movement wake independently of the aim/facing and keeps the main emblem steady", () => {
    const state = {
      now: 1000,
      facing: "down" as const,
      moving: true,
      dashing: true,
      ambient: true,
    };
    const a = epicSignatureFrame(
      "voltkit-nova-vanguard",
      { ...state, angle: 0 },
      SKIN_ART["voltkit-nova-vanguard"],
    );
    const b = epicSignatureFrame(
      "voltkit-nova-vanguard",
      { ...state, angle: Math.PI / 2 },
      SKIN_ART["voltkit-nova-vanguard"],
    );
    expect(a.filter((m) => m.essential)).toEqual(b.filter((m) => m.essential));
    expect(a.slice(-2)).not.toEqual(b.slice(-2));
  });
  it("draws the same plans through Plaza's existing canvas without state or object leaks", () => {
    for (const s of epics) {
      const calls: unknown[][] = [];
      const g: any = new Proxy(
        {},
        {
          get:
            (_t, k) =>
            (...args: unknown[]) => {
              calls.push([k, ...args]);
            },
        },
      );
      const plan = epicSignatureFrame(
        s.id,
        {
          now: 800,
          facing: "down",
          moving: true,
          dashing: false,
          ambient: true,
        },
        SKIN_ART[s.id],
      );
      for (const plane of ["ground", "rig"] as const)
        drawEpicCanvasFx(
          g,
          plan,
          {
            x: 200,
            y: 180,
            z: 0,
            bob: 1,
            rotation: 0.02,
            squash: 0.01,
            face: 1,
            size: 84,
            full: true,
          },
          plane,
        );
      expect(calls.filter((c) => c[0] === "save")).toHaveLength(2);
      expect(calls.filter((c) => c[0] === "restore")).toHaveLength(2);
      for (const c of calls)
        for (const n of c.slice(1))
          if (typeof n === "number") expect(Number.isFinite(n)).toBe(true);
    }
  });
});
