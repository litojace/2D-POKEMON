/* ======================================================================
   PLAZA: a painted playground (walk, jump, dash, ball, track, runway)
   ====================================================================== */
const PZ = (() => {
  const W = 2700, H = 1700, SPEED = 240, R = 18;
  const SQ = { x: 1350, y: 900, rx: 372, ry: 246 };
  const FOUNT = { x: 1350, y: 892, rx: 118, ry: 74 };
  const STAGE = { x0: 1140, x1: 1560, y0: 340, y1: 450 }, WALK = { x0: 1300, x1: 1400, y0: 450, y1: 612 };
  const LED = { x0: 1130, x1: 1570, y0: 150, y1: 300 };
  const PITCH = { x0: 1980, x1: 2580, y0: 650, y1: 1150, gy0: 835, gy1: 965 };
  const TRACK = { cx: 540, cy: 930, ro: [400, 290], ri: [262, 168] };
  const POND = { x: 2210, y: 1450, rx: 220, ry: 118 };
  const GATE = { x: 1350, y: 1600 };
  const PADS = [[1145, 765], [1555, 765], [1145, 1035], [1555, 1035]];
  const PHOTO = { x: 1010, y: 500 }, CAFE = { x: 1745, y: 480 }, BOARD = { x: 1050, y: 1265 }, LEADER = { x: 240, y: 600 };
  const HURDLES = [-30, 60, 150].map(d => d * Math.PI / 180);
  const CPS = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

  const cv = $("pz-cv"), ctx = cv.getContext("2d"), mcv = $("pz-mcv"), mctx = mcv.getContext("2d");
  let NW = 1280, NH = 800, PS = 1, Z = 1, cam = { x: SQ.x, y: SQ.y + 120 };
  let running = false, started = false, ready = false, raf = 0, last = 0, T = 0;

  /* ---------- helpers ---------- */
  const ell = (x, y) => { const dx = (x - TRACK.cx) / TRACK.ro[0], dy = (y - TRACK.cy) / TRACK.ro[1]; return { r: Math.hypot(dx, dy), a: Math.atan2(dy, dx) }; };
  const onTrack = (x, y) => ((x - TRACK.cx) / TRACK.ro[0]) ** 2 + ((y - TRACK.cy) / TRACK.ro[1]) ** 2 <= 1 && ((x - TRACK.cx) / TRACK.ri[0]) ** 2 + ((y - TRACK.cy) / TRACK.ri[1]) ** 2 >= 1;
  const trackPt = (a, k = .5) => ({ x: TRACK.cx + Math.cos(a) * (TRACK.ri[0] + (TRACK.ro[0] - TRACK.ri[0]) * k), y: TRACK.cy + Math.sin(a) * (TRACK.ri[1] + (TRACK.ro[1] - TRACK.ri[1]) * k) });
  const HSEG = HURDLES.map(a => [trackPt(a, 0), trackPt(a, 1)]);
  function segDist(x, y, a, b) { const vx = b.x - a.x, vy = b.y - a.y, t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy))); return Math.hypot(x - a.x - vx * t, y - a.y - vy * t); }
  const inRect = (p, r) => p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1;
  const inRunway = p => inRect(p, STAGE) || inRect(p, WALK);
  const inSquare = (x, y, k = 1) => ((x - SQ.x) / (SQ.rx * k)) ** 2 + ((y - SQ.y) / (SQ.ry * k)) ** 2 < 1;
  const inPitch = (p, m = 0) => p.x > PITCH.x0 - m && p.x < PITCH.x1 + m && p.y > PITCH.y0 - m && p.y < PITCH.y1 + m;
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  /* ---------- scenery placement ---------- */
  function clear(x, y, pad = 0) {
    if (inSquare(x, y, 1.22 + pad / 300)) return false;
    if (inPitch({ x, y }, 130 + pad)) return false;
    if (((x - TRACK.cx) / (TRACK.ro[0] + 80 + pad)) ** 2 + ((y - TRACK.cy) / (TRACK.ro[1] + 80 + pad)) ** 2 < 1) return false;
    if (x > LED.x0 - 140 && x < LED.x1 + 140 && y < WALK.y1 + 70) return false;
    if (((x - POND.x) / (POND.rx + 80)) ** 2 + ((y - POND.y) / (POND.ry + 70)) ** 2 < 1) return false;
    if (Math.abs(x - SQ.x) < 120 && y > SQ.y) return false;
    if (Math.abs(y - SQ.y) < 100 && (x > SQ.x || x < SQ.x)) { if (x > SQ.x + 200 && x < PITCH.x0) return false; if (x < SQ.x - 200 && x > TRACK.cx) return false; }
    if (Math.hypot(x - PHOTO.x, (y - PHOTO.y) * 1.4) < 190 || Math.hypot(x - CAFE.x, (y - CAFE.y) * 1.3) < 230 || Math.hypot(x - BOARD.x, y - BOARD.y) < 140 || Math.hypot(x - LEADER.x, y - LEADER.y) < 130) return false;
    if (HOUSES.some(h => Math.abs(x - h.x) < 130 && y > h.y - 230 && y < h.y + 60)) return false;
    if (y > 1480 && Math.abs(x - GATE.x) < 280) return false;
    return true;
  }
  const HOUSES = [
    { x: 170, y: 330, o: { wall: "#ffe9c8", roof: "#e8564a", shutters: "#5fb3ff", sd: 1, w: 150 } },
    { x: 410, y: 300, o: { wall: "#ffd6e0", roof: "#3f6fd0", shutters: "#ffffff", sd: 2, w: 140, windows: 1, sign: { t: "STUDIO", bg: "#2a1f4c" } } },
    { x: 650, y: 330, o: { wall: "#d8f5e4", roof: "#2a8a7a", shutters: "#ffd65b", sd: 3, w: 160 } },
    { x: 2060, y: 320, o: { wall: "#fff1b8", roof: "#8a4ad0", shutters: "#ff9bd2", sd: 4, w: 150, windows: 1, sign: { t: "BAKERY", bg: "#7a3a1a" } } },
    { x: 2300, y: 300, o: { wall: "#e2ecff", roof: "#ef7a3a", shutters: "#4fae46", sd: 5, w: 150 } },
    { x: 2540, y: 330, o: { wall: "#ffe0cc", roof: "#2f4a8a", shutters: "#ffffff", sd: 6, w: 140, windows: 1 } },
  ].map(h => ({ ...h, spr: GFX.house(h.o) }));
  const TREES = [
    [70, 560, "pine"], [60, 820, "round"], [110, 1220, "mint"], [260, 1470, "autumn"], [560, 1520, "round"], [820, 1440, "cherry"],
    [905, 210, "cherry"], [1800, 210, "cherry"], [2660, 600, "pine"], [2660, 1280, "mint"], [2520, 1610, "autumn"], [1880, 1530, "round"],
    [930, 1180, "apple"], [1810, 1240, "orange"], [2680, 920, "pine"], [60, 330, "lime"],
  ].map(([x, y, k], i) => ({ x, y, k, t: GFX.tree(k, 11 + i, k === "pine" ? 1 : .9 + (i % 3) * .08), ph: i * 1.7 }));
  const BUSHES = [], ROCKS = [];
  seed = 5;
  for (let i = 0; i < 3000 && BUSHES.length < 20; i++) { const x = 40 + rnd() * (W - 80), y = 140 + rnd() * (H - 180); if (clear(x, y) && TREES.every(t => Math.hypot(t.x - x, t.y - y) > 110) && BUSHES.every(t => Math.hypot(t.x - x, t.y - y) > 150)) BUSHES.push({ x, y, spr: GFX.bush(["flower", "green", "rose", "mint", "flower"][BUSHES.length % 5], BUSHES.length + 1, 62 + rnd() * 26) }); }
  for (let i = 0; i < 2000 && ROCKS.length < 7; i++) { const x = 40 + rnd() * (W - 80), y = 140 + rnd() * (H - 180); if (clear(x, y) && [...TREES, ...BUSHES].every(t => Math.hypot(t.x - x, t.y - y) > 90)) ROCKS.push({ x, y, spr: GFX.rock(ROCKS.length + 2, 34 + rnd() * 26) }); }
  const LAMPS = [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = (i + .5) / 8 * Math.PI * 2; return { x: SQ.x + Math.cos(a) * (SQ.rx + 34), y: SQ.y + Math.sin(a) * (SQ.ry + 22) }; });
  LAMPS.push({ x: 1280, y: 1300 }, { x: 1420, y: 1300 }, { x: 1280, y: 1460 }, { x: 1420, y: 1460 }, { x: 1830, y: 850 }, { x: 1830, y: 950 }, { x: 870, y: 850 }, { x: 870, y: 950 });
  const BEDS = [];
  const BENCHES = [[-.62, 1], [.62, 1], [-.58, -1], [.58, -1]].map(([k, sgn]) => ({ x: SQ.x + k * SQ.rx * 1.24, y: SQ.y + sgn * SQ.ry * .95 + (sgn > 0 ? 60 : -40) }));
  const FLOOD = [[PITCH.x0 - 30, PITCH.y0 - 20], [PITCH.x1 + 30, PITCH.y0 - 20], [PITCH.x0 - 30, PITCH.y1 + 30], [PITCH.x1 + 30, PITCH.y1 + 30]].map(([x, y]) => ({ x, y }));
  const OBST = [{ x: FOUNT.x, y: FOUNT.y, r: 100, sy: 1.6 }, ...TREES.map(t => ({ x: t.x, y: t.y, r: 22 })), ...LAMPS.map(l => ({ x: l.x, y: l.y, r: 9 })), ...BEDS.map(p => ({ x: p.x, y: p.y - 10, r: 58, sy: 2.6 })), ...BENCHES.map(b => ({ x: b.x, y: b.y - 6, r: 40, sy: 3 })), ...BUSHES.map(b => ({ x: b.x, y: b.y - 4, r: 26, sy: 1.6 })), ...ROCKS.map(b => ({ x: b.x, y: b.y - 4, r: 16, sy: 1.6 })), ...FLOOD.map(f => ({ x: f.x, y: f.y, r: 12 })), ...HOUSES.map(h => ({ x: h.x + 14, y: h.y - 30, r: 110, sy: 3 })), { x: CAFE.x + 10, y: CAFE.y - 40, r: 130, sy: 2.6 }, { x: BOARD.x, y: BOARD.y, r: 54, sy: 3 }, { x: LEADER.x, y: LEADER.y, r: 60, sy: 3 }, { x: PHOTO.x + 72, y: PHOTO.y - 8, r: 20 }];

  /* ---------- background prerender ---------- */
  const bg = document.createElement("canvas"); bg.width = W; bg.height = H;
  function paintBg() {
    const g = bg.getContext("2d"); seed = 11;
    // grass: soft gradient, painterly dabs, tufts, clover, little flowers
    g.fillStyle = "#77c25b"; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { const x = rnd() * W, y = rnd() * H, r = 120 + rnd() * 320, gr = g.createRadialGradient(x, y, 0, x, y, r), c = rnd() < .5 ? "150,220,110" : "70,150,70"; gr.addColorStop(0, `rgba(${c},.28)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    const greens = ["#6cb851", "#82cc63", "#5fae4a", "#8fd46e", "#71bd55"];
    for (let i = 0; i < 26000; i++) { const x = rnd() * W, y = rnd() * H; g.fillStyle = greens[i % 5]; g.beginPath(); g.ellipse(x, y, 2.4 + rnd() * 2.6, 1.3 + rnd(), rnd() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 2200; i++) { const x = rnd() * W, y = rnd() * H; g.strokeStyle = rnd() < .5 ? "#4f9a3c" : "#a6e07e"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x - 4, y - 7); g.moveTo(x, y); g.lineTo(x, y - 9); g.moveTo(x + 3, y); g.lineTo(x + 5, y - 7); g.stroke(); }
    for (let i = 0; i < 520; i++) { const x = rnd() * W, y = rnd() * H; if (!clear(x, y)) continue; const c = ["#ffffff", "#fff3a6", "#ffc4dc", "#cfe2ff"][i % 4]; for (let k = 0; k < 5; k++) { g.fillStyle = c; g.beginPath(); g.arc(x + Math.cos(k * 1.256) * 2.2, y + Math.sin(k * 1.256) * 2.2, 1.8, 0, 7); g.fill(); } g.fillStyle = "#ffcf3a"; g.beginPath(); g.arc(x, y, 1.2, 0, 7); g.fill(); }
    // stone paths: soft bed + rounded cobbles
    const path = (pts, w = 100) => {
      g.lineCap = "round"; g.lineJoin = "round";
      g.strokeStyle = "rgba(60,90,40,.35)"; g.lineWidth = w + 18; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
      g.strokeStyle = "#d9c9a3"; g.lineWidth = w + 6; g.stroke();
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
        for (let d = 0; d < L; d += 22) for (let k = -w / 2 + 14; k < w / 2 - 6; k += 24) {
          const jx = (rnd() - .5) * 6, jy = (rnd() - .5) * 6, x = x0 + ux * d - uy * (k + ((d / 22) % 2) * 12) + jx, y = y0 + uy * d + ux * (k + ((d / 22) % 2) * 12) + jy;
          const c = ["#efe3c8", "#e6d6b4", "#f4ead6", "#dccaa6"][Math.floor(rnd() * 4)];
          g.fillStyle = "rgba(120,100,60,.45)"; g.beginPath(); g.roundRect(x - 10, y - 7 + 2, 20, 15, 6); g.fill();
          g.fillStyle = c; g.beginPath(); g.roundRect(x - 10, y - 8, 20, 15, 6); g.fill();
          g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.roundRect(x - 7, y - 6, 9, 3.5, 2); g.fill();
        }
      }
    };
    path([[SQ.x, SQ.y + 200], [SQ.x, GATE.y + 30]], 116);
    path([[SQ.x + 330, SQ.y], [PITCH.x0 + 10, SQ.y]], 104);
    path([[SQ.x - 350, SQ.y], [TRACK.cx + TRACK.ro[0] - 30, TRACK.cy]], 104);
    path([[SQ.x, SQ.y - 200], [SQ.x, WALK.y1 - 10]], 116);
    path([[SQ.x + 220, SQ.y - 180], [CAFE.x - 40, CAFE.y + 50]], 80);
    path([[SQ.x - 220, SQ.y - 180], [PHOTO.x + 20, PHOTO.y + 50]], 80);
    path([[SQ.x - 240, SQ.y + 200], [BOARD.x + 30, BOARD.y - 10]], 72);
    path([[SQ.x + 120, GATE.y - 200], [POND.x - 170, POND.y - 40]], 72);
    path([[TRACK.cx - 40, TRACK.cy - TRACK.ro[1] - 10], [LEADER.x + 20, LEADER.y + 30]], 64);
    path([[410, 330], [410, 470], [900, 520]], 64); path([[2300, 330], [2300, 460], [1900, 500]], 64);
    // plaza square: concentric pavers + elemental mosaic
    g.save(); g.translate(SQ.x, SQ.y); g.scale(1, SQ.ry / SQ.rx);
    g.fillStyle = "rgba(60,50,30,.35)"; g.beginPath(); g.arc(0, 14, SQ.rx + 16, 0, 7); g.fill();
    g.fillStyle = "#b9a98a"; g.beginPath(); g.arc(0, 0, SQ.rx + 8, 0, 7); g.fill();
    const tones = ["#f2e8d4", "#e9dcc2", "#efe2c9", "#e2d3b5", "#f6eedd"];
    for (let r0 = 130; r0 < SQ.rx; r0 += 30) {
      const r1 = Math.min(SQ.rx, r0 + 30), n = Math.round(2 * Math.PI * r1 / 44), off = rnd();
      for (let k = 0; k < n; k++) { const a0 = (k + off) / n * Math.PI * 2, a1 = (k + 1 + off) / n * Math.PI * 2; g.beginPath(); g.arc(0, 0, r1 - 2, a0 + .006, a1 - .006); g.arc(0, 0, r0 + 2, a1 - .006, a0 + .006, true); g.closePath(); g.fillStyle = r0 > SQ.rx - 40 ? "#d2c2a2" : tones[Math.floor(rnd() * tones.length)]; g.fill(); }
    }
    g.fillStyle = "#e9dcc2"; g.beginPath(); g.arc(0, 0, 128, 0, 7); g.fill();
    const EL = ["#ffd84a", "#ff7a45", "#4fb3ff", "#7fe7ff", "#fff1a8", "#c47dff", "#c8955a", "#8a6bff"];
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 - Math.PI / 2; g.save(); g.rotate(a); g.beginPath(); g.moveTo(0, -60); g.lineTo(150, -10); g.lineTo(220, 0); g.lineTo(150, 10); g.lineTo(0, 60); g.closePath(); g.fillStyle = GFX.rgba(EL[i], .5); g.fill(); g.restore(); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 - Math.PI / 2, x = Math.cos(a) * (SQ.rx - 70), y = Math.sin(a) * (SQ.rx - 70); g.fillStyle = "#f8f2e4"; g.beginPath(); g.arc(x, y, 24, 0, 7); g.fill(); g.fillStyle = EL[i]; g.beginPath(); g.arc(x, y, 15, 0, 7); g.fill(); g.fillStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.arc(x - 5, y - 5, 5, 0, 7); g.fill(); }
    g.restore();
    // bounce pads
    PADS.forEach(([x, y]) => { g.fillStyle = "rgba(20,25,60,.45)"; g.beginPath(); g.ellipse(x, y + 6, 52, 32, 0, 0, 7); g.fill(); g.fillStyle = "#2a3170"; g.beginPath(); g.ellipse(x, y + 3, 50, 31, 0, 0, 7); g.fill(); const gr = g.createRadialGradient(x - 12, y - 8, 4, x, y, 48); gr.addColorStop(0, "#c8f0ff"); gr.addColorStop(.5, "#5f8cff"); gr.addColorStop(1, "#3a4fd0"); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 47, 29, 0, 0, 7); g.fill(); g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, 30, 18, 0, 0, 7); g.stroke(); g.fillStyle = "#fff"; g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 9, y - 2); g.lineTo(x + 4, y - 2); g.lineTo(x + 4, y + 8); g.lineTo(x - 4, y + 8); g.lineTo(x - 4, y - 2); g.lineTo(x - 9, y - 2); g.closePath(); g.fill(); });
    // track: rubber surface with lanes
    g.save(); g.fillStyle = "rgba(60,30,20,.35)"; g.beginPath(); g.ellipse(TRACK.cx, TRACK.cy + 10, TRACK.ro[0] + 14, TRACK.ro[1] + 14, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(TRACK.cx, TRACK.cy, TRACK.ro[0], TRACK.ro[1], 0, 0, 7); g.ellipse(TRACK.cx, TRACK.cy, TRACK.ri[0], TRACK.ri[1], 0, 0, 7, true); const tg = g.createLinearGradient(0, TRACK.cy - TRACK.ro[1], 0, TRACK.cy + TRACK.ro[1]); tg.addColorStop(0, "#e8735a"); tg.addColorStop(1, "#c9503c"); g.fillStyle = tg; g.fill("evenodd"); g.restore();
    for (let i = 0; i < 3000; i++) { const a = rnd() * Math.PI * 2, k = rnd(), p = trackPt(a, k); g.fillStyle = rnd() < .5 ? "rgba(255,255,255,.08)" : "rgba(80,20,10,.08)"; g.fillRect(p.x, p.y, 2, 2); }
    g.strokeStyle = "#fff5ea"; g.lineWidth = 4; [TRACK.ro, TRACK.ri].forEach(([a, b]) => { g.beginPath(); g.ellipse(TRACK.cx, TRACK.cy, a, b, 0, 0, 7); g.stroke(); });
    g.lineWidth = 2.5; g.strokeStyle = "rgba(255,245,234,.7)"; [1 / 3, 2 / 3].forEach(k => { g.beginPath(); g.ellipse(TRACK.cx, TRACK.cy, TRACK.ri[0] + (TRACK.ro[0] - TRACK.ri[0]) * k, TRACK.ri[1] + (TRACK.ro[1] - TRACK.ri[1]) * k, 0, 0, 7); g.stroke(); });
    const y0 = TRACK.cy - TRACK.ro[1], y1 = TRACK.cy - TRACK.ri[1];
    for (let y = y0, i = 0; y < y1; y += 12, i++) for (let k = 0; k < 3; k++) { g.fillStyle = (i + k) % 2 ? "#1c1c24" : "#fafafa"; g.fillRect(TRACK.cx - 18 + k * 12, y, 12, 12); }
    g.save(); g.beginPath(); g.ellipse(TRACK.cx, TRACK.cy, TRACK.ri[0] - 3, TRACK.ri[1] - 3, 0, 0, 7); g.clip(); for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? "rgba(140,210,100,.35)" : "rgba(80,150,60,.25)"; g.fillRect(TRACK.cx - 270 + i * 54, TRACK.cy - 180, 54, 360); } g.restore();
    g.font = "800 50px 'Barlow Condensed', sans-serif"; g.textAlign = "center"; g.fillStyle = "rgba(255,255,255,.88)"; g.fillText("DASH TRACK", TRACK.cx, TRACK.cy + 18);
    // pitch
    g.fillStyle = "rgba(30,60,30,.4)"; g.beginPath(); g.roundRect(PITCH.x0 - 34, PITCH.y0 - 30, PITCH.x1 - PITCH.x0 + 68, PITCH.y1 - PITCH.y0 + 60, 18); g.fill();
    g.fillStyle = "#4fa443"; g.beginPath(); g.roundRect(PITCH.x0 - 28, PITCH.y0 - 24, PITCH.x1 - PITCH.x0 + 56, PITCH.y1 - PITCH.y0 + 48, 16); g.fill();
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? "#5fb951" : "#56ad48"; g.fillRect(PITCH.x0 + i * (PITCH.x1 - PITCH.x0) / 10, PITCH.y0, (PITCH.x1 - PITCH.x0) / 10 + 1, PITCH.y1 - PITCH.y0); }
    g.strokeStyle = "#f6fff2"; g.lineWidth = 5; g.strokeRect(PITCH.x0, PITCH.y0, PITCH.x1 - PITCH.x0, PITCH.y1 - PITCH.y0);
    const pcx = (PITCH.x0 + PITCH.x1) / 2, pcy = (PITCH.y0 + PITCH.y1) / 2;
    g.beginPath(); g.moveTo(pcx, PITCH.y0); g.lineTo(pcx, PITCH.y1); g.stroke(); g.beginPath(); g.ellipse(pcx, pcy, 78, 52, 0, 0, 7); g.stroke();
    g.fillStyle = "#f6fff2"; g.beginPath(); g.arc(pcx, pcy, 5, 0, 7); g.fill();
    g.strokeRect(PITCH.x0, PITCH.gy0 - 50, 96, PITCH.gy1 - PITCH.gy0 + 100); g.strokeRect(PITCH.x1 - 96, PITCH.gy0 - 50, 96, PITCH.gy1 - PITCH.gy0 + 100);
    // pond rim stones
    g.fillStyle = "rgba(40,60,40,.35)"; g.beginPath(); g.ellipse(POND.x, POND.y + 10, POND.rx + 26, POND.ry + 18, 0, 0, 7); g.fill();
    for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2, x = POND.x + Math.cos(a) * (POND.rx + 10), y = POND.y + Math.sin(a) * (POND.ry + 8); const c = ["#c9cdd6", "#b4b9c4", "#d9dce3"][i % 3]; g.fillStyle = "#7f8594"; g.beginPath(); g.ellipse(x, y + 3, 18, 11, a, 0, 7); g.fill(); g.fillStyle = c; g.beginPath(); g.ellipse(x, y, 17, 10, a, 0, 7); g.fill(); }
    // runway floor & catwalk
    g.fillStyle = "rgba(10,5,25,.5)"; g.fillRect(STAGE.x0 - 10, STAGE.y0 + 6, STAGE.x1 - STAGE.x0 + 20, STAGE.y1 - STAGE.y0 + 24); g.fillRect(WALK.x0 - 8, WALK.y0, WALK.x1 - WALK.x0 + 16, WALK.y1 - WALK.y0 + 22);
    g.fillStyle = "#231a3d"; g.fillRect(STAGE.x0, STAGE.y1, STAGE.x1 - STAGE.x0, 18); g.fillRect(WALK.x0, WALK.y1, WALK.x1 - WALK.x0, 16);
    const fl = g.createLinearGradient(0, STAGE.y0, 0, STAGE.y1); fl.addColorStop(0, "#3a2b66"); fl.addColorStop(1, "#2a1f4c"); g.fillStyle = fl; g.fillRect(STAGE.x0, STAGE.y0, STAGE.x1 - STAGE.x0, STAGE.y1 - STAGE.y0);
    const fw = g.createLinearGradient(WALK.x0, 0, WALK.x1, 0); fw.addColorStop(0, "#2a1f4c"); fw.addColorStop(.5, "#3d2d6e"); fw.addColorStop(1, "#2a1f4c"); g.fillStyle = fw; g.fillRect(WALK.x0, WALK.y0 - 1, WALK.x1 - WALK.x0, WALK.y1 - WALK.y0 + 1);
    g.strokeStyle = "#ffd65b"; g.lineWidth = 3; g.strokeRect(STAGE.x0, STAGE.y0, STAGE.x1 - STAGE.x0, STAGE.y1 - STAGE.y0); g.beginPath(); g.moveTo(WALK.x0, WALK.y0); g.lineTo(WALK.x0, WALK.y1); g.lineTo(WALK.x1, WALK.y1); g.lineTo(WALK.x1, WALK.y0); g.stroke();
    for (let x = STAGE.x0 + 14; x < STAGE.x1; x += 26) { g.fillStyle = "#fff4c2"; g.beginPath(); g.arc(x, STAGE.y1 + 9, 3, 0, 7); g.fill(); }
    for (let y = WALK.y0 + 14; y < WALK.y1; y += 24) { g.fillStyle = "#ff9bd2"; [WALK.x0 + 8, WALK.x1 - 8].forEach(x => { g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill(); }); }
    // photo spot pad
    g.fillStyle = "rgba(255,255,255,.22)"; g.beginPath(); g.ellipse(PHOTO.x, PHOTO.y + 30, 74, 40, 0, 0, 7); g.fill(); g.strokeStyle = "#ffffffaa"; g.setLineDash([8, 8]); g.lineWidth = 2; g.stroke(); g.setLineDash([]);
    // garden strip beyond the gate
    g.fillStyle = "#5fa444"; g.fillRect(0, GATE.y + 20, W, H - GATE.y - 20);
    for (let r = 0; r < 2; r++) for (let x = 80; x < W - 60; x += 150) { if (Math.abs(x + 55 - GATE.x) < 170) continue; g.fillStyle = "#7a5534"; g.beginPath(); g.roundRect(x, GATE.y + 42 + r * 30, 110, 20, 8); g.fill(); for (let k = 0; k < 5; k++) { g.fillStyle = "#3f8f3a"; g.beginPath(); g.arc(x + 11 + k * 22, GATE.y + 46 + r * 30, 7, 0, 7); g.fill(); g.fillStyle = "#8fdc66"; g.beginPath(); g.arc(x + 9 + k * 22, GATE.y + 44 + r * 30, 4, 0, 7); g.fill(); } }
    for (let x = 10; x < W; x += 30) { if (Math.abs(x - GATE.x) < 72) continue; g.fillStyle = "#9a6a3a"; g.beginPath(); g.roundRect(x, GATE.y + 2, 10, 28, 3); g.fill(); g.fillStyle = "#c48a4a"; g.fillRect(x, GATE.y + 2, 10, 4); }
    g.fillStyle = "#b07a42"; g.fillRect(0, GATE.y + 10, GATE.x - 72, 5); g.fillRect(GATE.x + 72, GATE.y + 10, W - GATE.x - 72, 5); g.fillRect(0, GATE.y + 21, GATE.x - 72, 4); g.fillRect(GATE.x + 72, GATE.y + 21, W - GATE.x - 72, 4);
  }

  /* ---------- sprites cache ---------- */
  function prep() { paintBg(); ready = true; }

  /* ---------- entities ---------- */
  const mk = o => ({ vx: 0, vy: 0, z: 0, air: 0, airDur: 0, airH: 0, dash: 0, dcd: 0, stun: 0, face: 1, emote: null, emoteT: 0, sp: 0, trail: [], dance: 0, buff: 0, ...o });
  const P = mk({ x: SQ.x, y: SQ.y + 190, key: null, name: "tester", me: true });
  const NPC_DEF = [
    ["minh_anh", "cindrake-blue-flame:1", "ballA"], ["Hikari", "lumoth-aurora:1", "runway"], ["quang.vo", "tidefin-moontide:2", "runway"],
    ["sunny", "voltkit-neon-arcade:1", "ballA"], ["Rin", "duskveil-pumpkin-lantern:1", "ballB"], ["kenji.owl", "mystowl-oracle:2", "wander"],
    ["Nova", "terradon-world-shell:1", "track"], ["duy99", "auralynx-cherry-blossom:1", "track"], ["mochi", "tidefin-koi-pond:1", "wander"],
    ["PhucLe", "cindrake-volcano-forge:1", "ballB"], ["Yuki", "auralynx-celestial-sage:1", "dance"], ["an_nhien", "lumoth-starweaver:1", "cafe"],
    ["Zed", "mystowl-witchs-familiar:1", "photo"], ["Lena", "terradon-bonsai:1", "wander"], ["Kai", "voltkit-stormcrown:2", "dance"],
  ];
  const NPCS = NPC_DEF.map(([name, key, ai], i) => mk({ name, key, ai, x: SQ.x + Math.cos(i * 1.7) * 230, y: SQ.y + Math.sin(i * 1.7) * 150, tx: null, ty: null, wait: Math.random() * 2, ta: -Math.PI / 2 - i * .9, step: 0 }));
  const BODIES = [P, ...NPCS];
  const ball = { x: (PITCH.x0 + PITCH.x1) / 2, y: (PITCH.y0 + PITCH.y1) / 2, vx: 0, vy: 0, r: 22, spin: 0, lock: 0, z: 0, vz: 0 };
  const score = [0, 0];
  const FX = [];
  const DUCKS = ["drake", "hen", "hen", "drake"].map((k, i) => ({ k, a: i * 1.6, s: (.1 + i * .02) * (i % 2 ? 1 : -1), x: 0, y: 0, face: 1, dab: 0, r: .4 + (i % 2) * .25 }));
  const FISH = [0, 1, 2].map(i => ({ a: i * 2, x: POND.x, y: POND.y, s: .3 + i * .1, jump: 0, c: ["#ff8a3d", "#ffffff", "#ffd65b"][i] }));
  const HENS = ["white", "brown", "white"].map((k, i) => ({ k, x: GATE.x - 220 + i * 190, y: GATE.y - 100 + i * 18, tx: null, ty: null, wait: 1 + i, face: 1, st: "idle", t0: 0 }));
  const PIGEONS = Array.from({ length: 9 }, (_, i) => { const a = i * .7 + 1, r = .35 + (i % 3) * .18; return { x: SQ.x + Math.cos(a) * SQ.rx * r, y: SQ.y + Math.sin(a) * SQ.ry * r + 30, z: 0, st: "idle", face: i % 2 ? 1 : -1, tx: null, ty: null, wait: Math.random() * 3, fly: 0, kind: i === 4 ? "sparrow" : "pigeon" }; });
  const BUTTER = Array.from({ length: 7 }, (_, i) => { const h = [...BEDS, ...BUSHES][i * 2 % (BEDS.length + BUSHES.length)]; return { hx: h.x, hy: h.y - 40, x: h.x, y: h.y - 40, ph: i * 1.3, c: ["#ffd65b", "#ffb3d1", "#bfe3ff", "#ffffff", "#c9a3ff", "#ffd65b", "#ff9b6a"][i] }; });
  let flock = null;
  const CAT = { b: BENCHES[2], awake: 0 };
  const PET = { x: SQ.x, y: SQ.y + 100, face: 1, st: "idle", breed: "corgi", bark: 0 };
  const SMOKE = [];
  const run = { state: 0, t0: 0, best: 23.71, next: 0, last: null, board: [["Nova", 21.84], ["duy99", 22.90], ["Hikari", 24.12], ["tester", 23.71], ["Rin", 26.05]] };
  let claps = 0, clapT = 0, runwayOn = false, zoneName = "", bannerT = 0;
  // time of day follows the real clock (0.25 sunrise, 0.75 sunset); the clock button previews day/night for 2 minutes
  const FASTP = (() => { try { return localStorage.getItem("ea-fast") === "1"; } catch { return false; } })();
  const realTod = () => { const d = new Date(); return (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400; };
  let tod = FASTP ? 0.42 : realTod(), todHold = 0;
  // Orb Shower: on the quarter hour (:00 :15 :30 :45) for one minute; fast demo time keeps the old 70 s rhythm
  const untilQuarter = () => { const d = new Date(), s = (d.getMinutes() % 15) * 60 + d.getSeconds() + d.getMilliseconds() / 1000; return 900 - s; };
  const ev = { next: FASTP ? 20 : untilQuarter(), on: false, end: 0, orbs: [] };
  const Q = [
    { id: "goal", t: "Score a goal on the pitch", n: 0, max: 1, r: 30 },
    { id: "lap", t: "Run a lap in under 30 s", n: 0, max: 1, r: 40 },
    { id: "claps", t: "15 cheers on the runway", n: 0, max: 15, r: 30 },
    { id: "orbs", t: "Catch 10 falling orbs", n: 0, max: 10, r: 25 },
    { id: "photo", t: "Use the Photo Spot", n: 0, max: 1, r: 15 },
  ];
  const claimed = new Set();
  function quest(id, add = 1) { const q = Q.find(q => q.id === id); if (!q || q.n >= q.max) return; q.n = Math.min(q.max, q.n + add); if (q.n >= q.max) feed(null, `Quest complete: <b>${q.t}</b>`); renderQuests(); }
  const qmin = { desk: false, phone: true };
  const qk = () => S.phone ? "phone" : "desk";
  function renderQuests() {
    const done = Q.filter(q => q.n >= q.max).length;
    $("pz-quests").className = `pz-quests glass${qmin[qk()] ? " min" : ""}`;
    $("pz-quests").innerHTML = `<h5><span>Plaza today · ${done}/${Q.length}</span><button type="button" data-qmin aria-label="Collapse">${qmin[qk()] ? "▾" : "▴"}</button></h5>${Q.map(q => `<div class="pz-q${q.n >= q.max ? " done" : ""}"><span>${q.t}</span>${q.n >= q.max && !claimed.has(q.id) ? `<button type="button" class="claim" data-claim="${q.id}">+${q.r} ${L}</button>` : `<span class="rw">${claimed.has(q.id) ? "✓" : `+${q.r} ${L}`}</span>`}<span class="bar"><i style="width:${(q.n / q.max) * 100}%"></i></span></div>`).join("")}`;
  }
  $("pz-quests").addEventListener("click", e => {
    if (e.target.closest("[data-qmin]")) { qmin[qk()] = !qmin[qk()]; return renderQuests(); }
    const c = e.target.closest("[data-claim]"); if (!c) return;
    const q = Q.find(q => q.id === c.dataset.claim); claimed.add(q.id); ECON.leaves += q.r; updateWallet(); pzToast(`+${q.r} Gold Leaves`); renderQuests();
  });

  /* ---------- feed / banner / toast ---------- */
  function feed(key, html) {
    const box = $("pz-feed"), d = document.createElement("div");
    d.innerHTML = `${key ? `<img src="${svgUrl(ART[key])}" alt="">` : `<img src="${heroArt(CH[S.champ].id)}" alt="">`}<span>${html}</span>`;
    box.prepend(d); while (box.children.length > 4) box.lastChild.remove();
    setTimeout(() => d.classList.add("out"), 5200); setTimeout(() => d.remove(), 6000);
  }
  function banner(name, sub, color) { const b = $("pz-banner"); b.style.setProperty("--zc", color); b.innerHTML = `<b>${name}</b><i></i><span>${sub}</span>`; b.classList.add("on"); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove("on"), 2200); }
  function pzToast(m) { toast(m); }

  /* ---------- input ---------- */
  const keys = new Set(); let joy = { x: 0, y: 0, id: null }, target = null;
  function onKey(e) {
    if (S.scene !== "plaza" || !running) return;
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "shift"].includes(k)) e.preventDefault();
    if (!$("pz-photo").hidden) { if (k === "escape" || k === "e") closePhoto(); return; }
    start(); keys.add(k); target = null;
    if (k === " ") jump(P);
    if (k === "shift" || k === "j") dash(P);
    if (k === "e") interact();
    if (k === "q") toggleWheel();
    if (k === "t") throwTreat();
    if ("12345678".includes(k) && k.length === 1) emote(P, ["👋", "❤️", "😂", "GG", "🔥", "👏", "💃", "😎"][+k - 1]);
  }
  screen.addEventListener("keydown", onKey);
  screen.addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
  screen.addEventListener("blur", () => keys.clear());
  function start() { if (!started) { started = true; $("pz-start").hidden = true; } }
  $("pz-start").onclick = () => { start(); screen.focus({ preventScroll: true }); };
  $("pz-jump").onclick = () => { start(); jump(P); screen.focus({ preventScroll: true }); };
  $("pz-dash").onclick = () => { start(); dash(P); screen.focus({ preventScroll: true }); };
  $("pz-interact").onclick = () => { interact(); screen.focus({ preventScroll: true }); };
  $("pz-treat").onclick = () => { start(); throwTreat(); screen.focus({ preventScroll: true }); };
  $("pz-wheel-btn").onclick = () => { start(); toggleWheel(); };
  $("pz-wheel").addEventListener("click", e => { const b = e.target.closest("[data-emote]"); if (b) { emote(P, b.dataset.emote); toggleWheel(false); screen.focus({ preventScroll: true }); } });
  function toggleWheel(on) {
    const w = $("pz-wheel"), show = on ?? w.hidden; w.hidden = !show;
    if (show) { const r = $("pz-wheel-btn").getBoundingClientRect(), sr = screen.getBoundingClientRect(), k = sr.width / NW; w.style.left = `${(r.left + r.width / 2 - sr.left) / k + 100}px`; w.style.top = `${(r.top - sr.top) / k - 90}px`; }
  }
  $("pz-clock").onclick = e => { e.stopPropagation(); tod = tod > .3 && tod < .7 ? .86 : .42; todHold = 120; };
  function toWorld(cx, cy) { const r = cv.getBoundingClientRect(); const vx = (cx - r.left) / r.width * NW, vy = (cy - r.top) / r.height * NH; return { x: (vx - NW / 2) / Z + cam.x, y: (vy - NH / 2) / Z + cam.y }; }
  cv.addEventListener("pointerdown", e => { start(); screen.focus({ preventScroll: true }); toggleWheel(false); if (e.pointerType === "mouse") target = toWorld(e.clientX, e.clientY); });
  if (matchMedia("(pointer: coarse)").matches) screen.classList.add("coarse");
  const joyEl = $("pz-joy"), ring = $("pz-ring"), knob = $("pz-knob");
  // Joystick that can't get stuck: the origin is set before pointer capture (which some browsers refuse),
  // moves/releases are also heard at the window, and lost focus / hidden page / rotation reset it.
  joyEl.addEventListener("pointerdown", e => {
    start(); const r = joyEl.getBoundingClientRect(), k = r.width / joyEl.offsetWidth || 1;
    joy = { x: 0, y: 0, id: e.pointerId, ox: e.clientX, oy: e.clientY, k };
    ring.style.display = "block"; ring.style.left = `${(e.clientX - r.left) / k}px`; ring.style.top = `${(e.clientY - r.top) / k}px`; knob.style.transform = "";
    try { joyEl.setPointerCapture(e.pointerId); } catch { /* window listeners below still track this finger */ }
  });
  const joyMove = e => {
    if (joy.id == null || e.pointerId !== joy.id) return;
    const dx = (e.clientX - joy.ox) / joy.k, dy = (e.clientY - joy.oy) / joy.k, m = Math.hypot(dx, dy), max = 55, k = m > max ? max / m : 1;
    joy.x = dx / max * k; joy.y = dy / max * k;
    if (!Number.isFinite(joy.x) || !Number.isFinite(joy.y) || Math.hypot(joy.x, joy.y) < .15) joy.x = joy.y = 0;
    knob.style.transform = `translate(${(dx * k) || 0}px, ${(dy * k) || 0}px)`;
  };
  const joyReset = () => { joy = { x: 0, y: 0, id: null }; ring.style.display = "none"; };
  const joyEnd = e => { if (joy.id != null && e.pointerId === joy.id) joyReset(); };
  addEventListener("pointermove", joyMove, true); addEventListener("pointerup", joyEnd, true); addEventListener("pointercancel", joyEnd, true);
  addEventListener("blur", joyReset); addEventListener("orientationchange", joyReset); document.addEventListener("visibilitychange", () => { if (document.hidden) joyReset(); });
  $("pz-mini").addEventListener("pointerdown", e => { if (e.target.id === "pz-clock") return; e.stopPropagation(); start(); const r = $("pz-mini").getBoundingClientRect(); target = { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; screen.focus({ preventScroll: true }); });

  /* ---------- actions ---------- */
  function jump(b, dur = .65, h = 42) { if (b.air || b.stun > 0) return; b.air = 1e-4; b.airDur = dur; b.airH = h; }
  function dash(b) { if (b.dcd > 0 || b.stun > 0) return; b.dash = .18; b.dcd = .9; b.dd = b.lastDir ?? { x: b.face, y: 0 }; }
  function emote(b, e) { b.emote = e; b.emoteT = 2.6; if (e === "💃") b.dance = 4; }
  function burst(x, y, z, glyph, n = 12, color, spd = 1) { for (let i = 0; i < n; i++) { const a = Math.PI * 2 * i / n + Math.random() * .4; FX.push({ g: glyph, x, y, z, vx: Math.cos(a) * (110 + Math.random() * 90) * spd, vy: Math.sin(a) * (70 + Math.random() * 60) * spd, vz: 170 + Math.random() * 120, t: 0, life: 1.1, c: color }); } }
  function throwTreat() {
    const id = ECON.useTreat();
    if (!id) return pzToast("No crops to throw yet. Harvest some on the Farm to the south.");
    updateTreats();
    const c = (FARM_CROP?.[id]?.c) || "#ff6fae";
    burst(P.x, P.y, 70, "●", 18, c, 1.2); NPCS.filter(n => Math.hypot(n.x - P.x, n.y - P.y) < 320).forEach(n => setTimeout(() => emote(n, pick(["❤️", "😂", "👏"])), 200 + Math.random() * 400));
    pzToast(`Tossed ${FARM_CROP?.[id]?.n ?? "a treat"} to everyone!`);
  }
  function updateTreats() { $("pz-treats").textContent = ECON.treatCount(); }

  /* interactables */
  const SPOTS = [
    { id: "photo", x: PHOTO.x, y: PHOTO.y + 30, r: 90, label: "Take photo", icon: "camera", act: takePhoto },
    { id: "cafe", x: CAFE.x, y: CAFE.y + 40, r: 110, label: "Volt Boba · 10", icon: "boba", leaf: true, act: buyTea },
    { id: "board", x: BOARD.x, y: BOARD.y + 30, r: 100, label: "Event board", icon: "clipboard", act: () => { qmin[qk()] = false; renderQuests(); pzToast("Plaza quests are on the right"); } },
    { id: "leader", x: LEADER.x, y: LEADER.y + 30, r: 110, label: "Leaderboard", icon: "trophy", act: () => pzToast(`Best times: ${run.board.slice().sort((a, b) => a[1] - b[1]).slice(0, 3).map(([n, t]) => `${n} ${t.toFixed(2)}s`).join(" · ")}`) },
    { id: "gate", x: GATE.x, y: GATE.y - 40, r: 110, label: "Enter the Farm", icon: "wheat", act: () => goFarm() },
  ];
  let near = null;
  function interact() { if (near) near.act(); }
  function buyTea() {
    if (P.buff > 0) return pzToast("Your boba boost is still active");
    if (ECON.leaves < 10) return pzToast("Not enough Gold Leaves");
    ECON.leaves -= 10; updateWallet(); P.buff = 30; burst(P.x, P.y, 60, "⚡", 10, "#ffd84a"); pzToast("Volt Boba: 30% faster for 30 seconds");
  }
  function goFarm() { setSceneMain("farm"); }

  /* photo mode */
  function takePhoto() {
    quest("photo");
    const fl = document.createElement("div"); fl.className = "flash"; $("pz").append(fl); setTimeout(() => fl.remove(), 600);
    const o = document.createElement("canvas"), w = 640, h = 420; o.width = w; o.height = h;
    const g = o.getContext("2d"), z = 1.15;
    g.translate(w / 2, h / 2); g.scale(z, z); g.translate(-P.x, -(P.y - 50));
    drawWorld(g, T, true);
    const people = NPCS.filter(n => Math.abs(n.x - P.x) < 300 && Math.abs(n.y - P.y) < 200).map(n => n.name);
    const t = clockText();
    setTimeout(() => {
      const box = $("pz-photo"); box.hidden = false;
      box.innerHTML = `<div class="polaroid"><img src="${o.toDataURL("image/jpeg", .9)}" alt="Photo taken in the Plaza"><p>${people.length ? `tester with ${people.slice(0, 3).join(", ")}${people.length > 3 ? ` +${people.length - 3}` : ""}` : "tester at the Photo Spot"}</p><small>Elemental Plaza · ${t}</small><div class="acts"><button type="button" data-ph="keep">Save to album</button><button type="button" data-ph="close">Close</button></div></div>`;
      box.querySelectorAll("[data-ph]").forEach(b => b.onclick = () => { if (b.dataset.ph === "keep") feed(null, "Photo saved to your <b>album</b>"); closePhoto(); });
    }, 160);
  }
  function closePhoto() { $("pz-photo").hidden = true; screen.focus({ preventScroll: true }); }

  /* ---------- movement ---------- */
  function collide(b) {
    for (const o of OBST) { const sy = o.sy || 1, dx = b.x - o.x, dy = (b.y - o.y) * sy, d = Math.hypot(dx, dy), m = o.r + R; if (d < m && d > 0) { b.x = o.x + dx / d * m; b.y = o.y + dy / d * m / sy; } }
    if (b.x > LED.x0 - 20 && b.x < LED.x1 + 20 && b.y < STAGE.y0 + 8) b.y = STAGE.y0 + 8;
    b.x = Math.max(30, Math.min(W - 30, b.x)); b.y = Math.max(110, b.y);
    if (b.y > GATE.y && Math.abs(b.x - GATE.x) > 62) b.y = GATE.y;
    if (b.y > GATE.y + 30) b.y = GATE.y + 30;
    if (((b.x - POND.x) / POND.rx) ** 2 + ((b.y - POND.y) / POND.ry) ** 2 < 1) { const a = Math.atan2((b.y - POND.y) / POND.ry, (b.x - POND.x) / POND.rx); b.x = POND.x + Math.cos(a) * POND.rx; b.y = POND.y + Math.sin(a) * POND.ry; }
  }
  function moveBody(b, dir, dt) {
    if (b.stun > 0) { b.stun -= dt; b.sp = 0; return; }
    let vx, vy;
    const spd = SPEED * (b.buff > 0 ? 1.3 : 1);
    if (b.dash > 0) { b.dash -= dt; vx = b.dd.x * 680; vy = b.dd.y * 680; if (Math.random() < .8) b.trail.push({ x: b.x, y: b.y, z: b.z, t: 0 }); }
    else { vx = dir.x * spd; vy = dir.y * spd; }
    if (dir.x || dir.y) b.lastDir = { x: dir.x, y: dir.y };
    if (Math.abs(vx) > 5) b.face = vx > 0 ? 1 : -1;
    const ox = b.x, oy = b.y; b.x += vx * dt; b.y += vy * dt; collide(b);
    b.sp = Math.hypot(b.x - ox, b.y - oy) / dt; b.vx = (b.x - ox) / dt; b.vy = (b.y - oy) / dt;
    if (b.me) b.stuckT = target && b.sp < spd * .5 && b.dash <= 0 ? (b.stuckT || 0) + dt : Math.max(0, (b.stuckT || 0) - dt * .5);
    if (b.air) { b.air += dt; b.z = Math.sin(Math.PI * Math.min(1, b.air / b.airDur)) * b.airH; if (b.air >= b.airDur) { b.air = 0; b.z = 0; FX.push({ dust: 1, x: b.x, y: b.y, t: 0, life: .4 }); } }
    if (b.dcd > 0) b.dcd -= dt; if (b.emoteT > 0) b.emoteT -= dt; if (b.dance > 0) b.dance -= dt; if (b.buff > 0) b.buff -= dt;
    b.trail.forEach(t => t.t += dt); b.trail = b.trail.filter(t => t.t < .3);
    if (!b.air) for (const [x, y] of PADS) if (Math.hypot(b.x - x, (b.y - y) * 1.5) < 40) { jump(b, 1.15, 160); FX.push({ ring: 1, x, y, t: 0, life: .5, c: "#9fd0ff" }); }
    const hd = Math.min(...HSEG.map(([p0, p1]) => segDist(b.x, b.y, p0, p1)));
    if (hd < 12 && b.z < 16 && !b.stumbled) { b.stun = .45; b.stumbled = 1; b.dash = 0; emote(b, "💫"); if (b.me) pzToast("Tripped! Press Space to jump the hurdles."); }
    if (hd > 30) b.stumbled = 0;
  }
  function inputDir() {
    let x = 0, y = 0;
    if (keys.has("a") || keys.has("arrowleft")) x--; if (keys.has("d") || keys.has("arrowright")) x++;
    if (keys.has("w") || keys.has("arrowup")) y--; if (keys.has("s") || keys.has("arrowdown")) y++;
    if (Number.isFinite(joy.x) && Number.isFinite(joy.y)) { x += joy.x; y += joy.y; }
    if (!x && !y && target) { const dx = target.x - P.x, dy = target.y - P.y, d = Math.hypot(dx, dy); if (d < 10) target = null; else { x = dx / d; y = dy / d; if (P.stuckT > .12) { const c = Math.cos(1.2), s = Math.sin(1.2); [x, y] = [x * c - y * s, x * s + y * c]; } } }
    const m = Math.hypot(x, y); return m > 1 ? { x: x / m, y: y / m } : { x, y };
  }
  const toward = (b, x, y) => { const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy); return d < 8 ? { x: 0, y: 0, d } : { x: dx / d, y: dy / d, d }; };

  /* ---------- NPC brains ---------- */
  function brain(n, dt) {
    if (ev.on && ["wander", "dance", "photo", "cafe"].includes(n.ai) && ev.orbs.length) { const o = ev.orbs.reduce((a, b) => Math.hypot(b.x - n.x, b.y - n.y) < Math.hypot(a.x - n.x, a.y - n.y) ? b : a); return toward(n, o.x, o.y); }
    if (n.wait > 0) { n.wait -= dt; return { x: 0, y: 0 }; }
    switch (n.ai) {
      case "wander": {
        if (n.tx == null) { const a = Math.random() * Math.PI * 2, r = .45 + Math.random() * .5; n.tx = SQ.x + Math.cos(a) * SQ.rx * r; n.ty = SQ.y + Math.sin(a) * SQ.ry * r; }
        const d = toward(n, n.tx, n.ty); if (d.d < 10) { n.tx = null; n.wait = 1 + Math.random() * 3; if (Math.random() < .35) emote(n, pick(["👋", "😂", "GG", "🔥", "❤️", "😎"])); if (Math.random() < .2) jump(n); } return d;
      }
      case "runway": {
        const side = n.name === "Hikari" ? -1 : 1, steps = [[1350 + side * 170, 680], [1350, 640], [1350, 590], [1350, 470], [1350, 395], [1350, 470], [1350 + side * 170, 690]];
        const [x, y] = steps[n.step % steps.length], d = toward(n, x, y);
        if (d.d < 10) { const s = n.step % steps.length; if (s === 4) { n.wait = 3.2; emote(n, pick(["✨", "😎", "💃"])); feed(n.key, `<b>${n.name}</b> hit the runway in ${SKIN[n.key]?.[0] ?? "a new skin"}`); } else if (s === 6) n.wait = 6 + Math.random() * 6; n.step++; }
        return d;
      }
      case "track": {
        n.ta += dt * (n.name === "Nova" ? .62 : .52); const p = trackPt(n.ta, n.name === "Nova" ? .3 : .72);
        const q = ell(n.x, n.y); if (onTrack(n.x, n.y) && HURDLES.some(a => { const d = ((a - q.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return d > 0 && d < .17; })) jump(n);
        if (n.ta > -Math.PI / 2 + Math.PI * 2 * (n.laps ?? 1)) { n.laps = (n.laps ?? 1) + 1; if (Math.random() < .5) { const t = (n.name === "Nova" ? 21.8 : 23) + Math.random() * 3; feed(n.key, `<b>${n.name}</b> finished a lap in ${t.toFixed(2)} s`); } }
        return toward(n, p.x, p.y);
      }
      case "dance": {
        const home = n.name === "Kai" ? [1480, 650] : [1220, 650]; const d = toward(n, home[0], home[1]);
        if (d.d < 12) { if (n.dance <= 0 && Math.random() < .02) emote(n, "💃"); return { x: 0, y: 0 }; } return d;
      }
      case "cafe": { const d = toward(n, CAFE.x - 70, CAFE.y + 70); if (d.d < 10) { if (Math.random() < .004) emote(n, "🧋"); return { x: 0, y: 0 }; } return d; }
      case "photo": {
        if (n.tx == null) { n.tx = PHOTO.x + (Math.random() - .5) * 60; n.ty = PHOTO.y + 30 + (Math.random() - .5) * 30; }
        const d = toward(n, n.tx, n.ty); if (d.d < 10) { n.wait = 4; emote(n, "📸"); n.tx = Math.random() < .5 ? null : SQ.x - 120; n.ty = SQ.y - 60; if (n.tx === null) n.tx = null; } return d;
      }
      default: { // ball teams: A attacks right goal, B attacks left
        const goalX = n.ai === "ballA" ? PITCH.x1 + 30 : PITCH.x0 - 30, goalY = (PITCH.gy0 + PITCH.gy1) / 2;
        const gx = goalX - ball.x, gy = goalY - ball.y, gd = Math.hypot(gx, gy) || 1;
        const bx = ball.x - gx / gd * 44, by = ball.y - gy / gd * 44, behind = toward(n, bx, by);
        if (!inPitch(ball, 40)) return toward(n, (PITCH.x0 + PITCH.x1) / 2, (PITCH.y0 + PITCH.y1) / 2);
        if (behind.d > 28) return { ...behind, x: behind.x * .82, y: behind.y * .82 };
        if (Math.random() < .012) dash(n);
        return toward(n, ball.x, ball.y);
      }
    }
  }

  /* ---------- ball ---------- */
  function updateBall(dt) {
    if (ball.lock > 0) { ball.lock -= dt; if (ball.lock <= 0) { ball.x = (PITCH.x0 + PITCH.x1) / 2; ball.y = (PITCH.y0 + PITCH.y1) / 2; ball.vx = ball.vy = 0; ball.z = 0; } return; }
    for (const b of BODIES) {
      if (b.z > 30) continue;
      const dx = ball.x - b.x, dy = ball.y - b.y, d = Math.hypot(dx, dy), m = ball.r + R;
      if (d < m && d > 0) {
        const nx = dx / d, ny = dy / d; ball.x = b.x + nx * m; ball.y = b.y + ny * m;
        const kick = b.dash > 0 ? 860 : Math.max(150, b.sp * 1.35), along = ball.vx * nx + ball.vy * ny;
        if (along < kick) { ball.vx += nx * (kick - along); ball.vy += ny * (kick - along); if (b.dash > 0) { ball.vz = 260; FX.push({ ring: 1, x: ball.x, y: ball.y, t: 0, life: .35, c: "#fff" }); } }
        ball.last = b;
      }
    }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.spin += Math.hypot(ball.vx, ball.vy) * dt / ball.r;
    if (ball.z > 0 || ball.vz > 0) { ball.vz -= 900 * dt; ball.z = Math.max(0, ball.z + ball.vz * dt); if (ball.z === 0) ball.vz = ball.vz < -120 ? -ball.vz * .4 : 0; }
    const f = Math.pow(.42, dt); ball.vx *= f; ball.vy *= f;
    if (ball.y < PITCH.y0 + ball.r) { ball.y = PITCH.y0 + ball.r; ball.vy = Math.abs(ball.vy) * .8; }
    if (ball.y > PITCH.y1 - ball.r) { ball.y = PITCH.y1 - ball.r; ball.vy = -Math.abs(ball.vy) * .8; }
    const mouth = ball.y > PITCH.gy0 + 8 && ball.y < PITCH.gy1 - 8;
    if (ball.x < PITCH.x0 + ball.r && !mouth) { ball.x = PITCH.x0 + ball.r; ball.vx = Math.abs(ball.vx) * .8; }
    if (ball.x > PITCH.x1 - ball.r && !mouth) { ball.x = PITCH.x1 - ball.r; ball.vx = -Math.abs(ball.vx) * .8; }
    if (ball.x < PITCH.x0 - 14 || ball.x > PITCH.x1 + 14) {
      const right = ball.x > PITCH.x1; score[right ? 0 : 1]++; ball.lock = 1.5; ball.vx = ball.vy = 0;
      FX.push({ text: "GOAL!", x: ball.x, y: ball.y - 50, t: 0, life: 1.5 }); burst(ball.x, ball.y, 20, "✦", 22, right ? "#5ab0ff" : "#ff5d6c", 1.3);
      const who = ball.last; if (who?.me) { quest("goal"); pzToast("GOAL! You scored"); } else if (who) feed(who.key, `<b>${who.name}</b> scored a goal on the pitch`);
    }
  }

  /* ---------- track timing ---------- */
  function updateRun() {
    const el = $("pz-timer");
    if (!onTrack(P.x, P.y)) { if (run.state && ell(P.x, P.y).r > 1.5) { run.state = 0; el.hidden = true; } return; }
    const q = ell(P.x, P.y), near = a => Math.abs(((q.a - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < .06;
    if (run.state === 0 && near(CPS[0]) && P.vx > 0) { run.state = 1; run.t0 = performance.now(); run.next = 1; el.hidden = false; pzToast("Go! Run clockwise and jump the 3 hurdles."); }
    else if (run.state === 1) {
      if (run.next < 4 && near(CPS[run.next])) run.next++;
      else if (run.next === 4 && near(CPS[0]) && P.vx > 0) {
        const t = (performance.now() - run.t0) / 1000; run.state = 2; run.last = t; const pb = t < run.best; if (pb) run.best = t;
        const me = run.board.find(r => r[0] === "tester"); if (pb) me[1] = t;
        if (t < 30) quest("lap");
        pzToast(pb ? `New record: ${t.toFixed(2)} s!` : `Finished: ${t.toFixed(2)} s`); burst(P.x, P.y, 50, "★", 16, "#ffd65b");
        feed(null, `You finished in <b>${t.toFixed(2)} s</b>${pb ? " · new record" : ""}`);
        setTimeout(() => { if (run.state === 2) run.state = 0; }, 900);
      }
    }
    if (run.state === 1) el.innerHTML = `${((performance.now() - run.t0) / 1000).toFixed(2)}<small>${run.next}/4 · best ${run.best.toFixed(2)}</small>`;
    else if (run.state === 2) el.innerHTML = `${run.last.toFixed(2)}<small>best ${run.best.toFixed(2)}</small>`;
  }

  /* ---------- runway ---------- */
  function updateRunway(dt) {
    const on = inRunway(P), rc = $("pz-runcard");
    if (on !== runwayOn) {
      runwayOn = on;
      if (on) { const [n, r] = SKIN[P.key] ?? [CH[S.champ].name, "Original"]; rc.innerHTML = `<img src="${P.img.src}" alt=""><div><small>ON THE RUNWAY</small><b>${esc(n)}</b><em>${esc(r)} · ${CH[S.champ].name}</em></div><span class="claps">${I("heart")}<b id="pz-claps">${claps}</b></span>`; rc.className = "pz-runcard glass"; rc.hidden = false; }
      else rc.hidden = true;
    }
    if (!on) return;
    clapT -= dt;
    if (clapT <= 0) {
      clapT = .4 + Math.random() * .45;
      const fans = NPCS.filter(n => Math.hypot(n.x - P.x, n.y - P.y) < 750);
      if (fans.length) { const f = pick(fans); FX.push({ heart: 1, x: f.x, y: f.y, z: 60, tx: P.x, ty: P.y, t: 0, life: .9 }); if (Math.random() < .3) emote(f, "👏"); setTimeout(() => { if (!runwayOn) return; claps++; quest("claps"); const c = $("pz-claps"); if (c) c.textContent = claps; }, 860); }
    }
  }

  /* ---------- orb rain ---------- */
  function updateEvent(dt) {
    const el = $("pz-event");
    if (!ev.on) {
      // real time: the shower runs during the first minute of every quarter hour, read straight from the clock
      ev.next = FASTP ? ev.next - dt : untilQuarter();
      const live = !FASTP && ev.next > 840;
      el.hidden = false; el.className = "pz-event soon";
      el.innerHTML = `<span class="ic">${I("orb")}</span><span>Orb Shower in <b>${ev.next >= 60 ? `${Math.floor(ev.next / 60)}:${String(Math.floor(ev.next % 60)).padStart(2, "0")}` : `${Math.max(0, Math.ceil(ev.next))}s`}</b></span><small>around the fountain</small>`;
      if (FASTP ? ev.next <= 0 : live) { ev.on = true; ev.end = FASTP ? 25 : ev.next - 840; ev.spawn = 0; banner("Orb Shower!", "grab orbs around the fountain", "#c047ff"); }
      return;
    }
    if (FASTP) ev.end -= dt; else { const q = untilQuarter(); ev.end = q > 840 ? q - 840 : 0; } ev.spawn -= dt;
    if (ev.spawn <= 0 && ev.end > 3) { ev.spawn = .35; const a = Math.random() * Math.PI * 2, r = .3 + Math.random() * .75; ev.orbs.push({ x: SQ.x + Math.cos(a) * SQ.rx * r * 1.1, y: SQ.y + Math.sin(a) * SQ.ry * r * 1.1, z: 380, vz: 0, c: pick(["#ffd84a", "#ff7a45", "#4fb3ff", "#7fe7ff", "#c47dff", "#8a6bff"]) }); }
    for (const o of ev.orbs) { if (o.z > 0) { o.vz -= 600 * dt; o.z = Math.max(0, o.z + o.vz * dt); if (o.z === 0) FX.push({ ring: 1, x: o.x, y: o.y, t: 0, life: .4, c: o.c }); } }
    for (let i = ev.orbs.length - 1; i >= 0; i--) { const o = ev.orbs[i]; if (o.z > 40) continue; for (const b of BODIES) if (Math.hypot(b.x - o.x, b.y - o.y) < 34) { ev.orbs.splice(i, 1); burst(o.x, o.y, 20, "✦", 6, o.c, .6); if (b.me) { ECON.leaves += 2; updateWallet(); quest("orbs"); FX.push({ text: "+2", leaf: 1, x: o.x, y: o.y - 40, t: 0, life: .9, small: 1 }); } break; } }
    el.className = "pz-event"; el.innerHTML = `<span class="ic">${I("orb")}</span><span>Orb Shower · <b>${Math.ceil(ev.end)}s</b> left</span><small>+2 ${L} per orb</small>`;
    if (ev.end <= 0) { ev.on = false; ev.orbs = []; ev.next = FASTP ? 70 : untilQuarter(); }
  }

  /* ---------- draw ---------- */
  function clockText() { const m = Math.floor(tod * 24 * 60), h = Math.floor(m / 60), mm = m % 60; return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`; }
  function night() { // 0 day .. 1 night
    const t = tod; if (t > .3 && t < .7) return 0; if (t >= .7 && t < .8) return (t - .7) / .1; if (t >= .2 && t <= .3) return 1 - (t - .2) / .1; return 1;
  }
  function drawLamp(g, l) { GFX.shadow(g, l.x + 6, l.y + 2, 18, 6); GFX.blit(g, GFX.lamp(), l.x, l.y + 4); }
  function drawFountain(g, time) {
    const { x, y } = FOUNT;
    // basin wall (front) + rim + water
    const brx = 126, bry = 80, wallH = 24;
    g.fillStyle = "rgba(30,40,40,.3)"; g.beginPath(); g.ellipse(x + 8, y + wallH + 6, brx + 10, bry + 8, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(x, y, brx, bry, 0, 0, Math.PI); g.lineTo(x - brx, y + wallH); g.ellipse(x, y + wallH, brx, bry, 0, Math.PI, 0, true); g.closePath();
    const wg = g.createLinearGradient(0, y, 0, y + bry + wallH); wg.addColorStop(0, "#efe6d4"); wg.addColorStop(1, "#b4a78e"); g.fillStyle = wg; g.fill(); g.strokeStyle = "#857a64"; g.lineWidth = 2; g.stroke();
    g.strokeStyle = "rgba(133,122,100,.5)"; g.lineWidth = 1.2; for (let k = -5; k <= 5; k++) { const a = Math.PI / 2 + k * .27, px = x + Math.cos(a) * brx, py = y + Math.sin(a) * bry; g.beginPath(); g.moveTo(px, py); g.lineTo(px, py + wallH); g.stroke(); }
    g.fillStyle = "#f7f0e2"; g.beginPath(); g.ellipse(x, y, brx, bry, 0, 0, 7); g.fill(); g.strokeStyle = "#a59a84"; g.lineWidth = 2; g.stroke();
    const water = g.createRadialGradient(x - 30, y - 20, 10, x, y, brx); water.addColorStop(0, "#9ff0ff"); water.addColorStop(.6, "#3fb8d8"); water.addColorStop(1, "#1f86b0");
    g.fillStyle = water; g.beginPath(); g.ellipse(x, y + 2, brx - 15, bry - 11, 0, 0, 7); g.fill();
    g.save(); g.beginPath(); g.ellipse(x, y + 2, brx - 15, bry - 11, 0, 0, 7); g.clip();
    g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1.6; for (let i = 0; i < 9; i++) { const yy = y - 50 + i * 12, ph = time * 1.4 + i; g.beginPath(); for (let xx = x - brx; xx < x + brx; xx += 8) g.lineTo(xx, yy + Math.sin(xx * .05 + ph) * 2.5); g.stroke(); }
    for (let i = 0; i < 3; i++) { const k = (time * .5 + i / 3) % 1; g.strokeStyle = `rgba(255,255,255,${.6 * (1 - k)})`; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y - 2, 30 + k * 80, 18 + k * 50, 0, 0, 7); g.stroke(); }
    g.restore();
    // pillar + middle bowl
    const pil = (yt, yb, w) => { g.fillStyle = GFX.mix("#f2ead8", "#b9ad94", .1); const gg = g.createLinearGradient(x - w, 0, x + w, 0); gg.addColorStop(0, "#fffaf0"); gg.addColorStop(1, "#b9ad94"); g.fillStyle = gg; g.fillRect(x - w, yt, w * 2, yb - yt); g.strokeStyle = "#857a64"; g.lineWidth = 1.5; g.strokeRect(x - w, yt, w * 2, yb - yt); };
    pil(y - 52, y, 13);
    const bowl = (by, rx, ry, d) => {
      g.beginPath(); g.ellipse(x, by, rx, ry, 0, 0, Math.PI); g.lineTo(x - rx * .55, by + d); g.ellipse(x, by + d, rx * .55, ry * .5, 0, Math.PI, 0, true); g.closePath(); const bg2 = g.createLinearGradient(0, by, 0, by + d + ry); bg2.addColorStop(0, "#f2ead8"); bg2.addColorStop(1, "#a99c82"); g.fillStyle = bg2; g.fill(); g.strokeStyle = "#857a64"; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = "#f7f0e2"; g.beginPath(); g.ellipse(x, by, rx, ry, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = water; g.beginPath(); g.ellipse(x, by + 1, rx - 8, ry - 5, 0, 0, 7); g.fill();
    };
    bowl(y - 56, 64, 30, 18);
    // water curtain from middle bowl
    g.strokeStyle = "rgba(220,250,255,.55)"; g.lineWidth = 3; g.setLineDash([10, 8]); g.lineDashOffset = -time * 60;
    for (let i = -6; i <= 6; i++) { const a = Math.PI / 2 + i * .2, px = x + Math.cos(a) * 62, py = y - 56 + Math.sin(a) * 28; g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + Math.cos(a) * 26, py + 10, px + Math.cos(a) * 34, py + 54); g.stroke(); }
    g.setLineDash([]);
    pil(y - 104, y - 56, 9); bowl(y - 108, 34, 16, 10);
    // jet + floating crystal
    g.fillStyle = "rgba(220,250,255,.75)"; g.beginPath(); g.ellipse(x, y - 132 - Math.sin(time * 6) * 3, 5, 22, 0, 0, 7); g.fill();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + time * .5, k = (time * 1.3 + i * .37) % 1, px = x + Math.cos(a) * (8 + k * 26), py = y - 150 + k * k * 46 - Math.sin(k * Math.PI) * 22; g.fillStyle = `rgba(235,252,255,${1 - k * .5})`; g.beginPath(); g.arc(px, py, 2.4 * (1 - k * .4), 0, 7); g.fill(); }
    const cy = y - 196 + Math.sin(time * 1.6) * 6, hue = (time * 40) % 360;
    const cg = g.createRadialGradient(x, cy, 2, x, cy, 46); cg.addColorStop(0, `hsla(${hue},90%,75%,.55)`); cg.addColorStop(1, `hsla(${hue},90%,75%,0)`); g.fillStyle = cg; g.beginPath(); g.arc(x, cy, 46, 0, 7); g.fill();
    g.save(); g.translate(x, cy); g.scale(Math.cos(time * 1.2), 1); g.beginPath(); g.moveTo(0, -24); g.lineTo(13, -4); g.lineTo(0, 22); g.lineTo(-13, -4); g.closePath(); const gem = g.createLinearGradient(-13, -24, 13, 22); gem.addColorStop(0, "#ffffff"); gem.addColorStop(.4, `hsl(${hue},85%,70%)`); gem.addColorStop(1, `hsl(${(hue + 60) % 360},80%,45%)`); g.fillStyle = gem; g.fill(); g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = 1.5; g.stroke(); g.restore();
  }
  function drawLED(g, time) {
    const { x0, x1, y0, y1 } = LED, w = x1 - x0, h = y1 - y0;
    // truss + legs
    g.fillStyle = "#1a1a24"; g.fillRect(x0 - 24, y0 - 34, w + 48, 16); [x0 - 24, x1 + 10].forEach(x => g.fillRect(x, y0 - 34, 14, STAGE.y0 - y0 + 34));
    for (let i = 0; i < 6; i++) { const x = x0 + 30 + i * (w - 60) / 5; g.fillStyle = "#2b2b38"; g.beginPath(); g.arc(x, y0 - 20, 9, 0, 7); g.fill(); g.fillStyle = `rgba(255,240,200,${.5 + .5 * Math.sin(time * 3 + i)})`; g.beginPath(); g.arc(x, y0 - 14, 5, 0, 7); g.fill(); }
    // screen
    g.fillStyle = "#07060f"; g.fillRect(x0 - 6, y0 - 6, w + 12, h + 12);
    const gr = g.createLinearGradient(x0, y0, x1, y1); const hshift = (time * 30) % 360;
    gr.addColorStop(0, `hsl(${(300 + hshift) % 360} 80% 28%)`); gr.addColorStop(1, `hsl(${(220 + hshift) % 360} 80% 22%)`);
    g.fillStyle = gr; g.fillRect(x0, y0, w, h);
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    const star = runwayOn ? P : NPCS.find(n => n.ai === "runway" && inRunway(n));
    if (star && star.img?.complete) {
      g.drawImage(star.img, x0 + 20, y0 + 6, h * .99, h * 1.0);
      g.textAlign = "left"; g.fillStyle = "#ff9bd2"; g.font = "800 16px 'DM Sans', sans-serif"; g.fillText("ON THE RUNWAY", x0 + h + 34, y0 + 40);
      g.fillStyle = "#fff"; g.font = "800 46px 'Barlow Condensed', sans-serif"; g.fillText((star.me ? "tester" : star.name).toUpperCase(), x0 + h + 34, y0 + 86);
      g.fillStyle = "#ffd65b"; g.font = "700 20px 'DM Sans', sans-serif"; g.fillText(SKIN[star.key]?.[0] ?? "", x0 + h + 34, y0 + 118); if (star.me) { const sw = g.measureText(SKIN[star.key]?.[0] ?? "").width, hi = ICON_IMG("heart"); if (hi.complete) g.drawImage(hi, x0 + h + 46 + sw, y0 + 101, 22, 22); g.fillText(String(claps), x0 + h + 72 + sw, y0 + 118); }
    } else {
      g.textAlign = "center"; g.fillStyle = "#fff"; g.font = "800 64px 'Barlow Condensed', sans-serif"; g.fillText("RUNWAY", (x0 + x1) / 2, y0 + 84);
      g.fillStyle = "#ff9bd2"; g.font = "700 18px 'DM Sans', sans-serif"; g.fillText(ev.on ? "ORB SHOWER IN PROGRESS" : "STEP UP TO SHOW OFF YOUR SKIN", (x0 + x1) / 2, y0 + 118);
    }
    g.fillStyle = "rgba(0,0,0,.18)"; for (let y = y0; y < y1; y += 4) g.fillRect(x0, y, w, 1.5);
    g.restore();
    // speakers
    [x0 - 70, x1 + 30].forEach(x => { g.fillStyle = "#15151f"; g.fillRect(x, STAGE.y0 - 120, 40, 120); g.fillStyle = "#2c2c3a"; [STAGE.y0 - 96, STAGE.y0 - 46].forEach(y => { g.beginPath(); g.arc(x + 20, y, 14, 0, 7); g.fill(); }); });
  }
  function drawGoal(g, x, left) {
    const y0 = PITCH.gy0, y1 = PITCH.gy1, d = left ? -46 : 46, hgt = 60;
    g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1; for (let k = 0; k <= 6; k++) { const yy = y0 + (y1 - y0) * k / 6; g.beginPath(); g.moveTo(x, yy - hgt); g.lineTo(x + d, yy - hgt * .6); g.lineTo(x + d, yy); g.stroke(); }
    for (let k = 0; k <= 4; k++) { const hh = hgt * k / 4; g.beginPath(); g.moveTo(x, y0 - hh); g.lineTo(x, y1 - hh); g.stroke(); }
    g.strokeStyle = "#fff"; g.lineWidth = 5; g.beginPath(); g.moveTo(x, y1); g.lineTo(x, y1 - hgt); g.lineTo(x, y0 - hgt); g.lineTo(x, y0); g.stroke();
    g.strokeStyle = left ? "#5ab0ff" : "#ff5d6c"; g.lineWidth = 6; g.beginPath(); g.moveTo(x, y0 - hgt); g.lineTo(x, y1 - hgt); g.stroke();
  }
  function drawFlood(g, f, n) { g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(f.x + 10, f.y + 2, 16, 6, 0, 0, 7); g.fill(); g.fillStyle = "#3a3f52"; g.fillRect(f.x - 4, f.y - 230, 8, 232); g.fillStyle = "#222634"; g.fillRect(f.x - 26, f.y - 252, 52, 26); g.fillStyle = n > .3 ? "#fff8d8" : "#c9cfdc"; for (let i = 0; i < 3; i++) g.fillRect(f.x - 22 + i * 16, f.y - 248, 12, 18); }
  function drawScoreboard(g) {
    const x = (PITCH.x0 + PITCH.x1) / 2, y = PITCH.y0 - 50;
    g.fillStyle = "#1a1a24"; g.fillRect(x - 6, y - 10, 12, 50); g.fillStyle = "#0b0b14"; g.fillRect(x - 120, y - 92, 240, 84);
    g.fillStyle = "#162040"; g.fillRect(x - 114, y - 86, 228, 72);
    g.textAlign = "center"; g.font = "700 14px 'DM Sans', sans-serif"; g.fillStyle = "#9fb0d8"; g.fillText("ORB BALL", x, y - 66);
    g.font = "800 44px 'Barlow Condensed', sans-serif"; g.fillStyle = "#5ab0ff"; g.fillText(score[0], x - 50, y - 24); g.fillStyle = "#fff"; g.fillText(":", x, y - 26); g.fillStyle = "#ff5d6c"; g.fillText(score[1], x + 50, y - 24);
  }
  function drawGantry(g) {
    const x = TRACK.cx, ya = TRACK.cy - TRACK.ro[1] - 4, yb = TRACK.cy - TRACK.ri[1] + 4;
    g.fillStyle = "#2a2f42"; g.fillRect(x - 6, ya - 150, 12, 152); g.fillRect(x - 6, yb - 150, 12, 152);
    g.fillStyle = "#11131d"; g.beginPath(); g.moveTo(x - 10, ya - 170); g.lineTo(x + 10, ya - 170); g.lineTo(x + 10, yb - 140); g.lineTo(x - 10, yb - 140); g.fill();
    g.save(); g.translate(x, (ya + yb) / 2 - 160); g.fillStyle = "#0b0d16"; g.fillRect(-96, -26, 192, 52); g.fillStyle = "#1c2448"; g.fillRect(-90, -20, 180, 40);
    g.textAlign = "center"; g.fillStyle = "#ffd65b"; g.font = "800 26px 'Barlow Condensed', sans-serif"; g.fillText(run.state === 1 ? ((performance.now() - run.t0) / 1000).toFixed(2) : `BEST ${run.best.toFixed(2)}`, 0, 9); g.restore();
  }
  function drawHurdle(g, [p0, p1]) {
    g.strokeStyle = "rgba(0,0,0,.3)"; g.lineWidth = 8; g.beginPath(); g.moveTo(p0.x, p0.y + 4); g.lineTo(p1.x, p1.y + 4); g.stroke();
    g.fillStyle = "#e6e6ee"; [p0, p1].forEach(p => g.fillRect(p.x - 3, p.y - 24, 6, 26));
    g.lineCap = "butt"; g.strokeStyle = "#fff"; g.lineWidth = 9; g.beginPath(); g.moveTo(p0.x, p0.y - 22); g.lineTo(p1.x, p1.y - 22); g.stroke();
    g.strokeStyle = "#ef4f61"; g.setLineDash([14, 14]); g.beginPath(); g.moveTo(p0.x, p0.y - 22); g.lineTo(p1.x, p1.y - 22); g.stroke(); g.setLineDash([]);
  }
  function drawLeader(g) {
    const { x, y } = LEADER; g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(x + 10, y + 3, 90, 14, 0, 0, 7); g.fill();
    g.fillStyle = "#2a2f42"; g.fillRect(x - 70, y - 150, 8, 152); g.fillRect(x + 62, y - 150, 8, 152);
    g.fillStyle = "#0b0d16"; g.fillRect(x - 90, y - 250, 180, 150); g.fillStyle = "#151b36"; g.fillRect(x - 84, y - 244, 168, 138);
    g.textAlign = "left"; g.font = "800 20px 'Barlow Condensed', sans-serif"; g.fillStyle = "#ffd65b"; { const tr = ICON_IMG("trophy"); if (tr.complete) g.drawImage(tr, x - 76, y - 238, 22, 22); } g.fillText("TOP DASH", x - 50, y - 220);
    run.board.slice().sort((a, b) => a[1] - b[1]).slice(0, 5).forEach(([n, t], i) => { g.font = "700 14px 'DM Sans', sans-serif"; g.fillStyle = n === "tester" ? "#ffd65b" : "#e6ecff"; g.fillText(`${i + 1}. ${n}`, x - 74, y - 196 + i * 20); g.textAlign = "right"; g.fillText(t.toFixed(2), x + 74, y - 196 + i * 20); g.textAlign = "left"; });
  }
  function drawPhoto(g, time) {
    const { x, y } = PHOTO;
    GFX.blit(g, GFX.bush("flower", 31, 70), x - 104, y + 6); GFX.blit(g, GFX.bush("rose", 32, 70), x + 104, y + 6);
    const post = (px) => { const gg = g.createLinearGradient(px - 6, 0, px + 6, 0); gg.addColorStop(0, "#fffaf0"); gg.addColorStop(1, "#c9bfae"); g.fillStyle = gg; g.beginPath(); g.roundRect(px - 6, y - 150, 12, 152, 4); g.fill(); };
    post(x - 80); post(x + 80);
    g.strokeStyle = "#3f8f3a"; g.lineWidth = 20; g.beginPath(); g.arc(x, y - 150, 80, Math.PI, 0); g.stroke(); g.strokeStyle = "#5fbf4f"; g.lineWidth = 14; g.stroke();
    for (let i = 0; i < 15; i++) { const a = Math.PI + i / 14 * Math.PI, px = x + Math.cos(a) * 80, py = y - 150 + Math.sin(a) * 80, c = ["#ff8fb8", "#ffffff", "#ffd65b"][i % 3]; for (let k = 0; k < 5; k++) { g.fillStyle = c; g.beginPath(); g.arc(px + Math.cos(k * 1.256) * 4, py + Math.sin(k * 1.256) * 4, 3.6, 0, 7); g.fill(); } g.fillStyle = "#ffcf3a"; g.beginPath(); g.arc(px, py, 2.4, 0, 7); g.fill(); }
    g.textAlign = "center"; g.font = "800 22px 'Barlow Condensed', sans-serif"; g.fillStyle = "#fff"; g.strokeStyle = "#2a1f4c"; g.lineWidth = 4; g.strokeText("PHOTO SPOT", x, y - 246); g.fillText("PHOTO SPOT", x, y - 246);
    // camera on a tripod
    const cx = x + 72, cy = y - 6; g.strokeStyle = "#2c3348"; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy - 46); g.lineTo(cx - 12, cy); g.moveTo(cx, cy - 46); g.lineTo(cx + 12, cy); g.moveTo(cx, cy - 46); g.lineTo(cx, cy + 2); g.stroke();
    g.fillStyle = "#2c3348"; g.beginPath(); g.roundRect(cx - 16, cy - 66, 32, 22, 5); g.fill(); g.fillStyle = "#8fd0ff"; g.beginPath(); g.arc(cx - 3, cy - 55, 7, 0, 7); g.fill(); g.fillStyle = "#ef4f61"; g.beginPath(); g.arc(cx + 10, cy - 62, 2.5, 0, 7); g.fill();
  }
  function drawCafe(g) { GFX.blit(g, GFX.foodTruck(), CAFE.x, CAFE.y + 4); GFX.blit(g, GFX.bench(), CAFE.x - 170, CAFE.y + 70); }
  function drawBoard(g) { GFX.shadow(g, BOARD.x + 8, BOARD.y + 2, 70, 14); GFX.blit(g, GFX.board(), BOARD.x, BOARD.y + 4); g.textAlign = "center"; g.font = "800 18px 'Barlow Condensed', sans-serif"; g.fillStyle = "#fff"; g.strokeStyle = "#2a1f12"; g.lineWidth = 4; g.strokeText("EVENT BOARD", BOARD.x, BOARD.y - 150); g.fillText("EVENT BOARD", BOARD.x, BOARD.y - 150); }
  function drawGate(g) {
    const { x, y } = GATE;
    [x - 70, x + 70].forEach(px => { const gg = g.createLinearGradient(px - 9, 0, px + 9, 0); gg.addColorStop(0, "#c48a4a"); gg.addColorStop(1, "#7a5230"); g.fillStyle = gg; g.beginPath(); g.roundRect(px - 9, y - 116, 18, 120, 4); g.fill(); });
    g.strokeStyle = "#3f8f3a"; g.lineWidth = 22; g.beginPath(); g.arc(x, y - 112, 70, Math.PI, 0); g.stroke(); g.strokeStyle = "#6fcf5a"; g.lineWidth = 15; g.stroke();
    for (let i = 0; i < 12; i++) { const a = Math.PI + i / 11 * Math.PI; GFX.ball(g, x + Math.cos(a) * 70, y - 112 + Math.sin(a) * 70, 6, ["#ff8fb8", "#ffd65b", "#ffffff"][i % 3]); }
    g.fillStyle = "#7a5230"; g.beginPath(); g.roundRect(x - 64, y - 206, 128, 36, 8); g.fill(); g.fillStyle = "#fff4d6"; g.font = "800 22px 'Barlow Condensed', sans-serif"; g.textAlign = "center"; g.fillText("THE FARM", x, y - 181);
    GFX.blit(g, GFX.mailbox(), x + 120, y + 2); GFX.blit(g, GFX.hay(), x - 140, y + 4);
  }
  function drawHouse(g, h, n) {
    GFX.shadow(g, h.x + 30, h.y + 4, 110, 22);
    GFX.blit(g, h.spr, h.x, h.y);
    if (n > .05 && h.spr.win) h.spr.win.forEach(([wx, wy, ww, wh]) => { g.fillStyle = `rgba(255,214,120,${.85 * n})`; g.beginPath(); g.roundRect(h.x + wx, h.y + wy, ww, wh, 3); g.fill(); });
  }
  function drawBody(g, b, time, photo) {
    const s = 84, im = b.img;
    const sh = 1 - Math.min(.6, b.z / 220); g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.ellipse(b.x, b.y, 24 * sh, 9 * sh, 0, 0, 7); g.fill();
    if (b.me && !photo) { g.strokeStyle = b.buff > 0 ? "#ffd84a" : "#ffd65b"; g.lineWidth = 2.5; g.beginPath(); g.ellipse(b.x, b.y, 29, 11, 0, 0, 7); g.stroke(); if (b.buff > 0) { g.strokeStyle = `rgba(255,216,74,${.4 + .3 * Math.sin(time * 10)})`; g.beginPath(); g.ellipse(b.x, b.y, 36, 14, 0, 0, 7); g.stroke(); } }
    if (!im || !im.complete) return;
    for (const tr of b.trail) { g.globalAlpha = .32 * (1 - tr.t / .3); drawSprite(g, im, tr.x, tr.y - tr.z, s, b.face, 0, 0); } g.globalAlpha = 1;
    let bob = b.sp > 10 && !b.air ? Math.abs(Math.sin(time * 12 + b.x * .01)) * 4 : Math.sin(time * 2.4 + b.x) * 1.2, rot = 0, sq = 0;
    if (b.dance > 0) { bob = Math.abs(Math.sin(time * 9)) * 10; rot = Math.sin(time * 9) * .14; sq = Math.sin(time * 18) * .06; }
    if (b.stun > 0) rot = Math.sin(time * 30) * .12;
    drawSprite(g, im, b.x, b.y - b.z - bob, s, b.face, rot, sq);
    g.font = "700 13px 'DM Sans', sans-serif"; g.textAlign = "center"; g.lineWidth = 3.5; g.strokeStyle = "rgba(11,16,32,.85)"; g.fillStyle = b.me ? "#ffd65b" : "#fff";
    const ny = b.y - b.z - s * .92 - 6; g.strokeText(b.name, b.x, ny); g.fillText(b.name, b.x, ny);
    if (b.emoteT > 0) { const a = Math.max(0, Math.min(1, b.emoteT / .3, (2.6 - b.emoteT) / .15)); g.globalAlpha = a; const by = ny - 26; g.fillStyle = "#fff"; g.beginPath(); g.roundRect(b.x - 23, by - 19, 46, 32, 11); g.fill(); g.beginPath(); g.moveTo(b.x - 5, by + 13); g.lineTo(b.x + 5, by + 13); g.lineTo(b.x, by + 19); g.fill(); g.fillStyle = "#111"; g.font = b.emote.length > 2 ? "800 17px 'Barlow Condensed', sans-serif" : "19px sans-serif"; g.fillText(b.emote, b.x, by + 4); g.globalAlpha = 1; }
  }
  function drawSprite(g, im, x, y, s, face, rot, sq) { g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.scale((face < 0 ? -1 : 1) * (1 + sq), 1 - sq); g.drawImage(im, -s / 2, -s * .9, s, s * 1.01); g.restore(); }
  function drawBall(g) {
    if (ball.lock > 0 && ball.lock < 1.3) return;
    g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(ball.x, ball.y + ball.r * .6, ball.r * (1 - ball.z / 400), ball.r * .32, 0, 0, 7); g.fill();
    const y = ball.y - 4 - ball.z, gr = g.createRadialGradient(ball.x - 7, y - 9, 3, ball.x, y, ball.r); gr.addColorStop(0, "#fff"); gr.addColorStop(.5, "#dccfff"); gr.addColorStop(1, "#7a55ff");
    g.fillStyle = gr; g.beginPath(); g.arc(ball.x, y, ball.r, 0, 7); g.fill();
    g.strokeStyle = "#4a2fc0"; g.lineWidth = 3; g.beginPath(); g.arc(ball.x, y, ball.r * .68, ball.spin, ball.spin + 2.2); g.stroke(); g.beginPath(); g.arc(ball.x, y, ball.r * .68, ball.spin + 3.1, ball.spin + 5.3); g.stroke();
  }
  function drawPond(g, time) {
    const { x, y, rx, ry } = POND;
    const wg = g.createRadialGradient(x - 40, y - 30, 10, x, y, rx); wg.addColorStop(0, "#7fe0f0"); wg.addColorStop(.7, "#2fa6cc"); wg.addColorStop(1, "#1a7aa6");
    g.fillStyle = wg; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill();
    g.save(); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.clip();
    FISH.forEach(f => { if (!f.jump) GFX.fish(g, time, f.x, f.y, f.ang); });
    g.strokeStyle = "rgba(255,255,255,.28)"; g.lineWidth = 1.5; for (let i = 0; i < 8; i++) { const yy = y - ry + 20 + i * 26, ph = time * .9 + i * 1.7; g.beginPath(); for (let xx = x - rx; xx < x + rx; xx += 10) g.lineTo(xx, yy + Math.sin(xx * .04 + ph) * 3); g.stroke(); }
    [[x - 120, y - 30, 22], [x + 100, y + 40, 18], [x + 30, y - 60, 16], [x - 60, y + 55, 20]].forEach(([px, py, r], i) => { const b = Math.sin(time * 1.2 + i) * 1.5; g.fillStyle = "#3f9a46"; g.beginPath(); g.ellipse(px, py + b, r, r * .6, 0, .35, Math.PI * 2 - .35); g.lineTo(px, py + b); g.fill(); g.fillStyle = "#6fcf5a"; g.beginPath(); g.ellipse(px - 2, py - 2 + b, r * .7, r * .4, 0, .4, Math.PI * 2 - .4); g.lineTo(px - 2, py - 2 + b); g.fill(); if (i % 2 === 0) { for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? "#ffd0e4" : "#ff8fbd"; g.beginPath(); g.ellipse(px + 4 + Math.cos(k) * 4, py - 6 + b + Math.sin(k) * 2, 4, 2.5, k, 0, 7); g.fill(); } } });
    g.restore();
    FISH.forEach(f => { if (f.jump) { GFX.fish(g, time, f.x, f.y, f.ang, f.c, Math.sin(f.jump * Math.PI) * 50); if (f.jump > .9) { g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 2; g.beginPath(); g.ellipse(f.x, f.y, 16, 6, 0, 0, 7); g.stroke(); } } });
    DUCKS.forEach(d => GFX.duck(g, d.k, d.dab > 0 ? "dabble" : "swim", time + d.a, d.x, d.y, 1.25, d.face, true));
  }
  function updateAnimals(dt) {
    DUCKS.forEach(d => { d.a += d.s * dt * (d.dab > 0 ? .2 : 1); const nx = POND.x + Math.cos(d.a) * POND.rx * d.r * 1.2, ny = POND.y + Math.sin(d.a) * POND.ry * d.r * 1.1; d.face = nx > d.x ? 1 : -1; d.x = nx; d.y = ny; if (d.dab > 0) d.dab -= dt; else if (Math.random() < dt * .07) d.dab = 2; });
    FISH.forEach(f => { if (f.jump) { f.jump += dt * 1.4; if (f.jump >= 1) f.jump = 0; return; } f.a += f.s * dt; const nx = POND.x + Math.cos(f.a) * POND.rx * .55, ny = POND.y + Math.sin(f.a * 1.3) * POND.ry * .5; f.ang = Math.atan2(ny - f.y, nx - f.x); f.x = nx; f.y = ny; if (Math.random() < dt * .03) f.jump = .01; });
    HENS.forEach(h => {
      if (h.wait > 0) { h.wait -= dt; if (h.wait <= 0) h.st = "idle"; return; }
      if (h.tx == null) { if (Math.random() < .4) { h.st = "peck"; h.wait = 1.5 + Math.random() * 2; return; } h.tx = GATE.x - 300 + Math.random() * 600; h.ty = GATE.y - 170 + Math.random() * 130; if (Math.abs(h.tx - GATE.x) < 90) h.tx += 200; }
      const dx = h.tx - h.x, dy = h.ty - h.y, d = Math.hypot(dx, dy); if (d < 5) { h.tx = null; h.st = "idle"; h.wait = .6 + Math.random() * 1.5; return; }
      h.st = "walk"; h.face = dx > 0 ? 1 : -1; h.x += dx / d * 50 * dt; h.y += dy / d * 50 * dt;
    });
    PIGEONS.forEach(b => {
      const threat = [P, ...NPCS].some(n => Math.hypot(n.x - b.x, n.y - b.y) < (n.dash > 0 || n.sp > 200 ? 110 : 55)) || Math.hypot(PET.x - b.x, PET.y - b.y) < 70;
      if (b.fly > 0) { b.fly -= dt; const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy) || 1; b.x += dx / d * Math.min(d, 260 * dt); b.y += dy / d * Math.min(d, 260 * dt); b.face = dx > 0 ? 1 : -1; b.z = b.fly > .6 ? Math.min(90, b.z + 200 * dt) : Math.max(0, b.z - 160 * dt); if (b.fly <= 0) { b.z = 0; b.st = "idle"; b.wait = 1; } return; }
      if (threat) { const a = Math.random() * Math.PI * 2, r = .3 + Math.random() * .6; b.tx = SQ.x + Math.cos(a) * SQ.rx * r; b.ty = SQ.y + Math.sin(a) * SQ.ry * r; b.fly = 2.2; return; }
      if (b.wait > 0) { b.wait -= dt; return; }
      if (b.tx == null || b.st !== "walk") { const r = Math.random(); if (r < .35) { b.st = "peck"; b.wait = 1 + Math.random() * 1.5; b.tx = null; return; } if (r < .5) { b.st = "idle"; b.wait = 1 + Math.random() * 2; b.tx = null; return; } b.tx = b.x + (Math.random() - .5) * 120; b.ty = b.y + (Math.random() - .5) * 70; if (!inSquare(b.tx, b.ty, .95) || ((b.tx - FOUNT.x) / 140) ** 2 + ((b.ty - FOUNT.y) / 100) ** 2 < 1) { b.tx = null; return; } b.st = "walk"; }
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy); if (d < 3) { b.tx = null; b.st = "idle"; b.wait = .3 + Math.random(); return; } b.face = dx > 0 ? 1 : -1; b.x += dx / d * 34 * dt; b.y += dy / d * 34 * dt;
    });
    BUTTER.forEach(b => { b.ph += dt; b.x = b.hx + Math.sin(b.ph * .7) * 50 + Math.sin(b.ph * 1.9) * 14; b.y = b.hy + Math.cos(b.ph * .9) * 24 - 10 + Math.sin(b.ph * 3) * 6; });
    if (!flock && Math.random() < dt * .04) { const y = 200 + Math.random() * 900; flock = { birds: Array.from({ length: 6 }, (_, i) => ({ x: -60 - (i % 3) * 40 - i * 12, y: y + ((i * 37) % 60) - 30, o: i * .7 })) }; }
    if (flock) { flock.birds.forEach(b => { b.x += 240 * dt; b.y += Math.sin(T * 2 + b.o) * .3; }); if (flock.birds.every(b => b.x > W + 100)) flock = null; }
    CAT.awake = Math.hypot(P.x - CAT.b.x, P.y - CAT.b.y) < 120 ? 1 : Math.max(0, CAT.awake - dt * .5);
    // Lena's corgi follows on a leash, chases pigeons now and then
    const lena = NPCS.find(n => n.name === "Lena");
    if (lena) {
      const tx = lena.x - lena.face * 46, ty = lena.y + 10, dx = tx - PET.x, dy = ty - PET.y, d = Math.hypot(dx, dy);
      if (d > 8) { const sp = d > 90 ? 260 : 120; PET.x += dx / d * Math.min(d, sp * dt); PET.y += dy / d * Math.min(d, sp * dt); PET.face = dx > 0 ? 1 : -1; PET.st = sp > 200 ? "run" : "walk"; }
      else { if (PET.bark > 0) { PET.bark -= dt; PET.st = "bark"; } else PET.st = lena.wait > 1.5 ? "sit" : "idle"; if (Math.random() < dt * .05) PET.bark = .8; }
    }
    if (Math.random() < dt * 6) HOUSES.forEach(h => { if (h.spr.chimney && Math.random() < .25) SMOKE.push({ x: h.x + h.spr.chimney[0], y: h.y + h.spr.chimney[1], t: 0, life: 2.4, vx: 8 + Math.random() * 6 }); });
    SMOKE.forEach(m => { m.t += dt; m.x += m.vx * dt; m.y -= 22 * dt; }); for (let i = SMOKE.length - 1; i >= 0; i--) if (SMOKE[i].t > SMOKE[i].life) SMOKE.splice(i, 1);
  }
  function drawSpotlights(g, time) {
    const stars = [...(runwayOn ? [P] : []), ...NPCS.filter(n => inRunway(n))];
    const heads = [LED.x0 + 40, (LED.x0 + LED.x1) / 2, LED.x1 - 40], hy = LED.y0 - 14;
    const targets = stars.length ? stars.map(b => ({ x: b.x, y: b.y, z: b.z || 0, on: 1 })) : [0, 1].map(k => ({ x: (STAGE.x0 + STAGE.x1) / 2 + Math.sin(time * .7 + k * 2.4) * 150, y: STAGE.y0 + 50 + Math.cos(time * .9 + k) * 22, z: 0, on: .55 }));
    g.save(); g.globalCompositeOperation = "lighter";
    targets.forEach((t, k) => {
      const hx = heads[stars.length ? (k === 0 ? 1 : k % 2 ? 0 : 2) : (k ? 2 : 0)], w = 58;
      const gr = g.createLinearGradient(hx, hy, t.x, t.y); gr.addColorStop(0, `rgba(255,246,210,${.28 * t.on})`); gr.addColorStop(1, `rgba(255,246,210,${.06 * t.on})`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(hx - 8, hy); g.lineTo(hx + 8, hy); g.lineTo(t.x + w, t.y); g.ellipse(t.x, t.y, w, w * .38, 0, 0, Math.PI); g.lineTo(t.x - w, t.y); g.closePath(); g.fill();
      const pool = g.createRadialGradient(t.x, t.y, 4, t.x, t.y, w * 1.2); pool.addColorStop(0, `rgba(255,248,215,${.32 * t.on})`); pool.addColorStop(1, "rgba(255,248,215,0)"); g.fillStyle = pool; g.beginPath(); g.ellipse(t.x, t.y, w * 1.2, w * .5, 0, 0, 7); g.fill();
      for (let i = 0; i < 6; i++) { const f = (time * .3 + i / 6 + k * .13) % 1, px = hx + (t.x - hx) * f + Math.sin(time * 2 + i * 3) * 12 * f, py = hy + (t.y - hy) * f; g.fillStyle = `rgba(255,255,240,${.5 * t.on * (1 - Math.abs(f - .5) * 2)})`; g.beginPath(); g.arc(px, py, 1.6, 0, 7); g.fill(); }
      g.fillStyle = `rgba(255,250,225,${.9 * t.on})`; g.beginPath(); g.arc(hx, hy + 2, 7, 0, 7); g.fill();
    });
    g.restore();
  }
  function drawWorld(g, time, photo = false) {
    g.drawImage(bg, 0, 0);
    // pad glow, runway spotlight
    PADS.forEach(([x, y]) => { g.fillStyle = `rgba(159,208,255,${.18 + Math.sin(time * 3 + x) * .1})`; g.beginPath(); g.ellipse(x, y, 46, 29, 0, 0, 7); g.fill(); });
    
    HSEG.forEach(s => drawHurdle(g, s));
    drawSpotlights(g, time);
    drawPond(g, time);
    FX.filter(f => f.ring || f.dust).forEach(f => { const k = f.t / f.life; g.strokeStyle = f.dust ? `rgba(255,255,255,${.5 * (1 - k)})` : f.c ? f.c + Math.round((1 - k) * 255).toString(16).padStart(2, "0") : `rgba(255,255,255,${1 - k})`; g.lineWidth = 3; g.beginPath(); g.ellipse(f.x, f.y, (f.dust ? 14 : 22) + k * (f.dust ? 20 : 60), (f.dust ? 6 : 14) + k * (f.dust ? 8 : 38), 0, 0, 7); g.stroke(); });
    // orbs shadows
    ev.orbs.forEach(o => { g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(o.x, o.y, 12 * (1 - o.z / 500), 5, 0, 0, 7); g.fill(); });
    const items = [
      ...TREES.map(o => ({ y: o.y, d: () => GFX.drawTree(g, o.t, o.x, o.y, time, o.ph) })),
      ...BUSHES.map(o => ({ y: o.y, d: () => { GFX.shadow(g, o.x + 6, o.y + 2, 36, 9); GFX.blit(g, o.spr, o.x, o.y + 4); } })),
      ...ROCKS.map(o => ({ y: o.y, d: () => { GFX.shadow(g, o.x + 4, o.y + 2, 24, 6); GFX.blit(g, o.spr, o.x, o.y + 4); } })),
      ...LAMPS.map(o => ({ y: o.y, d: () => drawLamp(g, o) })),
      ...BEDS.map(o => ({ y: o.y, d: () => { GFX.shadow(g, o.x + 6, o.y + 4, 70, 12); GFX.blit(g, o.spr, o.x, o.y + 6); } })),
      ...BENCHES.map(o => ({ y: o.y, d: () => { GFX.shadow(g, o.x + 4, o.y + 2, 46, 8); GFX.blit(g, GFX.bench(), o.x, o.y + 4); if (o === CAT.b) GFX.cat(g, CAT.awake > 0 ? "awake" : "sleep", time, o.x - 14, o.y - 18, 1.15, 1); } })),
      ...HOUSES.map(h => ({ y: h.y, d: () => drawHouse(g, h, night()) })),
      ...HENS.map(h => ({ y: h.y, d: () => GFX.chicken(g, h.k, h.st, time + h.t0, h.x, h.y, 1.15, h.face) })),
      ...PIGEONS.map(b => ({ y: b.y, d: () => { if (b.z > 2) { GFX.shadow(g, b.x, b.y, 10, 3, .2); GFX.bird(g, b.kind, "fly", time + b.x, b.x, b.y - b.z, 1.05, b.face); } else GFX.bird(g, b.kind, b.st, time + b.x * .01, b.x, b.y, 1.05, b.face); } })),
      { y: PET.y, d: () => { const lena = NPCS.find(n => n.name === "Lena"); GFX.dog(g, PET.breed, PET.st, time, PET.x, PET.y, .8, PET.face, { collar: "#4fb3ff", pant: PET.st === "idle" }); if (lena) { g.strokeStyle = "rgba(60,40,80,.7)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(PET.x + PET.face * 12, PET.y - 30); g.quadraticCurveTo((PET.x + lena.x) / 2, (PET.y + lena.y) / 2 - 6, lena.x + 10 * lena.face, lena.y - 34); g.stroke(); } } },
      ...FLOOD.map(o => ({ y: o.y, d: () => drawFlood(g, o, night()) })),
      { y: FOUNT.y, d: () => drawFountain(g, time) },
      { y: LED.y1, d: () => drawLED(g, time) },
      { y: PITCH.y0 - 40, d: () => drawScoreboard(g) },
      { y: (PITCH.gy0 + PITCH.gy1) / 2, d: () => { drawGoal(g, PITCH.x0, true); drawGoal(g, PITCH.x1, false); } },
      { y: TRACK.cy - TRACK.ri[1], d: () => drawGantry(g) },
      { y: LEADER.y, d: () => drawLeader(g) }, { y: PHOTO.y, d: () => drawPhoto(g, time) }, { y: CAFE.y, d: () => drawCafe(g) }, { y: BOARD.y, d: () => drawBoard(g) }, { y: GATE.y, d: () => drawGate(g) },
      { y: ball.y, d: () => drawBall(g) },
      ...ev.orbs.map(o => ({ y: o.y, d: () => { const y = o.y - 22 - o.z + Math.sin(time * 5 + o.x) * 3, gr = g.createRadialGradient(o.x, y, 2, o.x, y, 28); gr.addColorStop(0, "#fff"); gr.addColorStop(.3, o.c); gr.addColorStop(1, o.c + "00"); g.fillStyle = gr; g.beginPath(); g.arc(o.x, y, 28, 0, 7); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(o.x, y, 7, 0, 7); g.fill(); if (o.z > 0) { g.strokeStyle = o.c + "88"; g.lineWidth = 4; g.beginPath(); g.moveTo(o.x, y - 10); g.lineTo(o.x, y - 60); g.stroke(); } } })),
      ...BODIES.map(b => ({ y: b.y, d: () => drawBody(g, b, time, photo) })),
    ];
    items.sort((a, b) => a.y - b.y).forEach(i => i.d());
    BUTTER.forEach(b => GFX.butterfly(g, time + b.ph, b.x, b.y, b.c, 1.3));
    SMOKE.forEach(m => { g.fillStyle = `rgba(240,240,245,${.45 * (1 - m.t / m.life)})`; g.beginPath(); g.arc(m.x, m.y, 6 + m.t * 8, 0, 7); g.fill(); });
    if (flock) flock.birds.forEach(b => { GFX.shadow(g, b.x, b.y + 160, 8, 2.5, .15); GFX.bird(g, "sparrow", "fly", time + b.o, b.x, b.y, .9, 1); });
    for (const f of FX) {
      const k = f.t / f.life;
      if (f.text) { g.font = f.small ? "800 24px 'Barlow Condensed', sans-serif" : "800 72px 'Barlow Condensed', sans-serif"; g.textAlign = "center"; g.globalAlpha = 1 - Math.max(0, k - .6) / .4; g.lineWidth = f.small ? 4 : 7; g.strokeStyle = "#0b1020"; g.strokeStyle = "#0b1020"; g.fillStyle = "#ffd65b"; if (f.leaf) textWithIcon(g, f.text, "leaf", f.x, f.y - k * 50 - 8, 24, true); else { g.strokeText(f.text, f.x, f.y - k * 50); g.fillText(f.text, f.x, f.y - k * 50); } g.globalAlpha = 1; }
      else if (f.heart) { const x = f.x + (f.tx - f.x) * k, y = f.y + (f.ty - f.y) * k - Math.sin(k * Math.PI) * 120 - 60; g.globalAlpha = 1 - k * .5; g.fillStyle = "#ff6fae"; { const hi = ICON_IMG("heart"); if (hi.complete) g.drawImage(hi, x - 13, y - 24, 26, 26); } g.globalAlpha = 1; }
      else if (f.g) { g.globalAlpha = 1 - k; g.fillStyle = f.c || "#fff"; g.font = "800 20px sans-serif"; g.textAlign = "center"; g.fillText(f.g, f.x, f.y - f.z); g.globalAlpha = 1; }
    }
    // day / night grading and lights
    const n = night();
    if (n > 0) {
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "multiply"; g.fillStyle = `rgba(${Math.round(255 - 170 * n)},${Math.round(255 - 150 * n)},${Math.round(255 - 70 * n)},1)`; g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.restore();
      g.save(); g.globalCompositeOperation = "lighter";
      const glow = (x, y, r, c, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
      LAMPS.forEach(l => { glow(l.x, l.y - 78, 90, "255,214,140", .55 * n); glow(l.x, l.y, 120, "255,200,120", .18 * n); });
      FLOOD.forEach(f => glow(f.x, f.y - 240, 120, "255,250,220", .5 * n));
      glow((PITCH.x0 + PITCH.x1) / 2, (PITCH.y0 + PITCH.y1) / 2, 420, "220,235,255", .16 * n);
      glow((LED.x0 + LED.x1) / 2, LED.y1, 340, "200,120,255", .22 * n);
      glow(CAFE.x, CAFE.y - 120, 160, "255,200,140", .35 * n);
      glow(FOUNT.x, FOUNT.y - 40, 170, "120,220,255", .22 * n);
      for (let i = 0; i < 40; i++) { const t = TREES[i % TREES.length]; const x = t.x + Math.sin(time * .7 + i * 3.1) * 70, y = t.y - 80 + Math.cos(time * .9 + i * 1.7) * 50; glow(x, y, 9, "210,255,140", (.5 + .5 * Math.sin(time * 3 + i)) * .8 * n); }
      if (ev.orbs.length) ev.orbs.forEach(o => glow(o.x, o.y - 18 - o.z, 40, "220,170,255", .5 * n));
      g.restore();
      // string lights between square lamps
      g.save(); for (let i = 0; i < 8; i++) { const a = LAMPS[i], b = LAMPS[(i + 1) % 8]; g.strokeStyle = "rgba(40,30,20,.6)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(a.x, a.y - 74); g.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 30, b.x, b.y - 74); g.stroke(); for (let k = 1; k < 8; k++) { const t = k / 8, x = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * (a.x + b.x) / 2 + t * t * b.x, y = (1 - t) ** 2 * (a.y - 74) + 2 * (1 - t) * t * ((a.y + b.y) / 2 - 30) + t * t * (b.y - 74); g.fillStyle = ["#ffd65b", "#ff8fb8", "#7fe7ff", "#b6f36b"][(k + i) % 4]; g.globalAlpha = .4 + .6 * n; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); } } g.restore();
    } else {
      // daytime: string lights unlit, butterflies
      for (let i = 0; i < 8; i++) { const a = LAMPS[i], b = LAMPS[(i + 1) % 8]; g.strokeStyle = "rgba(40,30,20,.45)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(a.x, a.y - 74); g.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 30, b.x, b.y - 74); g.stroke(); }
      for (let i = 0; i < 10; i++) { const t = TREES[(i * 5) % TREES.length], x = t.x + Math.sin(time * .8 + i) * 60, y = t.y - 40 + Math.sin(time * 1.3 + i * 2) * 30, f = Math.abs(Math.sin(time * 14 + i)); g.fillStyle = ["#fff6b8", "#ffb3d1", "#bfe3ff"][i % 3]; g.beginPath(); g.ellipse(x - 4 * f, y, 4 * f + 1, 3, 0, 0, 7); g.ellipse(x + 4 * f, y, 4 * f + 1, 3, 0, 0, 7); g.fill(); }
    }
  }
  function drawMini() {
    const w = mcv.width, h = mcv.height, s = w / W;
    mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.drawImage(bg, 0, 0, w, h); mctx.fillStyle = "rgba(11,16,32,.25)"; mctx.fillRect(0, 0, w, h);
    mctx.setTransform(s, 0, 0, s, 0, 0);
    const icon = (x, y, t) => { const im = ICON_IMG(t); if (im?.complete) mctx.drawImage(im, x - 70, y - 70, 140, 140); };
    icon(SQ.x, SQ.y - 30, "fountain"); icon((LED.x0 + LED.x1) / 2, LED.y1 + 30, "star"); icon((PITCH.x0 + PITCH.x1) / 2, SQ.y, "ball"); icon(TRACK.cx, TRACK.cy, "flag"); icon(GATE.x, GATE.y - 30, "wheat"); icon(PHOTO.x, PHOTO.y - 60, "camera"); icon(CAFE.x, CAFE.y - 60, "boba");
    NPCS.forEach(n => { mctx.fillStyle = "#fff"; mctx.beginPath(); mctx.arc(n.x, n.y, 20, 0, 7); mctx.fill(); });
    mctx.fillStyle = "#c8a3ff"; mctx.beginPath(); mctx.arc(ball.x, ball.y, 18, 0, 7); mctx.fill();
    mctx.fillStyle = "#ffd65b"; mctx.strokeStyle = "#0b1020"; mctx.lineWidth = 12; mctx.beginPath(); mctx.arc(P.x, P.y, 38, 0, 7); mctx.fill(); mctx.stroke();
    mctx.strokeStyle = "rgba(255,255,255,.85)"; mctx.lineWidth = 8; mctx.strokeRect(cam.x - NW / 2 / Z, cam.y - NH / 2 / Z, NW / Z, NH / Z);
  }

  /* ---------- loop ---------- */
  const ZONES = [
    { n: "Runway", s: "step up to show off your skin", c: "#ff9bd2", t: p => inRunway(p) },
    { n: "Orb Ball Pitch", s: "bump to dribble · dash to shoot", c: "#5ab0ff", t: p => inPitch(p, 30) },
    { n: "Dash Track", s: "cross the start line to start the clock", c: "#ff9b6a", t: p => ell(p.x, p.y).r <= 1.08 },
    { n: "Photo Spot", s: "press E to take a photo", c: "#ffffff", t: p => Math.hypot(p.x - PHOTO.x, (p.y - PHOTO.y) * 1.4) < 150 },
    { n: "Volt Boba", s: "a drink that makes you faster", c: "#ffd84a", t: p => Math.hypot(p.x - CAFE.x, (p.y - CAFE.y - 30) * 1.3) < 170 },
    { n: "Farm Gate", s: "press E to enter", c: "#7cc95a", t: p => p.y > GATE.y - 200 && Math.abs(p.x - GATE.x) < 240 },
    { n: "Fountain Square", s: "hop on a bounce pad", c: "#ffd65b", t: p => inSquare(p.x, p.y, 1.05) },
    { n: "Elemental Plaza", s: "take a stroll", c: "#a0afc8", t: () => true },
  ];
  function step(now) {
    raf = requestAnimationFrame(step);
    const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now; // never negative: the first frame can be stamped before enter() ran T = now / 1000;
    if (!ready) return;
    const photo = !$("pz-photo").hidden;
    if (!photo) {
      if (todHold > 0) todHold -= dt; else tod = FASTP ? (tod + dt / 360) % 1 : realTod();
      moveBody(P, started ? inputDir() : { x: 0, y: 0 }, dt);
      for (const n of NPCS) moveBody(n, reduced ? { x: 0, y: 0 } : brain(n, dt), dt);
      updateBall(dt); updateRun(); updateRunway(dt); if (started) updateEvent(dt);
      FX.forEach(f => { f.t += dt; if (f.g) { f.x += f.vx * dt; f.y += f.vy * dt; f.vz -= 500 * dt; f.z = Math.max(0, f.z + f.vz * dt); } }); for (let i = FX.length - 1; i >= 0; i--) if (FX[i].t > FX[i].life) FX.splice(i, 1);
      updateAnimals(dt);
      near = SPOTS.find(s => Math.hypot(P.x - s.x, (P.y - s.y) * 1.3) < s.r) || null;
      const ib = $("pz-interact"); if (near) { if (ib.dataset.id !== near.id) { ib.dataset.id = near.id; ib.innerHTML = `${I(near.icon)}<span>${near.label}${near.leaf ? L : ""}</span><kbd>E</kbd>`; } ib.hidden = false; } else { ib.hidden = true; ib.dataset.id = ""; }
      const z = ZONES.find(z => z.t(P)); if (z.n !== zoneName) { const first = !zoneName; zoneName = z.n; if (!first && z.n !== "Elemental Plaza") banner(z.n, z.s, z.c); }
      const dcd = $("pz-dash"); dcd.classList.toggle("cd", P.dcd > 0); dcd.style.setProperty("--cd", Math.max(0, (1 - P.dcd / .9) * 100));
      const lead = { x: P.vx * .25, y: P.vy * .2 };
      cam.x += (Math.max(NW / 2 / Z, Math.min(W - NW / 2 / Z, P.x + lead.x)) - cam.x) * Math.min(1, dt * 5);
      cam.y += (Math.max(NH / 2 / Z, Math.min(H - NH / 2 / Z + 40, P.y - 40 + lead.y)) - cam.y) * Math.min(1, dt * 5);
      { const nt = night() > .5, ck = $("pz-clock"); if (ck.dataset.k !== `${nt}${clockText()}`) { ck.dataset.k = `${nt}${clockText()}`; ck.innerHTML = `${I(nt ? "moon" : "sun")}<span>${clockText()}</span>`; } }
    }
    ctx.setTransform(PS, 0, 0, PS, 0, 0); ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#24452a"; ctx.fillRect(0, 0, NW, NH);
    ctx.save(); ctx.translate(NW / 2, NH / 2); ctx.scale(Z, Z); ctx.translate(-cam.x, -cam.y);
    drawWorld(ctx, T); ctx.restore();
    // vignette
    const vg = ctx.createRadialGradient(NW / 2, NH / 2, NH * .45, NW / 2, NH / 2, NH * .95); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(5,10,25,.35)"); ctx.fillStyle = vg; ctx.fillRect(0, 0, NW, NH);
    if (Math.floor(T * 10) % 2 === 0) drawMini();
  }

  /* ---------- public ---------- */
  function snapshot() {
    if (!ready) prep();
    const o = document.createElement("canvas"); o.width = 1280; o.height = 800; const g = o.getContext("2d"), z = .72;
    g.translate(640, 400); g.scale(z, z); g.translate(-SQ.x, -(SQ.y - 260));
    const keep = tod; tod = .42; drawWorld(g, 1.5, true); tod = keep;
    return o.toDataURL("image/jpeg", .82);
  }
  function resize(nw, nh, ps) {
    if (running) setTimeout(renderQuests, 0);
    NW = nw; NH = nh; PS = ps; Z = nw < 1000 ? .66 : 1;
    cv.width = Math.round(nw * ps); cv.height = Math.round(nh * ps);
    const r = $("pz-mini"); mcv.width = Math.round(r.offsetWidth * ps); mcv.height = Math.round(r.offsetHeight * ps);
  }
  function refreshLook() {
    P.key = (E.skin[CH[S.champ].id] ? `${E.skin[CH[S.champ].id]}:${E.awaken[E.skin[CH[S.champ].id]]?.stage ?? 1}` : null);
    P.img = new Image(); P.img.src = heroArt(CH[S.champ].id);
    if (!P.key || !SKIN[P.key]) P.key = `__me`;
    SKIN.__me = SKIN.__me || ["", ""];
    const id = E.skin[CH[S.champ].id]; SKIN[P.key] = id ? [ITEM[id].name, `${RAR_NAME[ITEM[id].rarity]}${ITEM[id].rarity === "mythical" ? ` · Stage ${"I".repeat(E.awaken[id]?.stage ?? 1)}` : ""}`] : [CH[S.champ].name, "Original look"];
  }
  let firstEnter = true;
  function enter() {
    refreshLook(); updateTreats(); renderQuests();
    if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(step); }
    if (!ready) prep();
    screen.focus({ preventScroll: true });
    setTimeout(() => { if (!started) return; banner("Elemental Plaza", "Everyone's playground", "#ffd65b"); }, 50);
  }
  function leave() { running = false; cancelAnimationFrame(raf); keys.clear(); toggleWheel(false); }
  NPCS.forEach(n => { n.img = new Image(); n.img.src = svgUrl(ART[n.key]); });
  setInterval(() => { if (running && started && !reduced) { const n = pick(NPCS); if (["wander", "dance", "cafe"].includes(n.ai) && Math.random() < .5) emote(n, pick(["👋", "GG", "🔥", "😂", "❤️", "💃", "😎"])); } }, 2600);
  setInterval(() => { if (running && started) { const msgs = [["minh_anh", "cindrake-blue-flame:1", "harvested 12 <b>Ember Peppers</b> on the farm"], ["kenji.owl", "mystowl-oracle:2", "invites you over: a <b>Gold Mind Plum</b> just ripened"], ["Lena", "terradon-bonsai:1", "hired <b>Inky</b> to guard the farm"]]; const [n, k, m] = pick(msgs); feed(k, `<b>${n}</b> ${m}`); } }, 17000);
  return { enter, leave, resize, refreshLook, snapshot, get started() { return started; }, _dbg: { P, run, ball, score, ev, Q, SPOTS, get tod() { return tod; } } };
})();
