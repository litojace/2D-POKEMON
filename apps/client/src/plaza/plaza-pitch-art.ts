// @ts-nocheck
/*
 * The Orb Ball pitch, painted once into the ground (paintBg), and its
 * scoreboard, baked and painted again only when the score changes.
 *
 * The pitch reads as a small stadium: a surround of darker turf with ad
 * strips painted flat on it (flat, so nothing looks solid where people
 * walk), mown stripes with real contrast, the middle lit and the edges a
 * touch darker, each half tinted faintly in its team's colour (the goals'
 * blue and red), crisp lines with a soft shadow, both boxes and the
 * six-yard boxes, and an emblem in the centre circle.
 *
 * Light from the top left, as everywhere on the Plaza. No dark shadows on
 * the grass (owner, 22 Nov): shade is a deeper green.
 */
import { GFX } from "../hub-art/gfx";

const BLUE = "#5ab0ff",
  RED = "#ff5d6c";

export function paintPitch(g, rnd, P) {
  const W = P.x1 - P.x0,
    H = P.y1 - P.y0,
    cx = (P.x0 + P.x1) / 2,
    cy = (P.y0 + P.y1) / 2,
    my = (P.gy0 + P.gy1) / 2;
  // The surround: a soft edge into the meadow, then darker turf.
  g.fillStyle = "rgba(40,100,50,.28)";
  g.beginPath();
  g.roundRect(P.x0 - 34, P.y0 - 30, W + 68, H + 60, 18);
  g.fill();
  g.fillStyle = "#3f9440";
  g.beginPath();
  g.roundRect(P.x0 - 28, P.y0 - 24, W + 56, H + 48, 16);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,.55)";
  g.lineWidth = 2;
  g.stroke();
  // Ad strips painted flat along both sidelines (between the corners).
  const ADS = [
    ["ORB BALL", "#2a1f4c", "#ffd65b"],
    ["VOLT BOBA", "#ff6f9a", "#ffffff"],
    ["PLAZA CUP", "#1f6b5a", "#b8f0dc"],
    ["DASH", "#ffd65b", "#3a2406"],
  ];
  g.font = "800 13px 'Barlow Condensed', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const [y, flip] of [
    [P.y0 - 13, 0],
    [P.y1 + 13, 1],
  ]) {
    const n = 6,
      aw = (W - 120) / n;
    for (let k = 0; k < n; k++) {
      // (None behind the scoreboard's legs, mid north side.)
      if (!flip && (k === 2 || k === 3)) continue;
      const [t, bg, fg] = ADS[(k + flip * 2) % ADS.length],
        x = P.x0 + 60 + k * aw;
      g.fillStyle = "rgba(20,60,30,.25)";
      g.beginPath();
      g.roundRect(x + 4 + 1, y - 8 + 1.5, aw - 8, 16, 3);
      g.fill();
      g.fillStyle = bg;
      g.beginPath();
      g.roundRect(x + 4, y - 8, aw - 8, 16, 3);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.18)";
      g.fillRect(x + 6, y - 7, aw - 12, 2);
      g.fillStyle = fg;
      g.fillText(t, x + aw / 2, y + 0.5);
    }
  }
  g.textBaseline = "alphabetic";
  // The grass: mown stripes with real contrast.
  g.save();
  g.beginPath();
  g.rect(P.x0, P.y0, W, H);
  g.clip();
  const N = 12;
  for (let i = 0; i < N; i++) {
    g.fillStyle = i % 2 ? "#64c454" : "#49a43f";
    g.fillRect(P.x0 + (i * W) / N, P.y0, W / N + 1, H);
  }
  // Fainter stripes the other way, for the chequer.
  for (let j = 0; j < 10; j += 2) {
    g.fillStyle = "rgba(255,255,255,.05)";
    g.fillRect(P.x0, P.y0 + (j * H) / 10, W, H / 10);
  }
  // Each half faintly in its team's colour.
  g.fillStyle = GFX.rgba(BLUE, 0.07);
  g.fillRect(P.x0, P.y0, W / 2, H);
  g.fillStyle = GFX.rgba(RED, 0.06);
  g.fillRect(cx, P.y0, W / 2, H);
  // Lit in the middle, a deeper green toward the edges.
  const lit = g.createRadialGradient(cx - 40, cy - 30, 40, cx, cy, W * 0.62);
  lit.addColorStop(0, "rgba(230,255,170,.07)");
  lit.addColorStop(0.6, "rgba(230,255,170,0)");
  lit.addColorStop(1, "rgba(40,110,50,.18)");
  g.fillStyle = lit;
  g.fillRect(P.x0, P.y0, W, H);
  // The grain of the blades.
  for (let i = 0; i < 3200; i++) {
    g.fillStyle = rnd() < 0.5 ? "rgba(40,110,40,.2)" : "rgba(210,255,170,.16)";
    g.fillRect(P.x0 + rnd() * W, P.y0 + rnd() * H, 1.2, 3);
  }
  // Worn grass in each goalmouth and on the penalty spots.
  for (const gx of [P.x0 + 30, P.x1 - 30]) {
    const wg = g.createRadialGradient(gx, my, 4, gx, my, 64);
    wg.addColorStop(0, "rgba(180,150,90,.32)");
    wg.addColorStop(1, "rgba(180,150,90,0)");
    g.fillStyle = wg;
    g.fillRect(gx - 64, my - 64, 128, 128);
  }
  g.restore();
  // The lines: a soft shadow, then crisp white.
  const lines = (dx, dy, style, lw) => {
    g.save();
    g.translate(dx, dy);
    g.strokeStyle = style;
    g.fillStyle = style;
    g.lineWidth = lw;
    g.strokeRect(P.x0, P.y0, W, H);
    g.beginPath();
    g.moveTo(cx, P.y0);
    g.lineTo(cx, P.y1);
    g.stroke();
    g.beginPath();
    g.ellipse(cx, cy, 78, 52, 0, 0, 7);
    g.stroke();
    // Penalty boxes and six-yard boxes.
    g.strokeRect(P.x0, P.gy0 - 50, 96, P.gy1 - P.gy0 + 100);
    g.strokeRect(P.x1 - 96, P.gy0 - 50, 96, P.gy1 - P.gy0 + 100);
    g.strokeRect(P.x0, P.gy0 - 14, 36, P.gy1 - P.gy0 + 28);
    g.strokeRect(P.x1 - 36, P.gy0 - 14, 36, P.gy1 - P.gy0 + 28);
    // Arcs at the boxes and at the corners.
    g.lineWidth = lw - 1;
    g.beginPath();
    g.ellipse(P.x0 + 70, my, 54, 36, 0, -1.0, 1.0);
    g.stroke();
    g.beginPath();
    g.ellipse(P.x1 - 70, my, 54, 36, 0, Math.PI - 1.0, Math.PI + 1.0);
    g.stroke();
    for (const [ax, ay, a0] of [
      [P.x0, P.y0, 0],
      [P.x1, P.y0, Math.PI / 2],
      [P.x1, P.y1, Math.PI],
      [P.x0, P.y1, -Math.PI / 2],
    ]) {
      g.beginPath();
      g.ellipse(ax, ay, 14, 10, 0, a0, a0 + Math.PI / 2);
      g.stroke();
    }
    // Spots.
    for (const [sx, sy, r] of [
      [cx, cy, 5],
      [P.x0 + 70, my, 3.5],
      [P.x1 - 70, my, 3.5],
    ]) {
      g.beginPath();
      g.ellipse(sx, sy, r, r * 0.75, 0, 0, 7);
      g.fill();
    }
    g.restore();
  };
  lines(1, 2, "rgba(30,90,40,.3)", 5);
  lines(0, 0, "#f8fff4", 5);
  // The emblem in the centre circle: a ball in a ring of the eight
  // element colours, painted faint into the grass.
  g.save();
  g.translate(cx, cy);
  g.scale(1, 0.66);
  const EL = ["#ffd84a", "#ff7a45", "#4fb3ff", "#7fe7ff", "#fff1a8", "#c47dff", "#c8955a", "#8a6bff"];
  for (let i = 0; i < 8; i++) {
    g.strokeStyle = GFX.rgba(EL[i], 0.4);
    g.lineWidth = 6;
    g.beginPath();
    g.arc(0, 0, 40, (i / 8) * Math.PI * 2 + 0.05, ((i + 1) / 8) * Math.PI * 2 - 0.05);
    g.stroke();
  }
  g.fillStyle = "rgba(255,255,255,.22)";
  g.beginPath();
  g.arc(0, 0, 26, 0, 7);
  g.fill();
  g.fillStyle = "rgba(40,90,50,.22)";
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    g.beginPath();
    g.arc(Math.cos(a) * 15, Math.sin(a) * 15, 5, 0, 7);
    g.fill();
  }
  g.beginPath();
  g.arc(0, 0, 6.5, 0, 7);
  g.fill();
  g.restore();
}

/**
 * The scoreboard over the pitch's north side: a steel frame on two legs,
 * a header lit in gold, a dark panel with the score in the teams' colours
 * and a row of bulbs. Painted again only when the score changes (it was
 * drawn with fonts every frame). Anchored at its feet's middle.
 */
let sbKey = null,
  sbPic = null;
export function scoreboardArt(a, b) {
  const key = `${a}:${b}:${typeof document !== "undefined" ? document.fonts?.status : ""}`;
  if (sbPic && key === sbKey) return sbPic;
  sbKey = key;
  sbPic = GFX.sprite(260, 150, 130, 140, (g) => {
    // Legs.
    for (const lx of [-70, 62]) {
      const lg = g.createLinearGradient(lx, 0, lx + 8, 0);
      lg.addColorStop(0, "#5a6280");
      lg.addColorStop(1, "#262a3a");
      g.fillStyle = lg;
      g.fillRect(lx, -50, 8, 50);
      g.fillStyle = "#1c2030";
      g.beginPath();
      g.roundRect(lx - 5, -4, 18, 5, 2);
      g.fill();
    }
    // Frame and panel.
    const fr = g.createLinearGradient(0, -136, 0, -44);
    fr.addColorStop(0, "#5a6280");
    fr.addColorStop(0.5, "#2f3550");
    fr.addColorStop(1, "#1f2438");
    g.fillStyle = fr;
    g.beginPath();
    g.roundRect(-124, -136, 248, 92, 10);
    g.fill();
    g.fillStyle = "#0b1022";
    g.beginPath();
    g.roundRect(-116, -110, 232, 60, 6);
    g.fill();
    // Gold header.
    const hb = g.createLinearGradient(0, -132, 0, -112);
    hb.addColorStop(0, "#ffe58a");
    hb.addColorStop(1, "#e0a020");
    g.fillStyle = hb;
    g.beginPath();
    g.roundRect(-116, -132, 232, 20, 5);
    g.fill();
    g.fillStyle = "#3a2406";
    g.font = "800 14px 'Barlow Condensed', sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("ORB BALL", 0, -121.5);
    // The score: team panels with a soft glow of their colour.
    for (const [x, c, v] of [
      [-56, BLUE, a],
      [56, RED, b],
    ]) {
      g.fillStyle = GFX.rgba(c, 0.16);
      g.beginPath();
      g.roundRect(x - 40, -104, 80, 48, 5);
      g.fill();
      g.fillStyle = c;
      g.font = "800 40px 'Barlow Condensed', sans-serif";
      g.fillText(String(v), x, -78);
    }
    g.fillStyle = "#ffffff";
    g.font = "800 30px 'Barlow Condensed', sans-serif";
    g.fillText(":", 0, -80);
    // Bulbs along the bottom of the frame, and the screen's sheen.
    for (let x = -108; x <= 108; x += 18) {
      g.fillStyle = "#15102a";
      g.beginPath();
      g.arc(x, -47, 2.6, 0, 7);
      g.fill();
      g.fillStyle = "#fff4c2";
      g.beginPath();
      g.arc(x, -47, 1.7, 0, 7);
      g.fill();
    }
    g.fillStyle = "rgba(255,255,255,.07)";
    g.beginPath();
    g.moveTo(-116, -110);
    g.lineTo(-40, -110);
    g.lineTo(-90, -50);
    g.lineTo(-116, -50);
    g.closePath();
    g.fill();
    for (const [bx, by] of [
      [-118, -130],
      [118, -130],
      [-118, -50],
      [118, -50],
    ]) {
      g.fillStyle = "#8a92b0";
      g.beginPath();
      g.arc(bx, by, 1.8, 0, 7);
      g.fill();
    }
  });
  return sbPic;
}

/**
 * A floodlight mast, baked (lit and unlit): a tapering steel mast with
 * bracing, a ladder, a platform and a head of six lamps in a frame, lit
 * on its left. Anchored at its foot; the head's middle is 240 px up.
 */
export function floodMast(lit) {
  return GFX.memo(`flood-mast:${lit}`, () =>
    GFX.sprite(76, 268, 38, 262, (g) => {
      // Base plate.
      g.fillStyle = "#1c2030";
      g.beginPath();
      g.roundRect(-12, -5, 24, 7, 2);
      g.fill();
      // The mast: tapering, lit on its left.
      const mg = g.createLinearGradient(-6, 0, 6, 0);
      mg.addColorStop(0, "#7a84a4");
      mg.addColorStop(0.4, "#4a5068");
      mg.addColorStop(1, "#262a3a");
      g.fillStyle = mg;
      g.beginPath();
      g.moveTo(-7, -2);
      g.lineTo(-3.5, -226);
      g.lineTo(3.5, -226);
      g.lineTo(7, -2);
      g.closePath();
      g.fill();
      // Ladder rungs up its side.
      g.strokeStyle = "rgba(20,24,36,.6)";
      g.lineWidth = 0.8;
      for (let y = -12; y > -220; y -= 8) {
        g.beginPath();
        g.moveTo(-4, y);
        g.lineTo(4, y);
        g.stroke();
      }
      // The platform under the head.
      g.fillStyle = "#2c3142";
      g.fillRect(-20, -228, 40, 4);
      g.strokeStyle = "#3a3f52";
      g.lineWidth = 1;
      g.beginPath();
      for (let x = -18; x <= 18; x += 6) {
        g.moveTo(x, -228);
        g.lineTo(x, -234);
      }
      g.moveTo(-20, -234);
      g.lineTo(20, -234);
      g.stroke();
      // The head: a frame of six lamps, tilted toward the pitch a touch.
      g.fillStyle = "#1c2030";
      g.beginPath();
      g.roundRect(-30, -262, 60, 30, 4);
      g.fill();
      g.strokeStyle = "#4a5068";
      g.lineWidth = 1.2;
      g.stroke();
      for (let r = 0; r < 2; r++)
        for (let c = 0; c < 3; c++) {
          const lx = -25 + c * 17,
            ly = -258 + r * 13;
          g.fillStyle = "#0d1020";
          g.beginPath();
          g.roundRect(lx, ly, 15, 11, 2);
          g.fill();
          if (lit) {
            const lg = g.createRadialGradient(lx + 6, ly + 4, 1, lx + 7.5, ly + 5.5, 9);
            lg.addColorStop(0, "#ffffff");
            lg.addColorStop(0.6, "#fff8d8");
            lg.addColorStop(1, "#ffe08a");
            g.fillStyle = lg;
          } else {
            const lg = g.createLinearGradient(lx, ly, lx + 15, ly + 11);
            lg.addColorStop(0, "#e6ebf4");
            lg.addColorStop(1, "#9aa3b8");
            g.fillStyle = lg;
          }
          g.beginPath();
          g.roundRect(lx + 1.5, ly + 1.5, 12, 8, 1.5);
          g.fill();
          g.fillStyle = "rgba(255,255,255,.6)";
          g.fillRect(lx + 3, ly + 2.5, 4, 1.4);
        }
    }),
  );
}
