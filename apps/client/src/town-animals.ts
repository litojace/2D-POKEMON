import type { Ctx, Sprite } from "./town-art";

/**
 * The town's animals, painted as shaded pictures in a few animation frames
 * each (town-life swaps frames and flips them to face the way they move).
 * All face right and are anchored where they touch the ground (or, for
 * fliers, at the body's centre). Light comes from the upper left.
 */

const ellipse = (ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) => {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
};
const radial = (ctx: Ctx, x: number, y: number, r: number, stops: string[]) => {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
};
const stroke = (ctx: Ctx, color: string, w: number, pts: number[], close = false) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (close) ctx.closePath();
  ctx.stroke();
};
/** A two-segment leg from hip (x, y) swung by `a` radians, knee bending `bend`. */
function leg(ctx: Ctx, x: number, y: number, len: number, a: number, bend: number, color: string, w: number) {
  const kx = x + Math.sin(a) * len * 0.5,
    ky = y + Math.cos(a) * len * 0.5,
    fx = kx + Math.sin(a + bend) * len * 0.5,
    fy = ky + Math.cos(a + bend) * len * 0.5;
  stroke(ctx, color, w, [x, y, kx, ky, fx, fy]);
  return [fx, fy];
}

// ───────────────────────────── Dog ─────────────────────────────

export type DogPose = "walk" | "sniff" | "sit";
export const DOG_FRAMES = { walk: 6, sniff: 2, sit: 1 } as const;
const DOG = { coat: ["#e0a868", "#c48446", "#8f5a2c"], dark: "#6a4022", belly: "#f2d2a2", collar: "#d8423a" };

/** A medium tan dog in profile. Foot line at y = 40. */
export function dogSprite(pose: DogPose, frame: number): Sprite {
  return {
    w: 64,
    h: 46,
    ax: 30,
    ay: 42,
    draw(ctx) {
      const foot = 42,
        phase = (frame / DOG_FRAMES.walk) * Math.PI * 2;
      const sit = pose === "sit",
        sniff = pose === "sniff";
      const bob = pose === "walk" ? Math.abs(Math.sin(phase)) * -1.2 : 0;
      const by = foot - 15 + bob;
      // Tail: up and curved; wags between frames.
      const wag = pose === "walk" ? Math.sin(phase) * 0.25 : sniff ? (frame ? 0.45 : -0.2) : 0.1;
      ctx.save();
      ctx.translate(sit ? 15 : 12, sit ? foot - 6 : by - 3);
      ctx.rotate(-0.9 + wag);
      ctx.fillStyle = DOG.coat[1];
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.quadraticCurveTo(-4, -12, -2, -17);
      ctx.quadraticCurveTo(2, -12, 3, -1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Far legs (darker), then body, then near legs.
      const legs = (near: boolean) => {
        const c = near ? DOG.coat[1] : DOG.dark;
        if (sit) {
          if (!near) return;
          stroke(ctx, c, 4.2, [40, by + 4, 41, foot]);
          stroke(ctx, c, 4.2, [36, by + 4, 36, foot]);
          ctx.fillStyle = DOG.coat[1];
          ellipse(ctx, 20, foot - 4, 9, 5);
          ctx.fill();
          return;
        }
        const s = pose === "walk" ? Math.sin(phase + (near ? 0 : Math.PI)) * 0.45 : near ? 0.08 : -0.08;
        const [fx, fy] = leg(ctx, 39, by + 3, 15, -s * 0.85, s > 0 ? 0.25 : 0, c, 4.4);
        const [bx, bY] = leg(ctx, 17, by + 3, 15, s * 0.85, s < 0 ? -0.25 : 0.12, c, 4.8);
        ctx.fillStyle = c;
        ellipse(ctx, fx + 1.5, fy - 0.5, 3, 1.6);
        ctx.fill();
        ellipse(ctx, bx + 1.5, bY - 0.5, 3, 1.6);
        ctx.fill();
      };
      legs(false);
      // Body.
      ctx.fillStyle = radial(ctx, 28, by - 2, 20, DOG.coat);
      if (sit) {
        ctx.beginPath();
        ctx.moveTo(14, foot - 2);
        ctx.quadraticCurveTo(12, by - 6, 30, by - 10);
        ctx.quadraticCurveTo(44, by - 10, 44, by + 4);
        ctx.quadraticCurveTo(40, foot, 26, foot - 1);
        ctx.closePath();
      } else ellipse(ctx, 28, by, 16, 8.5);
      ctx.fill();
      ctx.fillStyle = DOG.belly;
      if (!sit) {
        ellipse(ctx, 32, by + 4.5, 10, 3.2);
        ctx.fill();
      }
      legs(true);
      // Head: lower and forward when sniffing.
      const hx = sit ? 44 : sniff ? 48 : 46,
        hy = sit ? by - 14 : sniff ? by + 6 + (frame ? 1.5 : 0) : by - 9;
      // Neck.
      ctx.fillStyle = DOG.coat[1];
      ctx.beginPath();
      ctx.moveTo(38, by - 5);
      ctx.lineTo(hx - 2, hy - 4);
      ctx.lineTo(hx + 2, hy + 4);
      ctx.lineTo(40, by + 4);
      ctx.closePath();
      ctx.fill();
      // Collar with a tag.
      stroke(ctx, DOG.collar, 3, [(38 + hx) / 2 - 2, (by - 5 + hy - 4) / 2, (40 + hx) / 2 + 1, (by + 4 + hy + 4) / 2]);
      ctx.fillStyle = "#ffd65b";
      ellipse(ctx, (40 + hx) / 2 + 1, (by + 4 + hy + 4) / 2 + 2, 1.6, 1.6);
      ctx.fill();
      ctx.fillStyle = radial(ctx, hx, hy, 8, DOG.coat);
      ellipse(ctx, hx, hy, 7.5, 6.5);
      ctx.fill();
      // Snout, nose.
      ctx.fillStyle = DOG.belly;
      ellipse(ctx, hx + 7, hy + 2, 5, 3.4, sniff ? 0.35 : 0);
      ctx.fill();
      ctx.fillStyle = "#2a1a10";
      ellipse(ctx, hx + 11.5, hy + (sniff ? 3.6 : 1.4), 1.9, 1.5);
      ctx.fill();
      // Floppy ear and eye.
      ctx.fillStyle = DOG.dark;
      ctx.beginPath();
      ctx.moveTo(hx - 3, hy - 5);
      ctx.quadraticCurveTo(hx - 8, hy - 2, hx - 5, hy + 6);
      ctx.quadraticCurveTo(hx - 1, hy + 2, hx, hy - 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#1a120a";
      ellipse(ctx, hx + 3.5, hy - 1.5, 1.4, 1.5);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ellipse(ctx, hx + 3.9, hy - 2, 0.5, 0.5);
      ctx.fill();
    },
  };
}

// ─────────────────────────── Chicken ───────────────────────────

export type HenPose = "walk" | "peck";
export const HEN_FRAMES = { walk: 4, peck: 2 } as const;
export const HEN_COLORS = {
  white: ["#ffffff", "#f2ead8", "#cfc2a4"],
  brown: ["#e8a464", "#b8683a", "#7a3e1e"],
} as const;

/** A hen in profile. Feet at y = 30. */
export function henSprite(coat: keyof typeof HEN_COLORS, pose: HenPose, frame: number): Sprite {
  const c = HEN_COLORS[coat];
  return {
    w: 36,
    h: 34,
    ax: 16,
    ay: 31,
    draw(ctx) {
      const foot = 31,
        phase = (frame / HEN_FRAMES.walk) * Math.PI * 2,
        peck = pose === "peck",
        bob = pose === "walk" ? -Math.abs(Math.sin(phase)) * 1.2 : 0,
        by = foot - 11 + bob;
      // Legs.
      const step = pose === "walk" ? Math.sin(phase) * 0.5 : 0;
      for (const [k, s] of [[0, step], [1, -step]] as const) {
        const [fx, fy] = leg(ctx, 15 + k * 3, by + 5, 8, s, 0, "#e8a030", 1.6);
        stroke(ctx, "#e8a030", 1.2, [fx - 2, fy, fx + 3, fy]);
      }
      // Tail feathers, up and back.
      ctx.fillStyle = c[2];
      ctx.beginPath();
      ctx.moveTo(9, by - 1);
      ctx.quadraticCurveTo(2, by - 12, 5, by - 14);
      ctx.quadraticCurveTo(9, by - 9, 13, by - 4);
      ctx.closePath();
      ctx.fill();
      // Body: a plump teardrop.
      ctx.fillStyle = radial(ctx, 16, by, 11, c as unknown as string[]);
      ctx.beginPath();
      ctx.moveTo(7, by - 4);
      ctx.quadraticCurveTo(8, by + 7, 18, by + 7);
      ctx.quadraticCurveTo(26, by + 6, 25, by - 3);
      ctx.quadraticCurveTo(20, by - 8, 7, by - 4);
      ctx.fill();
      // Wing with feather lines.
      ctx.fillStyle = c[1];
      ellipse(ctx, 15, by + 0.5, 6.5, 4, -0.2);
      ctx.fill();
      stroke(ctx, c[2], 0.8, [11, by + 1, 19, by - 1]);
      stroke(ctx, c[2], 0.8, [11, by + 3, 19, by + 1.5]);
      // Neck and head.
      const hx = peck ? 28 + frame : 25,
        hy = peck ? by + 4 + frame * 2 : by - 9;
      ctx.fillStyle = c[0];
      ctx.beginPath();
      ctx.moveTo(21, by - 4);
      ctx.lineTo(hx - 2, hy - 2);
      ctx.lineTo(hx + 2, hy + 3);
      ctx.lineTo(24, by + 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = radial(ctx, hx, hy, 4.5, c as unknown as string[]);
      ellipse(ctx, hx, hy, 4.2, 4);
      ctx.fill();
      // Comb, wattle, beak, eye.
      ctx.fillStyle = "#e0402e";
      for (let k = 0; k < 3; k++) {
        ellipse(ctx, hx - 2 + k * 2, hy - 4 - (k === 1 ? 1 : 0), 1.5, 2);
        ctx.fill();
      }
      ellipse(ctx, hx + 2.5, hy + 4, 1.4, 2);
      ctx.fill();
      ctx.fillStyle = "#f2a628";
      ctx.beginPath();
      ctx.moveTo(hx + 3.5, hy - 0.5);
      ctx.lineTo(hx + 7.5, hy + 1);
      ctx.lineTo(hx + 3.5, hy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#1a1a1a";
      ellipse(ctx, hx + 1.2, hy - 0.8, 0.9, 0.9);
      ctx.fill();
    },
  };
}

// ──────────────────────────── Duck ─────────────────────────────

export type DuckPose = "swim" | "dabble";

/** A mallard drake floating; waterline at y = 22. */
export function duckSprite(pose: DuckPose, female = false): Sprite {
  return {
    w: 40,
    h: 30,
    ax: 18,
    ay: 24,
    draw(ctx) {
      const wl = 24;
      const body = female ? ["#c8a070", "#9a7046", "#6a4a2a"] : ["#e8e4dc", "#b8b4ac", "#7d7a74"];
      if (pose === "dabble") {
        // Head under water, tail up.
        ctx.fillStyle = radial(ctx, 18, wl - 6, 12, body);
        ctx.beginPath();
        ctx.moveTo(26, wl);
        ctx.quadraticCurveTo(22, wl - 10, 12, wl - 16);
        ctx.quadraticCurveTo(8, wl - 12, 10, wl - 4);
        ctx.quadraticCurveTo(14, wl, 26, wl);
        ctx.fill();
        ctx.fillStyle = female ? "#5a3a1e" : "#2a2a2a";
        ellipse(ctx, 11.5, wl - 16, 3, 2.4, -0.6);
        ctx.fill();
        ctx.fillStyle = "#e8a030";
        ellipse(ctx, 15, wl - 13, 2.4, 1.2, -0.8);
        ctx.fill();
        return;
      }
      // Body sitting in the water.
      ctx.fillStyle = radial(ctx, 18, wl - 4, 14, body);
      ctx.beginPath();
      ctx.moveTo(4, wl - 6);
      ctx.quadraticCurveTo(10, wl - 11, 22, wl - 9);
      ctx.quadraticCurveTo(31, wl - 8, 30, wl);
      ctx.lineTo(7, wl);
      ctx.quadraticCurveTo(3, wl - 2, 4, wl - 6);
      ctx.fill();
      if (!female) {
        // Chestnut breast, dark tail with a curl.
        ctx.fillStyle = "#8a4a2a";
        ellipse(ctx, 27, wl - 4, 4.5, 4.5);
        ctx.fill();
        ctx.fillStyle = "#2a2a2a";
        ctx.beginPath();
        ctx.moveTo(3, wl - 5);
        ctx.lineTo(8, wl - 8);
        ctx.lineTo(9, wl - 3);
        ctx.closePath();
        ctx.fill();
        stroke(ctx, "#2a2a2a", 1.2, [6, wl - 8, 5, wl - 11, 7, wl - 12]);
      }
      // Wing with a blue speculum.
      ctx.fillStyle = female ? "#8a6038" : "#9a968e";
      ellipse(ctx, 15, wl - 6, 8, 3.4, -0.1);
      ctx.fill();
      ctx.fillStyle = "#3a5ad8";
      ctx.fillRect(9, wl - 6, 5, 1.6);
      // Head and neck.
      ctx.fillStyle = female ? "#a07a50" : "#1f6a3a";
      ctx.beginPath();
      ctx.moveTo(24, wl - 8);
      ctx.quadraticCurveTo(25, wl - 14, 27, wl - 16);
      ctx.lineTo(31, wl - 15);
      ctx.quadraticCurveTo(30, wl - 10, 29, wl - 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = radial(ctx, 29, wl - 17, 5, female ? ["#c09a6a", "#a07a50", "#6a4a2a"] : ["#4ab878", "#1f6a3a", "#0f3a1e"]);
      ellipse(ctx, 29, wl - 17, 4.6, 4.2);
      ctx.fill();
      if (!female) {
        stroke(ctx, "#ffffff", 1.4, [25.5, wl - 11, 30.5, wl - 11]);
      }
      ctx.fillStyle = female ? "#d88a2a" : "#f2c43a";
      ctx.beginPath();
      ctx.moveTo(32.5, wl - 18);
      ctx.quadraticCurveTo(38, wl - 17, 38, wl - 15);
      ctx.lineTo(32.5, wl - 15);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#101010";
      ellipse(ctx, 30, wl - 18, 0.9, 0.9);
      ctx.fill();
      // Wet sheen at the waterline.
      stroke(ctx, "rgba(255,255,255,0.5)", 1, [7, wl - 0.5, 29, wl - 0.5]);
    },
  };
}

// ──────────────────────────── Gull ─────────────────────────────

export const GULL_FRAMES = 4;
/** A gull seen from above in flight, centred; wings beat through 4 frames. */
export function gullSprite(frame: number): Sprite {
  return {
    w: 60,
    h: 30,
    ax: 30,
    ay: 15,
    draw(ctx) {
      const cx = 30,
        cy = 15;
      // Wing tip height and span per frame: up, level, down, level.
      const lift = [-9, 0, 6, 0][frame % 4],
        span = [22, 27, 24, 27][frame % 4];
      for (const s of [-1, 1]) {
        ctx.fillStyle = "#c9ced8";
        ctx.beginPath();
        ctx.moveTo(cx + s * 3, cy - 3);
        ctx.quadraticCurveTo(cx + s * span * 0.5, cy - 4 + lift * 0.6, cx + s * span, cy + lift);
        ctx.quadraticCurveTo(cx + s * span * 0.55, cy + 2 + lift * 0.4, cx + s * 3, cy + 3);
        ctx.closePath();
        ctx.fill();
        // Black tips and a lit leading edge.
        ctx.fillStyle = "#2a2d34";
        ctx.beginPath();
        ctx.moveTo(cx + s * span * 0.78, cy - 2 + lift * 0.8);
        ctx.lineTo(cx + s * span, cy + lift);
        ctx.lineTo(cx + s * span * 0.8, cy + 1.5 + lift * 0.7);
        ctx.closePath();
        ctx.fill();
        stroke(ctx, "rgba(255,255,255,0.8)", 1, [cx + s * 4, cy - 3, cx + s * span * 0.5, cy - 4 + lift * 0.6]);
      }
      // Body, head, tail.
      ctx.fillStyle = radial(ctx, cx, cy, 6, ["#ffffff", "#eef0f4", "#c8ccd4"]);
      ellipse(ctx, cx, cy, 3.6, 8);
      ctx.fill();
      ellipse(ctx, cx, cy - 8, 2.8, 3);
      ctx.fill();
      ctx.fillStyle = "#f2c43a";
      ctx.beginPath();
      ctx.moveTo(cx - 1, cy - 10.5);
      ctx.lineTo(cx, cy - 13.5);
      ctx.lineTo(cx + 1, cy - 10.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e4e7ee";
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy + 6);
      ctx.lineTo(cx + 3, cy + 6);
      ctx.lineTo(cx + 2, cy + 11);
      ctx.lineTo(cx - 2, cy + 11);
      ctx.closePath();
      ctx.fill();
    },
  };
}

// ───────────────────────── Butterfly ───────────────────────────

/** Butterfly wings seen from above (centred); flapping squeezes them sideways. */
export function butterflySprite(color: string, edge: string): Sprite {
  return {
    w: 26,
    h: 22,
    ax: 13,
    ay: 11,
    draw(ctx) {
      const cx = 13,
        cy = 11;
      for (const s of [-1, 1]) {
        // Forewing.
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 1);
        ctx.quadraticCurveTo(cx + s * 4, cy - 10, cx + s * 11, cy - 8);
        ctx.quadraticCurveTo(cx + s * 12, cy - 2, cx + s * 1, cy + 1);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        // Hindwing.
        ctx.beginPath();
        ctx.moveTo(cx, cy + 1);
        ctx.quadraticCurveTo(cx + s * 9, cy + 1, cx + s * 7, cy + 8);
        ctx.quadraticCurveTo(cx + s * 3, cy + 9, cx, cy + 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Spots.
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ellipse(ctx, cx + s * 8.5, cy - 6.5, 1.2, 1.2);
        ctx.fill();
        ctx.fillStyle = edge;
        ellipse(ctx, cx + s * 5, cy + 4.5, 1.3, 1.3);
        ctx.fill();
      }
      // Body and antennae.
      ctx.fillStyle = "#2a2430";
      ellipse(ctx, cx, cy + 1, 1.1, 5);
      ctx.fill();
      stroke(ctx, "#2a2430", 0.7, [cx - 0.5, cy - 4, cx - 3, cy - 8.5]);
      stroke(ctx, "#2a2430", 0.7, [cx + 0.5, cy - 4, cx + 3, cy - 8.5]);
    },
  };
}
