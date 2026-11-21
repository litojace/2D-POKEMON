import { PLAZA_WISH } from "../../../../packages/shared/src/plaza";

/**
 * The wishing fountain's fireworks (PLAZA_WISH.showMs, when a copy's wish
 * meter fills): twelve shells of six kinds (peony, chrysanthemum, willow,
 * ring, heart, crackle) and a three-shell finale.
 *
 * The Plaza is a 2D canvas, not a Phaser scene, so the battle effects engine
 * (fx-engine.ts) can't draw here. This keeps to the engine's rules instead,
 * so the same limits apply:
 *
 * - **Graphics levels.** `density` scales the sparks as burst particles do
 *   in battle (High all, Low 35%, reduced motion 35% at every level), and
 *   Low drops the sparks' tails and the rockets' embers.
 * - **Glow budget.** Each burst's flash is the only glow (one pre-drawn
 *   sprite per colour, no gradients made per frame). `glowBudget` holds the
 *   frame's flashes to that many screens; over it they all shrink alike,
 *   never below half size, as fx-engine's decorative glows do.
 * - **Pooled and capped.** Sparks live in one array of at most
 *   `maxSparks`, reused between shows; no objects are made per frame.
 * - **Counted.** `stats` has the last frame's sparks, flashes and glow cover
 *   (in screens, as FxFrameStats), and `peak` the show's heaviest frame, for
 *   tests/visual/plaza-wish.spec.ts and plaza-wish-performance.spec.ts.
 *
 * Shells come from the show's seed, so everyone in the copy sees the same
 * show at the same time (the server's clock). Each bursts in the viewer's
 * own sky: placed in the view as it goes up, its centre under the top HUD
 * (on a small phone the HUD covers the square's sky past the fountain), so
 * the whole copy sees the show wherever they stand.
 */
export const FIREWORKS = {
  /** Sparks alive at once, at most (High's busiest frame uses about 310). */
  maxSparks: 360,
  /** A rocket climbs for this long (s), then bursts. */
  riseSeconds: 0.55,
  /** Sizes are in px on a phone-sized view (`refHeight` world px tall); a
   * taller view scales them, so a burst takes the same share of any screen. */
  refHeight: 540,
  /** Where bursts' centres go in the view: across the middle `across` of its
   * width, and between these shares of its height from the top (under the
   * top HUD on a 375 px tall phone; the sparks spread past it). */
  across: 0.5,
  band: [0.42, 0.55] as const,
  /** A rocket climbs this share of the view's height. */
  climb: 0.3,
  /**
   * The furthest a spark gets from its burst (px), about a quarter of the
   * view's height: speed / drag for the fastest spark of any kind. High drag
   * opens a burst to nearly full size in a third of a second, then it hangs
   * and droops, as real fireworks do.
   */
  reach: 150,
  /** The burst's flash: radius (px) and life (s). */
  flash: 120,
  flashSeconds: 0.32,
  /** Crackle: each spark pops into this many twinkles near its end. */
  pops: 3,
  popLife: [0.22, 0.32] as const,
  /** The scene dims under the show, as lights go down for fireworks: most
   * darkening, and how long it takes to come and go (s). Not at Low. */
  dim: 0.3,
  dimIn: 0.4,
  dimOut: 0.8,
  /** Low: at most this many screens of flash light a frame. */
  lowGlowBudget: 0.2,
  /** Low and reduced motion: share of sparks. */
  lowDensity: 0.35,
} as const;

export type ShellKind =
  "peony" | "chrysanthemum" | "willow" | "ring" | "heart" | "crackle";
/** Each kind's sparks: how many, speed (px/s), drag and gravity, life (s),
 * tail (s of motion drawn behind), size (px), when the colour shifts (share
 * of life) and whether they twinkle as they fade. */
export const SHELL_KINDS: Record<
  ShellKind,
  {
    count: number;
    speed: readonly [number, number];
    drag: number;
    gravity: number;
    life: readonly [number, number];
    tail: number;
    size: number;
    shift: number;
    twinkle: boolean;
  }
> = {
  // A full round burst that changes colour.
  peony: {
    count: 54,
    speed: [470, 540],
    drag: 3.6,
    gravity: 90,
    life: [1.0, 1.3],
    tail: 0.07,
    size: 5,
    shift: 0.55,
    twinkle: false,
  },
  // Long glowing tails that fade to white and glitter.
  chrysanthemum: {
    count: 46,
    speed: [480, 510],
    drag: 3.4,
    gravity: 70,
    life: [1.1, 1.35],
    tail: 0.12,
    size: 3.8,
    shift: 0.45,
    twinkle: true,
  },
  // Gold strands that hang and droop slowly.
  willow: {
    count: 38,
    speed: [450, 520],
    drag: 4.0,
    gravity: 110,
    life: [1.7, 2.0],
    tail: 0.2,
    size: 3.4,
    shift: 0.35,
    twinkle: true,
  },
  // A flat ring, tilted.
  ring: {
    count: 44,
    speed: [525, 540],
    drag: 3.6,
    gravity: 55,
    life: [1.0, 1.2],
    tail: 0.06,
    size: 4.6,
    shift: 0.6,
    twinkle: false,
  },
  // A heart, for a wish come true.
  heart: {
    count: 48,
    speed: [500, 505],
    drag: 3.6,
    gravity: 30,
    life: [1.1, 1.3],
    tail: 0.05,
    size: 5,
    shift: 0.7,
    twinkle: false,
  },
  // Sparks that pop into white twinkles.
  crackle: {
    count: 34,
    speed: [380, 480],
    drag: 3.6,
    gravity: 80,
    life: [0.75, 0.95],
    tail: 0.06,
    size: 4,
    shift: 1,
    twinkle: false,
  },
};
/** The show: launch time (s) and kind; the last three are the finale, side
 * by side (their place across the view, -0.5..0.5). */
const PROGRAM: readonly { at: number; kind: ShellKind; u?: number }[] = [
  { at: 0, kind: "peony" },
  { at: 0.35, kind: "ring" },
  { at: 0.7, kind: "willow" },
  { at: 1.05, kind: "heart" },
  { at: 1.4, kind: "chrysanthemum" },
  { at: 1.55, kind: "peony" },
  { at: 1.95, kind: "crackle" },
  { at: 2.2, kind: "willow" },
  { at: 2.5, kind: "ring" },
  { at: 2.95, kind: "peony", u: -0.24 },
  { at: 3.0, kind: "chrysanthemum", u: 0 },
  { at: 3.05, kind: "ring", u: 0.24 },
];
/** Colour pairs (start, end): saturated, so they read on the sunny square. */
const PALETTES: readonly (readonly [string, string])[] = [
  ["#ff3d8b", "#ffd1e6"],
  ["#2fb8ff", "#c9f0ff"],
  ["#8f5bff", "#ff7ad9"],
  ["#3fdc6a", "#fff27a"],
  ["#ff6a3d", "#ffd65b"],
  ["#ffb020", "#ff4f4f"],
];
const WILLOW: readonly [string, string] = ["#ffe08a", "#ff9a3d"];
const HEART: readonly [string, string] = ["#ff3d6e", "#ffc2d8"];
const CRACKLE_POP = "#ffffff";
const EMBER = "#ffd9a0";
const MIN_SHRINK = 0.5;
/** The four brightnesses sparks are drawn at (grouped into one path each). */
const BRIGHT = [0.2, 0.45, 0.72, 1] as const;

interface Shell {
  launch: number;
  kind: ShellKind;
  /** In the view: -0.5..0.5 of its width from the centre, 0..1 of its height. */
  u: number;
  v: number;
  colors: readonly [string, string];
  /** Ring: its tilt (radians). */
  tilt: number;
  /** Set as it goes up (world px): where it bursts, how far it climbs, and
   * the view's scale then. */
  placed: boolean;
  x: number;
  y: number;
  h: number;
  k: number;
}
/** The view in world px (the scene's camera). */
export interface FireworksView {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  /** The view's scale at the burst (gravity, size, tail). */
  k: number;
  c0: string;
  c1: string;
  shift: number;
  drag: number;
  gravity: number;
  tail: number;
  size: number;
  twinkle: boolean;
  /** Twinkles still to pop (crackle). */
  pops: number;
  seed: number;
}
export interface FireworksStats {
  sparks: number;
  flashes: number;
  /** Flash light this frame, in screens (after the budget). */
  glowCover: number;
  /** Radius factor the budget gave the flashes (1: none). */
  shrink: number;
}
const emptyStats = (): FireworksStats => ({
  sparks: 0,
  flashes: 0,
  glowCover: 0,
  shrink: 1,
});
/** A small seeded generator (mulberry32): the same show for everyone. */
function seeded(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
/** The last moment (s from launch) a shell of this kind leaves anything. */
export const shellEnds = (kind: ShellKind) =>
  FIREWORKS.riseSeconds +
  SHELL_KINDS[kind].life[1] +
  (kind === "crackle" ? FIREWORKS.popLife[1] : 0);

export function fireworkShells(seed: number): Shell[] {
  const r = seeded(seed);
  return PROGRAM.map(({ at, kind, u }) => {
    const p = PALETTES[Math.floor(r() * PALETTES.length)],
      su = (r() - 0.5) * FIREWORKS.across,
      v = FIREWORKS.band[0] + r() * (FIREWORKS.band[1] - FIREWORKS.band[0]),
      tilt = (r() - 0.5) * 1.1;
    return {
      launch: at,
      kind,
      u: u ?? su,
      v,
      colors: kind === "willow" ? WILLOW : kind === "heart" ? HEART : p,
      tilt,
      placed: false,
      x: 0,
      y: 0,
      h: 0,
      k: 1,
    };
  });
}

export class PlazaFireworks {
  /** Share of sparks (graphics level, reduced motion). */
  density = 1;
  /** Sparks draw tails and rockets shed embers (not at Low). */
  tails = true;
  /** Most screens of flash light a frame (Infinity: no limit). */
  glowBudget = Infinity;
  readonly stats: FireworksStats = emptyStats();
  /** The heaviest frame since the show started. */
  readonly peak: FireworksStats = emptyStats();
  private readonly sparks: Spark[] = [];
  private live = 0;
  private shells: Shell[] = [];
  private at = 0;
  /** The first shell not yet burst. */
  private next = 0;
  /** Crackle pops waiting to be spawned this step: x, y, k triples. */
  private readonly popQueue: number[] = [];
  private sprites = new Map<string, HTMLCanvasElement>();
  /** This frame's sparks by colour and brightness, so each group is one path
   * (reused arrays: x, y, size for cores; x0, y0, x1, y1 for tails). */
  private readonly cores = new Map<string, number[]>();
  private readonly tailLines = new Map<string, number[]>();
  private serial = 0;
  private random: () => number;
  constructor(random: () => number = Math.random) {
    this.random = random;
  }
  /** Graphics level: Low (or reduced motion) is lighter. */
  setLevel(low: boolean, reduced: boolean) {
    this.density = low || reduced ? FIREWORKS.lowDensity : 1;
    this.tails = !low;
    this.glowBudget = low ? FIREWORKS.lowGlowBudget : Infinity;
  }
  /** A show starting at `at` (server ms); one arriving late skips what's past. */
  start(at: number, seed: number, now: number) {
    this.shells = fireworkShells(seed);
    this.at = at;
    const t = (now - at) / 1000;
    this.next = this.shells.findIndex(
      (s) => s.launch + FIREWORKS.riseSeconds >= t,
    );
    if (this.next < 0) this.next = this.shells.length;
    Object.assign(this.peak, emptyStats());
  }
  /** Anything to draw (a show on, or its last sparks). */
  active(now: number) {
    return (
      this.live > 0 ||
      (this.next < this.shells.length && now < this.at + PLAZA_WISH.showMs)
    );
  }
  /** Where the shells that have gone up burst (world px; tests). */
  centres() {
    return this.shells
      .slice(0, this.next)
      .filter((s) => s.placed)
      .map((s) => ({ x: s.x, y: s.y, kind: s.kind }));
  }
  /** Move the sparks `dt` seconds on; shells go up and burst on the show's
   * clock, placed in `view` as they go up. */
  step(now: number, dt: number, view: FireworksView) {
    const t = (now - this.at) / 1000,
      w = view.x1 - view.x0,
      h = view.y1 - view.y0;
    for (let i = this.next; i < this.shells.length; i++) {
      const s = this.shells[i];
      if (t < s.launch) continue;
      if (!s.placed) {
        s.placed = true;
        s.k = h / FIREWORKS.refHeight;
        s.x = view.x0 + w * (0.5 + s.u);
        s.y = view.y0 + h * s.v;
        s.h = h * FIREWORKS.climb;
      }
      // Embers falling from the rocket on its way up.
      const q = (t - s.launch) / FIREWORKS.riseSeconds;
      if (this.tails && q < 1 && this.random() < 40 * dt * this.density)
        this.add(s.x, this.rocketY(s, q), s.k, {
          vx: (this.random() - 0.5) * 30,
          vy: 20 + this.random() * 40,
          life: 0.3 + this.random() * 0.2,
          c0: EMBER,
          c1: "#ff8a3d",
          shift: 0.5,
          drag: 2,
          gravity: 120,
          tail: 0.02,
          size: 1.8,
          twinkle: false,
          pops: 0,
        });
    }
    while (
      this.next < this.shells.length &&
      t >= this.shells[this.next].launch + FIREWORKS.riseSeconds
    ) {
      const s = this.shells[this.next++];
      if (s.placed) this.burst(s);
    }
    let n = 0;
    for (let i = 0; i < this.live; i++) {
      const p = this.sparks[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vy = p.vy * drag + p.gravity * p.k * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.pops && p.age >= p.life * 0.7) {
        this.popQueue.push(p.x, p.y, p.k);
        p.pops = 0;
        p.life = p.age + 0.05;
      }
      // Keep the living at the front of the pool (swap, no allocation).
      if (n !== i) {
        this.sparks[i] = this.sparks[n];
        this.sparks[n] = p;
      }
      n++;
    }
    this.live = n;
    const q = this.popQueue;
    for (let i = 0; i < q.length; i += 3)
      for (let j = 0; j < FIREWORKS.pops; j++) {
        const a = this.random() * Math.PI * 2,
          sp = 130 + this.random() * 60;
        this.add(q[i], q[i + 1], q[i + 2], {
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life:
            FIREWORKS.popLife[0] +
            this.random() * (FIREWORKS.popLife[1] - FIREWORKS.popLife[0]),
          c0: CRACKLE_POP,
          c1: "#ffe9a8",
          shift: 0.5,
          drag: 5,
          gravity: 40,
          tail: 0,
          size: 2,
          twinkle: true,
          pops: 0,
        });
      }
    q.length = 0;
  }
  private rocketY(s: Shell, q: number) {
    return s.y + s.h * (1 - q) * (1 - q);
  }
  /** One spark from the pool (none past the cap). */
  private add(
    x: number,
    y: number,
    k: number,
    o: Omit<Spark, "x" | "y" | "k" | "age" | "seed">,
  ) {
    if (this.live >= FIREWORKS.maxSparks) return;
    let p = this.sparks[this.live];
    if (!p) {
      p = {} as Spark;
      this.sparks.push(p);
    }
    Object.assign(p, o);
    p.x = x;
    p.y = y;
    p.k = k;
    p.vx *= k;
    p.vy *= k;
    p.age = 0;
    p.seed = this.serial++ % 997;
    this.live++;
  }
  private burst(s: Shell) {
    const K = SHELL_KINDS[s.kind],
      count = Math.round(K.count * this.density),
      pops = s.kind === "crackle" && this.tails ? FIREWORKS.pops : 0,
      cos = Math.cos(s.tilt),
      sin = Math.sin(s.tilt);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + this.random() * 0.25,
        sp = K.speed[0] + this.random() * (K.speed[1] - K.speed[0]);
      let vx: number, vy: number;
      if (s.kind === "heart") {
        // The heart curve, scaled so its widest point is the speed.
        const t = (i / count) * Math.PI * 2,
          hx = 16 * Math.sin(t) ** 3,
          hy = -(
            13 * Math.cos(t) -
            5 * Math.cos(2 * t) -
            2 * Math.cos(3 * t) -
            Math.cos(4 * t)
          );
        vx = (hx / 17) * sp;
        vy = (hy / 17) * sp;
      } else if (s.kind === "ring") {
        const rx = Math.cos(a) * sp,
          ry = Math.sin(a) * sp * 0.4;
        vx = rx * cos - ry * sin;
        vy = rx * sin + ry * cos;
      } else {
        // A filled disc for the chrysanthemum, a shell for the rest.
        const f = s.kind === "chrysanthemum" ? 0.45 + 0.55 * this.random() : 1;
        vx = Math.cos(a) * sp * f;
        vy = Math.sin(a) * sp * f;
      }
      this.add(s.x, s.y, s.k, {
        vx,
        vy,
        life: K.life[0] + this.random() * (K.life[1] - K.life[0]),
        c0: s.colors[0],
        c1: s.colors[1],
        shift: K.shift,
        drag: K.drag,
        gravity: K.gravity,
        tail: this.tails ? K.tail : 0,
        size: K.size,
        twinkle: K.twinkle,
        pops,
      });
    }
  }
  /**
   * Draw on the Plaza's canvas in world px (the scene's transform). `zoom`
   * and the screen's size (CSS px) turn flash areas into screens.
   */
  draw(
    g: CanvasRenderingContext2D,
    now: number,
    zoom: number,
    screenW: number,
    screenH: number,
  ) {
    const st = emptyStats(),
      t = (now - this.at) / 1000;
    g.save();
    // The scene dims under the show (one fill over the canvas).
    const end = PLAZA_WISH.showMs / 1000,
      veil =
        this.tails && t >= 0 && t < end
          ? FIREWORKS.dim *
            Math.min(1, t / FIREWORKS.dimIn) *
            Math.min(1, (end - t) / FIREWORKS.dimOut)
          : 0;
    if (veil > 0.005) {
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = veil;
      g.fillStyle = "#050a24";
      g.fillRect(0, 0, g.canvas.width, g.canvas.height);
      g.restore();
    }
    g.globalCompositeOperation = "lighter";
    // Rockets on their way up: a bright head and a streak.
    for (let i = this.next; i < this.shells.length; i++) {
      const s = this.shells[i],
        q = (t - s.launch) / FIREWORKS.riseSeconds;
      if (!s.placed || q < 0 || q >= 1) continue;
      const y = this.rocketY(s, q),
        tail = 55 * s.k;
      g.strokeStyle = EMBER;
      g.lineWidth = 3 * s.k;
      g.globalAlpha = 0.8;
      g.beginPath();
      g.moveTo(s.x, y + tail);
      g.lineTo(s.x, y);
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = "#fffbe8";
      g.fillRect(s.x - 3.5 * s.k, y - 3.5 * s.k, 7 * s.k, 7 * s.k);
    }
    // Flashes: one glow a burst while young, within the glow budget.
    const toScreens = (zoom * zoom) / Math.max(1, screenW * screenH),
      radius = (s: Shell, q: number) =>
        FIREWORKS.flash * s.k * (0.55 + 0.45 * q);
    let cover = 0;
    for (let i = 0; i < this.next; i++) {
      const s = this.shells[i],
        q = (t - s.launch - FIREWORKS.riseSeconds) / FIREWORKS.flashSeconds;
      if (!s.placed || q < 0 || q >= 1) continue;
      const r = radius(s, q);
      cover += 4 * r * r * toScreens;
    }
    let shrink = 1;
    if (Number.isFinite(this.glowBudget) && cover > this.glowBudget)
      shrink = Math.max(MIN_SHRINK, Math.sqrt(this.glowBudget / cover));
    for (let i = 0; i < this.next; i++) {
      const s = this.shells[i],
        q = (t - s.launch - FIREWORKS.riseSeconds) / FIREWORKS.flashSeconds;
      if (!s.placed || q < 0 || q >= 1) continue;
      const r = radius(s, q) * shrink;
      g.globalAlpha = 0.8 * (1 - q);
      g.drawImage(this.sprite(s.colors[0]), s.x - r, s.y - r, r * 2, r * 2);
      st.flashes++;
      st.glowCover += 4 * r * r * toScreens;
    }
    // Sparks: plain blending (added light washes out over the sunny square).
    // A white-hot start, the second colour after `shift`, a streak behind at
    // High and a twinkle as some fade. Grouped by colour and one of four
    // brightnesses, so each group is a single path.
    g.globalCompositeOperation = "source-over";
    for (const list of this.cores.values()) list.length = 0;
    for (const list of this.tailLines.values()) list.length = 0;
    for (let i = 0; i < this.live; i++) {
      const p = this.sparks[i],
        q = p.age / p.life;
      let a = q < 0.7 ? 1 : (1 - q) / 0.3;
      if (p.twinkle && q > 0.5)
        a *= hash(p.seed * 31 + Math.floor(p.age * 22)) > 0.45 ? 1 : 0.15;
      if (a <= 0.05) continue;
      const hot = p.age < 0.1,
        key =
          (hot ? "#ffffff" : q < p.shift ? p.c0 : p.c1) +
          (a > 0.85 ? 3 : a > 0.55 ? 2 : a > 0.3 ? 1 : 0),
        d = (p.size * p.k * (hot ? 1.5 : 1)) / 2;
      let core = this.cores.get(key);
      if (!core) this.cores.set(key, (core = []));
      core.push(p.x - d, p.y - d, d * 2);
      if (p.tail) {
        let line = this.tailLines.get(key);
        if (!line) this.tailLines.set(key, (line = []));
        line.push(p.x, p.y, p.x - p.vx * p.tail, p.y - p.vy * p.tail, d);
      }
    }
    for (const [key, line] of this.tailLines) {
      if (!line.length) continue;
      g.globalAlpha = BRIGHT[+key.slice(-1)] * 0.55;
      g.strokeStyle = key.slice(0, -1);
      g.lineWidth = line[4] * 1.1;
      g.beginPath();
      for (let i = 0; i < line.length; i += 5) {
        g.moveTo(line[i], line[i + 1]);
        g.lineTo(line[i + 2], line[i + 3]);
      }
      g.stroke();
    }
    for (const [key, core] of this.cores) {
      if (!core.length) continue;
      g.globalAlpha = BRIGHT[+key.slice(-1)];
      g.fillStyle = key.slice(0, -1);
      g.beginPath();
      for (let i = 0; i < core.length; i += 3)
        g.rect(core[i], core[i + 1], core[i + 2], core[i + 2]);
      g.fill();
    }
    g.restore();
    st.sparks = this.live;
    st.shrink = shrink;
    Object.assign(this.stats, st);
    this.peak.sparks = Math.max(this.peak.sparks, st.sparks);
    this.peak.flashes = Math.max(this.peak.flashes, st.flashes);
    this.peak.glowCover = Math.max(this.peak.glowCover, st.glowCover);
    this.peak.shrink = Math.min(this.peak.shrink, st.shrink);
  }
  /** Where the live sparks are (world px; tests), or null for none. */
  bounds() {
    if (!this.live) return null;
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (let i = 0; i < this.live; i++) {
      const p = this.sparks[i];
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
    return { x0, y0, x1, y1 };
  }
  /** A soft round glow in one colour, drawn once (no per-frame gradients). */
  private sprite(color: string) {
    let c = this.sprites.get(color);
    if (!c) {
      c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d")!,
        gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,255,255,0.95)");
      gr.addColorStop(0.25, color);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      this.sprites.set(color, c);
    }
    return c;
  }
}
