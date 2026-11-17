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
  /* The Bakery (farm-bakery.ts): a cinnamon-roofed cottage with striped
     awnings, a brick oven at its side, a loaf on a hanging sign and a flour
     sack by the door. Built on house(), so it shares its light and lines.
     Meta: win (windows), chimney (smoke) and mouth (the oven's glow). */
  const bakery = () =>
    memo("bakery", () => {
      const hs = house({
        wall: "#ffe9cc",
        roof: "#b0583a",
        door: "#8a4a2a",
        shutters: "",
        flowers: false,
        w: 140,
        hgt: 86,
        roofH: 60,
        depth: 28,
        sd: 21,
      });
      return sprite(270, 222, 134, 198, (g) => {
        g.drawImage(hs.c, -hs.ax, -hs.ay, hs.w, hs.h);
        const x0 = -70,
          x1 = 70,
          top = -86;
        // Striped awnings over the windows, scalloped at the bottom.
        for (const [wx, wy, ww] of hs.win) {
          const ax0 = wx - 9,
            ax1 = wx + ww + 9,
            ay = wy - 9,
            n = 5,
            sw = (ax1 - ax0) / n;
          for (let k = 0; k < n; k++) {
            g.beginPath();
            g.moveTo(ax0 + k * sw + 2, ay - 4);
            g.lineTo(ax0 + (k + 1) * sw + 2, ay - 4);
            g.lineTo(ax0 + (k + 1) * sw, ay + 9);
            g.arc(ax0 + (k + 0.5) * sw, ay + 9, sw / 2, 0, Math.PI);
            g.closePath();
            g.fillStyle =
              k % 2
                ? vg(g, ay - 4, ay + 14, "#fffaf0", "#f1dcc4")
                : vg(g, ay - 4, ay + 14, "#ff9bb0", "#e0607d");
            g.fill();
          }
          g.strokeStyle = "#8a3044";
          g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(ax0 + 2, ay - 4);
          g.lineTo(ax1 + 2, ay - 4);
          g.stroke();
          g.fillStyle = "rgba(255,255,255,.35)";
          g.fillRect(ax0 + 3, ay - 3, ax1 - ax0 - 2, 2);
        }
        // A loaf on a round sign, hung from a bracket at the corner.
        g.strokeStyle = "#3a2a1c";
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(x1 - 2, top + 12);
        g.lineTo(x1 + 24, top + 12);
        g.moveTo(x1 + 18, top + 12);
        g.lineTo(x1 + 18, top + 18);
        g.stroke();
        ball(g, x1 + 18, top + 31, 13, "#7a5230", 0.3);
        g.strokeStyle = "#4a2f18";
        g.lineWidth = 1.8;
        g.beginPath();
        g.arc(x1 + 18, top + 31, 13, 0, 7);
        g.stroke();
        ell(g, x1 + 18, top + 32, 9, 5.5);
        g.fillStyle = vg(g, top + 26, top + 38, "#ffd27a", "#d48a32");
        g.fill();
        g.strokeStyle = "#8a4a1a";
        g.lineWidth = 1.2;
        g.stroke();
        g.strokeStyle = "#fff1c9";
        g.lineWidth = 1.2;
        for (const dx of [-4, 0, 4]) {
          g.beginPath();
          g.moveTo(x1 + 18 + dx - 1.5, top + 34);
          g.lineTo(x1 + 18 + dx + 1.5, top + 29.5);
          g.stroke();
        }
        // A flour sack by the door.
        const fx = x1 - 22;
        g.beginPath();
        g.moveTo(fx - 11, -1);
        g.quadraticCurveTo(fx - 13, -18, fx - 6, -24);
        g.lineTo(fx + 6, -24);
        g.quadraticCurveTo(fx + 13, -18, fx + 11, -1);
        g.closePath();
        g.fillStyle = vg(g, -24, 0, "#fbf3e2", "#d9c9a8");
        g.fill();
        g.strokeStyle = "#8a7656";
        g.lineWidth = 1.6;
        g.stroke();
        g.fillStyle = "#c9a26a";
        rr(g, fx - 7, -27, 14, 5, 2);
        g.fill();
        g.fillStyle = "#e0607d";
        g.font = "900 8px 'Barlow Condensed', sans-serif";
        g.textAlign = "center";
        g.fillText("FLOUR", fx, -9);
        // The brick oven: a dome at the left, its mouth aglow.
        const ox = x0 - 26,
          orad = 30;
        g.beginPath();
        g.moveTo(ox - orad, 2);
        g.arc(ox, 2, orad, Math.PI, 0);
        g.closePath();
        g.fillStyle = (() => {
          const gr = g.createRadialGradient(ox - 10, -18, 4, ox, 0, orad + 6);
          gr.addColorStop(0, "#f0a07a");
          gr.addColorStop(0.55, "#c9603e");
          gr.addColorStop(1, "#8a3a24");
          return gr;
        })();
        g.fill();
        g.save();
        g.clip();
        g.strokeStyle = "rgba(90,30,16,.45)";
        g.lineWidth = 1.2;
        for (let r = 9; r < orad; r += 9) {
          g.beginPath();
          g.arc(ox, 2, r, Math.PI, 0);
          g.stroke();
        }
        for (let a = 0.25; a < Math.PI; a += 0.42) {
          g.beginPath();
          g.moveTo(ox - Math.cos(a) * 9, 2 - Math.sin(a) * 9);
          g.lineTo(ox - Math.cos(a) * orad, 2 - Math.sin(a) * orad);
          g.stroke();
        }
        g.restore();
        g.strokeStyle = "#5a2414";
        g.lineWidth = 2.2;
        g.beginPath();
        g.arc(ox, 2, orad, Math.PI, 0);
        g.stroke();
        // The mouth.
        g.beginPath();
        g.moveTo(ox - 12, 1);
        g.lineTo(ox - 12, -8);
        g.arc(ox, -8, 12, Math.PI, 0);
        g.lineTo(ox + 12, 1);
        g.closePath();
        g.fillStyle = vg(g, -20, 1, "#3a1a10", "#1c0c08");
        g.fill();
        g.strokeStyle = "#e8b48a";
        g.lineWidth = 2.4;
        g.stroke();
        // A stone slab under it.
        rr(g, ox - orad - 4, -1, orad * 2 + 8, 6, 3);
        g.fillStyle = vg(g, -1, 5, "#c9c3b6", "#8e8778");
        g.fill();
        g.strokeStyle = "#5e584c";
        g.lineWidth = 1.2;
        g.stroke();
        return {
          win: hs.win,
          chimney: hs.chimney,
          mouth: [ox, -7],
        };
      });
    });
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
        // The farm names the barn with a tag above it (farm-scene nameTag).
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
        // The farm names the market with a tag above it (farm-scene nameTag).
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
  /* The Chicken Coop (20261117100000): a little wooden hen house on stilts
     with a shingled roof, a round window that glows at night, a hatch and a
     ramp, and nest boxes on the side. Anchored at the middle of its base. */
  const COOP_S = 1.3;
  const coop = () =>
    memo("coop", () =>
      sprite(170 * COOP_S, 160 * COOP_S, 82 * COOP_S, 148 * COOP_S, (g) => {
        g.scale(COOP_S, COOP_S);
        const x0 = -50,
          x1 = 50,
          top = -92,
          floor = -22;
        // stilts
        g.fillStyle = "#6b4527";
        for (const x of [x0 + 6, x1 - 12]) {
          rr(g, x, floor - 2, 6, 24, 2);
          g.fill();
        }
        // nest boxes on the right
        rr(g, x1 - 4, -62, 30, 34, 4);
        g.fillStyle = vg(g, -62, -28, "#e3a866", "#b0743a");
        g.fill();
        g.strokeStyle = "#6b4122";
        g.lineWidth = 2;
        g.stroke();
        g.beginPath();
        g.moveTo(x1 - 8, -64);
        g.lineTo(x1 + 30, -70);
        g.lineTo(x1 + 30, -60);
        g.lineTo(x1 - 8, -56);
        g.closePath();
        g.fillStyle = "#3f8f7a";
        g.fill();
        g.strokeStyle = "#1f5446";
        g.stroke();
        g.fillStyle = "#ffe38a";
        ell(g, x1 + 11, -34, 9, 4);
        g.fill();
        // walls: planks, lit from the top left
        rr(g, x0, top, x1 - x0, floor - top, 4);
        g.fillStyle = vg(g, top, floor, "#f0c07a", "#c98a46", "#a86a32");
        g.fill();
        g.strokeStyle = "#6b4122";
        g.lineWidth = 2.4;
        g.stroke();
        g.strokeStyle = "rgba(107,65,34,.38)";
        g.lineWidth = 1;
        for (let x = x0 + 12; x < x1; x += 12) {
          g.beginPath();
          g.moveTo(x, top + 4);
          g.lineTo(x, floor - 2);
          g.stroke();
        }
        g.fillStyle = "rgba(255,255,255,.18)";
        g.fillRect(x0 + 3, top + 3, 8, floor - top - 6);
        // corner posts
        g.fillStyle = "#8a5a2c";
        rr(g, x0 - 3, top + 2, 7, floor - top, 2);
        g.fill();
        rr(g, x1 - 4, top + 2, 7, floor - top, 2);
        g.fill();
        // round window (glows at night; see `win`)
        g.fillStyle = "#3a2214";
        ell(g, -18, top + 26, 11, 11);
        g.fill();
        g.fillStyle = vg(g, top + 15, top + 37, "#ffe9a8", "#ffbe5a");
        ell(g, -18, top + 26, 8.5, 8.5);
        g.fill();
        g.strokeStyle = "#6b4122";
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(-18, top + 17);
        g.lineTo(-18, top + 35);
        g.moveTo(-27, top + 26);
        g.lineTo(-9, top + 26);
        g.stroke();
        // hatch and ramp
        rr(g, 8, floor - 34, 26, 34, 6);
        g.fillStyle = "#3a2214";
        g.fill();
        g.strokeStyle = "#6b4122";
        g.lineWidth = 2;
        g.stroke();
        g.beginPath();
        g.moveTo(8, floor);
        g.lineTo(34, floor);
        g.lineTo(46, 0);
        g.lineTo(20, 0);
        g.closePath();
        g.fillStyle = vg(g, floor, 0, "#d9a25e", "#a8743c");
        g.fill();
        g.strokeStyle = "#6b4122";
        g.lineWidth = 1.8;
        g.stroke();
        g.strokeStyle = "rgba(107,65,34,.55)";
        g.lineWidth = 1.4;
        for (let k = 1; k < 4; k++) {
          const f = k / 4;
          g.beginPath();
          g.moveTo(8 + 12 * f, floor + 22 * f);
          g.lineTo(34 + 12 * f, floor + 22 * f);
          g.stroke();
        }
        // gable roof, shingled
        const roof = () => {
          g.beginPath();
          g.moveTo(x0 - 14, top + 8);
          g.lineTo(0, top - 40);
          g.lineTo(x1 + 14, top + 8);
          g.lineTo(x1 + 6, top + 14);
          g.lineTo(0, top - 28);
          g.lineTo(x0 - 6, top + 14);
          g.closePath();
        };
        g.beginPath();
        g.moveTo(x0, top + 6);
        g.lineTo(0, top - 30);
        g.lineTo(x1, top + 6);
        g.closePath();
        g.fillStyle = vg(g, top - 30, top + 6, "#ffd28c", "#d9964e");
        g.fill();
        g.strokeStyle = "#6b4122";
        g.lineWidth = 2;
        g.stroke();
        roof();
        g.fillStyle = vg(g, top - 40, top + 14, "#5fd0a8", "#2e8f72");
        g.fill();
        g.strokeStyle = "#1a5444";
        g.lineWidth = 2.2;
        g.stroke();
        g.strokeStyle = "rgba(20,70,56,.45)";
        g.lineWidth = 1;
        for (let k = 1; k < 4; k++) {
          const f = k / 4;
          g.beginPath();
          g.moveTo(-f * (50 + 14) + 2, top - 40 + f * 48 + 1);
          g.lineTo(f * (50 + 14) - 2, top - 40 + f * 48 + 1);
          g.stroke();
        }
        // a weather vane: a little hen
        g.strokeStyle = "#4a3a2a";
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(0, top - 40);
        g.lineTo(0, top - 54);
        g.stroke();
        g.fillStyle = "#ef4f61";
        ell(g, 1, top - 58, 6, 4.5);
        g.fill();
        g.fillStyle = "#ffd65b";
        g.beginPath();
        g.moveTo(6, top - 59);
        g.lineTo(10, top - 58);
        g.lineTo(6, top - 56);
        g.fill();
        return { win: [-18 * COOP_S, (top + 26) * COOP_S] };
      }),
    );
  /* The coop's run: packed earth with straw, w × h, anchored top left. */
  const coopYard = (w, h) =>
    memo(`coopyard:${w}x${h}`, () =>
      sprite(w + 8, h + 10, 0, 0, (g) => {
        g.fillStyle = "rgba(40,30,16,.22)";
        rr(g, 4, 7, w, h, 14);
        g.fill();
        rr(g, 0, 0, w, h, 14);
        g.fillStyle = vg(g, 0, h, "#d8b77a", "#b9925a");
        g.fill();
        srand(w * 31 + h);
        for (let i = 0; i < (w * h) / 90; i++) {
          const x = 6 + rnd() * (w - 12),
            y = 6 + rnd() * (h - 12),
            a = rnd() * Math.PI;
          g.strokeStyle = rnd() < 0.6 ? "#f2d27a" : "#a3783e";
          g.lineWidth = 1.3;
          g.beginPath();
          g.moveTo(x - Math.cos(a) * 4, y - Math.sin(a) * 2);
          g.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 2);
          g.stroke();
        }
        // a water dish and a feed trough
        g.fillStyle = "#8a93a6";
        ell(g, 18, h - 14, 11, 5);
        g.fill();
        g.fillStyle = "#7fc8ff";
        ell(g, 18, h - 15, 8, 3);
        g.fill();
        rr(g, w - 46, 8, 36, 10, 3);
        g.fillStyle = "#8a5a2c";
        g.fill();
        g.fillStyle = "#ffd65b";
        rr(g, w - 43, 8, 30, 4, 2);
        g.fill();
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
  /* ---------------- decorations (20261117120000) ----------------
     Each is [width, height, anchor x, anchor y, draw]: drawn once on a 2x
     canvas (memo), standing on (0, 0) and blitted 4 px below the point it
     stands on, like the props above. Fences and hedges span x -25..25 so
     pieces 50 px apart join into one row; paths fill their ground box. */
  const STONE = ["#eef0f4", "#b9bfcc", "#7d8496"],
    STONE_LINE = "#565c70",
    WOOD = ["#e2a868", "#b06e38"],
    WOOD_LINE = "#6e3e1c";
  const stoneFill = (g, y0, y1) => vg(g, y0, y1, ...STONE);
  const woodFill = (g, y0, y1) => vg(g, y0, y1, ...WOOD);
  const stroke = (g, c, w = 1.6) => {
    g.strokeStyle = c;
    g.lineWidth = w;
    g.stroke();
  };
  const flower5 = (g, x, y, r, c, mid = "#ffcf3a") => {
    g.fillStyle = c;
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      g.arc(
        x + Math.cos(k * 1.256) * r,
        y + Math.sin(k * 1.256) * r,
        r * 0.9,
        0,
        7,
      );
      g.fill();
    }
    g.fillStyle = mid;
    g.beginPath();
    g.arc(x, y, r * 0.6, 0, 7);
    g.fill();
  };
  const leafBlob = (g, x, y, rx, ry, c, rot = 0) => {
    ell(g, x, y, rx, ry, rot);
    g.fillStyle = c;
    g.fill();
  };
  /** A soft light bulb or flame glow baked into the sprite. */
  const bulb = (g, x, y, r, c) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
    gr.addColorStop(0, rgba(c, 0.55));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr;
    g.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
    ball(g, x, y, r, c, 0.6);
  };
  const flame = (g, x, y, s) => {
    g.beginPath();
    g.moveTo(x, y - 14 * s);
    g.quadraticCurveTo(x + 7 * s, y - 4 * s, x + 4 * s, y + 2 * s);
    g.quadraticCurveTo(x, y + 5 * s, x - 4 * s, y + 2 * s);
    g.quadraticCurveTo(x - 7 * s, y - 4 * s, x, y - 14 * s);
    g.fillStyle = vg(g, y - 14 * s, y + 4 * s, "#fff6b0", "#ffb53a", "#ff5a1f");
    g.fill();
    g.beginPath();
    g.ellipse(x, y - 1 * s, 2 * s, 4 * s, 0, 0, 7);
    g.fillStyle = "#fffbe0";
    g.fill();
  };
  const post = (g, x, top, w = 6, c = WOOD) => {
    rr(g, x - w / 2, top, w, -top, 2);
    g.fillStyle = hg(g, x - w / 2, x + w / 2, c[0], c[1]);
    g.fill();
    stroke(g, WOOD_LINE, 1.2);
  };
  /** A stone animal's plinth. */
  const pedestal = (g, w, h = 10) => {
    rr(g, -w / 2, -h, w, h, 3);
    g.fillStyle = stoneFill(g, -h, 0);
    g.fill();
    stroke(g, STONE_LINE, 1.6);
  };
  const statueFill = (g, y0, y1) =>
    vg(g, y0, y1, "#f4f2ec", "#c9c4b6", "#938d7c");
  const STATUE_LINE = "#5e584a";
  const DECO_ART = {
    picket: [
      56,
      46,
      28,
      42,
      (g) => {
        for (const y of [-27, -13]) {
          rr(g, -25, y, 50, 5, 2);
          g.fillStyle = vg(g, y, y + 5, "#ffffff", "#d6cfbf");
          g.fill();
          stroke(g, "#9c9381", 1.1);
        }
        for (let i = 0; i < 5; i++) {
          const x = -20 + i * 10;
          g.beginPath();
          g.moveTo(x - 3.5, 0);
          g.lineTo(x - 3.5, -31);
          g.lineTo(x, -37);
          g.lineTo(x + 3.5, -31);
          g.lineTo(x + 3.5, 0);
          g.closePath();
          g.fillStyle = hg(g, x - 3.5, x + 3.5, "#ffffff", "#d9d2c2");
          g.fill();
          stroke(g, "#9c9381", 1.3);
        }
      },
    ],
    railfence: [
      56,
      44,
      28,
      40,
      (g) => {
        for (const x of [-21, 21]) post(g, x, -34, 7, ["#a8743f", "#6b4527"]);
        for (const [y, b] of [
          [-28, 2],
          [-15, -1.5],
        ]) {
          g.beginPath();
          g.moveTo(-25, y);
          g.quadraticCurveTo(0, y + b, 25, y);
          g.lineWidth = 6;
          g.strokeStyle = "#5e3a1f";
          g.stroke();
          g.lineWidth = 4;
          g.strokeStyle = "#b9824a";
          g.stroke();
        }
      },
    ],
    gate: [
      56,
      52,
      28,
      48,
      (g) => {
        for (const x of [-21, 21]) {
          rr(g, x - 4, -40, 8, 40, 2);
          g.fillStyle = hg(g, x - 4, x + 4, "#ffffff", "#cfc7b6");
          g.fill();
          stroke(g, "#9c9381", 1.3);
          ball(g, x, -43, 4.5, "#f6f1e6", 0.5);
        }
        // The gate between: slats under an arched top, a latch.
        g.save();
        g.beginPath();
        g.moveTo(-16, -2);
        g.lineTo(-16, -26);
        g.quadraticCurveTo(0, -36, 16, -26);
        g.lineTo(16, -2);
        g.closePath();
        g.clip();
        for (let i = 0; i < 5; i++) {
          rr(g, -15 + i * 6.4, -40, 4.6, 40, 1.5);
          g.fillStyle = hg(
            g,
            -15 + i * 6.4,
            -10 + i * 6.4,
            "#ffffff",
            "#dcd5c6",
          );
          g.fill();
          stroke(g, "#a59c88", 1);
        }
        g.restore();
        for (const y of [-22, -9]) {
          rr(g, -16, y, 32, 4, 1.5);
          g.fillStyle = "#e8e1d2";
          g.fill();
          stroke(g, "#a59c88", 1);
        }
        ball(g, 11, -16, 2, "#c7a24a");
      },
    ],
    hedge: [
      58,
      48,
      29,
      42,
      (g) => {
        srand(61);
        rr(g, -25, -32, 50, 32, 9);
        g.fillStyle = vg(g, -32, 0, "#6fcf5c", "#3f9d4a", "#25683a");
        g.fill();
        stroke(g, "#1d4f2c", 2);
        g.save();
        rr(g, -25, -32, 50, 32, 9);
        g.clip();
        for (let i = 0; i < 46; i++) {
          const x = -24 + rnd() * 48,
            y = -31 + rnd() * 30;
          g.strokeStyle = rgba("#1f5a2e", 0.4);
          g.lineWidth = 1.2;
          g.beginPath();
          g.arc(x, y, 3 + rnd() * 2, Math.PI * 0.1, Math.PI * 0.9);
          g.stroke();
        }
        g.fillStyle = "rgba(220,255,170,.35)";
        rr(g, -22, -31, 44, 7, 5);
        g.fill();
        g.restore();
      },
    ],
    pathstone: [
      48,
      28,
      24,
      24,
      (g) => {
        for (const [x, y, rx, ry] of [
          [-11, -14, 9, 5],
          [8, -15, 8, 4.5],
          [-2, -5, 10, 4.8],
          [13, -4, 6, 3.5],
        ]) {
          ell(g, x, y + 1.5, rx + 1, ry + 1);
          g.fillStyle = "rgba(40,60,40,.25)";
          g.fill();
          ell(g, x, y, rx, ry);
          g.fillStyle = vg(g, y - ry, y + ry, "#e6e8ee", "#a6acba");
          g.fill();
          stroke(g, "#6c7284", 1.2);
          ell(g, x - rx * 0.3, y - ry * 0.35, rx * 0.4, ry * 0.3);
          g.fillStyle = "rgba(255,255,255,.5)";
          g.fill();
        }
      },
    ],
    pathgravel: [
      66,
      28,
      33,
      24,
      (g) => {
        srand(63);
        rr(g, -30, -20, 60, 20, 6);
        g.fillStyle = vg(g, -20, 0, "#eadcbc", "#cdb98e");
        g.fill();
        stroke(g, rgba("#9a8558", 0.7), 1.2);
        for (let i = 0; i < 70; i++) {
          const x = -27 + rnd() * 54,
            y = -18 + rnd() * 16;
          g.fillStyle = ["#a89470", "#f7efd9", "#8f8f8f", "#c9b48a"][i % 4];
          g.beginPath();
          g.arc(x, y, 0.8 + rnd() * 1.1, 0, 7);
          g.fill();
        }
      },
    ],
    pathbrick: [
      66,
      28,
      33,
      24,
      (g) => {
        rr(g, -30, -20, 60, 20, 3);
        g.fillStyle = "#b8a48a";
        g.fill();
        g.save();
        rr(g, -30, -20, 60, 20, 3);
        g.clip();
        for (let r = 0; r < 4; r++)
          for (let k = -1; k < 6; k++) {
            const x = -30 + k * 13 + (r % 2 ? 6.5 : 0),
              y = -20 + r * 5;
            g.fillStyle = ["#d0704a", "#c25f3e", "#dd8358"][
              (k + r * 2 + 3) % 3
            ];
            g.fillRect(x + 0.6, y + 0.6, 11.8, 3.8);
          }
        g.restore();
        rr(g, -30, -20, 60, 20, 3);
        stroke(g, "#7a3e26", 1.4);
      },
    ],
    tulips: [
      48,
      46,
      24,
      42,
      (g) => {
        srand(64);
        ell(g, 0, -4, 20, 6);
        g.fillStyle = vg(g, -10, 2, "#7a5232", "#4e331d");
        g.fill();
        const cols = ["#ff4f6d", "#ffd23f", "#ff8fb4", "#ff6a2a"];
        for (let i = 0; i < 8; i++) {
          const x = -15 + i * 4.3 + (rnd() - 0.5) * 2,
            y = -6 + (i % 2) * 3,
            h = 16 + rnd() * 10;
          g.strokeStyle = "#3f8f3a";
          g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + (rnd() - 0.5) * 3, y - h);
          g.stroke();
          leafBlob(g, x + 2.5, y - 5, 2, 5, "#5cb64a", 0.4);
          const c = cols[i % 4],
            ty = y - h;
          g.beginPath();
          g.moveTo(x - 4, ty - 6);
          g.lineTo(x - 2, ty - 2);
          g.lineTo(x, ty - 7);
          g.lineTo(x + 2, ty - 2);
          g.lineTo(x + 4, ty - 6);
          g.quadraticCurveTo(x + 4.5, ty + 2, x, ty + 2);
          g.quadraticCurveTo(x - 4.5, ty + 2, x - 4, ty - 6);
          g.fillStyle = vg(g, ty - 7, ty + 2, lt(c, 0.3), dk(c, 0.15));
          g.fill();
          stroke(g, dk(c, 0.45), 0.9);
        }
      },
    ],
    potdaisy: [
      36,
      52,
      18,
      48,
      (g) => {
        srand(65);
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.3;
          leafBlob(
            g,
            Math.cos(a) * 9,
            -22 + Math.sin(a) * 6,
            3,
            7,
            i % 2 ? "#4fae46" : "#3c8f3a",
            a + Math.PI / 2,
          );
        }
        for (const [x, y] of [
          [-7, -34],
          [6, -36],
          [0, -28],
          [-10, -25],
          [10, -26],
        ])
          flower5(g, x, y, 2.6, "#ffffff", "#ffc93a");
        g.beginPath();
        g.moveTo(-11, -20);
        g.lineTo(11, -20);
        g.lineTo(8, 0);
        g.lineTo(-8, 0);
        g.closePath();
        g.fillStyle = hg(g, -11, 11, "#f08d5a", "#b8532c");
        g.fill();
        stroke(g, "#7a3218", 1.4);
        rr(g, -13, -23, 26, 5, 2);
        g.fillStyle = "#e57f4c";
        g.fill();
        stroke(g, "#7a3218", 1.4);
      },
    ],
    sunflowers: [
      52,
      88,
      26,
      84,
      (g) => {
        for (const [x, h, s] of [
          [-10, 58, 1],
          [9, 70, 1.1],
          [0, 46, 0.9],
        ]) {
          g.strokeStyle = "#3f8f3a";
          g.lineWidth = 2.6;
          g.beginPath();
          g.moveTo(x, 0);
          g.quadraticCurveTo(x + 2, -h / 2, x, -h);
          g.stroke();
          leafBlob(g, x - 5, -h * 0.4, 6, 3, "#4fae46", 0.5);
          leafBlob(g, x + 5, -h * 0.6, 6, 3, "#5cb64a", -0.5);
          for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2;
            leafBlob(
              g,
              x + Math.cos(a) * 7 * s,
              -h + Math.sin(a) * 7 * s,
              4.2 * s,
              2 * s,
              k % 2 ? "#ffcf2a" : "#ffb81f",
              a,
            );
          }
          ball(g, x, -h, 5 * s, "#7a4a22", 0.25);
        }
        ell(g, 0, -1, 16, 4);
        g.fillStyle = "#5a3d24";
        g.fill();
      },
    ],
    barrow: [
      66,
      54,
      30,
      50,
      (g) => {
        srand(66);
        // handles and legs (left), the tray, a wheel (right), flowers in it.
        g.strokeStyle = WOOD_LINE;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(-28, -20);
        g.lineTo(-12, -16);
        g.moveTo(-18, -14);
        g.lineTo(-20, 0);
        g.stroke();
        g.beginPath();
        g.moveTo(-16, -26);
        g.lineTo(20, -26);
        g.lineTo(14, -10);
        g.lineTo(-10, -10);
        g.closePath();
        g.fillStyle = vg(g, -26, -10, "#5fb3ff", "#2a6fd0");
        g.fill();
        stroke(g, "#1c3f80", 1.8);
        ell(g, 2, -27, 18, 6);
        g.fillStyle = "#5a3d24";
        g.fill();
        for (let i = 0; i < 9; i++)
          leafBlob(
            g,
            -12 + rnd() * 28,
            -30 - rnd() * 6,
            4,
            6,
            rnd() < 0.5 ? "#4fae46" : "#3c8f3a",
            rnd() - 0.5,
          );
        const cols = ["#ff6f9a", "#ffd65b", "#9a7bff", "#ffffff", "#ff8a3d"];
        for (let i = 0; i < 10; i++)
          flower5(g, -12 + rnd() * 28, -33 - rnd() * 9, 2.4, cols[i % 5]);
        g.beginPath();
        g.arc(17, -7, 7, 0, 7);
        g.fillStyle = "#3a3f52";
        g.fill();
        g.beginPath();
        g.arc(17, -7, 3, 0, 7);
        g.fillStyle = "#c9ced8";
        g.fill();
      },
    ],
    lavender: [
      68,
      48,
      34,
      44,
      (g) => {
        srand(67);
        for (let c = 0; c < 5; c++) {
          const cx = -24 + c * 12;
          for (let k = 0; k < 6; k++) {
            const a = -Math.PI / 2 + (k - 2.5) * 0.22,
              h = 22 + rnd() * 10,
              ex = cx + Math.cos(a) * h * 0.5,
              ey = -4 + Math.sin(a) * h;
            g.strokeStyle = "#6f9c5a";
            g.lineWidth = 1.2;
            g.beginPath();
            g.moveTo(cx, -2);
            g.lineTo(ex, ey);
            g.stroke();
            for (let j = 0; j < 5; j++) {
              g.fillStyle = j % 2 ? "#9a7bff" : "#7b5fd8";
              g.beginPath();
              g.arc(
                ex + (cx - ex) * j * 0.07,
                ey + j * 2.2,
                1.9 - j * 0.12,
                0,
                7,
              );
              g.fill();
            }
          }
          leafBlob(g, cx, -4, 6, 4, "#5b8f4a");
        }
      },
    ],
    topiary: [
      40,
      86,
      20,
      82,
      (g) => {
        rr(g, -10, -14, 20, 14, 2);
        g.fillStyle = hg(g, -10, 10, "#f2eee4", "#bdb5a2");
        g.fill();
        stroke(g, "#7e7663", 1.4);
        g.fillStyle = "#6b4527";
        g.fillRect(-1.5, -40, 3, 26);
        for (const [y, r] of [
          [-30, 10],
          [-58, 14],
        ]) {
          g.beginPath();
          g.arc(0, y, r + 2, 0, 7);
          g.fillStyle = "#1d4f2c";
          g.fill();
          ball(g, 0, y, r, "#4fae46", 0.35);
        }
      },
    ],
    bamboo: [
      60,
      140,
      30,
      134,
      (g) => {
        srand(68);
        for (const [x, h] of [
          [-14, 104],
          [-6, 124],
          [3, 96],
          [11, 116],
          [18, 90],
          [-19, 84],
        ]) {
          const lean = (x / 20) * 6;
          g.strokeStyle = "#2f6f2a";
          g.lineWidth = 6;
          g.beginPath();
          g.moveTo(x, 0);
          g.lineTo(x + lean, -h);
          g.stroke();
          g.strokeStyle = "#7fcf55";
          g.lineWidth = 3.6;
          g.stroke();
          for (let y = -14; y > -h; y -= 16) {
            const k = y / -h;
            g.fillStyle = "#2f6f2a";
            g.fillRect(x + lean * k - 3, y, 6, 1.6);
          }
          for (let k = 0; k < 4; k++) {
            const ly = -h + 6 + k * 9,
              lx = x + lean * (-ly / h);
            leafBlob(
              g,
              lx + (k % 2 ? 8 : -8),
              ly,
              9,
              2.4,
              k % 2 ? "#5cb64a" : "#3f9d4a",
              k % 2 ? 0.4 : -0.4,
            );
          }
        }
      },
    ],
    palm: [
      100,
      150,
      40,
      144,
      (g) => {
        // A curved, ringed trunk; fronds and coconuts at the top.
        const pts = [];
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          pts.push([Math.sin(t * 1.6) * 16, -t * 110]);
        }
        for (let i = 0; i < 10; i++) {
          const [x0, y0] = pts[i],
            [x1, y1] = pts[i + 1],
            w = 7 - i * 0.3;
          g.beginPath();
          g.moveTo(x0 - w, y0);
          g.lineTo(x1 - w + 0.5, y1);
          g.lineTo(x1 + w - 0.5, y1);
          g.lineTo(x0 + w, y0);
          g.closePath();
          g.fillStyle = i % 2 ? "#b8834e" : "#a06d3c";
          g.fill();
          stroke(g, "#5e3a1f", 1.2);
        }
        const [tx, ty] = pts[10];
        for (const a of [-2.7, -2.1, -1.5, -0.9, -0.35, 0.3, 2.9]) {
          const ex = tx + Math.cos(a) * 44,
            ey = ty + Math.sin(a) * 22 + 14;
          g.beginPath();
          g.moveTo(tx, ty);
          g.quadraticCurveTo(
            tx + Math.cos(a) * 26,
            ty + Math.sin(a) * 26 - 10,
            ex,
            ey,
          );
          g.quadraticCurveTo(
            tx + Math.cos(a) * 20,
            ty + Math.sin(a) * 16 + 4,
            tx,
            ty,
          );
          g.fillStyle = "#1f6a3a";
          g.fill();
          g.beginPath();
          g.moveTo(tx, ty - 1);
          g.quadraticCurveTo(
            tx + Math.cos(a) * 24,
            ty + Math.sin(a) * 24 - 9,
            ex,
            ey - 1,
          );
          g.strokeStyle = "#5fcf7c";
          g.lineWidth = 2;
          g.stroke();
        }
        for (const [dx, dy] of [
          [-4, 4],
          [4, 5],
          [0, 8],
        ])
          ball(g, tx + dx, ty + dy, 4.5, "#7a4a22", 0.3);
      },
    ],
    willow: [
      130,
      160,
      65,
      152,
      (g) => {
        srand(69);
        g.beginPath();
        g.moveTo(-10, 2);
        g.quadraticCurveTo(-4, -40, -8, -78);
        g.lineTo(8, -78);
        g.quadraticCurveTo(4, -40, 12, 2);
        g.quadraticCurveTo(0, 5, -10, 2);
        g.fillStyle = hg(g, -10, 10, "#a8743f", "#5e3a1f");
        g.fill();
        stroke(g, "#3d2412", 1.6);
        ell(g, 0, -104, 54, 40);
        g.fillStyle = "#245a2e";
        g.fill();
        ell(g, -4, -108, 48, 32);
        g.fillStyle = vg(g, -140, -76, "#a8e07a", "#5fae4a");
        g.fill();
        // Drooping strands, down to near the ground at the sides.
        for (let i = 0; i < 34; i++) {
          const x = -52 + (i / 33) * 104,
            top = -104 + Math.abs(x) * 0.15 - 20 * Math.cos((x / 52) * 1.3),
            len = 50 + (1 - Math.abs(x) / 52) * 10 + rnd() * 18;
          g.strokeStyle = i % 3 ? "#4f9a3c" : "#7cc45e";
          g.lineWidth = 2.6;
          g.beginPath();
          g.moveTo(x, top);
          g.quadraticCurveTo(
            x + (x > 0 ? 6 : -6),
            top + len * 0.5,
            x + (x > 0 ? 4 : -4),
            top + len,
          );
          g.stroke();
        }
        g.fillStyle = "rgba(230,255,190,.35)";
        ell(g, -18, -122, 18, 8, -0.3);
        g.fill();
      },
    ],
    deckchair: [
      40,
      46,
      20,
      42,
      (g) => {
        g.strokeStyle = WOOD_LINE;
        g.lineWidth = 2.6;
        g.beginPath();
        g.moveTo(-12, 0);
        g.lineTo(10, -36);
        g.moveTo(12, 0);
        g.lineTo(-6, -18);
        g.moveTo(-14, -16);
        g.lineTo(14, -16);
        g.stroke();
        g.beginPath();
        g.moveTo(-10, -18);
        g.quadraticCurveTo(-4, -8, 8, -14);
        g.lineTo(12, -36);
        g.lineTo(2, -38);
        g.closePath();
        g.save();
        g.clip();
        for (let i = 0; i < 8; i++) {
          g.fillStyle = i % 2 ? "#ffffff" : "#ef4f61";
          g.fillRect(-14 + i * 4, -40, 4, 30);
        }
        g.restore();
        stroke(g, "#8a2a36", 1.2);
      },
    ],
    picnic: [
      92,
      56,
      46,
      50,
      (g) => {
        // Benches in front and behind, the table top with a gingham cloth.
        const bench = (y) => {
          rr(g, -38, y, 76, 5, 2);
          g.fillStyle = woodFill(g, y, y + 5);
          g.fill();
          stroke(g, WOOD_LINE, 1.1);
        };
        bench(-30);
        for (const x of [-26, 22]) {
          g.fillStyle = "#8a5530";
          g.fillRect(x, -26, 4, 26);
        }
        rr(g, -40, -32, 80, 10, 3);
        g.fillStyle = woodFill(g, -32, -22);
        g.fill();
        stroke(g, WOOD_LINE, 1.2);
        g.save();
        rr(g, -26, -33, 52, 12, 2);
        g.clip();
        g.fillStyle = "#ffffff";
        g.fillRect(-26, -33, 52, 12);
        g.fillStyle = "rgba(226,58,58,.75)";
        for (let i = 0; i < 9; i++) g.fillRect(-26 + i * 6, -33, 3, 12);
        for (let j = 0; j < 4; j++) g.fillRect(-26, -33 + j * 3, 52, 1.5);
        g.restore();
        ball(g, -8, -36, 3.5, "#e8413a");
        ball(g, 0, -37, 3.5, "#ffd84a");
        rr(g, 7, -40, 9, 7, 2);
        g.fillStyle = "#c98a4a";
        g.fill();
        for (const x of [-34, 30]) {
          g.fillStyle = "#6b4527";
          g.fillRect(x, -12, 4, 12);
        }
        bench(-12);
      },
    ],
    parasol: [
      60,
      100,
      30,
      96,
      (g) => {
        rr(g, -9, -4, 18, 4, 2);
        g.fillStyle = "#4a5578";
        g.fill();
        g.fillStyle = hg(g, -2, 2, "#f2f2f2", "#9aa1b2");
        g.fillRect(-1.5, -72, 3, 70);
        // Small round table under it.
        ell(g, 0, -24, 14, 4);
        g.fillStyle = "#f2eee4";
        g.fill();
        stroke(g, "#8a8270", 1.2);
        g.fillStyle = "#8a8270";
        g.fillRect(-1, -22, 2, 20);
        // The canopy: scalloped stripes.
        const R = 27;
        for (let i = 0; i < 6; i++) {
          const a0 = Math.PI + (i / 6) * Math.PI,
            a1 = Math.PI + ((i + 1) / 6) * Math.PI;
          g.beginPath();
          g.moveTo(0, -88);
          g.lineTo(Math.cos(a0) * R, -70 + Math.sin(a0) * 6);
          g.quadraticCurveTo(
            Math.cos((a0 + a1) / 2) * R * 1.05,
            -64,
            Math.cos(a1) * R,
            -70 + Math.sin(a1) * 6,
          );
          g.closePath();
          g.fillStyle = i % 2 ? "#ffffff" : "#2fb3a6";
          g.fill();
          stroke(g, "#1f6a62", 1.1);
        }
        ball(g, 0, -89, 2.5, "#ffd65b");
      },
    ],
    swing: [
      84,
      96,
      42,
      92,
      (g) => {
        for (const s of [-1, 1]) {
          g.strokeStyle = WOOD_LINE;
          g.lineWidth = 6;
          g.beginPath();
          g.moveTo(s * 36, 0);
          g.lineTo(s * 30, -80);
          g.moveTo(s * 24, 0);
          g.lineTo(s * 30, -80);
          g.stroke();
          g.strokeStyle = WOOD[0];
          g.lineWidth = 3.6;
          g.stroke();
        }
        rr(g, -36, -84, 72, 7, 3);
        g.fillStyle = woodFill(g, -84, -77);
        g.fill();
        stroke(g, WOOD_LINE, 1.3);
        g.strokeStyle = "#c9b08a";
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(-12, -77);
        g.lineTo(-12, -26);
        g.moveTo(12, -77);
        g.lineTo(12, -26);
        g.stroke();
        rr(g, -16, -28, 32, 6, 2);
        g.fillStyle = vg(g, -28, -22, "#ff8a8a", "#d04a4a");
        g.fill();
        stroke(g, "#7a2020", 1.2);
      },
    ],
    birdbath: [
      36,
      58,
      18,
      54,
      (g) => {
        rr(g, -9, -6, 18, 6, 2);
        g.fillStyle = stoneFill(g, -6, 0);
        g.fill();
        stroke(g, STONE_LINE, 1.3);
        g.beginPath();
        g.moveTo(-4, -6);
        g.quadraticCurveTo(-2, -18, -5, -28);
        g.lineTo(5, -28);
        g.quadraticCurveTo(2, -18, 4, -6);
        g.closePath();
        g.fillStyle = hg(g, -5, 5, STONE[0], STONE[2]);
        g.fill();
        stroke(g, STONE_LINE, 1.3);
        g.beginPath();
        g.moveTo(-15, -34);
        g.quadraticCurveTo(0, -20, 15, -34);
        g.closePath();
        g.fillStyle = stoneFill(g, -34, -24);
        g.fill();
        stroke(g, STONE_LINE, 1.4);
        ell(g, 0, -34, 15, 3.6);
        g.fillStyle = vg(g, -37, -31, "#bfe8ff", "#4fa8e8");
        g.fill();
        stroke(g, STONE_LINE, 1.4);
        // A little bird on the rim.
        ball(g, 9, -40, 4, "#5fb3ff", 0.5);
        ball(g, 12, -44, 2.8, "#5fb3ff", 0.5);
        g.fillStyle = "#ffb53a";
        g.beginPath();
        g.moveTo(14.5, -44);
        g.lineTo(17, -43);
        g.lineTo(14.5, -42.5);
        g.fill();
        g.fillStyle = "#1c1630";
        g.fillRect(12.4, -45, 1.2, 1.2);
      },
    ],
    lilypond: [
      104,
      54,
      52,
      46,
      (g) => {
        srand(70);
        ell(g, 0, -12, 46, 16);
        g.fillStyle = vg(g, -28, 4, "#e6e2d6", "#9d9684");
        g.fill();
        stroke(g, "#6d6656", 1.6);
        ell(g, 0, -13, 39, 12);
        g.fillStyle = vg(g, -25, -1, "#2f7fc4", "#6fc8f0");
        g.fill();
        g.fillStyle = "rgba(255,255,255,.35)";
        ell(g, -14, -18, 12, 2.4);
        g.fill();
        for (const [x, y, r] of [
          [-20, -10, 6],
          [10, -16, 7],
          [22, -8, 5],
          [-4, -6, 5],
        ]) {
          g.beginPath();
          g.moveTo(x, y);
          g.arc(x, y, r, 0.3, Math.PI * 2 - 0.2);
          g.closePath();
          g.fillStyle = "#4fae46";
          g.fill();
          stroke(g, "#2e6f2c", 1);
        }
        flower5(g, 10, -18, 2.4, "#ff9bd2", "#ffe46a");
        flower5(g, -20, -12, 2, "#ffffff", "#ffe46a");
        // Stones on the rim.
        for (const [x, y] of [
          [-40, -8],
          [36, -16],
          [-30, -22],
          [28, -4],
        ])
          ball(g, x, y, 4.5, "#c9c2b0", 0.4);
      },
    ],
    fountain: [
      76,
      88,
      38,
      82,
      (g) => {
        ell(g, 0, -8, 30, 10);
        g.fillStyle = stoneFill(g, -18, 2);
        g.fill();
        stroke(g, STONE_LINE, 1.6);
        rr(g, -30, -12, 60, 8, 4);
        g.fillStyle = stoneFill(g, -12, -4);
        g.fill();
        ell(g, 0, -12, 30, 8);
        g.fillStyle = stoneFill(g, -20, -4);
        g.fill();
        stroke(g, STONE_LINE, 1.6);
        ell(g, 0, -12, 25, 5.5);
        g.fillStyle = vg(g, -17, -7, "#bfe8ff", "#3f98dc");
        g.fill();
        rr(g, -4, -44, 8, 32, 3);
        g.fillStyle = hg(g, -4, 4, STONE[0], STONE[2]);
        g.fill();
        stroke(g, STONE_LINE, 1.3);
        g.beginPath();
        g.moveTo(-14, -46);
        g.quadraticCurveTo(0, -36, 14, -46);
        g.closePath();
        g.fillStyle = stoneFill(g, -46, -38);
        g.fill();
        stroke(g, STONE_LINE, 1.3);
        ell(g, 0, -46, 14, 3);
        g.fillStyle = "#7fc8f0";
        g.fill();
        stroke(g, STONE_LINE, 1.3);
        // Water: a spout and falling arcs.
        g.strokeStyle = "rgba(200,240,255,.95)";
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(0, -48);
        g.lineTo(0, -62);
        g.stroke();
        for (const s of [-1, 1]) {
          g.beginPath();
          g.moveTo(0, -62);
          g.quadraticCurveTo(s * 10, -68, s * 13, -47);
          g.moveTo(s * 13, -45);
          g.quadraticCurveTo(s * 22, -38, s * 22, -14);
          g.stroke();
        }
        ball(g, 0, -64, 3, "#e6f8ff", 0.6);
      },
    ],
    bridge: [
      84,
      62,
      42,
      56,
      (g) => {
        // The arch's shade, the deck, then rails.
        g.beginPath();
        g.moveTo(-26, 0);
        g.quadraticCurveTo(0, -30, 26, 0);
        g.closePath();
        g.fillStyle = "rgba(30,40,60,.45)";
        g.fill();
        g.beginPath();
        g.moveTo(-38, 0);
        g.quadraticCurveTo(0, -42, 38, 0);
        g.lineTo(30, 0);
        g.quadraticCurveTo(0, -30, -30, 0);
        g.closePath();
        g.fillStyle = woodFill(g, -22, 0);
        g.fill();
        stroke(g, WOOD_LINE, 1.6);
        g.strokeStyle = "rgba(110,62,28,.6)";
        g.lineWidth = 1;
        for (let i = 1; i < 9; i++) {
          const t = i / 9,
            x = -34 + t * 68,
            y = -2 * (1 - (2 * t - 1) ** 2) * 18;
          g.beginPath();
          g.moveTo(x, y - 2);
          g.lineTo(x * 0.88, y + 4);
          g.stroke();
        }
        for (let i = 0; i <= 4; i++) {
          const t = i / 4,
            x = -34 + t * 68,
            y = -2 * (1 - (2 * t - 1) ** 2) * 18 - 2;
          rr(g, x - 2, y - 18, 4, 18, 1.5);
          g.fillStyle = "#c98a4a";
          g.fill();
          stroke(g, WOOD_LINE, 1);
        }
        g.beginPath();
        g.moveTo(-34, -20);
        g.quadraticCurveTo(0, -60, 34, -20);
        g.lineWidth = 5;
        g.strokeStyle = WOOD_LINE;
        g.stroke();
        g.lineWidth = 3;
        g.strokeStyle = "#e2a868";
        g.stroke();
      },
    ],
    torch: [
      30,
      92,
      15,
      88,
      (g) => {
        g.fillStyle = hg(g, -2.5, 2.5, "#d9b070", "#8a6232");
        g.fillRect(-2.5, -62, 5, 62);
        g.fillStyle = "#6b4527";
        for (let y = -54; y < 0; y += 12) g.fillRect(-2.5, y, 5, 1.6);
        g.beginPath();
        g.moveTo(-7, -72);
        g.lineTo(7, -72);
        g.lineTo(4, -60);
        g.lineTo(-4, -60);
        g.closePath();
        g.fillStyle = vg(g, -72, -60, "#d9a35a", "#7a5230");
        g.fill();
        stroke(g, "#4e331d", 1.2);
        flame(g, 0, -74, 1);
        return { glow: [0, -78] };
      },
    ],
    lantern: [
      40,
      90,
      16,
      86,
      (g) => {
        post(g, 0, -76, 5, ["#8a6232", "#4e331d"]);
        g.strokeStyle = "#4e331d";
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(0, -72);
        g.lineTo(16, -72);
        g.moveTo(14, -72);
        g.lineTo(14, -66);
        g.stroke();
        ell(g, 14, -54, 9, 12);
        g.fillStyle = vg(g, -66, -42, "#ffd08a", "#ff7a3a");
        g.fill();
        stroke(g, "#a8401c", 1.2);
        g.strokeStyle = "rgba(168,64,28,.5)";
        g.lineWidth = 1;
        for (const y of [-60, -54, -48]) {
          g.beginPath();
          g.moveTo(5.5, y);
          g.quadraticCurveTo(14, y + 2, 22.5, y);
          g.stroke();
        }
        g.fillStyle = "#4e331d";
        g.fillRect(10, -67, 8, 2.5);
        g.fillRect(10, -42.5, 8, 2.5);
        return { glow: [14, -54] };
      },
    ],
    stringlights: [
      92,
      86,
      46,
      82,
      (g) => {
        for (const x of [-36, 36]) post(g, x, -72, 5, ["#8a6232", "#4e331d"]);
        g.strokeStyle = "#2c3348";
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(-36, -70);
        g.quadraticCurveTo(0, -36, 36, -70);
        g.stroke();
        const cols = [
          "#ffd65b",
          "#ff6f9a",
          "#7fe0d0",
          "#ffb53a",
          "#9a7bff",
          "#ffd65b",
          "#ff6f9a",
        ];
        for (let i = 0; i < 7; i++) {
          const t = (i + 1) / 8,
            x = -36 + t * 72,
            y = (1 - t) * (1 - t) * -70 + 2 * (1 - t) * t * -36 + t * t * -70;
          bulb(g, x, y + 4, 2.8, cols[i]);
        }
        return { glow: [0, -50] };
      },
    ],
    stonelantern: [
      44,
      76,
      22,
      72,
      (g) => {
        rr(g, -13, -8, 26, 8, 2);
        g.fillStyle = stoneFill(g, -8, 0);
        g.fill();
        stroke(g, STONE_LINE, 1.4);
        rr(g, -5, -28, 10, 20, 2);
        g.fillStyle = hg(g, -5, 5, STONE[0], STONE[2]);
        g.fill();
        stroke(g, STONE_LINE, 1.3);
        rr(g, -11, -32, 22, 5, 2);
        g.fillStyle = stoneFill(g, -32, -27);
        g.fill();
        stroke(g, STONE_LINE, 1.3);
        rr(g, -9, -48, 18, 16, 2);
        g.fillStyle = stoneFill(g, -48, -32);
        g.fill();
        stroke(g, STONE_LINE, 1.3);
        rr(g, -5, -45, 10, 10, 1.5);
        g.fillStyle = vg(g, -45, -35, "#fff6d0", "#ffb53a");
        g.fill();
        g.beginPath();
        g.moveTo(-18, -48);
        g.quadraticCurveTo(0, -54, 18, -48);
        g.lineTo(10, -58);
        g.lineTo(-10, -58);
        g.closePath();
        g.fillStyle = stoneFill(g, -58, -48);
        g.fill();
        stroke(g, STONE_LINE, 1.4);
        ball(g, 0, -61, 3.6, STONE[1], 0.5);
        return { glow: [0, -40] };
      },
    ],
    frog: [
      40,
      40,
      20,
      36,
      (g) => {
        pedestal(g, 28, 7);
        ell(g, 0, -15, 12, 9);
        g.fillStyle = vg(g, -24, -6, "#8fd07a", "#4f8f3a");
        g.fill();
        stroke(g, "#2e5a22", 1.4);
        for (const s of [-1, 1]) {
          ell(g, s * 10, -9, 5, 3);
          g.fillStyle = "#5f9f4a";
          g.fill();
          stroke(g, "#2e5a22", 1.2);
          g.beginPath();
          g.arc(s * 5.5, -23, 4, 0, 7);
          g.fillStyle = "#8fd07a";
          g.fill();
          stroke(g, "#2e5a22", 1.2);
          g.beginPath();
          g.arc(s * 5.5, -23.5, 1.8, 0, 7);
          g.fillStyle = "#1c1630";
          g.fill();
        }
        g.beginPath();
        g.arc(0, -15, 5, 0.2, Math.PI - 0.2);
        stroke(g, "#2e5a22", 1.2);
        g.fillStyle = "rgba(255,255,255,.35)";
        ell(g, -4, -19, 4, 2);
        g.fill();
      },
    ],
    bunny: [
      40,
      60,
      20,
      56,
      (g) => {
        pedestal(g, 28, 8);
        const L = STATUE_LINE;
        for (const s of [-1, 1]) {
          ell(g, s * 4, -44, 3.2, 10, s * 0.18);
          g.fillStyle = statueFill(g, -54, -34);
          g.fill();
          stroke(g, L, 1.3);
        }
        ell(g, 0, -18, 11, 10);
        g.fillStyle = statueFill(g, -28, -8);
        g.fill();
        stroke(g, L, 1.4);
        g.beginPath();
        g.arc(0, -32, 7.5, 0, 7);
        g.fillStyle = statueFill(g, -40, -24);
        g.fill();
        stroke(g, L, 1.4);
        ball(g, 10, -11, 3.6, "#f4f2ec", 0.6);
        g.fillStyle = L;
        g.fillRect(-3.4, -34, 1.6, 1.6);
        g.fillRect(1.8, -34, 1.6, 1.6);
      },
    ],
    owl: [
      40,
      66,
      20,
      62,
      (g) => {
        rr(g, -10, -18, 20, 18, 3);
        g.fillStyle = hg(g, -10, 10, "#c9a070", "#7a5230");
        g.fill();
        stroke(g, "#4e331d", 1.3);
        ell(g, 0, -18, 10, 3);
        g.fillStyle = "#e3c08a";
        g.fill();
        stroke(g, "#4e331d", 1.1);
        const L = STATUE_LINE;
        ell(g, 0, -34, 11, 15);
        g.fillStyle = statueFill(g, -50, -20);
        g.fill();
        stroke(g, L, 1.4);
        g.beginPath();
        g.moveTo(-10, -44);
        g.lineTo(-8, -52);
        g.lineTo(-3, -46);
        g.lineTo(3, -46);
        g.lineTo(8, -52);
        g.lineTo(10, -44);
        g.fillStyle = "#e9e5da";
        g.fill();
        stroke(g, L, 1.2);
        for (const s of [-1, 1]) {
          g.beginPath();
          g.arc(s * 4.4, -40, 4, 0, 7);
          g.fillStyle = "#ffffff";
          g.fill();
          stroke(g, L, 1.1);
          g.beginPath();
          g.arc(s * 4.4, -40, 1.8, 0, 7);
          g.fillStyle = "#2c2a26";
          g.fill();
        }
        g.beginPath();
        g.moveTo(-1.6, -36);
        g.lineTo(1.6, -36);
        g.lineTo(0, -33);
        g.fillStyle = "#c9a24a";
        g.fill();
        g.strokeStyle = rgba(L, 0.5);
        g.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.arc(0, -28 + i * 4, 3.4, 0.4, Math.PI - 0.4);
          g.stroke();
        }
      },
    ],
    deer: [
      72,
      84,
      32,
      80,
      (g) => {
        pedestal(g, 50, 9);
        const L = STATUE_LINE,
          f = statueFill(g, -76, -9);
        g.strokeStyle = L;
        g.lineWidth = 4.6;
        for (const x of [-14, -8, 9, 15]) {
          g.beginPath();
          g.moveTo(x, -26);
          g.lineTo(x + (x < 0 ? -1 : 1), -9);
          g.stroke();
        }
        g.strokeStyle = "#d6d1c4";
        g.lineWidth = 2.6;
        for (const x of [-14, -8, 9, 15]) {
          g.beginPath();
          g.moveTo(x, -26);
          g.lineTo(x + (x < 0 ? -1 : 1), -10);
          g.stroke();
        }
        ell(g, 0, -31, 20, 9);
        g.fillStyle = f;
        g.fill();
        stroke(g, L, 1.4);
        g.beginPath();
        g.moveTo(12, -36);
        g.lineTo(17, -54);
        g.lineTo(24, -52);
        g.lineTo(20, -32);
        g.closePath();
        g.fillStyle = f;
        g.fill();
        stroke(g, L, 1.4);
        ell(g, 23, -56, 7, 5, 0.3);
        g.fillStyle = f;
        g.fill();
        stroke(g, L, 1.4);
        ell(g, 16, -61, 2.4, 4.5, -0.8);
        g.fill();
        stroke(g, L, 1.1);
        g.strokeStyle = "#a89e86";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(21, -60);
        g.lineTo(18, -72);
        g.moveTo(19.5, -66);
        g.lineTo(14, -70);
        g.moveTo(25, -60);
        g.lineTo(29, -73);
        g.moveTo(27, -67);
        g.lineTo(32, -70);
        g.stroke();
        g.fillStyle = L;
        g.fillRect(24, -58, 1.6, 1.6);
        ell(g, -19, -34, 3, 2);
        g.fillStyle = "#f4f2ec";
        g.fill();
      },
    ],
    pumpkin: [
      40,
      44,
      20,
      38,
      (g) => {
        for (const [x, rx] of [
          [-7, 8],
          [7, 8],
          [0, 9],
        ]) {
          ell(g, x, -12, rx, 11);
          g.fillStyle = vg(g, -23, -1, "#ffb04a", "#e0641a");
          g.fill();
          stroke(g, "#8a3410", 1.4);
        }
        g.fillStyle = "#4e7a2a";
        rr(g, -1.6, -28, 3.2, 6, 1);
        g.fill();
        g.strokeStyle = "#4e7a2a";
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(1, -26);
        g.quadraticCurveTo(8, -30, 10, -24);
        g.stroke();
        // A carved, glowing face.
        g.fillStyle = "#ffe066";
        for (const s of [-1, 1]) {
          g.beginPath();
          g.moveTo(s * 7, -17);
          g.lineTo(s * 3, -17);
          g.lineTo(s * 5, -21);
          g.closePath();
          g.fill();
        }
        g.beginPath();
        g.moveTo(-8, -10);
        g.lineTo(-4, -8);
        g.lineTo(-2, -10);
        g.lineTo(0, -7);
        g.lineTo(2, -10);
        g.lineTo(4, -8);
        g.lineTo(8, -10);
        g.quadraticCurveTo(0, -1, -8, -10);
        g.fill();
        return { glow: [0, -12] };
      },
    ],
    tombstone: [
      44,
      56,
      22,
      52,
      (g) => {
        g.beginPath();
        g.moveTo(-13, 0);
        g.lineTo(-13, -30);
        g.arc(0, -30, 13, Math.PI, 0);
        g.lineTo(13, 0);
        g.closePath();
        g.fillStyle = hg(g, -13, 13, "#c4c9d6", "#6e7487");
        g.fill();
        stroke(g, "#3e4356", 1.8);
        g.fillStyle = "#3e4356";
        g.font = "900 9px sans-serif";
        g.textAlign = "center";
        g.fillText("RIP", 0, -26);
        g.strokeStyle = "rgba(62,67,86,.7)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(5, -40);
        g.lineTo(2, -34);
        g.lineTo(6, -30);
        g.stroke();
        g.fillStyle = "#6fbf54";
        ell(g, 8, -40, 4, 2);
        g.fill();
        for (const x of [-15, -10, 11, 16]) {
          g.strokeStyle = "#3f8f3a";
          g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(x, 0);
          g.lineTo(x - 2, -7);
          g.moveTo(x, 0);
          g.lineTo(x + 2, -6);
          g.stroke();
        }
      },
    ],
    cauldron: [
      48,
      56,
      24,
      50,
      (g) => {
        g.strokeStyle = "#2a2838";
        g.lineWidth = 3;
        for (const x of [-12, 12]) {
          g.beginPath();
          g.moveTo(x * 0.8, -6);
          g.lineTo(x, 0);
          g.stroke();
        }
        ell(g, 0, -16, 17, 13);
        g.fillStyle = vg(g, -29, -3, "#5a566e", "#1f1d2a");
        g.fill();
        stroke(g, "#100e18", 1.6);
        ell(g, 0, -27, 16, 4.5);
        g.fillStyle = "#3a3748";
        g.fill();
        stroke(g, "#100e18", 1.4);
        ell(g, 0, -27, 13, 3.2);
        g.fillStyle = vg(g, -30, -24, "#d6ff7a", "#5fd03a");
        g.fill();
        for (const [x, y, r] of [
          [-5, -31, 3],
          [4, -34, 2.4],
          [1, -40, 1.8],
          [-2, -45, 1.3],
        ])
          ball(g, x, y, r, "#a8f05a", 0.6);
        g.fillStyle = "rgba(255,255,255,.25)";
        ell(g, -8, -20, 4, 6, 0.3);
        g.fill();
        return { glow: [0, -30] };
      },
    ],
    redlantern: [
      56,
      96,
      28,
      92,
      (g) => {
        post(g, 0, -84, 6, ["#c0392b", "#7a1f16"]);
        rr(g, -22, -86, 44, 5, 2);
        g.fillStyle = vg(g, -86, -81, "#d9433a", "#8a1f16");
        g.fill();
        stroke(g, "#4e100a", 1.2);
        ball(g, -22, -84, 2.4, "#ffc93a");
        ball(g, 22, -84, 2.4, "#ffc93a");
        for (const x of [-14, 14]) {
          g.strokeStyle = "#4e100a";
          g.lineWidth = 1.2;
          g.beginPath();
          g.moveTo(x, -81);
          g.lineTo(x, -76);
          g.stroke();
          ell(g, x, -64, 9, 11);
          g.fillStyle = vg(g, -75, -53, "#ff6a4a", "#c0221a");
          g.fill();
          stroke(g, "#6e100a", 1.2);
          g.fillStyle = "#ffc93a";
          g.fillRect(x - 5, -76, 10, 2.5);
          g.fillRect(x - 5, -54, 10, 2.5);
          g.strokeStyle = "rgba(255,201,58,.6)";
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(x, -73);
          g.lineTo(x, -55);
          g.stroke();
          g.strokeStyle = "#ffc93a";
          g.lineWidth = 1.4;
          for (const k of [-1.5, 0, 1.5]) {
            g.beginPath();
            g.moveTo(x + k, -51);
            g.lineTo(x + k, -44);
            g.stroke();
          }
        }
        return { glow: [0, -64] };
      },
    ],
    luckycat: [
      40,
      56,
      20,
      52,
      (g) => {
        rr(g, -14, -6, 28, 6, 3);
        g.fillStyle = vg(g, -6, 0, "#e8413a", "#a01f18");
        g.fill();
        stroke(g, "#5e100a", 1.2);
        const L = "#7a6a5a";
        ell(g, 0, -16, 11, 11);
        g.fillStyle = vg(g, -27, -5, "#ffffff", "#e6dfd2");
        g.fill();
        stroke(g, L, 1.4);
        // Raised paw.
        ell(g, 11, -32, 4, 6, 0.2);
        g.fillStyle = "#ffffff";
        g.fill();
        stroke(g, L, 1.2);
        g.beginPath();
        g.arc(0, -32, 10, 0, 7);
        g.fillStyle = vg(g, -42, -22, "#ffffff", "#ece6da");
        g.fill();
        stroke(g, L, 1.4);
        for (const s of [-1, 1]) {
          g.beginPath();
          g.moveTo(s * 9, -36);
          g.lineTo(s * 8, -45);
          g.lineTo(s * 3, -41);
          g.closePath();
          g.fillStyle = "#ffffff";
          g.fill();
          stroke(g, L, 1.2);
          g.strokeStyle = "#2c2a26";
          g.lineWidth = 1.3;
          g.beginPath();
          g.arc(s * 4, -33, 2, Math.PI + 0.4, -0.4);
          g.stroke();
        }
        g.fillStyle = "#ff8fa8";
        g.beginPath();
        g.arc(0, -30, 1.2, 0, 7);
        g.fill();
        g.strokeStyle = "#e8413a";
        g.lineWidth = 2.4;
        g.beginPath();
        g.arc(0, -32, 9.5, 0.6, Math.PI - 0.6);
        g.stroke();
        ball(g, 0, -23, 2.6, "#ffc93a", 0.6);
        ell(g, -4, -14, 4, 5);
        g.fillStyle = "#ffc93a";
        g.fill();
        stroke(g, "#a87a1a", 1);
      },
    ],
    snowman: [
      48,
      82,
      24,
      78,
      (g) => {
        for (const [y, r] of [
          [-12, 13],
          [-33, 10],
          [-50, 8],
        ]) {
          g.beginPath();
          g.arc(0, y, r + 1.4, 0, 7);
          g.fillStyle = "#8aa0c0";
          g.fill();
          ball(g, 0, y, r, "#f4f9ff", 0.6);
        }
        g.strokeStyle = "#6b4527";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(-9, -36);
        g.lineTo(-20, -44);
        g.moveTo(9, -36);
        g.lineTo(20, -46);
        g.moveTo(17, -43);
        g.lineTo(21, -41);
        g.stroke();
        rr(g, -10, -45, 20, 5, 2);
        g.fillStyle = "#e8413a";
        g.fill();
        rr(g, 3, -44, 5, 12, 2);
        g.fill();
        g.fillStyle = "#2c3348";
        rr(g, -9, -60, 18, 3, 1);
        g.fill();
        rr(g, -6, -70, 12, 11, 2);
        g.fill();
        g.fillStyle = "#e8413a";
        g.fillRect(-6, -62, 12, 2);
        g.fillStyle = "#1c1630";
        for (const [x, y] of [
          [-3, -52],
          [3, -52],
          [0, -30],
          [0, -24],
          [0, -16],
        ]) {
          g.beginPath();
          g.arc(x, y, 1.2, 0, 7);
          g.fill();
        }
        g.fillStyle = "#ff8a3d";
        g.beginPath();
        g.moveTo(0, -50);
        g.lineTo(8, -48.5);
        g.lineTo(0, -47.5);
        g.fill();
      },
    ],
    gifts: [
      52,
      44,
      26,
      40,
      (g) => {
        const box = (x, w, h, y, c, rb) => {
          rr(g, x - w / 2, y - h, w, h, 2);
          g.fillStyle = vg(g, y - h, y, lt(c, 0.2), dk(c, 0.15));
          g.fill();
          stroke(g, dk(c, 0.5), 1.3);
          g.fillStyle = rb;
          g.fillRect(x - 1.6, y - h, 3.2, h);
          g.fillRect(x - w / 2, y - h / 2 - 1.6, w, 3.2);
          for (const s of [-1, 1]) {
            ell(g, x + s * 3.4, y - h - 2, 3.6, 2.2, s * 0.5);
            g.strokeStyle = rb;
            g.lineWidth = 1.8;
            g.stroke();
          }
        };
        box(-9, 18, 16, 0, "#e8413a", "#ffd65b");
        box(10, 16, 13, 0, "#2fb36a", "#ffffff");
        box(-1, 14, 11, -16, "#5f7bff", "#ff8fb4");
      },
    ],
    plumtree: [
      112,
      134,
      56,
      128,
      (g) => {
        srand(71);
        g.strokeStyle = "#3a2418";
        g.lineCap = "round";
        const branch = (x, y, a, len, w, depth) => {
          const ex = x + Math.cos(a) * len,
            ey = y + Math.sin(a) * len;
          g.lineWidth = w;
          g.beginPath();
          g.moveTo(x, y);
          g.quadraticCurveTo(
            x + Math.cos(a + 0.4) * len * 0.5,
            y + Math.sin(a + 0.4) * len * 0.5,
            ex,
            ey,
          );
          g.stroke();
          if (depth > 0) {
            branch(
              ex,
              ey,
              a - 0.5 - rnd() * 0.3,
              len * 0.7,
              w * 0.62,
              depth - 1,
            );
            branch(
              ex,
              ey,
              a + 0.45 + rnd() * 0.3,
              len * 0.66,
              w * 0.6,
              depth - 1,
            );
          } else pts.push([ex, ey]);
        };
        const pts = [];
        branch(0, 0, -Math.PI / 2, 44, 9, 3);
        for (const [x, y] of pts)
          for (let k = 0; k < 6; k++) {
            const px = x + (rnd() - 0.5) * 22,
              py = y + (rnd() - 0.5) * 16;
            flower5(
              g,
              px,
              py,
              2.4,
              ["#ff6f9a", "#ff9bbd", "#ffffff", "#e8415e"][k % 4],
              "#ffe46a",
            );
          }
      },
    ],
    xmastree: [
      96,
      158,
      48,
      148,
      (g) => {
        blit(g, pine(84, 72), 0, 0);
        srand(72);
        // A garland, baubles, a star on top.
        g.strokeStyle = "#ffd65b";
        g.lineWidth = 1.6;
        for (const [y, w] of [
          [-34, 34],
          [-62, 26],
          [-88, 17],
        ]) {
          g.beginPath();
          g.moveTo(-w, y - 6);
          g.quadraticCurveTo(0, y + 6, w, y - 10);
          g.stroke();
        }
        const cols = ["#e8413a", "#5fb3ff", "#ffd65b", "#ff8fb4", "#ffffff"];
        for (let i = 0; i < 16; i++) {
          const y = -24 - rnd() * 92,
            span = 38 * (1 - (-y - 20) / 120),
            x = (rnd() - 0.5) * span * 1.6;
          ball(g, x, y, 2.6, cols[i % 5], 0.6);
        }
        g.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + (k * Math.PI) / 5,
            r = k % 2 ? 4 : 9;
          g.lineTo(Math.cos(a) * r, -134 + Math.sin(a) * r);
        }
        g.closePath();
        g.fillStyle = "#ffd65b";
        g.fill();
        stroke(g, "#b4861c", 1.2);
        return { glow: [0, -134] };
      },
    ],
  };
  /** A decoration's baked picture (20261117120000), or null for one drawn elsewhere. */
  function deco(id) {
    const a = DECO_ART[id];
    return a ? memo(`deco:${id}`, () => sprite(...a)) : null;
  }
  /**
   * Forget every baked sprite (2× canvases, ~45 MB once the Plaza and the Farm
   * have both been visited). A scene that is open keeps the sprites it holds
   * (nothing is blanked); the next visit paints them again. Used where memory is short (an iPhone
   * opening a battle), see releaseHubArt in main.ts.
   */
  function release() {
    cache.clear();
    shadows.clear();
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
    release,
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
    bakery,
    barn,
    windmillBody,
    windmillSails,
    stall,
    board,
    well,
    doghouse,
    coop,
    coopYard,
    foodTruck,
    gazebo,
    scarecrow,
    plinth,
    sign,
    deco,
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
