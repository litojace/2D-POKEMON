/**
 * Grumblecrag's pillars in the battle scene (raid-grumble-pillars.ts has the
 * pieces and the pure layout). The atlas is drawn once, when the raid's
 * scene starts (prewarmPillars); each frame only places, crops, fades,
 * scales and turns images from it:
 *  - standing: per pillar its shadow, the stone, and one additive light
 *    (16 images for five pillars, glint included);
 *  - a crumble adds cracks, the rubble showing through, the impact ring,
 *    dust puffs and thrown stones (about 24 more for a few seconds).
 *
 * Depths are those of the Coliseum's blocks: the stone sorts with the
 * fighters by its front edge (fighterDepth(o.y + o.h)), the shadow and
 * rubble lie on the floor. Low draws no crystal light, no glint and half the
 * dust and stones; reduced motion swaps instantly, with no flicker or glint.
 */
import type Phaser from "phaser";
import { addCanvasTexture } from "./canvas-texture";
import {
  PILLARS,
  eventBits,
  eventDone,
  flicker,
  glintNow,
  glintSpot,
  packPillars,
  paintPillars,
  pillarLook,
  pillarPieces,
  puffAt,
  stoneAt,
  type PillarEventKind,
  type Puff,
  type Thrown,
} from "./raid-grumble-pillars";

/** Atlas pixels per world unit (sharp enough at 2× and well under 10 MB). */
export const PILLAR_K = 1.4;
export const PILLAR_ATLAS = "grumble-pillars-atlas";
const pieces = new Map(pillarPieces().map((p) => [p.name, p]));
/** Draw the atlas now (the raid's scene is starting), not on a fight's first frame. */
export function prewarmPillars(scene: Phaser.Scene) {
  atlas(scene);
}
function atlas(scene: Phaser.Scene) {
  if (scene.textures.exists(PILLAR_ATLAS)) return PILLAR_ATLAS;
  const packed = packPillars(PILLAR_K);
  const canvas = document.createElement("canvas");
  canvas.width = packed.width;
  canvas.height = Math.max(1, packed.height);
  const ctx = canvas.getContext("2d");
  if (ctx) paintPillars(ctx, packed.spots, PILLAR_K);
  // A plain image source (canvas-texture.ts): no pixel read-back.
  const texture = addCanvasTexture(scene.textures, PILLAR_ATLAS, canvas);
  for (const s of packed.spots)
    texture?.add(
      s.piece.name,
      0,
      s.x + 1,
      s.y + 1,
      Math.ceil(s.piece.w * PILLAR_K * s.piece.res),
      Math.ceil(s.piece.h * PILLAR_K * s.piece.res),
    );
  return PILLAR_ATLAS;
}

type Img = Phaser.GameObjects.Image;
interface Change {
  kind: PillarEventKind;
  t0: number;
  puffs: Puff[];
  stones: Thrown[];
}
const ADD = 1; // Phaser.BlendModes.ADD
const NORMAL = 0;

export class PillarRig {
  private fixed = new Map<string, Img>();
  private pool: Img[] = [];
  private used = 0;
  private broken: (boolean | undefined)[] = [];
  private changes: (Change | undefined)[] = [];
  private rings: { x: number; y: number; t0: number; reduced: boolean }[] = [];
  private rs = 1 + Math.floor(Math.random() * 2e9);
  /** Images placed last frame (for tests and the perf notes). */
  drawn = 0;
  constructor(
    private scene: Phaser.Scene,
    private depth: (groundY: number) => number,
  ) {
    atlas(scene);
    PILLARS.forEach((o, i) => {
      const foot = o.y + o.h;
      for (const [kind, dz, blend] of [
        ["shadow", -9.5, NORMAL],
        ["rubble", -9, NORMAL],
        ["rlight", -8.95, ADD],
        ["block", depth(foot), NORMAL],
        ["cracks", depth(foot) + 1e-6, NORMAL],
        ["light", depth(foot) + 2e-6, ADD],
      ] as const) {
        const name = `${kind}${i}`,
          p = pieces.get(name)!;
        const img = scene.add
          .image(p.x, p.y, PILLAR_ATLAS, name)
          .setOrigin(0)
          .setScale(1 / (PILLAR_K * p.res))
          .setDepth(dz)
          .setBlendMode(blend)
          .setName(`pillar-${name}`)
          .setVisible(false);
        this.fixed.set(name, img);
      }
    });
  }
  /** Shown on the Grumblecrag raid only; hidden it forgets what it saw. */
  setVisible(on: boolean) {
    if (on) return;
    for (const img of [...this.fixed.values(), ...this.pool])
      img.setVisible(false);
    this.broken = [];
    this.changes = [];
    this.rings = [];
  }
  /** The boss broke a pillar: its raid-impact ring (radius 100, as the server's). */
  impact(x: number, y: number, now: number, reduced: boolean) {
    this.rings.push({ x, y, t0: now, reduced });
  }
  private rnd = () => (this.rs = (this.rs * 16807) % 2147483647) / 2147483647;
  private take(frame: string, depth: number, blend = NORMAL) {
    let img = this.pool[this.used];
    if (!img) {
      img = this.scene.add
        .image(0, 0, PILLAR_ATLAS, frame)
        .setName("pillar-fx");
      this.pool.push(img);
    } else if (img.frame.name !== frame) img.setFrame(frame);
    this.used++;
    const p = pieces.get(frame)!;
    return img
      .setVisible(true)
      .setOrigin(0.5)
      .setDepth(depth)
      .setBlendMode(blend)
      .setRotation(0)
      .setScale(1 / (PILLAR_K * p.res));
  }
  private place(
    name: string,
    show: boolean,
    x = 0,
    y = 0,
    alpha = 1,
    crop = 0,
  ) {
    const img = this.fixed.get(name)!;
    if (!show || alpha <= 0.003) {
      img.setVisible(false);
      return 0;
    }
    const p = pieces.get(name)!;
    img
      .setVisible(true)
      .setPosition(p.x + x, p.y + y)
      .setAlpha(Math.min(1, alpha));
    if (crop > 0) {
      const fh = img.frame.height;
      img.setCrop(
        0,
        0,
        img.frame.width,
        Math.max(1, fh - crop * PILLAR_K * p.res),
      );
    } else if (img.isCropped) img.setCrop();
    return 1;
  }
  /**
   * Place this frame's images. `now` in ms (the scene's clock). Returns the
   * front edges of the stones on show, which effects pass behind (Fx.at).
   */
  update(
    now: number,
    pillars: readonly { broken: boolean }[],
    reduced: boolean,
    low: boolean,
  ) {
    atlas(this.scene);
    this.used = 0;
    let drawn = 0;
    const fronts: number[] = [];
    const t = now / 1000;
    PILLARS.forEach((o, i) => {
      const broken = !!pillars[i]?.broken,
        was = this.broken[i];
      this.broken[i] = broken;
      if (was !== undefined && was !== broken) {
        const kind: PillarEventKind = broken ? "crumble" : "rise";
        this.changes[i] = {
          kind,
          t0: now,
          ...eventBits(o, kind, this.rnd, { low, reduced }),
        };
      }
      const ch = this.changes[i];
      const e = ch ? now - ch.t0 : Infinity;
      if (ch && eventDone(ch.kind, e)) this.changes[i] = undefined;
      const L = pillarLook(broken, ch?.kind, e, reduced);
      const fl = flicker(t, i, reduced);
      drawn += this.place(`shadow${i}`, L.shadow > 0, L.bx * 0.3, 0, L.shadow);
      drawn += this.place(`rubble${i}`, L.rubble > 0, 0, 0, L.rubble);
      drawn += this.place(
        `rlight${i}`,
        !low && L.rlight > 0,
        0,
        0,
        L.rlight * (0.75 + 0.25 * fl),
      );
      drawn += this.place(`block${i}`, L.block, L.bx, L.by, L.ba, L.crop);
      drawn += this.place(
        `cracks${i}`,
        L.block && L.cracks > 0,
        L.bx,
        L.by,
        L.cracks * L.ba,
        L.crop,
      );
      drawn += this.place(
        `light${i}`,
        !low && L.block && L.light > 0,
        L.bx,
        L.by,
        L.light * fl * L.ba,
      );
      if (L.block && L.ba >= 0.5) fronts.push(o.y + o.h);
      if (!ch) return;
      const foot = o.y + o.h;
      for (const f of ch.puffs) {
        const at = puffAt(f, e);
        if (!at) continue;
        this.take("dust", this.depth(foot + 0.05))
          .setPosition(at.x, at.y)
          .setScale(at.sx / (PILLAR_K * 0.5), at.sy / (PILLAR_K * 0.5))
          .setAlpha(at.alpha);
        drawn++;
      }
      for (const s of ch.stones) {
        const at = stoneAt(s, e);
        if (!at) continue;
        this.take(`chunk${s.v}`, this.depth(at.gy + 0.01))
          .setPosition(at.x, at.y)
          .setScale(s.s / PILLAR_K)
          .setRotation(at.rot)
          .setAlpha(at.alpha);
        drawn++;
      }
    });
    // The impact ring: grows a quarter and fades over 400 ms (still with reduced motion).
    this.rings = this.rings.filter((r) => now - r.t0 < 400);
    for (const r of this.rings) {
      const p = (now - r.t0) / 400,
        s = r.reduced ? 1 : 1 + 0.25 * p;
      this.take("ring", 0.0005)
        .setPosition(r.x, r.y)
        .setScale(s / (PILLAR_K * 0.75))
        .setAlpha(1 - p);
      drawn++;
    }
    // One glint at a time on a crystal tip (not on Low or with reduced motion).
    const gl = !low && !reduced ? glintNow(t) : undefined;
    if (gl && !this.broken[gl.i] && !this.changes[gl.i]) {
      const o = PILLARS[gl.i],
        at = glintSpot(o, gl.i);
      this.take("glint", this.depth(o.y + o.h) + 3e-6, ADD)
        .setPosition(at.x, at.y)
        .setScale((0.6 + 0.6 * gl.k) / PILLAR_K)
        .setRotation(gl.rot)
        .setAlpha(gl.k);
      drawn++;
    }
    for (let n = this.used; n < this.pool.length; n++)
      this.pool[n].setVisible(false);
    this.drawn = drawn;
    return fronts;
  }
}
