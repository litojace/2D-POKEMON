import { describe, expect, it } from "vitest";
import { CHARACTERS } from "@arena/shared";
import { LOOK_ITEMS } from "../../packages/shared/src/shop";
import { RAID_COSMETICS } from "../../packages/shared/src/raid";
import { JOURNEY_ITEMS } from "../../packages/shared/src/journey";
import { SKIN_ART } from "../../apps/client/src/skins/skin-art";
import {
  PLAZA_SKIN_FX_CAP,
  PLAZA_VICTORY_S,
  cheerWearer,
  drawWornBehind,
  drawWornFront,
  greetWearer,
  wearsFx,
  type Wearer,
} from "../../apps/client/src/plaza/plaza-cosmetics";

// The Plaza shows a champion skin's own effects and the Entrance and Victory
// slots, run by the match's effect code through the plain-canvas stand-in
// for Phaser's Graphics (fx-canvas.ts). That stand-in throws on a Graphics
// call it lacks, so every skin (at every Awakening stage), every entrance
// and every victory runs here, walking, dashing, arriving and celebrating.

/** A canvas that counts what is painted on it. */
function canvas() {
  let painted = 0;
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key === "createLinearGradient" || key === "createRadialGradient")
        return () => ({ addColorStop() {} });
      return (..._: unknown[]) => {
        if (/fill|stroke/.test(key)) painted++;
      };
    },
    set(target, key: string, v) {
      target[key] = v;
      return true;
    },
  });
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    painted: () => painted,
  };
}
const championOf = (skin: string) =>
  Object.keys(CHARACTERS).find((c) => skin.startsWith(`${c}-`));
const opts = { reduced: false, low: false, full: true };

/** Frames of a fighter in the Plaza: arrive, walk, dash, stand, celebrate. */
function play(b: Wearer, o = opts) {
  const c = canvas();
  let now = 1000,
    most = 0;
  const frame = () => {
    drawWornBehind(c.ctx, b, { ...o, now });
    drawWornFront(c.ctx, b, { ...o, now });
    most = Math.max(most, b.sfx?.particles.length ?? 0);
    now += 50;
  };
  greetWearer(b);
  for (let i = 0; i < 30; i++) {
    b.sp = i < 20 ? 160 : 0;
    b.vx = i < 10 ? 160 : -160;
    b.face = b.vx > 0 ? 1 : -1;
    b.dash = i >= 12 && i < 16 ? 1 : 0;
    frame();
  }
  cheerWearer(b, now);
  for (let i = 0; i < (PLAZA_VICTORY_S * 1000) / 50 + 10; i++) frame();
  return { painted: c.painted(), most };
}

describe("Plaza: a skin's effects, entrances and victories", () => {
  it("every champion skin draws at every stage, within the particle cap", () => {
    const skins = Object.keys(SKIN_ART);
    expect(skins.length).toBeGreaterThan(50);
    let unowned = 0,
      withFx = 0;
    for (const skin of skins) {
      const character = championOf(skin);
      if (!character) {
        unowned++;
        continue;
      }
      for (const stage of [1, 2, 3]) {
        const b: Wearer = {
          x: 500,
          y: 600,
          z: 0,
          character,
          skin: { skin, stage },
        };
        let r = { painted: 0, most: 0 };
        expect(() => (r = play(b)), `${skin} stage ${stage}`).not.toThrow();
        expect(r.most, skin).toBeLessThanOrEqual(PLAZA_SKIN_FX_CAP);
        if (stage === 3 && r.painted > 0) withFx++;
      }
    }
    expect(unowned).toBe(0);
    // Most skins have something to show (Rare and up: a trail at least).
    expect(withFx).toBeGreaterThan(skins.length / 2);
  });

  const piecesOf = (slot: string) => [
    ...new Set([
      ...LOOK_ITEMS.filter((i) => i.slot === slot).map((i) => i.id),
      ...Object.entries(RAID_COSMETICS)
        .filter(([, v]) => v.slot === slot)
        .map(([id]) => id),
      ...JOURNEY_ITEMS.filter((i) => i.slot === slot).map((i) => i.id),
    ]),
  ];

  it("every entrance plays when its wearer arrives", () => {
    const ids = piecesOf("entrance");
    expect(ids.length).toBeGreaterThan(5);
    for (const entrance of ids) {
      const b: Wearer = {
        x: 500,
        y: 600,
        z: 0,
        character: "voltkit",
        entrance,
      };
      expect(wearsFx(b)).toBe(true);
      const c = canvas();
      greetWearer(b);
      expect(() => {
        for (let i = 0; i < 20; i++) {
          drawWornBehind(c.ctx, b, { ...opts, now: 1000 + i * 50 });
          drawWornFront(c.ctx, b, { ...opts, now: 1000 + i * 50 });
        }
      }, entrance).not.toThrow();
      expect(c.painted(), entrance).toBeGreaterThan(0);
    }
  });

  it("every victory plays for its whole finale, then stops", () => {
    const ids = piecesOf("victory");
    expect(ids.length).toBeGreaterThan(5);
    for (const victory of ids) {
      const b: Wearer = { x: 500, y: 600, z: 0, character: "voltkit", victory };
      let r = { painted: 0, most: 0 };
      expect(() => (r = play(b)), victory).not.toThrow();
      expect(r.painted, victory).toBeGreaterThan(0);
      expect(b.sfx!.cheerAt).toBeNull();
    }
  });

  it("nothing plays until it is due, and not at all with reduced motion", () => {
    const b: Wearer = {
      x: 500,
      y: 600,
      z: 0,
      character: "voltkit",
      entrance: piecesOf("entrance")[0],
      victory: piecesOf("victory")[0],
    };
    const quiet = canvas();
    drawWornBehind(quiet.ctx, b, { ...opts, now: 1000 });
    drawWornFront(quiet.ctx, b, { ...opts, now: 1000 });
    expect(quiet.painted()).toBe(0);
    const still = canvas();
    greetWearer(b);
    cheerWearer(b, 1000);
    for (let i = 0; i < 10; i++) {
      drawWornBehind(still.ctx, b, {
        ...opts,
        reduced: true,
        now: 1000 + i * 50,
      });
      drawWornFront(still.ctx, b, {
        ...opts,
        reduced: true,
        now: 1000 + i * 50,
      });
    }
    expect(still.painted()).toBe(0);
    expect(b.sfx!.particles).toEqual([]);
  });

  it("a skin for another champion shows nothing (as in a match)", () => {
    const skin = Object.keys(SKIN_ART).find((s) => s.startsWith("voltkit-"))!;
    const b: Wearer = { x: 0, y: 0, z: 0, character: "lumoth", skin: { skin } };
    expect(wearsFx(b)).toBe(false);
  });
});
