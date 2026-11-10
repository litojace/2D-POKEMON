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

  // ../../apps/client/src/boss-vector-tide.ts
  var TAU2 = Math.PI * 2;
  var clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  var lerp = (a, b, t) => a + (b - a) * t;
  var smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
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
      h += P.coil * lying * 0.16 + P.sway * Math.sin(f * TAU2 * 1.5 - P.swimPhase) * 0.13 * (0.4 + lying) + P.flopK * Math.sin(f * TAU2 * 1.1 + P.flopPhase) * 0.2 + (1 - lying) * Math.sin(f * TAU2 * 1.4 + P.clock * 0.7) * 0.11 * (1 - P.flat);
      hs.push(h);
      const humps = P.humps * Math.sin(f * TAU2 * 2.2 - P.swimPhase * 0.8) * 0.42 * lying;
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
    const w = clamp(c.windup);
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
    P.sink = (1 - clamp(c.rise)) * 300;
    if (c.dead) {
      const s = clamp(c.deathSink);
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
  function wedge(ctx, k, L, r0, r1, pad, fill) {
    const x0 = (r0 + pad) * k, y = (r0 + pad) * k, x1 = x0 + L * k;
    const a = Math.asin(clamp((r0 - r1) / L, -1, 1));
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x0, y, r0 * k, Math.PI / 2 + a, Math.PI * 1.5 - a);
    ctx.arc(x1, y, r1 * k, -Math.PI / 2 - a, Math.PI / 2 + a);
    ctx.closePath();
    ctx.fill();
  }
  var TIDE_FACE = {
    /** How far round from the centre line each eye sits, and the circle they ride. */
    eyeAz: 40 * Math.PI / 180,
    eyeOrbit: 20,
    /** How far the face trails the skull at three-quarter. */
    lag: 18 * Math.PI / 180,
    /** The far eye's outer corner lifts by this, always. */
    farLift: 6 * Math.PI / 180,
    /** Clear space kept between an eye and the head's outline. */
    margin: 1.2,
    /** The least clear space between the two eyes. */
    gap: 2,
    /** Each view's eye: its width as a share of the full drawing, and its half-width. */
    eye: {
      front: { w: 0.55, hw: 8.6 },
      near: { w: 0.55, hw: 8.6 },
      far: { w: 0.4, hw: 5.2 },
      side: { w: 0.63, hw: 9.8 }
    }
  };
  var eyePieceName = (view, look) => view === "front" ? `eye-${look}` : `eye-${view}-${look}`;
  function tideEyes(yaw, edges) {
    const w = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    const turn = Math.abs(w), deg = turn * 180 / Math.PI;
    const F = TIDE_FACE;
    if (deg >= 112.5) return { side: w < 0 ? -1 : 1, view: "back", eyes: [] };
    const view = deg < 22.5 ? "front" : deg < 67.5 ? "tq" : "side";
    let side = w < 0 ? -1 : 1;
    let pf = turn - F.lag * Math.sin(2 * Math.min(turn, Math.PI / 2));
    if (view === "front") {
      pf *= side;
      side = 1;
    }
    const list = view === "front" ? [
      ["front", -F.eyeAz, false, "near"],
      ["front", F.eyeAz, true, "far"]
    ] : view === "tq" ? [
      ["near", -F.eyeAz, false, "near"],
      ["far", F.eyeAz, false, "far"]
    ] : [["side", -F.eyeAz, false, "near"]];
    const eyes = list.map(([v, az, flip, which]) => {
      const hw = F.eye[v].hw;
      let u = F.eyeOrbit * Math.sin(pf + az);
      if (edges) {
        const lo = edges.lo * side + (side < 0 ? 0 : 0), hi = edges.hi * side;
        const a = Math.min(lo, hi) + hw + F.margin, b = Math.max(lo, hi) - hw - F.margin;
        u = a > b ? (a + b) / 2 : clamp(u, a, b);
      }
      return {
        view: v,
        which,
        u,
        hw,
        // the far drawing has its inner corner on the other side
        flip: flip !== (v === "far"),
        lift: v === "far" ? -F.farLift : 0
      };
    });
    if (view === "tq") {
      const [near, far] = eyes;
      const least = near.u + near.hw + far.hw + F.gap;
      if (far.u < least)
        far.u = edges ? Math.min(
          least,
          Math.max(edges.lo * side, edges.hi * side) - far.hw - F.margin
        ) : least;
    }
    return { side, view, eyes };
  }
  function drawEyePiece(ctx, k, look, pal, view = "side") {
    const s = { x: 15 * k, y: 15 * k };
    const ew = 10.5 * HS * k * (TIDE_FACE.eye[view].w / 0.63) * 0.63, eh = 9 * HS * k;
    const cut = view === "far" ? s.x + ew * 0.66 : null;
    const bridge = () => {
      ctx.beginPath();
      ctx.moveTo(cut - eh * 0.1, s.y - eh * 1.2);
      ctx.quadraticCurveTo(
        cut + eh * 0.16,
        s.y,
        cut - eh * 0.04,
        s.y + eh * 1.2
      );
    };
    if (cut !== null && look !== "shut" && look !== "dizzy") {
      ctx.save();
      bridge();
      ctx.lineTo(-10 * k, s.y + eh * 1.2);
      ctx.lineTo(-10 * k, s.y - eh * 1.2);
      ctx.closePath();
      ctx.clip();
      drawEyeShape(ctx, k, look, pal, s, ew, eh, view);
      ctx.restore();
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1.8 * k;
      ctx.lineCap = "round";
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, s.y - eh * 0.8, 60 * k, eh * 1.55);
      ctx.clip();
      bridge();
      ctx.stroke();
      ctx.restore();
      return;
    }
    drawEyeShape(ctx, k, look, pal, s, ew, eh, view);
  }
  function drawEyeShape(ctx, k, look, pal, s, ew, eh, view) {
    const gaze = view === "far" ? -0.5 : view === "front" ? 0.6 : 1;
    const anger = look === "squint" ? 0.7 : look === "wide" ? 1 : 0.8;
    const lid = look === "glare" ? 0.25 : look === "wide" ? 0.05 : 0.7;
    if (look === "dizzy") {
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1.8 * k;
      ctx.beginPath();
      for (let a = 0; a < 9; a += 0.25) {
        const r = a * 0.95 * k;
        const x = s.x + Math.cos(a) * r, y = s.y + Math.sin(a) * r * 0.9;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }
    if (look === "shut") {
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 2.2 * k;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s.x - ew, s.y);
      ctx.quadraticCurveTo(s.x, s.y + eh * 0.6, s.x + ew, s.y);
      ctx.stroke();
      return;
    }
    const tilt = -0.28;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, ew * 1.1, eh * 0.82, tilt, 0, TAU2);
    ctx.fillStyle = "#1a0c06";
    ctx.fill();
    ctx.clip();
    const iris = pal.iris;
    const ig = ctx.createRadialGradient(
      s.x,
      s.y + eh * 0.2,
      0,
      s.x,
      s.y,
      ew * 1.1
    );
    ig.addColorStop(
      0,
      rgb([iris[0] + 255 >> 1, iris[1] + 255 >> 1, iris[2] + 255 >> 1])
    );
    ig.addColorStop(1, rgb(iris));
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.ellipse(s.x + ew * 0.08, s.y + eh * 0.05, ew * 0.98, eh * 0.9, 0, 0, TAU2);
    ctx.fill();
    ctx.fillStyle = "#0b0503";
    const slit = clamp(0.32 - anger * 0.14, 0.14, 0.32);
    ctx.beginPath();
    ctx.ellipse(
      s.x + ew * 0.12 * gaze,
      s.y + eh * 0.05,
      // the slit keeps its width whatever the eye's (it is not squeezed)
      10.5 * HS * k * 0.63 * slit,
      eh * 0.78,
      0,
      0,
      TAU2
    );
    ctx.fill();
    const top = s.y - eh - 1, lidY = s.y - eh + lid * eh * 2, slant = anger * eh * 1.15;
    ctx.fillStyle = pal.mid;
    ctx.beginPath();
    ctx.moveTo(s.x - ew - 2, top);
    ctx.lineTo(s.x + ew + 2, top);
    ctx.lineTo(s.x + ew + 2, lidY + slant);
    ctx.lineTo(s.x - ew - 2, lidY - slant * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.moveTo(s.x - ew - 2, lidY - slant * 0.3);
    ctx.lineTo(s.x + ew + 2, lidY + slant);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 1.8 * k;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, ew * 1.1, eh * 0.82, tilt, 0, TAU2);
    ctx.stroke();
    const bOut = {
      x: s.x - ew * 1.45,
      y: s.y - eh * 1.25 - (1 - anger) * 2.5 * k
    };
    const bIn = { x: s.x + ew * 1, y: s.y - eh * 0.95 + anger * eh * 0.55 };
    const th = (3.2 + anger * 1.6) * HS * k;
    ctx.fillStyle = pal.dark;
    ctx.lineWidth = 1.4 * k;
    ctx.beginPath();
    ctx.moveTo(bOut.x, bOut.y - th * 0.6);
    ctx.quadraticCurveTo(
      (bOut.x + bIn.x) / 2,
      Math.min(bOut.y, bIn.y) - th * 1.2,
      bIn.x,
      bIn.y - th * 0.4
    );
    ctx.lineTo(bIn.x, bIn.y + th * 0.5);
    ctx.quadraticCurveTo(
      (bOut.x + bIn.x) / 2,
      Math.min(bOut.y, bIn.y) + th * 0.1,
      bOut.x,
      bOut.y + th * 0.3
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (const [f, l] of [
      [0.05, 1.5],
      [0.35, 1]
    ]) {
      const x = lerp(bOut.x, bIn.x, f), y = lerp(bOut.y, bIn.y, f) - th * 0.6;
      ctx.beginPath();
      ctx.moveTo(x - ew * 0.18, y + th * 0.3);
      ctx.lineTo(x - ew * 0.75 * l, y - eh * 0.75 * l);
      ctx.lineTo(x + ew * 0.2, y + th * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
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
      ctx.arc(c, c, r, 0, TAU2);
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
      ctx.ellipse(c - r * 0.35, c - r * 0.5, r * 0.32, r * 0.16, -0.5, 0, TAU2);
      ctx.fill();
    });
    pieceOf("seg-line", S * 2 + 6, S * 2 + 6, 0.5, 0.5, (ctx, k) => {
      ctx.fillStyle = pal.line;
      ctx.beginPath();
      ctx.arc((S + 3) * k, (S + 3) * k, (S + 1.6) * k, 0, TAU2);
      ctx.fill();
    });
    pieceOf("belly", S * 1.5, S * 1.5, 0.5, 0.5, (ctx, k) => {
      const c = S * 0.75 * k, r = S * 0.72 * k;
      const g = ctx.createRadialGradient(c - r * 0.25, c - r * 0.25, 0, c, c, r);
      g.addColorStop(0, pal.belly);
      g.addColorStop(1, pal.bellyDark);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, TAU2);
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
    pieceOf(
      "frill",
      20,
      PIECE.frill + 2,
      0.5,
      1,
      (ctx, k) => finShape(ctx, k, 20, PIECE.frill + 2, pal, 2)
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
    const skin = (ctx, x0, y0, x1, y1) => {
      const g = ctx.createLinearGradient(x0, y0, x0 + (x1 - x0) * 0.45, y1);
      g.addColorStop(0, pal.light);
      g.addColorStop(0.5, pal.mid);
      g.addColorStop(1, pal.dark);
      return g;
    };
    const D = PIECE.disc;
    pieceOf("disc", D * 2 + 2, D * 2 + 2, 0.5, 0.5, (ctx, k) => {
      const c = (D + 1) * k;
      ctx.fillStyle = skin(ctx, c - D * k, c - D * k, c + D * k, c + D * k);
      ctx.beginPath();
      ctx.arc(c, c, D * k, 0, TAU2);
      ctx.fill();
    });
    pieceOf("disc-line", D * 2 + 6, D * 2 + 6, 0.5, 0.5, (ctx, k) => {
      ctx.fillStyle = pal.line;
      ctx.beginPath();
      ctx.arc((D + 3) * k, (D + 3) * k, (D + 1.8) * k, 0, TAU2);
      ctx.fill();
    });
    const sr0 = 15 * HS, sr1 = 9 * HS;
    const snoutW = PIECE.snout + sr0 + sr1 + 4, snoutH = sr0 * 2 + 4;
    pieceOf("snout", snoutW, snoutH, (sr0 + 2) / snoutW, 0.5, (ctx, k) => {
      wedge(
        ctx,
        k,
        PIECE.snout,
        sr0,
        sr1,
        2,
        skin(ctx, 0, 0, snoutW * k * 0.6, snoutH * k)
      );
      ctx.strokeStyle = "rgba(10,60,70,0.35)";
      ctx.lineWidth = 1.2 * k;
      for (const f of [0.35, 0.55, 0.75]) {
        ctx.beginPath();
        ctx.arc(
          (sr0 + 2 + PIECE.snout * f) * k,
          (snoutH / 2 - 5) * k,
          4 * HS * k,
          0.15 * Math.PI,
          0.85 * Math.PI
        );
        ctx.stroke();
      }
    });
    pieceOf(
      "snout-line",
      snoutW + 4,
      snoutH + 4,
      (sr0 + 4) / (snoutW + 4),
      0.5,
      (ctx, k) => wedge(ctx, k, PIECE.snout, sr0 + 1.8, sr1 + 1.8, 2.2, pal.line)
    );
    const jr0 = 14 * HS, jr1 = 7.5 * HS;
    const jawW = PIECE.jaw + jr0 + jr1 + 4, jawH = jr0 * 2 + 4;
    pieceOf("jaw", jawW, jawH, (jr0 + 2) / jawW, 0.5, (ctx, k) => {
      const g = ctx.createLinearGradient(0, 0, 0, jawH * k);
      g.addColorStop(0, pal.belly);
      g.addColorStop(1, pal.bellyDark);
      wedge(ctx, k, PIECE.jaw, jr0, jr1, 2, g);
    });
    pieceOf(
      "jaw-line",
      jawW + 4,
      jawH + 4,
      (jr0 + 4) / (jawW + 4),
      0.5,
      (ctx, k) => wedge(ctx, k, PIECE.jaw, jr0 + 1.8, jr1 + 1.8, 2.2, pal.line)
    );
    pieceOf("mouth", PIECE.jaw, 24, 0, 0.5, (ctx, k) => {
      ctx.fillStyle = "#5a1430";
      ctx.beginPath();
      ctx.moveTo(0, 12 * k);
      ctx.lineTo(PIECE.jaw * k, 0);
      ctx.lineTo(PIECE.jaw * k, 24 * k);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff7aa0";
      ctx.beginPath();
      ctx.ellipse(PIECE.jaw * 0.55 * k, 13 * k, 9 * k, 4.5 * k, 0, 0, TAU2);
      ctx.fill();
    });
    for (const view of ["front", "near", "far", "side"])
      for (const look of [
        "glare",
        "wide",
        "squint",
        "shut",
        "dizzy"
      ])
        pieceOf(
          eyePieceName(view, look),
          30 * HS,
          26 * HS,
          15 / (30 * HS),
          15 / (26 * HS),
          (ctx, k) => drawEyePiece(ctx, k, look, pal, view)
        );
    pieceOf("eye-glint", 6, 6, 0.5, 0.5, (ctx, k) => {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(3 * k, 3 * k, 1.9 * k, 0, TAU2);
      ctx.fill();
    });
    pieceOf("pearl", 22 * HS, 18 * HS, 0.5, 0.5, (ctx, k) => {
      const r = 6.8 * HS * k, cx = 11 * HS * k, cy = 8 * HS * k;
      ctx.fillStyle = "#e7b44a";
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1.4 * k;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2.5 * k, r * 1.3, r * 0.75, 0, 0, TAU2);
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
      ctx.arc(cx, cy, r, 0, TAU2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.25, 0, TAU2);
      ctx.fill();
    });
    pieceOf("fang", 6, 14, 0.5, 0, (ctx, k) => {
      ctx.fillStyle = "#fffaf0";
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1.1 * k;
      ctx.beginPath();
      ctx.moveTo(0.6 * k, 0.6 * k);
      ctx.lineTo(5.4 * k, 0.6 * k);
      ctx.quadraticCurveTo(4 * k, 8 * k, 3 * k, 13.2 * k);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
    pieceOf("nostril", 8, 6, 0.5, 0.5, (ctx, k) => {
      ctx.fillStyle = pal.line;
      ctx.beginPath();
      ctx.ellipse(4 * k, 3 * k, 3.2 * k, 2 * k, 0, 0, TAU2);
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
  function tidePlacements(P, yaw, phase, water) {
    const pal = TIDE[phase];
    const { segs, head } = tideBody(P, yaw);
    const out = [];
    const lines = [];
    const sp = tideProject;
    const RUN = 5;
    for (let r0 = 0; r0 < SEGMENTS; r0 += RUN) {
      const run = segs.slice(r0, r0 + RUN + 1).sort((a, b) => a.w.z - b.w.z);
      const runZ = run.reduce((a, s) => a + s.w.z, 0) / run.length;
      run.forEach((s, k) => {
        const wl = water(s.w.x, s.w.z);
        if (wl !== null && s.w.y < wl - s.r * 1.05) return;
        const c = sp(s.w), sc = s.r / PIECE.seg;
        const waterY = wl === null ? void 0 : sp(v3(s.w.x, wl, s.w.z)).y;
        const dup = s.i === r0 + RUN ? "b" : "";
        out.push({
          key: `line${s.i}${dup}`,
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
          key: `seg${s.i}${dup}`,
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
        if (facing > -0.35) {
          const o = sp(belly), ol = Math.hypot(o.x, o.y) || 1;
          out.push({
            key: `belly${s.i}${dup}`,
            piece: "belly",
            x: c.x + o.x / ol * s.r * 0.62,
            y: c.y + o.y / ol * s.r * 0.62,
            rot: 0,
            sx: sc,
            sy: sc,
            alpha: clamp((facing + 0.35) * 1.6),
            z: runZ - 0.18 + k * 0.05,
            waterY
          });
        }
        if (pal.mark && s.i % 2 === 0 && s.i > 3 && dot(s.up, VIEW) > -0.1) {
          const o = sp(s.up), ol = Math.hypot(o.x, o.y) || 1;
          out.push({
            key: `mark${s.i}${dup}`,
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
          add(base, mul(dir, (50 - Math.abs(k) * 12) * HS)),
          PIECE.mane,
          1,
          maneBehind ? backZ + j * 1e-3 : frontZ + j * 1e-3
        );
      });
      [-1, 1].forEach((k) => {
        const base = at(-2, k * 11, 16);
        const tip = add(
          base,
          mul(add(add(mul(F, -45), mul(U, 30)), mul(R, k * 16)), HS)
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
      [-1, 1].forEach((k) => {
        const base = at(-4, k * 18, -5);
        const tip = add(
          base,
          mul(
            norm(
              add(
                add(mul(F, -0.8), mul(R, k * 0.75)),
                mul(U, -0.15 + Math.sin(P.clock * 2 + k) * 0.08)
              )
            ),
            30 * HS
          )
        );
        finAt(
          `frill${k}`,
          "frill",
          base,
          tip,
          PIECE.frill,
          HS,
          behind(tip) ? backZ + 0.02 : frontZ - 0.25
        );
      });
      const disc = (key, w, r, z, piece = "disc") => {
        const c = sp(w);
        out.push({
          key,
          piece,
          x: c.x,
          y: c.y,
          rot: 0,
          sx: r / PIECE.disc,
          sy: r / PIECE.disc,
          alpha: 1,
          z
        });
      };
      const bar = (key, piece, from, dir, length, z, sy = 1) => {
        const a = sp(from), b = sp(add(from, mul(dir, length)));
        out.push({
          key,
          piece,
          x: a.x,
          y: a.y,
          rot: Math.atan2(b.y - a.y, b.x - a.x),
          sx: Math.max(0.02, Math.hypot(b.x - a.x, b.y - a.y) / length),
          sy,
          alpha: 1,
          z
        });
      };
      const cran = at(-6, 0, 4), brow = at(12, 0, 9), snoutBase = at(14, 0, 4);
      disc("cran-line", cran, 22 * HS, hz - 0.3, "disc-line");
      disc("brow-line", brow, 19 * HS, hz - 0.3, "disc-line");
      bar("snout-line", "snout-line", snoutBase, F, PIECE.snout, hz - 0.3);
      bar("jaw-line", "jaw-line", head.hinge, head.jawDir, PIECE.jaw, hz - 0.3);
      if (P.jaw > 0.05)
        bar(
          "mouth",
          "mouth",
          head.hinge,
          norm(add(F, head.jawDir)),
          PIECE.jaw,
          hz - 0.2,
          clamp(P.jaw * 1.4, 0.2, 1.2)
        );
      bar("jaw", "jaw", head.hinge, head.jawDir, PIECE.jaw, hz - 0.15);
      disc("cran", cran, 22 * HS, hz - 0.1);
      disc("brow", brow, 19 * HS, hz - 0.1);
      bar("snout", "snout", snoutBase, F, PIECE.snout, hz - 0.09);
      const look = P.dizzy > 0.5 ? "dizzy" : P.closed > 0.5 || P.lid > 0.92 ? "shut" : P.lid > 0.55 ? "squint" : P.anger > 0.9 && P.lid < 0.15 ? "wide" : "glare";
      const axis = sp(at(0, 0, 9));
      const headYaw = Math.atan2(F.x, F.z);
      const roll = (P.headRoll || 0) * Math.cos(headYaw);
      const ex = { x: Math.cos(roll), y: Math.sin(roll) };
      const discs = [
        [cran, 22 * HS],
        [brow, 19 * HS]
      ];
      const reach = discs.map(([w, r]) => {
        const c = sp(w);
        const along = (c.x - axis.x) * ex.x + (c.y - axis.y) * ex.y, off = -(c.x - axis.x) * ex.y + (c.y - axis.y) * ex.x;
        const half = Math.sqrt(Math.max(0, r * r - off * off));
        return { lo: along - half, hi: along + half };
      });
      const lying = P.flat > 0.5 && (look === "dizzy" || look === "shut") ? Math.sign(headYaw || 1) * Math.min(Math.abs(headYaw), 100 * Math.PI / 180) : headYaw;
      const placedEyes = tideEyes(lying, {
        lo: Math.min(...reach.map((q) => q.lo)),
        hi: Math.max(...reach.map((q) => q.hi))
      });
      for (const e of placedEyes.eyes) {
        const side = placedEyes.side;
        const x = axis.x + ex.x * e.u * side, y = axis.y + ex.y * e.u * side;
        const id = e.which === "near" ? side : -side;
        out.push({
          key: `eye${id}`,
          piece: eyePieceName(e.view, look),
          x,
          y,
          rot: roll + e.lift * side,
          sx: (e.flip ? -1 : 1) * side,
          sy: 1,
          alpha: 1,
          z: hz + 0.05
        });
        if (look !== "shut" && look !== "dizzy") {
          out.push({
            key: `eyeglint${id}`,
            piece: "eye-glint",
            x: x - e.hw * 0.42,
            y: y - 4.2,
            rot: 0,
            sx: 1,
            sy: 1,
            alpha: 1,
            z: hz + 0.06
          });
          out.push({
            key: `eyeglow${id}`,
            piece: "glow",
            x,
            y,
            rot: 0,
            sx: 0.5,
            sy: 0.5,
            alpha: phase === 3 ? 0.55 : 0.2 + P.anger * 0.1,
            z: 0,
            glow: true,
            tint: pal.iris[0] << 16 | pal.iris[1] << 8 | pal.iris[2]
          });
        }
      }
      const down = sp(mul(U, -1)), upS = sp(U);
      const fangRot = (d) => Math.atan2(-d.x, d.y);
      for (const k of [-1, 1]) {
        if (dot(norm(add(mul(F, 0.4), mul(R, k))), VIEW) < 0.12) continue;
        const L = (9 + P.anger * 3) * HS;
        for (const [f, r, u, l, dir] of [
          [39.5, 9.5, -6, L, down],
          [28.5, 11.2, -7, L * 0.5, down],
          [46.5, 7.5, -8, L * 0.55, upS]
        ]) {
          const p = sp(at(f, k * r, u));
          out.push({
            key: `fang${k}${f}`,
            piece: "fang",
            x: p.x,
            y: p.y,
            rot: fangRot(dir),
            sx: HS,
            sy: l / 14,
            alpha: 1,
            z: hz + 0.06
          });
        }
      }
      if (faceN > -0.2)
        for (const k of [-1, 1]) {
          const n = sp(at(56, k * 5, 9));
          out.push({
            key: `nostril${k}`,
            piece: "nostril",
            x: n.x,
            y: n.y,
            rot: k * 0.5,
            sx: HS,
            sy: HS,
            alpha: clamp(faceN + 0.3),
            z: hz + 0.06
          });
        }
      if (dot(norm(add(mul(F, 0.4), mul(U, 0.9))), VIEW) > -0.45) {
        const p = sp(head.pearl);
        out.push({
          key: "pearl",
          piece: "pearl",
          x: p.x,
          y: p.y,
          rot: 0,
          sx: 1,
          sy: 1,
          alpha: 1,
          z: hz + 0.08
        });
        const g = P.pearl + P.exposed * 0.8;
        out.push({
          key: "pearlglow",
          piece: "glow",
          x: p.x,
          y: p.y,
          rot: 0,
          sx: 0.55 + g * 0.4,
          sy: 0.55 + g * 0.4,
          alpha: clamp(0.25 + g * 0.45),
          z: 0,
          glow: true,
          tint: pal.glow
        });
      }
      for (const k of [-1, 1]) {
        const b = at(50, k * 7, -1);
        const pts = [sp(b)];
        for (let j = 1; j <= 9; j++) {
          const f = j / 9;
          pts.push(
            sp(
              add(
                b,
                add(
                  mul(F, (-f * 46 + 8) * HS),
                  add(
                    mul(R, k * (8 + f * 40) * HS),
                    mul(
                      U,
                      (-f * 26 + Math.sin(P.clock * 2.2 + f * 5 + k) * 9 * f + Math.sin(f * 7) * 6 * f) * HS
                    )
                  )
                )
              )
            )
          );
        }
        lines.push({
          pts,
          width: 2,
          color: "rgba(255,240,220,0.85)",
          front: !behind(add(b, mul(R, k * 30)))
        });
      }
      if (faceN > -0.5) {
        const ch = at(22, 0, -13);
        for (const k of [-1, 0, 1]) {
          const a = add(ch, mul(R, k * 5 * HS));
          const end = add(
            add(ch, mul(R, k * 9 * HS)),
            add(mul(U, -18 * HS), mul(F, -26 * HS))
          );
          const sway = Math.sin(P.clock * 2.3 + k) * 4;
          const mA = sp(a), mE = sp(end);
          const pts = [
            mA,
            { x: mA.x + sway, y: (mA.y + mE.y) / 2 },
            { x: mE.x + sway, y: mE.y }
          ];
          lines.push({ pts, width: 5.5, color: pal.line, front: true });
          lines.push({
            pts,
            width: 3.4,
            color: k ? pal.belly : pal.bellyDark,
            front: true
          });
        }
      }
      if (P.jaw < 0.1)
        for (const k of [-1, 1]) {
          if (dot(norm(add(mul(F, 0.2), mul(R, k))), VIEW) < -0.1) continue;
          lines.push({
            pts: [
              sp(at(54, k * 5, -5)),
              sp(at(30, k * 11, -6)),
              sp(at(4, k * 15, -10 - P.anger * 2))
            ],
            width: 1.8,
            color: pal.line,
            front: true
          });
        }
    }
    return {
      placements: out,
      lines,
      segs,
      head,
      headScreen: sp(head.w),
      pearlScreen: sp(head.pearl)
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
    const list = r.placements.map((p) => ({ ...p, face: /^(eye|cran|brow|snout|jaw|mouth|fang|nostril)/.test(p.key) }));
    for (const l of r.lines)
      list.push({ line: l.pts, color: l.color, width: l.width, z: l.front ? headZ + 0.07 : headZ - 0.6 + 5e-4, face: true });
    list.sort((a, b) => a.z - b.z);
    const { F, at } = r.head;
    const headYaw = Math.atan2(F.x, F.z);
    const e = tideEyes(headYaw);
    const axis = tideProject(at(0, 0, 9));
    const turn = Math.abs(Math.atan2(Math.sin(headYaw), Math.cos(headYaw)));
    const pf = turn - TIDE_FACE.lag * Math.sin(2 * Math.min(turn, Math.PI / 2));
    const cu = (e.view === "side" ? 1 : Math.sin(e.view === "front" ? pf * (headYaw < 0 ? -1 : 1) : pf)) * 26 * e.side;
    const guide = e.view === "back" ? null : {
      centre: [{ x: axis.x + cu * 0.7, y: axis.y - 34 }, { x: axis.x + cu, y: axis.y }, { x: axis.x + cu * 1.25, y: axis.y + 30 }],
      eyeLine: [{ x: axis.x - 40, y: axis.y }, { x: axis.x + 40, y: axis.y }],
      others: [],
      eyes: r.placements.filter((p) => /^eye-?1$/.test(p.key)).map((p) => ({ x: p.x, y: p.y }))
    };
    return {
      placements: list,
      heads: [{ x: axis.x, y: axis.y, view: e.view === "back" ? turn > 2.75 ? "back" : "backtq" : e.view, side: headYaw < 0 ? -1 : 1, guide, marks: { top: -40, eye: 0, bot: 44 } }],
      shadows: [[0, 0, 70, 20]]
    };
  }
  var boss = {
    id: "tidewyrm",
    title: "Tidewyrm",
    lede: "The water dragon that is already in the game. Its eye used to be one drawing squeezed sideways by the turn; it now has a front, a near, a far and a side drawing on one eye line. The far eye is drawn cut by the bridge of the snout.",
    attacks: [["dive", "Dive"], ["wave", "Tidal Wave"], ["bubbles", "Bubbles"], ["hightide", "High Tide"], ["undertow", "Undertow"], ["prison", "Water Prison"]],
    pose,
    placements,
    pieces: tidePieces,
    faces: [],
    face: TIDE_FACE,
    tideEyes,
    looks: ["glare", "wide", "squint", "shut", "dizzy"],
    mouths: ["closed"],
    stage: { w: 460, h: 330, ground: 0.8, closeW: 150, closeH: 120, sheetGap: 300, sheetH: 300, closeGap: 110, closeSheetH: 120, champion: [-170, 40], shadow: [70, 20], floor: ["#06141c", "#0c2a38", "120,220,255"] },
    occluder: "the bridge of the snout, drawn into the far eye's own drawing"
  };
  return __toCommonJS(tide_entry_exports);
})();
