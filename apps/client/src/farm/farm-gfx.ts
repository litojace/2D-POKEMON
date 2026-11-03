// @ts-nocheck
/*
 * Procedural art for the Plaza and the Farm: buildings, trees, props and animals drawn on 2x canvases.
 * Ported unchanged from the approved hub prototype
 * (docs/hub-redesign/prototype/app/art.js); only the exports at the end are
 * new. Pure drawing code, so it is not type-checked line by line.
 */
/* ======================================================================
   ART: new procedural art for Plaza and Farm (no legacy atlases).
   Soft toy-like shapes, light from the top left, gentle dark outlines.
   Static things are baked into 2x canvases; animals are drawn per frame.
   ====================================================================== */
const GFX = (() => {
  const R = 2;
  const h2r = (h) => {
    h = h.replace("#", "");
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    const n = parseInt(h.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const mix = (a, b, t) => {
    const A = h2r(a),
      B = h2r(b);
    return (
      "#" +
      A.map((v, i) =>
        Math.max(0, Math.min(255, Math.round(v + (B[i] - v) * t)))
          .toString(16)
          .padStart(2, "0"),
      ).join("")
    );
  };
  const lt = (c, t) => mix(c, "#ffffff", t),
    dk = (c, t) => mix(c, "#1c1630", t);
  const rgba = (c, a) => {
    const [r, g, b] = h2r(c);
    return `rgba(${r},${g},${b},${a})`;
  };
  let seed = 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const srand = (s) => {
    seed = Math.max(1, Math.floor(s) % 2147483646);
  };
  const cache = new Map();
  const memo = (k, fn) => {
    if (!cache.has(k)) cache.set(k, fn());
    return cache.get(k);
  };
  function sprite(w, h, ax, ay, fn) {
    const c = document.createElement("canvas");
    c.width = Math.ceil(w * R);
    c.height = Math.ceil(h * R);
    const g = c.getContext("2d");
    g.scale(R, R);
    g.translate(ax, ay);
    g.lineJoin = "round";
    g.lineCap = "round";
    const meta = fn(g) || {};
    return { c, w, h, ax, ay, ...meta };
  }
  function blit(g, s, x, y, k = 1, flip = false, alpha = 1, rot = 0) {
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    if (flip) g.scale(-1, 1);
    if (alpha !== 1) g.globalAlpha *= alpha;
    g.drawImage(s.c, -s.ax * k, -s.ay * k, s.w * k, s.h * k);
    g.restore();
  }
  // Soft ground shadows are drawn many times a frame (every tree, prop and
  // animal): each size is painted once and then stamped (phase 6, phones).
  const shadows = new Map();
  function shadow(g, x, y, rx, ry, a = 0.28) {
    const RX = Math.max(1, Math.round(rx)),
      RY = Math.max(1, Math.round(ry)),
      A = Math.round(a * 100) / 100,
      key = `${RX}|${RY}|${A}`;
    let s = shadows.get(key);
    if (!s) {
      if (shadows.size > 800) shadows.clear();
      s = sprite(RX * 2, RY * 2, RX, RY, (c) => {
        c.scale(1, RY / RX);
        const gr = c.createRadialGradient(0, 0, 0, 0, 0, RX);
        gr.addColorStop(0, `rgba(22,34,28,${A})`);
        gr.addColorStop(0.55, `rgba(22,34,28,${A * 0.65})`);
        gr.addColorStop(1, "rgba(22,34,28,0)");
        c.fillStyle = gr;
        c.beginPath();
        c.arc(0, 0, RX, 0, 7);
        c.fill();
      });
      shadows.set(key, s);
    }
    g.drawImage(s.c, x - RX, y - RY, RX * 2, RY * 2);
  }
  function ball(g, x, y, r, c, hl = 0.42) {
    const gr = g.createRadialGradient(
      x - r * 0.38,
      y - r * 0.42,
      r * 0.06,
      x,
      y,
      r * 1.08,
    );
    gr.addColorStop(0, lt(c, hl));
    gr.addColorStop(0.5, c);
    gr.addColorStop(1, dk(c, 0.3));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, 7);
    g.fill();
  }
  const vg = (g, y0, y1, c0, c1, c2) => {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, c0);
    if (c2) {
      gr.addColorStop(0.5, c1);
      gr.addColorStop(1, c2);
    } else gr.addColorStop(1, c1);
    return gr;
  };
  const hg = (g, x0, x1, c0, c1) => {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, c0);
    gr.addColorStop(1, c1);
    return gr;
  };
  const rr = (g, x, y, w, h, r) => {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
  };
  const ell = (g, x, y, rx, ry, rot = 0) => {
    g.beginPath();
    g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  };
  function outlineFill(g, path, fill, line, lw = 2) {
    path();
    g.fillStyle = fill;
    g.fill();
    if (line) {
      g.strokeStyle = line;
      g.lineWidth = lw;
      g.stroke();
    }
  }

  /* ---------------- vegetation ---------------- */
  const PALS = {
    green: { c: "#5fbf4f", d: "#2e7d3a", h: "#c9f27a" },
    mint: { c: "#45c49a", d: "#1f7a63", h: "#b8f5d8" },
    deep: { c: "#3f9d4a", d: "#205a2e", h: "#9fe07a" },
    autumn: { c: "#f2a33a", d: "#b4561c", h: "#ffe08a" },
    cherry: { c: "#ffb3cf", d: "#d86a99", h: "#fff0f6" },
    lime: { c: "#9fd84a", d: "#4f8f24", h: "#eaffa0" },
  };
  function canopy(pal, w, sd, fruit) {
    const P = PALS[pal],
      H = w * 0.88;
    return memo(`can:${pal}:${w}:${sd}:${fruit}`, () =>
      sprite(w + 24, H + 24, (w + 24) / 2, H + 12, (g) => {
        srand(sd);
        const L = [
          [0, -0.5, 0.34],
          [-0.29, -0.36, 0.25],
          [0.29, -0.38, 0.25],
          [-0.09, -0.72, 0.27],
          [0.16, -0.67, 0.23],
          [-0.2, -0.17, 0.22],
          [0.21, -0.19, 0.22],
          [0, -0.15, 0.25],
          [-0.33, -0.58, 0.17],
          [0.34, -0.6, 0.16],
        ].map(([x, y, r]) => [
          x * w + (rnd() - 0.5) * w * 0.05,
          y * H + (rnd() - 0.5) * H * 0.05,
          r * w * (0.92 + rnd() * 0.16),
        ]);
        L.forEach(([x, y, r]) => {
          g.fillStyle = dk(P.d, 0.35);
          g.beginPath();
          g.arc(x, y, r + 2.6, 0, 7);
          g.fill();
        });
        L.forEach(([x, y, r]) => {
          g.fillStyle = P.d;
          g.beginPath();
          g.arc(x, y, r, 0, 7);
          g.fill();
        });
        L.forEach(([x, y, r]) => {
          const gr = g.createRadialGradient(
            x - r * 0.4,
            y - r * 0.5,
            r * 0.1,
            x - r * 0.1,
            y - r * 0.12,
            r * 0.95,
          );
          gr.addColorStop(0, lt(P.c, 0.28));
          gr.addColorStop(0.7, P.c);
          gr.addColorStop(1, rgba(P.c, 0));
          g.fillStyle = gr;
          g.beginPath();
          g.arc(x - r * 0.08, y - r * 0.12, r * 0.9, 0, 7);
          g.fill();
        });
        // leaf scallops
        g.globalCompositeOperation = "source-atop";
        for (let i = 0; i < 70; i++) {
          const [x, y, r] = L[Math.floor(rnd() * L.length)],
            a = rnd() * Math.PI * 2,
            d = rnd() * r * 0.85,
            px = x + Math.cos(a) * d,
            py = y + Math.sin(a) * d;
          g.strokeStyle = rgba(P.d, 0.35);
          g.lineWidth = 1.4;
          g.beginPath();
          g.arc(px, py, 4 + rnd() * 3, Math.PI * 0.1, Math.PI * 0.9);
          g.stroke();
        }
        for (let i = 0; i < 26; i++) {
          const [x, y, r] = L[Math.floor(rnd() * 5)],
            px = x - r * 0.3 + (rnd() - 0.5) * r * 0.7,
            py = y - r * 0.35 + (rnd() - 0.5) * r * 0.5;
          g.fillStyle = rgba(P.h, 0.55);
          g.beginPath();
          g.ellipse(px, py, 3.5 + rnd() * 3, 2.2 + rnd() * 1.8, -0.5, 0, 7);
          g.fill();
        }
        const ao = g.createLinearGradient(0, -H * 0.1, 0, 6);
        ao.addColorStop(0, "rgba(10,30,20,0)");
        ao.addColorStop(1, "rgba(10,30,20,.35)");
        g.fillStyle = ao;
        g.fillRect(-w, -H * 0.1, w * 2, H * 0.3);
        g.globalCompositeOperation = "source-over";
        if (fruit)
          for (let i = 0; i < 11; i++) {
            const [x, y, r] = L[Math.floor(rnd() * L.length)],
              a = rnd() * Math.PI * 2,
              d = rnd() * r * 0.7;
            ball(g, x + Math.cos(a) * d, y + Math.sin(a) * d, 5.2, fruit, 0.55);
          }
        if (pal === "cherry")
          for (let i = 0; i < 40; i++) {
            const [x, y, r] = L[Math.floor(rnd() * L.length)],
              a = rnd() * 7,
              d = rnd() * r;
            g.fillStyle = rnd() < 0.5 ? "#ffffff" : "#ff8fbd";
            g.beginPath();
            g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.8, 0, 7);
            g.fill();
          }
      }),
    );
  }
  function trunk(h, birch) {
    return memo(`trunk:${h}:${birch}`, () =>
      sprite(60, h + 16, 30, h + 6, (g) => {
        const c = birch ? "#efe9dc" : "#9a6436",
          d = birch ? "#b9b0a0" : "#5e3a1f";
        g.beginPath();
        g.moveTo(-11, 2);
        g.quadraticCurveTo(-6, -h * 0.3, -6, -h);
        g.lineTo(6, -h);
        g.quadraticCurveTo(6, -h * 0.3, 12, 2);
        g.quadraticCurveTo(0, 5, -11, 2);
        g.closePath();
        g.fillStyle = hg(g, -10, 10, lt(c, 0.15), d);
        g.fill();
        g.strokeStyle = dk(d, 0.35);
        g.lineWidth = 1.6;
        g.stroke();
        if (birch) {
          g.fillStyle = "#4a4038";
          for (let y = -h + 6; y < -4; y += 9) {
            g.fillRect(-4 + (y % 3), y, 5, 1.8);
          }
        } else {
          g.strokeStyle = rgba(d, 0.55);
          g.lineWidth = 1;
          for (let k = 0; k < 4; k++) {
            g.beginPath();
            g.moveTo(-2 + k * 2, -h * 0.2 - k * 6);
            g.quadraticCurveTo(-1 + k * 2, -h * 0.5, -2 + k * 2, -h * 0.8);
            g.stroke();
          }
        }
        g.beginPath();
        g.moveTo(-5, -h * 0.55);
        g.quadraticCurveTo(-14, -h * 0.7, -18, -h * 0.82);
        g.strokeStyle = c;
        g.lineWidth = 4;
        g.stroke();
      }),
    );
  }
  function pine(w, sd) {
    const H = w * 1.55;
    return memo(`pine:${w}:${sd}`, () =>
      sprite(w + 20, H + 26, (w + 20) / 2, H + 12, (g) => {
        srand(sd);
        g.fillStyle = "#6b4527";
        rr(g, -5, -18, 10, 22, 3);
        g.fill();
        const tiers = 4;
        for (let i = 0; i < tiers; i++) {
          const k = i / tiers,
            tw = (w * (1 - k * 0.62)) / 2,
            by = -12 - H * k * 0.78,
            ty = by - H * 0.38;
          const path = () => {
            g.beginPath();
            g.moveTo(0, ty);
            g.quadraticCurveTo(tw * 0.4, ty + (by - ty) * 0.4, tw, by - 4);
            g.quadraticCurveTo(tw * 0.5, by + 6, 0, by + 3);
            g.quadraticCurveTo(-tw * 0.5, by + 6, -tw, by - 4);
            g.quadraticCurveTo(-tw * 0.4, ty + (by - ty) * 0.4, 0, ty);
            g.closePath();
          };
          path();
          g.lineWidth = 5;
          g.strokeStyle = "#173f2a";
          g.stroke();
          path();
          const gr = g.createLinearGradient(-tw, ty, tw, by);
          gr.addColorStop(0, "#5fcf7c");
          gr.addColorStop(0.5, "#2f9a5a");
          gr.addColorStop(1, "#1d6a43");
          g.fillStyle = gr;
          g.fill();
          g.strokeStyle = "rgba(200,255,200,.35)";
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(-tw * 0.55, by - 6);
          g.quadraticCurveTo(-tw * 0.2, by - 2, 0, by - 4);
          g.stroke();
        }
      }),
    );
  }
  function tree(kind, sd, size = 1) {
    if (kind === "pine") return { pine: pine(Math.round(96 * size), sd), h: 0 };
    const m = {
      round: ["green", 0],
      mint: ["mint", 0],
      autumn: ["autumn", 0],
      cherry: ["cherry", 1],
      apple: ["green", 0, "#e8413a"],
      orange: ["deep", 0, "#ffa31a"],
      lime: ["lime", 1],
    }[kind];
    const w = Math.round(150 * size),
      h = Math.round(58 * size);
    return { canopy: canopy(m[0], w, sd, m[2]), trunk: trunk(h, m[1]), h };
  }
  function drawTree(g, t, x, y, time, ph = 0, shadowK = 1) {
    shadow(g, x + 14, y + 2, 64 * shadowK * (t.pine ? 0.7 : 1), 18 * shadowK);
    if (t.pine) {
      blit(g, t.pine, x, y + 4);
      return;
    }
    blit(g, t.trunk, x, y + 4);
    blit(
      g,
      t.canopy,
      x,
      y - t.h + 14,
      1,
      false,
      1,
      Math.sin(time * 1.2 + ph) * 0.018,
    );
  }
  function bush(kind, sd, w = 70) {
    return memo(`bush:${kind}:${sd}:${w}`, () =>
      sprite(w + 16, w * 0.75 + 14, (w + 16) / 2, w * 0.75 + 6, (g) => {
        srand(sd);
        const P =
            PALS[kind === "flower" || kind === "rose" ? "deep" : kind] ||
            PALS.green,
          H = w * 0.66;
        const L = [
          [0, -0.45, 0.34],
          [-0.3, -0.3, 0.26],
          [0.3, -0.32, 0.26],
          [-0.12, -0.62, 0.24],
          [0.16, -0.6, 0.22],
        ].map(([x, y, r]) => [x * w, y * H + 3, r * w]);
        L.forEach(([x, y, r]) => {
          g.fillStyle = dk(P.d, 0.35);
          g.beginPath();
          g.arc(x, y, r + 2.2, 0, 7);
          g.fill();
        });
        L.forEach(([x, y, r]) => ball(g, x, y, r, P.c, 0.3));
        g.globalCompositeOperation = "source-atop";
        const ao = g.createLinearGradient(0, -H * 0.2, 0, 4);
        ao.addColorStop(0, "rgba(0,30,10,0)");
        ao.addColorStop(1, "rgba(0,30,10,.35)");
        g.fillStyle = ao;
        g.fillRect(-w, -H * 0.2, w * 2, H);
        g.globalCompositeOperation = "source-over";
        if (kind === "flower" || kind === "rose") {
          const cols =
            kind === "rose"
              ? ["#ff5d7d", "#ff8fa8"]
              : ["#ffffff", "#ffd65b", "#ff9bd2", "#c9a3ff"];
          for (let i = 0; i < 14; i++) {
            const [x, y, r] = L[Math.floor(rnd() * L.length)],
              a = rnd() * 7,
              d = rnd() * r * 0.75,
              px = x + Math.cos(a) * d,
              py = y + Math.sin(a) * d * 0.8,
              c = cols[i % cols.length];
            for (let k = 0; k < 5; k++) {
              g.fillStyle = c;
              g.beginPath();
              g.arc(
                px + Math.cos(k * 1.256) * 2.6,
                py + Math.sin(k * 1.256) * 2.6,
                2.3,
                0,
                7,
              );
              g.fill();
            }
            g.fillStyle = "#ffcf3a";
            g.beginPath();
            g.arc(px, py, 1.5, 0, 7);
            g.fill();
          }
        }
      }),
    );
  }
  function rock(sd, w = 46) {
    return memo(`rock:${sd}:${w}`, () =>
      sprite(w + 10, w * 0.8, (w + 10) / 2, w * 0.7, (g) => {
        srand(sd);
        const pts = [];
        for (let i = 0; i < 9; i++) {
          const a = Math.PI + (i / 8) * Math.PI,
            r = (w / 2) * (0.8 + rnd() * 0.25);
          pts.push([
            Math.cos(a) * r,
            Math.sin(a) * r * (0.95 + rnd() * 0.2) - 2,
          ]);
        }
        const path = () => {
          g.beginPath();
          g.moveTo(-w / 2, 0);
          pts.forEach(([x, y]) => g.lineTo(x, y));
          g.lineTo(w / 2, 0);
          g.quadraticCurveTo(0, 6, -w / 2, 0);
          g.closePath();
        };
        path();
        g.fillStyle = vg(g, -w * 0.5, 4, "#d9dde6", "#9aa1b2", "#6e7487");
        g.fill();
        g.strokeStyle = "#4a4f62";
        g.lineWidth = 2;
        g.stroke();
        g.save();
        path();
        g.clip();
        g.fillStyle = "rgba(255,255,255,.35)";
        ell(g, -w * 0.14, -w * 0.34, w * 0.22, w * 0.1, -0.3);
        g.fill();
        g.fillStyle = "#6fbf54";
        ell(g, w * 0.12, -w * 0.36, w * 0.16, w * 0.07);
        g.fill();
        g.restore();
      }),
    );
  }
  /* ---------------- props ---------------- */
  const lamp = () =>
    memo("lamp", () =>
      sprite(40, 110, 20, 104, (g) => {
        g.fillStyle = "#283048";
        rr(g, -9, -8, 18, 9, 3);
        g.fill();
        g.fillStyle = hg(g, -3, 3, "#4a5578", "#1f2538");
        rr(g, -3, -78, 6, 72, 3);
        g.fill();
        g.fillStyle = "#283048";
        rr(g, -11, -84, 22, 6, 2);
        g.fill();
        g.beginPath();
        g.moveTo(-9, -84);
        g.lineTo(-7, -100);
        g.lineTo(7, -100);
        g.lineTo(9, -84);
        g.closePath();
        g.fillStyle = vg(g, -100, -84, "#fff6d0", "#ffd36b");
        g.fill();
        g.strokeStyle = "#283048";
        g.lineWidth = 2;
        g.stroke();
        g.beginPath();
        g.moveTo(0, -100);
        g.lineTo(0, -84);
        g.stroke();
        g.fillStyle = "#283048";
        g.beginPath();
        g.moveTo(-11, -100);
        g.lineTo(0, -108);
        g.lineTo(11, -100);
        g.closePath();
        g.fill();
        g.beginPath();
        g.arc(0, -109, 2.5, 0, 7);
        g.fill();
        return { glow: [0, -92] };
      }),
    );
  const bench = () =>
    memo("bench", () =>
      sprite(92, 56, 46, 50, (g) => {
        g.fillStyle = "#2c3348";
        [-34, 30].forEach((x) => {
          rr(g, x, -22, 5, 22, 2);
          g.fill();
          rr(g, x - 1, -40, 6, 20, 2);
          g.fill();
        });
        for (let i = 0; i < 3; i++) {
          rr(g, -40, -44 + i * 7, 80, 5, 2);
          g.fillStyle = vg(g, -44 + i * 7, -39 + i * 7, "#e2a868", "#b06e38");
          g.fill();
        }
        rr(g, -42, -24, 84, 8, 3);
        g.fillStyle = vg(g, -24, -16, "#f0b878", "#a8642f");
        g.fill();
        g.strokeStyle = "#6e3e1c";
        g.lineWidth = 1.2;
        g.stroke();
      }),
    );
  const flowerbed = (w, sd) =>
    memo(`fbed:${w}:${sd}`, () =>
      sprite(w + 10, 70, (w + 10) / 2, 50, (g) => {
        srand(sd);
        rr(g, -w / 2, -26, w, 30, 10);
        g.fillStyle = vg(g, -26, 4, "#efe3cc", "#bfae8e");
        g.fill();
        g.strokeStyle = "#8a7a5c";
        g.lineWidth = 2;
        g.stroke();
        rr(g, -w / 2 + 5, -30, w - 10, 10, 6);
        g.fillStyle = "#5a3d24";
        g.fill();
        for (let i = 0; i < w / 6; i++) {
          const x = -w / 2 + 10 + rnd() * (w - 20),
            y = -30 + rnd() * 6;
          g.fillStyle = rnd() < 0.5 ? "#4fae46" : "#3c8f3a";
          ell(g, x, y - 4, 5, 8, rnd() - 0.5);
          g.fill();
        }
        const cols = [
          ["#ff6f9a", "#ffd0de"],
          ["#ffd65b", "#fff3b8"],
          ["#9a7bff", "#e3d8ff"],
          ["#ffffff", "#fff"],
          ["#ff8a3d", "#ffd7b8"],
        ];
        for (let i = 0; i < w / 9; i++) {
          const x = -w / 2 + 12 + rnd() * (w - 24),
            y = -36 - rnd() * 12,
            [c] = cols[Math.floor(rnd() * cols.length)];
          for (let k = 0; k < 5; k++) {
            g.fillStyle = c;
            g.beginPath();
            g.arc(
              x + Math.cos(k * 1.256) * 3,
              y + Math.sin(k * 1.256) * 3,
              2.8,
              0,
              7,
            );
            g.fill();
          }
          g.fillStyle = "#ffcf3a";
          g.beginPath();
          g.arc(x, y, 1.8, 0, 7);
          g.fill();
        }
      }),
    );
  const crates = () =>
    memo("crates", () =>
      sprite(90, 80, 45, 72, (g) => {
        const crate = (x, y, s) => {
          rr(g, x, y - s, s, s, 3);
          g.fillStyle = vg(g, y - s, y, "#e3a960", "#a96a33");
          g.fill();
          g.strokeStyle = "#6b3f1c";
          g.lineWidth = 2;
          g.stroke();
          g.beginPath();
          g.moveTo(x + 4, y - s + 4);
          g.lineTo(x + s - 4, y - 4);
          g.moveTo(x + s - 4, y - s + 4);
          g.lineTo(x + 4, y - 4);
          g.strokeStyle = "rgba(107,63,28,.6)";
          g.stroke();
        };
        crate(-40, 0, 36);
        crate(-2, 0, 34);
        crate(-24, -36, 32);
        [
          ["#ff5d4a", -30, -66],
          ["#ffd84a", -18, -70],
          ["#7cc95a", -8, -66],
        ].forEach(([c, x, y]) => ball(g, x, y, 6, c));
      }),
    );
  const hay = () =>
    memo("hay", () =>
      sprite(80, 50, 40, 44, (g) => {
        rr(g, -34, -34, 68, 34, 10);
        g.fillStyle = vg(g, -34, 0, "#ffe38a", "#d9a63a");
        g.fill();
        g.strokeStyle = "#9a6e1c";
        g.lineWidth = 2;
        g.stroke();
        g.strokeStyle = "rgba(150,100,20,.5)";
        g.lineWidth = 1;
        for (let i = 0; i < 16; i++) {
          const x = -30 + i * 4;
          g.beginPath();
          g.moveTo(x, -30);
          g.lineTo(x + 2, -4);
          g.stroke();
        }
        g.strokeStyle = "#b5442e";
        g.lineWidth = 3;
        [-14, 14].forEach((x) => {
          g.beginPath();
          g.moveTo(x, -34);
          g.lineTo(x, 0);
          g.stroke();
        });
      }),
    );
  const mailbox = () =>
    memo("mailbox", () =>
      sprite(40, 70, 20, 66, (g) => {
        g.fillStyle = "#7a5230";
        rr(g, -3, -40, 6, 40, 2);
        g.fill();
        rr(g, -14, -60, 28, 22, 10);
        g.fillStyle = vg(g, -60, -38, "#5fb3ff", "#2a6fd0");
        g.fill();
        g.strokeStyle = "#1c3f80";
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = "#ef4f61";
        rr(g, 10, -68, 3, 14, 1);
        g.fill();
        rr(g, 10, -68, 9, 6, 1);
        g.fill();
      }),
    );

  /* ---------------- buildings ---------------- */
  function house(o) {
    const {
      w = 150,
      wall = "#ffe9c8",
      roof = "#e8564a",
      hgt = 92,
      roofH = 70,
      door = "#7a4a2a",
      sd = 1,
      chimney = true,
      sign = null,
      windows = 2,
      shutters = "#5fb3ff",
      depth = 30,
      flowers = true,
    } = o;
    return memo(`house:${JSON.stringify(o)}`, () =>
      sprite(
        w + depth + 40,
        hgt + roofH + 70,
        (w + 40) / 2,
        hgt + roofH + 46,
        (g) => {
          srand(sd);
          const x0 = -w / 2,
            x1 = w / 2,
            top = -hgt,
            ridge = top - roofH;
          // side wall (depth)
          g.beginPath();
          g.moveTo(x1, 0);
          g.lineTo(x1 + depth, -depth * 0.45);
          g.lineTo(x1 + depth, top - depth * 0.45);
          g.lineTo(x1, top);
          g.closePath();
          g.fillStyle = dk(wall, 0.22);
          g.fill();
          g.strokeStyle = dk(wall, 0.55);
          g.lineWidth = 2;
          g.stroke();
          // foundation
          rr(g, x0 - 4, -12, w + 8, 14, 3);
          g.fillStyle = vg(g, -12, 2, "#c9c3b6", "#8e8778");
          g.fill();
          g.strokeStyle = "#5e584c";
          g.lineWidth = 1.5;
          g.stroke();
          for (let x = x0; x < x1; x += 18) {
            g.beginPath();
            g.moveTo(x, -12);
            g.lineTo(x, 2);
            g.stroke();
          }
          // front wall
          g.fillStyle = vg(g, top, 0, lt(wall, 0.25), wall, dk(wall, 0.1));
          g.fillRect(x0, top, w, hgt - 12);
          g.strokeStyle = dk(wall, 0.5);
          g.lineWidth = 2;
          g.strokeRect(x0, top, w, hgt - 12);
          g.strokeStyle = rgba(dk(wall, 0.4), 0.25);
          g.lineWidth = 1;
          for (let y = top + 14; y < -14; y += 14) {
            g.beginPath();
            g.moveTo(x0 + 2, y);
            g.lineTo(x1 - 2, y);
            g.stroke();
          }
          // door
          const dw = Math.min(34, w * 0.24),
            dh = Math.min(52, hgt * 0.58),
            dx = windows === 2 ? -dw / 2 : x0 + w * 0.62 - dw / 2;
          g.beginPath();
          g.moveTo(dx, -12);
          g.lineTo(dx, -12 - dh + dw / 2);
          g.arc(dx + dw / 2, -12 - dh + dw / 2, dw / 2, Math.PI, 0);
          g.lineTo(dx + dw, -12);
          g.closePath();
          g.fillStyle = vg(g, -12 - dh, -12, lt(door, 0.2), dk(door, 0.2));
          g.fill();
          g.strokeStyle = dk(door, 0.5);
          g.lineWidth = 2.2;
          g.stroke();
          g.strokeStyle = rgba(dk(door, 0.5), 0.5);
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(dx + dw / 2, -14);
          g.lineTo(dx + dw / 2, -12 - dh + 6);
          g.stroke();
          g.fillStyle = "#ffd65b";
          g.beginPath();
          g.arc(dx + dw * 0.78, -12 - dh * 0.45, 2.2, 0, 7);
          g.fill();
          rr(g, dx - 6, -12, dw + 12, 6, 2);
          g.fillStyle = "#b8b0a0";
          g.fill();
          // windows
          const win = [],
            wy = top + hgt * 0.22,
            ww = Math.min(30, w * 0.2),
            wh = ww * 1.05;
          const wxs =
            windows === 2
              ? [x0 + w * 0.2 - ww / 2, x1 - w * 0.2 - ww / 2]
              : [x0 + w * 0.27 - ww / 2];
          wxs.forEach((wx) => {
            if (shutters) {
              g.fillStyle = shutters;
              rr(g, wx - 9, wy - 1, 8, wh + 2, 2);
              g.fill();
              rr(g, wx + ww + 1, wy - 1, 8, wh + 2, 2);
              g.fill();
              g.strokeStyle = dk(shutters, 0.4);
              g.lineWidth = 1;
              for (const sx of [wx - 9, wx + ww + 1])
                for (let k = 1; k < 5; k++) {
                  g.beginPath();
                  g.moveTo(sx + 1, wy + (k * wh) / 5);
                  g.lineTo(sx + 7, wy + (k * wh) / 5);
                  g.stroke();
                }
            }
            rr(g, wx - 2, wy - 2, ww + 4, wh + 4, 4);
            g.fillStyle = "#fff8ec";
            g.fill();
            g.strokeStyle = dk(wall, 0.55);
            g.lineWidth = 1.5;
            g.stroke();
            rr(g, wx, wy, ww, wh, 3);
            g.fillStyle = vg(g, wy, wy + wh, "#bfe8ff", "#6aa8d8");
            g.fill();
            g.fillStyle = "rgba(255,255,255,.55)";
            g.beginPath();
            g.moveTo(wx + 3, wy + wh - 4);
            g.lineTo(wx + ww * 0.55, wy + 3);
            g.lineTo(wx + ww * 0.75, wy + 3);
            g.lineTo(wx + 8, wy + wh - 4);
            g.fill();
            g.strokeStyle = "#fff8ec";
            g.lineWidth = 2.4;
            g.beginPath();
            g.moveTo(wx + ww / 2, wy);
            g.lineTo(wx + ww / 2, wy + wh);
            g.moveTo(wx, wy + wh / 2);
            g.lineTo(wx + ww, wy + wh / 2);
            g.stroke();
            if (flowers) {
              rr(g, wx - 4, wy + wh + 2, ww + 8, 8, 2);
              g.fillStyle = "#a86a3a";
              g.fill();
              for (let k = 0; k < 6; k++) {
                g.fillStyle = k % 2 ? "#ff6f9a" : "#ffd65b";
                g.beginPath();
                g.arc(wx - 1 + (k * (ww + 2)) / 5, wy + wh + 1, 2.8, 0, 7);
                g.fill();
                g.fillStyle = "#4fae46";
                g.beginPath();
                g.arc(wx + 1 + (k * (ww + 2)) / 5, wy + wh + 3, 2, 0, 7);
                g.fill();
              }
            }
            win.push([wx, wy, ww, wh]);
          });
          // chimney
          if (chimney) {
            const cx = x0 + w * 0.72;
            g.fillStyle = vg(g, ridge, top, "#d77a5a", "#9a4a32");
            g.fillRect(cx, ridge + roofH * 0.1, 18, roofH * 0.6);
            g.strokeStyle = "#5e2a1a";
            g.lineWidth = 1.8;
            g.strokeRect(cx, ridge + roofH * 0.1, 18, roofH * 0.6);
            g.fillStyle = "#6a3424";
            g.fillRect(cx - 3, ridge + roofH * 0.1 - 6, 24, 7);
          }
          // roof (hip, with tile rows)
          const ov = 14,
            inset = w * 0.22;
          const roofPath = () => {
            g.beginPath();
            g.moveTo(x0 - ov, top + 4);
            g.lineTo(x1 + ov, top + 4);
            g.lineTo(x1 + ov + depth, top + 4 - depth * 0.45);
            g.lineTo(x1 - inset + depth * 0.6, ridge);
            g.lineTo(x0 + inset, ridge);
            g.closePath();
          };
          roofPath();
          g.fillStyle = dk(roof, 0.5);
          g.lineWidth = 6;
          g.strokeStyle = dk(roof, 0.55);
          g.stroke();
          roofPath();
          g.fillStyle = vg(g, ridge, top, lt(roof, 0.2), roof, dk(roof, 0.15));
          g.fill();
          g.save();
          roofPath();
          g.clip();
          // side plane darker
          g.beginPath();
          g.moveTo(x1 + ov, top + 4);
          g.lineTo(x1 + ov + depth, top + 4 - depth * 0.45);
          g.lineTo(x1 - inset + depth * 0.6, ridge);
          g.lineTo(x1 - inset, ridge + 2);
          g.closePath();
          g.fillStyle = rgba(dk(roof, 0.5), 0.45);
          g.fill();
          for (let y = ridge + 8; y < top + 4; y += 11) {
            g.strokeStyle = rgba(dk(roof, 0.55), 0.55);
            g.lineWidth = 1.6;
            g.beginPath();
            for (let x = x0 - ov - 10; x < x1 + ov + depth; x += 12) {
              g.moveTo(x, y);
              g.arc(x + 6, y, 6, Math.PI, 0, true);
            }
            g.stroke();
          }
          g.fillStyle = "rgba(255,255,255,.18)";
          g.fillRect(x0, ridge, w, 6);
          g.restore();
          g.fillStyle = dk(roof, 0.25);
          rr(
            g,
            x0 + inset - 4,
            ridge - 5,
            w - inset * 2 + depth * 0.6 + 8,
            8,
            4,
          );
          g.fill();
          rr(g, x0 - ov - 2, top + 1, w + ov * 2 + 4, 8, 4);
          g.fillStyle = dk(roof, 0.2);
          g.fill();
          if (sign) {
            rr(g, -w * 0.34, top + 5, w * 0.68, 23, 7);
            g.fillStyle = sign.bg || "#2a1f4c";
            g.fill();
            g.fillStyle = sign.fg || "#fff4d6";
            g.font = "800 17px 'Barlow Condensed', sans-serif";
            g.textAlign = "center";
            g.fillText(sign.t, 0, top + 22.5);
          }
          return {
            win,
            chimney: chimney
              ? [x0 + w * 0.72 + 9, ridge + roofH * 0.1 - 8]
              : null,
          };
        },
      ),
    );
  }
  const barn = () =>
    memo("barn", () =>
      sprite(260, 230, 120, 210, (g) => {
        const w = 200,
          h = 110,
          x0 = -100,
          top = -h;
        // silo
        const sx = 105;
        rr(g, sx - 26, -160, 52, 160, 10);
        g.fillStyle = hg(g, sx - 26, sx + 26, "#d8e3ee", "#7d8ea3");
        g.fill();
        g.strokeStyle = "#45566c";
        g.lineWidth = 2;
        g.stroke();
        for (let y = -150; y < -6; y += 22) {
          g.strokeStyle = "rgba(60,80,100,.5)";
          g.beginPath();
          g.moveTo(sx - 26, y);
          g.lineTo(sx + 26, y);
          g.stroke();
        }
        g.beginPath();
        g.ellipse(sx, -160, 28, 30, 0, Math.PI, 0);
        g.fillStyle = hg(g, sx - 28, sx + 28, "#ff8a6a", "#a8342a");
        g.fill();
        g.stroke();
        // barn wall
        g.beginPath();
        g.moveTo(x0, 0);
        g.lineTo(x0, top);
        g.lineTo(x0 + 30, top - 48);
        g.lineTo(0, top - 78);
        g.lineTo(-x0 - 30, top - 48);
        g.lineTo(-x0, top);
        g.lineTo(-x0, 0);
        g.closePath();
        g.fillStyle = vg(g, top - 78, 0, "#f06a52", "#c63e33", "#9c2a26");
        g.fill();
        g.strokeStyle = "#5c1714";
        g.lineWidth = 2.5;
        g.stroke();
        g.strokeStyle = "rgba(90,20,20,.35)";
        g.lineWidth = 1;
        for (let x = x0 + 12; x < -x0; x += 12) {
          g.beginPath();
          g.moveTo(x, -2);
          g.lineTo(x, top - 30 + Math.abs(x) * 0.3);
          g.stroke();
        }
        // gambrel roof
        const rp = () => {
          g.beginPath();
          g.moveTo(x0 - 12, top + 4);
          g.lineTo(x0 + 24, top - 50);
          g.lineTo(0, top - 86);
          g.lineTo(-x0 - 24, top - 50);
          g.lineTo(-x0 + 12, top + 4);
          g.lineTo(-x0 + 2, top + 4);
          g.lineTo(-x0 - 30, top - 42);
          g.lineTo(0, top - 70);
          g.lineTo(x0 + 30, top - 42);
          g.lineTo(x0 - 2, top + 4);
          g.closePath();
        };
        rp();
        g.fillStyle = vg(g, top - 86, top, "#6d7896", "#3b4360");
        g.fill();
        g.strokeStyle = "#232843";
        g.lineWidth = 2;
        g.stroke();
        // trims
        g.strokeStyle = "#fffaf0";
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(x0 + 4, -2);
        g.lineTo(x0 + 4, top + 6);
        g.moveTo(-x0 - 4, -2);
        g.lineTo(-x0 - 4, top + 6);
        g.stroke();
        // big doors with X
        const dw = 76,
          dh = 74;
        g.fillStyle = vg(g, -dh, 0, "#d94a3c", "#9c2a26");
        g.fillRect(-dw / 2, -dh, dw, dh);
        g.strokeStyle = "#fffaf0";
        g.lineWidth = 4.5;
        g.strokeRect(-dw / 2, -dh, dw, dh);
        g.beginPath();
        g.moveTo(0, -dh);
        g.lineTo(0, 0);
        g.moveTo(-dw / 2, -dh);
        g.lineTo(0, 0);
        g.moveTo(0, -dh);
        g.lineTo(-dw / 2, 0);
        g.moveTo(0, -dh);
        g.lineTo(dw / 2, 0);
        g.moveTo(dw / 2, -dh);
        g.lineTo(0, 0);
        g.stroke();
        // loft
        g.fillStyle = "#3a1c14";
        rr(g, -18, top - 30, 36, 26, 4);
        g.fill();
        g.strokeStyle = "#fffaf0";
        g.lineWidth = 3.5;
        g.stroke();
        g.fillStyle = "#ffd65b";
        for (let i = 0; i < 9; i++) {
          g.beginPath();
          g.moveTo(-14 + i * 3.4, top - 6);
          g.lineTo(-12 + i * 3.4, top - 18 - (i % 3) * 3);
          g.lineTo(-10 + i * 3.4, top - 6);
          g.fill();
        }
        g.fillStyle = "#fff4d6";
        g.font = "800 19px 'Barlow Condensed', sans-serif";
        g.textAlign = "center";
        g.fillText("BARN", 0, top + 18);
      }),
    );
  const windmillBody = () =>
    memo("wmb", () =>
      sprite(150, 230, 75, 214, (g) => {
        g.beginPath();
        g.moveTo(-42, 0);
        g.lineTo(-26, -160);
        g.lineTo(26, -160);
        g.lineTo(42, 0);
        g.closePath();
        g.fillStyle = hg(g, -42, 42, "#fff6e4", "#d2bf9e");
        g.fill();
        g.strokeStyle = "#7a6648";
        g.lineWidth = 2.2;
        g.stroke();
        for (let y = -140; y < 0; y += 34) {
          const hw = 42 - 16 * (-y / 160);
          g.fillStyle = "#9a6a3a";
          g.fillRect(-hw, y, hw * 2, 5);
        }
        g.fillStyle = "#6a4a2c";
        g.beginPath();
        g.moveTo(-10, 0);
        g.lineTo(-10, -26);
        g.arc(0, -26, 10, Math.PI, 0);
        g.lineTo(10, 0);
        g.fill();
        g.fillStyle = "#8fd0ff";
        g.beginPath();
        g.arc(0, -98, 9, 0, 7);
        g.fill();
        g.strokeStyle = "#7a6648";
        g.lineWidth = 2;
        g.stroke();
        g.beginPath();
        g.moveTo(-36, -158);
        g.quadraticCurveTo(0, -214, 36, -158);
        g.closePath();
        g.fillStyle = vg(g, -205, -158, "#4fb3a8", "#1f6b6a");
        g.fill();
        g.strokeStyle = "#143f40";
        g.stroke();
        return { hub: [0, -168] };
      }),
    );
  function windmillSails(g, x, y, t, s = 1) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.rotate(t);
    for (let i = 0; i < 4; i++) {
      g.save();
      g.rotate((i * Math.PI) / 2);
      g.fillStyle = "#7a5230";
      g.fillRect(-3, -2, 92, 5);
      g.fillStyle = "rgba(255,248,232,.92)";
      g.strokeStyle = "#7a5230";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(18, 3);
      g.lineTo(88, 3);
      g.lineTo(88, 24);
      g.lineTo(18, 16);
      g.closePath();
      g.fill();
      g.stroke();
      for (let k = 30; k < 88; k += 14) {
        g.beginPath();
        g.moveTo(k, 3);
        g.lineTo(k, 23 - (88 - k) * 0.08);
        g.stroke();
      }
      g.restore();
    }
    g.fillStyle = "#5a3a20";
    g.beginPath();
    g.arc(0, 0, 8, 0, 7);
    g.fill();
    g.restore();
  }
  function stall(
    awn = ["#ef4f61", "#fff6e8"],
    goods = ["#ff5d4a", "#ffd84a", "#7cc95a", "#ff9bd2"],
  ) {
    return memo(`stall:${awn}:${goods}`, () =>
      sprite(200, 190, 100, 176, (g) => {
        g.fillStyle = "#7a5230";
        [-78, 72].forEach((x) => {
          rr(g, x, -128, 7, 128, 3);
          g.fill();
        });
        rr(g, -86, -58, 172, 58, 6);
        g.fillStyle = vg(g, -58, 0, "#d99a58", "#9a5f2e");
        g.fill();
        g.strokeStyle = "#5e3417";
        g.lineWidth = 2;
        g.stroke();
        for (let x = -80; x < 86; x += 18) {
          g.strokeStyle = "rgba(94,52,23,.45)";
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(x, -54);
          g.lineTo(x, -2);
          g.stroke();
        }
        rr(g, -90, -64, 180, 10, 4);
        g.fillStyle = "#e9b071";
        g.fill();
        g.strokeStyle = "#5e3417";
        g.stroke();
        [
          [-70, goods[0]],
          [-30, goods[1]],
          [10, goods[2]],
          [50, goods[3]],
        ].forEach(([x, c]) => {
          rr(g, x, -84, 34, 22, 3);
          g.fillStyle = "#b67a3e";
          g.fill();
          g.strokeStyle = "#5e3417";
          g.lineWidth = 1.5;
          g.stroke();
          for (let k = 0; k < 5; k++)
            ball(
              g,
              x + 6 + (k % 3) * 11,
              -86 - Math.floor(k / 3) * 7,
              5.5,
              c,
              0.5,
            );
        });
        const top = -150,
          bot = -112;
        g.beginPath();
        g.moveTo(-96, bot);
        g.lineTo(-80, top);
        g.lineTo(80, top);
        g.lineTo(96, bot);
        g.closePath();
        g.save();
        g.clip();
        for (let i = 0; i < 8; i++) {
          g.fillStyle = i % 2 ? awn[1] : awn[0];
          g.beginPath();
          g.moveTo(-96 + i * 24, bot);
          g.lineTo(-80 + i * 20, top);
          g.lineTo(-60 + i * 20, top);
          g.lineTo(-72 + i * 24, bot);
          g.fill();
        }
        g.restore();
        for (let i = 0; i < 8; i++) {
          g.fillStyle = i % 2 ? awn[1] : awn[0];
          g.beginPath();
          g.arc(-84 + i * 24, bot, 12, 0, Math.PI);
          g.fill();
          g.strokeStyle = dk(awn[0], 0.4);
          g.lineWidth = 1.2;
          g.stroke();
        }
        g.strokeStyle = dk(awn[0], 0.45);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(-96, bot);
        g.lineTo(-80, top);
        g.lineTo(80, top);
        g.lineTo(96, bot);
        g.stroke();
        g.fillStyle = "#fff4d6";
        rr(g, -26, -168, 52, 20, 6);
        g.fill();
        g.strokeStyle = "#5e3417";
        g.stroke();
        g.fillStyle = "#5e3417";
        g.font = "800 14px 'Barlow Condensed', sans-serif";
        g.textAlign = "center";
        g.fillText("MARKET", 0, -153);
      }),
    );
  }
  const board = () =>
    memo("board", () =>
      sprite(150, 150, 75, 140, (g) => {
        g.fillStyle = "#6b4527";
        [-58, 50].forEach((x) => {
          rr(g, x, -120, 8, 120, 3);
          g.fill();
        });
        rr(g, -64, -116, 128, 80, 6);
        g.fillStyle = vg(g, -116, -36, "#c98d52", "#8f5a2c");
        g.fill();
        g.strokeStyle = "#4e2c12";
        g.lineWidth = 2.5;
        g.stroke();
        [
          [-54, -106, "#fff8e6", -0.06],
          [-14, -110, "#ffe4ef", 0.04],
          [22, -104, "#e6f4ff", -0.03],
          [-40, -72, "#fffbd6", 0.05],
          [4, -70, "#e8ffe6", -0.05],
        ].forEach(([x, y, c, r]) => {
          g.save();
          g.translate(x + 14, y + 14);
          g.rotate(r);
          g.fillStyle = c;
          g.fillRect(-14, -14, 30, 28);
          g.fillStyle = "rgba(60,40,20,.35)";
          for (let k = 0; k < 3; k++)
            g.fillRect(-10, -6 + k * 6, 20 - k * 4, 2);
          g.fillStyle = ["#ef4f61", "#4fb3ff", "#ffd65b"][
            Math.abs(Math.round(x)) % 3
          ];
          g.beginPath();
          g.arc(1, -11, 3, 0, 7);
          g.fill();
          g.restore();
        });
        g.beginPath();
        g.moveTo(-74, -114);
        g.lineTo(0, -140);
        g.lineTo(74, -114);
        g.closePath();
        g.fillStyle = vg(g, -140, -114, "#4fb3a8", "#1f6b6a");
        g.fill();
        g.strokeStyle = "#143f40";
        g.lineWidth = 2;
        g.stroke();
      }),
    );
  const well = () =>
    memo("well", () =>
      sprite(120, 150, 60, 138, (g) => {
        g.fillStyle = "#7a5230";
        [-38, 32].forEach((x) => {
          rr(g, x, -100, 7, 74, 2);
          g.fill();
        });
        g.beginPath();
        g.moveTo(-50, -98);
        g.lineTo(0, -128);
        g.lineTo(50, -98);
        g.closePath();
        g.fillStyle = vg(g, -128, -98, "#ff8a6a", "#b03a2e");
        g.fill();
        g.strokeStyle = "#5e1a14";
        g.lineWidth = 2;
        g.stroke();
        g.strokeStyle = "#6b4527";
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(-34, -80);
        g.lineTo(34, -80);
        g.stroke();
        g.strokeStyle = "#c9a36a";
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(0, -80);
        g.lineTo(0, -58);
        g.stroke();
        rr(g, -8, -60, 16, 14, 3);
        g.fillStyle = "#9a6a3a";
        g.fill();
        g.strokeStyle = "#4e2c12";
        g.stroke();
        g.beginPath();
        g.ellipse(0, -30, 44, 14, 0, 0, 7);
        g.fillStyle = "#1f2a3a";
        g.fill();
        g.beginPath();
        g.moveTo(-44, -30);
        g.lineTo(-44, -4);
        g.ellipse(0, -4, 44, 14, 0, Math.PI, 0, true);
        g.lineTo(44, -30);
        g.ellipse(0, -30, 44, 14, 0, 0, Math.PI);
        g.closePath();
        g.fillStyle = vg(g, -30, 8, "#d9d3c4", "#8e8778");
        g.fill();
        g.strokeStyle = "#5e584c";
        g.lineWidth = 2;
        g.stroke();
        g.strokeStyle = "rgba(94,88,76,.6)";
        g.lineWidth = 1;
        for (let k = 0; k < 7; k++) {
          const x = -40 + k * 13;
          g.beginPath();
          g.moveTo(x, -20 + Math.abs(x) * 0.05);
          g.lineTo(x, -6 + 14 * Math.sqrt(Math.max(0, 1 - (x / 44) ** 2)));
          g.stroke();
        }
        g.beginPath();
        g.ellipse(0, -30, 44, 14, 0, 0, 7);
        g.strokeStyle = "#f1ebdc";
        g.lineWidth = 5;
        g.stroke();
      }),
    );
  const doghouse = () =>
    memo("doghouse", () =>
      sprite(150, 130, 70, 120, (g) => {
        g.beginPath();
        g.moveTo(-46, 0);
        g.lineTo(-46, -60);
        g.lineTo(0, -96);
        g.lineTo(46, -60);
        g.lineTo(46, 0);
        g.closePath();
        g.fillStyle = vg(g, -96, 0, "#ffd58a", "#d18a3c");
        g.fill();
        g.strokeStyle = "#7a4a1a";
        g.lineWidth = 2.2;
        g.stroke();
        g.strokeStyle = "rgba(122,74,26,.4)";
        g.lineWidth = 1;
        for (let y = -50; y < 0; y += 12) {
          g.beginPath();
          g.moveTo(-44, y);
          g.lineTo(44, y);
          g.stroke();
        }
        const rp = () => {
          g.beginPath();
          g.moveTo(-58, -56);
          g.lineTo(0, -104);
          g.lineTo(58, -56);
          g.lineTo(50, -50);
          g.lineTo(0, -92);
          g.lineTo(-50, -50);
          g.closePath();
        };
        rp();
        g.fillStyle = vg(g, -104, -50, "#4f8cff", "#2a55c0");
        g.fill();
        g.strokeStyle = "#173078";
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = "#3a2214";
        g.beginPath();
        g.moveTo(-20, 0);
        g.lineTo(-20, -30);
        g.arc(0, -30, 20, Math.PI, 0);
        g.lineTo(20, 0);
        g.fill();
        g.fillStyle = "#ffd65b";
        ell(g, 0, -74, 10, 7);
        g.fill();
        g.fillStyle = "#7a4a1a";
        ell(g, 0, -74, 4, 3);
        g.fill();
        g.fillStyle = "#c9cfdc";
        ell(g, 66, -4, 15, 6);
        g.fill();
        g.fillStyle = "#c48a4a";
        ell(g, 66, -6, 11, 3.5);
        g.fill();
        g.strokeStyle = "#8a93a6";
        g.lineWidth = 1.5;
        ell(g, 66, -4, 15, 6);
        g.stroke();
      }),
    );
  const foodTruck = () =>
    memo("truck", () =>
      sprite(320, 200, 165, 180, (g) => {
        shadow(g, 0, -2, 120, 16, 0.3);
        // body
        rr(g, -116, -138, 232, 118, 22);
        g.fillStyle = vg(g, -138, -20, "#b8f0dc", "#6fd0b4", "#3fa38a");
        g.fill();
        g.strokeStyle = "#1f6b5a";
        g.lineWidth = 2.5;
        g.stroke();
        rr(g, -116, -60, 232, 14, 0);
        g.fillStyle = "#ff9bd2";
        g.fill();
        // cab
        rr(g, 70, -122, 40, 46, 10);
        g.fillStyle = vg(g, -122, -76, "#dff6ff", "#7cb8e0");
        g.fill();
        g.strokeStyle = "#1f6b5a";
        g.lineWidth = 2;
        g.stroke();
        // serving window + counter
        rr(g, -96, -124, 150, 56, 8);
        g.fillStyle = "#2a1f4c";
        g.fill();
        g.strokeStyle = "#1f6b5a";
        g.stroke();
        g.fillStyle = "#3c2f6a";
        g.fillRect(-90, -118, 138, 44);
        [
          ["#c9a36a", -70],
          ["#ff9bd2", -40],
          ["#8fd0ff", -10],
          ["#c47dff", 20],
        ].forEach(([c, x]) => {
          g.fillStyle = "rgba(255,255,255,.85)";
          rr(g, x - 7, -104, 14, 26, 3);
          g.fill();
          g.fillStyle = c;
          rr(g, x - 6, -96, 12, 17, 2);
          g.fill();
          g.fillStyle = "#3a2214";
          for (let k = 0; k < 3; k++) {
            g.beginPath();
            g.arc(x - 3 + k * 3, -82, 1.6, 0, 7);
            g.fill();
          }
          g.fillStyle = "#ffd65b";
          g.fillRect(x + 1, -112, 2, 10);
        });
        rr(g, -104, -70, 166, 10, 4);
        g.fillStyle = "#f6e7cf";
        g.fill();
        g.strokeStyle = "#8a6a3a";
        g.stroke();
        // awning
        g.save();
        g.beginPath();
        g.moveTo(-108, -128);
        g.lineTo(62, -128);
        g.lineTo(74, -150);
        g.lineTo(-120, -150);
        g.closePath();
        g.clip();
        for (let i = 0; i < 9; i++) {
          g.fillStyle = i % 2 ? "#fff6e8" : "#ff6f9a";
          g.fillRect(-120 + i * 22, -152, 22, 26);
        }
        g.restore();
        for (let i = 0; i < 9; i++) {
          g.fillStyle = i % 2 ? "#fff6e8" : "#ff6f9a";
          g.beginPath();
          g.arc(-97 + i * 19, -128, 9.5, 0, Math.PI);
          g.fill();
        }
        // roof sign: giant boba cup
        rr(g, -40, -178, 80, 26, 10);
        g.fillStyle = "#2a1f4c";
        g.fill();
        g.fillStyle = "#ffd84a";
        g.font = "800 16px 'Barlow Condensed', sans-serif";
        g.textAlign = "center";
        g.fillText("VOLT BOBA", 0, -160);
        g.save();
        g.translate(78, -150);
        g.rotate(0.15);
        rr(g, -13, -30, 26, 34, 5);
        g.fillStyle = "rgba(255,255,255,.9)";
        g.fill();
        g.strokeStyle = "#1f6b5a";
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = "#e7b98a";
        rr(g, -11, -20, 22, 22, 3);
        g.fill();
        g.fillStyle = "#3a2214";
        for (let k = 0; k < 5; k++) {
          g.beginPath();
          g.arc(-7 + k * 3.5, -2, 2.4, 0, 7);
          g.fill();
        }
        g.fillStyle = "#ff6f9a";
        g.fillRect(2, -44, 4, 18);
        g.restore();
        // wheels
        [-70, 60].forEach((x) => {
          g.fillStyle = "#1c1f2c";
          g.beginPath();
          g.arc(x, -18, 18, 0, 7);
          g.fill();
          g.fillStyle = "#c9cfdc";
          g.beginPath();
          g.arc(x, -18, 8, 0, 7);
          g.fill();
        });
        // menu board
        g.save();
        g.translate(-138, -4);
        rr(g, -18, -54, 36, 54, 4);
        g.fillStyle = "#2a1f4c";
        g.fill();
        g.strokeStyle = "#8a6a3a";
        g.lineWidth = 3;
        g.stroke();
        g.fillStyle = "#fff";
        g.font = "700 8px 'DM Sans', sans-serif";
        g.textAlign = "center";
        ["MENU", "Volt", "Berry", "Taro"].forEach((t, i) =>
          g.fillText(t, 0, -42 + i * 11),
        );
        g.restore();
        return { glow: [-20, -95] };
      }),
    );
  const gazebo = () =>
    memo("gazebo", () =>
      sprite(150, 170, 75, 158, (g) => {
        g.beginPath();
        g.ellipse(0, -4, 58, 16, 0, 0, 7);
        g.fillStyle = "#e7dfd0";
        g.fill();
        g.strokeStyle = "#a59a86";
        g.lineWidth = 2;
        g.stroke();
        [-48, -16, 16, 48].forEach((x) => {
          g.fillStyle = hg(g, x - 4, x + 4, "#ffffff", "#cfd6e0");
          rr(g, x - 4, -96, 8, 92, 3);
          g.fill();
        });
        g.strokeStyle = "#cfd6e0";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(-50, -30);
        g.lineTo(50, -30);
        g.stroke();
        g.beginPath();
        g.moveTo(-66, -94);
        g.quadraticCurveTo(0, -112, 66, -94);
        g.lineTo(0, -150);
        g.closePath();
        g.fillStyle = vg(g, -150, -94, "#7fe0d0", "#2f9a8a");
        g.fill();
        g.strokeStyle = "#1f5a52";
        g.stroke();
        g.fillStyle = "#ffd65b";
        g.beginPath();
        g.arc(0, -152, 5, 0, 7);
        g.fill();
      }),
    );
  const scarecrow = () =>
    memo("scare", () =>
      sprite(90, 130, 45, 124, (g) => {
        g.fillStyle = "#7a5230";
        rr(g, -3, -100, 6, 100, 2);
        g.fill();
        rr(g, -34, -78, 68, 6, 2);
        g.fill();
        g.beginPath();
        g.moveTo(-26, -80);
        g.lineTo(26, -80);
        g.lineTo(20, -36);
        g.lineTo(-20, -36);
        g.closePath();
        g.fillStyle = vg(g, -80, -36, "#6fa8dc", "#3d6fa3");
        g.fill();
        g.strokeStyle = "#1f3f66";
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = "#e9c46a";
        [
          [-30, -76],
          [30, -76],
          [-18, -36],
          [18, -36],
        ].forEach(([x, y]) => {
          for (let k = 0; k < 3; k++) {
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + (k - 1) * 4 + Math.sign(x) * 6, y + 9);
            g.lineTo(x + (k - 1) * 4 + Math.sign(x) * 3, y + 9);
            g.fill();
          }
        });
        g.fillStyle = "#ffb84a";
        [
          [-14, -60],
          [8, -48],
        ].forEach(([x, y]) => {
          g.fillRect(x, y, 7, 7);
        });
        ball(g, 0, -96, 17, "#ff8a1a", 0.3);
        g.strokeStyle = "rgba(160,70,0,.5)";
        g.lineWidth = 1.2;
        [-8, 0, 8].forEach((x) => {
          g.beginPath();
          g.moveTo(x, -112);
          g.quadraticCurveTo(x * 1.6, -96, x, -80);
          g.stroke();
        });
        g.fillStyle = "#3a1a00";
        [
          [-6, -100],
          [6, -100],
        ].forEach(([x, y]) => {
          g.beginPath();
          g.moveTo(x - 3.5, y + 2);
          g.lineTo(x, y - 3);
          g.lineTo(x + 3.5, y + 2);
          g.fill();
        });
        g.beginPath();
        g.moveTo(-8, -89);
        g.quadraticCurveTo(0, -83, 8, -89);
        g.lineTo(5, -90);
        g.quadraticCurveTo(0, -86, -5, -90);
        g.closePath();
        g.fill();
        g.fillStyle = "#e9c46a";
        ell(g, 0, -110, 26, 6);
        g.fill();
        g.beginPath();
        g.moveTo(-14, -110);
        g.lineTo(-10, -128);
        g.lineTo(10, -128);
        g.lineTo(14, -110);
        g.fill();
        g.fillStyle = "#c0392b";
        g.fillRect(-12, -116, 24, 4);
      }),
    );
  const plinth = () =>
    memo("plinth", () =>
      sprite(90, 70, 45, 62, (g) => {
        rr(g, -36, -20, 72, 20, 4);
        g.fillStyle = vg(g, -20, 0, "#ece4d4", "#b5ab96");
        g.fill();
        g.strokeStyle = "#857a64";
        g.lineWidth = 2;
        g.stroke();
        rr(g, -28, -54, 56, 36, 4);
        g.fillStyle = vg(g, -54, -18, "#f6efe2", "#c4b9a2");
        g.fill();
        g.stroke();
        rr(g, -16, -42, 32, 12, 2);
        g.fillStyle = "#e7c45a";
        g.fill();
      }),
    );
  const sign = (text, bg = "#7a5230") =>
    memo(`sign:${text}`, () =>
      sprite(120, 90, 60, 84, (g) => {
        g.fillStyle = "#6b4527";
        rr(g, -3, -50, 6, 50, 2);
        g.fill();
        g.save();
        g.translate(0, -60);
        g.rotate(-0.04);
        rr(g, -56, -17, 112, 34, 7);
        g.fillStyle = vg(g, -17, 17, lt(bg, 0.25), bg);
        g.fill();
        g.strokeStyle = dk(bg, 0.5);
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = "#fff4d6";
        g.font = "800 18px 'Barlow Condensed', sans-serif";
        g.textAlign = "center";
        g.fillText(text, 0, 6.5);
        g.restore();
      }),
    );

  /* ---------------- animals (drawn per frame, facing +x) ---------------- */
  const BREEDS = {
    gold: {
      b: "#e8a94c",
      l: "#fbe0a8",
      d: "#b5762c",
      ear: "#c4822f",
      fluff: false,
    },
    black: {
      b: "#36303c",
      l: "#d29a5c",
      d: "#1c1820",
      ear: "#26212b",
      fluff: false,
    },
    cream: {
      b: "#f6ecdc",
      l: "#ffffff",
      d: "#d8c6aa",
      ear: "#ead6b8",
      fluff: true,
    },
    corgi: {
      b: "#f0a04a",
      l: "#fff6ea",
      d: "#c07028",
      ear: "#e08a38",
      fluff: false,
      short: true,
    },
  };
  function limb(g, x0, y0, a1, l1, a2, l2, w, c, paw) {
    const x1 = x0 + Math.sin(a1) * l1,
      y1 = y0 + Math.cos(a1) * l1,
      x2 = x1 + Math.sin(a2) * l2,
      y2 = y1 + Math.cos(a2) * l2;
    g.strokeStyle = c;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
    g.fillStyle = paw || c;
    ell(g, x2 + 1.5, y2, w * 0.62, w * 0.42);
    g.fill();
  }
  /** state: walk | run | idle | sit | bark ; phase in radians */
  function dog(g, breed, st, t, x, y, s = 1, face = 1, o = {}) {
    const B = BREEDS[breed] || BREEDS.gold,
      sh = B.short ? 0.7 : 1;
    const run = st === "run",
      walk = st === "walk" || run,
      sit = st === "sit",
      bark = st === "bark";
    const p = t * (run ? 15 : 9.5);
    const bob = walk
      ? -Math.abs(Math.sin(p)) * (run ? 3.2 : 1.6)
      : Math.sin(t * 2.4) * 0.5;
    shadow(g, x, y + 1, 30 * s, 7 * s, 0.3);
    g.save();
    g.translate(x, y);
    g.scale(face * s, s);
    g.lineCap = "round";
    g.lineJoin = "round";
    const hipY = -18 * sh,
      legL = 9 * sh,
      legW = 6.4;
    const gait = run
      ? [0, Math.PI, Math.PI, 0]
      : [0, Math.PI / 2, Math.PI, Math.PI * 1.5]; // backNear, frontNear, backFar, frontFar
    const swing = (k) =>
      walk ? Math.sin(p + gait[k]) * (run ? 0.75 : 0.5) : 0;
    const lift = (k) =>
      walk ? Math.max(0, -Math.cos(p + gait[k])) * (run ? 0.5 : 0.3) : 0;
    const legC = (k) => (k >= 2 ? B.d : B.b);
    // far legs
    if (!sit) {
      limb(
        g,
        -14,
        hipY + bob,
        swing(2) * 0.9,
        legL,
        swing(2) * 0.3 + 0.2 - lift(2),
        legL,
        legW,
        B.d,
        dk(B.d, 0.2),
      );
      limb(
        g,
        13,
        hipY + bob,
        swing(3),
        legL,
        swing(3) * 0.2 - lift(3) * 1.2,
        legL,
        legW,
        B.d,
        dk(B.d, 0.2),
      );
    }
    // tail
    const wag =
      st === "idle" || sit || bark
        ? Math.sin(t * 13) * 0.55
        : Math.sin(p) * 0.25;
    g.save();
    g.translate(sit ? -16 : -21, (sit ? -10 : -26 * sh) + bob);
    g.rotate(-0.9 + wag);
    g.strokeStyle = B.fluff ? B.b : B.b;
    g.lineWidth = B.fluff ? 8 : 5.5;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(-4, -10, 2, -17 * (B.short ? 0.5 : 1));
    g.stroke();
    if (breed === "black") {
      g.strokeStyle = B.l;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(1, -14);
      g.lineTo(2, -17);
      g.stroke();
    }
    g.restore();
    // body
    g.save();
    if (sit) {
      g.translate(-8, -10);
      g.rotate(-0.65);
      g.translate(8, 10);
    }
    const by = (sit ? -16 : -24 * sh) + bob,
      breathe = 1 + Math.sin(t * 2.6) * 0.025;
    g.fillStyle = dk(B.b, 0.45);
    ell(g, 0, by, 23.5, 13 * breathe);
    g.fill();
    const bg = g.createLinearGradient(0, by - 12, 0, by + 12);
    bg.addColorStop(0, lt(B.b, 0.18));
    bg.addColorStop(0.6, B.b);
    bg.addColorStop(1, B.d);
    g.fillStyle = bg;
    ell(g, 0, by, 22, 11.8 * breathe);
    g.fill();
    g.fillStyle = B.l;
    ell(g, 6, by + 6, 13, 5);
    g.fill();
    if (B.fluff) {
      g.fillStyle = lt(B.b, 0.3);
      for (let i = 0; i < 9; i++) {
        g.beginPath();
        g.arc(-18 + i * 4.6, by - 9 + Math.sin(i * 2) * 1.5, 4.2, 0, 7);
        g.fill();
      }
    }
    if (breed === "black") {
      g.fillStyle = B.l;
      ell(g, 15, by + 5, 6, 4);
      g.fill();
    }
    g.restore();
    // near legs
    if (sit) {
      g.fillStyle = B.b;
      ell(g, -12, -7, 10, 7.5);
      g.fill();
      g.fillStyle = B.d;
      ell(g, -6, -1, 6, 2.5);
      g.fill();
      limb(g, 8, -22, 0, 11, 0, 11, legW, B.b, B.l);
      limb(g, 13, -22, -0.05, 11, 0, 11, legW, B.b, B.l);
    } else {
      limb(
        g,
        -12,
        hipY + bob,
        swing(0) * 0.9,
        legL,
        swing(0) * 0.3 + 0.2 - lift(0),
        legL,
        legW,
        B.b,
        breed === "corgi" ? B.l : dk(B.b, 0.1),
      );
      limb(
        g,
        15,
        hipY + bob,
        swing(1),
        legL,
        swing(1) * 0.2 - lift(1) * 1.2,
        legL,
        legW,
        B.b,
        breed === "corgi" ? B.l : dk(B.b, 0.1),
      );
    }
    // head
    const hx = sit ? 16 : 23,
      hy =
        (sit ? -40 : -37 * sh - 2) +
        bob * 0.6 +
        (walk ? Math.sin(p * 2) * 0.6 : Math.sin(t * 1.4) * 0.6);
    g.strokeStyle = dk(B.b, 0.45);
    g.lineWidth = 15;
    g.beginPath();
    g.moveTo(sit ? 8 : 12, (sit ? -26 : -28 * sh) + bob);
    g.lineTo(hx - 3, hy + 3);
    g.stroke();
    g.strokeStyle = B.b;
    g.lineWidth = 12.5;
    g.stroke();
    g.save();
    g.translate(hx, hy);
    g.rotate(bark ? -0.25 : (o.look ?? 0));
    // far ear
    const earSw = walk
      ? Math.sin(p * 2 - 0.8) * 0.25
      : Math.sin(t * 3) * 0.06 + ((t * 1.3) % 5 < 0.15 ? 0.35 : 0);
    g.fillStyle = dk(B.ear, 0.25);
    if (breed === "corgi") {
      g.beginPath();
      g.moveTo(-6, -8);
      g.lineTo(-10, -22);
      g.lineTo(-1, -12);
      g.fill();
    } else {
      g.save();
      g.translate(-4, -8);
      g.rotate(0.3 + earSw);
      ell(g, -2, 8, 4.5, 9);
      g.fill();
      g.restore();
    }
    g.fillStyle = dk(B.b, 0.45);
    g.beginPath();
    g.arc(0, 0, 11.6, 0, 7);
    g.fill();
    const hgr = g.createRadialGradient(-3, -4, 1, 0, 0, 12);
    hgr.addColorStop(0, lt(B.b, 0.25));
    hgr.addColorStop(1, B.b);
    g.fillStyle = hgr;
    g.beginPath();
    g.arc(0, 0, 10.6, 0, 7);
    g.fill();
    if (B.fluff) {
      g.fillStyle = lt(B.b, 0.35);
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.arc(-7 + i * 3.5, -9 + Math.abs(i - 2), 3.6, 0, 7);
        g.fill();
      }
    }
    // muzzle + jaw
    const jaw = bark
      ? 0.45 + Math.abs(Math.sin(t * 20)) * 0.2
      : o.pant
        ? 0.2
        : 0;
    g.save();
    g.translate(7, 4);
    g.rotate(jaw);
    g.fillStyle = dk(B.l, 0.1);
    ell(g, 3, 2, 6.5, 3);
    g.fill();
    if (jaw > 0.1) {
      g.fillStyle = "#ff7a8a";
      ell(g, 4, 4, 3.5, 2.5);
      g.fill();
    }
    g.restore();
    if (jaw > 0.1) {
      g.fillStyle = "#5a1a24";
      ell(g, 9, 4.5, 4, 2);
      g.fill();
    }
    g.fillStyle = B.l;
    ell(g, 8, 2, 7.5, 5.2);
    g.fill();
    g.fillStyle = "#1c1820";
    ell(g, 15, 0.5, 2.8, 2.2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,.6)";
    g.beginPath();
    g.arc(14.3, -0.2, 0.8, 0, 7);
    g.fill();
    // eye (blink)
    const blink = (t * 0.9 + x * 0.01) % 4 < 0.12;
    if (blink) {
      g.strokeStyle = "#1c1820";
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(3.5, -3, 2.2, 0.2, Math.PI - 0.2);
      g.stroke();
    } else {
      g.fillStyle = "#1c1820";
      g.beginPath();
      g.arc(3.5, -3, 2.4, 0, 7);
      g.fill();
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(4.3, -3.8, 0.9, 0, 7);
      g.fill();
    }
    if (breed === "black") {
      g.fillStyle = B.l;
      ell(g, 2.5, -7, 2, 1.2);
      g.fill();
    }
    // near ear
    g.fillStyle = B.ear;
    if (breed === "corgi") {
      g.beginPath();
      g.moveTo(-3, -9);
      g.lineTo(-2, -24);
      g.lineTo(5, -10);
      g.fill();
      g.fillStyle = "#ffc0a8";
      g.beginPath();
      g.moveTo(-1.5, -11);
      g.lineTo(-1.2, -20);
      g.lineTo(2.5, -11);
      g.fill();
    } else {
      g.save();
      g.translate(-2, -8);
      g.rotate(-0.1 + earSw);
      ell(g, -1, 8, 4.8, 9.5);
      g.fill();
      g.restore();
    }
    g.restore();
    // collar
    g.strokeStyle = o.collar || "#ef4f61";
    g.lineWidth = 3.4;
    g.beginPath();
    g.moveTo(hx - 11, hy + 8);
    g.quadraticCurveTo(hx - 6, hy + 13, hx - 1, hy + 10);
    g.stroke();
    g.fillStyle = "#ffd65b";
    g.beginPath();
    g.arc(hx - 5, hy + 13.5, 2.2, 0, 7);
    g.fill();
    g.restore();
  }
  function chicken(g, kind, st, t, x, y, s = 1, face = 1) {
    const C =
      kind === "brown"
        ? { b: "#c8743a", l: "#e8a26a", d: "#8a4a22" }
        : { b: "#fbf7ef", l: "#ffffff", d: "#d7cfc0" };
    const walk = st === "walk",
      peck = st === "peck",
      p = t * 11;
    shadow(g, x, y + 1, 15 * s, 4.5 * s, 0.28);
    g.save();
    g.translate(x, y);
    g.scale(face * s, s);
    // legs
    const step = walk ? Math.sin(p) * 4 : 0;
    g.strokeStyle = "#f2a93a";
    g.lineWidth = 2;
    [
      [-2, step],
      [3, -step],
    ].forEach(([lx, d]) => {
      const lift = walk
        ? Math.max(0, Math.sin(p + (d > 0 ? 0 : Math.PI))) * 2
        : 0;
      g.beginPath();
      g.moveTo(lx, -9);
      g.lineTo(lx + d * 0.5, -lift);
      g.stroke();
      g.beginPath();
      g.moveTo(lx + d * 0.5 - 2.5, -lift);
      g.lineTo(lx + d * 0.5 + 3, -lift);
      g.stroke();
    });
    const bob = walk ? -Math.abs(Math.sin(p)) * 1.5 : 0,
      tilt = peck ? Math.max(0, Math.sin(t * 9)) * 0.5 : 0;
    g.save();
    g.translate(0, -12 + bob);
    g.rotate(tilt);
    // tail
    [
      [-10, -6, -1.1],
      [-12, -3, -0.75],
      [-11, 0, -0.45],
    ].forEach(([tx, ty, a], i) => {
      g.save();
      g.translate(tx, ty);
      g.rotate(a);
      g.fillStyle = i === 1 ? C.d : C.b;
      ell(g, 0, -6, 3.2, 7.5);
      g.fill();
      g.restore();
    });
    if (kind === "brown") {
      g.fillStyle = "#3a5a3a";
      g.save();
      g.translate(-12, -6);
      g.rotate(-1);
      ell(g, 0, -5, 2.5, 7);
      g.fill();
      g.restore();
    }
    g.fillStyle = dk(C.b, 0.35);
    ell(g, 0, 0, 12.5, 10.5);
    g.fill();
    const bgr = g.createRadialGradient(-3, -4, 1, 0, 0, 12);
    bgr.addColorStop(0, C.l);
    bgr.addColorStop(1, C.b);
    g.fillStyle = bgr;
    ell(g, 0, 0, 11.5, 9.6);
    g.fill();
    // wing
    const flap = st === "flap" ? Math.sin(t * 30) * 0.6 : 0;
    g.save();
    g.translate(-1, -1);
    g.rotate(-flap);
    g.fillStyle = C.d;
    ell(g, -2, 1, 7.5, 5.4, -0.2);
    g.fill();
    g.strokeStyle = rgba(dk(C.d, 0.3), 0.6);
    g.lineWidth = 0.9;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.arc(-5 + k * 3, 4, 3, 0.3, Math.PI - 0.3);
      g.stroke();
    }
    g.restore();
    // head
    const hx = 9 + (peck ? Math.max(0, Math.sin(t * 9)) * 4 : 0),
      hy = -10 + (peck ? Math.max(0, Math.sin(t * 9)) * 9 : 0);
    g.fillStyle = "#e63c32";
    [
      [hx - 3, hy - 6],
      [hx, hy - 7.5],
      [hx + 3, hy - 6],
    ].forEach(([cx, cy]) => {
      g.beginPath();
      g.arc(cx, cy, 2.6, 0, 7);
      g.fill();
    });
    g.fillStyle = dk(C.b, 0.3);
    g.beginPath();
    g.arc(hx, hy, 6.3, 0, 7);
    g.fill();
    g.fillStyle = C.b;
    g.beginPath();
    g.arc(hx, hy, 5.6, 0, 7);
    g.fill();
    g.fillStyle = "#f2a93a";
    g.beginPath();
    g.moveTo(hx + 5, hy - 1.5);
    g.lineTo(hx + 10, hy);
    g.lineTo(hx + 5, hy + 1.6);
    g.fill();
    g.fillStyle = "#e63c32";
    ell(g, hx + 4, hy + 4, 1.6, 2.4);
    g.fill();
    g.fillStyle = "#1c1820";
    g.beginPath();
    g.arc(hx + 2, hy - 1.5, 1.3, 0, 7);
    g.fill();
    g.restore();
    g.restore();
  }
  function duck(g, kind, st, t, x, y, s = 1, face = 1, moving = true) {
    const drake = kind === "drake";
    g.save();
    g.translate(x, y);
    g.scale(face * s, s);
    // ripples
    const k = (t * 0.8) % 1;
    g.strokeStyle = `rgba(255,255,255,${0.45 * (1 - k)})`;
    g.lineWidth = 1.2;
    ell(g, 0, 1, 14 + k * 16, 4 + k * 4);
    g.stroke();
    if (moving && st !== "dabble") {
      g.strokeStyle = "rgba(255,255,255,.35)";
      g.beginPath();
      g.moveTo(-14, 1);
      g.lineTo(-34, -3);
      g.moveTo(-14, 2);
      g.lineTo(-34, 6);
      g.stroke();
    }
    const bob = Math.sin(t * 2.2) * 1;
    g.save();
    g.beginPath();
    g.rect(-60, -60, 120, 61.5);
    g.clip();
    g.translate(0, bob);
    if (st === "dabble") {
      g.rotate(1.25);
      g.translate(4, 4);
    }
    const body = drake ? "#ece6da" : "#a77b4f",
      back = drake ? "#7d7a74" : "#8a6038";
    g.fillStyle = dk(body, 0.4);
    g.beginPath();
    g.moveTo(-18, -9);
    g.quadraticCurveTo(-8, -16, 6, -13);
    g.quadraticCurveTo(15, -11, 14, -2);
    g.quadraticCurveTo(12, 4, 0, 4);
    g.lineTo(-12, 3);
    g.quadraticCurveTo(-18, -2, -18, -9);
    g.fill();
    const bg = g.createLinearGradient(0, -14, 0, 4);
    bg.addColorStop(0, lt(body, 0.15));
    bg.addColorStop(1, dk(body, 0.1));
    g.fillStyle = bg;
    g.beginPath();
    g.moveTo(-16.5, -9);
    g.quadraticCurveTo(-8, -15, 6, -12);
    g.quadraticCurveTo(13.5, -10, 12.8, -2);
    g.quadraticCurveTo(11, 3, 0, 3);
    g.lineTo(-11, 2);
    g.quadraticCurveTo(-16.5, -2, -16.5, -9);
    g.fill();
    if (drake) {
      g.fillStyle = "#7a3e26";
      ell(g, 9, -6, 5.5, 5.5);
      g.fill();
      g.fillStyle = "#1c1820";
      g.beginPath();
      g.moveTo(-17, -9);
      g.lineTo(-22, -13);
      g.lineTo(-15, -6);
      g.fill();
    } else {
      g.fillStyle = "rgba(80,50,20,.4)";
      for (let i = 0; i < 10; i++) {
        g.beginPath();
        g.arc(-12 + (i % 5) * 5, -8 + Math.floor(i / 5) * 5, 1.2, 0, 7);
        g.fill();
      }
    }
    g.fillStyle = back;
    ell(g, -4, -9, 9, 3.6, -0.12);
    g.fill();
    g.fillStyle = "#3a6bd8";
    ell(g, -3, -7.5, 4, 1.4, -0.1);
    g.fill();
    if (st === "dabble") {
      g.fillStyle = "#ff9a3a";
      const kick = Math.sin(t * 16) * 3;
      ell(g, -6 + kick, 3, 3.5, 1.6);
      g.fill();
      ell(g, -2 - kick, 3, 3.5, 1.6);
      g.fill();
    }
    // neck + head
    g.fillStyle = drake ? "#2d7a3c" : body;
    ell(g, 10, -15, 4, 6);
    g.fill();
    if (drake) {
      g.fillStyle = "#fff";
      ell(g, 10, -11.5, 4.4, 1.3);
      g.fill();
    }
    const hc = drake ? "#2d8a46" : "#9a7048";
    const hg2 = g.createRadialGradient(10, -23, 1, 12, -21, 7);
    hg2.addColorStop(0, lt(hc, 0.35));
    hg2.addColorStop(1, hc);
    g.fillStyle = dk(hc, 0.4);
    g.beginPath();
    g.arc(12, -21, 6.6, 0, 7);
    g.fill();
    g.fillStyle = hg2;
    g.beginPath();
    g.arc(12, -21, 5.9, 0, 7);
    g.fill();
    g.fillStyle = drake ? "#f2d03a" : "#e8902a";
    g.beginPath();
    g.moveTo(16, -22.5);
    g.quadraticCurveTo(24, -22, 23, -19.5);
    g.quadraticCurveTo(19, -18.5, 16, -19);
    g.fill();
    g.fillStyle = "#1c1820";
    g.beginPath();
    g.arc(14, -23, 1.2, 0, 7);
    g.fill();
    g.restore();
    g.fillStyle = "rgba(255,255,255,.28)";
    ell(g, 0, 1.5, 17, 2.2);
    g.fill();
    g.restore();
  }
  function bird(g, kind, st, t, x, y, s = 1, face = 1) {
    const C = {
      crow: { b: "#2a2836", l: "#4a4a6a", w: "#1c1a26", beak: "#8a8f9c" },
      pigeon: { b: "#a5aec2", l: "#d8dde8", w: "#8a93a8", beak: "#3a3a46" },
      sparrow: { b: "#9a6a3e", l: "#e9d2b0", w: "#6e4524", beak: "#e0a24a" },
    }[kind];
    const fly = st === "fly";
    g.save();
    g.translate(x, y);
    g.scale(face * s, s);
    if (fly) {
      const a = Math.sin(t * 17) * 0.9;
      g.save();
      g.translate(-1, -2);
      g.rotate(-0.4 - a);
      g.fillStyle = dk(C.w, 0.2);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(-6, -12, -4, -22);
      g.lineTo(0, -18);
      g.lineTo(2, -21);
      g.lineTo(4, -15);
      g.quadraticCurveTo(6, -6, 6, 0);
      g.fill();
      g.restore();
      g.fillStyle = C.b;
      ell(g, 0, 0, 11, 5.5);
      g.fill();
      g.fillStyle = C.w;
      g.beginPath();
      g.moveTo(-9, -1);
      g.lineTo(-18, -4);
      g.lineTo(-18, 3);
      g.closePath();
      g.fill();
      g.fillStyle = C.b;
      g.beginPath();
      g.arc(10, -2, 5, 0, 7);
      g.fill();
      g.fillStyle = C.beak;
      g.beginPath();
      g.moveTo(14, -3);
      g.lineTo(20, -1.5);
      g.lineTo(14, 0);
      g.fill();
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(11.5, -3, 1.4, 0, 7);
      g.fill();
      g.fillStyle = "#111";
      g.beginPath();
      g.arc(11.8, -3, 0.8, 0, 7);
      g.fill();
      g.save();
      g.translate(0, -1);
      g.rotate(-0.2 + a);
      g.fillStyle = C.w;
      g.beginPath();
      g.moveTo(-2, 0);
      g.quadraticCurveTo(-8, -12, -6, -24);
      g.lineTo(-1, -20);
      g.lineTo(1, -23);
      g.lineTo(3, -17);
      g.quadraticCurveTo(6, -7, 5, 0);
      g.fill();
      g.restore();
    } else {
      const walk = st === "walk",
        peck = st === "peck",
        p = t * 10;
      shadow(g, 0, 1, 11, 3, 0.25);
      const step = walk ? Math.sin(p) * 2.5 : 0;
      g.strokeStyle = kind === "pigeon" ? "#e07a8a" : "#3a3a46";
      g.lineWidth = 1.6;
      [
        [-2, step],
        [2, -step],
      ].forEach(([lx, d]) => {
        g.beginPath();
        g.moveTo(lx, -6);
        g.lineTo(lx + d * 0.4, 0);
        g.stroke();
      });
      const tilt = peck ? Math.max(0, Math.sin(t * 8)) * 0.55 : 0;
      g.save();
      g.translate(0, -9);
      g.rotate(tilt);
      g.fillStyle = C.w;
      g.beginPath();
      g.moveTo(-8, -1);
      g.lineTo(-17, 1);
      g.lineTo(-15, 4);
      g.lineTo(-7, 3);
      g.fill();
      g.fillStyle = dk(C.b, 0.35);
      ell(g, 0, 0, 10, 6.8);
      g.fill();
      g.fillStyle = C.b;
      ell(g, 0, -0.4, 9, 6);
      g.fill();
      g.fillStyle = C.w;
      ell(g, -3, -0.5, 6, 3.6, -0.15);
      g.fill();
      if (kind === "pigeon") {
        g.fillStyle = "#4b5468";
        g.fillRect(-6, -1.5, 1.5, 4);
        g.fillRect(-3, -1.5, 1.5, 4);
      }
      const hb = walk ? ((p / Math.PI) % 1 < 0.5 ? 2.5 : -1) : 0;
      const hx = 8 + hb,
        hy = -6;
      if (kind === "pigeon") {
        const ng = g.createLinearGradient(hx - 4, hy, hx + 2, hy + 6);
        ng.addColorStop(0, "#6fcf8a");
        ng.addColorStop(1, "#b07ad8");
        g.fillStyle = ng;
        ell(g, hx - 2, hy + 3, 4.4, 4);
        g.fill();
      }
      g.fillStyle = kind === "pigeon" ? "#8a93a8" : C.b;
      g.beginPath();
      g.arc(hx, hy, 4.2, 0, 7);
      g.fill();
      g.fillStyle = C.beak;
      g.beginPath();
      g.moveTo(hx + 3.5, hy - 1);
      g.lineTo(hx + 8, hy + 0.3);
      g.lineTo(hx + 3.5, hy + 1.4);
      g.fill();
      g.fillStyle = kind === "pigeon" ? "#ff8a3a" : "#fff";
      g.beginPath();
      g.arc(hx + 1.4, hy - 1.2, 1.3, 0, 7);
      g.fill();
      g.fillStyle = "#111";
      g.beginPath();
      g.arc(hx + 1.6, hy - 1.2, 0.7, 0, 7);
      g.fill();
      g.restore();
    }
    g.restore();
  }
  function cow(g, st, t, x, y, s = 1, face = 1) {
    shadow(g, x, y + 2, 46 * s, 10 * s, 0.3);
    g.save();
    g.translate(x, y);
    g.scale(face * s, s);
    const graze = st === "graze",
      head = graze
        ? Math.max(0, Math.min(1, Math.sin(t * 0.45) * 1.6 + 0.7))
        : 0,
      chew = Math.sin(t * 8) * 0.8;
    // legs
    g.fillStyle = "#e9e3d8";
    [
      [-24, 1],
      [18, 1],
    ].forEach(([lx]) => {
      rr(g, lx - 3, -24, 8, 24, 3);
      g.fillStyle = "#c9c2b4";
      g.fill();
    });
    // tail
    const sw = Math.sin(t * 2.3) * 0.4;
    g.save();
    g.translate(-32, -40);
    g.rotate(0.3 + sw);
    g.strokeStyle = "#e9e3d8";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(-4, 14, -2, 24);
    g.stroke();
    g.fillStyle = "#2a2430";
    ell(g, -2, 26, 3, 5);
    g.fill();
    g.restore();
    // body
    rr(g, -36, -56, 70, 34, 16);
    g.fillStyle = "#3a3440";
    g.fill();
    rr(g, -35, -55, 68, 32, 15);
    const bg = g.createLinearGradient(0, -55, 0, -23);
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(1, "#d8d2c6");
    g.fillStyle = bg;
    g.fill();
    g.save();
    rr(g, -35, -55, 68, 32, 15);
    g.clip();
    g.fillStyle = "#2a2430";
    [
      [-20, -48, 10, 7],
      [6, -40, 12, 8],
      [-8, -28, 7, 5],
      [24, -52, 7, 6],
    ].forEach(([sx, sy, rx, ry]) => {
      ell(g, sx, sy, rx, ry, 0.4);
      g.fill();
    });
    g.restore();
    g.fillStyle = "#ffb3c1";
    ell(g, -10, -22, 7, 4);
    g.fill();
    g.fillStyle = "#f2ece0";
    [
      [-26, 0],
      [16, 0],
    ].forEach(([lx]) => {
      rr(g, lx - 3, -28, 8, 28, 3);
      g.fill();
      g.fillStyle = "#3a3440";
      rr(g, lx - 3, -4, 8, 5, 2);
      g.fill();
      g.fillStyle = "#f2ece0";
    });
    // head on a neck: up (looking) to down (grazing)
    const na = -0.25 + head * 1.45,
      nx = 30 + Math.cos(na) * 26,
      ny = -46 + Math.sin(na) * 26;
    g.strokeStyle = "#3a3440";
    g.lineWidth = 17;
    g.beginPath();
    g.moveTo(26, -46);
    g.lineTo(nx, ny);
    g.stroke();
    g.strokeStyle = "#f4efe6";
    g.lineWidth = 14.5;
    g.stroke();
    g.save();
    g.translate(nx + 4, ny);
    g.rotate(head * 0.35);
    g.fillStyle = "#c9b9a0";
    [
      [-3, -12, -0.6],
      [8, -12, 0.6],
    ].forEach(([hx, hy, r]) => {
      g.save();
      g.translate(hx, hy);
      g.rotate(r);
      ell(g, 0, -3, 2, 4.5);
      g.fill();
      g.restore();
    });
    const earF = t % 6 < 0.2 ? 0.6 : 0;
    g.fillStyle = "#3a3440";
    g.save();
    g.translate(-4, -6);
    g.rotate(-0.6 - earF);
    ell(g, -5, 0, 6, 3);
    g.fill();
    g.restore();
    rr(g, -6, -12, 20, 24, 9);
    g.fillStyle = "#ffffff";
    g.fill();
    g.strokeStyle = "#3a3440";
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = "#2a2430";
    ell(g, 0, -6, 5, 4);
    g.fill();
    g.fillStyle = "#ffb3c1";
    rr(g, -4, 4 + (graze && head > 0.7 ? chew * 0.6 : 0), 20, 11, 6);
    g.fill();
    g.fillStyle = "#c97a8a";
    ell(g, 2, 9, 1.6, 1.2);
    ell(g, 9, 9, 1.6, 1.2);
    g.fill();
    if (head < 0.5) {
      g.fillStyle = "#1c1820";
      g.beginPath();
      g.arc(5, -3, 1.8, 0, 7);
      g.fill();
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(5.5, -3.6, 0.6, 0, 7);
      g.fill();
    } else {
      g.strokeStyle = "#1c1820";
      g.lineWidth = 1.3;
      g.beginPath();
      g.arc(5, -3, 1.8, 0.2, Math.PI - 0.2);
      g.stroke();
    }
    g.restore();
    g.fillStyle = "#ffd65b";
    g.beginPath();
    g.arc(28 + Math.cos(na) * 10, -40 + Math.sin(na) * 10, 3.5, 0, 7);
    g.fill();
    if (graze && head > 0.8) {
      g.fillStyle = "#5fbf4f";
      for (let k = 0; k < 5; k++) {
        g.beginPath();
        g.moveTo(nx - 6 + k * 4, 0);
        g.lineTo(nx - 4 + k * 4, -6 - (k % 2) * 3);
        g.lineTo(nx - 2 + k * 4, 0);
        g.fill();
      }
    }
    g.restore();
  }
  function cat(g, st, t, x, y, s = 1, face = 1) {
    g.save();
    g.translate(x, y);
    g.scale(face * s, s);
    const b = "#f2a556",
      d = "#c8742e",
      br = 1 + Math.sin(t * 1.8) * 0.04,
      awake = st === "awake";
    // tail wraps
    const flick =
      Math.sin(t * 2) * 0.2 + (t % 5 < 0.4 ? Math.sin(t * 30) * 0.2 : 0);
    g.strokeStyle = b;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(-14, -4);
    g.quadraticCurveTo(-4, 6, 12, 2 + flick * 6);
    g.stroke();
    g.fillStyle = dk(b, 0.4);
    ell(g, -2, -8, 17, 9.5 * br);
    g.fill();
    g.fillStyle = b;
    ell(g, -2, -8.5, 16, 8.6 * br);
    g.fill();
    g.strokeStyle = d;
    g.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(-10 + k * 6, -14, 4, 0.3, 1.2);
      g.stroke();
    }
    const hy = awake ? -20 : -9,
      hx = 12;
    g.fillStyle = b;
    [
      [-6, -7, -5, -15, 1, -9],
      [2, -8, 5, -16, 7, -6],
    ].forEach(([a, b1, c, d1, e, f]) => {
      g.beginPath();
      g.moveTo(hx + a, hy + b1);
      g.lineTo(hx + c, hy + d1 - (t % 7 < 0.15 ? 2 : 0));
      g.lineTo(hx + e, hy + f);
      g.fill();
    });
    g.fillStyle = dk(b, 0.4);
    g.beginPath();
    g.arc(hx, hy, 8.4, 0, 7);
    g.fill();
    g.fillStyle = b;
    g.beginPath();
    g.arc(hx, hy, 7.6, 0, 7);
    g.fill();
    g.fillStyle = "#fff4e6";
    ell(g, hx + 3, hy + 3, 4.5, 3);
    g.fill();
    g.fillStyle = "#ff8a9a";
    g.beginPath();
    g.arc(hx + 4, hy + 1.6, 1.2, 0, 7);
    g.fill();
    g.strokeStyle = "#3a2214";
    g.lineWidth = 1.2;
    if (awake) {
      g.fillStyle = "#4a9a4a";
      [hx - 2, hx + 4].forEach((ex) => {
        ell(g, ex, hy - 2, 1.6, 2.2);
        g.fill();
      });
    } else {
      [hx - 2, hx + 4].forEach((ex) => {
        g.beginPath();
        g.arc(ex, hy - 2, 1.8, 0.2, Math.PI - 0.2);
        g.stroke();
      });
    }
    g.fillStyle = b;
    ell(g, hx + 2, -2, 6, 3);
    g.fill();
    if (!awake) {
      const k = (t * 0.6) % 1;
      g.fillStyle = `rgba(255,255,255,${1 - k})`;
      g.font = `700 ${8 + k * 6}px 'DM Sans', sans-serif`;
      g.fillText("z", hx + 10 + k * 8, hy - 10 - k * 16);
    }
    g.restore();
  }
  function butterfly(g, t, x, y, c = "#ffb3d1", s = 1) {
    const f = Math.abs(Math.sin(t * 16));
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    shadow(g, 0, 18, 5, 1.6, 0.18);
    g.fillStyle = c;
    g.strokeStyle = dk(c, 0.45);
    g.lineWidth = 0.8;
    [-1, 1].forEach((sd) => {
      g.save();
      g.scale(sd * (0.25 + f * 0.75), 1);
      ell(g, 4.5, -2, 4.5, 3.6, -0.4);
      g.fill();
      g.stroke();
      ell(g, 3.5, 2.5, 3, 2.6, 0.4);
      g.fill();
      g.stroke();
      g.restore();
    });
    g.fillStyle = "#2a2430";
    ell(g, 0, 0, 1, 4);
    g.fill();
    g.restore();
  }
  function fish(g, t, x, y, a, c = "#ff8a3d", jump = 0) {
    g.save();
    g.translate(x, y - jump);
    g.rotate(a);
    if (!jump) {
      g.globalAlpha = 0.45;
      g.fillStyle = "#0e4f6a";
    } else g.fillStyle = c;
    const sw = Math.sin(t * 10) * 0.3;
    ell(g, 0, 0, 10, 4);
    g.fill();
    g.beginPath();
    g.moveTo(-8, 0);
    g.lineTo(-15, -4 + sw * 6);
    g.lineTo(-15, 4 + sw * 6);
    g.fill();
    if (jump) {
      g.fillStyle = "#fff";
      ell(g, 2, -1, 4, 2);
      g.fill();
    }
    g.restore();
  }
  return {
    R,
    mix,
    lt,
    dk,
    rgba,
    rnd,
    srand,
    sprite,
    blit,
    shadow,
    ball,
    tree,
    drawTree,
    bush,
    rock,
    lamp,
    bench,
    flowerbed,
    crates,
    hay,
    mailbox,
    house,
    barn,
    windmillBody,
    windmillSails,
    stall,
    board,
    well,
    doghouse,
    foodTruck,
    gazebo,
    scarecrow,
    plinth,
    sign,
    dog,
    chicken,
    duck,
    bird,
    cow,
    cat,
    butterfly,
    fish,
    BREEDS,
  };
})();

export { GFX };
