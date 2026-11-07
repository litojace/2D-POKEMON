/**
 * The farm's "feel" layer: particles for taps and harvests, the light of the
 * time of day, cloud shadows and confetti. Everything here is drawing only;
 * no rule or reward depends on it (the server decides those).
 */

/** Seconds since midnight on this device, as a share of the day (0..1). */
export function deviceTimeOfDay(d = new Date()): number {
  return (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
}
/** 0 day … 1 night: the Plaza's curve (dusk 16:48–19:12, dawn 04:48–07:12). */
export function nightLevel(tod: number): number {
  if (tod > 0.3 && tod < 0.7) return 0;
  if (tod >= 0.7 && tod < 0.8) return (tod - 0.7) / 0.1;
  if (tod >= 0.2 && tod <= 0.3) return 1 - (tod - 0.2) / 0.1;
  return 1;
}
/**
 * How a weather looks at this hour. The server's weather is the same for
 * every player (4-hour windows), but day and night follow this device's
 * clock, as in the Plaza and the Bistro: a Sunny window after dark is a
 * clear night, a Rainbow one a pale moonbow, and a Moonlit one by day a
 * pale moon in a daytime sky. What it does (growth, mutations) is the same;
 * only its name, icon and colour change, and what's drawn.
 */
export function weatherLook<
  T extends { id: string; name: string; icon: string; color: string },
>(w: T, night: number): T {
  const dark = night >= 0.5;
  if (w.id === "sun" && dark)
    return { ...w, name: "Clear Night", icon: "star", color: "#b8c4ff" };
  if (w.id === "rainbow" && dark)
    return { ...w, name: "Moonbow", color: "#d8e0ff" };
  if (w.id === "moon" && !dark) return { ...w, name: "Daytime Moon" };
  return w;
}
/** 0 … 1 golden light: strongest at 17:30 (0.73), a softer glow at dawn. */
export function goldenLevel(tod: number): number {
  const dusk = 1 - Math.abs(tod - 0.73) / 0.07;
  const dawn = (1 - Math.abs(tod - 0.27) / 0.05) * 0.5;
  return Math.max(0, dusk, dawn);
}
/** Combo milestones in one swipe: a cheer at 6 crops, then every 6 more. */
export function isSuperSwipe(n: number): boolean {
  return n >= 6 && n % 6 === 0;
}

type Kind =
  | "spark"
  | "leaf"
  | "petal"
  | "feather"
  | "heart"
  | "drop"
  | "dust"
  | "ring"
  | "fruit"
  | "text";
interface Part {
  k: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  age: number;
  s: number;
  c: string;
  r: number;
  floor?: number;
  text?: string;
}
interface Confetto {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  r: number;
  vr: number;
  w: number;
  h: number;
  c: string;
  age: number;
  life: number;
}
export interface BurstOptions {
  v?: number;
  up?: number;
  g?: number;
  life?: number;
  s?: number;
  c?: string | string[];
  floor?: number;
}
const CONFETTI = [
  "#ffd65b",
  "#ff7a59",
  "#7ff0a2",
  "#5ec2ff",
  "#ff9bd2",
  "#c77dff",
  "#ffffff",
];
const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

export class FarmFeel {
  parts: Part[] = [];
  confetti: Confetto[] = [];
  /** Cloud shadows drifting over the farm (world units). */
  clouds = [
    { x: 200, y: 300, r: 360 },
    { x: 1000, y: 820, r: 320 },
    { x: 1700, y: 200, r: 400 },
  ];
  constructor(
    private o: {
      reduced: boolean;
      low: () => boolean;
      width: number;
      height: number;
    },
  ) {}
  /** How many particles to make: fewer with reduced motion or low graphics. */
  private n(n: number) {
    return Math.max(
      1,
      Math.round(n * (this.o.reduced ? 0.3 : this.o.low() ? 0.5 : 1)),
    );
  }
  burst(x: number, y: number, count: number, k: Kind, b: BurstOptions = {}) {
    for (let i = 0, n = this.n(count); i < n; i++) {
      const a = Math.random() * Math.PI * 2,
        v = (b.v ?? 120) * (0.5 + Math.random());
      this.parts.push({
        k,
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (b.up ?? 0),
        g: b.g ?? 0,
        life: b.life ?? 0.7,
        age: 0,
        s: b.s ?? 5,
        c: Array.isArray(b.c)
          ? pick(b.c)
          : (b.c ?? pick(["#fff6b0", "#ffd65b", "#fff"])),
        r: Math.random() * 6,
        floor: b.floor,
      });
    }
  }
  ring(x: number, y: number, r = 24) {
    this.parts.push({
      k: "ring",
      x,
      y,
      vx: 0,
      vy: 0,
      g: 0,
      life: 0.8,
      age: 0,
      s: r,
      c: "#fff",
      r: 0,
    });
  }
  /** A word that pops in and floats up ("SUPER SWIPE!", "GOLD ×5!"). */
  text(x: number, y: number, text: string, c = "#ffd65b", size = 34) {
    this.parts.push({
      k: "text",
      x,
      y,
      vx: 0,
      vy: -40,
      g: 0,
      life: 1.4,
      age: 0,
      s: size,
      c,
      r: 0,
      text,
    });
  }
  fruit(x: number, y: number, floor: number, c: string) {
    this.parts.push({
      k: "fruit",
      x,
      y,
      vx: (Math.random() - 0.5) * 60,
      vy: 0,
      g: 1500,
      life: 3,
      age: 0,
      s: 7,
      c,
      r: 0,
      floor,
    });
  }
  /** Confetti from a point of the view (virtual pixels), thrown upward. */
  pop(px: number, py: number, count = 50) {
    for (let i = 0, n = this.n(count); i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2,
        v = 350 + Math.random() * 500;
      this.confetti.push({
        x: px,
        y: py,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        g: 900,
        r: Math.random() * 6,
        vr: (Math.random() - 0.5) * 30,
        w: 6 + Math.random() * 6,
        h: 3 + Math.random() * 4,
        c: pick(CONFETTI),
        age: 0,
        life: 2.5 + Math.random(),
      });
    }
  }
  step(dt: number, wind: (x: number) => number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.age += dt;
      if (q.age > q.life) {
        this.parts.splice(i, 1);
        continue;
      }
      if (q.k === "leaf" || q.k === "petal") {
        q.vx += (wind(q.x) * 30 - q.vx) * dt;
        q.x += q.vx * dt;
        q.y += (q.vy + 26) * dt + Math.sin(q.age * 3 + q.r) * 0.4;
        q.r += dt * 3;
        if (q.floor != null && q.y > q.floor) {
          q.y = q.floor;
          q.vx = 0;
          q.vy = 0;
        }
        continue;
      }
      q.vy += q.g * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.k === "spark" || q.k === "dust") {
        q.vx *= 1 - dt * 3;
        q.vy *= 1 - dt * 3;
      }
      if (q.floor != null && q.y > q.floor) {
        q.y = q.floor;
        q.vy *= -0.35;
        q.vx *= 0.6;
        if (Math.abs(q.vy) < 30) q.vy = 0;
      }
    }
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const q = this.confetti[i];
      q.age += dt;
      if (q.age > q.life || q.y > this.o.height + 80) {
        this.confetti.splice(i, 1);
        continue;
      }
      q.vy = Math.min(q.vy + q.g * dt, 260);
      q.vx *= 1 - dt * 1.5;
      q.x += q.vx * dt + Math.sin(q.age * 5 + q.r) * 0.6;
      q.y += q.vy * dt;
      q.r += q.vr * dt;
    }
    if (!this.o.reduced)
      for (const c of this.clouds) {
        c.x += 14 * dt;
        if (c.x - c.r * 1.4 > this.o.width + 400) c.x = -400 - c.r * 1.4;
      }
  }
  /** Things that stand on the ground: drawn with the farm's depth order. */
  groundItems(g: CanvasRenderingContext2D): { y: number; d: () => void }[] {
    return this.parts
      .filter((q) => q.k === "fruit")
      .map((q) => ({
        y: q.floor ?? q.y,
        d: () => {
          g.globalAlpha = Math.min(1, (q.life - q.age) / 0.5);
          g.fillStyle = q.c;
          g.beginPath();
          g.arc(q.x, q.y - 6, q.s, 0, 7);
          g.fill();
          g.fillStyle = "rgba(255,255,255,.6)";
          g.beginPath();
          g.arc(q.x - 2, q.y - 9, 2.2, 0, 7);
          g.fill();
          g.globalAlpha = 1;
        },
      }));
  }
  /** Particles over the farm (world coordinates). */
  drawWorld(g: CanvasRenderingContext2D) {
    for (const q of this.parts) {
      if (q.k === "fruit") continue;
      const fade = Math.min(1, (q.life - q.age) / 0.5);
      g.globalAlpha = fade;
      switch (q.k) {
        case "spark":
          g.fillStyle = q.c;
          star(g, q.x, q.y, q.s * (1 - (q.age / q.life) * 0.5));
          break;
        case "leaf":
        case "petal":
        case "feather":
          g.fillStyle = q.c;
          g.save();
          g.translate(q.x, q.y);
          g.rotate(q.k === "feather" ? Math.sin(q.age * 6) * 0.8 : q.r);
          g.beginPath();
          g.ellipse(
            0,
            0,
            q.k === "petal" ? 5 : 6,
            q.k === "petal" ? 2.6 : 3,
            0,
            0,
            7,
          );
          g.fill();
          g.restore();
          break;
        case "heart":
          g.fillStyle = q.c;
          heart(g, q.x, q.y, q.s);
          break;
        case "drop":
          g.fillStyle = "#8fd4ff";
          g.beginPath();
          g.ellipse(q.x, q.y, 2.5, 5, 0, 0, 7);
          g.fill();
          break;
        case "dust":
          g.globalAlpha = fade * 0.55;
          g.fillStyle = q.c;
          g.beginPath();
          g.arc(q.x, q.y, q.s * (0.6 + q.age / q.life), 0, 7);
          g.fill();
          break;
        case "ring": {
          const k = q.age / q.life;
          g.strokeStyle = `rgba(255,255,255,${0.6 * (1 - k)})`;
          g.lineWidth = 2;
          g.beginPath();
          g.ellipse(q.x, q.y, q.s * (0.3 + k), q.s * (0.3 + k) * 0.4, 0, 0, 7);
          g.stroke();
          break;
        }
        case "text": {
          const k = q.age / q.life,
            sc = k < 0.1 ? 0.5 + k * 7 : k < 0.2 ? 1.2 - (k - 0.1) * 2 : 1;
          g.save();
          g.translate(q.x, q.y);
          g.scale(sc, sc);
          g.font = `800 ${q.s}px 'Barlow Condensed', sans-serif`;
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.lineWidth = 6;
          g.lineJoin = "round";
          g.strokeStyle = "#2a1a00";
          g.strokeText(q.text ?? "", 0, 0);
          g.fillStyle = q.c;
          g.fillText(q.text ?? "", 0, 0);
          g.restore();
          break;
        }
      }
    }
    g.globalAlpha = 1;
    g.textBaseline = "alphabetic";
  }
  /** Soft cloud shadows drifting across the farm (world coordinates). */
  drawClouds(g: CanvasRenderingContext2D, a = 0.15) {
    for (const c of this.clouds) {
      const gr = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      gr.addColorStop(0, `rgba(20,40,60,${a})`);
      gr.addColorStop(0.6, `rgba(20,40,60,${a * 0.55})`);
      gr.addColorStop(1, "rgba(20,40,60,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(c.x, c.y, c.r * 1.4, c.r * 0.8, 0.2, 0, 7);
      g.fill();
    }
  }
  /** Confetti over everything (view coordinates). */
  drawConfetti(g: CanvasRenderingContext2D) {
    for (const q of this.confetti) {
      g.save();
      g.globalAlpha = Math.min(1, (q.life - q.age) / 0.5);
      g.translate(q.x, q.y);
      g.rotate(q.r);
      g.scale(1, Math.cos(q.age * 8 + q.r));
      g.fillStyle = q.c;
      g.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
      g.restore();
    }
  }
}

export function star(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
) {
  g.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4,
      r = k % 2 ? s * 0.35 : s;
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
}
function heart(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const k = s / 16;
  g.beginPath();
  g.moveTo(x, y + 5 * k);
  g.bezierCurveTo(x - 9 * k, y - 2 * k, x - 6 * k, y - 10 * k, x, y - 5 * k);
  g.bezierCurveTo(x + 6 * k, y - 10 * k, x + 9 * k, y - 2 * k, x, y + 5 * k);
  g.fill();
}
/** A soft additive light. */
export function glow(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: string,
  a: number,
) {
  if (a <= 0.005) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${rgb},${a})`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}
/**
 * The time-of-day grade over the whole view: warm afternoon light, an
 * orange-rose golden hour and a blue night, plus a soft vignette.
 */
export function gradeView(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  o: { night: number; golden: number; warm: number; low: boolean },
) {
  g.save();
  if (!o.low && (o.warm > 0.01 || o.golden > 0.01)) {
    g.globalCompositeOperation = "soft-light";
    const lg = g.createLinearGradient(0, 0, w, h);
    lg.addColorStop(0, `rgba(255,230,160,${0.55 * o.warm})`);
    lg.addColorStop(0.55, `rgba(255,210,150,${0.08 * o.warm})`);
    lg.addColorStop(1, `rgba(40,50,110,${0.3 * o.warm})`);
    g.fillStyle = lg;
    g.fillRect(0, 0, w, h);
    if (o.golden > 0.01) {
      const sg = g.createLinearGradient(0, 0, w * 0.7, h);
      sg.addColorStop(0, `rgba(255,190,80,${0.8 * o.golden})`);
      sg.addColorStop(0.65, `rgba(255,140,70,${0.55 * o.golden})`);
      sg.addColorStop(1, `rgba(200,90,110,${0.45 * o.golden})`);
      g.fillStyle = sg;
      g.fillRect(0, 0, w, h);
      // The low sun itself: a warm bloom from the top-left corner.
      g.globalCompositeOperation = "screen";
      const sun = g.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) * 0.9);
      sun.addColorStop(0, `rgba(255,214,140,${0.32 * o.golden})`);
      sun.addColorStop(1, "rgba(255,214,140,0)");
      g.fillStyle = sun;
      g.fillRect(0, 0, w, h);
    }
  }
  const n = o.night,
    gd = o.golden * (1 - n);
  if (n > 0.01 || gd > 0.01) {
    g.globalCompositeOperation = "multiply";
    // The Plaza's night (a little lighter, so the farm reads as lit), warmer at golden hour.
    const r = 255 - 150 * n,
      gg = 255 - 132 * n - 22 * gd,
      b = 255 - 62 * n - 60 * gd;
    g.fillStyle = `rgb(${Math.round(r)},${Math.round(gg)},${Math.round(b)})`;
    g.fillRect(0, 0, w, h);
  }
  if (!o.low) {
    g.globalCompositeOperation = "source-over";
    const vg = g.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.38,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.78,
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(10,20,30,${0.22 + n * 0.2})`);
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
  }
  g.restore();
}
