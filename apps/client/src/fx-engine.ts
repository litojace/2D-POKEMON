import type Phaser from "phaser";
// Phaser constants as literals, so this module loads without Phaser (tests).
const ADD = 1; // ADD
const PRE_UPDATE = "preupdate"; // PRE_UPDATE
const POST_UPDATE = "postupdate"; // POST_UPDATE
const SHUTDOWN = "shutdown"; // SHUTDOWN
/**
 * Battle VFX engine: additive light, physical particles, lightning and ground
 * marks. Purely cosmetic and self-contained: it attaches to a scene the first
 * time an effect asks for it and cleans up with the scene.
 *
 * Particles live in a shallow 3D space: (x, y) on the arena floor and z for
 * height, so sparks arc up, fall under gravity and bounce on the ground
 * instead of sliding flat across the screen.
 */
export type ParticleKind = "spark" | "mote" | "ember" | "smoke" | "debris" | "drop" | "flame";
interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  color: number;
  drag: number;
  grav: number;
  bounce: number;
  spin: number;
}
interface Decal {
  kind: "scorch" | "crack" | "wet" | "glyph";
  x: number;
  y: number;
  r: number;
  color: number;
  age: number;
  life: number;
  seed: number;
}
export interface BurstOptions {
  x: number;
  y: number;
  z?: number;
  count: number;
  kind: ParticleKind;
  color: number | number[];
  /** Ground speed range (px/s). */
  speed: [number, number];
  /** Upward speed range (px/s). */
  up?: [number, number];
  /** Centre direction and half-spread (radians). Default: all around. */
  angle?: number;
  spread?: number;
  life: [number, number];
  size: [number, number];
  grav?: number;
  drag?: number;
  bounce?: number;
}
const MAX_PARTICLES = 700;
const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const reducedMotion = () =>
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

function makeTextures(scene: Phaser.Scene) {
  if (scene.textures.exists("fx-glow")) return;
  const size = 128;
  const canvas = scene.textures.createCanvas("fx-glow", size, size)!;
  const ctx = canvas.getContext();
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.18, "rgba(255,255,255,0.75)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.22)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  canvas.refresh();
}

export class Fx {
  readonly scene: Phaser.Scene;
  /** Additive layer redrawn every frame (bolts, rings, cores). */
  readonly g: Phaser.GameObjects.Graphics;
  /** Normal-blend layer redrawn every frame (smoke, debris, dark shapes). */
  readonly solid: Phaser.GameObjects.Graphics;
  private readonly sparks: Phaser.GameObjects.Graphics;
  private readonly decalLayer: Phaser.GameObjects.Graphics;
  /** Additive layer on the floor, under the fighters (electrified ground, glows). */
  readonly floor: Phaser.GameObjects.Graphics;
  /** Normal-blend layer on the floor, under the light (contrast for bolts). */
  readonly floorSolid: Phaser.GameObjects.Graphics;
  private readonly glows: Phaser.GameObjects.Image[] = [];
  private readonly floorGlows: Phaser.GameObjects.Image[] = [];
  private usedFloor = 0;
  /** Soft normal-blend sprites: flame bodies, smoke, dust. */
  private readonly softs: Phaser.GameObjects.Image[] = [];
  private usedSoft = 0;
  private readonly particles: Particle[] = [];
  private readonly decals: Decal[] = [];
  private readonly lastEmit = new Map<string | number, number>();
  readonly reduced = reducedMotion();
  private frame = 0;
  private used = 0;
  time = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    makeTextures(scene);
    this.decalLayer = scene.add.graphics().setDepth(-5);
    this.floor = scene.add.graphics().setDepth(0.3).setBlendMode(ADD);
    this.floorSolid = scene.add.graphics().setDepth(0.28);
    this.solid = scene.add.graphics().setDepth(3.6);
    this.sparks = scene.add.graphics().setDepth(4.6).setBlendMode(ADD);
    this.g = scene.add.graphics().setDepth(4.5).setBlendMode(ADD);
    const ev = scene.events;
    ev.on(PRE_UPDATE, this.begin, this);
    ev.on(POST_UPDATE, this.end, this);
    ev.once(SHUTDOWN, this.destroy, this);
  }

  private begin(time: number) {
    this.time = time;
    this.frame++;
    this.used = 0;
    this.usedFloor = 0;
    this.usedSoft = 0;
    this.floor.clear();
    this.floorSolid.clear();
    this.g.clear();
    this.solid.clear();
  }

  private end(_time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    this.step(dt);
    this.drawParticles();
    this.drawDecals(dt);
    for (let i = this.used; i < this.glows.length; i++) this.glows[i].setVisible(false);
    for (let i = this.usedFloor; i < this.floorGlows.length; i++) this.floorGlows[i].setVisible(false);
    for (let i = this.usedSoft; i < this.softs.length; i++) this.softs[i].setVisible(false);
  }

  destroy() {
    const ev = this.scene.events;
    ev.off(PRE_UPDATE, this.begin, this);
    ev.off(POST_UPDATE, this.end, this);
    for (const o of [this.g, this.solid, this.sparks, this.decalLayer, this.floor, this.floorSolid, ...this.glows, ...this.floorGlows, ...this.softs]) o.destroy();
    instances.delete(this.scene);
  }

  // ─────────────── Light ───────────────
  /** A soft additive light this frame. Call again next frame to keep it lit. */
  glow(x: number, y: number, radius: number, color: number, alpha = 1, onFloor = false, stretchY = 1) {
    if (radius <= 0 || alpha <= 0) return;
    const pool = onFloor ? this.floorGlows : this.glows;
    const index = onFloor ? this.usedFloor++ : this.used++;
    let img = pool[index];
    if (!img) {
      img = this.scene.add.image(0, 0, "fx-glow").setBlendMode(ADD).setDepth(onFloor ? 0.25 : 4.4);
      pool.push(img);
    }
    img
      .setVisible(true)
      .setPosition(x, y)
      .setScale((radius * 2) / 128, ((radius * 2) / 128) * (onFloor ? 0.78 : stretchY))
      .setTint(color)
      .setAlpha(Math.min(1, alpha));
  }

  /** A soft normal-blend puff (solid flame body, smoke, dust) this frame. */
  soft(x: number, y: number, radius: number, color: number, alpha = 1, stretchY = 1) {
    if (radius <= 0 || alpha <= 0) return;
    let img = this.softs[this.usedSoft++];
    if (!img) {
      img = this.scene.add.image(0, 0, "fx-glow").setDepth(3.55);
      this.softs.push(img);
    }
    img
      .setVisible(true)
      .setPosition(x, y)
      .setScale((radius * 2) / 128, ((radius * 2) / 128) * stretchY)
      .setTint(color)
      .setAlpha(Math.min(1, alpha));
  }

  // ─────────────── Particles ───────────────
  burst(o: BurstOptions) {
    const count = Math.round(o.count * (this.reduced ? 0.35 : 1));
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const a = o.angle === undefined ? Math.random() * TAU : o.angle + rand(-1, 1) * (o.spread ?? Math.PI);
      const s = rand(o.speed[0], o.speed[1]);
      const colors = Array.isArray(o.color) ? o.color : [o.color];
      this.particles.push({
        kind: o.kind,
        x: o.x,
        y: o.y,
        z: o.z ?? 0,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        vz: o.up ? rand(o.up[0], o.up[1]) : 0,
        age: 0,
        life: rand(o.life[0], o.life[1]),
        size: rand(o.size[0], o.size[1]),
        color: colors[(Math.random() * colors.length) | 0],
        drag: o.drag ?? 2,
        grav: o.grav ?? 0,
        bounce: o.bounce ?? 0.35,
        spin: rand(-8, 8),
      });
    }
  }

  /** Emit at most once per `every` seconds for a moving source (trails). */
  trail(key: string | number, every: number, emit: () => void) {
    const last = this.lastEmit.get(key) ?? -Infinity;
    if (this.time - last < every * 1000 * (this.reduced ? 2.5 : 1)) return;
    this.lastEmit.set(key, this.time);
    if (this.lastEmit.size > 400) this.lastEmit.clear();
    emit();
  }

  private step(dt: number) {
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      if (p.age >= p.life) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.vz = p.vz * (p.kind === "smoke" || p.kind === "ember" || p.kind === "flame" ? k : 1) - p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.z < 0 && p.grav > 0) {
        p.z = 0;
        p.vz = -p.vz * p.bounce;
        p.vx *= 0.6;
        p.vy *= 0.6;
      }
    }
  }

  private drawParticles() {
    const g = this.sparks;
    g.clear();
    for (const p of this.particles) {
      const k = p.age / p.life,
        fade = 1 - k,
        sx = p.x,
        sy = p.y - p.z;
      switch (p.kind) {
        case "spark": {
          // Motion-stretched streak: length follows real screen velocity.
          const vx = p.vx,
            vy = p.vy - p.vz,
            sp = Math.hypot(vx, vy) || 1,
            len = Math.min(26, 4 + sp * 0.022);
          g.lineStyle(p.size * 2.4, p.color, 0.35 * fade);
          g.lineBetween(sx - (vx / sp) * len, sy - (vy / sp) * len, sx, sy);
          g.lineStyle(p.size, 0xffffff, 0.95 * fade);
          g.lineBetween(sx - (vx / sp) * len * 0.6, sy - (vy / sp) * len * 0.6, sx, sy);
          break;
        }
        case "mote":
        case "ember": {
          const flick = p.kind === "ember" ? 0.6 + hash(p.x + this.frame) * 0.4 : 1;
          g.fillStyle(p.color, 0.3 * fade * flick).fillCircle(sx, sy, p.size * 2.6);
          g.fillStyle(0xffffff, 0.9 * fade * flick).fillCircle(sx, sy, p.size * 0.8);
          break;
        }
        case "flame": {
          // Solid body that cools from gold to the base colour, white-hot
          // core only while young: reads as fire on light and dark floors.
          const s = p.size * (0.8 + k * 1.3),
            hot = Math.max(0, 1 - k * 2.4);
          this.soft(sx, sy, s * 1.5, k < 0.35 ? 0xffa53a : p.color, 0.85 * fade);
          this.glow(sx, sy, s * 1.1, 0xffc65a, 0.5 * fade * (0.3 + hot));
          if (hot > 0) this.glow(sx, sy, s * 0.5, 0xfff4c8, 0.7 * hot);
          break;
        }
        case "drop":
          // Solid droplet with a glint; its floor shadow shows the height.
          if (p.z > 2) this.solid.fillStyle(0x000000, 0.12 * fade).fillEllipse(p.x, p.y + 1, p.size * 1.8, p.size * 0.8);
          this.solid.fillStyle(p.color, 0.9 * fade).fillCircle(sx, sy, p.size);
          this.solid.fillStyle(0xffffff, 0.85 * fade).fillCircle(sx - p.size * 0.3, sy - p.size * 0.3, p.size * 0.4);
          break;
        case "smoke":
          this.soft(sx, sy, p.size * 1.6 * (1 + k * 1.6), p.color, 0.5 * fade * Math.min(1, k * 6));
          break;
        case "debris": {
          const r = p.size,
            a = p.age * p.spin;
          // Shadow on the floor sells the height.
          this.solid.fillStyle(0x000000, 0.18 * fade).fillEllipse(p.x, p.y + 2, r * 2, r);
          this.solid.fillStyle(p.color, fade).fillTriangle(
            sx + Math.cos(a) * r, sy + Math.sin(a) * r,
            sx + Math.cos(a + 2.2) * r, sy + Math.sin(a + 2.2) * r,
            sx + Math.cos(a + 4.1) * r * 0.8, sy + Math.sin(a + 4.1) * r * 0.8,
          );
          break;
        }
      }
    }
  }

  // ─────────────── Ground marks ───────────────
  decal(d: Omit<Decal, "age" | "seed">) {
    if (this.decals.length > 24) this.decals.shift();
    this.decals.push({ ...d, age: 0, seed: Math.random() * 1000 });
  }

  private drawDecals(dt: number) {
    const g = this.decalLayer;
    g.clear();
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.age += dt;
      if (d.age >= d.life) {
        this.decals.splice(i, 1);
        continue;
      }
      const k = d.age / d.life,
        a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      if (d.kind === "scorch") {
        g.fillStyle(0x0b0a12, 0.32 * a).fillEllipse(d.x, d.y, d.r * 2, d.r * 1.55);
        g.fillStyle(0x0b0a12, 0.25 * a).fillEllipse(d.x, d.y, d.r * 1.3, d.r);
        // Still-hot rim fades first.
        g.lineStyle(2, d.color, 0.55 * a * Math.max(0, 1 - k * 3)).strokeEllipse(d.x, d.y, d.r * 1.6, d.r * 1.24);
      }
      if (d.kind === "scorch" || d.kind === "crack") {
        g.lineStyle(2, 0x0b0a12, 0.45 * a);
        for (let j = 0; j < 7; j++) {
          const ang = d.seed + j * (TAU / 7) + hash(d.seed + j) * 0.5;
          let px = d.x,
            py = d.y;
          for (let s = 1; s <= 3; s++) {
            const rr = (d.r * s) / 3,
              jit = (hash(d.seed + j * 7 + s) - 0.5) * 0.6;
            const nx = d.x + Math.cos(ang + jit) * rr,
              ny = d.y + Math.sin(ang + jit) * rr * 0.78;
            g.lineBetween(px, py, nx, ny);
            px = nx;
            py = ny;
          }
        }
      }
      if (d.kind === "wet") g.fillStyle(d.color, 0.18 * a).fillEllipse(d.x, d.y, d.r * 2, d.r * 1.5);
      if (d.kind === "glyph") g.lineStyle(2, d.color, 0.4 * a).strokeEllipse(d.x, d.y, d.r * 2, d.r * 1.6);
    }
  }

  // ─────────────── Drawing helpers (additive, this frame) ───────────────
  /**
   * Branching lightning from (x0, y0) to (x1, y1) by midpoint displacement.
   * `seed` changes a few times per second so the bolt crackles.
   */
  bolt(
    x0: number, y0: number, x1: number, y1: number, color: number,
    o: { width?: number; jag?: number; branches?: number; seed?: number; alpha?: number; depth?: number; onFloor?: boolean } = {},
  ) {
    const width = o.width ?? 3,
      alpha = o.alpha ?? 1,
      seed = o.seed ?? Math.floor(this.time / 50);
    let pts = [{ x: x0, y: y0 }, { x: x1, y: y1 }];
    const len = Math.hypot(x1 - x0, y1 - y0);
    let amp = (o.jag ?? 0.22) * len;
    const depth = o.depth ?? (len > 140 ? 5 : 4);
    for (let d = 0; d < depth; d++) {
      const next = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i],
          b = pts[i + 1],
          dx = b.x - a.x,
          dy = b.y - a.y,
          l = Math.hypot(dx, dy) || 1,
          off = (hash(seed * 31 + d * 97 + i * 13) - 0.5) * amp;
        next.push({ x: (a.x + b.x) / 2 + (-dy / l) * off, y: (a.y + b.y) / 2 + (dx / l) * off }, b);
      }
      pts = next;
      amp *= 0.55;
    }
    const g = o.onFloor ? this.floor : this.g;
    // A thin dark underlay keeps light readable on bright floors.
    (o.onFloor ? this.floorSolid : this.solid)
      .lineStyle(width * 2.2, 0x1b1638, 0.32 * alpha)
      .strokePoints(pts, false);
    g.lineStyle(width * 4, color, 0.16 * alpha).strokePoints(pts, false);
    g.lineStyle(width * 1.8, color, 0.55 * alpha).strokePoints(pts, false);
    g.lineStyle(Math.max(1, width * 0.7), 0xffffff, 0.95 * alpha).strokePoints(pts, false);
    const branches = o.branches ?? 0;
    for (let b = 0; b < branches; b++) {
      const i = 2 + Math.floor(hash(seed + b * 5) * (pts.length - 4)),
        p = pts[i];
      if (!p) continue;
      const dir = Math.atan2(y1 - y0, x1 - x0) + (hash(seed + b * 11) - 0.5) * 1.8,
        bl = len * (0.18 + hash(seed + b * 3) * 0.22);
      this.bolt(p.x, p.y, p.x + Math.cos(dir) * bl, p.y + Math.sin(dir) * bl, color, {
        width: width * 0.55, jag: 0.35, branches: 0, seed: seed + b * 17, alpha: alpha * 0.8, depth: 3, onFloor: o.onFloor,
      });
    }
  }

  /** Expanding shockwave: bright leading edge with a soft wake. */
  shockwave(x: number, y: number, r: number, k: number, color: number, width = 10, squash = 0.82, onFloor = true) {
    const a = 1 - k,
      g = onFloor ? this.floor : this.g;
    g.lineStyle(width * (1.6 - k), color, 0.25 * a).strokeEllipse(x, y, r * 2, r * 2 * squash);
    g.lineStyle(Math.max(1, width * 0.45 * (1 - k * 0.6)), 0xffffff, 0.85 * a).strokeEllipse(x, y, r * 2, r * 2 * squash);
  }

  shake(ms: number, intensity: number) {
    if (!this.reduced) this.scene.cameras.main.shake(ms, intensity, false);
  }
}

const instances = new WeakMap<Phaser.Scene, Fx>();
/** The scene's effects engine, created on first use. */
export function fxFor(scene: Phaser.Scene): Fx {
  let fx = instances.get(scene);
  if (!fx) {
    fx = new Fx(scene);
    instances.set(scene, fx);
  }
  return fx;
}
