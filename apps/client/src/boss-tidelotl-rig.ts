/**
 * Tidelotl in the battle scene (boss-tidelotl.ts has the pose and the
 * placements, boss-tidelotl-paint.ts the painters). Every piece is painted
 * once into two atlases when the battle loads: a main one (face, gills,
 * pearl, water) and a skin one (head, body, legs, tail), whose colours
 * follow the phase. A new phase repaints the skin atlas in place, a few
 * milliseconds a frame and never while an attack is winding up, and uploads
 * it once when it is done, so the whole body changes colour together and no
 * second atlas is ever held. Each frame only moves, turns, scales, fades and
 * crops (under each part's waterline) images from the two atlases, the
 * water round it included: veil, foam, ripple rings and wake are painted
 * pieces too. Glows and splash drops go through the effects engine.
 */
import type Phaser from "phaser";
import { addCanvasTexture, updateCanvasTexture } from "./canvas-texture";
import { fxFor } from "./fx-engine";
import { raidMapLow } from "./raid-map-atlas";
import {
  LOTL_SCALE,
  lotlFacing,
  tidelotlPieces,
  tidelotlPlacements,
  tidelotlPose,
  paintPiece,
  pack,
  type LotlCue,
  type LotlPiece,
  type LotlPlacement,
  type LotlWater,
} from "./boss-tidelotl";

const MAIN = "lotl-main",
  SKIN = "lotl-skin";

export interface TidelotlLook extends Omit<LotlCue, "clock"> {
  x: number;
  y: number;
  /** Where it faces (screen radians). */
  angle: number;
  clock: number;
  gilded: boolean;
  /** Is there water (true) or an island's sand (false) at this floor spot? */
  wet: (x: number, y: number) => boolean;
}

// ── the atlases ──
interface Slot {
  sx: number;
  sy: number;
  w: number;
  h: number;
  q: number;
  /** The piece's origin inside its frame (0–1). */
  ox: number;
  oy: number;
}
interface Atlas {
  slots: Map<string, Slot>;
  page: HTMLCanvasElement;
  key: string;
}
interface SceneAtlas {
  main: Atlas;
  skin: Atlas;
  phase: number;
  /** A phase repaint under way: the skin pieces still to paint. */
  job?: { phase: number; todo: LotlPiece[] };
  bytes: number;
}
const atlases = new WeakMap<Phaser.Scene, SceneAtlas>();
const pieceList = () => tidelotlPieces();
function addFrames(scene: Phaser.Scene, a: Atlas) {
  const tex = addCanvasTexture(scene.textures, a.key, a.page);
  for (const [name, s] of a.slots) tex?.add(name, 0, s.sx, s.sy, s.w, s.h);
}
/** Paint both atlases now (while the battle loads), for the raid's phase. */
export function prewarmAtlas(scene: Phaser.Scene, phase: number) {
  atlasFor(scene, phase);
}
function atlasFor(scene: Phaser.Scene, phase: number): SceneAtlas | undefined {
  let A = atlases.get(scene);
  if (A && scene.textures.exists(MAIN) && scene.textures.exists(SKIN)) return A;
  if (typeof document === "undefined") return undefined;
  const all = pieceList();
  const paintAll = (list: LotlPiece[]) =>
    list.flatMap((p) => {
      const out = paintPiece(p, phase);
      return out ? [{ name: p.name, p: out }] : [];
    });
  for (const key of [MAIN, SKIN])
    if (scene.textures.exists(key)) scene.textures.remove(key);
  const m = pack(paintAll(all.filter((p) => !p.skin))),
    s = pack(paintAll(all.filter((p) => p.skin)));
  A = {
    main: { ...m, key: MAIN },
    skin: { ...s, key: SKIN },
    phase,
    bytes: (m.page.width * m.page.height + s.page.width * s.page.height) * 4,
  };
  addFrames(scene, A.main);
  addFrames(scene, A.skin);
  atlases.set(scene, A);
  return A;
}
/** Repaint skin pieces for a new phase into their own slots, within `ms`; upload once when all are done. */
function stepRepaint(scene: Phaser.Scene, A: SceneAtlas, ms: number) {
  const J = A.job;
  if (!J) return;
  const until = performance.now() + ms,
    g = A.skin.page.getContext("2d")!;
  while (J.todo.length && performance.now() < until) {
    const p = J.todo.shift()!,
      s = A.skin.slots.get(p.name),
      out = paintPiece(p, J.phase);
    if (!s || !out) continue;
    g.save();
    g.beginPath();
    g.rect(s.sx, s.sy, s.w, s.h);
    g.clip();
    g.clearRect(s.sx, s.sy, s.w, s.h);
    g.drawImage(
      out.canvas,
      Math.round(s.sx + s.ox * s.w - out.ox),
      Math.round(s.sy + s.oy * s.h - out.oy),
    );
    g.restore();
    out.canvas.width = out.canvas.height = 0;
  }
  if (!J.todo.length) {
    A.phase = J.phase;
    A.job = undefined;
    updateCanvasTexture(scene.textures, SKIN);
  }
}
/** The atlas's memory in bytes (both pages), for tests. */
export function tidelotlAtlasBytes(scene: Phaser.Scene) {
  return atlases.get(scene)?.bytes ?? 0;
}
/** The phase the skin atlas currently shows, for tests. */
export function tidelotlSkinPhase(scene: Phaser.Scene) {
  const A = atlases.get(scene);
  return A ? (A.job ? -A.job.phase : A.phase) : 0;
}

// ── the rig ──
type Sorted = Phaser.GameObjects.Image & { vz: number };
interface Rig {
  root: Phaser.GameObjects.Container;
  actor: Phaser.GameObjects.Container;
  front: Phaser.GameObjects.Graphics;
  images: Map<string, Sorted>;
  frame: number;
  facing?: number;
  spin: number;
  clock: number;
  sea: Sea;
}
/** The water's memory: rings left on the surface, the trail of foam, its speed. */
interface Sea {
  /** Ripple rings (the layer's coordinates, so they stay where they were made). */
  rings: { x: number; y: number; at: number; big: number }[];
  puffs: {
    x: number;
    y: number;
    at: number;
    side: number;
    dx: number;
    dy: number;
  }[];
  nextRing: number;
  nextPuff: number;
  px?: number;
  py?: number;
  vx: number;
  vy: number;
  facing?: number;
  surfaced: boolean;
}
const rigs = new WeakMap<Phaser.GameObjects.Graphics, Rig>();
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
/** The water's pieces keep their own colours whatever tints the body. */
const UNTINTED = /^(swirl|foam|lace|ripple|veil|wake)/;
const RING_LIFE = 1.9,
  PUFF_LIFE = 1.3;
/**
 * The living water round it, beyond what the pose places: ripple rings that
 * spread from where it floats (more often while it swims or attacks), a
 * wake and a trail of foam behind it as it swims, foam flecks drifting off,
 * and a ring and a splash when it turns or bursts up. Rings and foam stay
 * where they were made while it moves on. Low keeps fewer; reduced motion
 * keeps two still rings and no trail.
 */
function seaPlacements(
  scene: Phaser.Scene,
  rig: Rig,
  o: TidelotlLook,
  water: LotlWater | undefined,
  dt: number,
  turned: boolean,
) {
  const S = rig.sea,
    back: LotlPlacement[] = [],
    front: LotlPlacement[] = [],
    t = o.clock,
    low = raidMapLow();
  // its speed over the water (smoothed), from where the layer puts it
  if (S.px !== undefined && dt > 0) {
    const k = clamp(dt * 6);
    S.vx += ((o.x - S.px) / dt - S.vx) * k;
    S.vy += ((o.y - S.py!) / dt - S.vy) * k;
  }
  S.px = o.x;
  S.py = o.y;
  if (!water) {
    S.rings.length = S.puffs.length = 0;
    S.surfaced = false;
    return { back, front };
  }
  const pl = (
    key: string,
    piece: string,
    x: number,
    y: number,
    sx: number,
    sy: number,
    alpha: number,
    rot = 0,
  ): LotlPlacement => ({ key, piece, x, y, rot, sx, sy, alpha });
  const ring = (
    key: string,
    x: number,
    y: number,
    q: number,
    big: number,
    a: number,
  ) => {
    const rx = water.rx * 1.06 + 4 + q * (60 + 40 * big),
      ry = water.ry * 1.2 + 3 + q * (26 + 16 * big);
    back.push(pl(`${key}b`, "rippleBack", x, y, rx / 100, ry / 50, a * 0.8));
    front.push(pl(`${key}f`, "rippleFront", x, y, rx / 100, ry / 50, a));
  };
  if (o.reduced) {
    // still water: two rings, no trail
    ring("rr0", water.cx, water.cy, 0.25, 0, 0.55);
    ring("rr1", water.cx, water.cy, 0.62, 0, 0.3);
    return { back, front };
  }
  const speed = Math.hypot(S.vx, S.vy),
    moving = clamp((speed - 18) / 70),
    attacking = !!o.windKind || (!!o.castKind && o.castAge < 0.8);
  // a ring when it turns or bursts up; more often while it swims or attacks
  if (o.rise < 0.4 && !S.surfaced) {
    S.surfaced = true;
    S.rings.push(
      { x: o.x, y: o.y, at: t, big: 1 },
      { x: o.x, y: o.y, at: t - 0.35, big: 1 },
    );
  } else if (o.rise >= 1) S.surfaced = false;
  if (turned) {
    S.rings.push({ x: o.x, y: o.y, at: t, big: 0.6 });
    fxFor(scene).burst({
      x: o.x + water.cx,
      y: o.y + water.cy,
      count: low ? 3 : 7,
      kind: "drop",
      color: [0xe6fbff, 0x9fe8f4],
      speed: [30, 90],
      up: [80, 160],
      life: [0.35, 0.6],
      size: [1.5, 3],
      grav: 700,
    });
  }
  if (t >= S.nextRing) {
    S.rings.push({ x: o.x, y: o.y, at: t, big: attacking ? 0.5 : 0 });
    S.nextRing = t + (attacking ? 0.45 : moving > 0.3 ? 0.6 : 1.3);
  }
  S.nextRing = Math.min(S.nextRing, t + 1.3);
  const maxRings = low ? 2 : 4;
  S.rings = S.rings
    .filter((r) => t - r.at < RING_LIFE && t >= r.at - 1)
    .slice(-maxRings);
  S.rings.forEach((r, i) => {
    const q = clamp((t - r.at) / RING_LIFE),
      a =
        Math.pow(1 - q, 1.4) *
        Math.min(1, q * 8 + 0.15) *
        (0.75 + 0.25 * r.big);
    ring(`rg${i}`, r.x - o.x + water.cx, r.y - o.y + water.cy, q, r.big, a);
  });
  // swimming: a wake opening behind it, and a trail of foam left on the water
  const dir = Math.atan2(S.vy, S.vx);
  if (moving > 0.02) {
    const fx = Math.cos(dir),
      fy = Math.sin(dir) * 0.6;
    back.push(
      pl(
        "wake",
        "wake",
        water.cx + fx * water.rx * 0.3,
        water.cy + fy * water.ry * 1.5,
        (water.rx * 2 + 70) / 90,
        0.55 + 0.45 * Math.abs(Math.cos(dir)),
        0.85 * moving,
        Math.atan2(Math.sin(dir) * 0.6, Math.cos(dir)),
      ),
    );
    if (t >= S.nextPuff) {
      S.nextPuff = t + 0.16;
      const side = S.puffs.length % 2 ? 1 : -1;
      S.puffs.push({
        x: o.x + water.cx - fx * water.rx * 1.05,
        y: o.y + water.cy - fy * water.ry * 1.6,
        at: t,
        side,
        dx: -Math.sin(dir) * side,
        dy: Math.cos(dir) * side * 0.6,
      });
    }
  }
  S.puffs = S.puffs.filter((p) => t - p.at < PUFF_LIFE).slice(low ? -4 : -8);
  S.puffs.forEach((p, i) => {
    const q = (t - p.at) / PUFF_LIFE,
      sc = 0.9 + q * 0.9;
    back.push(
      pl(
        `pf${i}`,
        `foam${i % 3}`,
        p.x - o.x + p.dx * q * 18,
        p.y - o.y + p.dy * q * 18,
        sc,
        sc * 0.8,
        (1 - q) * Math.min(1, q * 6),
        p.side * 0.3,
      ),
    );
  });
  // flecks of foam drifting off the waterline
  if (!low)
    for (let i = 0; i < 4; i++) {
      const q = (t * 0.22 + i * 0.25) % 1,
        a = i * 1.9 + Math.floor(t * 0.22 + i * 0.25) * 2.4,
        rr = 1.05 + q * 0.45,
        x = water.cx + Math.cos(a) * water.rx * rr,
        y = water.cy + Math.sin(a) * (water.ry * rr + 4);
      (Math.sin(a) > 0 ? front : back).push(
        pl(
          `fk${i}`,
          `foam${i % 3}`,
          x,
          y,
          0.42,
          0.36,
          0.9 * Math.sin(q * Math.PI),
        ),
      );
    }
  return { back, front };
}

/**
 * Show Tidelotl for this frame in the graphics layer `g`. Returns where its
 * head and pearl are in that layer, or false when the layer is not in a
 * running scene.
 */
export function paintTidelotl(g: Phaser.GameObjects.Graphics, o: TidelotlLook) {
  const scene = g.scene;
  if (!scene?.sys?.isActive?.()) return false;
  const phase = clamp(Math.round(o.phase), 1, 3);
  const A = atlasFor(scene, phase);
  if (!A) return false;
  // a new phase repaints the skin, but never while an attack winds up
  if (phase !== A.phase && (!A.job || A.job.phase !== phase))
    A.job = { phase, todo: pieceList().filter((p) => p.skin) };
  if (A.job && !o.windKind) stepRepaint(scene, A, o.reduced ? 12 : 4);
  const rig = rigs.get(g) ?? createRig(g);
  const dt = clamp(o.clock - rig.clock, 0, 0.1);
  rig.clock = o.clock;
  rig.facing = lotlFacing(o.angle, rig.facing);
  // spins: the Undertow winds up and pulls; the tail sweep turns once round
  const spinning =
    !o.reduced &&
    !o.dead &&
    (o.windKind === "undertow" || (o.castKind === "undertow" && o.castAge < 3));
  if (spinning)
    rig.spin +=
      dt * 9 * (o.windKind === "undertow" ? clamp(o.windup * 1.4) : 1);
  else rig.spin = Math.round(rig.spin);
  const sweep =
    !o.reduced && o.castKind === "slam" && o.castAge < 0.6
      ? 8 * clamp(o.castAge / 0.6) ** 0.8
      : 0;
  const facing = rig.facing + (rig.spin % 8) + sweep;
  const P = tidelotlPose({ ...o, clock: o.clock });
  const wet = !o.stranded && o.wet(o.x, o.y);
  const layout = tidelotlPlacements(
    P,
    spinning || sweep ? facing : Math.round(facing) % 8,
    phase,
    wet,
    raidMapLow(),
  );
  const shown = Math.round(facing) % 8,
    turned =
      rig.sea.facing !== undefined &&
      rig.sea.facing !== shown &&
      !spinning &&
      !sweep;
  rig.sea.facing = shown;
  const sea = seaPlacements(scene, rig, o, layout.water, dt, turned);
  // the far halves of rings and the trail lie under it (after its shadow)
  const all = [
    ...layout.placements.slice(0, 1),
    ...sea.back,
    ...layout.placements.slice(1),
    ...sea.front,
  ];

  rig.frame = scene.game.loop.frame;
  rig.root.setData("facing", Math.round(facing) % 8);
  rig.root.setDepth(g.depth + 0.001).setAlpha(g.alpha);
  rig.actor.setPosition(o.x, o.y);
  const tint = o.dead
    ? 0x9b97a0
    : o.hurt > 0.65
      ? 0xffe5d8
      : o.gilded
        ? 0xffe1ad
        : 0xffffff;
  const seen = new Set<string>();
  let order = 0;
  for (const p of all) {
    const atlas = A.main.slots.has(p.piece) ? A.main : A.skin,
      slot = atlas.slots.get(p.piece);
    if (!slot) continue;
    let img = rig.images.get(p.key);
    if (!img) {
      img = scene.add.image(0, 0, atlas.key, p.piece) as Sorted;
      img.setName(`vector-part-${p.key}`);
      rig.actor.add(img);
      rig.images.set(p.key, img);
    } else if (img.texture.key !== atlas.key || img.frame.name !== p.piece)
      img.setTexture(atlas.key, p.piece);
    seen.add(p.key);
    img.vz = order++;
    const isx = p.sx / slot.q,
      isy = p.sy / slot.q;
    img
      .setVisible(true)
      .setOrigin(slot.ox, slot.oy)
      .setPosition(p.x, p.y)
      .setRotation(p.rot)
      .setScale(isx, isy)
      .setAlpha(clamp(p.alpha))
      .setTint(UNTINTED.test(p.piece) ? 0xffffff : tint);
    // in the water: keep only what is above the depth where the water turns opaque
    if (p.cut !== undefined && isy > 0) {
      const fh = slot.h,
        top = p.y - slot.oy * fh * isy,
        keep = clamp((p.cut - top) / (fh * isy || 1));
      if (keep <= 0) img.setVisible(false);
      else if (keep < 1) img.setCrop(0, 0, slot.w, fh * keep);
      else if (img.isCropped) img.setCrop();
    } else if (img.isCropped) img.setCrop();
  }
  for (const [key, img] of rig.images)
    if (!seen.has(key)) img.setVisible(false);
  rig.actor.sort("vz");
  const pearl = { x: o.x + layout.pearl.x, y: o.y + layout.pearl.y };
  // the pearl's glow and, in the last phase, the top gills' (the effects engine's light)
  const fx = fxFor(scene);
  if (!o.dead && P.h > -40 && (layout.pearlVisible || P.exposed > 0.05))
    fx.glow(
      pearl.x,
      pearl.y,
      (16 + P.exposed * 12) * LOTL_SCALE,
      0xc8fffa,
      (0.25 + 0.35 * P.pearl + 0.1 * (phase - 1)) *
        (layout.pearlVisible ? 1 : 0.5),
    );
  if (phase >= 3 && !o.dead && P.h > -30)
    fx.glow(o.x + layout.gillTip.x, o.y + layout.gillTip.y, 14, 0xff78b8, 0.45);
  // the open weak point's ring, as every boss shows it
  rig.front.clear();
  if (P.exposed > 0.02 && !o.dead) {
    rig.front.fillStyle(0xaaffdf, 0.15).fillCircle(pearl.x, pearl.y, 22);
    rig.front.lineStyle(2.5, 0xd9ffdb, 0.85).strokeCircle(pearl.x, pearl.y, 22);
  }
  return {
    head: { x: o.x + layout.head.x, y: o.y + layout.head.y },
    top: { x: o.x + layout.top.x, y: o.y + layout.top.y },
    pearl,
    mouth: { x: o.x + layout.mouth.x, y: o.y + layout.mouth.y },
  };
}

function createRig(g: Phaser.GameObjects.Graphics): Rig {
  const scene = g.scene;
  const actor = scene.add.container(0, 0);
  const front = scene.add.graphics().setName("vector-boss-front");
  const root = scene.add
    .container(0, 0, [actor, front])
    .setName("vector-boss-tidewyrm");
  const rig: Rig = {
    root,
    actor,
    front,
    images: new Map(),
    frame: -1,
    spin: 0,
    clock: 0,
    sea: {
      rings: [],
      puffs: [],
      nextRing: 0,
      nextPuff: 0,
      vx: 0,
      vy: 0,
      surfaced: false,
    },
  };
  rigs.set(g, rig);
  const dispose = () => {
    scene.events.off("prerender", sync);
    g.off("destroy", dispose);
    root.destroy();
    rigs.delete(g);
  };
  const sync = () => {
    if (scene.game.loop.frame - rig.frame > 120) {
      dispose();
      return;
    }
    const m = g.getWorldTransformMatrix();
    root
      .setPosition(m.tx, m.ty)
      .setRotation(m.rotation)
      .setScale(m.scaleX, m.scaleY)
      .setVisible(g.visible && g.active && rig.frame === scene.game.loop.frame);
  };
  scene.events.on("prerender", sync);
  g.once("destroy", dispose);
  return rig;
}
