/*
 * Emberwing as a 2.5D vector rig: a fire phoenix with a round head, a cream
 * face, a flame crest and a hooked gold beak. PURE (see kit.js).
 *
 * The beak is the occluder: at three-quarter its base sits over the far
 * eye's inner corner. The beak is anchored on the centre line at the beak
 * line and has its own drawing per view (a shield from the front, a hook in
 * profile), closed and open.
 */
const EMBER = (() => {
  "use strict";
  const { TAU, DEG, clamp, lerp, smooth, gauss, project, rotY, depth, after, makeFace, drawEye, drawBrow, BROWS, along, pieceOf, tuft, furPath, grad, radial, paintSoft, glowPiece, adder } = KIT;

  // ════════════════════════ the face: construction ════════════════════════
  // A raptor's head: narrower than it is tall, a heavy brow ridge shading the
  // eyes, the cere and a big hooked beak standing out of the profile, the eyes
  // on the sides of the skull and angled forward.
  const A = 24;
  const TOP = -0.88 * A, BOT = 0.8 * A;
  const MID = (TOP + BOT) / 2, HALF = (BOT - TOP) / 2;
  const se = (v) => { const t = clamp(Math.abs((v - MID) / HALF)); const e = v > MID ? 1.9 : 2.9; return Math.pow(1 - Math.pow(t, e), 1 / e); };
  const LINES = { brow: -0.3 * A, eye: -0.07 * A, beak: 0.26 * A };
  /** THE CENTRE LINE: the skull, the brow ridge standing over the eye, then the cere. */
  const centreLine = (v) => A * (0.8 * se(v) + 0.1 * gauss((v - LINES.brow) / A, 0.16) * Math.pow(se(v), 0.5) + 0.2 * gauss((v - LINES.beak) / A, 0.26) * Math.pow(se(v), 0.4));
  const taper = (v) => 1 - 0.16 * smooth(MID, BOT, v);
  function skullEdge(view, v) {
    const s = se(v);
    if (view === "side") return [-0.9 * A * s, centreLine(v)];
    if (view === "tq") return [-0.92 * A * s * taper(v), lerp(0.82 * A * s * taper(v), centreLine(v), 0.5)];
    if (view === "backtq") return [-0.95 * A * s, lerp(0.84 * A * s, centreLine(v), 0.3)];
    return [-0.8 * A * s * taper(v), 0.8 * A * s * taper(v)];
  }
  const EYE = { front: { hw: 5.0, hh: 4.8 }, near: { hw: 5.8, hh: 4.9 }, far: { hw: 3.9, hh: 4.8 }, side: { hw: 5.2, hh: 4.9 } };
  const LOOKS = ["idle", "glare", "wide", "hurt", "dizzy", "closed"];
  const MOUTHS = ["closed", "open"];
  const BROW = { idle: "angry", glare: "angry", wide: "raised", hurt: "pinch", dizzy: "raised", closed: "calm" };
  const eyeGeom = (v, look) => ({ r: look === "wide" ? 2.6 : 3.2, gx: v === "far" ? 0.2 : v === "front" ? 0.9 : 1.1, gy: look === "wide" ? 0.2 : look === "glare" ? 1.4 : 0.9 });
  const SPEC = {
    A, top: TOP, bot: BOT, lines: LINES,
    eyeAz: 52 * DEG, eyeOrbit: 0.74 * A, lag: 12 * DEG, farLift: 6 * DEG, nod: 0.42 * A, margin: 0.05 * A,
    eye: EYE, eyeGeom, centreLine, skullEdge,
    tuckCap: 0.35, bridgeHalf: 0.5,
    headPiece: (view) => "head_" + view,
    lit: (look) => look === "idle" || look === "glare" || look === "wide", eyeGlowPiece: "glow_fire",
    glint: (look) => look === "idle" || look === "glare" || look === "wide", glintR: 4.6,
    brow: (look) => ({ kind: BROW[look], dy: look === "glare" ? 2 : look === "wide" ? -1.2 : 1.1, dx: 0.6 }),
    centre: [
      // the beak: under the near eye at three-quarter so its base tucks the far eye's corner
      { id: "beak", line: LINES.beak, sideInset: 1.5, layer: (v) => (v === "tq" ? "mid" : "top"), piece: (v, e) => `beak_${v}_${e.mouth === "open" ? "open" : "closed"}` },
    ],
  };
  const FACE = makeFace(SPEC);

  // ════════════════════════ the pose ════════════════════════
  const ATTACKS = ["dive-bomb", "ember-rain", "wing-gust", "flame-ring", "scorched-earth", "heat-mark"];
  function emberPose(c) {
    const t = c.reduced ? 0 : c.clock, m = c.reduced ? 0 : 1;
    const beat = Math.sin(t * 3.2);
    const P = {
      t, lift: Math.sin(t * 3.2 - 1) * 5 * m, pitch: 0, wing: 0.75 + beat * 0.28 * m, sweep: 0, tail: 0, tuck: 0.6,
      headYaw: (Math.sin(t * 0.8) * 0.16 + Math.sin(t * 2.3) * 0.04) * m, headPitch: Math.sin(t * 1.5) * 0.06 * m, headRoll: Math.sin(t * 1.1 + 1) * 0.05 * m,
      look: "idle", mouth: "closed", blink: m && t % 3.4 > 3.28, eyeGlow: 0.2 + (c.phase - 1) * 0.16, flare: (c.phase - 1) * 0.3, alpha: 1, stars: 0, drop: 0,
    };
    const w = clamp(c.windup || 0), kind = c.windKind, cast = c.castKind, age = c.castAge === undefined ? 99 : c.castAge;
    const hit = (d) => after(age, d);
    if (kind) P.look = "glare";
    if (kind === "dive-bomb") { P.lift += 26 * w; P.wing = lerp(P.wing, 1.25, w); P.pitch = 0.25 * w; P.headPitch += 0.2 * w; }
    else if (kind === "ember-rain") { P.wing = lerp(P.wing, 1.15, w); P.headPitch -= 0.3 * w; P.mouth = w > 0.5 ? "open" : "closed"; P.flare = Math.max(P.flare, w); }
    else if (kind === "wing-gust") { P.wing = lerp(P.wing, 1.3, w); P.sweep = -0.5 * w; P.pitch = -0.15 * w; }
    else if (kind === "flame-ring") { P.wing = lerp(P.wing, 0.35, w); P.flare = Math.max(P.flare, w); P.tail = w; }
    else if (kind === "scorched-earth") { P.lift -= 18 * w; P.wing = lerp(P.wing, 0.3, w); P.pitch = 0.2 * w; P.headPitch += 0.15 * w; }
    else if (kind === "heat-mark") { P.eyeGlow = lerp(P.eyeGlow, 1, w); P.headPitch += 0.12 * w; P.wing = lerp(P.wing, 0.9, w); }
    if (cast === "dive-bomb") { const a = hit(0.55); P.lift -= 30 * a; P.wing = lerp(P.wing, 1.1, a); P.sweep = 0.9 * a; P.pitch = 0.45 * a; P.headPitch += 0.2 * a; if (a > 0.05) { P.look = "glare"; P.mouth = "open"; } }
    else if (cast === "ember-rain") { const a = hit(0.8); P.wing = lerp(P.wing, 1.2, a); P.headPitch -= 0.3 * a; P.flare = Math.max(P.flare, a); if (a > 0.05) { P.look = "glare"; P.mouth = "open"; } }
    else if (cast === "wing-gust") { const a = hit(0.45); P.wing = lerp(1.3, -0.05, clamp(age / 0.2)); P.sweep = 0.6 * a; if (a > 0.05) { P.look = "glare"; P.mouth = "open"; } if (age > 0.6) P.wing = 0.75 + beat * 0.28; }
    else if (cast === "flame-ring") { const a = hit(0.7); P.wing = lerp(P.wing, 1.1, a); P.flare = Math.max(P.flare, a); P.tail = a; if (a > 0.05) { P.look = "glare"; P.mouth = "open"; } }
    else if (cast === "scorched-earth") { const a = hit(0.7); P.lift -= 20 * a; P.wing = lerp(P.wing, 0.25, a); P.sweep = 0.5 * a; P.pitch = 0.25 * a; if (a > 0.05) { P.look = "glare"; P.mouth = "open"; } }
    else if (cast === "heat-mark") { const a = hit(0.6); P.eyeGlow = Math.max(P.eyeGlow, a); if (a > 0.05) P.look = "glare"; }
    const roar = after(c.roarAge === undefined ? 99 : c.roarAge, 1.1);
    if (roar > 0.05) { P.wing = lerp(P.wing, 1.25, roar); P.headPitch -= 0.25 * roar; P.look = "glare"; P.mouth = "open"; P.flare = Math.max(P.flare, roar); }
    if (c.exposed && !c.stagger) { P.look = "wide"; P.mouth = "open"; P.wing = 0.15; P.drop = 0.5; }
    if (c.stagger) { P.look = "dizzy"; P.mouth = "open"; P.stars = 1; P.headRoll = Math.sin(c.clock * 3) * 0.3 * m + (m ? 0 : 0.2); P.headYaw = 0; P.wing = 0.05 + Math.sin(c.clock * 5) * 0.06 * m; P.drop = 0.75; P.blink = false; }
    if ((c.hurt || 0) > 0.3 && !c.dead) { P.look = "hurt"; P.mouth = "open"; P.headPitch -= 0.2 * c.hurt; P.headRoll += 0.14 * c.hurt; P.blink = false; }
    if (c.dead) {
      const d = smooth(0, 0.9, c.deadAge === undefined ? 9 : c.deadAge);
      P.drop = d * 1.05; P.wing = lerp(P.wing, -0.2, d); P.headRoll = 0.3 * d; P.headYaw = 0; P.headPitch = 0.2 * d; P.look = "closed"; P.mouth = "closed"; P.blink = false; P.lift *= 1 - d; P.eyeGlow = 0; P.flare = 0; P.tuck = 0;
    }
    return P;
  }

  // ════════════════════════ the body ════════════════════════
  function emberPlacements(P, yaw, phase, prev) {
    const list = [], add = adder(list, () => P.alpha);
    const t = P.t;
    const base = 82 + P.lift - P.drop * 52;
    const pose = (p) => { // pitch about the body's centre (nose down is +), then turn
      const c = Math.cos(P.pitch), s = Math.sin(P.pitch);
      return rotY({ x: p.x, y: base + p.y * c - p.z * s, z: p.z * c + p.y * s }, yaw);
    };
    const body = pose({ x: 0, y: 0, z: 0 });
    add("body", "body", body, {});
    add("chest", "chest", pose({ x: 0, y: 0, z: 17 }), { sx: 0.85, sy: 0.85, bias: 4 });
    // Wings: out, up and swept back; the flap is the raise angle. From the
    // side a wing is shown broadside (never squeezed to a sliver): the near
    // wing lies over the body, and the far wing takes the near wing's line,
    // a little more raised, behind the body.
    const sinY = Math.sin(yaw), sideOn = smooth(0.62, 0.95, Math.abs(sinY)); // only near profile: at three-quarter each wing stays on its own side
    const wings = [-1, 1].map((s) => {
      const sh = pose({ x: s * 20, y: 14, z: -3 });
      const r = P.wing + Math.sin(t * 3.2 + s * 0.2) * 0.02, sw = 0.6 + P.sweep * 0.8;
      const d = { x: s * Math.cos(r) * Math.cos(sw), y: Math.sin(r), z: -Math.cos(r) * Math.sin(sw) - 0.15 };
      const tip = pose({ x: s * 20 + d.x * 112, y: 14 + d.y * 112, z: -3 + d.z * 112 });
      return { s, sh, o: along(sh, tip, 112, 0.66, 1.05), near: -s * sinY > 0 };
    });
    const nearW = wings.find((w) => w.near) || wings[0];
    for (const w of wings) {
      let { rot, sx, sy } = w.o, bias = -1.5;
      if (sideOn > 0) {
        if (w.near) bias = lerp(-1.5, 5, sideOn);
        else {
          const want = nearW.o.rot + 0.32 * Math.sign(sinY);
          rot += Math.atan2(Math.sin(want - rot), Math.cos(want - rot)) * sideOn;
          sx = lerp(sx, nearW.o.sx * 0.94, sideOn);
          if (sideOn > 0.5) sy = nearW.o.sy;
          bias = lerp(-1.5, -7, sideOn);
        }
      }
      // at three-quarter the far wing would stand straight up behind the head
      // (the camera looks down its length): lean it out to its own side
      if (!w.near) {
        const tq = (1 - sideOn) * smooth(0.2, 0.6, Math.abs(sinY));
        rot += 0.42 * Math.sign(sinY) * tq;
        sx *= 1 - 0.1 * tq;
      }
      add("wing" + w.s, "wing", w.sh, { rot, sx, sy, bias });
    }
    // tail plumes, trailing behind and below
    for (let i = -2; i <= 2; i++) {
      const root = pose({ x: i * 5, y: -12, z: -24 });
      const sway = Math.sin(t * 2.6 + i * 0.8) * 7;
      const tip = pose({ x: i * (24 + P.tail * 16) + sway, y: -12 - 26 + Math.abs(i) * 6 + P.tail * 22, z: -24 - 78 + Math.abs(i) * 10 });
      add("plume" + i, "plume", root, { ...along(root, tip, 82, 0.5, 1.1), bias: -3 - Math.abs(i) * 0.1 });
    }
    for (const s of [-1, 1]) add("leg" + s, "leg", pose({ x: s * 11, y: -20, z: 6 + P.tuck * 4 }), { sx: s * (Math.cos(yaw) < 0 ? -1 : 1), sy: 1 - 0.3 * P.tuck, rot: P.tuck * 0.25 * s, bias: 1 });
    if (P.flare > 0.02) add("aura", "glow_fire", body, { glow: true, alpha: P.flare * 0.8, sx: 5.5, sy: 4.4, bias: -12 });
    // head
    const headW = pose({ x: 0, y: 36, z: 13 });
    const hs = project(headW), hz = depth(headW) + 8;
    const face = FACE.face({ x: hs.x, y: hs.y, yaw: yaw + P.headYaw, pitch: P.headPitch + P.pitch * 0.4, roll: P.headRoll, z: hz, prevView: prev && prev[0] },
      { look: P.look, mouth: P.mouth, blink: P.blink, eyeGlow: P.eyeGlow });
    for (const f of face.placements) (f.alpha *= P.alpha), list.push(f);
    if (P.stars) KIT.stars(list, hs, hz, t, A * 1.7, 26);
    list.sort((p, q) => p.z - q.z);
    return { placements: list, heads: [{ x: hs.x, y: hs.y, view: face.view, side: face.side, guide: face.guide, marks: face.marks }], shadows: [[0, 0, 56 - P.lift * 0.3, 15]] };
  }

  // ════════════════════════ the pieces (drawn once) ════════════════════════
  const PAL = {
    1: { light: "#ffb23c", base: "#f6781c", dark: "#d8431a", edge: "#7a1d0b", rim: "#ffe07a", cream: ["#fffaf0", "#fde8ba", "#f1c88a"], tip: "#ffe65a", crest: ["#ffe66a", "#ff9a26", "#e2371c"], ink: "#2a0d08", brow: "#8a2a10" },
    2: { light: "#ffbe3e", base: "#fa6a16", dark: "#d23614", edge: "#701608", rim: "#fff08a", cream: ["#fffaf0", "#ffe6b0", "#f4c07c"], tip: "#fff06a", crest: ["#fff27a", "#ff8a1c", "#dc2a14"], ink: "#2a0d08", brow: "#8a2410" },
    3: { light: "#ffc94a", base: "#ff5a10", dark: "#c8220e", edge: "#660e06", rim: "#fff8a8", cream: ["#fffbea", "#ffe0a0", "#f6b468"], tip: "#fffa8a", crest: ["#fffc9a", "#ff7a14", "#d01c10"], ink: "#2a0a06", brow: "#801c0c" },
  };
  const feather = (pal) => ({ edge: pal.edge, light: pal.light, base: pal.base, dark: pal.dark, rim: pal.rim });
  function headPiece(view, pal) {
    return pieceOf("head_" + view, 3.4 * A, 3.7 * A, 0.5, 0.6, (c) => {
      const faceSide = view === "front" || view === "tq" || view === "side";
      // the flame crest, behind the skull
      const crest = new Path2D();
      const F = (x, y, deg, len, w, bend) => tuft(crest, x * A, y * A, deg * DEG, len * A, w * A, bend);
      if (view === "front" || view === "back") { F(-0.42, -0.72, -112, 0.62, 0.17, -0.25); F(-0.18, -0.84, -100, 0.86, 0.2, -0.22); F(0.08, -0.88, -86, 1.12, 0.22, 0.25); F(0.34, -0.8, -72, 0.74, 0.18, 0.28); F(0.56, -0.62, -60, 0.5, 0.15, 0.3); }
      else { const k = view === "backtq" ? -1 : 1; F(k * 0.2, -0.84, -90 - k * 14, 0.7, 0.18, -k * 0.25); F(-k * 0.04, -0.88, -90 - k * 26, 1.05, 0.22, -k * 0.3); F(-k * 0.3, -0.84, -90 - k * 42, 0.9, 0.2, -k * 0.3); F(-k * 0.56, -0.7, -90 - k * 58, 0.66, 0.17, -k * 0.3); }
      c.strokeStyle = pal.edge; c.lineWidth = 1.8; c.stroke(crest);
      c.fillStyle = grad(c, 0, -2.0 * A, 0, -0.7 * A, pal.crest); c.fill(crest);
      // the skull, with its feather fringe and cheek tufts
      const pts = [];
      for (let v = TOP; v <= BOT; v += 1) pts.push({ x: skullEdge(view, v)[1], y: v });
      for (let v = BOT; v >= TOP; v -= 1) pts.push({ x: skullEdge(view, v)[0], y: v });
      const path = new Path2D();
      furPath(path, pts, { seed: 5 + view.length, tooth: 5, depth: 0.75, mask: (x, y) => ((view === "side" || view === "tq") && x > 0.3 * A && y > TOP * 0.6 ? 0.1 : 1) });
      const T = (x, y, deg, len, w, bend) => tuft(path, x * A, y * A, deg * DEG, len * A, w * A, bend);
      if (view === "front" || view === "back") for (const s of [-1, 1]) { T(s * 0.92, 0.1, 90 - s * 70, 0.34, 0.13, s * 0.25); T(s * 0.9, 0.3, 90 - s * 54, 0.4, 0.14, s * 0.22); T(s * 0.76, 0.5, 90 - s * 36, 0.3, 0.12, s * 0.2); }
      else if (view === "tq" || view === "backtq") { const k = view === "tq" ? -1 : 1; T(k * 0.94, 0.1, 90 + k * -72, 0.36, 0.13, k * 0.25); T(k * 0.9, 0.32, 90 - k * 54, 0.42, 0.14, k * 0.22); T(k * 0.74, 0.52, 90 - k * 34, 0.32, 0.12, k * 0.2); T(-k * 0.8, 0.46, 90 + k * 40, 0.2, 0.1, -k * 0.2); }
      else { T(-0.6, 0.24, 160, 0.36, 0.14, -0.25); T(-0.44, 0.46, 140, 0.4, 0.14, -0.22); T(-0.2, 0.62, 118, 0.3, 0.12, -0.2); }
      // where the eyes sit in this drawing (head units): the brow ridge and markings follow them
      paintSoft(c, path, feather(pal), TOP - 2, BOT + 6, {
        edge: 1.9, strands: 60, x0: -1.2 * A, x1: 1.2 * A, seed: 9,
        keep: (x, y) => !faceSide || y < LINES.eye - 0.1 * A,
        inside: (cc) => {
          if (!faceSide) return;
          // the pale throat: a soft cream patch under the beak (a horizontal band
          // across the face reads as a grin, and a hard edge as teeth)
          const tx = view === "front" ? 0 : view === "tq" ? 0.3 * A : 0.32 * A;
          cc.save(); cc.translate(tx, 0.64 * A); cc.scale(1, 0.62);
          cc.fillStyle = radial(cc, 0, 0, 0.1 * A, 0.5 * A, [[0, pal.cream[0]], [0.6, pal.cream[1]], [1, pal.cream[1] + "00"]]);
          cc.beginPath(); cc.arc(0, 0, 0.5 * A, 0, TAU); cc.fill(); cc.restore();
          // fine chevrons on the throat, as on the chest
          cc.strokeStyle = pal.cream[2]; cc.lineWidth = 0.7; cc.globalAlpha = 0.6;
          const cx0 = tx;
          for (let r = 0; r < 2; r++) for (let i = -1; i <= 1; i++) { cc.beginPath(); cc.arc(cx0 + (i * 0.16 + (r % 2) * 0.08) * A, (0.62 + r * 0.1) * A, 0.06 * A, 0.3, Math.PI - 0.3); cc.stroke(); }
          cc.globalAlpha = 1;
        },
      });
    });
  }
  function eyePiece(view, look, pal) {
    return pieceOf(`eye_${view}_${look}`, 24, 22, 0.5, 0.5, (c) => {
      const { hw, hh } = EYE[view], g = eyeGeom(view, look), face = view === "far" ? -1 : 1;
      if (view === "far") c.scale(-1, 1);
      drawEye(c, {
        hw, hh, ink: pal.ink, weight: 2.1,
        look: look === "hurt" || look === "dizzy" || look === "closed" ? look : "open",
        lid: look === "idle" ? [-0.82, -0.28] : look === "glare" ? [-0.66, 0.12] : null, bow: look === "glare" ? 0.6 : 1.2,
        sclera: ["#ffffff", "#fff3d6", "#f7cf8a"], shade: "rgba(190,90,20,0.55)", spiral: "#b0401a",
        iris: { x: g.gx * face, y: g.gy, r: g.r, ring: "#7a2206", stops: ["#c4420e", "#f68a1c", "#ffd04a"], pupil: "#240a04", pupilR: 0.46 },
      });
    });
  }
  /** The beak, anchored where the centre line meets the beak line: a raptor's hook, with a cere at its base. */
  function beakPiece(view, open, pal) {
    return pieceOf(`beak_${view}_${open ? "open" : "closed"}`, 1.7 * A, 1.5 * A, 0.4, 0.3, (c) => {
      const gold = (y0, y1) => grad(c, 0, y0, 0, y1, ["#ffe680", "#f6bd2c", "#c97a0c"]);
      c.strokeStyle = "#6a3a04";
      c.lineWidth = 1.2;
      const part = (pts, y0, y1) => { c.beginPath(); pts(); c.closePath(); c.fillStyle = gold(y0, y1); c.fill(); c.stroke(); };
      const mouth = (pts) => { c.beginPath(); pts(); c.closePath(); c.fillStyle = "#8a1c1c"; c.fill(); c.stroke(); };
      const a = A, drop = open ? 0.22 * a : 0;
      const cere = (x, y, w, h) => { c.beginPath(); c.ellipse(x, y, w, h, 0, 0, TAU); c.fillStyle = "#f2a82a"; c.fill(); c.stroke(); };
      if (view === "front") {
        if (open) mouth(() => { c.moveTo(-0.2 * a, 0.06 * a); c.lineTo(0.2 * a, 0.06 * a); c.lineTo(0.1 * a, 0.36 * a + drop * 0.6); c.lineTo(-0.1 * a, 0.36 * a + drop * 0.6); });
        part(() => { c.moveTo(-0.14 * a, 0.16 * a + drop); c.quadraticCurveTo(0, 0.2 * a + drop, 0.14 * a, 0.16 * a + drop); c.quadraticCurveTo(0.06 * a, 0.34 * a + drop, 0, 0.36 * a + drop); c.quadraticCurveTo(-0.06 * a, 0.34 * a + drop, -0.14 * a, 0.16 * a + drop); }, 0.1 * a, 0.5 * a);
        // the upper mandible: broad at the cere, curving down to a sharp hook
        part(() => { c.moveTo(-0.26 * a, -0.12 * a); c.quadraticCurveTo(0, -0.24 * a, 0.26 * a, -0.12 * a); c.quadraticCurveTo(0.2 * a, 0.16 * a, 0.05 * a, 0.36 * a); c.lineTo(0, 0.46 * a); c.lineTo(-0.05 * a, 0.36 * a); c.quadraticCurveTo(-0.2 * a, 0.16 * a, -0.26 * a, -0.12 * a); }, -0.2 * a, 0.46 * a);
        cere(0, -0.12 * a, 0.2 * a, 0.06 * a);
        c.strokeStyle = "rgba(255,250,210,0.9)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -0.08 * a); c.lineTo(0, 0.28 * a); c.stroke(); // the ridge
        c.fillStyle = "#6a3a04"; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 0.09 * a, -0.12 * a, 0.75, 0, TAU); c.fill(); }
        return;
      }
      // three-quarter and profile: the hook, longer in profile
      const L = view === "side" ? 0.7 * a : 0.5 * a, b = view === "side" ? -0.08 * a : -0.2 * a;
      if (open) mouth(() => { c.moveTo(b, 0.02 * a); c.lineTo(b + L * 0.78, 0.08 * a); c.lineTo(b + L * 0.6, 0.16 * a + drop); c.lineTo(b, 0.16 * a + drop * 0.6); });
      // lower mandible
      part(() => { c.moveTo(b, 0.1 * a + drop * 0.5); c.quadraticCurveTo(b + L * 0.5, 0.11 * a + drop, b + L * 0.7, 0.15 * a + drop * 1.2); c.quadraticCurveTo(b + L * 0.5, 0.27 * a + drop, b - 0.02 * a, 0.24 * a + drop * 0.6); }, 0.05 * a, 0.32 * a + drop);
      // upper mandible: a deep curve over to the hooked tip
      part(() => {
        c.moveTo(b, -0.2 * a);
        c.bezierCurveTo(b + L * 0.55, -0.26 * a, b + L * 1.02, -0.1 * a, b + L * 0.98, 0.18 * a);
        c.quadraticCurveTo(b + L * 0.96, 0.3 * a, b + L * 0.86, 0.34 * a); // the hook's point
        c.quadraticCurveTo(b + L * 0.86, 0.16 * a, b + L * 0.72, 0.12 * a);
        c.quadraticCurveTo(b + L * 0.4, 0.12 * a, b, 0.12 * a);
      }, -0.24 * a, 0.34 * a);
      cere(b + 0.05 * a, -0.12 * a, 0.12 * a, 0.09 * a);
      c.strokeStyle = "rgba(255,250,210,0.9)"; c.lineWidth = 1.1; c.beginPath(); c.moveTo(b + 0.14 * a, -0.17 * a); c.bezierCurveTo(b + L * 0.5, -0.2 * a, b + L * 0.85, -0.08 * a, b + L * 0.9, 0.12 * a); c.stroke();
      c.fillStyle = "#6a3a04"; c.beginPath(); c.arc(b + 0.08 * a, -0.12 * a, 0.85, 0, TAU); c.fill(); // nostril in the cere
    });
  }
  function emberPieces(phase) {
    const pal = PAL[phase] || PAL[1], fp = feather(pal);
    const list = [];
    for (const v of ["front", "tq", "side", "backtq", "back"]) list.push(headPiece(v, pal));
    for (const v of ["front", "near", "far", "side"]) {
      for (const l of LOOKS) list.push(eyePiece(v, l, pal));
      for (const k of Object.keys(BROWS)) list.push(pieceOf(`brow_${v}_${k}`, 18, 12, 0.5, 0.5, (c) => {
        if (v === "far") c.scale(-1, 1);
        const b = BROWS[k], s2 = [b[0] * 1.1, b[1] * 1.1, b[2] * 1.15, b[3] * 1.9];
        drawBrow(c, { front: 12, near: 12, far: 7.6, side: 11 }[v] / 2, s2, pal.edge, Math.min(1, b[4] + 0.35)); // the ridge: dark, heavy
        drawBrow(c, { front: 12, near: 12, far: 7.6, side: 11 }[v] / 2 - 1, [s2[0] - 0.5, s2[1] - 0.6, s2[2] - 0.5, s2[3] * 0.4], pal.light, 0.5); // lit along its top
      }));
    }
    for (const v of ["front", "tq", "side"]) list.push(beakPiece(v, false, pal), beakPiece(v, true, pal));
    list.push(
      pieceOf("wing", 190, 150, 0.07, 0.2, (c) => {
        // A wing along +x: the arm on top, then three rows of round feathers
        // overlapping like tiles, the long primaries fanning out at the tip.
        const span = 116;
        const arm = (u) => ({ x: u * span, y: -10 * Math.sin(u * Math.PI) - 2 * u }); // the leading edge
        const row = (n, u0, u1, len, wid, a0, a1, cols) => {
          for (let i = n - 1; i >= 0; i--) { // from the tip inwards, so each overlaps the one beyond it
            const u = lerp(u0, u1, n === 1 ? 0 : i / (n - 1)), p = arm(u), ang = lerp(a0, a1, i / Math.max(1, n - 1));
            const L = len * lerp(0.82, 1.18, i / Math.max(1, n - 1));
            const cx = p.x + Math.cos(ang) * L * 0.5, cy = p.y + Math.sin(ang) * L * 0.5;
            c.beginPath();
            c.ellipse(cx, cy, L * 0.56, wid, ang, 0, TAU);
            const tx = p.x + Math.cos(ang) * L, ty = p.y + Math.sin(ang) * L;
            c.fillStyle = grad(c, p.x, p.y, tx, ty, cols);
            c.fill();
            c.strokeStyle = pal.edge; c.lineWidth = 1.1; c.stroke();
            c.strokeStyle = "rgba(255,240,170,0.5)"; c.lineWidth = 0.8; // the quill
            c.beginPath(); c.moveTo(p.x + Math.cos(ang) * L * 0.2, p.y + Math.sin(ang) * L * 0.2); c.lineTo(p.x + Math.cos(ang) * L * 0.9, p.y + Math.sin(ang) * L * 0.9); c.stroke();
          }
        };
        row(10, 0.2, 1, 62, 8.4, 1.45, 0.2, [pal.base, pal.light, pal.tip]); // primaries and secondaries
        row(8, 0.1, 0.86, 40, 7.4, 1.4, 0.45, [pal.dark, pal.base, pal.light]); // greater coverts
        row(7, 0.04, 0.7, 24, 6.4, 1.35, 0.6, [pal.dark, pal.dark, pal.base]); // lesser coverts
        const lead = new Path2D(); // the arm
        lead.moveTo(-6, -6);
        for (let i = 0; i <= 20; i++) { const p = arm(i / 20); lead.lineTo(p.x, p.y - 6 * (1 - i / 26)); }
        for (let i = 20; i >= 0; i--) { const p = arm(i / 20); lead.lineTo(p.x, p.y + 7 * (1 - i / 24)); }
        lead.lineTo(-6, 9);
        lead.closePath();
        c.strokeStyle = pal.edge; c.lineWidth = 1.6; c.stroke(lead);
        c.fillStyle = grad(c, 0, -16, 0, 8, [pal.light, pal.base, pal.dark]); c.fill(lead);
      }),
      pieceOf("plume", 110, 44, 0.07, 0.5, (c) => {
        const p = new Path2D();
        p.moveTo(0, -5); p.bezierCurveTo(30, -15, 62, -11, 92, 4); p.bezierCurveTo(82, 2, 76, 8, 84, 15); p.bezierCurveTo(56, 15, 26, 12, 0, 5); p.closePath();
        c.strokeStyle = pal.edge; c.lineWidth = 1.5; c.stroke(p);
        c.fillStyle = grad(c, 0, 0, 92, 0, [pal.dark, pal.base, pal.light, pal.tip]); c.fill(p);
        c.strokeStyle = pal.rim; c.globalAlpha = 0.6; c.lineWidth = 1; c.beginPath(); c.moveTo(6, 0); c.quadraticCurveTo(46, -5, 82, 5); c.stroke();
      }),
      pieceOf("body", 80, 84, 0.5, 0.5, (c) => {
        const pts = [];
        for (let i = 0; i < 60; i++) { const a = (i / 60) * TAU; pts.push({ x: Math.cos(a) * 27, y: Math.sin(a) * 31 }); }
        const path = new Path2D();
        furPath(path, pts, { seed: 4, tooth: 7, depth: 2.6, mask: (x, y) => (y > 0 ? 1 : 0.4) });
        paintSoft(c, path, fp, -32, 34, { edge: 2, strands: 50, x0: -26, x1: 26, seed: 6 });
      }),
      pieceOf("chest", 52, 56, 0.5, 0.4, (c) => {
        const p = new Path2D(); // the cream heart
        p.moveTo(0, -10); p.bezierCurveTo(-8, -24, -26, -16, -20, 2); p.bezierCurveTo(-16, 14, -5, 22, 0, 30); p.bezierCurveTo(5, 22, 16, 14, 20, 2); p.bezierCurveTo(26, -16, 8, -24, 0, -10); p.closePath();
        c.strokeStyle = "#c98a4a"; c.lineWidth = 1.4; c.stroke(p);
        c.fillStyle = grad(c, 0, -20, 0, 30, pal.cream); c.fill(p);
        c.strokeStyle = "#e8b878"; c.lineWidth = 0.9; c.globalAlpha = 0.8;
        for (let r = 0; r < 3; r++) for (let i = -2; i <= 2; i++) { const x = i * 6 + (r % 2) * 3, y = -6 + r * 8; if (Math.abs(x) < 15 - r * 3) { c.beginPath(); c.arc(x, y, 3, 0.2, Math.PI - 0.2); c.stroke(); } }
      }),
      pieceOf("leg", 30, 44, 0.5, 0.1, (c) => {
        const th = new Path2D(); th.ellipse(0, 4, 8, 9, 0, 0, TAU);
        paintSoft(c, th, fp, -6, 14, { edge: 1.6 });
        c.strokeStyle = "#7a4a06"; c.lineWidth = 5.4; c.beginPath(); c.moveTo(0, 12); c.lineTo(0, 26); c.stroke();
        c.strokeStyle = "#f2b52a"; c.lineWidth = 3.4; c.stroke();
        for (const dx of [-8, 0, 8]) {
          c.strokeStyle = "#7a4a06"; c.lineWidth = 4.6; c.beginPath(); c.moveTo(0, 26); c.quadraticCurveTo(dx * 0.7, 29, dx, 35); c.stroke();
          c.strokeStyle = "#f2b52a"; c.lineWidth = 2.8; c.stroke();
          c.fillStyle = "#4a2a08"; c.beginPath(); c.moveTo(dx - 1.4, 34); c.lineTo(dx + 0.4, 40); c.lineTo(dx + 1.6, 34); c.fill();
        }
      }),
      glowPiece("glow_fire", "255,150,60"), KIT.glintPiece(), KIT.starPiece(),
    );
    return list;
  }

  const boss = {
    id: "emberwing",
    title: "Emberwing",
    lede: "A fire phoenix with a raptor's head: fierce amber eyes on the sides of a narrow skull under a heavy brow ridge, a pale face below them, a flame crest, and a big hooked gold beak whose base tucks the far eye.",
    attacks: [["dive-bomb", "Dive Bomb"], ["ember-rain", "Ember Rain"], ["wing-gust", "Wing Gust"], ["flame-ring", "Flame Ring"], ["scorched-earth", "Scorched Earth"], ["heat-mark", "Heat Mark"]],
    pose: emberPose, placements: emberPlacements, pieces: emberPieces, faces: [FACE], looks: LOOKS, mouths: MOUTHS,
    stage: { w: 440, h: 300, ground: 0.84, closeW: 96, closeH: 86, sheetGap: 300, sheetH: 270, closeGap: 84, closeSheetH: 96, champion: [-170, 30], shadow: [56, 15], floor: ["#160a08", "#2a120c", "255,140,60"] },
    occluder: "the beak: its base sits over the far eye's inner corner",
  };
  return { A, SPEC, ATTACKS, LOOKS, MOUTHS, centreLine, skullEdge, boss, emberPose, emberPlacements, emberPieces };
})();
