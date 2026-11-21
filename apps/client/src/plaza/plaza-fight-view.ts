/**
 * The close-up while a hooked fish fights (plaza-fishing.ts, phase "fight"):
 * the pond from over the angler's shoulder. The far bank at the top, the
 * water running toward you, the fish under it coming nearer as it is reeled
 * in and breaking the surface when it thrashes, the line from the rod in
 * front of you, and the tension gauge with its green band.
 *
 * It replaces the Plaza's drawing while it is up (the scene paints this
 * instead of the world, so an old phone pays for one scene, not two). The
 * still parts (bank, water, lily pads) are painted once per screen size;
 * a frame adds a few dozen strokes. Low graphics drops the ripples and the
 * spray.
 *
 * The fish stays a shadow in its rarity's colour: which fish it is, the
 * server says only once it is landed.
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

export function createFightView() {
  let still: HTMLCanvasElement | null = null,
    sw = 0,
    sh = 0,
    sr = 0;
  /** Spray thrown up by a thrash: [x, y, vx, vy, life]. */
  const spray: number[][] = [];
  let wasThrash = false,
    last = 0;

  /** The bank, the water and its lily pads, once per size. */
  function paintStill(w: number, h: number, ratio: number) {
    const c = still ?? document.createElement("canvas");
    c.width = Math.ceil(w * ratio);
    c.height = Math.ceil(h * ratio);
    const g = c.getContext("2d")!;
    g.scale(ratio, ratio);
    const hz = h * 0.24;
    // The far bank: grass, a row of round trees, reeds at the water.
    const bank = g.createLinearGradient(0, 0, 0, hz);
    bank.addColorStop(0, "#7cc95a");
    bank.addColorStop(1, "#4f9a3c");
    g.fillStyle = bank;
    g.fillRect(0, 0, w, hz + 2);
    for (let i = 0; i < 14; i++) {
      const x = (i / 13) * w + Math.sin(i * 2.3) * 20,
        r = 26 + ((i * 37) % 18);
      g.fillStyle = i % 3 ? "#3f8a3a" : "#357a32";
      g.beginPath();
      g.arc(x, hz * 0.55 - (i % 2) * 8, r, 0, 7);
      g.fill();
      g.fillStyle = "#4fa043";
      g.beginPath();
      g.arc(x - r * 0.3, hz * 0.45 - (i % 2) * 8, r * 0.55, 0, 7);
      g.fill();
    }
    g.strokeStyle = "#2f6f2a";
    g.lineWidth = 2;
    for (let i = 0; i < 60; i++) {
      const x = (i / 59) * w + Math.sin(i * 7.1) * 6,
        hh = 8 + ((i * 13) % 10);
      g.beginPath();
      g.moveTo(x, hz + 2);
      g.lineTo(x + Math.sin(i) * 3, hz + 2 - hh);
      g.stroke();
    }
    // The water: deep far away, light near you; a soft band of sky on it.
    const water = g.createLinearGradient(0, hz, 0, h);
    water.addColorStop(0, "#1f6fa8");
    water.addColorStop(0.35, "#2f92c8");
    water.addColorStop(1, "#6fd0ee");
    g.fillStyle = water;
    g.fillRect(0, hz, w, h - hz);
    g.fillStyle = "rgba(255,255,255,.12)";
    g.fillRect(0, hz, w, 6);
    // Lily pads, smaller far away.
    for (const [px, py, s] of [
      [0.12, 0.38, 0.5],
      [0.85, 0.33, 0.45],
      [0.07, 0.8, 1.1],
      [0.92, 0.72, 0.9],
    ] as const) {
      const x = px * w,
        y = py * h,
        r = 34 * s;
      g.fillStyle = "#3fae5c";
      g.beginPath();
      g.ellipse(x, y, r, r * 0.38, 0, 0.35, Math.PI * 2 - 0.05);
      g.lineTo(x, y);
      g.fill();
      if (s > 0.8) {
        g.fillStyle = "#ff8fb8";
        g.beginPath();
        g.arc(x + r * 0.2, y - r * 0.12, 6 * s, 0, 7);
        g.fill();
      }
    }
    still = c;
    sw = w;
    sh = h;
    sr = ratio;
  }

  /** The fish's place on the water for its progress (far to near). */
  function fishAt(v: FightView, w: number, h: number, time: number) {
    const hz = h * 0.24,
      k = v.progress,
      y = hz + (h - hz) * (0.12 + 0.6 * k),
      x =
        w * 0.4 +
        Math.sin(time * 1.3) * w * (0.18 - k * 0.07) +
        (v.thrash ? Math.sin(time * 28) * 10 : 0);
    return { x, y, s: 0.6 + k * 1.0 };
  }

  return {
    /**
     * One frame. `k` (0..1) is how far in it has come (it zooms and fades in
     * over the world); `room` places the gauge beside the HUD's button.
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
      /** The scene's pixels per CSS pixel (the still parts match it). */
      ratio: number,
    ) {
      if (!still || sw !== w || sh !== h || sr !== ratio)
        paintStill(w, h, ratio);
      const dt = Math.min(0.05, Math.max(0, time - last));
      last = time;
      g.save();
      if (k < 1) {
        g.globalAlpha = k;
        const z = 1.15 - 0.15 * k;
        g.translate(w / 2, h / 2);
        g.scale(z, z);
        g.translate(-w / 2, -h / 2);
      }
      // The whole view jolts a little while the fish thrashes.
      if (v.thrash && !low)
        g.translate(Math.sin(time * 61) * 2.5, Math.cos(time * 47) * 2);
      g.drawImage(still!, -4, -4, w + 8, h + 8);
      const hz = h * 0.24,
        rar = PLAZA_FISH_RARITY[v.rarity].color;
      // Ripples running toward you: short strokes, wider and further
      // apart near you.
      if (!low) {
        g.strokeStyle = "rgba(255,255,255,.28)";
        g.lineWidth = 1.5;
        g.beginPath();
        for (let row = 0; row < 9; row++) {
          const d = (row + ((time * 0.35) % 1)) / 9,
            y = hz + (h - hz) * d * d,
            len = 10 + d * 50;
          for (let i = 0; i < 5; i++) {
            const x =
              ((i * 0.23 + row * 0.37 + Math.sin(row) * 0.1) % 1) * w +
              Math.sin(time + row + i) * 8;
            g.moveTo(x - len / 2, y);
            g.lineTo(x + len / 2, y);
          }
        }
        g.stroke();
      }
      // The fish: a shadow under the water in its rarity's colour; on a
      // thrash it breaks the surface, tail out, spray flying.
      const f = fishAt(v, w, h, time),
        s = f.s;
      g.save();
      g.translate(f.x, f.y);
      g.scale(s, s);
      const wag = Math.sin(time * (v.thrash ? 30 : 8)) * (v.thrash ? 0.5 : 0.2);
      g.fillStyle = v.thrash ? rar : "rgba(12,40,70,.55)";
      g.globalAlpha *= v.thrash ? 0.95 : 1;
      g.beginPath();
      g.ellipse(0, 0, 46, 17, 0, 0, 7);
      g.fill();
      g.save();
      g.translate(-40, 0);
      g.rotate(wag);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(-26, -16);
      g.lineTo(-20, 0);
      g.lineTo(-26, 16);
      g.closePath();
      g.fill();
      g.restore();
      if (v.thrash) {
        g.fillStyle = "rgba(255,255,255,.55)";
        g.beginPath();
        g.ellipse(8, -6, 22, 4, 0, 0, 7);
        g.fill();
        g.fillStyle = "#0b1020";
        g.beginPath();
        g.arc(30, -3, 3.5, 0, 7);
        g.fill();
      }
      g.restore();
      // A ring where it breaks the water, and spray (not on Low).
      if (v.thrash) {
        g.strokeStyle = "rgba(255,255,255,.75)";
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(f.x, f.y + 14 * s, 70 * s, 16 * s, 0, 0, 7);
        g.stroke();
      }
      if (!low) {
        if (v.thrash && !wasThrash)
          for (let i = 0; i < 14; i++) {
            const a = Math.PI * (0.1 + Math.random() * 0.8);
            spray.push([
              f.x + (Math.random() - 0.5) * 60 * s,
              f.y,
              -Math.cos(a) * (60 + Math.random() * 120) * s,
              -Math.sin(a) * (120 + Math.random() * 160) * s,
              0.7,
            ]);
          }
        g.fillStyle = "rgba(230,250,255,.9)";
        for (let i = spray.length - 1; i >= 0; i--) {
          const p = spray[i];
          p[0] += p[2] * dt;
          p[1] += p[3] * dt;
          p[3] += 520 * dt;
          p[4] -= dt;
          if (p[4] <= 0) {
            spray.splice(i, 1);
            continue;
          }
          g.beginPath();
          g.arc(p[0], p[1], 3 * s, 0, 7);
          g.fill();
        }
      }
      wasThrash = v.thrash;
      // The rod in front of you, from the bottom corner, bending with the
      // tension; the line from its tip to the fish.
      const bx = w * 0.9,
        by = h + 40,
        bend = v.tension,
        tx = w * (0.64 + bend * 0.03),
        ty = h * (0.3 + bend * 0.18),
        cx = w * 0.76,
        cy = h * (0.55 - bend * 0.05) + bend * 30;
      const hot = v.strain > 0 || v.tension >= 0.93;
      g.strokeStyle = hot
        ? "rgba(255,120,110,.95)"
        : v.tension < v.lo
          ? "rgba(255,255,255,.55)"
          : "rgba(255,255,255,.9)";
      g.lineWidth = hot ? 2.2 : 1.5;
      g.beginPath();
      g.moveTo(tx, ty);
      if (v.tension < v.lo)
        g.quadraticCurveTo((tx + f.x) / 2, Math.max(ty, f.y) + 40, f.x, f.y);
      else g.lineTo(f.x + 30 * s, f.y - 4 * s);
      g.stroke();
      g.lineCap = "round";
      g.strokeStyle = "#3a2414";
      g.lineWidth = 12;
      g.beginPath();
      g.moveTo(bx, by);
      g.quadraticCurveTo(cx, cy, tx, ty);
      g.stroke();
      g.strokeStyle = "#8a5a32";
      g.lineWidth = 7;
      g.stroke();
      g.strokeStyle = "#c48a4a";
      g.lineWidth = 2;
      g.stroke();
      // The reel on the handle, part way up the rod.
      const u = 0.42,
        rx = (1 - u) ** 2 * bx + 2 * u * (1 - u) * cx + u * u * tx,
        ry = (1 - u) ** 2 * by + 2 * u * (1 - u) * cy + u * u * ty;
      g.fillStyle = "#2a2f3a";
      g.beginPath();
      g.arc(rx, ry, 22, 0, 7);
      g.fill();
      g.fillStyle = "#cfd6e0";
      g.beginPath();
      g.arc(rx, ry, 15, 0, 7);
      g.fill();
      g.strokeStyle = "#2a2f3a";
      g.lineWidth = 4;
      const ra = v.holding ? time * 14 : time * 2;
      g.beginPath();
      g.moveTo(rx, ry);
      g.lineTo(rx + Math.cos(ra) * 13, ry + Math.sin(ra) * 13);
      g.stroke();
      g.restore();

      // The gauge (always at full strength over the fade).
      if (k < 0.6) return;
      // (On the left, over Leave: the right has the rod and Hold.)
      const { gx, gy0, gy1 } = room,
        gw = 18,
        at = (u: number) => gy1 - (gy1 - gy0) * u;
      g.fillStyle = "rgba(11,16,32,.75)";
      g.beginPath();
      g.roundRect(gx - gw / 2 - 4, gy0 - 4, gw + 8, gy1 - gy0 + 8, 12);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.12)";
      g.beginPath();
      g.roundRect(gx - gw / 2, gy0, gw, gy1 - gy0, 9);
      g.fill();
      g.fillStyle = "#3fd07a";
      g.fillRect(gx - gw / 2, at(v.hi), gw, at(v.lo) - at(v.hi));
      g.fillStyle =
        v.strain > 0 && Math.sin(time * 30) > 0 ? "#ff5a5a" : "#c8343e";
      g.fillRect(gx - gw / 2, gy0, gw, at(0.93) - gy0);
      // The needle.
      const ny = at(v.tension);
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
      g.fillRect(gx - gw / 2, ny - 1.5, gw, 3);
      // How close the fish is: a thin bar beside the gauge, filling up in
      // its rarity's colour.
      const px = gx + gw / 2 + 10;
      g.fillStyle = "rgba(11,16,32,.75)";
      g.beginPath();
      g.roundRect(px - 2, gy0 - 4, 12, gy1 - gy0 + 8, 6);
      g.fill();
      g.fillStyle = rar;
      const ph = (gy1 - gy0) * v.progress;
      g.beginPath();
      g.roundRect(px, gy1 - ph, 8, ph, 4);
      g.fill();
    },
    /** Spray and timing start fresh with the next fight. */
    reset() {
      spray.length = 0;
      wasThrash = false;
    },
  };
}
