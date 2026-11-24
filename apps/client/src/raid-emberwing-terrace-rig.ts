/**
 * The Sky Terrace in the battle scene (raid-emberwing-terrace.ts has the
 * pieces and the pure layout). The atlas is drawn once, when the raid's
 * scene starts (prewarmTerrace). Each frame only places, scales, turns and
 * fades pooled images from it, and draws a few cheap lines on the raid's
 * graphics layer: every danger edge on its exact server radius, and the
 * brazier arcs.
 *
 * Layers: what lies on the floor (daises, rings, burning ground, the dive
 * lane) sits under the raid's graphics layer, so live warnings stay on top;
 * braziers, flames and the feather stand up and sort with the raiders by
 * their ground y. Low draws no halos, sparks or smoke and no breathing
 * glow on the burning ground; reduced motion holds every flame, glow and
 * the feather still (no flicker or bobbing) and skips the grounding flash.
 */
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import { EMBERWING as E } from "../../../packages/shared/src/raid";
import { addCanvasTexture } from "./canvas-texture";
import { fxFor } from "./fx-engine";
import type { LayerAt } from "./raid-layers";
import {
  RIM,
  SCORCH_R,
  brazierLook,
  nz,
  packTerrace,
  paintTerrace,
  patchFlames,
  ringFlames,
  terracePieces,
  trailPlacement,
} from "./raid-emberwing-terrace";

type G = Phaser.GameObjects.Graphics;
type Img = Phaser.GameObjects.Image;
const TAU = Math.PI * 2;
/** Atlas pixels per world unit, as the game's vector rigs. */
export const TERRACE_Q = 2;
export const TERRACE_ATLAS = "ember-terrace-atlas";
const pieces = new Map(terracePieces().map((p) => [p.name, p]));
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (x: number) => 1 - (1 - x) ** 3;
/** Floor pieces sit just under the raid's graphics layer (its warnings stay on top). */
const FLOOR = -1;
const ADD = 1; // Phaser.BlendModes.ADD
const NORMAL = 0;

/** Draw the atlas now (the raid's scene is starting), not on a fight's first frame. */
export function prewarmTerrace(scene: Phaser.Scene) {
  atlas(scene);
}
function atlas(scene: Phaser.Scene) {
  if (scene.textures.exists(TERRACE_ATLAS)) return;
  const packed = packTerrace(TERRACE_Q);
  const canvas = document.createElement("canvas");
  canvas.width = packed.width;
  canvas.height = Math.max(1, packed.height);
  const ctx = canvas.getContext("2d");
  if (ctx) paintTerrace(ctx, packed.spots, TERRACE_Q);
  // A plain image source (canvas-texture.ts): no pixel read-back.
  const texture = addCanvasTexture(scene.textures, TERRACE_ATLAS, canvas);
  for (const s of packed.spots)
    texture?.add(
      s.piece.name,
      0,
      s.x + 1,
      s.y + 1,
      Math.ceil(s.piece.w * TERRACE_Q * s.piece.res),
      Math.ceil(s.piece.h * TERRACE_Q * s.piece.res),
    );
}

interface Rig {
  pool: Img[];
  used: number;
  /** Additive lines (the flame ring's hot band). */
  hot: G;
  frame: number;
  exposed: boolean;
  /** When the braziers last brought Emberwing down (scene seconds), for the flash. */
  groundedAt: number;
  drawn: number;
}
const rigs = new WeakMap<G, Rig>();
function createRig(g: G): Rig {
  const scene = g.scene;
  const hot = scene.add.graphics().setName("terrace-hot").setBlendMode(ADD);
  const rig: Rig = {
    pool: [],
    used: 0,
    hot,
    frame: -1,
    exposed: false,
    groundedAt: -99,
    drawn: 0,
  };
  rigs.set(g, rig);
  const hideAll = () => {
    for (const img of rig.pool) img.setVisible(false);
    hot.clear();
  };
  // Not drawn this frame (another boss, no raid): nothing of it shows.
  const sync = () => {
    if (rig.frame !== scene.game.loop.frame) hideAll();
  };
  const dispose = () => {
    scene.events.off("prerender", sync);
    for (const img of rig.pool) img.destroy();
    hot.destroy();
    rigs.delete(g);
  };
  scene.events.on("prerender", sync);
  g.once("destroy", dispose);
  return rig;
}

/**
 * Draw the terrace's features for this frame. `g` is the raid's graphics
 * layer (lines go there), `at` the layers that sort with the raiders.
 */
export function paintSkyTerrace(
  g: G,
  state: Snapshot,
  reduced: boolean,
  at?: LayerAt,
) {
  const scene = g.scene;
  if (!scene?.sys?.isActive?.() || !state.raid) return false;
  atlas(scene);
  const rig = rigs.get(g) ?? createRig(g);
  rig.frame = scene.game.loop.frame;
  rig.used = 0;
  rig.hot.clear().setDepth(g.depth + 0.0005);
  const r = state.raid,
    t = reduced ? 0 : state.time;
  const low = fxFor(scene).density < 0.5;
  const sortAt = (y: number) =>
    at ? at("terrace-sort", y).depth : g.depth + 0.001;
  const put = (
    name: string,
    x: number,
    y: number,
    o: {
      s?: number;
      sx?: number;
      sy?: number;
      rot?: number;
      alpha?: number;
      add?: boolean;
      depth?: number;
      /** Its name, when it means more than its piece (tests). */
      tag?: string;
    } = {},
  ) => {
    const a = o.alpha ?? 1;
    if (a <= 0.003) return;
    const p = pieces.get(name)!;
    let img = rig.pool[rig.used];
    if (!img) {
      img = scene.add.image(0, 0, TERRACE_ATLAS, name);
      rig.pool.push(img);
    } else if (img.frame.name !== name || img.texture.key !== TERRACE_ATLAS)
      img.setTexture(TERRACE_ATLAS, name);
    rig.used++;
    const q = TERRACE_Q * p.res;
    img
      .setName(`terrace-${o.tag ?? name}`)
      .setVisible(true)
      .setOrigin(p.ox, p.oy)
      .setPosition(x, y)
      .setRotation(o.rot ?? 0)
      .setScale((o.sx ?? o.s ?? 1) / q, (o.sy ?? o.s ?? 1) / q)
      .setAlpha(Math.min(1, a))
      .setBlendMode(o.add ? ADD : NORMAL)
      .setDepth(o.depth ?? FLOOR);
  };

  // ── burning ground: the char and its seams, the exact edge, a few flames
  for (const f of r.emberPatches ?? []) {
    const sc = f.radius / SCORCH_R;
    put("scorch", f.x, f.y, { s: sc, rot: f.id * 1.7 });
    if (!low)
      put("scorch-glow", f.x, f.y, {
        s: sc,
        rot: f.id * 1.7,
        add: true,
        alpha: 0.5 + 0.25 * Math.sin(t * 2.2 + f.id),
        depth: FLOOR + 0.01,
      });
    g.lineStyle(2.5, 0x120602, 0.5).strokeCircle(f.x, f.y, f.radius + 2);
    g.lineStyle(2.6, 0xffac6f, 0.95).strokeCircle(f.x, f.y, f.radius);
    for (const fl of patchFlames(f)) {
      const w = nz(t, fl.seed);
      put("flame-s", fl.x, fl.y, {
        sx: fl.s * (1 + w * 0.08),
        sy: fl.s * (1 + w * 0.2),
        rot: w * 0.08,
        alpha: 0.95,
        depth: sortAt(fl.y),
      });
    }
  }
  // ── dive trails: a charred lane exactly 2 × its width across
  for (const f of r.emberTrails ?? []) {
    const p = trailPlacement(f);
    put("trail", p.x, p.y, { sx: p.sx, sy: p.sy, rot: p.rot });
    if (!low)
      put("trail-glow", p.x, p.y, {
        sx: p.sx,
        rot: p.rot,
        add: true,
        alpha: 0.6 + 0.3 * Math.sin(t * 3),
        depth: FLOOR + 0.01,
      });
    // Its exact edges, faint: the lane you must step out of.
    g.lineStyle(1.5, 0xffa76a, 0.4)
      .lineBetween(f.x + p.nx, f.y + p.ny, f.tx + p.nx, f.ty + p.ny)
      .lineBetween(f.x - p.nx, f.y - p.ny, f.tx - p.nx, f.ty - p.ny);
    for (let i = 1; i < 5; i++) {
      const fx = f.x + ((f.tx - f.x) * i) / 5,
        fy = f.y + ((f.ty - f.y) * i) / 5,
        w = nz(t, i * 1.9);
      put("flame-s", fx, fy, {
        sx: 0.95 + w * 0.06,
        sy: 1 + w * 0.18,
        rot: w * 0.07,
        depth: sortAt(fy),
      });
    }
  }
  // ── braziers
  const exposed = !!r.permanentGround || (r.exposedUntil ?? 0) > state.time;
  if (exposed && !rig.exposed) rig.groundedAt = state.time;
  rig.exposed = exposed;
  const since = state.time - rig.groundedAt;
  const flash = !reduced && since >= 0 && since < 1.4 ? since / 1.4 : undefined;
  const boost = flash !== undefined ? 1 + 0.9 * (1 - flash) ** 2 : 1;
  const pulse = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(t * 4.2);
  for (const [bi, b] of (r.braziers ?? []).entries()) {
    const L = brazierLook(b, {
      time: state.time,
      airborne: !!r.airborne,
      trait: r.trait,
      takeoffAt: r.takeoffAt,
      partySize: r.partySize,
      phase: r.phase,
      peril: r.peril,
    });
    const R = E.brazierRadius;
    put("dais", b.x, b.y);
    if (L.heat > 0)
      put("pool", b.x, b.y + 8, {
        add: true,
        s: 0.9 + 0.25 * L.heat * boost,
        alpha:
          (L.lit ? 1 : 0.45) *
          L.heat *
          (0.9 + 0.1 * nz(t, bi)) *
          Math.min(1.6, boost),
        depth: FLOOR + 0.02,
      });
    if (L.ring === "gold") {
      put("ring-gold", b.x, b.y, { alpha: 0.7 });
      put("glyph-gold", b.x, b.y, {
        add: true,
        alpha: 0.65 + 0.35 * L.heat,
        depth: FLOOR + 0.02,
      });
    } else if (L.ring === "teal") {
      // Dimmer while someone lights it, so the progress arc stands out.
      put("ring-teal", b.x, b.y, {
        alpha: L.progress > 0 ? 0.3 : 0.75 + 0.25 * pulse,
      });
      put("glyph-teal", b.x, b.y, {
        add: true,
        alpha: L.progress > 0 ? 0.35 + 0.5 * L.progress : 0.45 + 0.45 * pulse,
        depth: FLOOR + 0.02,
      });
    } else put("ring-grey", b.x, b.y, { alpha: 0.75 });
    // The progress (teal) or time-left (gold) arc on the exact standing radius:
    // a dark seat, the coloured band, a pale core, so it reads over its own ring.
    const v = L.lit ? L.left! : L.progress;
    if (v > 0) {
      const blink =
        L.dying && !reduced ? 0.55 + 0.45 * Math.abs(Math.sin(t * 6)) : 1;
      const a0 = -Math.PI / 2,
        a1 = a0 + v * TAU;
      const [band, core] = L.lit ? [0xffdb8d, 0xfff6dc] : [0x5fd9bd, 0xe4fff7];
      g.lineStyle(9, 0x0e0603, 0.75 * blink)
        .beginPath()
        .arc(b.x, b.y, R, a0, a1, false)
        .strokePath();
      g.lineStyle(6, band, blink)
        .beginPath()
        .arc(b.x, b.y, R, a0, a1, false)
        .strokePath();
      g.lineStyle(2.4, core, blink)
        .beginPath()
        .arc(b.x, b.y, R, a0, a1, false)
        .strokePath();
      put(
        L.lit ? "spark" : "spark-teal",
        b.x + Math.cos(a1) * R,
        b.y + Math.sin(a1) * R,
        {
          s: 1.8,
          add: true,
          alpha: blink,
          depth: FLOOR + 0.03,
          tag: L.lit ? "arc-gold" : "arc-teal",
        },
      );
    }
    // The brazier stands up and sorts with the raiders.
    const d = sortAt(b.y + 30);
    put("body", b.x, b.y, { depth: d });
    if (L.heat > 0)
      put("coals", b.x, b.y, { alpha: clamp(L.heat * 1.1), depth: d + 1e-6 });
    const fs = L.flame * (L.lit ? boost : 1);
    if (fs > 0) {
      const f1 = nz(t, bi * 5),
        f2 = nz(t * 1.3, bi * 5 + 2);
      const sput =
        L.dying && !reduced ? 0.86 + 0.14 * Math.sin(t * 19 + bi) : 1;
      const fy = b.y + RIM.iy + 1;
      put("flame-o", b.x - 4 + f2 * 2, fy, {
        sx: fs * 0.7,
        sy: fs * (0.62 + f2 * 0.1) * sput,
        rot: -0.28 + f2 * 0.08,
        alpha: L.lit ? 0.9 : 0.75,
        depth: d + 2e-6,
      });
      put("flame-o", b.x + f1 * 1.5, fy, {
        sx: fs * (1 + f1 * 0.06),
        sy: fs * (1 + f1 * 0.14) * sput,
        rot: f1 * 0.05,
        depth: d + 3e-6,
      });
      put("flame-c", b.x + f1, fy + 1, {
        sx: fs * 1.05,
        sy: fs * (1 + f2 * 0.12) * sput,
        add: true,
        alpha: L.lit ? 1 : 0.8,
        depth: d + 4e-6,
      });
      put("rimfront", b.x, b.y, { depth: d + 5e-6 });
      if (!low) {
        put("glow", b.x, fy - 20 * fs, {
          s: 0.5 + 0.55 * fs,
          add: true,
          alpha: (L.lit ? 0.7 : 0.45) * (0.88 + 0.12 * f1),
          depth: d + 6e-6,
        });
        if (!reduced) {
          const n = L.lit ? 3 : 1;
          for (let i = 0; i < n; i++) {
            const ph = (t * (0.7 + i * 0.13) + i / n + bi * 0.37) % 1;
            put(
              "spark",
              b.x + Math.sin(i * 2.1 + t * 2.6 + bi) * 10 * ph,
              fy - 14 - ph * 64 * fs,
              {
                s: 0.9 - ph * 0.4,
                add: true,
                alpha: 1 - ph,
                depth: d + 7e-6,
              },
            );
          }
          if (L.dying) {
            const ph = (t * 0.6 + bi * 0.3) % 1;
            put("smoke", b.x + ph * 8, fy - 30 - ph * 46, {
              s: 0.55 + ph * 0.8,
              alpha: 0.9 * (1 - ph) * Math.min(1, ph * 4),
              depth: d + 8e-6,
            });
          }
        }
      }
    }
  }
  // ── the grounding moment: fire leaps between the three braziers
  const br = r.braziers ?? [];
  if (flash !== undefined && br.length === 3) {
    const a = (1 - flash) ** 1.4;
    for (let i = 0; i < 3; i++) {
      const p = br[i],
        q = br[(i + 1) % 3],
        y0 = p.y - 30,
        y1 = q.y - 30;
      const len = Math.hypot(q.x - p.x, y1 - y0);
      put("beam", (p.x + q.x) / 2, (y0 + y1) / 2, {
        sx: (len * Math.min(1, flash * 5)) / 230,
        sy: 1.4 - flash * 0.6,
        rot: Math.atan2(y1 - y0, q.x - p.x),
        add: true,
        alpha: a * 0.9,
        depth: sortAt(Math.max(p.y, q.y) + 31),
      });
      if (!low)
        put("shock", p.x, p.y, {
          s: 0.6 + ease(flash) * 1.1,
          add: true,
          alpha: a,
          depth: FLOOR + 0.04,
        });
    }
  }
  // ── flame rings: one continuous band of fire on the exact hit band, flames riding it
  for (const ring of r.flameRings ?? []) {
    const R = Math.max(1, ring.radius),
      w = E.ring.width;
    g.lineStyle(w * 2, 0x280c04, 0.22).strokeCircle(ring.x, ring.y, R);
    rig.hot.lineStyle(w * 1.2, 0xff6423, 0.34).strokeCircle(ring.x, ring.y, R);
    rig.hot.lineStyle(w * 0.45, 0xff9a3c, 0.5).strokeCircle(ring.x, ring.y, R);
    g.lineStyle(4, 0xffce87, 1).strokeCircle(ring.x, ring.y, R);
    for (const fl of ringFlames(ring, R)) {
      const fw = nz(t, fl.seed);
      put("flame-s", fl.x, fl.y + 4, {
        sx: fl.s * (1.05 + fw * 0.08),
        sy: fl.s * (1.15 + fw * 0.25),
        rot: fw * 0.1,
        depth: sortAt(fl.y),
      });
    }
  }
  // ── molting feathers
  for (const f of r.emberFeathers ?? []) {
    const y = f.y - 7 + (reduced ? 0 : Math.sin(t * 2) * 4);
    put("pool", f.x, f.y + 6, {
      s: 0.3,
      add: true,
      alpha: 0.7,
      depth: FLOOR + 0.02,
    });
    if (!low)
      put("glow", f.x, y, {
        s: 0.55,
        add: true,
        alpha: 0.8,
        depth: sortAt(f.y) - 1e-6,
      });
    put("feather", f.x, y, {
      s: 1.25,
      rot: 0.35 + (reduced ? 0 : Math.sin(t * 1.6) * 0.1),
      depth: sortAt(f.y),
    });
  }
  for (let n = rig.used; n < rig.pool.length; n++)
    rig.pool[n].setVisible(false);
  rig.drawn = rig.used;
  return true;
}
/** Images the terrace placed last frame (tests and perf notes). */
export const terraceImages = (g: G) => rigs.get(g)?.drawn ?? 0;
