/*
 * Gloomshade as a 2.5D vector rig. PURE: no DOM, no state.
 *   gloomPose(cue)                     the battle's state -> a pose
 *   gloomPlacements(P, yaw, phase)     pose -> where each drawn piece goes
 *   gloomFace(head, expr)              the face alone: head pose -> piece placements
 *   gloomPieces(phase)                 every piece, drawn once into an atlas
 * Same shapes as boss-vector-tide.ts (Piece, Placement), so packPieces /
 * paintPieces and the Phaser rig file work on it as they are.
 *
 * Rig units: x right, y up, z towards the camera. Screen = (x, -y + z * 0.65).
 * Yaw 0 faces the camera, 90 degrees faces screen right, 180 faces away.
 */
const GLOOM = (() => {
  "use strict";
  const { TAU, DEG, clamp, lerp, smooth, gauss, project, rotY, depth, after, rng,
    makeFace, pieceOf, tuft, furPath, glowPiece, softPiece } = KIT;

  // ════════════════════════ THE FACE: CONSTRUCTION ════════════════════════
  /** Skull half-width, the face's unit. */
  const A = 32;
  const FACE = {
    A,
    // Heights below the head's centre. One per feature, the same in every view.
    gemLine: -0.5 * A,
    browLine: -0.3 * A,
    eyeLine: 0.06 * A,
    noseLine: 0.43 * A,
    // Eyes ride a circle round the head's vertical axis.
    eyeAz: 42 * DEG, // how far round from the centre line each eye sits
    eyeOrbit: 0.62 * A,
    // The face turns a little slower than the skull (most at three-quarter).
    lag: 14 * DEG,
    // The far eye's outer corner lifts by this, always, and nothing else tilts.
    farLift: 6 * DEG,
    // A nod slides the whole face this far up or down per radian.
    nod: 0.45 * A,
    // Clear space kept between a feature and the head's outline.
    margin: 0.045 * A,
    // Each view's own eye drawing: half-width and half-height.
    eye: {
      front: { hw: 8, hh: 8.6 },
      near: { hw: 8, hh: 8.6 },
      far: { hw: 5.6, hh: 8.4 },
      side: { hw: 6.6, hh: 8.6 },
    },
    gem: { front: 3.9, tq: 3.2, side: 2.1 },
    // Half-width of the muzzle from the nose out to the far whisker pad.
    pad: { front: 8.5, tq: 5, side: 0 },
  };
  const SK = { top: -0.92 * A, bot: 0.8 * A, v0: -0.06 * A, ry: 0.86 * A };
  /** The skull's roundness at height v: 1 at its widest, 0 at crown and chin. */
  const se = (v) => {
    const t = clamp(Math.abs((v - SK.v0) / SK.ry));
    const e = v > SK.v0 ? 1.9 : 2.5; // a broad crown, a narrower jaw
    return Math.pow(1 - Math.pow(t, e), 1 / e);
  };
  /**
   * THE CENTRE LINE. The head's profile (forehead, the stop at the eye line,
   * the short muzzle, the chin): how far in front of the head's axis the
   * middle of the face is at height v. Side view draws it as the outline;
   * every other view places the gem, nose and mouth at centreLine(v) * sin(face yaw).
   */
  const centreLine = (v) =>
    0.88 * A * se(v) +
    0.3 * A * gauss(v - 0.46 * A, (v > 0.46 * A ? 0.27 : 0.16) * A) - // a fuller jaw under the nose
    0.035 * A * gauss(v - 0.13 * A, 0.12 * A);
  /**
   * The drawn head outline of a view at height v: [left, right] in the
   * canonical drawing (turned to screen right). Head pieces are drawn from
   * this same function, so "inside the outline" is exact.
   */
  function skullEdge(view, v) {
    const s = se(v),
      cheek = 1 + 0.05 * smooth(-0.2 * A, 0.45 * A, v);
    if (view === "front") return [-0.98 * A * s * cheek, 0.98 * A * s * cheek];
    if (view === "tq")
      return [
        -1.0 * A * s * cheek,
        0.985 * A * s * cheek +
          0.04 * A * gauss(v - 0.44 * A, 0.2 * A) -
          0.025 * A * gauss(v - 0.1 * A, 0.14 * A),
      ];
    if (view === "side") return [-1.02 * A * s, centreLine(v)];
    if (view === "backtq") return [-0.97 * A * s * cheek, 1.0 * A * s * cheek];
    return [-1.0 * A * s * cheek, 1.0 * A * s * cheek];
  }
  const BROW = { idle: "calm", glare: "angry", wide: "raised", hurt: "pinch", dizzy: "raised", closed: "calm" };
  const BROW_DY = { calm: 0, angry: 2.6, raised: -2.4, pinch: 1.6 };
  /** Where the iris sits in an eye drawing (for the highlight, which never mirrors). */
  function eyeGeom(view, look) {
    const { hw, hh } = FACE.eye[view];
    // the painted Gloomshade's eye: the thick upper lid a near-straight line
    // slanting down from the outer corner to the inner one, so it looks sly
    // at rest and slits further when it glares
    const lid = { idle: [-0.66, -0.06], glare: [-0.46, 0.3], wide: [-1.25, -1.15] }[look] || [-0.66, -0.06];
    const r = (look === "wide" ? 3.8 : 5) * (view === "far" ? 0.9 : 1);
    // every iris is pushed the way the head faces (+x in the canonical drawing)
    const gx = { front: 0.9, near: 1.2, far: 0.35, side: 1.3 }[view];
    const gy = look === "wide" ? 0.6 : look === "glare" ? 2.6 : 2.1;
    return { hw, hh, lid, r, gx, gy, inner: view === "far" ? -1 : 1 };
  }

  /** Gloomshade's construction, handed to the kit (kit.js: makeFace). */
  const SPEC = {
    A, top: SK.top, bot: SK.bot,
    lines: { gem: FACE.gemLine, brow: FACE.browLine, eye: FACE.eyeLine, nose: FACE.noseLine },
    eyeAz: FACE.eyeAz, eyeOrbit: FACE.eyeOrbit, lag: FACE.lag, farLift: FACE.farLift, nod: FACE.nod, margin: FACE.margin,
    eye: FACE.eye, eyeGeom,
    // the far eye may hide at most 40% of itself behind the bridge
    tuckCap: 0.4, bridgeHalf: 1,
    centreLine, skullEdge,
    headPiece: (view) => "head_" + view,
    lit: (look) => look === "idle" || look === "glare" || look === "wide",
    glint: (look) => look === "idle" || look === "glare" || look === "wide",
    glintR: 4.3, eyeGlowPiece: "glow_amber",
    brow: (look) => ({ kind: BROW[look], dy: BROW_DY[BROW[look]], dx: 0.6 }),
    // features on the centre line, in drawing order within their layer
    centre: [
      { id: "muzzle", anchor: "nose", layer: "mid", piece: (v) => (v === "side" ? null : "muzzle_" + v) },
      { id: "gem", line: FACE.gemLine, nodK: 0.8, hw: FACE.gem, vspan: [-5, 5], sideInset: 0.5, piece: (v) => "gem_" + v,
        glow: (e) => ({ piece: "glow_gold", alpha: e.gemGlow || 0, s: 0.8 }) },
      { id: "mouth", anchor: "nose", piece: (v, e) => `mouth_${v}_${e.mouth || "smile"}` },
      { id: "nose", line: FACE.noseLine, hw: FACE.pad, vspan: [0, 6], piece: (v) => "nose_" + v },
    ],
  };
  const FACEKIT = makeFace(SPEC);
  const gloomFace = FACEKIT.face;


  // ════════════════════════ THE POSE ════════════════════════
  const ATTACKS = ["lunge", "hands", "snuff", "curse", "split", "pulse"];
  /**
   * What the battle tells the rig each frame (all cosmetic):
   * { clock, phase, reduced, windKind, windup 0-1, castKind, castAge,
   *   stagger, exposed, hurt 0-1, dead, deadAge, roarAge, flicker }
   */
  function gloomPose(c) {
    const t = c.reduced ? 0 : c.clock;
    const m = c.reduced ? 0 : 1;
    const P = {
      t,
      lift: Math.sin(t * 2.2) * 4 * m,
      crouch: 0,
      stretch: 0,
      rear: 0,
      puff: 1 + Math.sin(t * 2.2 + 1) * 0.015 * m,
      headYaw: (Math.sin(t * 0.7) * 0.15 + Math.sin(t * 1.9) * 0.04) * m,
      headPitch: Math.sin(t * 1.3) * 0.07 * m,
      headRoll: Math.sin(t * 0.9 + 1) * 0.05 * m,
      headDrop: 0,
      earBack: 0.6,
      earLift: 0,
      tailRaise: 0,
      pawF: [0, 0, 0],
      pawSpread: 0,
      look: "idle",
      mouth: "smile",
      blink: m && (t % 3.7 > 3.58 || (t + 1.3) % 9.1 > 9.0),
      gemGlow: 0.12 + (c.phase - 1) * 0.12,
      eyeGlow: 0.26 + (c.phase - 1) * 0.14,
      moonGlow: 0.35 + (c.phase - 1) * 0.15,
      moonFlick: c.flicker ? 0.3 + 0.7 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1)) : 1,
      core: 0,
      alpha: 1,
      shake: 0,
      stars: 0,
    };
    const w = clamp(c.windup || 0),
      kind = c.windKind,
      cast = c.castKind,
      age = c.castAge === undefined ? 99 : c.castAge;
    if (kind === "lunge") {
      P.crouch = w;
      P.headPitch += 0.22 * w;
      P.earBack = lerp(P.earBack, 1, w);
      P.tailRaise = 0.3 * w;
      P.look = "glare";
    } else if (kind === "hands") {
      P.rear = 0.85 * w;
      P.pawF = [0, 20 * w, 6 * w];
      P.pawSpread = 9 * w;
      P.look = "glare";
      if (w > 0.55) P.mouth = "open";
    } else if (kind === "snuff") {
      P.headPitch -= 0.28 * w;
      P.puff *= 1 + 0.07 * w;
      P.look = w > 0.5 ? "wide" : "idle";
      P.mouth = w > 0.35 ? "o" : "smile";
    } else if (kind === "curse") {
      P.gemGlow = lerp(P.gemGlow, 1, w);
      P.headPitch += 0.16 * w;
      P.headDrop = 4 * w;
      P.tailRaise = 0.6 * w;
      P.look = "glare";
    } else if (kind === "split") {
      P.shake = w;
      P.look = "wide";
      P.mouth = "o";
      P.alpha = 1 - 0.3 * w * (0.5 + 0.5 * Math.sin(c.clock * 31));
    } else if (kind === "pulse") {
      P.tailRaise = w;
      P.moonGlow = lerp(P.moonGlow, 1, w);
      P.crouch = 0.4 * w;
      P.look = "closed";
    }
    if (cast === "lunge") {
      const k = after(age, 0.55);
      P.stretch = k;
      P.pawF = [0, 12 * k, 20 * k];
      P.earBack = lerp(P.earBack, 1, k);
      if (k > 0.05) (P.look = "glare"), (P.mouth = "open");
    } else if (cast === "hands") {
      const k = after(age, 0.45);
      P.crouch = Math.max(P.crouch, k);
      P.pawF = [0, -4 * k, 10 * k];
      P.pawSpread = 6 * k;
      if (k > 0.05) (P.look = "glare"), (P.mouth = "open");
    } else if (cast === "snuff") {
      const k = after(age, 0.6);
      P.headPitch += 0.2 * k;
      P.stretch = Math.max(P.stretch, 0.25 * k);
      if (k > 0.05) (P.look = "closed"), (P.mouth = "o");
    } else if (cast === "curse") {
      const k = after(age, 0.7);
      P.gemGlow = Math.max(P.gemGlow, k);
      P.tailRaise = Math.max(P.tailRaise, 0.6 * k);
      if (k > 0.05) P.look = "glare";
    } else if (cast === "split") {
      const k = after(age, 0.5);
      P.puff *= 1 + 0.1 * k;
      if (k > 0.05) P.look = "glare";
    } else if (cast === "pulse") {
      const k = after(age, 0.6);
      P.rear = Math.max(P.rear, 0.3 * k);
      P.tailRaise = Math.max(P.tailRaise, k);
      P.moonGlow = Math.max(P.moonGlow, k);
      if (k > 0.05) (P.look = "wide"), (P.mouth = "open");
    }
    const roar = after(c.roarAge === undefined ? 99 : c.roarAge, 1.1);
    if (roar > 0.05) {
      P.rear = Math.max(P.rear, 0.5 * roar);
      P.look = "glare";
      P.mouth = "open";
      P.earLift = roar;
    }
    if (c.exposed && !c.stagger) {
      P.look = "wide";
      P.mouth = "o";
      P.core = 1;
      P.earBack = 0.3;
    }
    if (c.stagger) {
      P.look = "dizzy";
      P.mouth = "flat";
      P.core = 1;
      P.stars = 1;
      P.headRoll = Math.sin(c.clock * 3) * 0.3 * (c.reduced ? 0 : 1) + (c.reduced ? 0.2 : 0);
      P.headYaw = 0;
      P.headDrop = 6;
      P.crouch = 0.5;
      P.earBack = 0.15;
    }
    if ((c.hurt || 0) > 0.3 && !c.dead) {
      P.look = "hurt";
      P.mouth = "grit";
      P.headPitch -= 0.2 * c.hurt;
      P.headRoll += 0.12 * c.hurt;
      P.shake = Math.max(P.shake, 0.6 * c.hurt);
    }
    if (c.dead) {
      const d = smooth(0, 0.9, c.deadAge === undefined ? 9 : c.deadAge);
      P.crouch = d * 1.5;
      P.headDrop = 12 * d;
      P.headRoll = 0.3 * d;
      P.headYaw = 0;
      P.headPitch = 0.12 * d;
      P.look = "closed";
      P.mouth = "flat";
      P.blink = false;
      P.earBack = lerp(0.6, 0.1, d);
      P.lift *= 1 - d;
      P.moonGlow = 0.12;
      P.eyeGlow = 0;
      P.gemGlow = 0.03;
      P.core = 0;
      P.stars = 0;
    }
    return P;
  }

  // ════════════════════════ THE BODY ════════════════════════
  /** Pose -> every piece's placement this frame, the head's and face's included. */
  function gloomPlacements(P, yaw, phase, prev) {
    const list = [];
    const t = P.t;
    const jit = P.shake ? Math.sin(t * 43) * 1.6 * P.shake : 0;
    const base = 40 + P.lift - 11 * P.crouch;
    // rear up: everything in front of the haunch pitches about it
    const pv = { y: base + 2, z: -34 },
      ra = P.rear * 0.62;
    const pose = (p) => {
      let { x, y, z } = p;
      if (z > pv.z) {
        z = pv.z + (z - pv.z) * (1 + 0.32 * P.stretch);
        y -= 7 * P.stretch * smooth(pv.z, 20, z);
        const dz = z - pv.z,
          dy = y - pv.y;
        z = pv.z + dz * Math.cos(ra) - dy * Math.sin(ra);
        y = pv.y + dz * Math.sin(ra) + dy * Math.cos(ra);
      }
      return rotY({ x: x + jit, y, z }, yaw);
    };
    const add = (key, piece, w, o = {}) => {
      const s = project(w);
      list.push({
        key,
        piece,
        x: s.x,
        y: s.y,
        rot: o.rot || 0,
        sx: o.sx === undefined ? 1 : o.sx,
        sy: o.sy === undefined ? 1 : o.sy,
        alpha: (o.alpha === undefined ? 1 : o.alpha) * P.alpha,
        z: depth(w) + (o.bias || 0),
        glow: !!o.glow,
      });
    };
    /** A chain of fur puffs through 3D points, each turned along the chain. */
    const chain = (key, piece, nominal, pts, radii, bias = 0) => {
      const sc = pts.map(project);
      const back = Math.min(...pts.map(depth)) - 0.5,
        front = Math.max(...pts.map(depth)) + 0.3;
      for (let i = 0; i < pts.length; i++) {
        const a = sc[Math.max(0, i - 1)],
          b = sc[Math.min(pts.length - 1, i + 1)];
        const rot = Math.atan2(b.y - a.y, b.x - a.x);
        const k = radii[i] / nominal;
        add(key + i, piece + "_f", pts[i], { rot, sx: k * 1.18, sy: k, bias: bias - i * 0.01 });
        // one outline round the whole chain: every edge sits behind every fill
        add(key + "e" + i, piece + "_e", pts[i], { rot, sx: k * 1.18, sy: k, bias: bias + back - depth(pts[i]) });
        // ...and soft light along the top, shade along the underside, over them all
        add(key + "h" + i, "puff_hi", { ...pts[i], y: pts[i].y + radii[i] * 0.42 }, { sx: k, sy: k * 0.8, bias: bias + front - depth(pts[i]) });
        add(key + "s" + i, "puff_lo", { ...pts[i], y: pts[i].y - radii[i] * 0.5 }, { sx: k, sy: k * 0.75, bias: bias + front - depth(pts[i]) - 0.1 });
      }
    };
    const puff = P.puff;
    // torso
    const haunch = pose({ x: 0, y: base + 2, z: -34 }),
      belly = pose({ x: 0, y: base + 1, z: -12 }),
      chest = pose({ x: 0, y: base + 4, z: 10 });
    for (const [key, w, k] of [["haunch", haunch, 0.98], ["belly", belly, 0.92], ["chest", chest, 0.94]]) {
      add(key, "ball24_f", w, { sx: k * puff, sy: k * puff });
      add(key + "e", "ball24_e", w, { sx: k * puff, sy: k * puff, bias: -30 });
      add(key + "h", "puff_hi", { ...w, y: w.y + 10 }, { sx: k, sy: k * 0.8, bias: 0.6 });
      add(key + "s", "puff_lo", { ...w, y: w.y - 12 }, { sx: k, sy: k * 0.75, bias: 0.5 });
    }
    add("ruff", "ruff", pose({ x: 0, y: base - 3, z: 27 }), { bias: 3 });
    if (P.core > 0.02) {
      const core = pose({ x: 0, y: base + 2, z: 31 });
      add("coreglow", "glow_gold", core, { glow: true, alpha: 0.75 * P.core * (0.8 + 0.2 * Math.sin(t * 9)), bias: 6 });
      add("core", "core", core, { alpha: P.core, bias: 5 });
    }
    // legs
    const legs = [
      ["fl", -1, 14, 1],
      ["fr", 1, 14, 1],
      ["hl", -1, -36, 0],
      ["hr", 1, -36, 0],
    ];
    for (const [id, s, z, front] of legs) {
      const sway = Math.sin(t * 2.2 + (front ? 0 : 1.6) + s) * 1.5;
      const hip = pose({ x: s * 13, y: base - 6, z });
      const pawL = front
        ? { x: s * (14 + P.pawSpread) + P.pawF[0], y: base - 27 + P.pawF[1] + sway, z: z + 10 + P.pawF[2] }
        : { x: s * 15, y: base - 28 + sway + 6 * P.crouch, z: z - 5 - 14 * P.stretch };
      pawL.y = Math.max(5, pawL.y); // never through the floor
      const paw = pose(pawL);
      const mid = { x: (hip.x + paw.x) / 2, y: (hip.y + paw.y) / 2, z: (hip.z + paw.z) / 2 };
      const a = project(hip),
        b = project(paw);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      add("leg" + id, "ball14", mid, {
        rot: Math.atan2(b.y - a.y, b.x - a.x),
        sx: clamp((len + 16) / 28, 0.75, 1.9),
        sy: 0.82,
        bias: front ? 1 : 0,
      });
      const side = Math.sin(yaw) * (front ? 1 : 1);
      add("paw" + id, "paw", paw, { sx: side < -0.3 ? -1 : 1, bias: front ? 1.5 : 0.5 });
    }
    // tail: back, up, and curling over, the crescent at its tip
    {
      const pts = [],
        N = 8,
        L = 10.5;
      let p = { x: 0, y: base + 6, z: -52 };
      const end = lerp(2.05, 2.9, P.tailRaise);
      for (let i = 0; i < N; i++) {
        const s = i / (N - 1);
        const phi = lerp(0.05, end, s * s * 0.6 + s * 0.4) + P.tailRaise * 0.5 * s;
        const sway = Math.sin(t * 1.7 - s * 2.4) * (4 + 9 * s);
        pts.push(rotY({ x: sway + jit + 30 * s * s, y: p.y, z: p.z }, yaw)); // it swings out to one side
        p = { x: 0, y: p.y + Math.sin(phi) * L, z: p.z - Math.cos(phi) * L };
      }
      chain("tail", "ball24", 24, pts, [17, 18, 18, 17, 15.5, 14, 12, 10.5].map((r) => r * puff));
      const a = pts[N - 2],
        b = pts[N - 1];
      const sa = project(a),
        sb = project(b);
      const ang = Math.atan2(sb.y - sa.y, sb.x - sa.x);
      const tip = { x: b.x + (b.x - a.x) * 1.0, y: b.y + (b.y - a.y) * 1.0 + 4, z: b.z + (b.z - a.z) * 1.0 };
      add("moonglow", "glow_gold", tip, { glow: true, alpha: P.moonGlow * P.moonFlick, sx: 1.9, sy: 1.9, bias: 2 });
      add("moon", "moon", tip, { rot: ang - 0.5, alpha: 0.35 + 0.65 * P.moonFlick, bias: 2 });
      list.moon = project(tip);
    }
    // head
    const headYaw = yaw + P.headYaw;
    const headW = pose({ x: 0, y: base + 30 - P.headDrop, z: 24 });
    const hs = project(headW);
    const hz = depth(headW) + 8;
    // ears: lop ears from the top of the skull, draping out, down and back over
    // the shoulders (well clear of the floor), the tips curling out and up
    const facing = Math.cos(headYaw) > -0.25,
      turned = Math.abs(Math.sin(headYaw)) > 0.5;
    for (const s of [-1, 1]) {
      const root = rotY({ x: s * 0.62 * A, y: 0.34 * A, z: -0.42 * A }, headYaw);
      let p = { x: headW.x + root.x, y: headW.y + root.y, z: headW.z + root.z };
      const pts = [], N = 10, L = 6.3;
      const eb = P.earBack;
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        pts.push({ ...p });
        const wave = Math.sin(t * 2.3 - i * 0.6 + s) * 0.2 * (0.3 + u);
        // hanging: out a little, down and back; streaming: back and nearly
        // level; the tip curls out and up either way
        const curl = smooth(0.5, 1, u) * (1 - 0.6 * eb);
        const d = {
          x: s * (lerp(0.34, 0.28, eb) + curl * 0.75),
          y: lerp(-1, -0.32 + P.earLift * 0.9, eb) + wave + curl * 1.1,
          z: lerp(-0.85, -1, eb) * lerp(0.7, 1, u),
        };
        const n = Math.hypot(d.x, d.y, d.z) || 1;
        const r = rotY({ x: (d.x / n) * L, y: (d.y / n) * L, z: (d.z / n) * L }, yaw);
        p = { x: p.x + r.x, y: p.y + r.y, z: p.z + r.z };
      }
      // The ear on the camera's side lies over the back of the skull once the
      // head has turned (it starts behind the eye, so it never crosses the
      // face); otherwise the ears tuck behind the head. From behind, both lie over it.
      const near = -s * Math.sin(headYaw) > 0;
      const over = !facing || (near && turned);
      const id = s < 0 ? "l" : "r";
      // every outline of the ear behind every fill of it: one smooth shape
      const leaf = (key, piece, a, b, nominal, bias) => {
        const sa = project(a), sb = project(b);
        const len = Math.hypot(sb.x - sa.x, sb.y - sa.y), rot = Math.atan2(sb.y - sa.y, sb.x - sa.x);
        const o = { rot, sx: clamp(len / nominal, 0.5, 1.12), sy: Math.cos(rot) < 0 ? -1 : 1 };
        const at = hz + (over ? 1.5 : -2) - depth(a);
        add(key + "e", piece + "_e", a, { ...o, bias: at - 0.9 + bias * 0.01 });
        add(key, piece + "_f", a, { ...o, bias: at + bias });
      };
      leaf("ear" + id + "b", "ear_b", pts[6], pts[9], 20, -0.4);
      leaf("ear" + id + "m", "ear_m", pts[3], pts[6], 20, -0.2);
      leaf("ear" + id + "a", "ear_a", pts[0], pts[3], 20, 0);
    }
    // phases 2 and 3: wisps of shadow lifting off its back
    for (let i = 0; i < (phase - 1) * 3; i++) {
      const u = (t * 0.35 + i * 0.37) % 1;
      const w = pose({ x: Math.sin(i * 2.4) * 12, y: base + 18 + u * 34, z: 4 - i * 9 });
      add("wisp" + i, "wisp", w, { rot: Math.sin(t * 2 + i) * 0.25, sx: 0.7 + 0.5 * u, sy: 0.7 + 0.6 * u, alpha: Math.sin(u * Math.PI) * 0.75, bias: -4 });
    }
    const face = gloomFace(
      { x: hs.x, y: hs.y, yaw: headYaw, pitch: P.headPitch, roll: P.headRoll, z: hz, prevView: prev && prev[0] },
      { look: P.look, mouth: P.mouth, blink: P.blink, gemGlow: P.gemGlow, eyeGlow: P.eyeGlow },
    );
    for (const f of face.placements) (f.alpha *= P.alpha), list.push(f);
    if (P.stars > 0) KIT.stars(list, hs, hz, t, A * 1.25);
    list.sort((a, b) => a.z - b.z);
    return {
      placements: list,
      heads: [{ x: hs.x, y: hs.y, view: face.view, side: face.side, guide: face.guide, marks: face.marks }],
      core: project(pose({ x: 0, y: base + 2, z: 31 })),
      moon: list.moon,
    };
  }

  // ════════════════════════ THE PIECES (drawn once) ════════════════════════
  const PAL = {
    1: {
      fur: "#553a9e", furDark: "#33206a", furLight: "#7355be", rim: "#b692de", warm: "rgba(246,170,130,0.5)",
      edge: "#1d113e", ruff: "#8468c4", ruffLight: "#b9a0e8", brow: "#1e1040",
      sclera: ["#fffbe2", "#ffe896", "#f5b445"], lidShade: "rgba(196,104,22,0.6)",
    },
    2: {
      fur: "#43308c", furDark: "#261850", furLight: "#6a55bd", rim: "#c3b0f0", warm: "rgba(255,214,150,0.5)",
      edge: "#190f38", ruff: "#8672cc", ruffLight: "#c9b8f2", brow: "#1a0e3a",
      sclera: ["#fffde8", "#ffec9e", "#f7bb48"], lidShade: "rgba(196,104,22,0.6)",
    },
    3: {
      fur: "#3a2270", furDark: "#200f44", furLight: "#5e3a9c", rim: "#d985c2", warm: "rgba(255,150,110,0.6)",
      edge: "#150a2e", ruff: "#7a55b4", ruffLight: "#c08fd8", brow: "#150a2e",
      sclera: ["#fff6c8", "#ffd870", "#f39a2e"], lidShade: "rgba(190,80,14,0.65)",
    },
  };
  const INK = "#1b0b1f"; // lids, nose, mouth line
  /** The fur's colour down a head or muzzle: one gradient, so pieces match. */
  function furGradient(c, pal, top, bot) {
    const g = c.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, pal.furLight);
    g.addColorStop(0.42, pal.fur);
    g.addColorStop(1, pal.furDark);
    return g;
  }
  const headGradient = (c, pal, dy = 0) => furGradient(c, pal, SK.top - 6 - dy, SK.bot + 8 - dy);
  /** Stroke the outline, fill, then light the fur inside. */
  function paintFur(c, path, pal, top, bot, o = {}) {
    if (!o.noEdge) {
      c.strokeStyle = pal.edge;
      c.lineWidth = o.edge || 2;
      c.stroke(path);
    }
    c.fillStyle = o.fill || furGradient(c, pal, top, bot);
    c.fill(path);
    c.save();
    c.clip(path);
    const h = bot - top;
    // moonlight on the top, warm lantern light at the very edge
    let g = c.createLinearGradient(0, top, 0, top + h * 0.45);
    g.addColorStop(0, pal.rim);
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.strokeStyle = g;
    c.globalAlpha = 0.75;
    c.lineWidth = (o.edge || 2) + 2.4;
    c.stroke(path);
    g = c.createLinearGradient(0, top, 0, top + h * 0.3);
    g.addColorStop(0, pal.warm);
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.strokeStyle = g;
    c.globalAlpha = 1;
    c.lineWidth = (o.edge || 2) + 0.9;
    c.stroke(path);
    // strands
    if (o.strands) {
      const rnd = rng(o.seed || 7);
      for (let i = 0; i < o.strands; i++) {
        const x = lerp(o.x0, o.x1, rnd()), y = lerp(top, bot, rnd());
        if (o.keep && !o.keep(x, y)) continue;
        const up = (y - top) / h < 0.45;
        c.strokeStyle = up ? pal.furLight : pal.furDark;
        c.globalAlpha = 0.35;
        c.lineWidth = 0.7;
        const a = (o.flow || Math.PI / 2) + (rnd() - 0.5) * 0.9, l = 2.5 + rnd() * 3;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 0.8, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
        c.stroke();
      }
    }
    c.restore();
    c.globalAlpha = 1;
  }
  function ballPiece(name, r, pal, seed, o = {}) {
    const pad = r * 0.3 + 2, size = (r + pad) * 2;
    return pieceOf(name, size, size, 0.5, 0.5, (c) => {
      const pts = [];
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * TAU;
        pts.push({ x: Math.cos(a) * r * (o.wide || 1), y: Math.sin(a) * r });
      }
      const path = new Path2D();
      furPath(path, pts, { seed, tooth: o.tooth || r * 0.42, depth: o.depth || r * 0.2, mask: (x, y) => 0.45 + 0.55 * smooth(-r * 0.4, r * 0.7, y) });
      if (o.mode === "e") {
        c.fillStyle = c.strokeStyle = pal.edge;
        c.lineWidth = 3.4;
        c.stroke(path);
        c.fill(path);
      } else if (o.mode === "f") {
        // no light direction: these turn along a tail
        c.fillStyle = pal.fur;
        c.fill(path);
      } else paintFur(c, path, pal, -r, r, { fill: o.fill, strands: o.strands === undefined ? r * 1.4 : o.strands, x0: -r, x1: r, seed: seed + 3, edge: o.edge });
    });
  }
  /**
   * A third of a lop ear, drawn along +x from its anchor: half-width w0 to w1.
   * Mode "e" is its outline alone and "f" its fur alone: the rig lays all of
   * an ear's outlines behind all of its fills, so the ear reads as one shape.
   */
  function earPiece(name, pal, w0, w1, tip, mode) {
    return pieceOf(name, 52, 38, 9 / 52, 0.5, (c) => {
      const pts = [];
      const N = 48, x0 = -7, x1 = tip ? 37 : 35;
      const cap = (u) => Math.sqrt(clamp(1 - Math.pow(Math.abs(2 * u - 1), tip ? 3 : 6)));
      const half = (u) => lerp(w0, w1, tip ? u : smooth(0, 0.85, u)) * cap(u);
      for (let i = 0; i <= N; i++) { const u = i / N; pts.push({ x: lerp(x0, x1, u), y: -half(u) * 0.85 }); }
      for (let i = N; i >= 0; i--) { const u = i / N; pts.push({ x: lerp(x0, x1, u), y: half(u) * 1.1 }); }
      const path = new Path2D();
      furPath(path, pts, { seed: 19 + w0, tooth: 6.5, depth: 2, mask: (x, y) => (y > 1 ? 1 : 0.15) });
      if (tip) for (const [x, y, a] of [[30, 5, 0.5], [34, 1, 0.1], [31, -4, -0.4]]) tuft(path, x, y, a, 7, 2.8, 0.2);
      if (mode === "e") {
        c.fillStyle = c.strokeStyle = pal.edge;
        c.lineWidth = 3.8;
        c.stroke(path);
        c.fill(path);
        return;
      }
      paintFur(c, path, pal, -15, 16, { strands: 22, x0, x1, seed: 41, edge: 1.9, flow: 0.3, noEdge: true });
      c.save(); // the paler inside of the ear, along its lower edge
      c.clip(path);
      const g = c.createLinearGradient(0, 3, 0, 16);
      g.addColorStop(0, pal.rim + "00");
      g.addColorStop(1, pal.rim);
      c.globalAlpha = 0.5;
      c.fillStyle = g;
      c.fillRect(x0, 0, 60, 18);
      c.restore();
    });
  }
  // ───────── heads: one drawing per view, built on skullEdge ─────────
  function headPiece(view, pal) {
    const W = 3.3 * A, H = 2.7 * A;
    return pieceOf("head_" + view, W, H, 0.5, 0.5, (c) => {
      const pts = [];
      for (let v = SK.top; v <= SK.bot; v += 1) pts.push({ x: skullEdge(view, v)[1], y: v });
      for (let v = SK.bot; v >= SK.top; v -= 1) pts.push({ x: skullEdge(view, v)[0], y: v });
      const faceSide = view === "front" || view === "tq" || view === "side";
      const path = new Path2D();
      furPath(path, pts, {
        seed: 11 + view.length,
        tooth: 5.5,
        depth: 1.15,
        // smooth along the face's own profile, shaggy elsewhere
        mask: (x, y) => (view === "side" && x > 0.35 * A && y > -0.3 * A ? 0.12 : view === "tq" && x > 0.5 * A && y > -0.2 * A ? 0.7 : 1),
      });
      // cheek ruffs and the crown tuft, placed per view
      const T = (x, y, deg, len, w, bend) => tuft(path, x * A, y * A, deg * DEG, len * A, w * A, bend);
      if (view === "front") {
        for (const s of [-1, 1]) {
          T(s * 0.9, 0.2, 90 - s * 62, 0.36, 0.13, s * 0.25);
          T(s * 0.86, 0.38, 90 - s * 48, 0.42, 0.14, s * 0.22);
          T(s * 0.72, 0.55, 90 - s * 30, 0.34, 0.12, s * 0.2);
        }
        T(-0.08, -0.86, -100, 0.3, 0.12, -0.35);
        T(0.1, -0.88, -72, 0.36, 0.12, 0.4);
        T(0.26, -0.82, -55, 0.24, 0.1, 0.4);
      } else if (view === "tq") {
        T(-0.93, 0.18, 162, 0.38, 0.14, -0.25);
        T(-0.9, 0.38, 146, 0.46, 0.15, -0.22);
        T(-0.76, 0.56, 128, 0.38, 0.13, -0.2);
        T(0.74, 0.5, 52, 0.22, 0.1, 0.25);
        T(0.6, 0.64, 68, 0.2, 0.09, 0.2);
        T(-0.34, -0.84, -118, 0.32, 0.12, -0.4);
        T(-0.16, -0.89, -96, 0.36, 0.12, -0.45);
        T(0.02, -0.9, -80, 0.24, 0.1, -0.4);
      } else if (view === "side") {
        T(-0.5, 0.42, 150, 0.42, 0.15, -0.25);
        T(-0.34, 0.58, 132, 0.46, 0.15, -0.22);
        T(-0.12, 0.68, 112, 0.36, 0.13, -0.2);
        T(-0.62, -0.74, -150, 0.3, 0.12, -0.4);
        T(-0.44, -0.84, -128, 0.36, 0.12, -0.45);
        T(-0.26, -0.89, -108, 0.26, 0.1, -0.4);
      } else if (view === "backtq") {
        T(0.92, 0.3, 30, 0.34, 0.13, 0.25);
        T(0.84, 0.48, 46, 0.36, 0.13, 0.22);
        T(-0.8, 0.5, 140, 0.24, 0.1, -0.2);
        T(0.2, -0.88, -70, 0.34, 0.12, 0.4);
        T(0.38, -0.8, -50, 0.26, 0.1, 0.4);
      } else {
        for (const s of [-1, 1]) {
          T(s * 0.92, 0.3, 90 - s * 60, 0.3, 0.12, s * 0.25);
          T(s * 0.82, 0.5, 90 - s * 42, 0.32, 0.12, s * 0.2);
        }
        T(0, -0.9, -90, 0.34, 0.12, 0.3);
        T(0.18, -0.84, -65, 0.24, 0.1, 0.4);
      }
      // the face itself stays clean: strands only on the scalp, cheeks and back
      const cu = view === "front" ? 0 : view === "tq" ? 0.3 * A : 0.5 * A;
      const keep = (x, y) =>
        !faceSide || ((x - cu) / (0.78 * A)) ** 2 + ((y - 0.2 * A) / (0.62 * A)) ** 2 > 1;
      paintFur(c, path, pal, SK.top - 6, SK.bot + 8, {
        fill: headGradient(c, pal),
        strands: faceSide ? 120 : 190,
        keep,
        x0: -1.4 * A,
        x1: 1.4 * A,
        seed: 31,
        edge: 2.1,
      });
      if (view === "side") {
        // the whisker pad, baked into the profile
        c.save();
        c.clip(path);
        padBlob(c, pal, centreLine(FACE.noseLine) - 6, FACE.noseLine + 3.2, 6.5, 4.4);
        c.restore();
      }
    });
  }
  function padBlob(c, pal, x, y, rx, ry) {
    const g = c.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, pal.furLight);
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.save();
    c.translate(x, y);
    c.scale(1, ry / rx);
    c.translate(-x, -y);
    c.globalAlpha = 0.5;
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, rx, 0, TAU);
    c.fill();
    c.restore();
  }
  // ───────── the muzzle: front, and the three-quarter one that tucks the far eye ─────────
  function muzzlePiece(view, pal) {
    return pieceOf("muzzle_" + view, 30, 46, 0.5, 0.68, (c) => {
      if (view === "front") {
        padBlob(c, pal, -4.2, 3.4, 6.6, 4.6);
        padBlob(c, pal, 4.2, 3.4, 6.6, 4.6);
        return;
      }
      // Built from the centre line, as seen at 45 degrees: the bridge rises
      // from the nose towards the brow; its far side is the muzzle's outline.
      const k = Math.sin(FACEKIT.faceYaw(45 * DEG));
      const n0 = centreLine(FACE.noseLine) * k;
      const mid = (v) => centreLine(v) * k - n0; // centre line, from the nose
      const half = (v) => lerp(1.0, 5.0, smooth(FACE.eyeLine - 2, FACE.noseLine + 2, v)) * (1 - 0.75 * smooth(FACE.noseLine + 5, FACE.noseLine + 10.5, v));
      const top = FACE.browLine - 4, bot = FACE.noseLine + 10.5; // opaque over the whole height of the far eye
      const farEdge = [];
      for (let v = top; v <= bot; v += 0.5) farEdge.push({ x: mid(v) + half(v), y: v - FACE.noseLine });
      const path = new Path2D();
      farEdge.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
      path.lineTo(-13, bot - FACE.noseLine);
      path.lineTo(-13, top - FACE.noseLine);
      path.closePath();
      c.fillStyle = headGradient(c, pal, FACE.noseLine);
      c.fill(path);
      padBlob(c, pal, -3.4, 3.4, 6.6, 4.6);
      padBlob(c, pal, 2.6, 3.2, 3.6, 4);
      // melt into the face on the near side, at the brow and under the chin
      c.globalCompositeOperation = "destination-out";
      let g = c.createLinearGradient(-13, 0, -7, 0);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(-15, -32, 8, 50);
      const fadeEnd = FACE.browLine + 1.5 - FACE.noseLine; // above the top of the eye
      g = c.createLinearGradient(0, top - FACE.noseLine, 0, fadeEnd);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(-15, -32, 30, 32 + fadeEnd);
      g = c.createLinearGradient(0, 6.5, 0, 10.5);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,1)");
      c.fillStyle = g;
      c.fillRect(-15, 6.5, 30, 6);
      c.globalCompositeOperation = "source-over";
      // the one drawn line: the far side of the bridge and whisker pad
      const line = c.createLinearGradient(0, FACE.browLine - 2 - FACE.noseLine, 0, 9);
      line.addColorStop(0, "rgba(29,17,62,0)");
      line.addColorStop(0.22, "rgba(29,17,62,0.75)");
      line.addColorStop(0.8, "rgba(29,17,62,0.75)");
      line.addColorStop(1, "rgba(29,17,62,0)");
      c.strokeStyle = line;
      c.lineWidth = 0.9;
      c.beginPath();
      farEdge.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.stroke();
    });
  }

  // ───────── eyes: a round eye cut by a thick, near-straight slanted lid ─────────
  function eyePiece(view, look, pal) {
    const W = 28, H = 28;
    return pieceOf(`eye_${view}_${look}`, W, H, 0.5, 0.5, (c) => {
      const g = eyeGeom(view, look);
      const { hw, hh } = g;
      if (g.inner < 0) c.scale(-1, 1); // drawn with the inner corner at +x
      const gx = g.gx * g.inner; // ...so the gaze is un-flipped here
      if (look === "hurt") {
        c.strokeStyle = INK;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-hw * 0.8, -hh * 0.58);
        c.lineTo(hw * 0.72, 0.4);
        c.lineTo(-hw * 0.8, hh * 0.62);
        c.stroke();
        return;
      }
      if (look === "closed") {
        c.strokeStyle = INK;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-hw * 0.95, 0.2);
        c.quadraticCurveTo(-hw * 0.1, hh * 0.78, hw * 0.92, 1.4);
        c.stroke();
        c.lineWidth = 1.1; // lashes at the outer corner
        c.beginPath();
        c.moveTo(-hw * 0.95, 0.2);
        c.lineTo(-hw * 0.95 - 1.9, -1.1);
        c.moveTo(-hw * 0.7, 1.9);
        c.lineTo(-hw * 0.7 - 1.7, 3.1);
        c.stroke();
        return;
      }
      const ellipse = (grow = 0) => {
        c.beginPath();
        c.ellipse(0, 0, hw + grow, hh + grow, 0, 0, TAU);
      };
      const sclera = () => {
        const s = c.createRadialGradient(0, hh * 0.25, 0.5, 0, 0, hh * 1.05);
        s.addColorStop(0, pal.sclera[0]);
        s.addColorStop(0.6, pal.sclera[1]);
        s.addColorStop(1, pal.sclera[2]);
        return s;
      };
      if (look === "dizzy") {
        ellipse();
        c.fillStyle = sclera();
        c.fill();
        c.strokeStyle = "#3a1326";
        c.lineWidth = 1.2;
        c.stroke();
        c.strokeStyle = "#8a3a10";
        c.lineWidth = 1.25;
        c.beginPath();
        for (let i = 0; i <= 60; i++) {
          const a = (i / 60) * TAU * 2.25, r = (i / 60) * 0.72;
          const x = Math.cos(a) * r * hw, y = Math.sin(a) * r * hh;
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        c.stroke();
        return;
      }
      // the lid: from the outer corner (high) down to the inner corner (low)
      const y0 = g.lid[0] * hh, y1 = g.lid[1] * hh;
      const P0 = { x: -hw - 1.5, y: y0 - (y1 - y0) * 0.1 }, P1 = { x: hw + 1.5, y: y1 + (y1 - y0) * 0.1 };
      const C = { x: 0, y: (y0 + y1) / 2 - (look === "glare" ? 0.5 : 0.9) };
      const lidAt = (t) => ({
        x: (1 - t) * (1 - t) * P0.x + 2 * (1 - t) * t * C.x + t * t * P1.x,
        y: (1 - t) * (1 - t) * P0.y + 2 * (1 - t) * t * C.y + t * t * P1.y,
      });
      const open = look === "wide";
      c.save();
      ellipse();
      c.clip();
      if (!open) {
        c.beginPath();
        c.moveTo(P0.x, P0.y);
        c.quadraticCurveTo(C.x, C.y, P1.x, P1.y);
        c.lineTo(hw + 4, hh + 4);
        c.lineTo(-hw - 4, hh + 4);
        c.closePath();
        c.clip();
      }
      c.fillStyle = sclera();
      c.fillRect(-14, -14, 28, 28);
      // iris: round in every view, tucked under the lid
      const ix = gx, iy = g.gy, r = g.r;
      c.fillStyle = "#4f1a08";
      c.beginPath();
      c.arc(ix, iy, r, 0, TAU);
      c.fill();
      const ig = c.createLinearGradient(0, iy - r, 0, iy + r);
      ig.addColorStop(0, "#7c2c0e");
      ig.addColorStop(0.55, "#c25a1c");
      ig.addColorStop(1, "#f6a43c");
      c.fillStyle = ig;
      c.beginPath();
      c.arc(ix, iy, r * 0.84, 0, TAU);
      c.fill();
      c.fillStyle = "#1d0910";
      c.beginPath();
      c.arc(ix, iy - r * 0.06, r * 0.5, 0, TAU);
      c.fill();
      // the lid's shadow across the top of the eye
      if (!open) {
        const mid = lidAt(0.5);
        const sh = c.createLinearGradient(0, mid.y, 0, mid.y + 3.6);
        sh.addColorStop(0, pal.lidShade);
        sh.addColorStop(1, "rgba(196,104,22,0)");
        c.save();
        c.transform(1, (y1 - y0) / (2 * hw), 0, 1, 0, 0); // follow the slant
        c.fillStyle = sh;
        c.fillRect(-14, mid.y - 6, 28, 10);
        c.restore();
      }
      c.restore();
      // outline: heavier down the outer side, light under the eye
      c.save();
      if (!open) {
        c.beginPath();
        c.moveTo(P0.x - 2, P0.y);
        c.quadraticCurveTo(C.x, C.y, P1.x + 2, P1.y);
        c.lineTo(hw + 5, hh + 5);
        c.lineTo(-hw - 5, hh + 5);
        c.closePath();
        c.clip();
      }
      c.strokeStyle = "#3a1326";
      c.lineWidth = 0.85;
      ellipse(0.1);
      c.stroke();
      c.lineWidth = 1.5;
      c.strokeStyle = INK;
      c.beginPath();
      c.ellipse(0, 0, hw + 0.2, hh + 0.2, 0, Math.PI * 0.62, Math.PI * (open ? 1.05 : 1.3));
      c.stroke();
      c.restore();
      // the lid line itself, and the lash flick at the outer corner
      c.strokeStyle = INK;
      c.fillStyle = INK;
      if (open) {
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(0, 0, hw + 0.3, hh + 0.3, 0, Math.PI * 1.02, Math.PI * 1.9);
        c.stroke();
        const ox = -hw * 0.86, oy = -hh * 0.56;
        c.beginPath();
        c.moveTo(ox + 0.8, oy - 0.9);
        c.lineTo(ox - 2.6, oy - 2.8);
        c.lineTo(ox - 0.6, oy + 1);
        c.fill();
      } else {
        // where the lid meets the eye's edge at each end
        const inside = (p) => (p.x / (hw + 0.5)) ** 2 + (p.y / (hh + 0.5)) ** 2 <= 1;
        let ta = 0, tb = 1;
        for (let t = 0; t <= 0.5; t += 0.01) if (inside(lidAt(t))) { ta = t; break; }
        for (let t = 1; t >= 0.5; t -= 0.01) if (inside(lidAt(t))) { tb = t; break; }
        const a = lidAt(ta), b = lidAt(tb);
        const ca = lidAt((ta + tb) / 2);
        const cx = 2 * ca.x - (a.x + b.x) / 2, cy = 2 * ca.y - (a.y + b.y) / 2;
        // a tapered stroke: thick at the outer corner, finer at the inner
        c.beginPath();
        c.moveTo(a.x - 0.3, a.y - 1.0);
        c.quadraticCurveTo(cx, cy - 0.9, b.x + 0.3, b.y - 0.45);
        c.lineTo(b.x + 0.2, b.y + 0.45);
        c.quadraticCurveTo(cx, cy + 0.8, a.x - 0.2, a.y + 0.9);
        c.closePath();
        c.fill();
        c.lineWidth = 0.4;
        c.stroke();
        c.beginPath(); // lash
        c.moveTo(a.x + 1.4, a.y - 1.2);
        c.lineTo(a.x - 2.5, a.y - 2.9);
        c.lineTo(a.x + 0.2, a.y + 1.1);
        c.closePath();
        c.fill();
      }
    });
  }
  function browPiece(view, kind, pal) {
    return pieceOf(`brow_${view}_${kind}`, 16, 9, 0.5, 0.5, (c) => {
      const L = { front: 11, near: 11, far: 7.4, side: 9 }[view] / 2;
      if (view === "far") c.scale(-1, 1);
      // [outer y, mid y, inner y, thickness, alpha]
      const s = { calm: [0.5, -0.9, 0.4, 1.0, 0.4], angry: [-1.9, -0.5, 1.9, 1.9, 0.9], raised: [0.6, -1.9, 0.2, 1.1, 0.6], pinch: [1.3, 0.3, -1.5, 1.5, 0.85] }[kind];
      c.globalAlpha = s[4];
      c.fillStyle = pal.brow;
      c.beginPath();
      c.moveTo(-L, s[0]);
      c.quadraticCurveTo(0, s[1] - s[3] * 0.5, L, s[2] - s[3] * 0.4);
      c.lineTo(L, s[2] + s[3] * 0.5);
      c.quadraticCurveTo(0, s[1] + s[3] * 0.6, -L, s[0] + 0.25);
      c.closePath();
      c.fill();
    });
  }
  function gemPiece(view) {
    return pieceOf("gem_" + view, 14, 18, 0.5, 0.5, (c) => {
      const hw = FACE.gem[view], hh = 6.3;
      const shape = (grow = 0) => {
        c.beginPath();
        if (view === "side") {
          // seen edge-on: set into the forehead, bulging forward
          c.moveTo(-hw * 0.5 - grow, -hh - grow);
          c.bezierCurveTo(hw * 1.5 + grow, -hh * 0.7, hw * 1.5 + grow, hh * 0.7, -hw * 0.5 - grow, hh + grow);
          c.bezierCurveTo(-hw - grow, hh * 0.4, -hw - grow, -hh * 0.4, -hw * 0.5 - grow, -hh - grow);
        } else c.ellipse(0, 0, hw + grow, hh + grow, 0, 0, TAU);
      };
      shape(1.1);
      c.fillStyle = "rgba(29,17,62,0.55)"; // the fur it is set in
      c.fill();
      shape();
      const g = c.createLinearGradient(-hw, -hh, hw * 0.6, hh);
      g.addColorStop(0, "#ffe27a");
      g.addColorStop(0.5, "#ffc530");
      g.addColorStop(1, "#d98414");
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = "#8a4c0c";
      c.lineWidth = 0.75;
      c.stroke();
      c.save();
      shape();
      c.clip();
      const tq = view === "tq" ? -0.5 : 0;
      c.fillStyle = "rgba(255,252,224,0.9)"; // the highlight, towards the near side
      c.beginPath();
      c.ellipse(-hw * 0.3 + tq, -hh * 0.42, hw * 0.34, hh * 0.3, -0.25, 0, TAU);
      c.fill();
      c.fillStyle = "rgba(255,238,160,0.55)";
      c.beginPath();
      c.ellipse(hw * 0.3, hh * 0.5, hw * 0.3, hh * 0.2, -0.3, 0, TAU);
      c.fill();
      c.restore();
    });
  }
  function nosePiece(view) {
    return pieceOf("nose_" + view, 12, 10, 0.5, 0.5, (c) => {
      c.scale(view === "side" ? 1.65 : 1.3, view === "side" ? 1.65 : 1.3);
      c.fillStyle = INK;
      c.beginPath();
      if (view === "side") {
        // the tip of the muzzle: tucked just inside the profile
        c.moveTo(-2.9, -1.4);
        c.quadraticCurveTo(-0.6, -2.2, 0.3, -0.9);
        c.quadraticCurveTo(0.8, 0.5, -0.5, 1.3);
        c.quadraticCurveTo(-2, 1.3, -2.9, -1.4);
      } else {
        const l = view === "tq" ? 2.5 : 2.2, r = view === "tq" ? 1.5 : 2.2;
        c.moveTo(-l, -1.3);
        c.quadraticCurveTo(0, -1.9, r, -1.3);
        c.quadraticCurveTo(r + 0.3, -0.5, 0.25, 1.5);
        c.quadraticCurveTo(0, 1.8, -0.25, 1.5);
        c.quadraticCurveTo(-l - 0.3, -0.5, -l, -1.3);
      }
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.5)";
      c.beginPath();
      c.ellipse(view === "side" ? -1.2 : -0.5, -0.9, 0.85, 0.36, 0, 0, TAU);
      c.fill();
    });
  }
  function mouthPiece(view, kind, pal) {
    return pieceOf(`mouth_${view}_${kind}`, 26, 22, 0.5, 0.25, (c) => {
      c.strokeStyle = INK;
      c.lineWidth = view === "side" ? 1.25 : 1.05;
      // the far half of the mouth is shorter in three-quarter: replotted, not squeezed
      const fx = (x) => (view === "tq" && x > 0 ? x * 0.52 : x);
      const M = (x, y) => c.moveTo(fx(x), y), Q = (a, b, x, y) => c.quadraticCurveTo(fx(a), b, fx(x), y), Ln = (x, y) => c.lineTo(fx(x), y);
      if (view === "side") {
        // from under the nose, back along the muzzle
        const lip = () => { c.moveTo(-0.8, 1.5); c.quadraticCurveTo(-1.4, 3.1, -3.2, 3.5); };
        if (kind === "smile") {
          c.beginPath(); lip(); c.quadraticCurveTo(-6.5, 4.4, -9.2, 2.6); c.quadraticCurveTo(-10, 2, -10.3, 1.2); c.stroke();
        } else if (kind === "flat") {
          c.beginPath(); lip(); c.quadraticCurveTo(-5.5, 4, -8, 3.8); c.stroke();
        } else if (kind === "o") {
          c.beginPath(); lip(); c.stroke();
          c.fillStyle = "#3d0f1e"; c.beginPath(); c.ellipse(-2.6, 4.6, 1.5, 1.8, 0.3, 0, TAU); c.fill(); c.stroke();
        } else if (kind === "grit") {
          c.beginPath(); c.moveTo(-1, 2.2); c.lineTo(-8.6, 2.6); c.lineTo(-8.4, 5); c.lineTo(-1.6, 4.8); c.closePath();
          c.fillStyle = "#fff8ec"; c.fill(); c.stroke();
          c.lineWidth = 0.6; c.beginPath(); for (const x of [-3.2, -5, -6.8]) { c.moveTo(x, 2.4); c.lineTo(x, 4.9); } c.stroke();
        } else {
          // open: the jaw drops; fur for the jaw, then the inside of the mouth
          const jaw = new Path2D();
          jaw.moveTo(-11.5, 2.2); jaw.lineTo(-3.8, 6.6); jaw.quadraticCurveTo(-2.3, 8, -3.9, 9.3); jaw.quadraticCurveTo(-8.5, 11.6, -14.5, 9.4); jaw.closePath();
          c.strokeStyle = pal.edge; c.lineWidth = 1.5; c.stroke(jaw);
          c.fillStyle = headGradient(c, pal, FACE.noseLine); c.fill(jaw);
          c.strokeStyle = INK; c.lineWidth = 1;
          c.beginPath(); c.moveTo(-0.9, 1.7); c.quadraticCurveTo(-3, 3.2, -11, 2.3); c.lineTo(-4, 6.7); c.quadraticCurveTo(-1.6, 4.6, -0.9, 1.7); c.closePath();
          c.fillStyle = "#5a1428"; c.fill(); c.stroke();
          c.fillStyle = "#e0647a"; c.beginPath(); c.ellipse(-5.6, 4.9, 2.4, 0.9, 0.52, 0, TAU); c.fill();
          c.fillStyle = "#fff8ec";
          c.beginPath(); c.moveTo(-2.3, 2.9); c.lineTo(-2.9, 5.2); c.lineTo(-3.9, 2.9); c.fill();
          c.beginPath(); c.moveTo(-6.2, 2.8); c.lineTo(-6.7, 4.1); c.lineTo(-7.4, 2.7); c.fill();
          c.beginPath(); c.moveTo(-4.4, 6.2); c.lineTo(-4.5, 4.6); c.lineTo(-5.6, 5.6); c.fill();
        }
        return;
      }
      const lips = () => {
        M(0, 1.5); Ln(0, 2.7);
        Q(-0.6, 4.6, -3, 4.4); Q(-4.9, 4.2, -5.6, 2.5);
        M(0, 2.7);
        Q(0.6, 4.6, 3, 4.4); Q(4.9, 4.2, 5.6, 2.5);
      };
      if (kind === "smile") {
        c.beginPath(); lips(); c.stroke();
        c.beginPath(); M(-5.6, 2.5); Q(-6.1, 2, -6, 1.4); M(5.6, 2.5); Q(6.1, 2, 6, 1.4); c.stroke();
      } else if (kind === "flat") {
        c.beginPath(); M(0, 1.5); Ln(0, 2.7); Q(-0.5, 3.8, -2.6, 3.7); M(0, 2.7); Q(0.5, 3.8, 2.6, 3.7); c.stroke();
      } else if (kind === "o") {
        c.beginPath(); M(0, 1.5); Ln(0, 2.6); c.stroke();
        c.fillStyle = "#3d0f1e"; c.beginPath(); c.ellipse(fx(0.4), 5, view === "tq" ? 1.5 : 1.9, 2.2, 0, 0, TAU); c.fill(); c.stroke();
      } else if (kind === "grit") {
        c.beginPath(); M(-5.2, 2.8); Q(0, 2.2, 5.2, 2.8); Q(5.6, 4.2, 5, 5.6); Q(0, 6.2, -5, 5.6); Q(-5.6, 4.2, -5.2, 2.8); c.closePath();
        c.fillStyle = "#fff8ec"; c.fill(); c.stroke();
        c.lineWidth = 0.6; c.beginPath();
        for (const x of [-3, -1, 1, 3]) { M(x, 2.5); Ln(x, 5.9); }
        M(-5.2, 4.2); Q(0, 3.9, 5.2, 4.2); c.stroke();
      } else {
        // open, fangs out: the lip line on top, the jaw dropped below it
        c.beginPath();
        M(-5.8, 2.4); Q(-4.9, 4.2, -3, 4.4); Q(-0.6, 4.6, 0, 2.9); Q(0.6, 4.6, 3, 4.4); Q(4.9, 4.2, 5.8, 2.4);
        Q(6.2, 7.5, 2.4, 10.2); Q(0, 11.2, -2.4, 10.2); Q(-6.2, 7.5, -5.8, 2.4);
        c.closePath();
        c.fillStyle = "#5a1428"; c.fill();
        c.stroke();
        c.save(); c.clip();
        c.fillStyle = "#e0647a"; c.beginPath(); c.ellipse(fx(0.2), 10.2, view === "tq" ? 2.4 : 3.1, 2.1, 0, 0, TAU); c.fill();
        c.restore();
        c.fillStyle = "#fff8ec";
        for (const s of [-1, 1]) {
          c.beginPath(); M(s * 2.1, 4.4); Ln(s * 3.2, 7.4); Ln(s * 4.3, 4.1); c.closePath(); c.fill();
          c.beginPath(); M(s * 1.5, 10.2); Ln(s * 2.1, 8.5); Ln(s * 2.9, 9.7); c.closePath(); c.fill();
        }
        c.beginPath(); M(0, 1.5); Ln(0, 2.9); c.stroke();
      }
    });
  }
  const VIEWS = ["front", "tq", "side"];
  const LOOKS = ["idle", "glare", "wide", "hurt", "dizzy", "closed"];
  const MOUTHS = ["smile", "open", "o", "grit", "flat"];
  /** Every piece of a phase. Draw each once: piece.draw(ctx, pixelsPerUnit). */
  function gloomPieces(phase) {
    const pal = PAL[phase] || PAL[1];
    const list = [];
    for (const v of ["front", "tq", "side", "backtq", "back"]) list.push(headPiece(v, pal));
    for (const v of ["front", "near", "far", "side"]) {
      for (const l of LOOKS) list.push(eyePiece(v, l, pal));
      for (const b of ["calm", "angry", "raised", "pinch"]) list.push(browPiece(v, b, pal));
    }
    for (const v of VIEWS) {
      list.push(gemPiece(v), nosePiece(v));
      if (v !== "side") list.push(muzzlePiece(v, pal));
      for (const m of MOUTHS) list.push(mouthPiece(v, m, pal));
    }
    list.push(
      KIT.glintPiece(),
      glowPiece("glow_amber", "255,196,86"),
      glowPiece("glow_gold", "255,214,110"),
      ballPiece("ball24_f", 24, pal, 5, { mode: "f", depth: 3.4 }),
      ballPiece("ball24_e", 24, pal, 5, { mode: "e", depth: 3.4 }),
      ballPiece("ball14", 14, pal, 9, { strands: 10 }),
      softPiece("puff_hi", pal.furLight, 0.6),
      softPiece("puff_lo", pal.furDark, 0.6),
      ...["e", "f"].flatMap((m) => [
        earPiece("ear_a_" + m, pal, 6.5, 10, false, m),
        earPiece("ear_m_" + m, pal, 10, 12, false, m),
        earPiece("ear_b_" + m, pal, 12, 10, true, m),
      ]),
      pieceOf("wisp", 20, 30, 0.5, 0.8, (c) => {
        const path = new Path2D();
        tuft(path, 0, 4, -Math.PI / 2, 24, 6, 0.3);
        tuft(path, -4, 5, -Math.PI / 2 - 0.3, 15, 4, -0.3);
        c.fillStyle = pal.furDark;
        c.globalAlpha = 0.8;
        c.fill(path);
      }),
      pieceOf("ruff", 40, 36, 0.5, 0.4, (c) => {
        const path = new Path2D();
        const rp = { ...pal, furLight: pal.ruffLight, fur: pal.ruff, furDark: pal.fur, rim: pal.ruffLight };
        for (let i = 0; i < 7; i++) {
          const a = lerp(20, 160, i / 6) * DEG;
          tuft(path, Math.cos(a) * 7, 2 + Math.sin(a) * 3, a, 13 + (i % 2) * 3.5, 4.6, i < 3 ? 0.2 : -0.2);
        }
        path.ellipse(0, 0, 13, 9, 0, 0, TAU);
        paintFur(c, path, rp, -10, 18, { strands: 26, x0: -13, x1: 13, seed: 3, edge: 1.4 });
      }),
      pieceOf("paw", 26, 24, 0.5, 0.45, (c) => {
        const path = new Path2D();
        path.ellipse(0, -1, 9.5, 8.5, 0, 0, TAU);
        for (const x of [-5.6, 0, 5.6]) path.ellipse(x, 5.2, 3.5, 3.6, 0, 0, TAU);
        paintFur(c, path, pal, -10, 10, { strands: 8, x0: -9, x1: 9, seed: 13, edge: 1.7 });
        c.fillStyle = "#2a1620";
        for (const x of [-5.6, 0, 5.6]) {
          c.beginPath(); c.moveTo(x - 1.2, 7.6); c.quadraticCurveTo(x + 0.3, 11.2, x + 1.6, 11.4); c.quadraticCurveTo(x + 1.5, 8.8, x + 1.2, 7.6); c.fill();
        }
      }),
      pieceOf("moon", 48, 48, 0.5, 0.5, (c) => {
        // horns towards +x
        const R = 19;
        c.beginPath();
        c.arc(0, 0, R, 0.55, TAU - 0.55, false);
        c.arc(9.5, 0, R * 0.76, TAU - 0.86, 0.86, true);
        c.closePath();
        const g = c.createLinearGradient(-R, -R, R * 0.4, R);
        g.addColorStop(0, "#fff3b0");
        g.addColorStop(0.5, "#ffd24a");
        g.addColorStop(1, "#e2901a");
        c.fillStyle = g;
        c.fill();
        c.strokeStyle = "#a45f10";
        c.lineWidth = 1;
        c.stroke();
        c.strokeStyle = "rgba(255,250,214,0.8)";
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(0, 0, R - 2.6, Math.PI * 0.95, Math.PI * 1.5);
        c.stroke();
      }),
      pieceOf("core", 22, 22, 0.5, 0.5, (c) => {
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 9);
        g.addColorStop(0, "#fffbe0");
        g.addColorStop(0.6, "#ffd86a");
        g.addColorStop(1, "#f0a02a");
        c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, 8.5, 0, TAU); c.fill();
        c.strokeStyle = "#9a5a10"; c.lineWidth = 0.9; c.stroke();
      }),
      KIT.starPiece(),
    );
    return list;
  }

  /** What the demo (and the checker) needs to know about this boss. */
  const boss = {
    id: "gloomshade",
    title: "Gloomshade",
    lede: "A fluffy shadow cat: big round amber eyes under a thick slanted lid, a gold gem on the brow, a short muzzle that tucks the far eye.",
    attacks: [["lunge", "Shadow Lunge"], ["hands", "Grasping Hands"], ["snuff", "Snuff"], ["curse", "Creeping Curse"], ["split", "Split"], ["pulse", "Moon Pulse"]],
    pose: gloomPose, placements: gloomPlacements, pieces: gloomPieces, faces: [FACEKIT],
    looks: LOOKS, mouths: MOUTHS,
    stage: { w: 380, h: 235, ground: 0.78, closeW: 110, closeH: 84, sheetGap: 232, sheetH: 205, closeGap: 84, closeSheetH: 96, champion: [-118, 34], shadow: [58, 17] },
    occluder: "the three-quarter muzzle: bridge and far whisker pad",
  };
  return {
    A, FACE, SK, SPEC, ATTACKS, LOOKS, MOUTHS, PAL, boss,
    centreLine, skullEdge, eyeGeom, gloomFace, gloomPose, gloomPlacements, gloomPieces,
  };
})();
if (typeof module !== "undefined") module.exports = GLOOM;
