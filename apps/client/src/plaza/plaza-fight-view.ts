/**
 * The close-up while a hooked fish fights (plaza-fishing.ts, phase "fight"):
 * the pond from over the angler's shoulder.
 *
 * Far away: the sky (clouds by day; stars, the moon and fireflies by night),
 * hills, a wood of mixed trees, the far bank with its rocks, reeds and a
 * little jetty. The water: deep in the distance and clear near you, the
 * wood's reflection shimmering on it, the sun's (or moon's) glints, rings
 * round the lily pads, dragonflies, a duck going about its day. Near you:
 * reeds and stones on your own bank. The fish: a real fish's shadow under
 * the surface, its fins and tail working, bubbles rising and a wake behind
 * it, coming nearer as it is reeled in; on a thrash it bursts out, scales
 * catching the light, a crown of water and spray round it. The rod tapers
 * from its cork grip through its guides to the tip, bending with the
 * tension, the reel spinning while you hold.
 *
 * It stands in for the Plaza's drawing while it is up (one scene to paint,
 * not two). Everything that doesn't move (sky, wood, bank, the still water,
 * the near bank) is painted once per screen size and time of day. Low
 * graphics keeps the fish, the line, the rod and the gauge, and the painted
 * scene, and drops the shimmer, glints, creatures and spray.
 *
 * The fish stays in its rarity's colours, never its own pattern: which fish
 * it is, the server says only once it is landed.
 */
import { PLAZA_FISH_RARITY } from "../../../../packages/shared/src/plaza";
import type { FightView } from "./plaza-fishing";

/** Where the gauge stands (CSS px in the scene): over the Leave button. */
export interface FightRoom {
  /** The gauge's middle (x) and its top and bottom (y). */
  gx: number;
  gy0: number;
  gy1: number;
}

/** A small seeded random, so the painted scene is the same every time. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Two "#rrggbb" colours mixed (k = 0 is a, 1 is b), as "#rrggbb". */
const mix = (a: string, b: string, k: number) => {
  const p = (c: string) =>
    [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const A = p(a),
    B = p(b);
  return (
    "#" +
    A.map((v, i) =>
      Math.round(v + (B[i] - v) * k)
        .toString(16)
        .padStart(2, "0"),
    ).join("")
  );
};
/** The horizon: where the far bank meets the water (share of the height). */
const HZ = 0.3;

export function createFightView() {
  /** The painted scene (everything still) and the wood's reflection. */
  let still: HTMLCanvasElement | null = null,
    refl: HTMLCanvasElement | null = null,
    key = "";
  /** Spray: [x, y, vx, vy, life, size]; rings: [x, y, age, size]. */
  const spray: number[][] = [],
    rings: number[][] = [],
    bubbles: number[][] = [];
  let wasThrash = false,
    last = 0,
    bubbleIn = 0;

  function paint(w: number, h: number, ratio: number, night: number) {
    const mk = () => {
      const c = document.createElement("canvas");
      c.width = Math.ceil(w * ratio);
      c.height = Math.ceil(h * ratio);
      const g = c.getContext("2d")!;
      g.scale(ratio, ratio);
      return { c, g };
    };
    const hz = h * HZ,
      N = night,
      r = seeded(7);
    // ---- the far side: sky, hills, wood, bank (drawn once into `far`,
    // then onto the scene and, flipped, into the reflection) ----
    const far = mk(),
      f = far.g;
    const sky = f.createLinearGradient(0, 0, 0, hz * 0.62);
    sky.addColorStop(0, mix("#7cc4f0", "#0b1638", N));
    sky.addColorStop(1, mix("#d8f0ff", "#2a3a6e", N));
    f.fillStyle = sky;
    f.fillRect(0, 0, w, hz * 0.62 + 2);
    const sunX = w * 0.72,
      sunY = hz * 0.16;
    if (N < 0.5) {
      // The sun's glow, and soft clouds.
      const glow = f.createRadialGradient(sunX, sunY, 4, sunX, sunY, h * 0.35);
      glow.addColorStop(0, `rgba(255,250,220,${0.9 * (1 - N * 2)})`);
      glow.addColorStop(1, "rgba(255,250,220,0)");
      f.fillStyle = glow;
      f.fillRect(0, 0, w, hz);
      for (let i = 0; i < 6; i++) {
        const cx = r() * w,
          cy = hz * (0.08 + r() * 0.22),
          s = 0.6 + r() * 0.8;
        f.fillStyle = `rgba(255,255,255,${0.75 * (1 - N * 2)})`;
        for (let j = 0; j < 5; j++) {
          f.beginPath();
          f.ellipse(
            cx + (j - 2) * 16 * s,
            cy - Math.sin((j / 4) * Math.PI) * 8 * s,
            20 * s,
            11 * s,
            0,
            0,
            7,
          );
          f.fill();
        }
      }
    } else {
      // Stars and the moon.
      for (let i = 0; i < 70; i++) {
        f.fillStyle = `rgba(255,255,255,${(0.3 + r() * 0.7) * (N - 0.4)})`;
        f.fillRect(r() * w, r() * hz * 0.55, 1.4, 1.4);
      }
      const mg = f.createRadialGradient(sunX, sunY, 2, sunX, sunY, 60);
      mg.addColorStop(0, "rgba(220,230,255,.5)");
      mg.addColorStop(1, "rgba(220,230,255,0)");
      f.fillStyle = mg;
      f.fillRect(sunX - 60, sunY - 60, 120, 120);
      f.fillStyle = "#f4f2e0";
      f.beginPath();
      f.arc(sunX, sunY, 13, 0, 7);
      f.fill();
      f.fillStyle = "rgba(180,180,160,.35)";
      f.beginPath();
      f.arc(sunX - 4, sunY - 3, 3, 0, 7);
      f.arc(sunX + 5, sunY + 4, 2, 0, 7);
      f.fill();
    }
    // Hills, two layers, hazier further off.
    for (const [base, amp, col] of [
      [hz * 0.5, hz * 0.14, mix("#8fbfa0", "#24365a", N)],
      [hz * 0.6, hz * 0.12, mix("#6aa67a", "#1d2e4a", N)],
    ] as const) {
      f.fillStyle = col;
      f.beginPath();
      f.moveTo(0, hz);
      for (let x = 0; x <= w + 20; x += 20)
        f.lineTo(
          x,
          base -
            Math.sin(x * 0.006 + base) * amp -
            Math.sin(x * 0.017 + 2) * amp * 0.35,
        );
      f.lineTo(w, hz);
      f.fill();
    }
    // The wood: pines and round trees of a few kinds, back row darker.
    const tree = (
      x: number,
      y: number,
      s: number,
      kind: number,
      back: boolean,
    ) => {
      const dk = back ? 0.25 : 0;
      f.fillStyle = mix(mix("#6a4426", "#000000", dk), "#1a1420", N * 0.7);
      f.fillRect(x - 3 * s, y - 16 * s, 6 * s, 16 * s);
      if (kind === 0) {
        // A pine: stacked tiers, lit on the sun's side.
        for (let t = 0; t < 4; t++) {
          const ty = y - 12 * s - t * 13 * s,
            tw = (26 - t * 5) * s;
          f.fillStyle = mix(mix("#2f6f3a", "#000000", dk), "#0e1e24", N * 0.75);
          f.beginPath();
          f.moveTo(x - tw, ty);
          f.lineTo(x, ty - 22 * s);
          f.lineTo(x + tw, ty);
          f.fill();
          f.fillStyle = mix(mix("#4f9a4a", "#000000", dk), "#16302e", N * 0.75);
          f.beginPath();
          f.moveTo(x, ty - 22 * s);
          f.lineTo(x + tw, ty);
          f.lineTo(x + tw * 0.2, ty);
          f.fill();
        }
      } else {
        // A round tree: a few blobs, a shadow side and a lit side.
        const base = ["#3f8a3a", "#5aa63f", "#d97aa6", "#e0a23a"][kind - 1];
        const col = mix(mix(base, "#000000", dk), "#101a2a", N * 0.75),
          lit = mix(mix(base, "#ffffff", 0.25 - dk), "#1a2a3a", N * 0.75),
          sh = mix(mix(base, "#000000", 0.3 + dk), "#0a1020", N * 0.75);
        for (let b = 0; b < 6; b++) {
          const a = (b / 6) * Math.PI * 2,
            bx = x + Math.cos(a) * 14 * s,
            by = y - 36 * s + Math.sin(a) * 10 * s;
          f.fillStyle = b > 3 ? sh : col;
          f.beginPath();
          f.arc(bx, by, 15 * s, 0, 7);
          f.fill();
        }
        f.fillStyle = col;
        f.beginPath();
        f.arc(x, y - 38 * s, 18 * s, 0, 7);
        f.fill();
        f.fillStyle = lit;
        f.beginPath();
        f.arc(x + 6 * s, y - 46 * s, 10 * s, 0, 7);
        f.arc(x - 10 * s, y - 40 * s, 6 * s, 0, 7);
        f.fill();
      }
    };
    for (const back of [true, false]) {
      const n = Math.ceil(w / (back ? 34 : 46));
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * w + (r() - 0.5) * 24,
          s = (back ? 0.75 : 1) * (0.8 + r() * 0.45),
          kind = r() < 0.35 ? 0 : 1 + Math.floor(r() * (r() < 0.85 ? 2 : 4));
        tree(x, hz - (back ? 10 : 2) - r() * 4, s, kind, back);
      }
    }
    // The far bank: grass, flowers, rocks at the water, reeds, a jetty.
    const bank = f.createLinearGradient(0, hz - 12, 0, hz);
    bank.addColorStop(0, mix("#5aa63f", "#1a3a2a", N * 0.8));
    bank.addColorStop(1, mix("#3f7a32", "#12281e", N * 0.8));
    f.fillStyle = bank;
    f.fillRect(0, hz - 10, w, 11);
    for (let i = 0; i < w / 6; i++) {
      f.fillStyle = ["#ffd65b", "#ffffff", "#ff8fb8"][i % 3];
      f.globalAlpha = 0.8 * (1 - N * 0.7);
      f.fillRect(r() * w, hz - 9 + r() * 6, 1.6, 1.6);
    }
    f.globalAlpha = 1;
    for (let i = 0; i < w / 40; i++) {
      const x = r() * w,
        s = 3 + r() * 5;
      f.fillStyle = mix("#9aa4ae", "#3a4458", N * 0.7);
      f.beginPath();
      f.ellipse(x, hz - 1, s * 1.4, s * 0.7, 0, 0, 7);
      f.fill();
      f.fillStyle = mix("#c8d0d8", "#4a5468", N * 0.7);
      f.beginPath();
      f.ellipse(x - s * 0.3, hz - s * 0.35, s * 0.6, s * 0.25, 0, 0, 7);
      f.fill();
    }
    f.strokeStyle = mix("#3f7a32", "#14301e", N * 0.8);
    f.lineWidth = 1.4;
    for (let i = 0; i < w / 5; i++) {
      const x = r() * w,
        hh = 6 + r() * 12;
      f.beginPath();
      f.moveTo(x, hz);
      f.quadraticCurveTo(x, hz - hh * 0.6, x + (r() - 0.5) * 6, hz - hh);
      f.stroke();
    }
    // A little jetty on the far side.
    const jx = w * 0.18;
    f.fillStyle = mix("#8a5a32", "#2a1e1a", N * 0.7);
    f.fillRect(jx, hz - 4, 46, 5);
    for (let i = 0; i < 4; i++) f.fillRect(jx + 2 + i * 13, hz, 3, 6);
    // ---- the scene: the far side, then the water ----
    const scene = mk(),
      g = scene.g;
    g.drawImage(far.c, 0, 0, w, h);
    const water = g.createLinearGradient(0, hz, 0, h);
    water.addColorStop(0, mix("#3f8fc0", "#0e2246", N));
    water.addColorStop(0.25, mix("#2a78ae", "#0b1c3c", N));
    water.addColorStop(0.7, mix("#3a9cc4", "#12305a", N));
    water.addColorStop(1, mix("#5fc0d0", "#1c4a6a", N));
    g.fillStyle = water;
    g.fillRect(0, hz, w, h - hz);
    // The reflection (flipped, squashed, faded into the water's colour).
    const rf = mk(),
      q = rf.g;
    q.save();
    q.translate(0, hz * 2);
    q.scale(1, -1);
    q.drawImage(far.c, 0, 0, w, h);
    q.restore();
    q.globalCompositeOperation = "destination-in";
    const fade = q.createLinearGradient(0, hz, 0, hz + h * 0.32);
    fade.addColorStop(0, "rgba(0,0,0,.55)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    q.fillStyle = fade;
    q.fillRect(0, hz, w, h - hz);
    q.globalCompositeOperation = "source-over";
    q.clearRect(0, 0, w, hz);
    refl = rf.c;
    // Light under the near water, and darker weed patches.
    for (let i = 0; i < 14; i++) {
      const x = r() * w,
        y = hz + (h - hz) * (0.45 + r() * 0.55),
        s = 30 + r() * 60;
      const lg = g.createRadialGradient(x, y, 0, x, y, s);
      const light = i % 3 !== 0;
      lg.addColorStop(
        0,
        light
          ? `rgba(200,255,250,${0.1 * (1 - N * 0.6)})`
          : "rgba(10,50,40,.18)",
      );
      lg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = lg;
      g.beginPath();
      g.ellipse(x, y, s * 1.6, s * 0.5, 0, 0, 7);
      g.fill();
    }
    // Lily pads: veined, notched, a few flowers; smaller far away.
    const pads: [number, number, number, boolean][] = [
      [0.1, 0.42, 0.5, false],
      [0.15, 0.45, 0.35, true],
      [0.86, 0.38, 0.45, false],
      [0.92, 0.41, 0.3, false],
      [0.05, 0.84, 1.15, true],
      [0.17, 0.92, 0.8, false],
      [0.94, 0.66, 0.9, true],
    ];
    for (const [px, py, s, flower] of pads) {
      const x = px * w,
        y = py * h,
        rr = 34 * s,
        rot = (px * 13) % 6;
      g.fillStyle = "rgba(0,30,40,.25)";
      g.beginPath();
      g.ellipse(x + 2, y + 3, rr, rr * 0.36, 0, 0, 7);
      g.fill();
      const pg = g.createLinearGradient(x, y - rr * 0.4, x, y + rr * 0.4);
      pg.addColorStop(0, mix("#6fd06a", "#1e4a3a", N * 0.7));
      pg.addColorStop(1, mix("#2f9a4a", "#123a2c", N * 0.7));
      g.fillStyle = pg;
      g.beginPath();
      g.ellipse(x, y, rr, rr * 0.36, 0, rot + 0.3, rot + Math.PI * 2 - 0.05);
      g.lineTo(x, y);
      g.fill();
      g.strokeStyle = "rgba(20,80,40,.45)";
      g.lineWidth = 1;
      g.beginPath();
      for (let v = 0; v < 7; v++) {
        const a = rot + 0.5 + (v / 7) * (Math.PI * 2 - 0.6);
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * rr * 0.9, y + Math.sin(a) * rr * 0.32);
      }
      g.stroke();
      if (flower) {
        const fx = x + rr * 0.15,
          fy = y - rr * 0.18,
          fs = 7 * s + 3;
        for (let l = 0; l < 2; l++)
          for (let p = 0; p < 7; p++) {
            const a = (p / 7) * Math.PI * 2 + l * 0.4;
            g.fillStyle = l ? "#ffd0e4" : "#ff8fb8";
            g.beginPath();
            g.ellipse(
              fx + Math.cos(a) * fs * (l ? 0.45 : 0.7),
              fy + Math.sin(a) * fs * 0.35 * (l ? 0.45 : 0.7) - l * fs * 0.25,
              fs * 0.45,
              fs * 0.22,
              a,
              0,
              7,
            );
            g.fill();
          }
        g.fillStyle = "#ffd65b";
        g.beginPath();
        g.arc(fx, fy - fs * 0.3, fs * 0.22, 0, 7);
        g.fill();
      }
    }
    // Your own bank at the bottom corners: stones and tall reeds.
    const near = (x0: number, dir: number) => {
      for (let i = 0; i < 5; i++) {
        const x = x0 + dir * (i * 26 + r() * 10),
          y = h - 4 + r() * 10,
          s = 10 + r() * 12;
        g.fillStyle = mix("#7a8490", "#2a3240", N * 0.7);
        g.beginPath();
        g.ellipse(x, y, s * 1.5, s * 0.8, 0, 0, 7);
        g.fill();
        g.fillStyle = mix("#aab4be", "#3a4456", N * 0.7);
        g.beginPath();
        g.ellipse(x - s * 0.3, y - s * 0.35, s * 0.8, s * 0.3, 0, 0, 7);
        g.fill();
      }
      for (let i = 0; i < 16; i++) {
        const x = x0 + dir * (r() * 120),
          hh = h * (0.18 + r() * 0.22),
          lean = dir * (r() * 18 - 4);
        g.strokeStyle = mix(i % 2 ? "#4f9a3c" : "#6fbf4a", "#14301e", N * 0.75);
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x, h + 4);
        g.quadraticCurveTo(x, h - hh * 0.6, x + lean, h - hh);
        g.stroke();
        if (i % 4 === 1) {
          g.fillStyle = mix("#7a4a2a", "#1e1410", N * 0.6);
          g.beginPath();
          g.roundRect(x + lean * 0.85 - 3, h - hh * 0.95, 6, 18, 3);
          g.fill();
        }
      }
    };
    near(-10, 1);
    near(w + 10, -1);
    still = scene.c;
  }

  /** The fish's place on the water for its progress (far to near). */
  function fishAt(v: FightView, w: number, h: number, time: number) {
    const hz = h * HZ,
      k = v.progress,
      y = hz + (h - hz) * (0.14 + 0.58 * k),
      dx = Math.cos(time * 1.3),
      x =
        w * 0.36 +
        Math.sin(time * 1.3) * w * (0.18 - k * 0.07) +
        (v.thrash ? Math.sin(time * 28) * 10 : 0);
    return { x, y, s: 0.6 + k * 1.0, dir: dx >= 0 ? 1 : -1 };
  }
  /** A fish's outline (head toward +x), its tail bent by `wag`. */
  function fishPath(g: CanvasRenderingContext2D, wag: number) {
    g.beginPath();
    g.moveTo(44, 0);
    g.bezierCurveTo(36, -16, 6, -19, -18, -11);
    g.quadraticCurveTo(-30, -6, -36, 0);
    g.quadraticCurveTo(-30, 6, -18, 11);
    g.bezierCurveTo(6, 19, 36, 16, 44, 0);
    g.closePath();
    // The tail, forked, swinging.
    g.save();
    g.translate(-34, 0);
    g.rotate(wag);
    g.moveTo(0, 0);
    g.quadraticCurveTo(-14, -8, -26, -18);
    g.quadraticCurveTo(-20, 0, -26, 18);
    g.quadraticCurveTo(-14, 8, 0, 0);
    g.restore();
  }

  return {
    /**
     * One frame. `k` (0..1) is how far in it has come (it zooms and fades in
     * over the world); `room` places the gauge over Leave; `night` (0..1)
     * is the Plaza's time of day.
     */
    draw(
      g: CanvasRenderingContext2D,
      v: FightView,
      w: number,
      h: number,
      time: number,
      low: boolean,
      room: FightRoom,
      k: number,
      /** The scene's pixels per CSS pixel (the painted parts match it). */
      ratio: number,
      night = 0,
    ) {
      const nb = Math.round(night * 4) / 4,
        want = `${w}x${h}@${ratio}:${nb}`;
      if (!still || key !== want) {
        paint(w, h, ratio, nb);
        key = want;
      }
      const dt = Math.min(0.05, Math.max(0, time - last));
      last = time;
      const hz = h * HZ,
        R = PLAZA_FISH_RARITY[v.rarity],
        rar = R.color;
      g.save();
      if (k < 1) {
        g.globalAlpha = k;
        const z = 1.15 - 0.15 * k;
        g.translate(w / 2, h / 2);
        g.scale(z, z);
        g.translate(-w / 2, -h / 2);
      }
      // A slow sway (you're standing on a bank), a jolt while it thrashes.
      g.translate(Math.sin(time * 0.7) * 1.5, Math.sin(time * 0.53) * 1.2);
      if (v.thrash && !low)
        g.translate(Math.sin(time * 61) * 2.5, Math.cos(time * 47) * 2);
      g.drawImage(still!, -4, -4, w + 8, h + 8);

      // The wood's reflection, shimmering in strips (a still copy on Low).
      if (refl) {
        const strips = low ? 1 : 18,
          rh = h * 0.34;
        for (let i = 0; i < strips; i++) {
          const y0 = hz + (rh * i) / strips,
            sh = rh / strips + 1,
            off = low ? 0 : Math.sin(time * 1.6 + i * 0.9) * (1 + i * 0.35);
          g.drawImage(
            refl,
            0,
            y0 * ratio,
            refl.width,
            sh * ratio,
            off - 4,
            y0,
            w + 8,
            sh,
          );
        }
      }
      if (!low) {
        // Ripples: soft arcs, wider and further apart near you.
        g.strokeStyle = `rgba(255,255,255,${0.22 - night * 0.1})`;
        g.lineWidth = 1.3;
        g.beginPath();
        for (let row = 0; row < 11; row++) {
          const d = (row + ((time * 0.3) % 1)) / 11,
            y = hz + 6 + (h - hz) * d * d,
            len = 8 + d * 56;
          for (let i = 0; i < 6; i++) {
            const x =
              ((i * 0.19 + row * 0.37 + Math.sin(row * 1.7) * 0.1) % 1) * w +
              Math.sin(time * 0.8 + row + i) * 10;
            g.moveTo(x - len / 2, y);
            g.quadraticCurveTo(x, y - 2 - d * 3, x + len / 2, y);
          }
        }
        g.stroke();
        // The sun's (or moon's) glints on the water below it.
        const gx = w * 0.72;
        g.fillStyle = night > 0.5 ? "#e8ecff" : "#fffbe6";
        for (let i = 0; i < 46; i++) {
          const d = ((i * 0.618) % 1) ** 1.6,
            y = hz + 4 + (h - hz) * 0.75 * d,
            spread = 14 + d * 110,
            x = gx + Math.sin(i * 12.9898) * spread,
            a = Math.sin(time * (2 + (i % 5)) + i * 1.7);
          if (a <= 0.25) continue;
          g.globalAlpha = (a - 0.25) * (0.9 - d * 0.5) * (k < 1 ? k : 1);
          g.fillRect(x - (2 + d * 6), y, 4 + d * 12, 1.2 + d * 1.2);
        }
        g.globalAlpha = k < 1 ? k : 1;
        // Rings round the near lily pads, now and then.
        for (const [px, py, s, ph] of [
          [0.05, 0.84, 1.15, 0],
          [0.94, 0.66, 0.9, 1.7],
        ]) {
          const a = (((time * 0.5 + ph) % 1) + 1) % 1;
          g.strokeStyle = `rgba(255,255,255,${0.35 * (1 - a)})`;
          g.beginPath();
          g.ellipse(
            px * w,
            py * h,
            (40 + a * 40) * s,
            (14 + a * 14) * s,
            0,
            0,
            7,
          );
          g.stroke();
        }
        // A duck far off, paddling across, a wake behind it.
        const dk = ((time * 0.018) % 1.3) - 0.15,
          dxp = dk * w,
          dyp = hz + 16;
        g.strokeStyle = "rgba(255,255,255,.35)";
        g.beginPath();
        g.moveTo(dxp - 4, dyp + 3);
        g.lineTo(dxp - 30, dyp + 1);
        g.moveTo(dxp - 4, dyp + 3);
        g.lineTo(dxp - 28, dyp + 8);
        g.stroke();
        g.fillStyle = night > 0.5 ? "#4a5068" : "#8a6a4a";
        g.beginPath();
        g.ellipse(dxp, dyp, 9, 4, 0, 0, 7);
        g.fill();
        g.fillStyle = night > 0.5 ? "#2a4a48" : "#2f7a4a";
        g.beginPath();
        g.arc(dxp + 7, dyp - 5, 3.2, 0, 7);
        g.fill();
        g.fillStyle = "#ffb84a";
        g.fillRect(dxp + 9.5, dyp - 5.5, 3, 1.6);
        if (night < 0.5) {
          // Two dragonflies darting over the water.
          for (let d = 0; d < 2; d++) {
            const t = time * (0.6 + d * 0.25) + d * 3,
              x =
                w * (0.25 + d * 0.45) +
                Math.sin(t * 1.3) * w * 0.12 +
                Math.sin(t * 5.1) * 8,
              y = hz + h * (0.08 + d * 0.06) + Math.sin(t * 2.1) * 18,
              fl = Math.sin(time * 60 + d) * 0.6 + 0.4;
            g.fillStyle = `rgba(220,240,255,${0.35 + fl * 0.3})`;
            for (const [ox, sy] of [
              [-2, -1],
              [-2, 1],
              [2, -1],
              [2, 1],
            ]) {
              g.beginPath();
              g.ellipse(x + ox, y + sy * 4, 2.2, 6, sy * 0.5, 0, 7);
              g.fill();
            }
            g.fillStyle = d ? "#3fb0c8" : "#d0503a";
            g.fillRect(x - 9, y - 1, 14, 2.2);
            g.beginPath();
            g.arc(x + 5, y, 2.2, 0, 7);
            g.fill();
          }
        } else {
          // Fireflies over the far water and the reeds.
          for (let i = 0; i < 14; i++) {
            const t = time * 0.4 + i * 1.3,
              x = ((i * 0.137 + Math.sin(t) * 0.04) % 1) * w,
              y = hz - 14 + Math.sin(t * 1.7 + i) * 20 + (i % 3) * 18,
              a = (Math.sin(time * 2.4 + i * 2.1) + 1) / 2;
            const fg = g.createRadialGradient(x, y, 0, x, y, 8);
            fg.addColorStop(0, `rgba(255,240,140,${a})`);
            fg.addColorStop(1, "rgba(255,240,140,0)");
            g.fillStyle = fg;
            g.fillRect(x - 8, y - 8, 16, 16);
          }
        }
      }

      // ---- the fish ----
      const f = fishAt(v, w, h, time),
        s = f.s,
        wag = Math.sin(time * (v.thrash ? 30 : 7)) * (v.thrash ? 0.55 : 0.25);
      // Wake and bubbles while it swims under.
      if (!low && !v.thrash) {
        g.strokeStyle = "rgba(255,255,255,.3)";
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(f.x - f.dir * 20 * s, f.y - 6 * s);
        g.lineTo(f.x - f.dir * 80 * s, f.y - 18 * s);
        g.moveTo(f.x - f.dir * 20 * s, f.y + 2 * s);
        g.lineTo(f.x - f.dir * 80 * s, f.y + 12 * s);
        g.stroke();
        if ((bubbleIn -= dt) <= 0) {
          bubbleIn = 0.25 + Math.random() * 0.4;
          bubbles.push([
            f.x + f.dir * 30 * s,
            f.y,
            1.2,
            1.5 + Math.random() * 2,
          ]);
        }
      }
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b[1] -= dt * 14;
        b[0] += Math.sin(time * 6 + i) * 0.3;
        b[2] -= dt;
        if (b[2] <= 0) {
          bubbles.splice(i, 1);
          continue;
        }
        g.strokeStyle = `rgba(230,250,255,${b[2] * 0.6})`;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(b[0], b[1], b[3] * s, 0, 7);
        g.stroke();
      }
      if (v.thrash) {
        // The crown: white tongues of water round where it breaks out
        // (behind it).
        g.fillStyle = "rgba(240,252,255,.85)";
        for (let i = 0; i < 9; i++) {
          const a = (i / 8) * Math.PI,
            hgt = (14 + Math.sin(time * 40 + i * 2) * 6) * s,
            bx = f.x - Math.cos(a) * 48 * s,
            by = f.y + 10 * s;
          g.beginPath();
          g.moveTo(bx - 5 * s, by);
          g.quadraticCurveTo(bx, by - hgt * 1.4, bx + 5 * s, by);
          g.fill();
        }
        g.fillStyle = "rgba(255,255,255,.5)";
        g.beginPath();
        g.ellipse(f.x, f.y + 10 * s, 54 * s, 9 * s, 0, 0, 7);
        g.fill();
      }
      g.save();
      g.translate(f.x, f.y);
      g.scale(s * f.dir, s);
      if (!v.thrash) {
        // Under the surface: a soft shadow, a darker core, fins moving.
        g.globalAlpha *= 0.35;
        g.fillStyle = mix(rar, "#0a2a40", 0.75);
        g.save();
        g.scale(1.15, 1.25);
        fishPath(g, wag);
        g.fill();
        g.restore();
        g.globalAlpha /= 0.35;
        g.globalAlpha *= 0.62;
        fishPath(g, wag);
        g.fill();
        // Pectoral fins, paddling.
        g.beginPath();
        g.ellipse(8, 13, 9, 3, 0.6 + Math.sin(time * 9) * 0.4, 0, 7);
        g.ellipse(8, -13, 9, 3, -0.6 - Math.sin(time * 9) * 0.4, 0, 7);
        g.fill();
      } else {
        // Out of the water: its rarity's colours, lit from above, scales,
        // fins up, the eye.
        g.rotate(Math.sin(time * 14) * 0.25 - 0.2);
        const bg = g.createLinearGradient(0, -18, 0, 18);
        bg.addColorStop(0, mix(rar, "#0b1020", 0.35));
        bg.addColorStop(0.45, rar);
        bg.addColorStop(1, mix(rar, "#ffffff", 0.6));
        g.fillStyle = bg;
        fishPath(g, wag);
        g.fill();
        g.strokeStyle = mix(rar, "#0b1020", 0.5);
        g.lineWidth = 1.5;
        g.stroke();
        // Dorsal fin.
        g.fillStyle = mix(rar, "#0b1020", 0.25);
        g.beginPath();
        g.moveTo(14, -15);
        g.quadraticCurveTo(2, -25, -12, -13);
        g.closePath();
        g.fill();
        // Scales: rows of little arcs.
        g.save();
        fishPath(g, 0);
        g.clip();
        g.strokeStyle = "rgba(255,255,255,.35)";
        g.lineWidth = 1;
        g.beginPath();
        for (let sx = -20; sx < 32; sx += 7)
          for (let sy = -12; sy < 14; sy += 6) {
            const ox = (sy / 6) % 2 ? 3.5 : 0;
            g.moveTo(sx + ox + 3, sy);
            g.arc(sx + ox, sy, 3, 0, Math.PI, false);
          }
        g.stroke();
        // A shine along its back.
        g.fillStyle = "rgba(255,255,255,.45)";
        g.beginPath();
        g.ellipse(8, -8, 22, 3.5, -0.05, 0, 7);
        g.fill();
        g.restore();
        // Eye and mouth.
        g.fillStyle = "#fff";
        g.beginPath();
        g.arc(31, -4, 4.5, 0, 7);
        g.fill();
        g.fillStyle = "#0b1020";
        g.beginPath();
        g.arc(32, -4, 2.6, 0, 7);
        g.fill();
        g.fillStyle = "#fff";
        g.fillRect(32.5, -5.6, 1.2, 1.2);
        g.strokeStyle = mix(rar, "#0b1020", 0.6);
        g.beginPath();
        g.moveTo(44, 1);
        g.lineTo(39, 3);
        g.stroke();
      }
      g.restore();
      // Breaking the surface: a ring each thrash, a crown of water, spray.
      if (v.thrash && !wasThrash) {
        rings.push([f.x, f.y + 12 * s, 0, s]);
        if (!low)
          for (let i = 0; i < 22; i++) {
            const a = Math.PI * (0.08 + Math.random() * 0.84);
            spray.push([
              f.x + (Math.random() - 0.5) * 70 * s,
              f.y + 6 * s,
              -Math.cos(a) * (50 + Math.random() * 140) * s,
              -Math.sin(a) * (110 + Math.random() * 190) * s,
              0.55 + Math.random() * 0.4,
              (1.5 + Math.random() * 2.5) * s,
            ]);
          }
      }
      wasThrash = v.thrash;
      for (let i = rings.length - 1; i >= 0; i--) {
        const rg = rings[i];
        rg[2] += dt;
        if (rg[2] > 1.2) {
          rings.splice(i, 1);
          continue;
        }
        const a = rg[2] / 1.2;
        g.strokeStyle = `rgba(255,255,255,${0.8 * (1 - a)})`;
        g.lineWidth = 2.5 * (1 - a) + 0.5;
        g.beginPath();
        g.ellipse(
          rg[0],
          rg[1],
          (40 + a * 90) * rg[3],
          (10 + a * 22) * rg[3],
          0,
          0,
          7,
        );
        g.stroke();
      }
      if (v.thrash) {
        // Foam round its belly, in front of it.
        g.fillStyle = "rgba(255,255,255,.55)";
        g.beginPath();
        g.ellipse(f.x, f.y + 12 * s, 50 * s, 8 * s, 0, 0, Math.PI);
        g.fill();
      }
      for (let i = spray.length - 1; i >= 0; i--) {
        const p = spray[i];
        p[0] += p[2] * dt;
        p[1] += p[3] * dt;
        p[3] += 560 * dt;
        p[4] -= dt;
        if (p[4] <= 0) {
          spray.splice(i, 1);
          continue;
        }
        g.fillStyle = `rgba(225,248,255,${Math.min(1, p[4] * 1.6)})`;
        g.beginPath();
        g.ellipse(p[0], p[1], p[5], p[5] * 1.3, Math.atan2(p[3], p[2]), 0, 7);
        g.fill();
        g.fillStyle = "rgba(255,255,255,.9)";
        g.fillRect(
          p[0] - p[5] * 0.3,
          p[1] - p[5] * 0.5,
          p[5] * 0.5,
          p[5] * 0.5,
        );
      }

      // ---- the rod and line ----
      // From the bottom a little right of the middle, leaning in: the big
      // Hold button keeps the right-hand corner to itself.
      const bx = w * 0.74,
        by = h + 40,
        bend = v.tension,
        tx = w * (0.55 + bend * 0.03),
        ty = h * (0.3 + bend * 0.18),
        cx = w * 0.63,
        cy = h * (0.55 - bend * 0.05) + bend * 30;
      const at = (u: number) => ({
        x: (1 - u) ** 2 * bx + 2 * u * (1 - u) * cx + u * u * tx,
        y: (1 - u) ** 2 * by + 2 * u * (1 - u) * cy + u * u * ty,
      });
      // The line: from the tip to the fish's mouth; slack it sags, tight
      // it hums (shivers) and goes red at the top.
      const hot = v.strain > 0 || v.tension >= 0.93,
        mouth = { x: f.x + f.dir * 40 * s, y: f.y - 2 * s };
      g.strokeStyle = hot
        ? "rgba(255,120,110,.95)"
        : v.tension < v.lo
          ? "rgba(255,255,255,.55)"
          : "rgba(255,255,255,.9)";
      g.lineWidth = hot ? 2 : 1.3;
      g.beginPath();
      g.moveTo(tx, ty);
      if (v.tension < v.lo)
        g.quadraticCurveTo(
          (tx + mouth.x) / 2,
          Math.max(ty, mouth.y) + 50,
          mouth.x,
          mouth.y,
        );
      else {
        const hum = hot ? Math.sin(time * 90) * 2.5 : 0;
        g.quadraticCurveTo(
          (tx + mouth.x) / 2 + hum,
          (ty + mouth.y) / 2 + hum,
          mouth.x,
          mouth.y,
        );
      }
      g.stroke();
      // Where the line cuts the water: a small V of ripples.
      if (!low && !v.thrash) {
        g.strokeStyle = "rgba(255,255,255,.5)";
        g.lineWidth = 1;
        g.beginPath();
        g.ellipse(
          mouth.x,
          mouth.y,
          8 * s + Math.sin(time * 8) * 2,
          3 * s,
          0,
          0,
          7,
        );
        g.stroke();
      }
      // The rod: a taper from the grip to the tip, a sheen along it.
      const n = 24,
        side: { x: number; y: number }[] = [],
        other: { x: number; y: number }[] = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n,
          p = at(u),
          p2 = at(Math.min(1, u + 0.01)),
          p1 = at(Math.max(0, u - 0.01)),
          dx = p2.x - p1.x,
          dy = p2.y - p1.y,
          L = Math.hypot(dx, dy) || 1,
          half = 7 - u * 5.6;
        side.push({ x: p.x - (dy / L) * half, y: p.y + (dx / L) * half });
        other.push({ x: p.x + (dy / L) * half, y: p.y - (dx / L) * half });
      }
      const rodG = g.createLinearGradient(bx, by, tx, ty);
      rodG.addColorStop(0, "#2a2a32");
      rodG.addColorStop(0.5, "#3a3a48");
      rodG.addColorStop(1, "#5a5a6a");
      g.fillStyle = rodG;
      g.beginPath();
      side.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      for (let i = other.length - 1; i >= 0; i--)
        g.lineTo(other[i].x, other[i].y);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(255,255,255,.35)";
      g.lineWidth = 1.2;
      g.beginPath();
      side.forEach((p, i) => {
        if (i < 2) return;
        const q = other[i];
        const mx = p.x * 0.7 + q.x * 0.3,
          my = p.y * 0.7 + q.y * 0.3;
        i === 2 ? g.moveTo(mx, my) : g.lineTo(mx, my);
      });
      g.stroke();
      // The cork grip and its winding check.
      g.save();
      const g0 = at(0.04),
        g1 = at(0.24);
      g.lineCap = "round";
      g.strokeStyle = "#c89a62";
      g.lineWidth = 16;
      g.beginPath();
      g.moveTo(g0.x, g0.y);
      g.lineTo(g1.x, g1.y);
      g.stroke();
      g.strokeStyle = "rgba(120,80,40,.5)";
      g.lineWidth = 16;
      g.setLineDash([2, 5]);
      g.stroke();
      g.setLineDash([]);
      g.restore();
      // Guides along the rod, the line running through them.
      g.strokeStyle = "#d8dee8";
      g.lineWidth = 1.5;
      for (const u of [0.48, 0.62, 0.74, 0.84, 0.92]) {
        const p = at(u),
          gs = 5 - u * 3;
        g.beginPath();
        g.ellipse(p.x - gs * 0.8, p.y - gs * 0.8, gs, gs * 0.7, 0.8, 0, 7);
        g.stroke();
      }
      g.strokeStyle = "rgba(255,255,255,.55)";
      g.lineWidth = 0.8;
      g.beginPath();
      const r0 = at(0.42);
      g.moveTo(r0.x, r0.y);
      for (const u of [0.48, 0.62, 0.74, 0.84, 0.92, 1]) {
        const p = at(u);
        g.lineTo(p.x - (u < 1 ? 4 : 0), p.y - (u < 1 ? 4 : 0));
      }
      g.stroke();
      // The reel: its body, a spool of line, the handle turning as you
      // hold (and ticking back as line goes out).
      const rp = at(0.42);
      g.save();
      g.translate(rp.x + 6, rp.y + 10);
      g.fillStyle = "#1e222c";
      g.beginPath();
      g.roundRect(-8, -26, 16, 16, 4);
      g.fill();
      const rg2 = g.createRadialGradient(-6, -6, 2, 0, 0, 24);
      rg2.addColorStop(0, "#f2f5fa");
      rg2.addColorStop(1, "#7a8494");
      g.fillStyle = rg2;
      g.beginPath();
      g.arc(0, 0, 22, 0, 7);
      g.fill();
      g.strokeStyle = "#2a2f3a";
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = mix(rar, "#ffffff", 0.2);
      g.beginPath();
      g.arc(0, 0, 13, 0, 7);
      g.fill();
      g.strokeStyle = "rgba(0,0,0,.25)";
      g.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(0, 0, 6 + i * 3, 0, 7);
        g.stroke();
      }
      const ra = v.holding ? time * 16 : -time * (v.tension < v.lo ? 1 : 4);
      g.strokeStyle = "#2a2f3a";
      g.lineWidth = 4;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(ra) * 20, Math.sin(ra) * 20);
      g.stroke();
      g.fillStyle = "#c8343e";
      g.beginPath();
      g.arc(Math.cos(ra) * 20, Math.sin(ra) * 20, 5, 0, 7);
      g.fill();
      g.fillStyle = "#4a5060";
      g.beginPath();
      g.arc(0, 0, 4, 0, 7);
      g.fill();
      g.restore();

      // Night grading and a soft vignette over the scene.
      if (night > 0.05) {
        g.fillStyle = `rgba(10,20,60,${night * 0.25})`;
        g.fillRect(-4, -4, w + 8, h + 8);
      }
      const vg = g.createRadialGradient(
        w / 2,
        h * 0.55,
        h * 0.4,
        w / 2,
        h * 0.55,
        h * 1.05,
      );
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(5,10,25,.4)");
      g.fillStyle = vg;
      g.fillRect(-4, -4, w + 8, h + 8);
      g.restore();

      // ---- the gauge (always at full strength over the fade) ----
      if (k < 0.6) return;
      const { gx, gy0, gy1 } = room,
        gw = 18,
        yAt = (u: number) => gy1 - (gy1 - gy0) * u;
      g.fillStyle = "rgba(11,16,32,.78)";
      g.beginPath();
      g.roundRect(gx - gw / 2 - 4, gy0 - 4, gw + 8, gy1 - gy0 + 8, 12);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.12)";
      g.beginPath();
      g.roundRect(gx - gw / 2, gy0, gw, gy1 - gy0, 9);
      g.fill();
      // Everything in the gauge stays inside its rounded ends (the red top
      // was a square poking out of the curve).
      g.save();
      g.clip();
      const band = g.createLinearGradient(0, yAt(v.hi), 0, yAt(v.lo));
      band.addColorStop(0, "#5fe08a");
      band.addColorStop(1, "#2fae5c");
      g.fillStyle = band;
      g.fillRect(gx - gw / 2, yAt(v.hi), gw, yAt(v.lo) - yAt(v.hi));
      g.fillStyle =
        v.strain > 0 && Math.sin(time * 30) > 0 ? "#ff5a5a" : "#c8343e";
      g.fillRect(gx - gw / 2, gy0, gw, yAt(0.93) - gy0);
      g.fillStyle = "rgba(255,255,255,.25)";
      for (let i = 1; i < 10; i++)
        g.fillRect(gx + gw / 2 - 5, yAt(i / 10), 5, 1);
      const ny = yAt(v.tension);
      g.fillStyle = "#fff";
      g.fillRect(gx - gw / 2, ny - 1.5, gw, 3);
      g.restore();
      // The needle's pointer, outside the gauge on its left.
      g.fillStyle = "#fff";
      g.strokeStyle = "#0b1020";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(gx - gw / 2 - 10, ny - 7);
      g.lineTo(gx - gw / 2 + 2, ny);
      g.lineTo(gx - gw / 2 - 10, ny + 7);
      g.closePath();
      g.fill();
      g.stroke();
      // How close the fish is: a thin bar beside the gauge, filling up in
      // its rarity's colour, a little fish riding its top.
      const px = gx + gw / 2 + 10;
      g.fillStyle = "rgba(11,16,32,.78)";
      g.beginPath();
      g.roundRect(px - 2, gy0 - 4, 12, gy1 - gy0 + 8, 6);
      g.fill();
      g.fillStyle = rar;
      const ph = (gy1 - gy0) * v.progress;
      g.beginPath();
      g.roundRect(px, gy1 - ph, 8, ph, 4);
      g.fill();
      g.save();
      g.translate(px + 4, gy1 - ph);
      g.scale(0.16, 0.16);
      g.rotate(-Math.PI / 2);
      g.fillStyle = "#fff";
      fishPath(g, Math.sin(time * 10) * 0.3);
      g.fill();
      g.restore();
    },
    /** Spray, rings and timing start fresh with the next fight. */
    reset() {
      spray.length = 0;
      rings.length = 0;
      bubbles.length = 0;
      wasThrash = false;
    },
  };
}
