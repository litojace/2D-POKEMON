/*
 * The face kit every boss shares. PURE: no DOM, no state.
 *
 *   KIT.makeFace(spec)  ->  { face(head, expr), contain, faceYaw, spec }
 *
 * `spec` is one boss's construction: its lines, its eye orbit, its profile
 * (the centre line), the outline of each view's head drawing, and which
 * drawn piece each feature uses in each view. `face()` turns a head pose
 * into piece placements. Nothing here draws: pieces are drawn once, by the
 * boss's own file, into an atlas.
 *
 * Rig units: x right, y up, z towards the camera. Screen = (x, -y + z * 0.65).
 * Yaw 0 faces the camera, 90 degrees faces screen right, 180 faces away.
 * Head space: u across, v down, from the head's centre; worked out for a head
 * turned to screen right and mirrored for left turns.
 */
const KIT = (() => {
  "use strict";
  const TAU = Math.PI * 2,
    DEG = Math.PI / 180;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  const gauss = (x, s) => Math.exp(-(x * x) / (s * s));
  const TILT = 0.65;
  const project = (p) => ({ x: p.x, y: -p.y + p.z * TILT });
  const rotY = (p, a) => {
    const c = Math.cos(a),
      s = Math.sin(a);
    return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
  };
  /** Sort depth of a rig point: nearer the camera, and higher, is in front. */
  const depth = (p) => p.z * 0.84 + p.y * 0.3;
  const after = (age, dur) => (age < 0 || age > dur ? 0 : Math.sin((age / dur) * Math.PI));
  const rng = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ════════════════════════ views ════════════════════════
  const LIMITS = { front: 22.5, tq: 67.5, side: 112.5, backtq: 157.5 };
  /**
   * Which drawing of the head a yaw shows, and which way it is mirrored.
   * `prev` (the view shown last frame, optional) holds a view until the yaw
   * is 4 degrees past the line, so a swaying head never flickers between two.
   */
  function headView(yaw, limits = LIMITS, prev) {
    const w = wrap(yaw),
      a = Math.abs(w) / DEG;
    const pick = (x) =>
      x < limits.front ? "front" : x < limits.tq ? "tq" : x < limits.side ? "side" : x < limits.backtq ? "backtq" : "back";
    let view = pick(a);
    if (prev && prev !== view && (pick(a - 4) === prev || pick(a + 4) === prev)) view = prev;
    return { view, side: w < 0 ? -1 : 1, turn: Math.abs(w) };
  }

  // ════════════════════════ the face ════════════════════════
  function makeFace(F) {
    const limits = F.limits || LIMITS;
    /** The face's own yaw: the skull's, held back a little (0 at front and side). */
    const faceYaw = (turn) => turn - F.lag * Math.sin(2 * Math.min(turn, 90 * DEG));
    /** Keep a feature of half-width hw, spanning v0..v1, inside the view's outline. */
    function contain(view, u, hw, v0, v1) {
      let lo = -1e9,
        hi = 1e9;
      for (const v of [v0, (v0 + v1) / 2, v1]) {
        const [l, r] = F.skullEdge(view, v);
        lo = Math.max(lo, l);
        hi = Math.min(hi, r);
      }
      lo += hw + F.margin;
      hi -= hw + F.margin;
      return lo > hi ? (lo + hi) / 2 : clamp(u, lo, hi);
    }
    /**
     * `head`: { x, y (screen, rig units), yaw (from the camera), pitch, roll,
     * z (sort depth), prevView? }. `expr`: { look, mouth, blink, ... }.
     *
     * 1. the yaw picks the view; work in the canonical drawing, mirror at the end;
     * 2. u = orbit * sin(face yaw -+ azimuth) for eyes, centreLine(v) * sin(face yaw)
     *    for features on the centre line; v = the feature's line, in every view;
     * 3. clamp u inside the view's outline by the feature's half-width;
     * 4. turn everything by the head's roll only (+ the far eye's fixed lift).
     */
    function face(head, expr) {
      let { view, side, turn } = headView(head.yaw, limits, head.prevView);
      const out = [];
      const cr = Math.cos(head.roll),
        sr = Math.sin(head.roll);
      let n = 0;
      const raw = (key, piece, u, v, rot, sx, sy, alpha, glow) =>
        out.push({
          key: (F.key || "f") + "-" + key, piece,
          x: head.x + u * side * cr - v * sr,
          y: head.y + u * side * sr + v * cr,
          rot, sx, sy, alpha, z: head.z + 0.02 + 0.001 * n++, glow: !!glow, face: true,
        });
      const put = (key, piece, u, v, o = {}) =>
        raw(key, piece, u, v, head.roll + (o.rot || 0) * side, (o.flip ? -1 : 1) * side * (o.s || 1), o.s || 1,
          o.alpha === undefined ? 1 : o.alpha, o.glow);
      let pf = faceYaw(turn);
      // the front drawing is one drawing: it slides with the turn but never flips
      if (view === "front") (pf *= side), (side = 1);
      put("head", F.headPiece(view, expr), 0, 0);
      if (view === "back" || view === "backtq") return { placements: out, view, side, guide: null, marks: { top: F.top, eye: F.lines.eye, bot: F.bot } };

      const nod = clamp(head.pitch, -0.45, 0.45) * F.nod;
      const look = expr.blink ? F.blinkLook || "closed" : expr.look || "idle";
      const eyeV = F.lines.eye + nod;
      const sinF = view === "side" ? 1 : Math.sin(pf);
      const E = F.eye;
      const eyes =
        view === "front"
          ? [["front", -F.eyeAz, false, "n"], ["front", F.eyeAz, true, "f"]]
          : view === "tq"
            ? [["near", -F.eyeAz, false, "n"], ["far", F.eyeAz, false, "f"]]
            : [["side", -F.eyeAz, false, "n"]];
      const bridge = F.centreLine(F.lines.eye) * sinF + (F.bridgeHalf || 0);
      const placedEyes = eyes.map(([v, az, flip, id]) => {
        const g = { ...E[v], ...(F.eyeGeom ? F.eyeGeom(v, look) : {}) };
        let u = F.eyeOrbit * Math.sin(pf + az);
        // the far eye never hides more than `tuckCap` of itself behind the bridge
        if (v === "far" && F.tuckCap !== undefined) u = Math.max(u, bridge + g.hw * (1 - 2 * F.tuckCap));
        u = contain(view, u, g.hw, eyeV - g.hh * 0.7, eyeV + g.hh * 0.7);
        return { v, flip, id, g, u, rot: v === "far" ? -F.farLift : 0 };
      });
      // features on the centre line
      const feats = {};
      for (const f of F.centre)
        if (!f.anchor) {
          const v = f.line + nod * (f.nodK === undefined ? 1 : f.nodK);
          let u = F.centreLine(f.line) * sinF;
          if (view === "side") u -= f.sideInset || 0;
          else if (f.hw) u = contain(view, u, f.hw[view], v + (f.vspan ? f.vspan[0] : -1), v + (f.vspan ? f.vspan[1] : 1));
          feats[f.id] = { u, v };
        }
      for (const f of F.centre) if (f.anchor) feats[f.id] = feats[f.anchor];

      const lit = F.lit ? F.lit(look) : false;
      const eyeGlow = expr.eyeGlow === undefined ? 0 : expr.eyeGlow;
      const drawEye = (e) => {
        if (lit && eyeGlow > 0.01 && F.eyeGlowPiece)
          put("eg" + e.id, F.eyeGlowPiece, e.u, eyeV, { glow: true, alpha: eyeGlow, s: (e.g.hw / E.front.hw) * (F.eyeGlowScale || 0.7) });
        put("eye" + e.id, F.eyePiece ? F.eyePiece(e.v, look, expr) : `eye_${e.v}_${look}`, e.u, eyeV, { rot: e.rot, flip: e.flip });
        const b = F.brow && F.brow(look, expr);
        if (b)
          put("brow" + e.id, `brow_${e.v}_${b.kind}`, e.u + (e.flip ? -1 : 1) * (e.v === "far" ? -1 : 1) * (b.dx || 0),
            F.lines.brow + nod + (b.dy || 0), { flip: e.flip, rot: e.rot });
      };
      const drawFeat = (f) => {
        const piece = f.piece(view, expr);
        const at = feats[f.id];
        if (piece) put(f.id, piece, at.u, at.v);
        const gl = f.glow && f.glow(expr, view);
        if (gl && gl.alpha > 0.01) put(f.id + "glow", gl.piece, at.u, at.v, { glow: true, alpha: clamp(gl.alpha), s: gl.s || 1 });
      };
      const layer = (f) => (typeof f.layer === "function" ? f.layer(view) : f.layer) || "top";
      const far = placedEyes.find((e) => e.id === "f"),
        near = placedEyes.find((e) => e.id === "n");
      // back to front: far eye, whatever tucks its inner corner, near eye, the rest
      for (const f of F.centre) if (layer(f) === "under") drawFeat(f);
      if (far) drawEye(far);
      for (const f of F.centre) if (layer(f) === "mid") drawFeat(f);
      drawEye(near);
      for (const f of F.centre) if (layer(f) === "top") drawFeat(f);
      // highlights: one drawing, never mirrored, on the same side of both irises
      if (F.glint && F.glint(look))
        for (const e of placedEyes) {
          const ix = (e.g.gx || 0) * (e.flip ? -1 : 1),
            iy = e.g.gy || 0;
          const c = Math.cos(e.rot),
            s = Math.sin(e.rot);
          const k = (e.g.r || 4) / (F.glintR || 4);
          raw("glint" + e.id, F.glintPiece || "glint", e.u + ix * c - iy * s, eyeV + ix * s + iy * c, 0, k, k, 1, false);
        }
      // construction, for the model sheet: the centre line and the eye line
      const toScreen = (u, v) => ({ x: head.x + u * side * cr - v * sr, y: head.y + u * side * sr + v * cr });
      const centre = [];
      for (let v = F.top + 1; v <= F.bot - 1; v += 2) centre.push(toScreen(F.centreLine(v) * sinF, v + nod * 0.9));
      const [l, r] = F.skullEdge(view, F.lines.eye);
      const guide = {
        centre,
        eyeLine: [toScreen(l, eyeV), toScreen(r, eyeV)],
        others: Object.entries(F.lines)
          .filter(([k]) => k !== "eye")
          .map(([, v]) => {
            const [a, b] = F.skullEdge(view, v);
            return [toScreen(a * 0.9, v + nod), toScreen(b * 0.9, v + nod)];
          }),
        eyes: placedEyes.map((e) => ({ ...toScreen(e.u, eyeV), hw: e.g.hw })),
      };
      return { placements: out, view, side, guide, eyes: placedEyes, feats, bridge, marks: { top: F.top, eye: eyeV, bot: F.bot } };
    }
    return { face, contain, faceYaw, spec: F, limits };
  }

  // ════════════════════════ drawing helpers (pieces are drawn once) ════════════════════════
  /** A piece: size in rig units, the anchor (0-1), and its drawing about that anchor. */
  const pieceOf = (name, w, h, ox, oy, fn) => ({
    name, w, h, ox, oy,
    draw: (ctx, k) => {
      ctx.save();
      ctx.scale(k, k);
      ctx.translate(ox * w, oy * h);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      fn(ctx);
      ctx.restore();
    },
  });
  /** A curved tuft (fur, feather, flame): base at (x, y), tip `len` along `ang`. */
  function tuft(path, x, y, ang, len, w, bend = 0.25) {
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    const tx = x + dx * len + nx * len * bend, ty = y + dy * len + ny * len * bend;
    path.moveTo(x - nx * w, y - ny * w);
    path.quadraticCurveTo(x + dx * len * 0.55 - nx * w * 0.9, y + dy * len * 0.55 - ny * w * 0.9, tx, ty);
    path.quadraticCurveTo(x + dx * len * 0.5 + nx * w * 1.1, y + dy * len * 0.5 + ny * w * 1.1, x + nx * w, y + ny * w);
    path.closePath();
  }
  /** A closed outline with a fringe of little points along it (fur, down). */
  function furPath(path, pts, o) {
    const rnd = rng(o.seed || 1);
    const out = [];
    const step = 0.3;
    let acc = 0, tooth = 0, amp = 1;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const nx = (b.y - a.y) / (d || 1), ny = -(b.x - a.x) / (d || 1);
      for (let s = 0; s < d; s += step) {
        const x = a.x + ((b.x - a.x) * s) / d, y = a.y + ((b.y - a.y) * s) / d;
        acc += step;
        if (acc > tooth) { acc = 0; tooth = o.tooth * (0.7 + rnd() * 0.7); amp = 0.5 + rnd() * 0.7; }
        const f = acc / tooth;
        const prof = f < 0.72 ? f / 0.72 : (1 - f) / 0.28;
        const m = o.mask ? o.mask(x, y) : 1;
        const off = o.depth * amp * m * (prof - 0.45);
        out.push({ x: x + nx * off, y: y + ny * off });
      }
    }
    out.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
    path.closePath();
  }
  const grad = (c, x0, y0, x1, y1, stops) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((s, i) => g.addColorStop(Array.isArray(s) ? s[0] : i / (stops.length - 1), Array.isArray(s) ? s[1] : s));
    return g;
  };
  const radial = (c, x, y, r0, r1, stops) => {
    const g = c.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach((s, i) => g.addColorStop(Array.isArray(s) ? s[0] : i / (stops.length - 1), Array.isArray(s) ? s[1] : s));
    return g;
  };
  /**
   * Outline, fill, then light a soft shape: `pal` = { edge, light, base, dark,
   * rim, warm? }. Moonlight on the top edge; optional strands inside.
   */
  function paintSoft(c, path, pal, top, bot, o = {}) {
    if (o.edge !== 0) {
      c.strokeStyle = pal.edge;
      c.lineWidth = o.edge || 2;
      c.stroke(path);
    }
    c.fillStyle = o.fill || grad(c, 0, top, 0, bot, [[0, pal.light], [0.42, pal.base], [1, pal.dark]]);
    c.fill(path);
    c.save();
    c.clip(path);
    const h = bot - top;
    c.strokeStyle = grad(c, 0, top, 0, top + h * 0.45, [pal.rim, pal.rim + "00"]);
    c.globalAlpha = o.rimAlpha === undefined ? 0.75 : o.rimAlpha;
    c.lineWidth = (o.edge || 2) + 2.4;
    c.stroke(path);
    if (pal.warm) {
      c.strokeStyle = grad(c, 0, top, 0, top + h * 0.3, [pal.warm, "rgba(0,0,0,0)"]);
      c.globalAlpha = 1;
      c.lineWidth = (o.edge || 2) + 0.9;
      c.stroke(path);
    }
    if (o.strands) {
      const rnd = rng(o.seed || 7);
      for (let i = 0; i < o.strands; i++) {
        const x = lerp(o.x0, o.x1, rnd()), y = lerp(top, bot, rnd());
        const a = (o.flow || Math.PI / 2) + (rnd() - 0.5) * 0.9, l = 2.5 + rnd() * 3;
        if (o.keep && !o.keep(x, y)) continue;
        c.strokeStyle = (y - top) / h < 0.45 ? pal.light : pal.dark;
        c.globalAlpha = 0.35;
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 0.8, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
        c.stroke();
      }
    }
    if (o.inside) (c.globalAlpha = 1), o.inside(c);
    c.restore();
    c.globalAlpha = 1;
  }
  function glowPiece(name, rgb, size = 44) {
    return pieceOf(name, size, size, 0.5, 0.5, (c) => {
      c.fillStyle = radial(c, 0, 0, 0, size / 2, [[0, `rgba(${rgb},0.85)`], [0.35, `rgba(${rgb},0.34)`], [1, `rgba(${rgb},0)`]]);
      c.fillRect(-size / 2, -size / 2, size, size);
    });
  }
  function softPiece(name, color, alpha, size = 44) {
    return pieceOf(name, size, size, 0.5, 0.5, (c) => {
      c.globalAlpha = alpha;
      c.fillStyle = radial(c, 0, 0, 0, size * 0.45, [color, color + "00"]);
      c.beginPath(); c.arc(0, 0, size * 0.45, 0, TAU); c.fill();
    });
  }
  const starPiece = (name = "star") =>
    pieceOf(name, 12, 12, 0.5, 0.5, (c) => {
      c.fillStyle = "#fff1a0";
      c.strokeStyle = "#a8781a";
      c.lineWidth = 0.6;
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? 2 : 4.6;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath(); c.fill(); c.stroke();
    });
  /** The highlight on an iris: one drawing for both eyes, never mirrored. */
  const glintPiece = (name = "glint") =>
    pieceOf(name, 9, 9, 0.5, 0.5, (c) => {
      c.fillStyle = "#fff";
      c.beginPath(); c.arc(-1.4, -1.8, 1.25, 0, TAU); c.fill();
      c.globalAlpha = 0.85;
      c.beginPath(); c.arc(1.6, 1.5, 0.58, 0, TAU); c.fill();
    });
  /**
   * An eye, drawn once per view and look, with its inner corner at +x.
   * o: { hw, hh, look: "open" | "hurt" | "closed" | "dizzy",
   *      lid: [outerY, innerY] in half-heights (omit for a fully open eye), bow,
   *      sclera: [...colours], shade, iris: { x, y, r, stops, ring, pupil },
   *      ink, line, lash, closed: 1 (curving down) | -1 (arched) | 0 (flat) }
   * A round or almond eye cut by a lid that runs from the outer corner down
   * to the inner one; line weights are in rig units, whatever the eye's width.
   */
  function drawEye(c, o) {
    const { hw, hh } = o, ink = o.ink || "#1b0b1f", wt = o.weight || 2;
    c.strokeStyle = c.fillStyle = ink;
    c.lineWidth = wt;
    const lash = (x, y) => { if (o.lash === false) return; c.beginPath(); c.moveTo(x + 1.3, y - 1.1); c.lineTo(x - 2.4, y - 2.7); c.lineTo(x + 0.2, y + 1); c.closePath(); c.fill(); };
    if (o.look === "hurt") { c.beginPath(); c.moveTo(-hw * 0.8, -hh * 0.6); c.lineTo(hw * 0.72, 0.3); c.lineTo(-hw * 0.8, hh * 0.64); c.stroke(); return; }
    if (o.look === "closed") {
      const k = o.closed === undefined ? 1 : o.closed;
      c.beginPath(); c.moveTo(-hw * 0.95, k > 0 ? 0 : k < 0 ? hh * 0.4 : 0.4); c.quadraticCurveTo(-hw * 0.1, k * hh * 0.8, hw * 0.92, k > 0 ? 1 : k < 0 ? hh * 0.4 : 1);
      c.stroke(); lash(-hw * 0.95, 0.4);
      return;
    }
    const ellipse = (g = 0) => { c.beginPath(); c.ellipse(0, 0, hw + g, hh + g, 0, 0, TAU); };
    const white = () => radial(c, 0, hh * 0.25, 0.5, hh * 1.1 + hw * 0.2, o.sclera || ["#ffffff", "#f1f1f6"]);
    if (o.look === "dizzy") {
      ellipse(); c.fillStyle = white(); c.fill(); c.lineWidth = 1.2; c.stroke();
      c.strokeStyle = o.spiral || "#8a3a10"; c.lineWidth = 1.25; c.beginPath();
      for (let i = 0; i <= 60; i++) { const a = (i / 60) * TAU * 2.25, r = (i / 60) * 0.72; i ? c.lineTo(Math.cos(a) * r * hw, Math.sin(a) * r * hh) : c.moveTo(0, 0); }
      c.stroke();
      return;
    }
    const open = !o.lid;
    const y0 = open ? 0 : o.lid[0] * hh, y1 = open ? 0 : o.lid[1] * hh;
    const P0 = { x: -hw - 1.5, y: y0 - (y1 - y0) * 0.1 }, P1 = { x: hw + 1.5, y: y1 + (y1 - y0) * 0.1 }, C = { x: 0, y: (y0 + y1) / 2 - (o.bow === undefined ? 1.6 : o.bow) };
    const at = (t) => ({ x: (1 - t) * (1 - t) * P0.x + 2 * (1 - t) * t * C.x + t * t * P1.x, y: (1 - t) * (1 - t) * P0.y + 2 * (1 - t) * t * C.y + t * t * P1.y });
    const under = (g) => { c.beginPath(); c.moveTo(P0.x - g, P0.y); c.quadraticCurveTo(C.x, C.y, P1.x + g, P1.y); c.lineTo(hw + 5, hh + 5); c.lineTo(-hw - 5, hh + 5); c.closePath(); c.clip(); };
    c.save();
    ellipse(); c.clip();
    if (!open) under(0);
    c.fillStyle = white();
    c.fillRect(-hw - 4, -hh - 4, 2 * hw + 8, 2 * hh + 8);
    const I = o.iris;
    if (I) {
      if (I.ring) { c.fillStyle = I.ring; c.beginPath(); c.arc(I.x, I.y, I.r, 0, TAU); c.fill(); }
      c.fillStyle = grad(c, 0, I.y - I.r, 0, I.y + I.r, I.stops);
      c.beginPath(); c.arc(I.x, I.y, I.r * (I.ring ? 0.84 : 1), 0, TAU); c.fill();
      c.fillStyle = I.pupil || "#1d0910";
      c.beginPath(); c.arc(I.x, I.y - I.r * 0.06, I.r * (I.pupilR || 0.5), 0, TAU); c.fill();
    }
    if (!open && o.shade) { // the lid's shadow across the top of the eye
      const mid = at(0.5);
      c.save();
      c.transform(1, (y1 - y0) / (2 * hw), 0, 1, 0, 0);
      c.fillStyle = grad(c, 0, mid.y, 0, mid.y + 3.4, [o.shade, o.shade.replace(/[\d.]+\)$/, "0)")]);
      c.fillRect(-hw - 4, mid.y - 6, 2 * hw + 8, 10);
      c.restore();
    }
    c.restore();
    c.save();
    if (!open) under(2);
    c.strokeStyle = o.line || ink;
    c.lineWidth = 0.85;
    ellipse(0.1); c.stroke();
    c.strokeStyle = ink;
    c.lineWidth = wt * 0.72;
    c.beginPath(); c.ellipse(0, 0, hw + 0.2, hh + 0.2, 0, Math.PI * 0.62, Math.PI * (open ? 1.05 : 1.3)); c.stroke();
    c.restore();
    c.fillStyle = c.strokeStyle = ink;
    if (open) {
      c.lineWidth = wt;
      c.beginPath(); c.ellipse(0, 0, hw + 0.3, hh + 0.3, 0, Math.PI * 1.02, Math.PI * 1.9); c.stroke();
      lash(-hw * 0.86, -hh * 0.56);
      return;
    }
    const inside = (p) => (p.x / (hw + 0.5)) ** 2 + (p.y / (hh + 0.5)) ** 2 <= 1;
    let ta = 0, tb = 1;
    for (let t = 0; t <= 0.5; t += 0.01) if (inside(at(t))) { ta = t; break; }
    for (let t = 1; t >= 0.5; t -= 0.01) if (inside(at(t))) { tb = t; break; }
    const a = at(ta), b = at(tb), m = at((ta + tb) / 2);
    const cx = 2 * m.x - (a.x + b.x) / 2, cy = 2 * m.y - (a.y + b.y) / 2, h = wt / 2;
    c.beginPath(); // a tapered stroke: heavy at the outer corner, finer at the inner
    c.moveTo(a.x - 0.3, a.y - h); c.quadraticCurveTo(cx, cy - h * 0.9, b.x + 0.3, b.y - h * 0.45);
    c.lineTo(b.x + 0.2, b.y + h * 0.45); c.quadraticCurveTo(cx, cy + h * 0.8, a.x - 0.2, a.y + h * 0.9);
    c.closePath(); c.fill();
    lash(a.x, a.y);
  }
  /** A brow: a tapered stroke, inner end at +x. s = [outer y, mid y, inner y, thickness]. */
  function drawBrow(c, L, s, color, alpha) {
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(-L, s[0]);
    c.quadraticCurveTo(0, s[1] - s[3] * 0.5, L, s[2] - s[3] * 0.4);
    c.lineTo(L, s[2] + s[3] * 0.5);
    c.quadraticCurveTo(0, s[1] + s[3] * 0.6, -L, s[0] + 0.25);
    c.closePath();
    c.fill();
    c.globalAlpha = 1;
  }
  const BROWS = { calm: [0.5, -0.9, 0.4, 1.0, 0.4], angry: [-1.9, -0.5, 1.9, 1.9, 0.9], raised: [0.6, -1.9, 0.2, 1.1, 0.6], pinch: [1.3, 0.3, -1.5, 1.5, 0.85] };
  /** A long piece (wing, plume, ear) laid from 3D point a towards b: its placement options. */
  function along(a, b, nominal, min = 0.5, max = 1.12) {
    const sa = project(a), sb = project(b);
    const len = Math.hypot(sb.x - sa.x, sb.y - sa.y), rot = Math.atan2(sb.y - sa.y, sb.x - sa.x);
    return { rot, sx: clamp(len / nominal, min, max), sy: Math.cos(rot) < 0 ? -1 : 1 };
  }
  /** Placement list helper: adds a piece at a 3D rig point. */
  function adder(list, alphaOf = () => 1) {
    return (key, piece, w, o = {}) => {
      const s = project(w);
      list.push({
        key, piece, x: s.x, y: s.y, rot: o.rot || 0,
        sx: o.sx === undefined ? 1 : o.sx, sy: o.sy === undefined ? 1 : o.sy,
        alpha: (o.alpha === undefined ? 1 : o.alpha) * alphaOf(),
        z: depth(w) + (o.bias || 0), glow: !!o.glow, actor: o.actor,
      });
    };
  }
  /** Three stars circling a dizzy head. */
  function stars(list, hs, hz, t, up, r = 30) {
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i * TAU) / 3;
      list.push({ key: "star" + i, piece: "star", x: hs.x + Math.cos(a) * r, y: hs.y - up + Math.sin(a) * 7, rot: a, sx: 1, sy: 1, alpha: 1, z: hz + (Math.sin(a) > 0 ? 1 : -1), glow: false });
    }
  }

  return {
    TAU, DEG, TILT, LIMITS, clamp, lerp, smooth, wrap, gauss, project, rotY, depth, after, rng,
    headView, makeFace, drawEye, drawBrow, BROWS, along, pieceOf, tuft, furPath, grad, radial, paintSoft, glowPiece, softPiece, starPiece, glintPiece, adder, stars,
  };
})();
if (typeof module !== "undefined") module.exports = KIT;
