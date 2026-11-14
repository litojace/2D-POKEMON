/**
 * Tidelotl's attack effects (Tidewyrm's id), drawn every frame through the
 * effects engine (fx-engine.ts) inside boss-spell-art.ts's `space`, so they
 * keep to the graphics levels and the glow budget; the windup's mouth glow
 * is a warning (`essential`), full size on Low. They start from the
 * axolotl itself: where boss-tidelotl-rig.ts last drew its mouth.
 *
 * - Bubble barrage: while the fan's warning fills, little bubbles are drawn
 *   in towards the puffed cheeks; when it casts, a puff of bubbles and spray
 *   blows out of the mouth along the fan's aim.
 * - Every other cast lands as painted water: a crown of spray inside the
 *   warning's footprint and a few shiny drops (no serpent ribbons).
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
export interface LotlPoints {
  /** In the boss layer's coordinates. */
  mouth: { x: number; y: number };
  head: { x: number; y: number };
}
const points = new WeakMap<Phaser.Scene, LotlPoints>();
/** The rig's latest mouth and head (raid-tidewyrm-art.ts records them each frame). */
export const noteTidelotl = (scene: Phaser.Scene, p: LotlPoints) =>
  points.set(scene, p);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const FOAM = 0xe6fbff,
  AQUA = 0x9fe8f4,
  PEARL = 0xbff6ff,
  PINK = 0xffb3d4;

export function drawTidelotlAttacks(
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
  if (!r || !p || r.submerged) return;
  const mouth = p.mouth;
  // the windup: bubbles drawn in towards the puffed cheeks (a warning glow: full size on Low)
  for (const w of r.warnings) {
    if (w.kind !== "bubbles" && w.kind !== "prison") continue;
    if (w.casterId && w.casterId !== boss.id) continue;
    const start = w.startedAt ?? w.at - 1,
      k = clamp((state.time - start) / Math.max(0.01, w.at - start));
    if (k <= 0 || k >= 1) continue;
    fx.essential(() =>
      glow(mouth.x, mouth.y, 10 + k * 14, PEARL, 0.25 + k * 0.4),
    );
    fx.trail(`lotl-gather-${w.id}`, low ? 0.16 : 0.08, () => {
      const a = Math.random() * Math.PI * 2,
        d = 46 + Math.random() * 30;
      fx.burst({
        x: mouth.x + Math.cos(a) * d,
        y: mouth.y + Math.sin(a) * d * 0.7,
        z: 0,
        count: 1,
        kind: "mote",
        color: [PEARL, FOAM, PINK],
        speed: [d * 2.2, d * 2.6],
        angle: a + Math.PI,
        spread: 0.15,
        life: [0.35, 0.45],
        size: [2, 3.5],
        drag: 1.5,
      });
    });
  }
  for (const c of casts) {
    if (c.kind === "bubbles" || c.kind === "prison") {
      // the blow: a puff of bubbles and spray out of the mouth, along the aim
      fx.trail(`lotl-blow-${c.id}`, 99, () => {
        fx.burst({
          x: mouth.x,
          y: mouth.y,
          z: 0,
          count: low ? 7 : 14,
          kind: "mote",
          color: [PEARL, FOAM, PINK, AQUA],
          speed: [120, 260],
          angle: c.angle,
          spread: c.kind === "bubbles" ? (c.spread ?? 0.45) : 0.25,
          life: [0.4, 0.7],
          size: [2.5, 5],
          drag: 2.2,
        });
        fx.burst({
          x: mouth.x,
          y: mouth.y,
          z: 6,
          count: low ? 4 : 8,
          kind: "drop",
          color: [FOAM, AQUA],
          speed: [80, 180],
          up: [60, 140],
          angle: c.angle,
          spread: 0.5,
          life: [0.4, 0.6],
          size: [1.6, 3],
          grav: 600,
        });
      });
      if (c.age < 0.25)
        glow(mouth.x, mouth.y, 16, PEARL, (1 - c.age / 0.25) * 0.4);
      continue;
    }
    // every other cast lands as painted water inside its footprint
    const x = c.x,
      y = c.y,
      rad = Math.min(120, Math.max(40, c.radius * 0.7));
    fx.trail(`lotl-splash-${c.id}`, 99, () =>
      fx.burst({
        x,
        y,
        z: 0,
        count: low ? 6 : 12,
        kind: "drop",
        color: [FOAM, AQUA, 0xffffff],
        speed: [40, rad * 1.4],
        up: [140, 300],
        life: [0.5, 0.85],
        size: [2, 4],
        grav: 700,
      }),
    );
    const k = clamp(c.age / 0.55);
    if (k >= 1) continue;
    const grow = Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5),
      fade = 1 - k * k,
      n = low ? 7 : 11;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1),
        sx = x - rad * 0.55 + f * rad * 1.1,
        h = (26 + Math.sin(f * Math.PI) * 38) * grow,
        lean = (sx - x) * 0.4;
      fx.solid
        .fillStyle(AQUA, 0.75 * fade)
        .fillTriangle(sx - 5, y, sx + lean, y - h, sx + 5, y);
      fx.solid
        .fillStyle(0xffffff, 0.85 * fade)
        .fillCircle(sx + lean * 1.1, y - h - 3, 2);
    }
  }
}
