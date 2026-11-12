/**
 * Grumblecrag's vector rig in the battle scene (boss-vector-grumble.ts has the
 * rig and the drawing). Every part is drawn once per phase into one atlas;
 * each frame only moves, turns, scales and re-sorts images from it, so a phone
 * does no vector drawing during the fight, and the whole body is one texture
 * (one draw batch). Glows are added on top in their own layer (one more
 * batch), for sources in front of the body only.
 *
 * Like the painted bosses (boss-painted-rig.ts), the images live in a
 * container that follows the boss's graphics layer, drawn just above it, and
 * go away with that layer or when the boss hasn't been drawn for a while.
 */
import type Phaser from "phaser";
import { addCanvasTexture } from "./canvas-texture";
import {
  CRYSTAL,
  EYE,
  ROCK_PAD,
  drawCavity,
  drawCore,
  drawCrystal,
  drawEye,
  drawGlow,
  drawRock,
  grumbleIdle,
  grumbleParts,
  grumblePose,
  lookFrom,
  nextFacing,
  partDepth,
  project,
  turnToward,
  viewYaw,
  type GrumbleCue,
  type Phase,
  type Vec3,
} from "./boss-vector-grumble";

/** World pixels per rig unit: the mountain at the size of the painted boss. */
export const GRUMBLE_SCALE = 0.75;
/** Texture pixels per world pixel: sharp on 2× screens and close-up cameras. */
const Q = 2;
/** Rig units of a crystal's length in the atlas (scaled to each crystal's). */
const CRYSTAL_LENGTH = 50;
/** The ground under the boss, below its position (where its shadow is). */
export const GRUMBLE_FEET = 51;
const GLOW = 128;

export interface VectorGrumbleLook extends Omit<
  GrumbleCue,
  "stride" | "speed" | "look"
> {
  /** The boss's position in the graphics layer. */
  x: number;
  y: number;
  /** Where it faces (screen radians) and looks (screen direction). */
  angle: number;
  lookX: number;
  lookY: number;
  gilded: boolean;
  /** Death: 0 standing, 1 a heap of rubble. */
  collapse: number;
  /** Seconds since dying (the core gutters out). */
  deathAge: number;
}

interface Rig {
  root: Phaser.GameObjects.Container;
  /** The body, sorted back to front each frame. */
  actor: Phaser.GameObjects.Container;
  /** Glows over the body, added on top. */
  glows: Phaser.GameObjects.Container;
  /** Markers over everything: the open core's ring, as on painted bosses. */
  front: Phaser.GameObjects.Graphics;
  images: Map<string, Phaser.GameObjects.Image>;
  frame: number;
  facing?: number;
  yaw: number;
  clock: number;
  x: number;
  y: number;
  speed: number;
  stride: number;
}
type Sorted = Phaser.GameObjects.Image & { vz: number };
const rigs = new WeakMap<Phaser.GameObjects.Graphics, Rig>();
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const px = GRUMBLE_SCALE * Q; // atlas pixels per rig unit

// ───────────────────────── the atlas ─────────────────────────
interface Cell {
  name: string;
  w: number;
  h: number;
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
}
/** Every drawing the rig uses in a phase. */
function cells(phase: Phase): Cell[] {
  const out: Cell[] = [];
  const rocks = grumbleParts({ ...grumbleIdle(), hold: 1 }, 0).parts;
  const widths = new Set<number>();
  for (const p of rocks) {
    if (p.kind === "rock") {
      const w = Math.ceil(p.rx * 2 * ROCK_PAD * px + 8),
        h = Math.ceil(p.ry * 2 * ROCK_PAD * px + 8);
      out.push({
        name: `rock-${p.id}`,
        w,
        h,
        draw: (ctx, x, y) =>
          drawRock(
            ctx,
            x + w / 2,
            y + h / 2,
            p.rx * px,
            p.ry * px,
            p.seed,
            phase,
            px,
          ),
      });
    } else if (p.kind === "crystal") widths.add(p.width);
  }
  for (const width of widths) {
    const w = Math.ceil(width * 2 * px + 8),
      h = Math.ceil(CRYSTAL_LENGTH * px + 8);
    out.push({
      name: `crystal-${width}`,
      w,
      h,
      draw: (ctx, x, y) =>
        drawCrystal(
          ctx,
          x + w / 2,
          y + h - 4,
          x + w / 2,
          y + 4,
          width * px,
          phase,
          px,
        ),
    });
  }
  const fixed = (
    name: string,
    w: number,
    h: number,
    draw: Cell["draw"],
  ): Cell => ({ name, w: Math.ceil(w), h: Math.ceil(h), draw });
  out.push(
    fixed("eye", 52 * px, 40 * px, (ctx, x, y) =>
      drawEye(ctx, x + 26 * px, y + 22 * px, phase, px),
    ),
    fixed("core", 34 * px, 48 * px, (ctx, x, y) =>
      drawCore(ctx, x + 17 * px, y + 24 * px, phase, px),
    ),
    fixed("cavity", 56 * px, 60 * px, (ctx, x, y) =>
      drawCavity(ctx, x + 28 * px, y + 30 * px, px),
    ),
    fixed("mouth", 32 * px, 18 * px, (ctx, x, y) => {
      ctx.fillStyle = "#2a0c04";
      ctx.beginPath();
      ctx.ellipse(x + 16 * px, y + 9 * px, 14 * px, 8 * px, 0, 0, Math.PI * 2);
      ctx.fill();
    }),
    fixed("glow", GLOW, GLOW, (ctx, x, y) => {
      ctx.save();
      ctx.translate(x, y);
      drawGlow(ctx, GLOW);
      ctx.restore();
    }),
  );
  return out;
}
const atlasKey = (phase: Phase) => `vgrumble-atlas-${phase}`;
/**
 * The phase's atlas (drawn once and kept while that phase lasts): shelf-packed
 * cells, each a named frame. The other phases' atlases are dropped.
 */
/** Draw the phase's atlas now (while the battle loads), not on the first frame. */
export const prewarmAtlas = (scene: Phaser.Scene, phase: Phase) => {
  atlas(scene, phase);
};
function atlas(scene: Phaser.Scene, phase: Phase) {
  const key = atlasKey(phase);
  if (scene.textures.exists(key)) return key;
  const list = cells(phase).sort((a, b) => b.h - a.h);
  const width = 1024,
    gap = 2;
  const spots: { cell: Cell; x: number; y: number }[] = [];
  let x = 0,
    y = 0,
    shelf = 0;
  for (const cell of list) {
    if (x + cell.w > width) {
      x = 0;
      y += shelf + gap;
      shelf = 0;
    }
    spots.push({ cell, x, y });
    x += cell.w + gap;
    shelf = Math.max(shelf, cell.h);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.ceil(y + shelf);
  const ctx = canvas.getContext("2d");
  if (ctx)
    for (const { cell, x, y } of spots) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cell.w, cell.h);
      ctx.clip();
      cell.draw(ctx, x, y);
      ctx.restore();
    }
  // Added as a plain image source (canvas-texture.ts): no pixel read-back.
  const texture = addCanvasTexture(scene.textures, key, canvas);
  for (const { cell, x, y } of spots)
    texture?.add(cell.name, 0, x, y, cell.w, cell.h);
  return key;
}
/** Drop the other phases' atlases (after every image moved to this one). */
function dropOtherAtlases(scene: Phaser.Scene, phase: Phase, rig: Rig) {
  for (const other of [1, 2, 3] as Phase[]) {
    const key = atlasKey(other);
    if (other === phase || !scene.textures.exists(key)) continue;
    // A hidden image still on the old atlas is pointed at the current one.
    for (const img of rig.images.values())
      if (img.texture.key === key) img.setTexture(atlasKey(phase), "glow");
    scene.textures.remove(key);
  }
}

/**
 * Show Grumblecrag for this frame in the graphics layer `g`. Returns where
 * its core is in that layer, or false when the layer is not in a running
 * scene.
 */
export function paintVectorGrumble(
  g: Phaser.GameObjects.Graphics,
  o: VectorGrumbleLook,
) {
  const scene = g.scene;
  if (!scene?.sys?.isActive?.()) return false;
  const phase = clamp(Math.round(o.phase), 1, 3) as Phase;
  const rig = rigs.get(g) ?? createRig(g);

  // facing (eight ways), turning, walking
  const dt = clamp(o.time - rig.clock, 0, 0.1);
  const first = rig.facing === undefined;
  const facing = nextFacing(o.angle, rig.facing);
  rig.facing = facing;
  const target = (facing * Math.PI) / 4;
  rig.yaw = first || o.reduced ? target : turnToward(rig.yaw, target, dt);
  const moved = Math.hypot(o.x - rig.x, o.y - rig.y);
  if (!first && dt > 0)
    rig.speed += (Math.min(400, moved / dt) - rig.speed) * Math.min(1, dt * 8);
  rig.stride += dt * (o.charging ? 22 : Math.min(6, rig.speed * 0.05));
  rig.x = o.x;
  rig.y = o.y;
  rig.clock = o.time;

  const P = grumblePose({
    ...o,
    stride: rig.stride,
    speed: rig.speed,
    look: lookFrom(rig.yaw, o.lookX, o.lookY),
  });
  const { parts, head } = grumbleParts(P, viewYaw(rig.yaw));
  const sheet = atlas(scene, phase);

  rig.frame = scene.game.loop.frame;
  // Which of the eight facings shows (0 towards the camera, 2 screen right).
  rig.root.setData("facing", facing);
  rig.root.setDepth(g.depth + 0.001).setAlpha(g.alpha);
  rig.actor.setPosition(o.x, o.y + GRUMBLE_FEET);
  rig.glows.setPosition(o.x, o.y + GRUMBLE_FEET);
  rig.front.setPosition(o.x, o.y + GRUMBLE_FEET).clear();
  const seen = new Set<string>();
  const S = GRUMBLE_SCALE;
  const at = (p: Vec3) => {
    const s = project(p);
    return { x: s.x * S, y: s.y * S };
  };
  const tint = o.dead
    ? 0x9b97a0
    : o.hurt > 0.65
      ? 0xffe5d8
      : o.gilded
        ? 0xffe1ad
        : 0xffffff;
  const image = (
    key: string,
    frame: string,
    depth: number,
    layer = rig.actor,
  ) => {
    let img = rig.images.get(key) as Sorted | undefined;
    if (!img) {
      img = scene.add.image(0, 0, sheet, frame) as Sorted;
      img.setName(`vector-part-${key}`);
      layer.add(img);
      rig.images.set(key, img);
    } else if (img.texture.key !== sheet || img.frame.name !== frame)
      img.setTexture(sheet, frame);
    img.vz = depth;
    seen.add(key);
    return img
      .setVisible(true)
      .setAlpha(1)
      .setRotation(0)
      .setOrigin(0.5, 0.5)
      .setTint(0xffffff);
  };
  // The body's front: crystal glows behind it (spine crystals seen from the
  // front, horns from behind) would shine through, so they are skipped. Fists
  // (raised overhead behind the torso in a Ground Slam) keep theirs; eyes,
  // core and mouth are only drawn when they face the camera.
  const torsoDepth = parts.reduce(
    (d, p) => (p.kind === "rock" && p.id === "torso" ? partDepth(p) : d),
    0,
  );
  const glowAt = (
    key: string,
    x: number,
    y: number,
    radius: number,
    color: number,
    alpha: number,
    depth: number,
    occluded = false,
  ) => {
    if (alpha <= 0.01 || radius <= 0 || (occluded && depth < torsoDepth))
      return;
    image("glow-" + key, "glow", depth, rig.glows)
      .setPosition(x, y)
      .setScale((radius * 2) / GLOW)
      .setTint(color)
      .setAlpha(clamp(alpha));
  };

  // Death: the rocks tumble outwards and settle as rubble.
  const fall = o.dead ? clamp(o.collapse) : 0;
  const settle = (p: Vec3, restY: number, seed: number): Vec3 => {
    if (!fall) return p;
    const e = fall * fall;
    const out = 1.25 + (seed % 3) * 0.08;
    return {
      x: p.x + (p.x * out + Math.sign(p.x || 1) * 8 - p.x) * e,
      y: p.y + (restY - p.y) * e + Math.sin(fall * Math.PI) * 18 * (1 - fall),
      z: p.z + (p.z * 1.15 + 10 - p.z) * e,
    };
  };

  // Where the core is, from any side: the open-core ring (the same marker
  // every painted boss shows) and the cast aura centre on it.
  const corePart = parts.find((p) => p.kind === "core");
  const core = corePart ? at(settle(corePart.w, 30, 1)) : at(head);
  if (o.exposed && !o.dead) {
    rig.front.fillStyle(0xaaffdf, 0.15).fillCircle(core.x, core.y, 25);
    rig.front.lineStyle(2.5, 0xd9ffdb, 0.85).strokeCircle(core.x, core.y, 25);
  }

  const glowBase = P.glow + (phase - 1) * 0.18;
  const pulse = o.reduced
    ? 0.5
    : 0.5 + 0.5 * Math.sin(o.time * (P.expose > 0.5 ? 9 : 3));
  for (const part of parts) {
    const depth = partDepth(part);
    if (part.kind === "rock") {
      const p = settle(part.w, part.ry * 0.6, part.seed);
      const s = at(p);
      // A held rock is the full-size one, scaled.
      const k = part.id === "held" ? part.rx / 18 : 1;
      image(part.id, `rock-${part.id}`, depth)
        .setPosition(s.x, s.y)
        .setScale(k / Q)
        .setRotation(
          fall * ((part.seed % 2 ? 0.6 : -0.5) + (part.seed % 5) * 0.1),
        )
        .setTint(tint);
      if (part.id.startsWith("fist") && P.fistGlow > 0.02)
        glowAt(
          part.id,
          s.x,
          s.y,
          part.rx * 2.2 * S,
          CRYSTAL[phase].glow,
          P.fistGlow * 0.8,
          depth,
        );
    } else if (part.kind === "crystal") {
      const lift = (p: Vec3) => settle(p, 6, part.width);
      const b = at(lift(part.base)),
        t = at(lift(part.tip));
      const dx = t.x - b.x,
        dy = t.y - b.y,
        len = Math.hypot(dx, dy);
      image(part.id, `crystal-${part.width}`, depth)
        .setOrigin(0.5, 1 - 4 / (CRYSTAL_LENGTH * px + 8))
        .setPosition(b.x, b.y)
        .setRotation(Math.atan2(dx, -dy))
        .setScale(1 / Q, len / (CRYSTAL_LENGTH * px))
        .setTint(tint);
      const glow = (part.small ? 0.4 : 1) * glowBase * (1 - fall);
      glowAt(
        part.id,
        b.x + dx * 0.65,
        b.y + dy * 0.65,
        (part.small ? 18 : 34) * S,
        CRYSTAL[phase].glow,
        glow * 0.85,
        depth,
        true,
      );
    } else if (part.kind === "eye") {
      // the front half of the head only: in profile, just the near eye shows
      if (o.dead || part.facing < -0.25 || part.w.z < part.headZ + 3) continue;
      const vis =
        clamp((part.w.z - part.headZ - 3) / 12) *
        clamp((part.facing + 0.25) / 0.35);
      const s = at(part.w);
      image(part.id, "eye", depth)
        .setPosition(s.x, s.y)
        .setScale(
          ((0.4 + 0.6 * clamp(part.facing)) / Q) * (part.dir < 0 ? -1 : 1),
          1 / Q,
        )
        .setAlpha(vis)
        .setTint(o.gilded ? 0xffe1ad : 0xffffff);
      glowAt(
        part.id,
        s.x,
        s.y,
        24 * S,
        EYE[phase],
        vis * (0.7 + P.glow * 0.5),
        depth,
      );
    } else if (part.kind === "mouth") {
      if (o.dead || P.mouthGlow <= 0.02 || part.facing <= 0.1) continue;
      const vis = clamp((part.facing - 0.1) / 0.35) * clamp(P.mouthGlow);
      const s = at(part.w);
      image(part.id, "mouth", depth)
        .setPosition(s.x, s.y + 4 * S)
        .setScale((0.4 + 0.6 * part.facing) / Q, P.mouthGlow / Q)
        .setAlpha(vis);
      glowAt(
        part.id,
        s.x,
        s.y + 4 * S,
        30 * S,
        CRYSTAL[phase].glow,
        vis,
        depth,
      );
    } else if (part.kind === "core") {
      if (part.facing <= 0.05 || (o.dead && o.deathAge > 1.4)) continue;
      const vis =
        clamp((part.facing - 0.05) / 0.35) *
        (o.dead ? 1 - o.deathAge / 1.4 : 1);
      const wf = 0.3 + 0.7 * part.facing;
      const s = at(settle(part.w, 30, 1));
      if (P.expose > 0.02)
        image("cavity", "cavity", depth - 0.05)
          .setPosition(s.x, s.y)
          .setScale(
            (wf * (0.6 + 0.4 * P.expose)) / Q,
            (0.6 + 0.4 * P.expose) / Q,
          )
          .setAlpha(vis);
      image("core", "core", depth)
        .setPosition(s.x, s.y)
        .setScale((wf * (1 + P.expose * 0.35)) / Q, (1 + P.expose * 0.35) / Q)
        .setAlpha(vis)
        .setTint(o.gilded ? 0xffe1ad : 0xffffff);
      const strength =
        0.45 +
        0.25 * pulse +
        P.expose * (0.9 + pulse * 0.6) +
        (phase - 1) * 0.15;
      glowAt(
        "core",
        s.x,
        s.y,
        (40 + P.expose * 60) * S,
        CRYSTAL[phase].glow,
        vis * strength * 0.7,
        depth,
      );
    }
  }
  // Phase 3: the whole mountain smoulders (one glow under the body).
  if (phase === 3 && !o.dead) {
    const torso = parts.find((p) => p.kind === "rock" && p.id === "torso");
    if (torso && torso.kind === "rock") {
      const s = at(torso.w);
      image("glow-aura", "glow", -1000)
        .setPosition(s.x, s.y)
        .setScale((170 * S * 2) / GLOW)
        .setTint(0xff5a1e)
        .setAlpha(0.22 + 0.06 * pulse)
        .setBlendMode("ADD");
    }
  }
  // Staggered: pebbles circle the dizzy head.
  if (o.stagger && !o.dead) {
    for (let i = 0; i < 4; i++) {
      const a = (o.reduced ? 0 : o.time * 3) + (i / 4) * Math.PI * 2;
      const p = {
        x: head.x + Math.cos(a) * 46,
        y: head.y + 52 + Math.sin(a * 2) * 4,
        z: head.z + Math.sin(a) * 46,
      };
      const s = at(p);
      image("pebble" + i, "rock-held", p.z)
        .setPosition(s.x, s.y)
        .setScale(0.28 / Q)
        .setTint(tint);
    }
  }

  for (const [key, img] of rig.images)
    if (!seen.has(key)) img.setVisible(false);
  rig.actor.sort("vz");
  dropOtherAtlases(scene, phase, rig);
  return { x: o.x + core.x, y: o.y + GRUMBLE_FEET + core.y };
}

function createRig(g: Phaser.GameObjects.Graphics): Rig {
  const scene = g.scene;
  const actor = scene.add.container(0, 0);
  // One additive layer: its glows draw in a single batch over the body.
  const glows = scene.add.container(0, 0).setBlendMode("ADD");
  const front = scene.add.graphics().setName("vector-boss-front");
  const root = scene.add
    .container(0, 0, [actor, glows, front])
    .setName("vector-boss-grumblecrag");
  const rig: Rig = {
    root,
    actor,
    glows,
    front,
    images: new Map(),
    frame: -1,
    yaw: 0,
    clock: 0,
    x: 0,
    y: 0,
    speed: 0,
    stride: 0,
  };
  rigs.set(g, rig);
  const dispose = () => {
    scene.events.off("prerender", sync);
    g.off("destroy", dispose);
    root.destroy();
    rigs.delete(g);
  };
  // Follow the layer (camera, scale) and show only when drawn this frame.
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
