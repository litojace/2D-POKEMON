var TIDE = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // tools/tide-entry.ts
  var tide_entry_exports = {};
  __export(tide_entry_exports, {
    boss: () => boss
  });

  // ../../apps/client/src/boss-vector-grumble.ts
  var TAU = Math.PI * 2;
  function drawGlow(ctx, size) {
    const r = size / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, "rgba(255,255,255,0.85)");
    g.addColorStop(0.35, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  var FACINGS = 8;
  var STEP = TAU / FACINGS;

  // ../../apps/client/src/boss-vector-face.ts
  var TAU2 = Math.PI * 2;
  var DEG = Math.PI / 180;
  var clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  var wrap = (a) => ((a + Math.PI) % TAU2 + TAU2) % TAU2 - Math.PI;
  function headView(yaw, prev) {
    const w = wrap(yaw), a = Math.abs(w) / DEG;
    const pick = (x) => x < 22.5 ? "front" : x < 67.5 ? "tq" : x < 112.5 ? "side" : x < 157.5 ? "backtq" : "back";
    let view = pick(a);
    if (prev && prev !== view && (pick(a - 4) === prev || pick(a + 4) === prev))
      view = prev;
    return { view, side: w < 0 ? -1 : 1, turn: Math.abs(w) };
  }
  function makeFace(F) {
    const faceYaw = (turn) => turn - F.lag * Math.sin(2 * Math.min(turn, 90 * DEG));
    function contain(view, u, hw, v0, v1) {
      let lo = -1e9, hi = 1e9;
      for (const v of [v0, (v0 + v1) / 2, v1]) {
        const [l, r] = F.skullEdge(view, v);
        lo = Math.max(lo, l);
        hi = Math.min(hi, r);
      }
      lo += hw + F.margin;
      hi -= hw + F.margin;
      return lo > hi ? (lo + hi) / 2 : clamp(u, lo, hi);
    }
    function face(head, expr) {
      const hv = headView(head.yaw, head.prevView);
      const view = hv.view;
      let side = hv.side;
      const out = [];
      const cr = Math.cos(head.roll), sr = Math.sin(head.roll);
      let n = 0;
      const at = (u, v) => ({
        x: head.x + u * side * cr - v * sr,
        y: head.y + u * side * sr + v * cr
      });
      const put = (key, piece, u, v, o = {}) => {
        const p = at(u, v);
        out.push({
          key,
          piece,
          x: p.x,
          y: p.y,
          rot: o.still ? 0 : head.roll + (o.rot ?? 0) * side,
          sx: (o.still ? 1 : (o.flip ? -1 : 1) * side) * (o.s ?? 1),
          sy: o.s ?? 1,
          alpha: o.alpha ?? 1,
          z: head.z + 0.02 + 1e-3 * n++,
          glow: o.glow
        });
      };
      let pf = faceYaw(hv.turn);
      if (view === "front") {
        pf *= side;
        side = 1;
      }
      put("head", F.headPiece(view), 0, 0);
      const nod = clamp(head.pitch, -0.45, 0.45) * F.nod;
      const feats = {};
      if (view === "back" || view === "backtq")
        return { placements: out, view, side, at, nod, feats, eyes: [] };
      const eyeV = F.lines.eye + nod;
      const sinF = view === "side" ? 1 : Math.sin(pf);
      const list = view === "front" ? [
        ["front", -F.eyeAz, false, "n"],
        ["front", F.eyeAz, true, "f"]
      ] : view === "tq" ? [
        ["near", -F.eyeAz, false, "n"],
        ["far", F.eyeAz, false, "f"]
      ] : [["side", -F.eyeAz, false, "n"]];
      const bridge = F.centreLine(F.lines.eye) * sinF + (F.bridgeHalf ?? 0);
      const eyes = list.map(([v, az, flip, id]) => {
        const g = F.eye[v];
        let u = F.eyeOrbit * Math.sin(pf + az);
        if (v === "far" && F.tuckCap !== void 0)
          u = Math.max(u, bridge + g.hw * (1 - 2 * F.tuckCap));
        u = contain(view, u, g.hw, eyeV - g.hh * 0.7, eyeV + g.hh * 0.7);
        return { v, flip, id, g, u, rot: v === "far" ? -F.farLift : 0 };
      });
      for (const f of F.centre)
        if (f.line !== void 0) {
          const v = f.line + nod * (f.nodK ?? 1);
          let u = F.centreLine(f.line) * sinF;
          if (view === "side") u -= f.sideInset ?? 0;
          else if (f.hw?.[view] !== void 0)
            u = contain(
              view,
              u,
              f.hw[view],
              v + (f.vspan?.[0] ?? -1),
              v + (f.vspan?.[1] ?? 1)
            );
          feats[f.id] = { u, v };
        }
      for (const f of F.centre) if (f.anchor) feats[f.id] = feats[f.anchor];
      const drawEye2 = (e) => {
        put("eye" + e.id, F.eyePiece(e.v, expr), e.u, eyeV, {
          rot: e.rot,
          flip: e.flip
        });
        const b = F.brow?.(e.v, expr);
        if (b)
          put(
            "brow" + e.id,
            b.piece,
            e.u + (e.flip ? -1 : 1) * (e.v === "far" ? -1 : 1) * (b.dx ?? 0),
            (F.lines.brow ?? F.lines.eye) + nod + (b.dy ?? 0),
            { rot: e.rot, flip: e.flip }
          );
      };
      const drawFeat = (f) => {
        const p = feats[f.id];
        const piece = f.piece(view, expr);
        if (piece) put(f.id, piece, p.u, p.v);
        const gl = f.glow?.(expr, view);
        if (gl && gl.alpha > 0.01)
          put(f.id + "glow", gl.piece, p.u, p.v, {
            glow: true,
            alpha: clamp(gl.alpha),
            s: gl.s
          });
      };
      const layer = (f) => (typeof f.layer === "function" ? f.layer(view) : f.layer) ?? "top";
      const far = eyes.find((e) => e.id === "f"), near = eyes.find((e) => e.id === "n");
      if (far) drawEye2(far);
      for (const f of F.centre) if (layer(f) === "mid") drawFeat(f);
      drawEye2(near);
      for (const f of F.centre) if (layer(f) === "top") drawFeat(f);
      for (const e of eyes) {
        const g = F.glint?.(e.v, expr);
        if (g)
          put("glint" + e.id, g.piece, e.u + g.x, eyeV + g.y, { still: true });
      }
      return { placements: out, view, side, at, nod, feats, eyes, bridge };
    }
    return { face, contain, faceYaw, spec: F };
  }
  function drawEye(c, o) {
    const { hw, hh } = o, wt = o.weight ?? 2;
    c.lineJoin = c.lineCap = "round";
    c.strokeStyle = c.fillStyle = o.ink;
    c.lineWidth = wt;
    const lash = (x, y) => {
      c.beginPath();
      c.moveTo(x + 1.3, y - 1.1);
      c.lineTo(x - 2.4, y - 2.7);
      c.lineTo(x + 0.2, y + 1);
      c.closePath();
      c.fill();
    };
    if (o.look === "closed") {
      c.beginPath();
      c.moveTo(-hw * 0.95, 0);
      c.quadraticCurveTo(-hw * 0.1, hh * 0.8, hw * 0.92, 1);
      c.stroke();
      lash(-hw * 0.95, 0.4);
      return;
    }
    const ellipse = (g = 0) => {
      c.beginPath();
      c.ellipse(0, 0, hw + g, hh + g, 0, 0, TAU2);
    };
    const white = () => {
      const g = c.createRadialGradient(
        0,
        hh * 0.25,
        0.5,
        0,
        hh * 0.25,
        hh * 1.1 + hw * 0.2
      );
      o.sclera.forEach((s, i) => g.addColorStop(i / (o.sclera.length - 1), s));
      return g;
    };
    if (o.look === "dizzy") {
      ellipse();
      c.fillStyle = white();
      c.fill();
      c.lineWidth = 1.2;
      c.stroke();
      c.strokeStyle = o.spiral ?? o.ink;
      c.lineWidth = 1.25;
      c.beginPath();
      for (let i = 0; i <= 60; i++) {
        const a2 = i / 60 * TAU2 * 2.25, r = i / 60 * 0.72;
        if (i) c.lineTo(Math.cos(a2) * r * hw, Math.sin(a2) * r * hh);
        else c.moveTo(0, 0);
      }
      c.stroke();
      return;
    }
    const open = !o.lid;
    const y0 = open ? 0 : o.lid[0] * hh, y1 = open ? 0 : o.lid[1] * hh;
    const P0 = { x: -hw - 1.5, y: y0 - (y1 - y0) * 0.1 }, P1 = { x: hw + 1.5, y: y1 + (y1 - y0) * 0.1 }, C = { x: 0, y: (y0 + y1) / 2 - (o.bow ?? 1.6) };
    const at = (t) => ({
      x: (1 - t) * (1 - t) * P0.x + 2 * (1 - t) * t * C.x + t * t * P1.x,
      y: (1 - t) * (1 - t) * P0.y + 2 * (1 - t) * t * C.y + t * t * P1.y
    });
    const under = (g) => {
      c.beginPath();
      c.moveTo(P0.x - g, P0.y);
      c.quadraticCurveTo(C.x, C.y, P1.x + g, P1.y);
      c.lineTo(hw + 5, hh + 5);
      c.lineTo(-hw - 5, hh + 5);
      c.closePath();
      c.clip();
    };
    c.save();
    ellipse();
    c.clip();
    if (!open) under(0);
    c.fillStyle = white();
    c.fillRect(-hw - 4, -hh - 4, 2 * hw + 8, 2 * hh + 8);
    const I = o.iris;
    if (I) {
      if (I.ring) {
        c.fillStyle = I.ring;
        c.beginPath();
        c.arc(I.x, I.y, I.r, 0, TAU2);
        c.fill();
      }
      const g = c.createLinearGradient(0, I.y - I.r, 0, I.y + I.r);
      I.stops.forEach((s, i) => g.addColorStop(i / (I.stops.length - 1), s));
      c.fillStyle = g;
      c.beginPath();
      c.arc(I.x, I.y, I.r * (I.ring ? 0.84 : 1), 0, TAU2);
      c.fill();
      c.fillStyle = I.pupil ?? "#0b0503";
      c.beginPath();
      if (I.slit) c.ellipse(I.x, I.y, I.slit, I.r * 0.82, 0, 0, TAU2);
      else c.arc(I.x, I.y - I.r * 0.06, I.r * 0.5, 0, TAU2);
      c.fill();
    }
    if (!open && o.shade) {
      const mid = at(0.5);
      c.save();
      c.transform(1, (y1 - y0) / (2 * hw), 0, 1, 0, 0);
      const g = c.createLinearGradient(0, mid.y, 0, mid.y + 3.4);
      g.addColorStop(0, o.shade);
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(-hw - 4, mid.y - 6, 2 * hw + 8, 10);
      c.restore();
    }
    c.restore();
    c.save();
    if (!open) under(2);
    c.strokeStyle = o.ink;
    c.lineWidth = 0.85;
    ellipse(0.1);
    c.stroke();
    c.lineWidth = wt * 0.72;
    c.beginPath();
    c.ellipse(
      0,
      0,
      hw + 0.2,
      hh + 0.2,
      0,
      Math.PI * 0.62,
      Math.PI * (open ? 1.05 : 1.3)
    );
    c.stroke();
    c.restore();
    c.fillStyle = c.strokeStyle = o.ink;
    if (open) {
      c.lineWidth = wt;
      c.beginPath();
      c.ellipse(0, 0, hw + 0.3, hh + 0.3, 0, Math.PI * 1.02, Math.PI * 1.9);
      c.stroke();
      lash(-hw * 0.86, -hh * 0.56);
      return;
    }
    const inside = (p) => (p.x / (hw + 0.5)) ** 2 + (p.y / (hh + 0.5)) ** 2 <= 1;
    let ta = 0, tb = 1;
    for (let t = 0; t <= 0.5; t += 0.01)
      if (inside(at(t))) {
        ta = t;
        break;
      }
    for (let t = 1; t >= 0.5; t -= 0.01)
      if (inside(at(t))) {
        tb = t;
        break;
      }
    const a = at(ta), b = at(tb), m = at((ta + tb) / 2);
    const cx = 2 * m.x - (a.x + b.x) / 2, cy = 2 * m.y - (a.y + b.y) / 2, h = wt / 2;
    c.beginPath();
    c.moveTo(a.x - 0.3, a.y - h);
    c.quadraticCurveTo(cx, cy - h * 0.9, b.x + 0.3, b.y - h * 0.45);
    c.lineTo(b.x + 0.2, b.y + h * 0.45);
    c.quadraticCurveTo(cx, cy + h * 0.8, a.x - 0.2, a.y + h * 0.9);
    c.closePath();
    c.fill();
    lash(a.x, a.y);
  }

  // ../../apps/client/src/boss-vector-tide.ts
  var TAU3 = Math.PI * 2;
  var clamp2 = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  var lerp = (a, b, t) => a + (b - a) * t;
  var smooth = (a, b, x) => {
    const t = clamp2((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  var v3 = (x, y, z) => ({ x, y, z });
  var add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
  var mul = (a, s) => v3(a.x * s, a.y * s, a.z * s);
  var dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  var cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  var len = (a) => Math.hypot(a.x, a.y, a.z);
  var norm = (a) => {
    const l = len(a) || 1;
    return v3(a.x / l, a.y / l, a.z / l);
  };
  var rotY = (p, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return v3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  };
  var UP = v3(0, 1, 0);
  var TIDE_TILT = 0.65;
  var VIEW = norm(v3(0, 0.55, 0.84));
  var tideProject = (p) => ({ x: p.x, y: -p.y + p.z * TIDE_TILT });
  var SEGMENTS = 30;
  var SEG = 12.5;
  var HS = 1.35;
  function radiusAt(i) {
    const f = i / (SEGMENTS - 1);
    if (f < 0.14) return lerp(8, 19, f / 0.14);
    if (f < 0.55) return lerp(19, 30, (f - 0.14) / 0.41);
    return lerp(30, 23, (f - 0.55) / 0.45);
  }
  function tideIdle(clock = 0, phase = 1, reduced = false) {
    const m = reduced ? 0 : 1;
    const b = Math.sin(clock * 1.3) * m;
    return {
      rear: 1,
      neckCurl: 0.8,
      lean: 0,
      coil: 0.55,
      humps: 1,
      sway: 0.5 * m,
      swimPhase: clock * 1.1 * m,
      flopK: 0,
      flopPhase: 0,
      flat: 0,
      sink: 0,
      spin: 0,
      bob: b * 3,
      headPitch: -0.2 + b * 0.04,
      headYaw: Math.sin(clock * 0.4) * 0.22 * m,
      headRoll: 0,
      jaw: 0,
      lid: phase === 1 ? 0.3 : phase === 2 ? 0.2 : 0.12,
      anger: phase === 3 ? 1 : phase === 2 ? 0.8 : 0.6,
      dizzy: 0,
      pearl: 0.45 + 0.15 * Math.sin(clock * 2.2) * m,
      exposed: 0,
      closed: 0,
      clock: clock * m
    };
  }
  function tideBody(P, yaw) {
    const N = SEGMENTS;
    const base = Math.round(0.55 * (N - 1));
    const hs = [], es = [];
    let h = 0;
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      const lying = lerp(1 - smooth(0.45, 0.62, f), 1, P.flat);
      h += P.coil * lying * 0.16 + P.sway * Math.sin(f * TAU3 * 1.5 - P.swimPhase) * 0.13 * (0.4 + lying) + P.flopK * Math.sin(f * TAU3 * 1.1 + P.flopPhase) * 0.2 + (1 - lying) * Math.sin(f * TAU3 * 1.4 + P.clock * 0.7) * 0.11 * (1 - P.flat);
      hs.push(h);
      const humps = P.humps * Math.sin(f * TAU3 * 2.2 - P.swimPhase * 0.8) * 0.42 * lying;
      const rise = smooth(0.5, 0.7, f) * P.rear * 1.25;
      const curl = smooth(0.78, 1, f) * P.neckCurl * 1.1;
      const leanF = smooth(0.55, 0.72, f) * P.lean;
      const flick = -Math.max(0, 1 - f / 0.12) * 0.9;
      es.push(lerp(humps + rise - curl - leanF + flick, 0, P.flat));
    }
    const h0 = hs[base];
    const local = [];
    let pos = v3(0, 0, 0);
    for (let i = 0; i < N; i++) {
      const hh = hs[i] - h0, e = es[i];
      const d = v3(
        Math.sin(hh) * Math.cos(e),
        Math.sin(e),
        Math.cos(hh) * Math.cos(e)
      );
      local.push({ p: pos, d });
      pos = add(pos, mul(d, SEG));
    }
    let cx = 0, cz = 0;
    for (const q of local) {
      cx += q.p.x;
      cz += q.p.z;
    }
    cx /= N;
    cz /= N;
    const b = local[base].p;
    const ox = lerp(b.x, cx, P.flat), oz = lerp(b.z - 26, cz, P.flat);
    const restY = lerp(5, 27, P.flat) + P.bob * (1 - P.flat) * 0.6 - P.sink;
    const turn = yaw + P.spin;
    const W = (p) => rotY(v3(p.x - ox, p.y - b.y * (1 - P.flat) + restY, p.z - oz), turn);
    const segs = local.map((q, i) => {
      const w = W(q.p), d = rotY(q.d, turn);
      const c = cross(d, UP);
      const right = len(c) < 0.15 ? rotY(v3(-1, 0, 0), turn) : norm(c);
      return { i, w, d, r: radiusAt(i), right, up: norm(cross(right, d)) };
    });
    const top = segs[N - 1];
    const along = Math.atan2(top.d.x, top.d.z);
    const drift = Math.atan2(Math.sin(along - turn), Math.cos(along - turn));
    const H = turn + lerp(drift * 0.3, drift, P.flat) + P.headYaw;
    const pa = lerp(P.headPitch, 0, P.flat * 0.8);
    const F = norm(
      v3(Math.sin(H) * Math.cos(pa), Math.sin(pa), Math.cos(H) * Math.cos(pa))
    );
    let R = norm(cross(F, UP));
    let U = norm(cross(R, F));
    if (P.headRoll) {
      const c = Math.cos(P.headRoll), s = Math.sin(P.headRoll);
      const R2 = add(mul(R, c), mul(U, s));
      U = add(mul(U, c), mul(R, -s));
      R = R2;
    }
    const C = add(add(top.w, mul(top.d, 10)), add(mul(F, 12), mul(U, 5)));
    const at = (f, r, u) => add(C, add(mul(F, f * HS), add(mul(R, r * HS), mul(U, u * HS))));
    const jawDir = norm(
      add(mul(F, Math.cos(P.jaw * 0.75)), mul(U, -Math.sin(P.jaw * 0.75)))
    );
    const head = {
      w: C,
      F,
      R,
      U,
      at,
      hinge: at(4, 0, -6),
      jawDir,
      pearl: at(7, 0, 25)
    };
    return { segs, head };
  }
  var ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  var after = (age, dur) => age < 0 || age > dur ? 0 : Math.sin(age / dur * Math.PI);
  function tidePose(c) {
    const P = tideIdle(c.clock, c.phase, c.reduced);
    const w = clamp2(c.windup);
    const k = c.windKind;
    if (k === "dive") {
      P.rear = lerp(P.rear, 1.3, w);
      P.headPitch = lerp(P.headPitch, 0.3, w);
      P.lean = lerp(0, -0.3, w);
      P.jaw = 0.5 * w;
    } else if (k === "wave") {
      P.rear = lerp(P.rear, 1.25, w);
      P.lean = -0.55 * w;
      P.headPitch = lerp(P.headPitch, 0.35, w);
      P.jaw = 0.45 * w;
    } else if (k === "bubbles") {
      P.headPitch = lerp(P.headPitch, 0.15, w);
      P.lean = -0.15 * w;
    } else if (k === "hightide") {
      P.rear = lerp(P.rear, 1.4, w);
      P.headPitch = lerp(P.headPitch, 1.05, w);
      P.lean = -0.3 * w;
      P.jaw = w;
    } else if (k === "undertow") {
      P.coil = lerp(P.coil, 1.5, w);
      P.rear = lerp(P.rear, 0.7, w);
      P.jaw = 0.4 * w;
    } else if (k === "prison") {
      P.headPitch = lerp(P.headPitch, -0.05, w);
      P.jaw = 0.2 * w;
    }
    if (k) {
      P.anger = Math.max(P.anger, 0.4 + 0.6 * w);
      P.lid = Math.min(P.lid, lerp(P.lid, 0.05, w));
    }
    if (!c.reduced && c.castKind) {
      const a = c.castAge;
      if (c.castKind === "wave") {
        const s = after(a, 0.9);
        P.lean = Math.max(P.lean, 0.95 * s);
        P.headPitch = lerp(P.headPitch, -0.85, s);
        P.jaw = Math.max(P.jaw, 0.7 * s);
      } else if (c.castKind === "bubbles") {
        const s = after(a, 1.4);
        P.jaw = Math.max(P.jaw, 0.5 * s);
        P.lean = Math.max(P.lean, 0.2 * s);
        P.headPitch = lerp(P.headPitch, -0.25, s);
      } else if (c.castKind === "prison") {
        const s = after(a, 0.8);
        P.jaw = Math.max(P.jaw, 0.7 * s);
        P.headPitch = lerp(P.headPitch, -0.35, s);
      } else if (c.castKind === "hightide") {
        const s = after(a, 1.2);
        P.jaw = Math.max(P.jaw, s);
        P.headPitch = lerp(P.headPitch, 1, s);
        P.rear = lerp(P.rear, 1.35, s);
      }
    }
    if (!c.reduced && c.roarAge >= 0 && c.roarAge < 1.6 && !c.dead) {
      const s = Math.sin(c.roarAge / 1.6 * Math.PI);
      P.rear = lerp(P.rear, 1.35, s);
      P.headPitch = lerp(P.headPitch, 0.65, s);
      P.lean = lerp(P.lean, -0.35, s);
      P.jaw = Math.max(P.jaw, s);
      P.anger = 1;
    }
    if (c.stranded && !c.dead) {
      P.flat = 1;
      P.coil = 0.95;
      P.humps = 0;
      P.sway = 0;
      P.rear = 0;
      P.flopK = c.reduced ? 0 : 1;
      P.flopPhase = c.reduced ? 0 : c.clock * 7;
      P.dizzy = 1;
      P.headRoll = 0.55;
      P.jaw = 0.25;
      P.anger = 0;
      P.lid = 0;
    }
    if (c.stranded || c.stagger) P.exposed = 1;
    if (c.stagger && !c.stranded && !c.dead) P.dizzy = 1;
    if (c.hurt > 0 && !c.dead && !c.reduced) {
      P.lean -= 0.35 * c.hurt;
      P.headPitch += 0.35 * c.hurt;
      P.lid = Math.max(P.lid, 0.8 * c.hurt);
    }
    P.sink = (1 - clamp2(c.rise)) * 300;
    if (c.dead) {
      const s = clamp2(c.deathSink);
      P.anger = 0;
      P.closed = 1;
      P.dizzy = 0;
      P.exposed = 0;
      P.rear = lerp(1, 0.4, ease(Math.min(1, s * 3)));
      P.headPitch = -0.7;
      P.headRoll = 0.4;
      P.sway = 0.15;
      P.humps = 0.4;
      P.pearl = (1 - s) * 0.6;
      P.sink = s * s * 430;
    }
    return P;
  }
  var TIDE = {
    1: {
      light: "#a5f6e4",
      mid: "#2fbdb7",
      dark: "#0f6b76",
      line: "#0a3540",
      belly: "#fff3d8",
      bellyDark: "#e2c79e",
      fin: "#ff8fbf",
      finLight: "#ffd6e7",
      finDark: "#d9548f",
      iris: [255, 196, 64],
      pearl: [225, 255, 248],
      glow: 7927270,
      mark: null
    },
    2: {
      light: "#93e3f6",
      mid: "#1f93c2",
      dark: "#0b4f7c",
      line: "#072b46",
      belly: "#f1f6ea",
      bellyDark: "#c6d6cc",
      fin: "#ff74b2",
      finLight: "#ffc4de",
      finDark: "#c93f84",
      iris: [255, 170, 52],
      pearl: [215, 250, 255],
      glow: 7265535,
      mark: 9235455
    },
    3: {
      light: "#6f9ce0",
      mid: "#22448c",
      dark: "#0b1a44",
      line: "#040b22",
      belly: "#c9d8f2",
      bellyDark: "#8ea4cc",
      fin: "#ff4fa6",
      finLight: "#ffb3dc",
      finDark: "#a8216b",
      iris: [255, 236, 120],
      pearl: [200, 250, 255],
      glow: 5958655,
      mark: 6616575
    }
  };
  var rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  var PIECE = {
    seg: 30,
    // a body disc's radius
    fin: 22,
    // a back fin's height
    ray: 46,
    // a tail-fin ray's length
    mane: 50,
    frill: 30,
    horn: 46,
    disc: 26,
    // head discs' radius
    snout: 42 * HS,
    // snout length (base to nose)
    jaw: 47 * HS,
    glow: 40
    // a glow's radius
  };
  function finShape(ctx, k, w, h, pal, droop = 0) {
    const bx = w / 2 * k, by = h * k;
    const g = ctx.createLinearGradient(bx, by, bx, 0);
    g.addColorStop(0, pal.finDark);
    g.addColorStop(0.5, pal.fin);
    g.addColorStop(1, pal.finLight);
    ctx.fillStyle = g;
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 1.5 * k;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(bx - w * 0.38 * k, by - 1 * k);
    ctx.quadraticCurveTo(
      bx - w * 0.45 * k + droop * k,
      by * 0.45,
      bx + droop * k * 0.6,
      2 * k
    );
    ctx.quadraticCurveTo(
      bx + w * 0.3 * k + droop * k,
      by * 0.5,
      bx + w * 0.38 * k,
      by - 1 * k
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1 * k;
    ctx.beginPath();
    ctx.moveTo(bx, by - 2 * k);
    ctx.quadraticCurveTo(
      bx - w * 0.1 * k + droop * k * 0.5,
      by * 0.5,
      bx + droop * k * 0.6,
      4 * k
    );
    ctx.stroke();
  }
  var HA = 30;
  var H_TOP = -0.9 * HA;
  var H_BOT = 0.84 * HA;
  var S_BROW = -0.32 * HA;
  var S_NOSE = 0.36 * HA;
  var gauss = (x, s) => Math.exp(-(x * x) / (s * s));
  var hse = (v) => {
    const t = clamp2(Math.abs((v + 0.03 * HA) / (0.87 * HA)));
    const e = v > -0.03 * HA ? 2 : 2.5;
    return Math.pow(1 - Math.pow(t, e), 1 / e);
  };
  var tideCentre = (v) => 0.9 * HA * hse(v) + 0.56 * HA * gauss(v - 0.4 * HA, (v > 0.4 * HA ? 0.3 : 0.2) * HA) - 0.04 * HA * gauss(v - 0.02 * HA, 0.12 * HA);
  var snoutHalf = (v) => 0.3 * HA * gauss(v - 0.44 * HA, 0.26 * HA);
  var TQ_LAG = 14 * Math.PI / 180;
  var HEAD_K = 1.25;
  var TQ_SIN = Math.sin(Math.PI / 4 - TQ_LAG);
  function tideSkull(view, v) {
    const s = hse(v), w = 0.99 * HA * s * (1 + 0.05 * smooth(-0.2 * HA, 0.4 * HA, v));
    if (view === "side") return [-1 * HA * s, tideCentre(v)];
    if (view === "tq")
      return [-w, Math.max(0.95 * HA * s, tideCentre(v) * TQ_SIN + snoutHalf(v))];
    return [-w, w];
  }
  var eyeName = (view, look) => view === "front" ? `eye-${look}` : `eye-${view}-${look}`;
  var lit = (look) => look !== "shut" && look !== "dizzy";
  var TIDE_SPEC = {
    A: HA,
    top: H_TOP,
    bot: H_BOT,
    lines: { pearl: -0.64 * HA, brow: S_BROW, eye: -0.06 * HA, nose: S_NOSE },
    eyeAz: 42 * Math.PI / 180,
    eyeOrbit: 0.64 * HA,
    lag: TQ_LAG,
    farLift: 6 * Math.PI / 180,
    nod: 0.4 * HA,
    margin: 0.045 * HA,
    tuckCap: 0.4,
    bridgeHalf: 1,
    eye: {
      front: { hw: 7.4, hh: 7.2 },
      near: { hw: 7.4, hh: 7.2 },
      far: { hw: 5, hh: 7 },
      side: { hw: 6.4, hh: 7.2 }
    },
    centreLine: tideCentre,
    skullEdge: tideSkull,
    headPiece: (view) => `head-${view}`,
    eyePiece: (view, e) => eyeName(view, e.look),
    glint: (view, e) => lit(e.look) ? {
      piece: "eye-glint",
      x: -TIDE_FACE_EYE[view] * 0.34,
      y: e.look === "glare" ? -1.6 : -2.6
    } : null,
    brow: (view, e) => ({
      piece: `brow-${view}-${e.brow}`,
      dx: 0.5,
      dy: e.brow === "angry" ? 2.4 : 0
    }),
    // on the centre line, in drawing order within their layer
    centre: [
      {
        id: "muzzle",
        anchor: "snout",
        // between the far and the near eye: its far edge tucks the far eye
        layer: "mid",
        piece: (view) => view === "side" ? null : `muzzle-${view}`
      },
      {
        id: "pearl",
        line: -0.64 * HA,
        nodK: 0.8,
        hw: { front: 7.5, tq: 7.5 },
        vspan: [-7, 7],
        sideInset: 3.5,
        piece: () => "pearl"
      },
      {
        id: "jaw",
        anchor: "snout",
        piece: (view, e) => `mouth-${view}-${e.mouth}`
      },
      {
        id: "snout",
        line: S_NOSE,
        hw: { front: 9, tq: 6 },
        vspan: [0, 7],
        sideInset: 1,
        piece: (view) => `nose-${view}`
      }
    ]
  };
  var TIDE_FACE_EYE = {
    front: 7.4,
    near: 7.4,
    far: 5,
    side: 6.4
  };
  var TIDE_FACE = makeFace(TIDE_SPEC);
  function tidePieces(phase) {
    const pal = TIDE[phase];
    const S = PIECE.seg;
    const out = [];
    const pieceOf = (name, w, h, ox, oy, draw) => out.push({ name, w, h, ox, oy, draw });
    pieceOf("seg", S * 2 + 2, S * 2 + 2, 0.5, 0.5, (ctx, k) => {
      const c = (S + 1) * k, r = S * k;
      const g = ctx.createLinearGradient(c - r * 0.4, c - r, c + r * 0.4, c + r);
      g.addColorStop(0, pal.light);
      g.addColorStop(0.45, pal.mid);
      g.addColorStop(1, pal.dark);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, TAU3);
      ctx.fill();
      ctx.strokeStyle = "rgba(10,60,70,0.3)";
      ctx.lineWidth = 1.3 * k;
      for (const [dx, dy] of [
        [-0.3, -0.35],
        [0.25, -0.2]
      ]) {
        ctx.beginPath();
        ctx.arc(c + dx * r, c + dy * r, r * 0.26, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.ellipse(c - r * 0.35, c - r * 0.5, r * 0.32, r * 0.16, -0.5, 0, TAU3);
      ctx.fill();
    });
    pieceOf("seg-line", S * 2 + 6, S * 2 + 6, 0.5, 0.5, (ctx, k) => {
      ctx.fillStyle = pal.line;
      ctx.beginPath();
      ctx.arc((S + 3) * k, (S + 3) * k, (S + 1.6) * k, 0, TAU3);
      ctx.fill();
    });
    pieceOf("belly", S * 1.5, S * 1.5, 0.5, 0.5, (ctx, k) => {
      const c = S * 0.75 * k, r = S * 0.72 * k;
      const g = ctx.createRadialGradient(c - r * 0.25, c - r * 0.25, 0, c, c, r);
      g.addColorStop(0, pal.belly);
      g.addColorStop(1, pal.bellyDark);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, TAU3);
      ctx.fill();
    });
    pieceOf(
      "fin",
      18,
      PIECE.fin + 2,
      0.5,
      1,
      (ctx, k) => finShape(ctx, k, 18, PIECE.fin + 2, pal, -3)
    );
    pieceOf(
      "ray",
      16,
      PIECE.ray + 2,
      0.5,
      1,
      (ctx, k) => finShape(ctx, k, 16, PIECE.ray + 2, pal)
    );
    pieceOf(
      "mane",
      18,
      PIECE.mane + 2,
      0.5,
      1,
      (ctx, k) => finShape(ctx, k, 18, PIECE.mane + 2, pal, 4)
    );
    pieceOf("horn", 26, PIECE.horn + 4, 0.35, 1, (ctx, k) => {
      const b = { x: 9 * k, y: (PIECE.horn + 2) * k };
      const beam = [
        b,
        { x: 10 * k, y: b.y - 16 * k },
        { x: 15 * k, y: b.y - 31 * k },
        { x: 18 * k, y: 3 * k }
      ];
      const tines = [
        [beam[1], { x: 3 * k, y: b.y - 28 * k }],
        [beam[2], { x: 24 * k, y: b.y - 40 * k }]
      ];
      const stroke = (pts, w0, w1) => {
        for (const pass of [0, 1])
          for (let j = 0; j < pts.length - 1; j++) {
            const wdt = lerp(w0, w1, j / (pts.length - 1)) * k;
            ctx.strokeStyle = pass ? j < pts.length - 2 ? "#f1e2bd" : "#ffd27a" : pal.line;
            ctx.lineWidth = pass ? wdt : wdt + 3 * k;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(pts[j].x, pts[j].y);
            ctx.lineTo(pts[j + 1].x, pts[j + 1].y);
            ctx.stroke();
          }
      };
      for (const t of tines) stroke(t, 5, 2.5);
      stroke(beam, 9.5, 2.8);
    });
    pieceOf(
      "frill",
      20,
      PIECE.frill + 2,
      0.5,
      1,
      (ctx, k) => finShape(ctx, k, 20, PIECE.frill + 2, pal, 2)
    );
    const A = HA;
    const drawn = (name, w, h, ox, oy, fn) => pieceOf(name, w, h, ox, oy, (ctx, k) => {
      ctx.save();
      ctx.scale(k, k);
      ctx.translate(ox * w, oy * h);
      ctx.lineJoin = ctx.lineCap = "round";
      fn(ctx);
      ctx.restore();
    });
    const headSkin = (c, dy = 0) => {
      const g = c.createLinearGradient(0, H_TOP - 4 - dy, 0, H_BOT + 6 - dy);
      g.addColorStop(0, pal.light);
      g.addColorStop(0.45, pal.mid);
      g.addColorStop(1, pal.dark);
      return g;
    };
    const earFin = (c, x, y, deg, len2) => {
      for (const [d, l] of [
        [-26, 0.8],
        [26, 0.72],
        [0, 1]
      ]) {
        const a = (deg + d) * Math.PI / 180, ln = len2 * l;
        const dx = Math.cos(a), dy = Math.sin(a);
        c.beginPath();
        c.moveTo(x - dy * 4.5, y + dx * 4.5);
        c.quadraticCurveTo(
          x + dx * ln * 0.55 - dy * 5.5,
          y + dy * ln * 0.55 + dx * 5.5,
          x + dx * ln,
          y + dy * ln
        );
        c.quadraticCurveTo(
          x + dx * ln * 0.5 + dy * 5.5,
          y + dy * ln * 0.5 - dx * 5.5,
          x + dy * 4.5,
          y - dx * 4.5
        );
        c.closePath();
        const g = c.createLinearGradient(x, y, x + dx * ln, y + dy * ln);
        g.addColorStop(0, pal.finDark);
        g.addColorStop(0.5, pal.fin);
        g.addColorStop(1, pal.finLight);
        c.fillStyle = g;
        c.strokeStyle = pal.line;
        c.lineWidth = 1.6;
        c.stroke();
        c.fill();
      }
    };
    const VIEWS = ["front", "tq", "side", "backtq", "back"];
    for (const view of VIEWS)
      drawn(`head-${view}`, 4.2 * A, 3.2 * A, 0.5, 0.5, (c) => {
        const faced = view === "front" || view === "tq" || view === "side";
        if (view === "front" || view === "back")
          for (const s of [-1, 1])
            earFin(c, s * 0.8 * A, -0.1 * A, 90 - s * 88, 0.78 * A);
        else if (view === "tq") {
          earFin(c, -0.84 * A, -0.08 * A, 186, 0.86 * A);
          earFin(c, 0.5 * A, -0.62 * A, -52, 0.5 * A);
        } else if (view === "side") earFin(c, -0.62 * A, -0.1 * A, 190, 0.9 * A);
        else {
          earFin(c, 0.84 * A, -0.08 * A, -6, 0.86 * A);
          earFin(c, -0.6 * A, -0.5 * A, 212, 0.56 * A);
        }
        const path = new Path2D();
        for (let v = H_TOP; v <= H_BOT; v += 0.5)
          path.lineTo(tideSkull(view, v)[1], v);
        for (let v = H_BOT; v >= H_TOP; v -= 0.5)
          path.lineTo(tideSkull(view, v)[0], v);
        path.closePath();
        c.strokeStyle = pal.line;
        c.lineWidth = 2.2;
        c.stroke(path);
        c.fillStyle = headSkin(c);
        c.fill(path);
        c.save();
        c.clip(path);
        if (faced) {
          c.beginPath();
          if (view === "front") {
            c.moveTo(-1.3 * A, 0.5 * A);
            c.quadraticCurveTo(0, 0.82 * A, 1.3 * A, 0.5 * A);
          } else {
            c.moveTo(-1.3 * A, 0.56 * A);
            c.quadraticCurveTo(0.3 * A, 0.7 * A, 1.7 * A, 0.56 * A);
          }
          c.lineTo(1.7 * A, H_BOT + 8);
          c.lineTo(-1.3 * A, H_BOT + 8);
          c.closePath();
          c.fillStyle = pal.belly;
          c.fill();
        }
        const cu = view === "front" ? 0 : view === "tq" ? 0.42 * A : 0.62 * A;
        c.strokeStyle = pal.dark;
        c.lineWidth = 1;
        c.globalAlpha = 0.4;
        for (let r = 0; r < 9; r++)
          for (let x = -1.3 * A + r % 2 * 4.5; x < 1.5 * A; x += 9) {
            const y = H_TOP + 5 + r * 6.5;
            if (y > 0.45 * A) continue;
            if (faced && ((x - cu) / (0.86 * A)) ** 2 + ((y - 0.12 * A) / (0.6 * A)) ** 2 < 1)
              continue;
            c.beginPath();
            c.arc(x, y, 4.6, 0.12 * Math.PI, 0.88 * Math.PI);
            c.stroke();
          }
        c.globalAlpha = 0.55;
        const rim = c.createLinearGradient(0, H_TOP, 0, H_TOP + 0.5 * A);
        rim.addColorStop(0, "#ffffff");
        rim.addColorStop(1, "rgba(255,255,255,0)");
        c.strokeStyle = rim;
        c.lineWidth = 5;
        c.stroke(path);
        c.restore();
      });
    drawn("snout-back", 30, 26, 0.5, 0.5, (c) => {
      c.beginPath();
      c.ellipse(0, 2, 11, 9, 0, 0, TAU3);
      c.strokeStyle = pal.line;
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = headSkin(c, S_NOSE);
      c.fill();
    });
    drawn("muzzle-front", 44, 40, 0.5, 0.5, (c) => {
      const g = c.createRadialGradient(0, 3, 1, 0, 3, 17);
      g.addColorStop(0, pal.light);
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.globalAlpha = 0.6;
      c.fillStyle = g;
      c.save();
      c.scale(1, 0.72);
      c.beginPath();
      c.arc(0, 4, 17, 0, TAU3);
      c.fill();
      c.restore();
    });
    drawn("muzzle-tq", 44, 60, 0.6, 0.62, (c) => {
      const mid = (v) => (tideCentre(v) - tideCentre(S_NOSE)) * TQ_SIN;
      const half = (v) => 1 + snoutHalf(v);
      const top = S_BROW - 5, bot = S_NOSE + 16;
      const edge = [];
      for (let v = top; v <= bot; v += 0.5)
        edge.push({
          x: mid(v) + half(v) * (1 - 0.8 * smooth(S_NOSE + 9, bot, v)),
          y: v - S_NOSE
        });
      c.beginPath();
      edge.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y));
      c.lineTo(-24, bot - S_NOSE);
      c.lineTo(-24, top - S_NOSE);
      c.closePath();
      c.fillStyle = headSkin(c, S_NOSE);
      c.fill();
      c.globalCompositeOperation = "destination-out";
      const fade = (x0, y0, x1, y1) => {
        const g = c.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.fillRect(-30, -45, 70, 80);
      };
      fade(-22, 0, -11, 0);
      fade(0, top - S_NOSE, 0, S_BROW + 2 - S_NOSE);
      fade(0, 9, 0, 4);
      c.globalCompositeOperation = "source-over";
      const line = c.createLinearGradient(0, S_BROW - 3 - S_NOSE, 0, 9);
      line.addColorStop(0, "rgba(0,0,0,0)");
      line.addColorStop(0.25, pal.line);
      line.addColorStop(0.8, pal.line);
      line.addColorStop(1, "rgba(0,0,0,0)");
      c.strokeStyle = line;
      c.globalAlpha = 0.8;
      c.lineWidth = 1.2;
      c.beginPath();
      edge.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y));
      c.stroke();
    });
    for (const view of ["front", "tq", "side"])
      drawn(`nose-${view}`, 22, 12, 0.5, 0.5, (c) => {
        c.fillStyle = pal.line;
        const dots = view === "front" ? [
          [-4.4, 0, 0.5],
          [4.4, 0, -0.5]
        ] : view === "tq" ? [
          [-3.6, 0.2, 0.45],
          [3.2, -0.2, -0.3]
        ] : [[-4.6, -0.6, 0.4]];
        for (const [x, y, tilt] of dots) {
          c.beginPath();
          c.ellipse(x, y, view === "tq" && x > 0 ? 1.5 : 2.3, 1.4, tilt, 0, TAU3);
          c.fill();
        }
      });
    for (const view of ["front", "tq", "side"])
      for (const [kind, d] of [
        ["closed", 0],
        ["half", 4.5],
        ["open", 9]
      ])
        drawn(`mouth-${view}-${kind}`, 60, 44, 0.6, 0.2, (c) => {
          c.strokeStyle = pal.line;
          c.lineWidth = 1.5;
          const fx = (x) => view === "tq" && x > 0 ? x * 0.5 : view === "tq" ? x * 1.15 : x;
          const inside = () => {
            c.fillStyle = "#7a1e3a";
            c.fill();
            c.stroke();
          };
          if (view === "side") {
            c.translate(-5.5, 0);
            if (d) {
              c.beginPath();
              c.moveTo(-22, 6.5);
              c.lineTo(-3.5, 7 + d);
              c.quadraticCurveTo(-1, 9.5 + d, -4.5, 11.5 + d);
              c.quadraticCurveTo(-13, 13 + d * 0.6, -23, 11);
              c.closePath();
              c.fillStyle = pal.belly;
              c.fill();
              c.stroke();
              c.beginPath();
              c.moveTo(-1, 6);
              c.quadraticCurveTo(-10, 7.6, -22, 6.5);
              c.lineTo(-3.5, 7 + d);
              c.quadraticCurveTo(-1.4, 6.6 + d * 0.5, -1, 6);
              c.closePath();
              inside();
              c.fillStyle = "#ff7aa0";
              c.beginPath();
              c.ellipse(-9, 6.9 + d * 0.62, 5.5, 1.2 + d * 0.08, 0.36, 0, TAU3);
              c.fill();
              c.fillStyle = "#fffaf0";
              c.beginPath();
              c.moveTo(-3.2, 6.5);
              c.lineTo(-4.4, 6.5 + Math.min(d, 6) * 0.75);
              c.lineTo(-5.8, 6.7);
              c.fill();
            } else {
              c.beginPath();
              c.moveTo(-1, 6);
              c.quadraticCurveTo(-10, 8.2, -20, 6.8);
              c.quadraticCurveTo(-22.6, 6, -23.4, 3.6);
              c.stroke();
            }
            return;
          }
          const lip = () => {
            c.moveTo(fx(-12), 4.6);
            c.quadraticCurveTo(fx(-9), 9.2, fx(-3), 9.4);
            c.quadraticCurveTo(0, 9.6, fx(3), 9.4);
            c.quadraticCurveTo(fx(9), 9.2, fx(12), 4.6);
          };
          c.beginPath();
          lip();
          if (!d) {
            c.stroke();
            c.beginPath();
            c.moveTo(fx(-12), 4.6);
            c.quadraticCurveTo(fx(-13), 3.6, fx(-12.8), 2.4);
            c.moveTo(fx(12), 4.6);
            c.quadraticCurveTo(fx(13), 3.6, fx(12.8), 2.4);
            c.stroke();
            return;
          }
          c.quadraticCurveTo(fx(11), 9 + d, 0, 11 + d);
          c.quadraticCurveTo(fx(-11), 9 + d, fx(-12), 4.6);
          c.closePath();
          inside();
          c.save();
          c.clip();
          c.fillStyle = "#ff7aa0";
          c.beginPath();
          c.ellipse(fx(0), 10.5 + d, Math.abs(fx(-6)) * 0.9, 2.6, 0, 0, TAU3);
          c.fill();
          c.restore();
          c.fillStyle = "#fffaf0";
          for (const s of [-1, 1]) {
            c.beginPath();
            c.moveTo(fx(s * 5), 8.6);
            c.lineTo(fx(s * 6.4), 8.6 + Math.min(d, 6) * 0.8);
            c.lineTo(fx(s * 7.8), 8.2);
            c.fill();
          }
        });
    const lighter = (v) => v + 255 >> 1;
    const irisStops = [
      rgb([lighter(pal.iris[0]), lighter(pal.iris[1]), lighter(pal.iris[2])]),
      rgb(pal.iris),
      rgb([lighter(pal.iris[0]), lighter(pal.iris[1]), lighter(pal.iris[2])])
    ];
    for (const view of ["front", "near", "far", "side"]) {
      const { hw, hh } = TIDE_SPEC.eye[view];
      for (const look of [
        "glare",
        "wide",
        "squint",
        "shut",
        "dizzy"
      ])
        drawn(eyeName(view, look), 26, 26, 0.5, 0.5, (c) => {
          const way = view === "far" ? -1 : 1;
          if (view === "far") c.scale(-1, 1);
          drawEye(c, {
            hw,
            hh,
            ink: pal.line,
            weight: 2.1,
            look: look === "shut" ? "closed" : look === "dizzy" ? "dizzy" : "open",
            lid: look === "glare" ? [-0.66, -0.16] : look === "squint" ? [-0.3, 0.22] : void 0,
            bow: look === "squint" ? 0.5 : 1.3,
            sclera: ["#ffffff", "#f1fdff", "#bfe7ee"],
            shade: "rgba(8,60,70,0.4)",
            spiral: pal.dark,
            iris: {
              // the slit looks the way the head faces
              x: (view === "far" ? 0.2 : view === "front" ? 0.6 : 1) * way,
              y: look === "wide" ? 0.2 : 1.1,
              r: look === "wide" ? 3.4 : 4.5,
              ring: pal.dark,
              stops: irisStops,
              slit: look === "wide" ? 0.9 : 1.35
            }
          });
        });
      const L = { front: 9.4, near: 9.4, far: 6.2, side: 8.2 }[view] / 2;
      for (const [kind, s] of [
        ["calm", [0.5, -0.9, 0.4, 1.7]],
        ["angry", [-2, -0.6, 2.1, 2.4]]
      ])
        drawn(`brow-${view}-${kind}`, 16, 10, 0.5, 0.5, (c) => {
          if (view === "far") c.scale(-1, 1);
          c.beginPath();
          c.moveTo(-L, s[0]);
          c.quadraticCurveTo(0, s[1] - s[3] * 0.5, L, s[2] - s[3] * 0.4);
          c.lineTo(L, s[2] + s[3] * 0.5);
          c.quadraticCurveTo(0, s[1] + s[3] * 0.6, -L, s[0] + 0.25);
          c.closePath();
          c.fillStyle = pal.dark;
          c.fill();
        });
    }
    pieceOf("eye-glint", 6, 6, 0.5, 0.5, (ctx, k) => {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.arc(3 * k, 3 * k, 1.5 * k, 0, TAU3);
      ctx.fill();
    });
    pieceOf("pearl", 22 * HS, 18 * HS, 0.5, 0.5, (ctx, k) => {
      const r = 6.8 * HS * k, cx = 11 * HS * k, cy = 8 * HS * k;
      ctx.fillStyle = "#e7b44a";
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1.4 * k;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2.5 * k, r * 1.3, r * 0.75, 0, 0, TAU3);
      ctx.fill();
      ctx.stroke();
      const g = ctx.createRadialGradient(
        cx - r * 0.35,
        cy - r * 0.4,
        0,
        cx,
        cy,
        r
      );
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.6, rgb(pal.pearl));
      g.addColorStop(1, `#${pal.glow.toString(16).padStart(6, "0")}`);
      ctx.fillStyle = g;
      ctx.lineWidth = 1.5 * k;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.25, 0, TAU3);
      ctx.fill();
    });
    pieceOf(
      "glow",
      PIECE.glow * 2,
      PIECE.glow * 2,
      0.5,
      0.5,
      (ctx, k) => drawGlow(ctx, PIECE.glow * 2 * k)
    );
    return out;
  }
  var TIDE_GAP = 0.55;
  var BELLY_ACROSS = 1 - 0.72;
  function tidePlacements(P, yaw, phase, water) {
    const pal = TIDE[phase];
    const { segs, head } = tideBody(P, yaw);
    const out = [];
    const lines = [];
    const sp = tideProject;
    const RUN = 5;
    for (let r0 = 0; r0 < SEGMENTS; r0 += RUN) {
      const run = segs.slice(r0, r0 + RUN + 1);
      for (let n = run.length - 1; n > 0; n--) {
        const a = run[n - 1], b = run[n];
        const pa = sp(a.w), pb = sp(b.w);
        const gap = Math.hypot(pb.x - pa.x, pb.y - pa.y) / Math.min(a.r, b.r);
        const extra = Math.min(3, Math.ceil(gap / TIDE_GAP) - 1);
        for (let m = extra; m >= 1; m--) {
          const t = m / (extra + 1);
          const right = norm(add(mul(a.right, 1 - t), mul(b.right, t))), d = norm(add(mul(a.d, 1 - t), mul(b.d, t)));
          run.splice(n, 0, {
            i: a.i + t,
            w: add(mul(a.w, 1 - t), mul(b.w, t)),
            d,
            r: lerp(a.r, b.r, t),
            right,
            up: norm(cross(right, d)),
            mid: m
          });
        }
      }
      run.sort((a, b) => a.w.z - b.w.z);
      const runZ = run.reduce((a, s) => a + s.w.z, 0) / run.length;
      const kz = 6 / run.length;
      run.forEach((s, k0) => {
        const k = k0 * kz;
        const wl = water(s.w.x, s.w.z);
        if (wl !== null && s.w.y < wl - s.r * 1.05) return;
        const c = sp(s.w), sc = s.r / PIECE.seg;
        const waterY = wl === null ? void 0 : sp(v3(s.w.x, wl, s.w.z)).y;
        const dup = s.i === r0 + RUN && !s.mid ? "b" : "";
        const tag = s.mid ? `${Math.floor(s.i)}m${s.mid}` : `${s.i}`;
        out.push({
          key: `line${tag}${dup}`,
          piece: "seg-line",
          x: c.x,
          y: c.y,
          rot: 0,
          sx: sc,
          sy: sc,
          alpha: 1,
          z: runZ - 0.45 + k * 0.01,
          waterY
        });
        out.push({
          key: `seg${tag}${dup}`,
          piece: "seg",
          x: c.x,
          y: c.y,
          rot: 0,
          sx: sc,
          sy: sc,
          alpha: 1,
          z: runZ - 0.2 + k * 0.05,
          waterY
        });
        const belly = mul(s.up, -1), facing = dot(belly, VIEW);
        if (facing > -0.35 && !s.mid) {
          const o = sp(belly), ol = Math.hypot(o.x, o.y) || 1;
          const bx = o.x / ol * 0.62 * s.r, by = o.y / ol * 0.62 * s.r;
          let ax = 0, ay = 0, best = 0;
          for (const j of [s.i - 1, s.i + 1]) {
            if (j < 0 || j >= SEGMENTS) continue;
            const nb = sp(segs[j].w), nx = nb.x - c.x, ny = nb.y - c.y, nl = nx * nx + ny * ny || 1;
            const t = clamp2((bx * nx + by * ny) / nl);
            if (t * Math.sqrt(nl) > best) {
              best = t * Math.sqrt(nl);
              ax = nx * t;
              ay = ny * t;
            }
          }
          const px = bx - ax, py = by - ay, pl = Math.hypot(px, py), keep = pl > BELLY_ACROSS * s.r ? BELLY_ACROSS * s.r / pl : 1;
          out.push({
            key: `belly${tag}${dup}`,
            piece: "belly",
            x: c.x + ax + px * keep,
            y: c.y + ay + py * keep,
            rot: 0,
            sx: sc,
            sy: sc,
            alpha: clamp2((facing + 0.35) * 1.6),
            z: runZ - 0.18 + k * 0.05,
            waterY
          });
        }
        if (pal.mark && s.i % 2 === 0 && s.i > 3 && dot(s.up, VIEW) > -0.1) {
          const o = sp(s.up), ol = Math.hypot(o.x, o.y) || 1;
          out.push({
            key: `mark${tag}${dup}`,
            piece: "glow",
            x: c.x + o.x / ol * s.r * 0.5,
            y: c.y + o.y / ol * s.r * 0.5,
            rot: 0,
            sx: 0.22,
            sy: 0.22,
            alpha: 0.5 + 0.3 * Math.sin(P.clock * 3 - s.i * 0.5),
            z: 0,
            glow: true,
            tint: pal.mark
          });
        }
      });
    }
    const finAt = (key, piece, from, to, native, width, z) => {
      const a = sp(from), b = sp(to);
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
      out.push({
        key,
        piece,
        x: a.x,
        y: a.y,
        rot: Math.atan2(dx, -dy),
        sx: width,
        sy: Math.max(0.05, l / native),
        alpha: 1,
        z
      });
    };
    for (const s of segs) {
      const f = s.i / (SEGMENTS - 1);
      if (f <= 0.25 || f >= 0.97 || s.i % 2 !== 1) continue;
      const size = 18 + 12 * Math.sin(f * Math.PI);
      const base = add(s.w, mul(s.up, s.r * 0.75));
      const wl = water(base.x, base.z);
      if (wl !== null && base.y < wl) continue;
      const tip = add(add(base, mul(s.up, size)), mul(s.d, -size * 0.7));
      const front = dot(s.up, VIEW) > 0.15;
      finAt(
        `fin${s.i}`,
        "fin",
        base,
        tip,
        PIECE.fin,
        size / 18,
        s.w.z + (front ? 0.5 : -0.5)
      );
    }
    const tail = segs[0];
    const tw = water(tail.w.x, tail.w.z);
    if (tw === null || tail.w.y > tw - 6) {
      const sway = Math.sin(P.clock * 3) * 0.25;
      [-1, -0.35, 0.35, 1].forEach((k, j) => {
        const dir = norm(
          add(
            add(mul(tail.d, -1), mul(tail.up, 0.55 + k * 0.5 + sway)),
            mul(tail.right, k * 0.45)
          )
        );
        finAt(
          `ray${j}`,
          "ray",
          tail.w,
          add(tail.w, mul(dir, 62)),
          PIECE.ray,
          1,
          tail.w.z - 0.3 - j * 1e-3
        );
      });
    }
    const { F, R, U, at } = head;
    let pearlScreen = sp(head.pearl);
    const hz = head.w.z;
    const hw = water(head.w.x, head.w.z);
    if (hw === null || head.w.y > hw - 30) {
      const faceN = dot(F, VIEW);
      const behind = (w) => w.z < hz;
      const maneBehind = behind(add(head.w, mul(F, -1)));
      const backZ = hz - 0.6, frontZ = hz + 0.3;
      [-1, -0.5, 0, 0.5, 1].forEach((k, j) => {
        const base = at(
          -12 - (1 - Math.abs(k)) * 4,
          k * 17,
          11 - Math.abs(k) * 7
        );
        const dir = norm(
          add(
            add(
              mul(F, -1),
              mul(
                U,
                0.28 + (1 - Math.abs(k)) * 0.32 + Math.sin(P.clock * 2.4 + k * 2) * 0.1
              )
            ),
            mul(R, k * 0.95)
          )
        );
        finAt(
          `mane${j}`,
          "mane",
          base,
          add(base, mul(dir, (34 - Math.abs(k) * 8) * HS)),
          PIECE.mane,
          1,
          maneBehind ? backZ + j * 1e-3 : frontZ + j * 1e-3
        );
      });
      const look = P.dizzy > 0.5 ? "dizzy" : P.closed > 0.5 || P.lid > 0.92 ? "shut" : P.lid > 0.55 ? "squint" : P.anger > 0.9 && P.lid < 0.15 ? "wide" : "glare";
      const headYaw = Math.atan2(F.x, F.z);
      const lying = P.flat > 0.5 && (look === "dizzy" || look === "shut");
      const shown = lying ? Math.sign(headYaw || 1) * Math.min(Math.abs(headYaw), 100 * Math.PI / 180) : headYaw;
      [-1, 1].forEach((k) => {
        const base = at(-4, k * 12, 18);
        const tip = add(
          base,
          mul(add(add(mul(F, -42), mul(U, 34)), mul(R, k * 18)), HS)
        );
        finAt(
          `horn${k}`,
          "horn",
          base,
          tip,
          PIECE.horn,
          HS * k,
          maneBehind ? backZ + 0.01 : frontZ + 0.01
        );
      });
      const hc = sp(at(4, 0, 4));
      const big = (q) => ({
        ...q,
        x: hc.x + (q.x - hc.x) * HEAD_K,
        y: hc.y + (q.y - hc.y) * HEAD_K
      });
      const built = TIDE_FACE.face(
        {
          x: hc.x,
          y: hc.y,
          z: hz,
          yaw: shown,
          pitch: -Math.asin(clamp2(F.y, -1, 1)) * 0.6,
          roll: (P.headRoll || 0) * Math.cos(headYaw)
        },
        {
          look,
          brow: P.anger > 0.5 ? "angry" : "calm",
          mouth: P.jaw > 0.4 ? "open" : P.jaw > 0.12 ? "half" : "closed"
        }
      );
      const side = built.side;
      const names = {
        head: "cran",
        eyen: `eye${side}`,
        eyef: `eye${-side}`,
        brown: `brow${side}`,
        browf: `brow${-side}`,
        glintn: `eyeglint${side}`,
        glintf: `eyeglint${-side}`
      };
      for (const q of built.placements)
        out.push({
          ...big(q),
          sx: q.sx * HEAD_K,
          sy: q.sy * HEAD_K,
          key: names[q.key] ?? q.key
        });
      const S = TIDE_SPEC;
      const eyeV = S.lines.eye + built.nod;
      if (look !== "shut" && look !== "dizzy")
        for (const e of built.eyes) {
          const q = big(built.at(e.u, eyeV));
          out.push({
            key: `eyeglow${e.id === "n" ? side : -side}`,
            piece: "glow",
            x: q.x,
            y: q.y,
            rot: 0,
            sx: 0.5,
            sy: 0.5,
            alpha: phase === 3 ? 0.55 : 0.2 + P.anger * 0.1,
            z: 0,
            glow: true,
            tint: pal.iris[0] << 16 | pal.iris[1] << 8 | pal.iris[2]
          });
        }
      let pearlAt = built.feats.pearl ? big(built.at(built.feats.pearl.u, built.feats.pearl.v)) : null;
      if (!pearlAt) {
        pearlAt = big(built.at(0, S.lines.pearl + 2));
        out.push({
          key: "pearl",
          piece: "pearl",
          x: pearlAt.x,
          y: pearlAt.y,
          rot: 0,
          sx: HEAD_K,
          sy: HEAD_K,
          alpha: 1,
          z: hz + 0.04
        });
        const turn = Math.abs(Math.atan2(Math.sin(shown), Math.cos(shown)));
        const m = big(
          built.at(tideCentre(S.lines.nose) * Math.sin(turn), S.lines.nose)
        );
        for (const key of ["snout", "jaw"])
          out.push({
            key,
            piece: "snout-back",
            x: m.x,
            y: m.y,
            rot: 0,
            sx: side * HEAD_K,
            sy: HEAD_K,
            alpha: 1,
            z: hz - 0.01
          });
      }
      pearlScreen = pearlAt;
      const g = P.pearl + P.exposed * 0.8;
      out.push({
        key: "pearlglow",
        piece: "glow",
        x: pearlAt.x,
        y: pearlAt.y,
        rot: 0,
        sx: 0.55 + g * 0.4,
        sy: 0.55 + g * 0.4,
        alpha: clamp2(0.25 + g * 0.45),
        z: 0,
        glow: true,
        tint: pal.glow
      });
      const nose = built.feats.snout;
      if (nose) {
        const front = built.view === "front";
        for (const k of front ? [-1, 1] : [-1]) {
          const pts = [];
          for (let j = 0; j <= 8; j++) {
            const f = j / 8;
            const wave = Math.sin(P.clock * 2.2 + f * 4 + k) * 2.5 * f;
            const out2 = 15 * Math.sin(f * 2.3) + wave, down = 4 + 19 * f - 7 * f * f;
            pts.push(
              front ? big(built.at(nose.u + k * (13 + out2), nose.v + down)) : big(built.at(nose.u - 11 - out2, nose.v + 1 + down))
            );
          }
          lines.push({ pts, width: 3.2, color: pal.line, front: true });
          lines.push({ pts, width: 1.7, color: pal.finLight, front: true });
        }
        const chinU = front ? 0 : nose.u * 0.45;
        for (const k of front ? [-1, 0, 1] : [-1, 0]) {
          const pts = [];
          for (let j = 0; j <= 6; j++) {
            const f = j / 6;
            const sway = Math.sin(P.clock * 1.8 + f * 3 + k) * 2.2 * f;
            pts.push(
              big(
                built.at(
                  chinU + k * (front ? 5 : 4) + k * 4 * f + sway - (front ? 0 : 3 * f),
                  H_BOT - 3 + (14 - Math.abs(k) * 3) * f
                )
              )
            );
          }
          lines.push({ pts, width: 4.6, color: pal.line, front: true });
          lines.push({ pts, width: 3, color: "#f1e2bd", front: true });
        }
      }
    }
    return {
      placements: out,
      lines,
      segs,
      head,
      headScreen: sp(head.w),
      pearlScreen
    };
  }

  // tools/tide-entry.ts
  var smooth2 = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  function pose(c) {
    const stranded = !!(c.exposed || c.stagger);
    const P = tidePose({
      clock: c.clock,
      phase: c.phase,
      reduced: !!c.reduced,
      windKind: c.windKind,
      windup: c.windup || 0,
      castKind: c.castKind,
      castAge: c.castAge === void 0 ? 99 : c.castAge,
      stranded,
      stagger: !!c.stagger,
      hurt: c.hurt || 0,
      dead: !!c.dead,
      rise: 1,
      deathSink: c.dead ? smooth2(0, 1.2, c.deadAge === void 0 ? 9 : c.deadAge) : 0,
      roarAge: c.roarAge === void 0 ? 99 : c.roarAge
    });
    P.flat = stranded && !c.dead ? 1 : 0;
    P.spin = 0;
    P.look = P.dizzy > 0.5 ? "dizzy" : P.closed > 0.5 || P.lid > 0.92 ? "shut" : P.lid > 0.55 ? "squint" : P.anger > 0.9 && P.lid < 0.15 ? "wide" : "glare";
    P.mouth = P.jaw > 0.3 ? "open" : "closed";
    return P;
  }
  function placements(P, yaw, phase) {
    const dry = P.flat > 0.5;
    const r = tidePlacements(P, yaw, phase, () => dry ? null : 0);
    const headZ = r.head.w.z;
    const HEAD = /^(cran|eye|brow|muzzle|pearl$|jaw|snout)/;
    const list = r.placements.map((p) => ({ ...p, face: HEAD.test(p.key) }));
    for (const l of r.lines)
      list.push({ line: l.pts, color: l.color, width: l.width, z: l.front ? headZ + 0.07 : headZ - 0.6 + 5e-4, face: true });
    list.sort((a, b) => a.z - b.z);
    const { F } = r.head;
    const headYaw = Math.atan2(F.x, F.z);
    const cran = r.placements.find((p) => p.key === "cran");
    const hx = cran ? cran.x : r.headScreen.x, hy = cran ? cran.y : r.headScreen.y;
    const hv = headView(headYaw);
    const S = TIDE_SPEC;
    let guide = null;
    if (cran && hv.view !== "back" && hv.view !== "backtq") {
      const roll = cran.rot, cr = Math.cos(roll), sr = Math.sin(roll);
      const side = hv.view === "front" ? 1 : hv.side;
      const at = (u, v) => ({ x: hx + u * side * cr - v * sr, y: hy + u * side * sr + v * cr });
      let pf = TIDE_FACE.faceYaw(hv.turn);
      if (hv.view === "front") pf *= hv.side;
      const sinF = hv.view === "side" ? 1 : Math.sin(pf);
      const eyes = r.placements.filter((p) => /^eye-?1$/.test(p.key));
      const nod = eyes.length ? 0 : 0;
      const centre = [];
      for (let v = S.top + 1; v <= S.bot - 1; v += 2) centre.push(at(S.centreLine(v) * sinF, v + nod));
      const [l, rr] = S.skullEdge(hv.view, S.lines.eye);
      const line = (v, k = 1) => {
        const [a, b] = S.skullEdge(hv.view, v);
        return [at(a * k, v), at(b * k, v)];
      };
      guide = { centre, eyeLine: [at(l, S.lines.eye), at(rr, S.lines.eye)], others: [line(S.lines.brow, 0.9), line(S.lines.nose, 0.9), line(S.lines.pearl, 0.9)], eyes: eyes.map((p) => ({ x: p.x, y: p.y })) };
    }
    return {
      placements: list,
      heads: [{ x: hx, y: hy, view: cran ? cran.piece.replace("head-", "") : hv.view, side: headYaw < 0 ? -1 : 1, guide, marks: { top: S.top, eye: S.lines.eye, bot: S.bot } }],
      shadows: [[0, 0, 70, 20]]
    };
  }
  var boss = {
    id: "tidewyrm",
    title: "Tidewyrm",
    lede: "The water dragon that is already in the game, with its head redrawn: a rounded head with a short snout, sleepy slit eyes, pink ear fins and the pearl on its brow, one drawing per view. The snout's far edge tucks the far eye.",
    attacks: [["dive", "Dive"], ["wave", "Tidal Wave"], ["bubbles", "Bubbles"], ["hightide", "High Tide"], ["undertow", "Undertow"], ["prison", "Water Prison"]],
    pose,
    placements,
    pieces: tidePieces,
    faces: [],
    face: { ...TIDE_SPEC, eyeOrbit: TIDE_SPEC.eyeOrbit },
    tideFace: TIDE_FACE,
    looks: ["glare", "wide", "squint", "shut", "dizzy"],
    mouths: ["closed"],
    stage: { w: 460, h: 330, ground: 0.8, closeW: 130, closeH: 100, sheetGap: 300, sheetH: 300, closeGap: 110, closeSheetH: 120, champion: [-170, 40], shadow: [70, 20], floor: ["#06141c", "#0c2a38", "120,220,255"] },
    occluder: "muzzle-tq: the bridge and far side of the snout"
  };
  return __toCommonJS(tide_entry_exports);
})();
