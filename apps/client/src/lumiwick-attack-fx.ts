/**
 * Lumiwick's attack effects (Emberwing's id), drawn every frame through the
 * effects engine (fx-engine.ts) inside boss-spell-art.ts's `space`, so they
 * keep to the graphics levels and the glow budget, and its warning glows
 * stay full size on Low (`essential`). They start from the lantern itself:
 * where boss-lumiwick-rig.ts last drew its hem and eyes.
 */
import type Phaser from "phaser";
import type { Fighter, Snapshot } from "@arena/shared";
import type { Fx } from "./fx-engine";
import type { BossCast } from "./boss-performance";

type Glow = (
  x: number,
  y: number,
  r: number,
  c: number,
  a: number,
  floor?: boolean,
) => void;
export interface LumiPoints {
  /** In the boss layer's coordinates. */
  hem: { x: number; y: number };
  eyes: { x: number; y: number }[];
  flame: number;
  lit: number;
}
const points = new WeakMap<Phaser.Scene, LumiPoints>();
/** The rig's latest hem and eyes (raid-emberwing-art.ts records them each frame). */
export const noteLumiwick = (scene: Phaser.Scene, p: LumiPoints) =>
  points.set(scene, p);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const HOT = 0xffd36a,
  WARM = 0xff8a3a,
  DEEP = 0xe0401a;

export function drawLumiwickAttacks(
  scene: Phaser.Scene,
  fx: Fx,
  glow: Glow,
  state: Snapshot,
  boss: Fighter,
  casts: BossCast[],
  low: boolean,
) {
  const r = state.raid,
    p = points.get(scene);
  if (!r || !p) return;
  const hem = p.hem;
  const eye = p.eyes.length
    ? {
        x: p.eyes.reduce((s, e) => s + e.x, 0) / p.eyes.length,
        y: p.eyes.reduce((s, e) => s + e.y, 0) / p.eyes.length,
      }
    : { x: hem.x, y: hem.y - 90 };
  // its own light: the open hem glows, and throws a warm pool on the floor
  if (p.lit > 0.05 && p.flame > 0.05) {
    glow(hem.x, hem.y + 8, (low ? 22 : 28) + r.phase * 4, WARM, 0.45 * p.lit);
    glow(boss.x, boss.y + 4, 60 + r.phase * 6, WARM, 0.22 * p.lit, true);
  }
  // windups: the hem flares as each warning fills (a warning: full size on Low)
  for (const w of r.warnings) {
    if (w.casterId && w.casterId !== boss.id) continue;
    if (w.kind === "brazier-lighting") continue;
    const start = w.startedAt ?? w.at - 1.5,
      k = clamp((state.time - start) / Math.max(0.01, w.at - start));
    if (k <= 0 || k > 1) continue;
    if (w.kind === "flame-ring" || w.kind === "dive-bomb")
      glow(hem.x, hem.y + 6, 24 + k * 36, HOT, 0.25 + k * 0.5);
    if (w.kind === "ember-rain" && k > 0.55)
      // the fountain: sparks flung up out of the hem
      fx.trail(`lumi-rain-${w.id}`, 0.06, () =>
        fx.burst({
          x: hem.x,
          y: hem.y,
          z: 0,
          count: low ? 3 : 6,
          kind: "ember",
          color: [HOT, WARM, 0xfff0b0],
          speed: [40, 140],
          up: [260, 420],
          life: [0.7, 1.1],
          size: [2, 3.5],
          grav: 520,
          drag: 0.6,
        }),
      );
    if (w.kind === "heat-mark" && k < 0.18) {
      // the glare: a hot line from its eyes to the branded raider
      const a = 1 - k / 0.18;
      fx.g
        .lineStyle(6, 0xff688c, 0.35 * a)
        .lineBetween(eye.x, eye.y, w.x, w.y - 30);
      fx.g
        .lineStyle(2, 0xfff0f2, 0.9 * a)
        .lineBetween(eye.x, eye.y, w.x, w.y - 30);
      for (const e of p.eyes) glow(e.x, e.y, 12, 0xffe0a0, 0.8 * a);
    }
  }
  for (const c of casts) {
    if (c.kind === "dive-bomb" && c.age < 0.5) {
      // the comet: embers and flame peel off the streaming wick
      fx.trail(`lumi-dive-${c.id}`, 0.03, () =>
        fx.burst({
          x: hem.x,
          y: hem.y,
          z: 0,
          count: low ? 2 : 4,
          kind: "flame",
          color: [WARM, HOT, DEEP],
          speed: [20, 70],
          life: [0.3, 0.55],
          size: [4, 8],
          drag: 2.5,
        }),
      );
      glow(hem.x, hem.y, 34, HOT, 0.7 * (1 - c.age / 0.5));
    } else if (c.kind === "wing-gust" && c.age < 0.45) {
      // a puff of hot air out of the hem, rolling along the cone
      const u = c.age / 0.45;
      for (let i = 0; i < (low ? 3 : 5); i++) {
        const a = c.angle + (i / 4 - 0.5) * 0.8,
          d = 40 + u * 220 * (0.8 + (i % 2) * 0.3);
        fx.soft(
          hem.x + Math.cos(a) * d,
          hem.y + 10 + Math.sin(a) * d * 0.7,
          18 + u * 30,
          0xffe2b0,
          0.22 * (1 - u),
        );
      }
    } else if (c.kind === "flame-ring" && c.age < 0.4) {
      glow(hem.x, hem.y, 50 + c.age * 120, HOT, 0.8 * (1 - c.age / 0.4));
    } else if (c.kind === "scorched-earth" && c.age < 0.5) {
      // a drop of burning wax arcs from the hem to the patch
      const u = c.age / 0.5,
        x = hem.x + (c.x - hem.x) * u,
        y = hem.y + (c.y - hem.y) * u - Math.sin(u * Math.PI) * 60;
      fx.g.fillStyle(0xffc24a, 1).fillCircle(x, y, 6);
      fx.g.fillStyle(0xfff6c8, 0.9).fillCircle(x - 2, y - 2, 2.2);
      fx.g
        .fillStyle(0xff8a3a, 0.85)
        .fillTriangle(x - 4, y - 3, x + 4, y - 3, x, y - 16);
      glow(x, y, 16, WARM, 0.7);
    }
  }
  // beaten: a thread of smoke rises from the guttered wick
  if (boss.hp <= 0 && p.lit < 0.5)
    fx.trail("lumi-smoke", 0.25, () =>
      fx.burst({
        x: hem.x,
        y: hem.y,
        z: 0,
        count: 1,
        kind: "smoke",
        color: 0x6a5a52,
        speed: [2, 8],
        up: [20, 40],
        life: [1.2, 1.8],
        size: [6, 10],
        drag: 1,
      }),
    );
}
