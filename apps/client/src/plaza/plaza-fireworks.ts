import { PLAZA_WISH } from "../../../../packages/shared/src/plaza";

/**
 * The wishing fountain's fireworks (PLAZA_WISH.showMs, when a copy's wish
 * meter fills).
 *
 * The Plaza is a 2D canvas, not a Phaser scene, so the battle effects engine
 * (fx-engine.ts) can't draw here. This keeps to the engine's rules instead,
 * so the same limits apply:
 *
 * - **Graphics levels.** `density` scales the sparks as burst particles do
 *   in battle (High all, Low 35%, reduced motion 35% at every level), and
 *   Low drops the sparks' tails.
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
 * pattern at the same time (the server's clock). Each bursts in the viewer's
 * own sky: placed in the view as it goes up, in the band under the top HUD,
 * so the whole copy sees the show wherever they stand (on a small phone the
 * HUD covers the square's sky past the fountain).
 */
export const FIREWORKS = {
  /** Sparks alive at once, at most (High's busiest frame uses about 120). */
  maxSparks: 220,
  /** Sparks a shell bursts into, at full density. */
  sparksPerShell: 30,
  /** A rocket climbs for this long (s), then bursts. */
  riseSeconds: 0.55,
  /** Spark life (s) and drag (/s). */
  life: [0.9, 1.3] as const,
  drag: 1.9,
  /**
   * Burst speed and gravity, in screen px (s⁻¹, s⁻²) on a phone-sized view
   * (`refHeight` world px tall); a taller view scales them, so a burst takes
   * the same share of every screen.
   */
  speed: [125, 185] as const,
  gravity: 120,
  refHeight: 540,
  /** Where shells burst in the view: across the middle `across` of its
   * width, and between these shares of its height from the top (under the
   * top HUD on a 375 px tall phone). */
  across: 0.6,
  band: [0.44, 0.54] as const,
  /** A rocket climbs this share of the view's height. */
  climb: 0.28,
  /** The burst's flash: radius (px on the reference view) and life (s). */
  flash: 90,
  flashSeconds: 0.35,
  /** Low: at most this many screens of flash light a frame. */
  lowGlowBudget: 0.2,
  /** Low and reduced motion: share of sparks. */
  lowDensity: 0.35,
} as const;
/** Launch times (s from the show's start): eight shells, the last two together. */
const LAUNCH = [0, 0.45, 0.95, 1.45, 2.0, 2.5, 3.1, 3.15] as const;
/** Saturated, so they read against the sunny square as well as at night. */
const COLORS = [
  "#ff3d8b",
  "#ffb020",
  "#2fb8ff",
  "#8f5bff",
  "#3fdc6a",
  "#ff6a3d",
];
const MIN_SHRINK = 0.5;

interface Shell {
  launch: number;
  /** In the view: -0.5..0.5 of its width from the centre, 0..1 of its height. */
  u: number;
  v: number;
  colors: [string, string];
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
  /** The view's scale at the burst (gravity, size). */
  k: number;
  color: string;
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

/** A small seeded generator (mulberry32): the same shells for everyone. */
function seeded(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function fireworkShells(seed: number): Shell[] {
  const r = seeded(seed);
  return LAUNCH.map((launch) => {
    const c = Math.floor(r() * COLORS.length);
    return {
      launch,
      u: (r() - 0.5) * FIREWORKS.across,
      v: FIREWORKS.band[0] + r() * (FIREWORKS.band[1] - FIREWORKS.band[0]),
      colors: [
        COLORS[c],
        COLORS[(c + 1 + Math.floor(r() * 3)) % COLORS.length],
      ],
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
  /** Sparks draw a short tail (not at Low). */
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
  private sprites = new Map<string, HTMLCanvasElement>();
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
  /** Move the sparks `dt` seconds on; shells go up and burst on the show's
   * clock, placed in `view` as they go up. */
  step(now: number, dt: number, view: FireworksView) {
    const t = (now - this.at) / 1000,
      w = view.x1 - view.x0,
      h = view.y1 - view.y0;
    for (let i = this.next; i < this.shells.length; i++) {
      const s = this.shells[i];
      if (s.placed || t < s.launch) continue;
      s.placed = true;
      s.k = h / FIREWORKS.refHeight;
      s.x = view.x0 + w * (0.5 + s.u);
      s.y = view.y0 + h * s.v;
      s.h = h * FIREWORKS.climb;
    }
    while (
      this.next < this.shells.length &&
      t >= this.shells[this.next].launch + FIREWORKS.riseSeconds
    ) {
      const s = this.shells[this.next++];
      if (s.placed) this.burst(s);
    }
    const drag = Math.exp(-FIREWORKS.drag * dt);
    let n = 0;
    for (let i = 0; i < this.live; i++) {
      const p = this.sparks[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vx *= drag;
      p.vy = p.vy * drag + FIREWORKS.gravity * p.k * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Keep the living at the front of the pool (swap, no allocation).
      if (n !== i) {
        this.sparks[i] = this.sparks[n];
        this.sparks[n] = p;
      }
      n++;
    }
    this.live = n;
  }
  private burst(s: Shell) {
    const count = Math.round(FIREWORKS.sparksPerShell * this.density);
    for (let i = 0; i < count && this.live < FIREWORKS.maxSparks; i++) {
      const a = (i / count) * Math.PI * 2 + this.random() * 0.3,
        sp =
          (FIREWORKS.speed[0] +
            this.random() * (FIREWORKS.speed[1] - FIREWORKS.speed[0])) *
          s.k;
      let p = this.sparks[this.live];
      if (!p) {
        p = {} as Spark;
        this.sparks.push(p);
      }
      p.x = s.x;
      p.y = s.y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.age = 0;
      p.life =
        FIREWORKS.life[0] +
        this.random() * (FIREWORKS.life[1] - FIREWORKS.life[0]);
      p.k = s.k;
      p.color = s.colors[i % 2];
      this.live++;
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
    g.globalCompositeOperation = "lighter";
    // Rockets on their way up: a bright head and a short streak.
    for (let i = this.next; i < this.shells.length; i++) {
      const s = this.shells[i],
        q = (t - s.launch) / FIREWORKS.riseSeconds;
      if (!s.placed || q < 0 || q >= 1) continue;
      const y = s.y + s.h * (1 - q) * (1 - q),
        tail = 40 * s.k;
      g.strokeStyle = s.colors[0];
      g.lineWidth = 3 * s.k;
      g.globalAlpha = 0.85;
      g.beginPath();
      g.moveTo(s.x, y + tail);
      g.lineTo(s.x, y);
      g.stroke();
      g.fillStyle = "#fff8d0";
      g.fillRect(s.x - 3 * s.k, y - 3 * s.k, 6 * s.k, 6 * s.k);
    }
    // Flashes: one glow a burst while young, within the glow budget.
    const toScreens = (zoom * zoom) / Math.max(1, screenW * screenH),
      radius = (s: Shell, q: number) => FIREWORKS.flash * s.k * (0.6 + 0.4 * q);
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
      g.globalAlpha = 0.75 * (1 - q);
      g.drawImage(this.sprite(s.colors[0]), s.x - r, s.y - r, r * 2, r * 2);
      st.flashes++;
      st.glowCover += 4 * r * r * toScreens;
    }
    // Sparks: small squares, a tail at High, fading as they age. Plain
    // blending: added light washes out over the sunny square.
    g.globalCompositeOperation = "source-over";
    for (let i = 0; i < this.live; i++) {
      const p = this.sparks[i],
        q = p.age / p.life,
        d = 2.6 * p.k;
      g.globalAlpha = q < 0.7 ? 1 : (1 - q) / 0.3;
      g.fillStyle = p.color;
      g.fillRect(p.x - d, p.y - d, d * 2, d * 2);
      if (this.tails) {
        g.strokeStyle = p.color;
        g.lineWidth = 2 * p.k;
        g.globalAlpha *= 0.6;
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06);
        g.stroke();
      }
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
