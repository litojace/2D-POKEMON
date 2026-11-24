/*
 * The Storm Twins as 2.5D vector rigs: two jellyfish-clouds. Fizz is gold and
 * laughs; Crackle is blue and grumbles. PURE (see kit.js).
 *
 * A twin's bell is its head: the face is built on the bell with the kit's
 * construction. There is no muzzle or beak, so the far eye's occluder is the
 * bell's own outline: the far eye is a narrower drawing held inside it.
 */
const TWINS = (() => {
  "use strict";
  const { TAU, DEG, clamp, lerp, smooth, project, rotY, depth, after, makeFace, pieceOf, grad, radial, glowPiece, adder } = KIT;

  // ════════════════════════ the face: construction ════════════════════════
  const A = 40; // the bell's half-width at its rim
  const RIM = 0.45 * A, // the rim's height below the bell's centre
    H = 1.25 * A; // crown to rim
  /** The bell's half-width at height v: a dome, widest at the rim. */
  const bell = (v) => (v > RIM ? A * (1 - 0.5 * clamp((v - RIM) / (0.16 * A))) : A * Math.pow(clamp(1 - Math.pow(clamp((RIM - v) / H), 2.2)), 1 / 2.2));
  const centreLine = (v) => 0.96 * bell(Math.min(v, RIM));
  const skullEdge = (view, v) => [-bell(v), bell(v)];
  const LOOKS = ["idle", "glare", "wide", "hurt", "dizzy", "closed"];
  const MOUTHS = ["smile", "open", "o", "grit", "flat"];
  const EYE = { front: { hw: 6.6, hh: 5.6 }, near: { hw: 6.6, hh: 5.6 }, far: { hw: 4.3, hh: 5.5 }, side: { hw: 3.6, hh: 5.5 } };
  const spec = (pre, name) => ({
    key: pre, name, A, top: RIM - H, bot: RIM + 0.16 * A,
    lines: { eye: 0.04 * A, mouth: 0.3 * A },
    eyeAz: 30 * DEG, eyeOrbit: 0.8 * A, lag: 10 * DEG, farLift: 5 * DEG, nod: 0.4 * A, margin: 0.05 * A,
    eye: EYE, centreLine, skullEdge,
    headPiece: () => pre + "_bell", // a bell looks the same from every side
    eyePiece: (v, look) => `${pre}_eye_${v}_${look}`,
    // open eyes carry a highlight: Fizz's when it stares, Crackle's whenever they are open
    eyeGeom: (v, look) => ({ r: look === "wide" ? 3.2 : 3.6, gx: v === "front" ? 0.5 : 0.9, gy: pre === "ck" && look !== "wide" ? 1.6 : 0.4 }),
    glint: (look) => look === "wide" || look === "glare" || (pre === "ck" && look === "idle"),
    glintR: 4.6,
    centre: [{ id: "mouth", line: 0.3 * A, hw: { front: 5, tq: 4, side: 0 }, vspan: [-2, 4], sideInset: 2.2, piece: (v, e) => `${pre}_mouth_${v}_${e.mouth || "smile"}` }],
  });
  const FZ = makeFace(spec("fz", "Fizz")),
    CK = makeFace(spec("ck", "Crackle"));

  // ════════════════════════ the pose ════════════════════════
  const ATTACKS = ["link-beam", "chain-lightning", "static-field", "twin-rush", "polarity", "thunderclap"];
  /** cue -> pose. `tw[0]` is Fizz, `tw[1]` Crackle. */
  function twinsPose(c) {
    const t = c.reduced ? 0 : c.clock, m = c.reduced ? 0 : 1;
    const one = (i) => ({
      dx: 0, dy: Math.sin(t * 2 + i * 2.1) * 5 * m, dz: 0,
      yaw: (Math.sin(t * 0.8 + i * 1.7) * 0.14 + Math.sin(t * 2.1 + i) * 0.04) * m,
      pitch: Math.sin(t * 1.4 + i) * 0.06 * m, roll: Math.sin(t * 1.1 + i * 2) * 0.06 * m,
      squash: 1 + Math.sin(t * 2 + i * 2.1 + 1.2) * 0.03 * m, spread: 0, droop: 0,
      look: "idle", mouth: "smile",
      blink: i === 1 && m && (t + 0.8) % 4.3 > 4.18,
      glow: 0.22 + (c.phase - 1) * 0.16, spark: c.phase === 3 ? 0.5 : 0, alpha: 1,
    });
    const P = { t, tw: [one(0), one(1)], beam: 0, stars: 0 };
    const [f, k] = P.tw;
    const both = (fn) => P.tw.forEach(fn);
    const w = clamp(c.windup || 0), kind = c.windKind, cast = c.castKind, age = c.castAge === undefined ? 99 : c.castAge;
    if (kind) both((q) => ((q.look = "glare"), (q.glow = lerp(q.glow, 0.9, w))));
    if (kind === "link-beam") { f.roll += 0.22 * w; k.roll -= 0.22 * w; f.dx += 8 * w; k.dx -= 8 * w; }
    else if (kind === "chain-lightning") { k.dy += 12 * w; k.spark = w; f.dy += Math.abs(Math.sin(c.clock * 9)) * 6 * w; f.look = "idle"; }
    else if (kind === "static-field") both((q) => ((q.spread = w), (q.spark = w)));
    else if (kind === "twin-rush") both((q) => ((q.pitch += 0.3 * w), (q.dz -= 14 * w), (q.squash *= 1 - 0.08 * w)));
    else if (kind === "polarity") both((q, i) => ((q.roll += Math.sin(c.clock * 14 + i * 3) * 0.14 * w), (q.look = "wide"), (q.mouth = "o")));
    else if (kind === "thunderclap") both((q) => ((q.dy += 26 * w), (q.spread = 0.6 * w)));
    const hit = (dur) => after(age, dur);
    if (cast === "link-beam") { const a = hit(0.8); P.beam = a; both((q) => (q.glow = Math.max(q.glow, a))); if (a > 0.05) { f.mouth = "open"; k.look = "glare"; k.mouth = "open"; } }
    else if (cast === "chain-lightning") { const a = hit(0.6); k.spark = a; k.dy += 8 * a; if (a > 0.05) { k.look = "glare"; k.mouth = "open"; f.mouth = "open"; } }
    else if (cast === "static-field") { const a = hit(0.7); both((q) => ((q.spread = a), (q.spark = a), (q.squash *= 1 + 0.1 * a))); if (a > 0.05) { f.mouth = "open"; k.look = "glare"; } }
    else if (cast === "twin-rush") { const a = hit(0.55); both((q) => ((q.dz += 34 * a), (q.pitch += 0.25 * a), (q.droop = -a))); if (a > 0.05) { f.look = "glare"; f.mouth = "open"; k.look = "glare"; k.mouth = "grit"; } }
    else if (cast === "polarity") { const a = hit(0.6); both((q) => (q.glow = Math.max(q.glow, a))); if (a > 0.05) both((q) => ((q.look = "wide"), (q.mouth = "o"))); }
    else if (cast === "thunderclap") { const a = hit(0.5); both((q) => ((q.dy -= 16 * a), (q.squash *= 1 + 0.16 * a), (q.spark = a))); if (a > 0.05) both((q) => ((q.look = "glare"), (q.mouth = "open"))); }
    const roar = after(c.roarAge === undefined ? 99 : c.roarAge, 1.1);
    if (roar > 0.05) both((q) => ((q.dy += 10 * roar), (q.spread = roar), (q.spark = roar), (q.look = "glare"), (q.mouth = "open")));
    if (c.exposed && !c.stagger) both((q) => ((q.look = "wide"), (q.mouth = "o"), (q.droop = 0.5)));
    if (c.stagger) { both((q, i) => ((q.look = "dizzy"), (q.mouth = "flat"), (q.roll = Math.sin(c.clock * 3 + i * 2) * 0.3 * m + (m ? 0 : 0.2)), (q.yaw = 0), (q.dy -= 12), (q.droop = 0.8))); P.stars = 1; }
    if ((c.hurt || 0) > 0.3 && !c.dead) both((q, i) => ((q.look = "hurt"), (q.mouth = i ? "grit" : "o"), (q.roll += 0.14 * c.hurt * (i ? -1 : 1)), (q.squash *= 1 - 0.08 * c.hurt)));
    if (c.dead) {
      const d = smooth(0, 0.9, c.deadAge === undefined ? 9 : c.deadAge);
      both((q, i) => ((q.dy = -62 * d), (q.roll = (i ? -0.3 : 0.3) * d), (q.yaw = 0), (q.pitch = 0.1 * d), (q.look = "closed"), (q.mouth = "flat"), (q.blink = false), (q.droop = d), (q.glow = 0.05), (q.spark = 0), (q.squash = 1 + 0.08 * d)));
    }
    P.look = f.look;
    P.mouth = f.mouth;
    return P;
  }

  // ════════════════════════ the bodies ════════════════════════
  const HOME = [-62, 62],
    FLOAT = 98;
  function twinsPlacements(P, yaw, phase, prev) {
    const list = [], add = adder(list);
    const heads = [], t = P.t;
    P.tw.forEach((q, i) => {
      const pre = i ? "ck" : "fz", fk = i ? CK : FZ;
      const c = { x: HOME[i] + q.dx, y: FLOAT + q.dy, z: 0 };
      const fwd = rotY({ x: 0, y: 0, z: q.dz }, yaw);
      const centre = { x: c.x + fwd.x, y: c.y, z: c.z + fwd.z };
      const hs = project(centre), hz = depth(centre) + 4;
      const hy = yaw + q.yaw;
      const cr = Math.cos(q.roll), sr = Math.sin(q.roll);
      const local = (u, v) => ({ x: hs.x + u * cr - v * sr, y: hs.y + u * sr + v * cr });
      const raw = (key, piece, u, v, o = {}) => {
        const s = local(u, v);
        list.push({ key: pre + key, piece, x: s.x, y: s.y, rot: q.roll + (o.rot || 0), sx: (o.sx || 1) * q.squash, sy: (o.sy || 1) / q.squash, alpha: (o.alpha === undefined ? 1 : o.alpha) * q.alpha, z: hz + (o.dz || 0), glow: !!o.glow, actor: i });
      };
      raw("aura", pre + "_glow", 0, 0, { glow: true, alpha: q.glow, sx: 3.2, sy: 3.2, dz: -9 });
      // tentacles: six round the rim, hanging under the bell, curling outward
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * TAU + 0.3 + hy;
        const rx = Math.sin(a) * 0.62 * A, rz = Math.cos(a);
        const sway = Math.sin(t * 2.4 + j * 1.3 + i) * 0.16;
        const out = Math.sign(rx) || 1;
        raw("tent" + j, pre + "_tent", rx, RIM + 2 + rz * 3, {
          rot: -out * (0.1 + q.spread * 0.7 + Math.abs(rx) / A * 0.35) + sway + q.droop * out * 0.18,
          sx: out * (0.86 + 0.14 * Math.abs(Math.sin(a))), sy: 1 - 0.18 * Math.max(0, q.droop) + 0.12 * Math.max(0, -q.droop),
          dz: -3 + rz * 0.5,
        });
      }
      const face = fk.face({ x: hs.x, y: hs.y, yaw: hy, pitch: q.pitch, roll: q.roll, z: hz, prevView: prev && prev[i] }, { look: q.look, mouth: q.mouth, blink: q.blink });
      for (const f of face.placements) {
        f.actor = i;
        f.alpha *= q.alpha;
        if (f.piece === pre + "_bell") (f.sx = q.squash), (f.sy = 1 / q.squash);
        list.push(f);
      }
      // the cloud curl on the crown leans the way the twin faces
      const lean = Math.sin(hy);
      raw("curl", pre + "_curl", lean * 5, RIM - H + 5, { sx: lean < -0.05 ? -1 : 1, rot: Math.sin(t * 1.7 + i) * 0.06, dz: 0.5 });
      if (q.spark > 0.02)
        for (let j = 0; j < 5; j++) {
          const a = t * 3 + j * 1.26 + i, r = A * (1.25 + 0.2 * Math.sin(t * 7 + j));
          raw("spark" + j, pre + "_spark", Math.cos(a) * r, Math.sin(a) * r * 0.8, { rot: a + Math.PI / 2, alpha: q.spark * (0.5 + 0.5 * Math.sin(t * 23 + j * 2)), glow: true, dz: Math.sin(a) > 0 ? 2 : -8 });
        }
      if (P.stars) KIT.stars(list, { x: hs.x, y: hs.y }, hz, t + i, A * 1.75, 26);
      heads.push({ x: hs.x, y: hs.y, view: face.view, side: face.side, guide: face.guide, marks: face.marks });
    });
    list.forEach((p) => { if (p.piece === "star" && p.actor === undefined) p.actor = p.x < 0 ? 0 : 1; });
    // the link between them
    if (P.beam > 0.02) {
      const a = heads[0], b = heads[1];
      for (let j = 1; j < 8; j++) {
        const u = j / 8;
        list.push({ key: "beam" + j, piece: j % 2 ? "fz_glow" : "ck_glow", x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) + Math.sin(P.t * 30 + j) * 3, rot: 0, sx: 0.9, sy: 0.5, alpha: P.beam, z: 1e3, glow: true });
      }
    }
    list.sort((a, b) => a.z - b.z);
    return { placements: list, heads, shadows: P.tw.map((q, i) => [HOME[i] + q.dx, 0, 34, 10]) };
  }

  // ════════════════════════ the pieces (drawn once) ════════════════════════
  const PAL = {
    fz: { light: "#fff6c4", base: "#ffd65e", dark: "#f3a62a", edge: "#b06c08", rim: "#fffbe6", ink: "#5a2c0a", glow: "255,214,96", blush: "rgba(255,120,90,0.5)" },
    ck: { light: "#eef9ff", base: "#a9d6ff", dark: "#5f9eea", edge: "#2c5fae", rim: "#ffffff", ink: "#16306e", glow: "120,190,255", iris: "#2f6fe0" },
  };
  const hotter = (pal, phase) => (phase === 3 ? { ...pal, dark: pal === PAL.fz ? "#f08a1c" : "#4a86e0" } : pal);
  function bellPiece(pre, pal) {
    return pieceOf(pre + "_bell", 2.5 * A, 2 * A, 0.5, 0.56, (c) => {
      const path = new Path2D();
      for (let v = RIM - H; v <= RIM; v += 0.5) path.lineTo(bell(v), v);
      for (let v = RIM; v >= RIM - H; v -= 0.5) path.lineTo(-bell(v), v);
      path.closePath();
      // the scalloped rim
      for (let j = 0; j < 5; j++) { const x = lerp(-0.78 * A, 0.78 * A, j / 4); path.moveTo(x + 0.23 * A, RIM + 1); path.ellipse(x, RIM + 1, 0.23 * A, 0.15 * A, 0, 0, TAU); }
      c.strokeStyle = pal.edge;
      c.lineWidth = 2;
      c.stroke(path);
      c.fillStyle = radial(c, -0.25 * A, -0.35 * A, 2, 1.5 * A, [[0, pal.light], [0.45, pal.base], [1, pal.dark]]);
      c.fill(path);
      c.save();
      c.clip(path);
      c.fillStyle = radial(c, 0, RIM + 6, 2, A, [[0, pal.rim + "aa"], [1, pal.rim + "00"]]); // light through the jelly
      c.fillRect(-A, -A, 2 * A, 2 * A);
      c.strokeStyle = pal.rim; // the shine on the crown
      c.globalAlpha = 0.85;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0.2 * A, 0.86 * A, Math.PI * 1.18, Math.PI * 1.42);
      c.stroke();
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 0.2 * A, 0.86 * A, Math.PI * 1.46, Math.PI * 1.5);
      c.stroke();
      c.restore();
    });
  }
  function curlPiece(pre, pal) {
    return pieceOf(pre + "_curl", 44, 44, 0.5, 0.86, (c) => {
      const path = new Path2D();
      for (const [x, y, rx, ry] of [[0, -2, 15, 9], [-1, -13, 11, 8.5], [5, -23, 8.5, 8]]) { path.moveTo(x + rx, y); path.ellipse(x, y, rx, ry, 0, 0, TAU); }
      c.strokeStyle = pal.edge;
      c.lineWidth = 2;
      c.stroke(path);
      c.fillStyle = grad(c, 0, -32, 0, 6, [pal.light, pal.base, pal.dark]);
      c.fill(path);
      c.strokeStyle = pal.edge; // the swirl
      c.lineWidth = 1.3;
      c.globalAlpha = 0.7;
      c.beginPath();
      c.arc(5, -23, 4.2, Math.PI * 0.3, Math.PI * 1.9);
      c.moveTo(-11, -9);
      c.quadraticCurveTo(-2, -5, 9, -11);
      c.moveTo(-9, -19);
      c.quadraticCurveTo(-3, -16, 1, -18);
      c.stroke();
      c.globalAlpha = 0.9;
      c.strokeStyle = pal.rim;
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(-2, -13, 7, Math.PI * 1.1, Math.PI * 1.45);
      c.stroke();
    });
  }
  function tentPiece(pre, pal) {
    return pieceOf(pre + "_tent", 40, 74, 0.3, 0.04, (c) => {
      const run = () => {
        c.beginPath();
        c.moveTo(0, 0);
        c.bezierCurveTo(-4, 18, 5, 30, 2, 44);
        // the curl at the tip, turning outward (+x)
        c.bezierCurveTo(0, 58, 18, 62, 20, 50);
        c.bezierCurveTo(21, 42, 11, 41, 11, 48);
      };
      for (const [w, col, a] of [[11, pal.edge, 1], [8, pal.base, 1], [3.2, pal.light, 0.8]]) {
        c.strokeStyle = col;
        c.globalAlpha = a;
        c.lineWidth = w;
        run();
        c.stroke();
      }
    });
  }
  function sparkPiece(pre, pal) {
    return pieceOf(pre + "_spark", 16, 26, 0.5, 0.5, (c) => {
      c.strokeStyle = `rgb(${pal.glow})`;
      c.lineWidth = 2.6;
      c.beginPath(); c.moveTo(2, -11); c.lineTo(-3, -2); c.lineTo(3, 1); c.lineTo(-2, 11); c.stroke();
      c.strokeStyle = "#fff";
      c.lineWidth = 1;
      c.stroke();
    });
  }
  /** One twin's eye in one view and look. Drawn with the inner corner at +x. */
  function eyePiece(pre, view, look, pal) {
    return pieceOf(`${pre}_eye_${view}_${look}`, 24, 22, 0.5, 0.5, (c) => {
      const { hw, hh } = EYE[view];
      if (view === "far") c.scale(-1, 1);
      const face = view === "far" ? -1 : 1; // +x on the drawing is this way on the head
      const ink = pal.ink;
      c.strokeStyle = ink;
      c.fillStyle = ink;
      c.lineWidth = 2;
      if (pre === "fz" && (view === "front" || view === "near") && look !== "dizzy") {
        c.fillStyle = pal.blush; // the blush under the outer corner
        c.beginPath(); c.ellipse(-hw * 0.5, hh + 2.6, 3.6, 1.9, 0, 0, TAU); c.fill();
        c.fillStyle = ink;
      }
      if (look === "hurt") { c.beginPath(); c.moveTo(-hw * 0.8, -hh * 0.6); c.lineTo(hw * 0.7, 0.2); c.lineTo(-hw * 0.8, hh * 0.7); c.stroke(); return; }
      if (look === "dizzy") {
        c.lineWidth = 1.4;
        c.beginPath();
        for (let i = 0; i <= 50; i++) { const a = (i / 50) * TAU * 2.1, r = (i / 50) * 0.95; i ? c.lineTo(Math.cos(a) * r * hw, Math.sin(a) * r * hh) : c.moveTo(0, 0); }
        c.stroke();
        return;
      }
      if (look === "closed") {
        c.beginPath();
        if (pre === "fz") { c.moveTo(-hw * 0.9, -0.5); c.quadraticCurveTo(0, hh * 0.9, hw * 0.9, -0.5); } // asleep, still smiling
        else { c.moveTo(-hw * 0.9, 0.6); c.lineTo(hw * 0.9, 1.2); } // a flat line
        c.stroke();
        return;
      }
      if (pre === "fz" && look === "idle") { // laughing: an arch
        c.lineWidth = 2.3;
        c.beginPath(); c.moveTo(-hw * 0.92, hh * 0.5); c.quadraticCurveTo(0, -hh * 1.05, hw * 0.92, hh * 0.5); c.stroke();
        return;
      }
      const g = { r: look === "wide" ? 3.2 : 3.6, gx: view === "front" ? 0.5 : 0.9 };
      if (pre === "fz") { // open and bright: a round dark eye
        const r = look === "wide" ? hh * 0.98 : hh * 0.9;
        c.beginPath(); c.ellipse(0, 0, Math.min(hw, r), r, 0, 0, TAU); c.fill();
        if (look === "wide") { c.fillStyle = "#fff8e0"; c.beginPath(); c.ellipse(0, 0, Math.min(hw, r) - 1.3, r - 1.3, 0, 0, TAU); c.fill(); c.fillStyle = ink; c.beginPath(); c.arc(g.gx * face, 0.4, g.r * 0.62, 0, TAU); c.fill(); }
        else { c.strokeStyle = ink; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-hw - 0.5, -hh * 0.9); c.lineTo(-hw * 0.2, -hh * 1.25); c.stroke(); } // a cheeky lash
        return;
      }
      // Crackle: a white eye under a flat lid; the lid drops to the inner corner when it glares
      const lidY = look === "wide" ? -hh * 1.2 : look === "glare" ? -hh * 0.2 : -hh * 0.05;
      const slope = look === "glare" ? 0.42 : 0.04;
      c.save();
      c.beginPath(); c.ellipse(0, 0, hw, hh, 0, 0, TAU); c.clip();
      c.beginPath(); c.moveTo(-hw - 2, lidY - slope * hw); c.lineTo(hw + 2, lidY + slope * hw); c.lineTo(hw + 2, hh + 2); c.lineTo(-hw - 2, hh + 2); c.closePath(); c.clip();
      c.fillStyle = "#f7fcff";
      c.fillRect(-12, -11, 24, 22);
      c.fillStyle = pal.iris;
      c.beginPath(); c.arc(g.gx * face, look === "wide" ? 0.4 : 1.6, g.r, 0, TAU); c.fill();
      c.fillStyle = ink;
      c.beginPath(); c.arc(g.gx * face, look === "wide" ? 0.4 : 1.6, g.r * 0.5, 0, TAU); c.fill();
      c.restore();
      c.lineWidth = 1;
      c.save();
      c.beginPath(); c.rect(-12, lidY - slope * hw - 0.5, 24, 24); c.clip();
      c.beginPath(); c.ellipse(0, 0, hw, hh, 0, 0, TAU); c.stroke();
      c.restore();
      if (look !== "wide") { c.lineWidth = 2.2; c.beginPath(); c.moveTo(-hw - 1, lidY - slope * (hw + 1)); c.lineTo(hw + 0.6, lidY + slope * (hw + 0.6)); c.stroke(); }
      else { c.lineWidth = 1.8; c.beginPath(); c.ellipse(0, 0, hw, hh, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); }
    });
  }
  function mouthPiece(pre, view, kind, pal) {
    return pieceOf(`${pre}_mouth_${view}_${kind}`, 22, 18, 0.5, 0.35, (c) => {
      const ink = pal.ink, fz = pre === "fz";
      c.strokeStyle = ink;
      c.lineWidth = 1.5;
      // the far half is shorter in three-quarter; in profile only the near half shows
      const fx = (x) => (view === "tq" && x > 0 ? x * 0.55 : view === "side" ? (x > 0 ? x * 0.15 : x * 0.75) : x);
      const M = (x, y) => c.moveTo(fx(x), y), Q = (a, b, x, y) => c.quadraticCurveTo(fx(a), b, fx(x), y);
      const inside = () => { c.fillStyle = fz ? "#c2452c" : "#274a9a"; c.fill(); c.stroke(); };
      c.beginPath();
      if (kind === "smile") {
        if (fz) { M(-4.6, 0); Q(0, 0.8, 4.6, 0); Q(3.6, 6.4, 0, 6.4); Q(-3.6, 6.4, -4.6, 0); c.closePath(); inside(); c.fillStyle = "#ff8f7a"; c.beginPath(); c.ellipse(fx(0), 4.8, Math.abs(fx(2.2)) || 1, 1.3, 0, 0, TAU); c.fill(); }
        else { M(-3.4, 2.6); Q(0, 0.2, 3.4, 2.6); c.stroke(); } // a small frown
      } else if (kind === "open") {
        M(-5.6, -0.4); Q(0, fz ? 1.2 : -1.6, 5.6, -0.4); Q(5, 8, 0, 8); Q(-5, 8, -5.6, -0.4); c.closePath(); inside();
        c.fillStyle = fz ? "#ff8f7a" : "#7fb0ff"; c.beginPath(); c.ellipse(fx(0), 6, Math.abs(fx(2.6)) || 1, 1.5, 0, 0, TAU); c.fill();
      } else if (kind === "o") { c.ellipse(fx(0), 2.6, view === "front" ? 2.4 : 1.7, 2.9, 0, 0, TAU); inside(); }
      else if (kind === "grit") {
        M(-4.8, 0.4); Q(0, -0.2, 4.8, 0.4); Q(5, 2.6, 4.6, 4.6); Q(0, 5.2, -4.6, 4.6); Q(-5, 2.6, -4.8, 0.4); c.closePath();
        c.fillStyle = "#fff"; c.fill(); c.stroke();
        c.lineWidth = 0.7; c.beginPath(); for (const x of [-2.4, 0, 2.4]) { M(x, 0.2); c.lineTo(fx(x), 4.9); } c.stroke();
      } else { M(-3.6, 2); Q(-1.6, fz ? 3.4 : 0.8, 0, 2); Q(1.6, fz ? 0.8 : 3.2, 3.6, 2); c.stroke(); } // flat, wobbling
    });
  }
  function twinsPieces(phase) {
    const list = [KIT.starPiece()];
    for (const pre of ["fz", "ck"]) {
      const pal = hotter(PAL[pre], phase);
      list.push(bellPiece(pre, pal), curlPiece(pre, pal), tentPiece(pre, pal), sparkPiece(pre, pal), glowPiece(pre + "_glow", pal.glow));
      for (const v of ["front", "near", "far", "side"]) for (const l of LOOKS) list.push(eyePiece(pre, v, l, pal));
      for (const v of ["front", "tq", "side"]) for (const m of MOUTHS) list.push(mouthPiece(pre, v, m, pal));
    }
    list.push(KIT.pieceOf("glint", 9, 9, 0.5, 0.5, (c) => { c.fillStyle = "#fff"; c.beginPath(); c.arc(-1.3, -1.6, 1.2, 0, TAU); c.fill(); }));
    return list;
  }

  const boss = {
    id: "storm-twins",
    title: "Storm Twins",
    lede: "Two jellyfish-clouds. Fizz laughs with arched eyes and an open mouth; Crackle glowers under a flat lid. The bell is the head, so its own outline holds the far eye.",
    attacks: [["link-beam", "Link Beam"], ["chain-lightning", "Chain Lightning"], ["static-field", "Static Field"], ["twin-rush", "Twin Rush"], ["polarity", "Polarity"], ["thunderclap", "Thunderclap"]],
    pose: twinsPose, placements: twinsPlacements, pieces: twinsPieces,
    faces: [FZ, CK], faceNames: ["Fizz", "Crackle"], actors: 2, looks: LOOKS, mouths: MOUTHS,
    stage: { w: 330, h: 250, ground: 0.84, closeW: 250, closeH: 110, sheetGap: 150, sheetH: 200, closeGap: 104, closeSheetH: 96, champion: [-150, 30], shadow: [34, 10], floor: ["#0a1020", "#141c36", "150,200,255"] },
    occluders: ["the bell's own outline (no muzzle)", "the bell's own outline (no muzzle)"],
  };
  return { A, ATTACKS, LOOKS, MOUTHS, bell, boss, twinsPose, twinsPlacements, twinsPieces };
})();
