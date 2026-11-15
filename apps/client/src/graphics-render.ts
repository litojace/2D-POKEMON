/**
 * A lighter WebGL renderer for Phaser Graphics: the same shapes, drawn with
 * a fraction of the work and almost no garbage.
 *
 * The battle redraws most of its effects, rings, shadows and auras as
 * Graphics paths every frame. Phaser 3.90's renderer turns every circle or
 * arc into 100 segments whatever its size (a 3-pixel spark too), allocates a
 * new object for every point of every path on every frame, and fills every
 * path with earcut, a general polygon triangulator that allocates a linked
 * list per call. Measured in a duel (Chromium, phone viewport, 4× CPU
 * throttle): that was a quarter of the battle's JavaScript time and most of
 * its 28 MB a second of garbage, which the garbage collector then pays for
 * in pauses mid-fight.
 *
 * Here:
 * - an arc gets as many segments as its size on screen needs to stay within
 *   ARC_TOLERANCE of the true curve (12 for a spark, ~45 for a 100-pixel
 *   ring, never more than Phaser's 100);
 * - path points come from a pool reused every frame;
 * - a convex path (every circle, ellipse, rectangle-ish blob) is filled as a
 *   triangle fan, which covers exactly the same pixels as earcut's
 *   triangles; anything else still goes through Phaser's own earcut fill.
 *
 * Everything else (commands, styles, transforms, gradients, the order of
 * drawing) is Phaser's own code, copied from 3.90.0. `installGraphicsRenderer`
 * only replaces it on that exact version: an upgrade must be checked against
 * Phaser's renderer first (tests/unit/graphics-render.test.ts fails on
 * another version, on purpose).
 */
import Phaser from "phaser";

/** The Phaser version this renderer was copied from. */
export const GRAPHICS_RENDER_PHASER = "3.90.0";
/** Most distance (screen pixels) between an arc's segments and the true curve. */
export const ARC_TOLERANCE = 0.25;
/** Fewest and most segments for a whole circle (Phaser always used 100). */
export const ARC_MIN_SEGMENTS = 12;
export const ARC_MAX_SEGMENTS = 100;

// Phaser 3.90's Graphics command codes (src/gameobjects/graphics/Commands.js).
const ARC = 0,
  BEGIN_PATH = 1,
  CLOSE_PATH = 2,
  FILL_RECT = 3,
  LINE_TO = 4,
  MOVE_TO = 5,
  LINE_STYLE = 6,
  FILL_STYLE = 7,
  FILL_PATH = 8,
  STROKE_PATH = 9,
  FILL_TRIANGLE = 10,
  STROKE_TRIANGLE = 11,
  SAVE = 14,
  RESTORE = 15,
  TRANSLATE = 16,
  SCALE = 17,
  ROTATE = 18,
  GRADIENT_FILL_STYLE = 21,
  GRADIENT_LINE_STYLE = 22;

/**
 * Segments for a whole circle of `radius` screen pixels: enough that no
 * point of the curve is more than ARC_TOLERANCE from its chord.
 */
export function arcSegments(radius: number) {
  if (!(radius > ARC_TOLERANCE * 2)) return ARC_MIN_SEGMENTS;
  const n = Math.ceil(Math.PI / Math.acos(1 - ARC_TOLERANCE / radius));
  return Math.max(ARC_MIN_SEGMENTS, Math.min(ARC_MAX_SEGMENTS, n));
}

interface PathPoint {
  x: number;
  y: number;
  width: number;
}

/**
 * True when the closed polygon through `points[0..length)` is convex and
 * simple, so a fan from its first point covers it exactly once. Repeated
 * points and straight runs are allowed; a star (turns all one way but
 * winding twice) is not.
 */
export function convexPath(points: ArrayLike<PathPoint>, length: number) {
  if (length < 3) return false;
  let sign = 0;
  let turn = 0;
  let px = points[length - 1].x,
    py = points[length - 1].y;
  let dx0 = 0,
    dy0 = 0;
  // The last edge with length, to measure turns from.
  for (let i = length - 2; i >= 0; i--) {
    dx0 = px - points[i].x;
    dy0 = py - points[i].y;
    if (Math.abs(dx0) + Math.abs(dy0) >= 1e-6) break;
  }
  if (Math.abs(dx0) + Math.abs(dy0) < 1e-6) return false;
  let edges = 0;
  for (let i = 0; i < length; i++) {
    const dx = points[i].x - px,
      dy = points[i].y - py;
    px = points[i].x;
    py = points[i].y;
    // A closing point a rounding error from the first is not an edge.
    if (Math.abs(dx) + Math.abs(dy) < 1e-6) continue;
    edges++;
    const cross = dx0 * dy - dy0 * dx;
    const dot = dx0 * dx + dy0 * dy;
    // Straight on, give or take rounding.
    if (Math.abs(cross) > 1e-9 * Math.hypot(dx0, dy0) * Math.hypot(dx, dy)) {
      const s = cross > 0 ? 1 : -1;
      if (sign && s !== sign) return false;
      sign = s;
    } else if (dot < 0) return false; // Doubles back on itself.
    turn += Math.atan2(cross, dot);
    dx0 = dx;
    dy0 = dy;
  }
  // A simple convex polygon turns exactly once round.
  return (
    edges >= 3 && sign !== 0 && Math.abs(Math.abs(turn) - Math.PI * 2) < 0.01
  );
}

type Matrix = Phaser.GameObjects.Components.TransformMatrix;
type Pipeline = Phaser.Renderer.WebGL.Pipelines.MultiPipeline & {
  fillTint: { TL: number; TR: number; BL: number; BR: number };
  strokeTint: { TL: number; TR: number; BL: number; BR: number };
  calcMatrix: Matrix;
  batchTri: (...args: unknown[]) => boolean;
  batchFillPath: (path: PathPoint[], current: Matrix, parent: Matrix) => void;
  batchStrokePath: (
    path: PathPoint[],
    lineWidth: number,
    open: boolean,
    current: Matrix,
    parent: Matrix,
  ) => void;
};

/** Fill a convex path as a fan from its first point (as batchFillPath would). */
function fanFill(
  pipeline: Pipeline,
  points: PathPoint[],
  length: number,
  currentMatrix: Matrix,
  parentMatrix: Matrix,
) {
  pipeline.renderer.pipelines.set(pipeline);
  const m = pipeline.calcMatrix;
  parentMatrix.multiply(currentMatrix, m);
  const tint = pipeline.fillTint;
  const tl = tint.TL,
    tr = tint.TR,
    bl = tint.BL;
  const a = m.a,
    b = m.b,
    c = m.c,
    d = m.d,
    e = m.e,
    f = m.f;
  const p0 = points[0];
  const x0 = p0.x * a + p0.y * c + e,
    y0 = p0.x * b + p0.y * d + f;
  let p = points[1];
  let x1 = p.x * a + p.y * c + e,
    y1 = p.x * b + p.y * d + f;
  for (let i = 2; i < length; i++) {
    p = points[i];
    const x2 = p.x * a + p.y * c + e,
      y2 = p.x * b + p.y * d + f;
    pipeline.batchTri(null, x0, y0, x1, y1, x2, y2, 0, 0, 1, 1, tl, tr, bl, 2);
    x1 = x2;
    y1 = y2;
  }
}

class PointPool {
  private items: PathPoint[] = [];
  private used = 0;
  take(x: number, y: number, width: number) {
    let p = this.items[this.used];
    if (p) {
      p.x = x;
      p.y = y;
      p.width = width;
    } else this.items.push((p = { x, y, width }));
    this.used++;
    return p;
  }
  reset() {
    this.used = 0;
    // A one-off huge path should not pin its points for good.
    if (this.items.length > 20_000) this.items.length = 20_000;
  }
}

interface Path {
  points: PathPoint[];
}

const pool = new PointPool();
const pathPool: Path[] = [];
const matrixStack: number[][] = [];

/** Phaser's GraphicsWebGLRenderer (3.90.0) with the changes described above. */
export function renderGraphics(
  renderer: Phaser.Renderer.WebGL.WebGLRenderer,
  src: Phaser.GameObjects.Graphics,
  camera: Phaser.Cameras.Scene2D.Camera,
  parentMatrix?: Matrix,
) {
  const commands = (src as unknown as { commandBuffer: number[] })
    .commandBuffer;
  if (commands.length === 0) return;
  camera.addToRenderList(src);
  const pipeline = renderer.pipelines.set(
    (src as unknown as { pipeline: Phaser.Renderer.WebGL.WebGLPipeline })
      .pipeline,
    src,
  ) as Pipeline;
  renderer.pipelines.preBatch(src);
  const calcMatrix = Phaser.GameObjects.GetCalcMatrix(
    src,
    camera,
    parentMatrix as Matrix,
  ).calc;
  const currentMatrix = tempMatrix.loadIdentity();
  const alpha = camera.alpha * src.alpha;
  let lineWidth = 1;
  const fillTint = pipeline.fillTint;
  const strokeTint = pipeline.strokeTint;
  const getTint = Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha;
  const PI2 = Math.PI * 2;
  // Screen pixels per unit of the Graphics' own space (for arc segments).
  // Recomputed when the Graphics' own transform commands change it.
  let unitScale = matrixScale(calcMatrix, currentMatrix);
  let paths = 0;
  let lastPath: Path | null = null;
  let pathOpen = true;
  pool.reset();
  const newPath = (x: number, y: number) => {
    let path = pathPool[paths];
    if (!path) pathPool.push((path = { points: [] }));
    paths++;
    path.points.length = 0;
    path.points.push(pool.take(x, y, lineWidth));
    return path;
  };
  for (let i = 0; i < commands.length; i++) {
    switch (commands[i]) {
      case BEGIN_PATH:
        paths = 0;
        lastPath = null;
        pathOpen = true;
        break;
      case CLOSE_PATH:
        pathOpen = false;
        if (lastPath && lastPath.points.length)
          lastPath.points.push(lastPath.points[0]);
        break;
      case FILL_PATH:
        for (let p = 0; p < paths; p++) {
          const points = pathPool[p].points;
          if (convexPath(points, points.length))
            fanFill(pipeline, points, points.length, currentMatrix, calcMatrix);
          else pipeline.batchFillPath(points, currentMatrix, calcMatrix);
        }
        break;
      case STROKE_PATH:
        for (let p = 0; p < paths; p++)
          pipeline.batchStrokePath(
            pathPool[p].points,
            lineWidth,
            pathOpen,
            currentMatrix,
            calcMatrix,
          );
        break;
      case LINE_STYLE: {
        lineWidth = commands[++i];
        const color = commands[++i];
        const tint = getTint(color, commands[++i] * alpha);
        strokeTint.TL = strokeTint.TR = strokeTint.BL = strokeTint.BR = tint;
        break;
      }
      case FILL_STYLE: {
        const color = commands[++i];
        const tint = getTint(color, commands[++i] * alpha);
        fillTint.TL = fillTint.TR = fillTint.BL = fillTint.BR = tint;
        break;
      }
      case GRADIENT_FILL_STYLE: {
        const aTL = commands[++i] * alpha;
        const aTR = commands[++i] * alpha;
        const aBL = commands[++i] * alpha;
        const aBR = commands[++i] * alpha;
        fillTint.TL = getTint(commands[++i], aTL);
        fillTint.TR = getTint(commands[++i], aTR);
        fillTint.BL = getTint(commands[++i], aBL);
        fillTint.BR = getTint(commands[++i], aBR);
        break;
      }
      case GRADIENT_LINE_STYLE: {
        lineWidth = commands[++i];
        const a = commands[++i] * alpha;
        strokeTint.TL = getTint(commands[++i], a);
        strokeTint.TR = getTint(commands[++i], a);
        strokeTint.BL = getTint(commands[++i], a);
        strokeTint.BR = getTint(commands[++i], a);
        break;
      }
      case ARC: {
        const x = commands[++i];
        const y = commands[++i];
        const radius = commands[++i];
        const startAngle = commands[++i];
        let endAngle = commands[++i];
        const anticlockwise = commands[++i];
        const overshoot = commands[++i];
        endAngle -= startAngle;
        if (anticlockwise) {
          if (endAngle < -PI2) endAngle = -PI2;
          else if (endAngle > 0) endAngle = -PI2 + (endAngle % PI2);
        } else if (endAngle > PI2) endAngle = PI2;
        else if (endAngle < 0) endAngle = PI2 + (endAngle % PI2);
        // Phaser steps 1/100 of the arc whatever its size; step so each
        // segment is as long as a whole circle of arcSegments() would have.
        const sweep = Math.abs(endAngle) / PI2;
        const steps = Math.max(
          1,
          Math.ceil(arcSegments(Math.abs(radius) * unitScale) * sweep),
        );
        let k = 0;
        if (lastPath === null) {
          lastPath = newPath(
            x + Math.cos(startAngle) * radius,
            y + Math.sin(startAngle) * radius,
          );
          k = 1;
        }
        const points = lastPath.points;
        const last = (1 + overshoot) * steps;
        for (; k < last; k++) {
          const ta = (endAngle * k) / steps + startAngle;
          points.push(
            pool.take(
              x + Math.cos(ta) * radius,
              y + Math.sin(ta) * radius,
              lineWidth,
            ),
          );
        }
        const ta = endAngle + startAngle;
        points.push(
          pool.take(
            x + Math.cos(ta) * radius,
            y + Math.sin(ta) * radius,
            lineWidth,
          ),
        );
        break;
      }
      case FILL_RECT:
        pipeline.batchFillRect(
          commands[++i],
          commands[++i],
          commands[++i],
          commands[++i],
          currentMatrix,
          calcMatrix,
        );
        break;
      case FILL_TRIANGLE:
        pipeline.batchFillTriangle(
          commands[++i],
          commands[++i],
          commands[++i],
          commands[++i],
          commands[++i],
          commands[++i],
          currentMatrix,
          calcMatrix,
        );
        break;
      case STROKE_TRIANGLE:
        pipeline.batchStrokeTriangle(
          commands[++i],
          commands[++i],
          commands[++i],
          commands[++i],
          commands[++i],
          commands[++i],
          lineWidth,
          currentMatrix,
          calcMatrix,
        );
        break;
      case LINE_TO:
        if (lastPath !== null)
          lastPath.points.push(
            pool.take(commands[++i], commands[++i], lineWidth),
          );
        else lastPath = newPath(commands[++i], commands[++i]);
        break;
      case MOVE_TO:
        lastPath = newPath(commands[++i], commands[++i]);
        break;
      case SAVE:
        matrixStack.push(currentMatrix.copyToArray() as number[]);
        break;
      case RESTORE:
        currentMatrix.copyFromArray(matrixStack.pop()!);
        unitScale = matrixScale(calcMatrix, currentMatrix);
        break;
      case TRANSLATE:
        currentMatrix.translate(commands[++i], commands[++i]);
        break;
      case SCALE:
        currentMatrix.scale(commands[++i], commands[++i]);
        unitScale = matrixScale(calcMatrix, currentMatrix);
        break;
      case ROTATE:
        currentMatrix.rotate(commands[++i]);
        break;
    }
  }
  renderer.pipelines.postBatch(src);
}

let tempMatrix: Matrix;

/** The larger of a combined transform's two axis scales (screen px per unit). */
function matrixScale(parent: Matrix, current: Matrix) {
  const a = parent.a * current.a + parent.c * current.b;
  const b = parent.b * current.a + parent.d * current.b;
  const c = parent.a * current.c + parent.c * current.d;
  const d = parent.b * current.c + parent.d * current.d;
  return Math.max(Math.hypot(a, b), Math.hypot(c, d));
}

/**
 * fillEllipse and strokeEllipse as Phaser 3.90 builds them (the same
 * commands: `smoothness` points round the ellipse, closed by a line back to
 * the first), without a new Ellipse and a new point object per point on
 * every call.
 */
function ellipsePath(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  smoothness: number,
) {
  const buffer = (g as unknown as { commandBuffer: number[] }).commandBuffer;
  const hw = width / 2,
    hh = height / 2;
  buffer.push(BEGIN_PATH, MOVE_TO, x + hw, y);
  for (let i = 1; i < smoothness; i++) {
    const angle = (i / smoothness) * Math.PI * 2;
    buffer.push(LINE_TO, x + hw * Math.cos(angle), y + hh * Math.sin(angle));
  }
  buffer.push(LINE_TO, x + hw, y);
}

let originals: Record<string, unknown> | undefined;
const replacements: Record<string, unknown> = {
  renderWebGL: renderGraphics,
  fillEllipse(
    this: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    smoothness = 32,
  ) {
    ellipsePath(this, x, y, width, height, smoothness);
    (this as unknown as { commandBuffer: number[] }).commandBuffer.push(
      FILL_PATH,
    );
    return this;
  },
  strokeEllipse(
    this: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    smoothness = 32,
  ) {
    ellipsePath(this, x, y, width, height, smoothness);
    (this as unknown as { commandBuffer: number[] }).commandBuffer.push(
      STROKE_PATH,
    );
    return this;
  },
};

/**
 * Use this renderer for every Phaser Graphics (on Phaser 3.90.0 only).
 * `on = false` puts Phaser's own back (for measuring one against the other).
 */
export function installGraphicsRenderer(on = true) {
  if (Phaser.VERSION !== GRAPHICS_RENDER_PHASER) return false;
  tempMatrix ??= new Phaser.GameObjects.Components.TransformMatrix();
  const proto = Phaser.GameObjects.Graphics.prototype as unknown as Record<
    string,
    unknown
  >;
  originals ??= Object.fromEntries(
    Object.keys(replacements).map((k) => [k, proto[k]]),
  );
  Object.assign(proto, on ? replacements : originals);
  return on;
}
