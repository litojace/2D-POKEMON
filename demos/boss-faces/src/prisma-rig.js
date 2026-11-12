/*
 * Prismatail as a 2.5D vector rig: a crystal peacock with a swan's neck and
 * head, a gold crown and a fan of crystal shards. PURE (see kit.js).
 *
 * A small head on a long neck. The slender gold beak is the occluder: at
 * three-quarter its base sits over the far eye's inner corner.
 */
const PRISMA = (() => {
  "use strict";
  const { TAU, DEG, clamp, lerp, smooth, gauss, project, rotY, depth, after, makeFace, drawEye, drawBrow, BROWS, along, pieceOf, tuft, furPath, grad, radial, paintSoft, glowPiece, adder } = KIT;

  // ════════════════════════ the face: construction ════════════════════════
  // A swan's head: small, longer than it is tall, the crown rounding down the
  // back into the neck and the brow sloping forward into the beak. From the
  // front it is narrow, the eyes on its sides (a bird's, not an owl's).
  const A = 17;
  const TOP = -0.74 * A, BOT = 0.56 * A;
  const MID = (TOP + BOT) / 2, HALF = (BOT - TOP) / 2;
  const se = (v) => { const t = clamp(Math.abs((v - MID) / HALF)); const e = v > MID ? 1.7 : 2.3; return Math.pow(1 - Math.pow(t, e), 1 / e); };
  /** THE CENTRE LINE: a sloping brow, then the beak's base standing out below the eye. */
  const centreLine = (v) => A * (0.78 * se(v) + 0.3 * gauss((v - 0.08 * A) / A, 0.3) * Math.pow(se(v), 0.4));
  const taper = (v) => 1 - 0.18 * smooth(MID, BOT, v); // the narrow chin
  function skullEdge(view, v) {
    const s = se(v);
    if (view === "side") return [-0.8 * A * s, centreLine(v)];
    if (view === "tq") return [-0.9 * A * s, lerp(0.8 * A * s, centreLine(v), 0.55)];
    if (view === "backtq") return [-0.9 * A * s, lerp(0.76 * A * s, centreLine(v), 0.3)];
    return [-0.58 * A * s * taper(v), 0.58 * A * s * taper(v)];
  }
  const LINES = { brow: -0.36 * A, eye: -0.1 * A, beak: 0.12 * A };
  // the front eye is seen across the cheek: drawn narrower, never squeezed
  const EYE = { front: { hw: 2.3, hh: 2.5 }, near: { hw: 3.5, hh: 2.6 }, far: { hw: 2.3, hh: 2.5 }, side: { hw: 3.6, hh: 2.6 } };
  const LOOKS = ["idle", "glare", "wide", "hurt", "dizzy", "closed"];
  const MOUTHS = ["closed", "open"];
  const BROW = { idle: "calm", glare: "angry", wide: "raised", hurt: "pinch", dizzy: "raised", closed: "calm" };
  const eyeGeom = (v, look) => ({ r: look === "wide" ? 1.6 : 1.85, gx: v === "far" ? 0.1 : v === "front" ? -0.35 : 0.7, gy: look === "wide" ? 0.1 : look === "glare" ? 0.7 : 0.4 });
  const SPEC = {
    A, top: TOP, bot: BOT, lines: LINES,
    eyeAz: 38 * DEG, eyeOrbit: 0.78 * A, lag: 12 * DEG, farLift: 6 * DEG, nod: 0.4 * A, margin: 0.02 * A,
    eye: EYE, eyeGeom, centreLine, skullEdge, tuckCap: 0.35, bridgeHalf: 0.4,
    headPiece: (view) => "head_" + view,
    lit: (look) => look === "glare", eyeGlowPiece: "glow_prism", eyeGlowScale: 0.5,
    glint: (look) => look === "idle" || look === "glare" || look === "wide", glintR: 6,
    brow: (look) => ({ kind: BROW[look], dy: look === "glare" ? 1.3 : look === "wide" ? -1 : 0.3, dx: 0.4 }),
    centre: [{ id: "beak", line: LINES.beak, sideInset: 1.2, layer: (v) => (v === "tq" ? "mid" : "top"), piece: (v, e) => `beak_${v}_${e.mouth === "open" ? "open" : "closed"}` }],
  };
  const FACE = makeFace(SPEC);

  // ════════════════════════ the pose ════════════════════════
  const ATTACKS = ["prism-lance", "fan-display", "glare", "refraction", "halo-crush", "light-relay"];
  function prismaPose(c) {
    const t = c.reduced ? 0 : c.clock, m = c.reduced ? 0 : 1;
    const P = {
      t, bob: Math.sin(t * 1.8) * 1.5 * m, fan: 0.74 + Math.sin(t * 0.9) * 0.03 * m, wing: 0, neckFwd: 0, neckUp: 0, rear: 0,
      headYaw: (Math.sin(t * 0.7) * 0.2 + Math.sin(t * 1.9) * 0.05) * m, headPitch: Math.sin(t * 1.2) * 0.06 * m, headRoll: Math.sin(t * 0.9 + 1) * 0.06 * m,
      look: "idle", mouth: "closed", blink: m && t % 3.9 > 3.78, eyeGlow: 0, shine: 0.15 + (c.phase - 1) * 0.2, crown: (c.phase - 1) * 0.25, alpha: 1, stars: 0, sink: 0,
    };
    const w = clamp(c.windup || 0), kind = c.windKind, cast = c.castKind, age = c.castAge === undefined ? 99 : c.castAge;
    const hit = (d) => after(age, d);
    if (kind) P.look = "glare";
    if (kind === "prism-lance") { P.neckFwd = -10 * w; P.neckUp = 6 * w; P.headPitch += 0.1 * w; P.fan = lerp(P.fan, 0.5, w); }
    else if (kind === "fan-display") { P.fan = lerp(P.fan, 1.05, w); P.wing = 0.5 * w; P.neckUp = 8 * w; P.headPitch -= 0.15 * w; P.look = "idle"; P.shine = Math.max(P.shine, w); }
    else if (kind === "glare") { P.eyeGlow = w; P.neckFwd = 8 * w; P.headPitch += 0.18 * w; }
    else if (kind === "refraction") { P.shine = Math.max(P.shine, w); P.headRoll += 0.2 * w; P.fan = lerp(P.fan, 0.95, w); }
    else if (kind === "halo-crush") { P.crown = Math.max(P.crown, w); P.rear = 0.5 * w; P.neckUp = 10 * w; P.headPitch -= 0.2 * w; P.wing = 0.4 * w; }
    else if (kind === "light-relay") { P.wing = 0.8 * w; P.headYaw += 0.25 * w; P.shine = Math.max(P.shine, 0.6 * w); }
    if (cast === "prism-lance") { const a = hit(0.5); P.neckFwd = 26 * a; P.neckUp = -8 * a; P.headPitch += 0.15 * a; if (a > 0.05) { P.look = "glare"; P.mouth = "open"; } }
    else if (cast === "fan-display") { const a = hit(0.9); P.fan = lerp(P.fan, 1.1, a); P.wing = 0.7 * a; P.shine = Math.max(P.shine, a); if (a > 0.05) { P.look = "closed"; P.mouth = "open"; } }
    else if (cast === "glare") { const a = hit(0.7); P.eyeGlow = a; P.neckFwd = 10 * a; if (a > 0.05) P.look = "glare"; }
    else if (cast === "refraction") { const a = hit(0.7); P.shine = Math.max(P.shine, a); P.fan = lerp(P.fan, 1, a); if (a > 0.05) P.look = "glare"; }
    else if (cast === "halo-crush") { const a = hit(0.5); P.crown = Math.max(P.crown, a); P.neckFwd = 14 * a; P.neckUp = -12 * a; P.headPitch += 0.3 * a; if (a > 0.05) { P.look = "glare"; P.mouth = "open"; } }
    else if (cast === "light-relay") { const a = hit(0.7); P.wing = 0.9 * a; P.shine = Math.max(P.shine, a); if (a > 0.05) { P.look = "glare"; P.mouth = "open"; } }
    const roar = after(c.roarAge === undefined ? 99 : c.roarAge, 1.1);
    if (roar > 0.05) { P.fan = lerp(P.fan, 1.1, roar); P.wing = 0.7 * roar; P.neckUp = 8 * roar; P.headPitch -= 0.22 * roar; P.look = "glare"; P.mouth = "open"; }
    if (c.exposed && !c.stagger) { P.look = "wide"; P.mouth = "open"; P.fan = 0.3; P.neckUp = -6; }
    if (c.stagger) { P.look = "dizzy"; P.mouth = "open"; P.stars = 1; P.headRoll = Math.sin(c.clock * 3) * 0.32 * m + (m ? 0 : 0.2); P.headYaw = 0; P.neckUp = -12; P.neckFwd = 6; P.fan = 0.3; P.blink = false; }
    if ((c.hurt || 0) > 0.3 && !c.dead) { P.look = "hurt"; P.mouth = "open"; P.neckFwd -= 8 * c.hurt; P.headRoll += 0.16 * c.hurt; P.blink = false; }
    if (c.dead) {
      const d = smooth(0, 0.9, c.deadAge === undefined ? 9 : c.deadAge);
      P.sink = d; P.fan = lerp(P.fan, 0.15, d); P.neckUp = -40 * d; P.neckFwd = 16 * d; P.headRoll = 0.4 * d; P.headYaw = 0; P.headPitch = 0.25 * d; P.look = "closed"; P.mouth = "closed"; P.blink = false; P.shine = 0.03; P.crown = 0; P.bob = 0;
    }
    return P;
  }

  // ════════════════════════ the body ════════════════════════
  const SHARDS = 9;
  function prismaPlacements(P, yaw, phase, prev) {
    const list = [], add = adder(list, () => P.alpha);
    const t = P.t;
    const base = 58 + P.bob - P.sink * 30;
    const pose = (p) => { // rear up about the hips, then turn
      const c = Math.cos(P.rear * 0.5), s = Math.sin(P.rear * 0.5);
      const dz = p.z + 10, dy = p.y + 14;
      return rotY({ x: p.x, y: base - 14 + dz * s + dy * c, z: -10 + dz * c - dy * s }, yaw);
    };
    const body = pose({ x: 0, y: 0, z: 0 });
    add("body", "body", body, {});
    add("brooch", "brooch", pose({ x: 0, y: 2, z: 25 }), { bias: 3 });
    // the fan: shards radiating behind the body, leaning back
    const root = pose({ x: 0, y: 4, z: -20 });
    for (let i = 0; i < SHARDS; i++) {
      const u = i / (SHARDS - 1) - 0.5;
      const a = u * 2 * 104 * DEG * clamp(P.fan, 0.1, 1.15);
      const L = 104 - Math.abs(u) * 30;
      const tip = pose({ x: Math.sin(a) * L, y: 4 + Math.cos(a) * L * 0.92, z: -20 - 34 - (1 - P.fan) * 30 });
      const o = along(root, tip, 100, 0.34, 1.12);
      add("shard" + i, "shard" + (i % 3), root, { ...o, bias: -8 - Math.abs(u) });
      if (P.shine > 0.05) add("shine" + i, "glow_prism", { x: (root.x + tip.x * 2) / 3, y: (root.y + tip.y * 2) / 3, z: (root.z + tip.z * 2) / 3 }, { glow: true, alpha: P.shine * (0.4 + 0.3 * Math.sin(t * 5 + i)), sx: 1.4, sy: 1.4, bias: -7 });
    }
    // wings: folded along the flank, or lifted out to the side
    for (const s of [-1, 1]) {
      const sh = pose({ x: s * 20, y: 8, z: 2 });
      const k = P.wing;
      const tip = pose({ x: s * lerp(27, 84, k), y: 8 + lerp(-22, 26, k), z: 2 + lerp(-44, -14, k) });
      add("wing" + s, "wing", sh, { ...along(sh, tip, 56, 0.5, 1.5), bias: 1.2 });
    }
    // legs: standing on the floor
    for (const s of [-1, 1]) {
      const hip = pose({ x: s * 10, y: -18, z: -2 });
      const foot = rotY({ x: s * 11, y: 0, z: 2 }, yaw);
      const a = project(hip), b = project(foot);
      list.push({ line: [a, { x: (a.x + b.x) / 2 + Math.sin(yaw) * 3, y: (a.y + b.y) / 2 }, b], color: "#7a4a06", width: 4.2, z: depth(hip) - 3, alpha: P.alpha });
      list.push({ line: [a, { x: (a.x + b.x) / 2 + Math.sin(yaw) * 3, y: (a.y + b.y) / 2 }, b], color: "#f2b52a", width: 2.4, z: depth(hip) - 2.9, alpha: P.alpha });
      add("foot" + s, "foot", foot, { sx: Math.cos(yaw) < 0 ? -1 : 1, bias: depth(hip) - 2.8 - depth(foot) });
    }
    // the neck: an S from the breast up to the head
    const n0 = { x: 0, y: 14, z: 16 }, n2 = { x: 0, y: 66 + P.neckUp, z: 24 + P.neckFwd };
    const n1 = { x: 0, y: 46 + P.neckUp * 0.4, z: 0 + P.neckFwd * 0.2 }, n15 = { x: 0, y: 70 + P.neckUp, z: 6 + P.neckFwd * 0.6 };
    const bez = (u) => { const q = 1 - u; const f = (k) => q * q * q * n0[k] + 3 * q * q * u * n1[k] + 3 * q * u * u * n15[k] + u * u * u * n2[k]; return pose({ x: 0, y: f("y"), z: f("z") }); };
    const neck = [];
    for (let i = 0; i <= 9; i++) neck.push(bez(i / 9.6));
    const headW = bez(1);
    const hs = project(headW), hz = depth(headW) + 8;
    const back = Math.min(...neck.map(depth)) - 0.5;
    neck.forEach((w, i) => {
      const k = lerp(1.25, 0.74, Math.pow(i / 9, 1.3));
      add("neck" + i, "neck_f", w, { sx: k, sy: k, bias: Math.min(0, hz - 1 - depth(w)) });
      add("necke" + i, "neck_e", w, { sx: k, sy: k, bias: back - depth(w) });
    });
    const face = FACE.face({ x: hs.x, y: hs.y, yaw: yaw + P.headYaw, pitch: P.headPitch, roll: P.headRoll, z: hz, prevView: prev && prev[0] },
      { look: P.look, mouth: P.mouth, blink: P.blink, eyeGlow: P.eyeGlow });
    for (const f of face.placements) (f.alpha *= P.alpha), list.push(f);
    // the crown, on the crown of the head
    const cr = Math.cos(P.headRoll), sr = Math.sin(P.headRoll), cv = TOP + 2;
    const lean = Math.sin(yaw + P.headYaw) * -0.14 * A;
    const cx = hs.x + lean * cr - cv * sr, cy = hs.y + lean * sr + cv * cr;
    list.push({ key: "crown", piece: "crown", x: cx, y: cy, rot: P.headRoll, sx: 0.78, sy: 0.78, alpha: P.alpha, z: hz + 0.5, glow: false, face: true });
    if (P.crown > 0.02) list.push({ key: "crownglow", piece: "glow_prism", x: cx, y: cy - 12, rot: 0, sx: 1.3, sy: 1.3, alpha: P.crown, z: hz + 0.6, glow: true });
    if (P.stars) KIT.stars(list, hs, hz, t, A * 2.3, 20);
    list.sort((p, q) => p.z - q.z);
    return { placements: list, heads: [{ x: hs.x, y: hs.y, view: face.view, side: face.side, guide: face.guide, marks: face.marks }], shadows: [[0, 0, 50, 14]] };
  }

  // ════════════════════════ the pieces (drawn once) ════════════════════════
  const PAL = {
    1: { cream: { edge: "#8a6a3a", light: "#fffdf2", base: "#fbedcc", dark: "#e6c994", rim: "#ffffff" }, teal: ["#7fe6d6", "#22b3a6", "#0f7f86"], tealEdge: "#0b4f5c", gold: ["#fff0a0", "#f4c234", "#c98a14"], ink: "#101826", iris: ["#0f8f8f", "#2fd0c4", "#a8fff0"], brow: "#0f6f76" },
    2: { cream: { edge: "#8a6a3a", light: "#ffffff", base: "#fdf1d6", dark: "#ecd2a0", rim: "#ffffff" }, teal: ["#8ff0e6", "#22c0c0", "#0d8292"], tealEdge: "#0a4a60", gold: ["#fff4b0", "#f8cc40", "#d09218"], ink: "#101826", iris: ["#0f9aa0", "#40dcd4", "#c0fff6"], brow: "#0d6a7a" },
    3: { cream: { edge: "#8a6a3a", light: "#ffffff", base: "#fff2dc", dark: "#f0d4a8", rim: "#ffffff" }, teal: ["#a0f6f0", "#28c8d4", "#0e80a0"], tealEdge: "#0a4468", gold: ["#fff8c0", "#ffd650", "#d89a1c"], ink: "#101826", iris: ["#10a0b0", "#50e6e0", "#d6fffa"], brow: "#0c6480" },
  };
  function headPiece(view, pal) {
    return pieceOf("head_" + view, 3.4 * A, 3.2 * A, 0.5, 0.56, (c) => {
      const faceSide = view === "front" || view === "tq" || view === "side";
      // a short teal crest swept back from the nape, behind the skull
      const crest = new Path2D();
      const F = (x, y, deg, len, w, bend) => tuft(crest, x * A, y * A, deg * DEG, len * A, w * A, bend);
      if (view === "front" || view === "back") for (const s of [-1, 1]) F(s * 0.3, -0.7, -90 - s * 34, 0.34, 0.1, -s * 0.2);
      else { const k = 1; F(-k * 0.5, -0.6, 90 + k * 115, 0.58, 0.13, k * 0.22); F(-k * 0.72, -0.32, 90 + k * 100, 0.5, 0.12, k * 0.2); F(-k * 0.8, 0.0, 90 + k * 88, 0.36, 0.1, k * 0.18); }
      c.strokeStyle = pal.tealEdge; c.lineWidth = 1.3; c.stroke(crest);
      c.fillStyle = grad(c, 0, -1.2 * A, 0, 0.4 * A, pal.teal); c.fill(crest);
      const pts = [];
      for (let v = TOP; v <= BOT; v += 0.5) pts.push({ x: skullEdge(view, v)[1], y: v });
      for (let v = BOT; v >= TOP; v -= 0.5) pts.push({ x: skullEdge(view, v)[0], y: v });
      const path = new Path2D();
      // smooth feathers: only the faintest fringe, none along the brow and beak base
      furPath(path, pts, { seed: 3 + view.length, tooth: 4, depth: 0.25, mask: (x) => ((view === "side" || view === "tq") && x > 0 ? 0 : 1) });
      paintSoft(c, path, pal.cream, TOP - 2, BOT + 4, {
        edge: 1.4, rimAlpha: 0.5,
        inside: (cc) => {
          // the teal cap over the crown, running down the back of the head into the neck
          const cap = (x, y, rx, ry) => { cc.save(); cc.translate(x, y); cc.fillStyle = radial(cc, 0, 0, 0, rx, [[0, pal.teal[0]], [0.72, pal.teal[1]], [1, pal.teal[1] + "00"]]); cc.scale(1, ry / rx); cc.beginPath(); cc.arc(0, 0, rx, 0, TAU); cc.fill(); cc.restore(); };
          if (!faceSide) { cap(0, -0.3 * A, 1.0 * A, 1.1 * A); return; }
          if (view === "front") cap(0, -0.96 * A, 0.95 * A, 0.6 * A);
          else if (view === "tq") { cap(-0.36 * A, -0.92 * A, 0.95 * A, 0.6 * A); cap(-1.0 * A, -0.1 * A, 0.55 * A, 0.95 * A); }
          else { cap(-0.42 * A, -0.92 * A, 0.95 * A, 0.6 * A); cap(-0.95 * A, -0.1 * A, 0.6 * A, 1.0 * A); }
          // a fine liner of feathers from the eye back towards the nape (as in the art)
          if (view !== "front") { cc.strokeStyle = pal.teal[2]; cc.globalAlpha = 0.5; cc.lineWidth = 0.8; cc.beginPath(); cc.moveTo(-0.1 * A, LINES.eye + 0.5); cc.quadraticCurveTo(-0.45 * A, LINES.eye - 0.5, -0.7 * A, LINES.eye + 1.5); cc.stroke(); cc.globalAlpha = 1; }
        },
      });
    });
  }
  function eyePiece(view, look, pal) {
    return pieceOf(`eye_${view}_${look}`, 20, 18, 0.5, 0.5, (c) => {
      const { hw, hh } = EYE[view], g = eyeGeom(view, look), face = view === "far" ? -1 : 1;
      if (view === "far") c.scale(-1, 1);
      drawEye(c, {
        hw, hh, ink: pal.ink, weight: 1.5,
        look: look === "hurt" || look === "dizzy" || look === "closed" ? look : "open",
        lid: look === "idle" ? [-0.55, -0.25] : look === "glare" ? [-0.45, 0.2] : null, bow: look === "glare" ? 0.35 : 0.7,
        sclera: ["#ffffff", "#f2fbff", "#cfe6ee"], shade: "rgba(20,90,110,0.45)", spiral: "#0f7f86",
        iris: { x: g.gx * face, y: g.gy, r: g.r, ring: "#0a4a56", stops: pal.iris, pupil: "#06181e", pupilR: 0.45 },
      });
    });
  }
  function beakPiece(view, open, pal) {
    return pieceOf(`beak_${view}_${open ? "open" : "closed"}`, 1.8 * A, 1.5 * A, 0.36, 0.3, (c) => {
      const a = A, drop = open ? 0.2 * a : 0;
      c.strokeStyle = "#7a4a06";
      c.lineWidth = 0.95;
      const part = (pts) => { c.beginPath(); pts(); c.closePath(); c.fillStyle = grad(c, 0, -0.2 * a, 0, 0.4 * a, ["#ffe39a", "#f6a92e", "#d0701a"]); c.fill(); c.stroke(); };
      const mouth = (pts) => { c.beginPath(); pts(); c.closePath(); c.fillStyle = "#a02c3c"; c.fill(); c.stroke(); };
      if (view === "front") {
        if (open) mouth(() => { c.moveTo(-0.15 * a, 0); c.lineTo(0.15 * a, 0); c.lineTo(0.07 * a, 0.42 * a); c.lineTo(-0.07 * a, 0.42 * a); });
        part(() => { c.moveTo(-0.1 * a, 0.18 * a + drop); c.quadraticCurveTo(0, 0.22 * a + drop, 0.1 * a, 0.18 * a + drop); c.quadraticCurveTo(0.04 * a, 0.3 * a + drop, 0, 0.32 * a + drop); c.quadraticCurveTo(-0.04 * a, 0.3 * a + drop, -0.1 * a, 0.18 * a + drop); });
        part(() => { c.moveTo(-0.17 * a, -0.14 * a); c.quadraticCurveTo(0, -0.24 * a, 0.17 * a, -0.14 * a); c.quadraticCurveTo(0.12 * a, 0.16 * a, 0, 0.36 * a); c.quadraticCurveTo(-0.12 * a, 0.16 * a, -0.17 * a, -0.14 * a); });
        c.strokeStyle = "rgba(255,252,220,0.9)"; c.beginPath(); c.moveTo(0, -0.14 * a); c.lineTo(0, 0.2 * a); c.stroke();
        return;
      }
      // short and strong, the upper mandible arching over into a small hook
      const L = view === "side" ? 0.62 * a : 0.46 * a, b = view === "side" ? -0.06 * a : -0.16 * a, d = 0.17 * a;
      if (open) mouth(() => { c.moveTo(b, 0.02 * a); c.lineTo(b + L * 0.8, 0.12 * a); c.lineTo(b + L * 0.6, 0.18 * a + drop); c.lineTo(b, 0.16 * a + drop * 0.6); });
      part(() => { c.moveTo(b, 0.1 * a + drop * 0.5); c.quadraticCurveTo(b + L * 0.45, 0.13 * a + drop, b + L * 0.7, 0.16 * a + drop * 1.1); c.quadraticCurveTo(b + L * 0.4, 0.24 * a + drop, b - 0.02 * a, 0.22 * a + drop * 0.6); });
      part(() => { c.moveTo(b, -0.16 * a); c.bezierCurveTo(b + L * 0.5, -0.2 * a, b + L * 0.95, -0.08 * a, b + L, d); c.quadraticCurveTo(b + L * 0.86, d * 0.82, b + L * 0.78, 0.12 * a); c.quadraticCurveTo(b + L * 0.4, 0.11 * a, b, 0.11 * a); });
      c.strokeStyle = "rgba(255,248,210,0.85)"; c.beginPath(); c.moveTo(b + 1.2, -0.11 * a); c.quadraticCurveTo(b + L * 0.55, -0.13 * a, b + L * 0.85, -0.01 * a); c.stroke();
      c.fillStyle = "#7a4a06"; c.beginPath(); c.arc(b + L * 0.28, -0.05 * a, 0.55, 0, TAU); c.fill();
    });
  }
  /** A crystal: a long faceted shard along +x, in a gold setting. */
  function shardPiece(i, pal) {
    const cols = [["#bff6ff", "#6fb6ff", "#5a7cf2", "#b9a0ff"], ["#ffe6fb", "#d7a8ff", "#8f8cf6", "#7fd8ff"], ["#fffbd0", "#ffd65a", "#f2a83a", "#ffe9a0"]][i];
    return pieceOf("shard" + i, 124, 40, 0.06, 0.5, (c) => {
      const p = new Path2D();
      p.moveTo(0, 0); p.lineTo(22, -12); p.lineTo(82, -15); p.lineTo(108, 0); p.lineTo(82, 15); p.lineTo(22, 12); p.closePath();
      c.strokeStyle = "#b9861a"; c.lineWidth = 3.2; c.stroke(p);
      c.fillStyle = grad(c, 0, 0, 108, 0, cols); c.fill(p);
      c.save(); c.clip(p);
      c.fillStyle = "rgba(255,255,255,0.55)"; // facets
      c.beginPath(); c.moveTo(22, -12); c.lineTo(82, -15); c.lineTo(108, 0); c.lineTo(52, -3); c.closePath(); c.fill();
      c.fillStyle = "rgba(40,40,140,0.18)";
      c.beginPath(); c.moveTo(22, 12); c.lineTo(82, 15); c.lineTo(108, 0); c.lineTo(52, 3); c.closePath(); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 1;
      c.beginPath(); c.moveTo(4, 0); c.lineTo(52, -3); c.lineTo(108, 0); c.moveTo(52, -3); c.lineTo(82, -15); c.moveTo(52, 3); c.lineTo(82, 15); c.moveTo(52, -3); c.lineTo(52, 3); c.stroke();
      c.restore();
      c.strokeStyle = "#ffe9a0"; c.lineWidth = 1; c.stroke(p);
    });
  }
  function prismaPieces(phase) {
    const pal = PAL[phase] || PAL[1];
    const list = [];
    for (const v of ["front", "tq", "side", "backtq", "back"]) list.push(headPiece(v, pal));
    for (const v of ["front", "near", "far", "side"]) {
      for (const l of LOOKS) list.push(eyePiece(v, l, pal));
      for (const k of Object.keys(BROWS)) list.push(pieceOf(`brow_${v}_${k}`, 12, 8, 0.5, 0.5, (c) => { if (v === "far") c.scale(-1, 1); const s = BROWS[k]; drawBrow(c, { front: 5, near: 5, far: 3.4, side: 4.6 }[v] / 2, [s[0] * 0.55, s[1] * 0.55, s[2] * 0.5, s[3] * 0.6], pal.brow, Math.min(0.7, s[4] * 0.8 + 0.1)); }));
    }
    for (const v of ["front", "tq", "side"]) list.push(beakPiece(v, false, pal), beakPiece(v, true, pal));
    for (let i = 0; i < 3; i++) list.push(shardPiece(i, pal));
    const disc = (r) => { const p = new Path2D(); p.ellipse(0, 0, r, r, 0, 0, TAU); return p; };
    list.push(
      pieceOf("crown", 34, 34, 0.5, 0.94, (c) => {
        const gem = (x, y, h, w) => {
          c.strokeStyle = pal.gold[1]; c.lineWidth = 2.2; c.beginPath(); c.moveTo(0, -3); c.lineTo(x, y + h * 0.4); c.stroke();
          c.beginPath(); c.moveTo(x, y - h); c.lineTo(x + w, y); c.lineTo(x, y + h * 0.6); c.lineTo(x - w, y); c.closePath();
          c.fillStyle = grad(c, x - w, y - h, x + w, y + h, ["#f2fdff", "#8fd0ff", "#5a8cf0"]); c.fill();
          c.strokeStyle = pal.gold[1]; c.lineWidth = 1.5; c.stroke();
          c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x, y - h); c.lineTo(x, y + h * 0.6); c.stroke();
        };
        gem(-9, -16, 6, 3.4); gem(9, -16, 6, 3.4); gem(0, -22, 8.5, 4.4);
        c.beginPath(); c.moveTo(-7, 0); c.lineTo(-5.5, -7); c.lineTo(0, -4.5); c.lineTo(5.5, -7); c.lineTo(7, 0); c.closePath();
        c.fillStyle = grad(c, 0, -7, 0, 0, pal.gold); c.fill(); c.strokeStyle = "#8a5a0a"; c.lineWidth = 1; c.stroke();
      }),
      pieceOf("neck_f", 20, 20, 0.5, 0.5, (c) => { c.fillStyle = pal.cream.base; c.fill(disc(7.6)); }),
      pieceOf("neck_e", 22, 22, 0.5, 0.5, (c) => { c.fillStyle = pal.cream.edge; c.fill(disc(9)); }),
      pieceOf("body", 76, 76, 0.5, 0.5, (c) => {
        const pts = [];
        for (let i = 0; i < 60; i++) { const a = (i / 60) * TAU; pts.push({ x: Math.cos(a) * 27, y: Math.sin(a) * 28 }); }
        const path = new Path2D();
        furPath(path, pts, { seed: 8, tooth: 7, depth: 2.2, mask: (x, y) => (y > 0 ? 1 : 0.3) });
        paintSoft(c, path, pal.cream, -29, 30, { edge: 1.8, strands: 40, x0: -24, x1: 24, seed: 12 });
      }),
      pieceOf("brooch", 22, 28, 0.5, 0.5, (c) => {
        c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 0); c.lineTo(0, 12); c.lineTo(-8, 0); c.closePath();
        c.fillStyle = grad(c, -8, -11, 8, 12, ["#f2fdff", "#7fc4ff", "#4a7cec"]); c.fill();
        c.strokeStyle = pal.gold[1]; c.lineWidth = 2.4; c.stroke();
        c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 0.9; c.beginPath(); c.moveTo(0, -11); c.lineTo(0, 12); c.moveTo(-8, 0); c.lineTo(8, 0); c.stroke();
      }),
      pieceOf("wing", 78, 56, 0.08, 0.32, (c) => {
        // layered feathers along +x: cream coverts, teal secondaries, gold-tipped primaries
        for (const [reach, len, cols, edge] of [[1, 20, [pal.teal[1], pal.teal[2], pal.gold[1]], pal.tealEdge], [0.74, 16, [pal.teal[0], pal.teal[1], pal.teal[2]], pal.tealEdge], [0.46, 13, [pal.cream.light, pal.cream.base, pal.cream.dark], pal.cream.edge]]) {
          const path = new Path2D();
          for (let i = 0; i < 7; i++) { const u = (i + 0.5) / 7; tuft(path, u * 56 * reach, 0, lerp(1.2, 0.3, u), len * lerp(0.8, 1.2, u), len * 0.3, 0.12); }
          path.moveTo(0, -7); path.quadraticCurveTo(28 * reach, -10, 56 * reach, 0); path.lineTo(0, 6); path.closePath();
          c.strokeStyle = edge; c.lineWidth = 1.3; c.stroke(path);
          c.fillStyle = grad(c, 0, -8, 0, len * 1.2, cols); c.fill(path);
        }
      }),
      pieceOf("foot", 28, 14, 0.5, 0.3, (c) => {
        for (const [dx, dy] of [[-10, 5], [0, 7], [10, 5]]) {
          c.strokeStyle = "#7a4a06"; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(dx, dy); c.stroke();
          c.strokeStyle = "#f2b52a"; c.lineWidth = 2.4; c.stroke();
        }
      }),
      glowPiece("glow_prism", "170,225,255"), KIT.glintPiece(), KIT.starPiece(),
    );
    return list;
  }

  const boss = {
    id: "prismatail",
    title: "Prismatail",
    lede: "A crystal peacock with a swan's head on a long neck: a small, sleek head that slopes into a long gold beak, teal almond eyes set on its sides under a black liner, the beak's base tucking the far eye, and a crown that rides the head.",
    attacks: [["prism-lance", "Prism Lance"], ["fan-display", "Fan Display"], ["glare", "Glare"], ["refraction", "Refraction"], ["halo-crush", "Halo Crush"], ["light-relay", "Light Relay"]],
    pose: prismaPose, placements: prismaPlacements, pieces: prismaPieces, faces: [FACE], looks: LOOKS, mouths: MOUTHS,
    stage: { w: 400, h: 300, ground: 0.86, closeW: 64, closeH: 58, sheetGap: 280, sheetH: 250, closeGap: 60, closeSheetH: 72, champion: [-150, 30], shadow: [50, 14], floor: ["#0a1418", "#12262c", "170,235,255"] },
    occluder: "the beak: its base sits over the far eye's inner corner",
  };
  return { A, SPEC, ATTACKS, LOOKS, MOUTHS, centreLine, skullEdge, boss, prismaPose, prismaPlacements, prismaPieces };
})();
