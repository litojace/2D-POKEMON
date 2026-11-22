// @ts-nocheck
/*
 * Props of the Plaza baked once into sprites (they were drawn every frame,
 * with gradients made each time): the south gate's flower arch.
 * Light from the top left, as everywhere on the Plaza.
 */
import { GFX } from "../hub-art/gfx";

const { sprite, memo, ball, rnd, srand, mix, rgba } = GFX;

/**
 * The flower arch over the south gate: two wooden posts (grain, a lit left
 * edge, a cap) and a hoop of leafy vine, flowers in clusters along it.
 * Anchored at the gate's middle on the ground; posts at ±span.
 */
export function flowerArch(span = 70, rise = 112, white = false) {
  return memo(`flower-arch:${span}:${rise}:${white}`, () =>
    sprite(span * 2 + 70, rise + span + 60, span + 35, rise + span + 40, (g) => {
      srand(77);
      for (const px of [-span, span]) {
        // The post's shadow, its wood, grain, lit edge and cap.
        g.fillStyle = "rgba(30,40,20,.25)";
        g.beginPath();
        g.ellipse(px + 6, 2, 14, 5, 0, 0, 7);
        g.fill();
        const gg = g.createLinearGradient(px - 9, 0, px + 9, 0);
        if (white) {
          // A painted white post (the Photo Spot's).
          gg.addColorStop(0, "#ffffff");
          gg.addColorStop(0.35, "#f6f1e6");
          gg.addColorStop(1, "#bdb3a0");
        } else {
          gg.addColorStop(0, "#d79a58");
          gg.addColorStop(0.35, "#c48a4a");
          gg.addColorStop(1, "#6e4626");
        }
        g.fillStyle = gg;
        g.beginPath();
        g.roundRect(px - 9, -rise - 4, 18, rise + 8, 4);
        g.fill();
        g.strokeStyle = white ? "rgba(150,140,120,.3)" : "rgba(90,55,25,.45)";
        g.lineWidth = 0.9;
        for (let k = 0; k < 4; k++) {
          const gx = px - 5 + k * 3.4;
          g.beginPath();
          g.moveTo(gx, -rise + 2);
          g.bezierCurveTo(gx + 1.5, -rise * 0.6, gx - 1.5, -rise * 0.3, gx + 0.5, 0);
          g.stroke();
        }
        g.fillStyle = "rgba(255,230,190,.45)";
        g.fillRect(px - 8, -rise, 2, rise);
        g.fillStyle = white ? "#d8cfbd" : "#8a5a30";
        g.beginPath();
        g.roundRect(px - 12, -rise - 10, 24, 8, 3);
        g.fill();
        g.fillStyle = "rgba(255,230,190,.5)";
        g.fillRect(px - 10, -rise - 9, 18, 1.5);
        // Vine climbing the post.
        g.strokeStyle = "#3f8f3a";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(px, 0);
        for (let y = 0; y > -rise; y -= 8) g.lineTo(px + Math.sin(y * 0.2) * 7, y);
        g.stroke();
        for (let y = -6; y > -rise; y -= 7) {
          const lx = px + Math.sin(y * 0.2) * 7;
          g.fillStyle = y % 2 ? "#4faa44" : "#6fcf5a";
          g.beginPath();
          g.ellipse(lx + (rnd() - 0.5) * 8, y, 4, 2.6, rnd() * 3, 0, 7);
          g.fill();
        }
      }
      // The hoop: a dark under-layer, then leaves in two greens over it,
      // lit on the outer upper side and shaded on the inner.
      const cy = -rise;
      g.strokeStyle = "#2f7a32";
      g.lineWidth = 22;
      g.beginPath();
      g.arc(0, cy, span, Math.PI, 0);
      g.stroke();
      for (let i = 0; i < 150; i++) {
        const a = Math.PI + rnd() * Math.PI,
          r = span + (rnd() - 0.5) * 20,
          x = Math.cos(a) * r,
          y = cy + Math.sin(a) * r,
          outer = r > span;
        g.fillStyle = outer
          ? rnd() < 0.5
            ? "#7ad962"
            : "#5fbf4f"
          : rnd() < 0.5
            ? "#3f9a3e"
            : "#4faa44";
        g.beginPath();
        g.ellipse(x, y, 5, 3.2, a + Math.PI / 2 + (rnd() - 0.5), 0, 7);
        g.fill();
      }
      // Flowers in clusters along it: five-petalled heads, a gold eye.
      const COLS = ["#ff8fb8", "#ffd65b", "#ffffff", "#c9a3ff"];
      for (let c = 0; c < 14; c++) {
        const a0 = Math.PI + ((c + 0.5) / 14) * Math.PI,
          col = COLS[c % COLS.length];
        for (let k = 0; k < 3; k++) {
          const a = a0 + (rnd() - 0.5) * 0.14,
            r = span + (rnd() - 0.5) * 14,
            x = Math.cos(a) * r,
            y = cy + Math.sin(a) * r;
          g.fillStyle = rgba(mix(col, "#000000", 0.25), 0.5);
          g.beginPath();
          g.arc(x + 1, y + 1.5, 4.6, 0, 7);
          g.fill();
          for (let p = 0; p < 5; p++) {
            const pa = (p / 5) * Math.PI * 2;
            g.fillStyle = col;
            g.beginPath();
            g.arc(x + Math.cos(pa) * 2.6, y + Math.sin(pa) * 2.6, 2.4, 0, 7);
            g.fill();
          }
          ball(g, x, y, 1.7, "#ffb21a", 0.6);
        }
      }
    }),
  );
}

/**
 * A sign's words in outlined letters, baked (they were drawn with a font
 * every frame). The key carries the fonts' status, so the words are
 * painted again once the font has loaded.
 */
export function signWords(text, size = 22) {
  const fonts = typeof document !== "undefined" ? document.fonts?.status : "";
  return memo(`sign-words:${text}:${size}:${fonts}`, () =>
    sprite(text.length * size * 0.62 + 20, size + 14, (text.length * size * 0.62 + 20) / 2, size + 4, (g) => {
      g.textAlign = "center";
      g.font = `800 ${size}px 'Barlow Condensed', sans-serif`;
      g.fillStyle = "#fff";
      g.strokeStyle = "#2a1f4c";
      g.lineWidth = 4;
      g.lineJoin = "round";
      g.strokeText(text, 0, 0);
      g.fillText(text, 0, 0);
    }),
  );
}
