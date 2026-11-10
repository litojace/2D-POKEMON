/**
 * The face construction the vector bosses share (docs/boss-face-drawing.md).
 * Pure: a head's pose in, piece placements out. Nothing here draws to the
 * screen; each boss draws its pieces once into its atlas.
 *
 * Head space: u across, v down, from the head's centre, worked out for a head
 * turned to screen right and mirrored for left turns. Yaw 0 faces the camera.
 *
 * The rules:
 *  1. the yaw picks the view (front, three-quarter, side, or none from
 *     behind); every feature has its own drawing for each view, and nothing
 *     is squeezed to fake a turn;
 *  2. a feature's height is its line, the same in every view;
 *  3. across, eyes ride a circle (eyeOrbit * sin(faceYaw -+ eyeAz)) and the
 *     features on the centre line sit at centreLine(v) * sin(faceYaw), where
 *     centreLine is the head's own profile;
 *  4. each feature is held inside the view's drawn outline by its half-width;
 *  5. everything turns by the head's roll only, plus one fixed lift of the
 *     far eye's outer corner;
 *  6. back to front: head, far eye, the occluder, near eye, the rest, highlights.
 */
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const wrap = (a: number) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

export type FaceView = "front" | "tq" | "side" | "backtq" | "back";
export type EyeView = "front" | "near" | "far" | "side";
export interface FacePlacement {
  key: string;
  piece: string;
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
  alpha: number;
  z: number;
  glow?: boolean;
}
/** A feature on the centre line (a gem, a nose, a mouth, a beak, a muzzle). */
export interface CentreFeature<E> {
  id: string;
  /** Its height. Omit and give `anchor` to share another feature's place. */
  line?: number;
  anchor?: string;
  /** How much of a nod it follows (1 by default). */
  nodK?: number;
  /** Half-width per view, for holding it inside the outline. */
  hw?: Partial<Record<FaceView, number>>;
  /** Its extent above and below its line, for the same. */
  vspan?: [number, number];
  /** In profile it sits this far inside the outline. */
  sideInset?: number;
  /** "mid" is drawn between the far and the near eye (the occluder). */
  layer?: "mid" | "top" | ((view: FaceView) => "mid" | "top");
  piece: (view: FaceView, expr: E) => string | null;
  glow?: (
    expr: E,
    view: FaceView,
  ) => { piece: string; alpha: number; s?: number };
}
export interface FaceSpec<E> {
  /** Half the head's width: the unit of the constants. */
  A: number;
  top: number;
  bot: number;
  lines: { eye: number; brow?: number } & Record<string, number | undefined>;
  /** How far round from the centre line each eye sits, and the circle they ride. */
  eyeAz: number;
  eyeOrbit: number;
  /** How far the face trails the skull at three-quarter. */
  lag: number;
  /** The far eye's outer corner lifts by this, always. */
  farLift: number;
  /** How far a nod slides the face, per radian. */
  nod: number;
  /** Clear space kept between a feature and the outline. */
  margin: number;
  /** The most of the far eye the bridge may hide (0-1), and the bridge's half-thickness. */
  tuckCap?: number;
  bridgeHalf?: number;
  /** Each view's eye: its own drawing's half-width and half-height. */
  eye: Record<EyeView, { hw: number; hh: number }>;
  /** The profile: how far in front of the head's axis the face's middle is at height v. */
  centreLine: (v: number) => number;
  /** The drawn outline of a view at height v: [left, right]. */
  skullEdge: (view: FaceView, v: number) => [number, number];
  headPiece: (view: FaceView) => string;
  eyePiece: (view: EyeView, expr: E) => string;
  /** Where the highlight goes on an eye, from its centre (omit for none). */
  glint?: (
    view: EyeView,
    expr: E,
  ) => { piece: string; x: number; y: number } | null;
  brow?: (
    view: EyeView,
    expr: E,
  ) => { piece: string; dx?: number; dy?: number } | null;
  centre: CentreFeature<E>[];
}
export interface FaceHead {
  /** The head's centre on screen (rig units), and its sort depth. */
  x: number;
  y: number;
  z: number;
  /** Radians from the camera (0 faces it), the nod, the roll. */
  yaw: number;
  pitch: number;
  roll: number;
  /** The view shown last frame: holds it until the yaw is 4 degrees past a line. */
  prevView?: FaceView;
}

/** Which drawing of the head a yaw shows, and which way it is mirrored. */
export function headView(yaw: number, prev?: FaceView) {
  const w = wrap(yaw),
    a = Math.abs(w) / DEG;
  const pick = (x: number): FaceView =>
    x < 22.5
      ? "front"
      : x < 67.5
        ? "tq"
        : x < 112.5
          ? "side"
          : x < 157.5
            ? "backtq"
            : "back";
  let view = pick(a);
  if (prev && prev !== view && (pick(a - 4) === prev || pick(a + 4) === prev))
    view = prev;
  return { view, side: w < 0 ? -1 : 1, turn: Math.abs(w) };
}

export function makeFace<E>(F: FaceSpec<E>) {
  /** The face's own yaw: the skull's, held back a little (0 at front and side). */
  const faceYaw = (turn: number) =>
    turn - F.lag * Math.sin(2 * Math.min(turn, 90 * DEG));
  /** Keep a feature of half-width hw, spanning v0..v1, inside the view's outline. */
  function contain(
    view: FaceView,
    u: number,
    hw: number,
    v0: number,
    v1: number,
  ) {
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
  function face(head: FaceHead, expr: E) {
    const hv = headView(head.yaw, head.prevView);
    const view = hv.view;
    let side = hv.side;
    const out: FacePlacement[] = [];
    const cr = Math.cos(head.roll),
      sr = Math.sin(head.roll);
    let n = 0;
    const at = (u: number, v: number) => ({
      x: head.x + u * side * cr - v * sr,
      y: head.y + u * side * sr + v * cr,
    });
    const put = (
      key: string,
      piece: string,
      u: number,
      v: number,
      o: {
        rot?: number;
        flip?: boolean;
        still?: boolean;
        glow?: boolean;
        alpha?: number;
        s?: number;
      } = {},
    ) => {
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
        z: head.z + 0.02 + 0.001 * n++,
        glow: o.glow,
      });
    };
    let pf = faceYaw(hv.turn);
    // the front drawing is one drawing: it slides with the turn but never flips
    if (view === "front") {
      pf *= side;
      side = 1;
    }
    put("head", F.headPiece(view), 0, 0);
    const nod = clamp(head.pitch, -0.45, 0.45) * F.nod;
    const feats: Record<string, { u: number; v: number }> = {};
    if (view === "back" || view === "backtq")
      return { placements: out, view, side, at, nod, feats, eyes: [] };

    const eyeV = F.lines.eye + nod;
    const sinF = view === "side" ? 1 : Math.sin(pf);
    const list: [EyeView, number, boolean, "n" | "f"][] =
      view === "front"
        ? [
            ["front", -F.eyeAz, false, "n"],
            ["front", F.eyeAz, true, "f"],
          ]
        : view === "tq"
          ? [
              ["near", -F.eyeAz, false, "n"],
              ["far", F.eyeAz, false, "f"],
            ]
          : [["side", -F.eyeAz, false, "n"]];
    const bridge = F.centreLine(F.lines.eye) * sinF + (F.bridgeHalf ?? 0);
    const eyes = list.map(([v, az, flip, id]) => {
      const g = F.eye[v];
      let u = F.eyeOrbit * Math.sin(pf + az);
      // the far eye never hides more than tuckCap of itself behind the bridge
      if (v === "far" && F.tuckCap !== undefined)
        u = Math.max(u, bridge + g.hw * (1 - 2 * F.tuckCap));
      u = contain(view, u, g.hw, eyeV - g.hh * 0.7, eyeV + g.hh * 0.7);
      return { v, flip, id, g, u, rot: v === "far" ? -F.farLift : 0 };
    });
    for (const f of F.centre)
      if (f.line !== undefined) {
        const v = f.line + nod * (f.nodK ?? 1);
        let u = F.centreLine(f.line) * sinF;
        if (view === "side") u -= f.sideInset ?? 0;
        else if (f.hw?.[view] !== undefined)
          u = contain(
            view,
            u,
            f.hw[view]!,
            v + (f.vspan?.[0] ?? -1),
            v + (f.vspan?.[1] ?? 1),
          );
        feats[f.id] = { u, v };
      }
    for (const f of F.centre) if (f.anchor) feats[f.id] = feats[f.anchor];

    const drawEye = (e: (typeof eyes)[number]) => {
      put("eye" + e.id, F.eyePiece(e.v, expr), e.u, eyeV, {
        rot: e.rot,
        flip: e.flip,
      });
      const b = F.brow?.(e.v, expr);
      if (b)
        put(
          "brow" + e.id,
          b.piece,
          e.u + (e.flip ? -1 : 1) * (e.v === "far" ? -1 : 1) * (b.dx ?? 0),
          (F.lines.brow ?? F.lines.eye) + nod + (b.dy ?? 0),
          { rot: e.rot, flip: e.flip },
        );
    };
    const drawFeat = (f: CentreFeature<E>) => {
      const p = feats[f.id];
      const piece = f.piece(view, expr);
      if (piece) put(f.id, piece, p.u, p.v);
      const gl = f.glow?.(expr, view);
      if (gl && gl.alpha > 0.01)
        put(f.id + "glow", gl.piece, p.u, p.v, {
          glow: true,
          alpha: clamp(gl.alpha),
          s: gl.s,
        });
    };
    const layer = (f: CentreFeature<E>) =>
      (typeof f.layer === "function" ? f.layer(view) : f.layer) ?? "top";
    const far = eyes.find((e) => e.id === "f"),
      near = eyes.find((e) => e.id === "n")!;
    if (far) drawEye(far);
    for (const f of F.centre) if (layer(f) === "mid") drawFeat(f);
    drawEye(near);
    for (const f of F.centre) if (layer(f) === "top") drawFeat(f);
    // highlights: one drawing, never mirrored, on the same side of both eyes
    for (const e of eyes) {
      const g = F.glint?.(e.v, expr);
      if (g)
        put("glint" + e.id, g.piece, e.u + g.x, eyeV + g.y, { still: true });
    }
    return { placements: out, view, side, at, nod, feats, eyes, bridge };
  }
  return { face, contain, faceYaw, spec: F };
}

type Ctx = CanvasRenderingContext2D;
export interface EyeDrawing {
  hw: number;
  hh: number;
  look: "open" | "closed" | "dizzy";
  /** The lid: [outer y, inner y] in half-heights. Omit for a wide-open eye. */
  lid?: [number, number];
  bow?: number;
  sclera: string[];
  shade?: string;
  iris?: {
    x: number;
    y: number;
    r: number;
    stops: string[];
    ring?: string;
    pupil?: string;
    slit?: number;
  };
  ink: string;
  weight?: number;
  spiral?: string;
}
/**
 * An eye, drawn once per view and look with its inner corner at +x: a round
 * or almond eye cut by a lid that runs from the outer corner down to the
 * inner. Line weights are in the caller's units whatever the eye's width, so
 * a narrow far eye keeps the same line as a wide near one.
 */
export function drawEye(c: Ctx, o: EyeDrawing) {
  const { hw, hh } = o,
    wt = o.weight ?? 2;
  c.lineJoin = c.lineCap = "round";
  c.strokeStyle = c.fillStyle = o.ink;
  c.lineWidth = wt;
  const lash = (x: number, y: number) => {
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
    c.ellipse(0, 0, hw + g, hh + g, 0, 0, TAU);
  };
  const white = () => {
    const g = c.createRadialGradient(
      0,
      hh * 0.25,
      0.5,
      0,
      hh * 0.25,
      hh * 1.1 + hw * 0.2,
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
      const a = (i / 60) * TAU * 2.25,
        r = (i / 60) * 0.72;
      if (i) c.lineTo(Math.cos(a) * r * hw, Math.sin(a) * r * hh);
      else c.moveTo(0, 0);
    }
    c.stroke();
    return;
  }
  const open = !o.lid;
  const y0 = open ? 0 : o.lid![0] * hh,
    y1 = open ? 0 : o.lid![1] * hh;
  const P0 = { x: -hw - 1.5, y: y0 - (y1 - y0) * 0.1 },
    P1 = { x: hw + 1.5, y: y1 + (y1 - y0) * 0.1 },
    C = { x: 0, y: (y0 + y1) / 2 - (o.bow ?? 1.6) };
  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * P0.x + 2 * (1 - t) * t * C.x + t * t * P1.x,
    y: (1 - t) * (1 - t) * P0.y + 2 * (1 - t) * t * C.y + t * t * P1.y,
  });
  const under = (g: number) => {
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
      c.arc(I.x, I.y, I.r, 0, TAU);
      c.fill();
    }
    const g = c.createLinearGradient(0, I.y - I.r, 0, I.y + I.r);
    I.stops.forEach((s, i) => g.addColorStop(i / (I.stops.length - 1), s));
    c.fillStyle = g;
    c.beginPath();
    c.arc(I.x, I.y, I.r * (I.ring ? 0.84 : 1), 0, TAU);
    c.fill();
    c.fillStyle = I.pupil ?? "#0b0503";
    c.beginPath();
    // a slit pupil keeps its width whatever the eye's
    if (I.slit) c.ellipse(I.x, I.y, I.slit, I.r * 0.82, 0, 0, TAU);
    else c.arc(I.x, I.y - I.r * 0.06, I.r * 0.5, 0, TAU);
    c.fill();
  }
  if (!open && o.shade) {
    // the lid's shadow across the top of the eye
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
    Math.PI * (open ? 1.05 : 1.3),
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
  const inside = (p: { x: number; y: number }) =>
    (p.x / (hw + 0.5)) ** 2 + (p.y / (hh + 0.5)) ** 2 <= 1;
  let ta = 0,
    tb = 1;
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
  const a = at(ta),
    b = at(tb),
    m = at((ta + tb) / 2);
  const cx = 2 * m.x - (a.x + b.x) / 2,
    cy = 2 * m.y - (a.y + b.y) / 2,
    h = wt / 2;
  // a tapered stroke: heavy at the outer corner, finer at the inner
  c.beginPath();
  c.moveTo(a.x - 0.3, a.y - h);
  c.quadraticCurveTo(cx, cy - h * 0.9, b.x + 0.3, b.y - h * 0.45);
  c.lineTo(b.x + 0.2, b.y + h * 0.45);
  c.quadraticCurveTo(cx, cy + h * 0.8, a.x - 0.2, a.y + h * 0.9);
  c.closePath();
  c.fill();
  lash(a.x, a.y);
}
