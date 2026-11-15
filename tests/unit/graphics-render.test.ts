import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

/** Just enough of Phaser for the renderer: a 2D affine matrix and tints. */
class Matrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    Object.assign(this, { a, b, c, d, e, f });
  }
  loadIdentity() {
    Object.assign(this, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    return this;
  }
  multiply(m: Matrix, out: Matrix) {
    const { a, b, c, d, e, f } = this;
    out.a = m.a * a + m.b * c;
    out.b = m.a * b + m.b * d;
    out.c = m.c * a + m.d * c;
    out.d = m.c * b + m.d * d;
    out.e = m.e * a + m.f * c + e;
    out.f = m.e * b + m.f * d + f;
    return out;
  }
  scale(x: number, y: number) {
    this.a *= x;
    this.b *= x;
    this.c *= y;
    this.d *= y;
    return this;
  }
  translate(x: number, y: number) {
    this.e += this.a * x + this.c * y;
    this.f += this.b * x + this.d * y;
    return this;
  }
  rotate() {
    return this;
  }
  copyToArray() {
    return [this.a, this.b, this.c, this.d, this.e, this.f];
  }
  copyFromArray(v: number[]) {
    [this.a, this.b, this.c, this.d, this.e, this.f] = v;
    return this;
  }
}
let calc = new Matrix();
vi.mock("phaser", () => ({
  default: {
    VERSION: "3.90.0",
    GameObjects: {
      Components: { TransformMatrix: Matrix },
      GetCalcMatrix: () => ({ calc }),
      Graphics: { prototype: {} },
    },
    Renderer: {
      WebGL: { Utils: { getTintAppendFloatAlpha: (c: number) => c } },
    },
  },
}));

const {
  ARC_TOLERANCE,
  GRAPHICS_RENDER_PHASER,
  arcSegments,
  convexPath,
  installGraphicsRenderer,
  renderGraphics,
} = await import("../../apps/client/src/graphics-render");
const Phaser = (await import("phaser")).default as any;

const pts = (xy: number[][]) => xy.map(([x, y]) => ({ x, y, width: 1 }));

describe("the Graphics renderer copied from Phaser", () => {
  it("is installed only on the Phaser version it was copied from", () => {
    // Upgrading Phaser? Compare its GraphicsWebGLRenderer.js with
    // graphics-render.ts, carry any change over, then update the version.
    const installedPhaser = JSON.parse(
      readFileSync("node_modules/phaser/package.json", "utf8"),
    ).version;
    expect(installedPhaser).toBe(GRAPHICS_RENDER_PHASER);
  });

  it("uses Phaser's own command codes", () => {
    const source = readFileSync(
      "node_modules/phaser/src/gameobjects/graphics/Commands.js",
      "utf8",
    );
    const codes = Object.fromEntries(
      [...source.matchAll(/^\s*([A-Z_]+):\s*(\d+)/gm)].map((m) => [
        m[1],
        Number(m[2]),
      ]),
    );
    expect(codes).toMatchObject({
      ARC: 0,
      BEGIN_PATH: 1,
      CLOSE_PATH: 2,
      FILL_RECT: 3,
      LINE_TO: 4,
      MOVE_TO: 5,
      LINE_STYLE: 6,
      FILL_STYLE: 7,
      FILL_PATH: 8,
      STROKE_PATH: 9,
      FILL_TRIANGLE: 10,
      STROKE_TRIANGLE: 11,
      SAVE: 14,
      RESTORE: 15,
      TRANSLATE: 16,
      SCALE: 17,
      ROTATE: 18,
      GRADIENT_FILL_STYLE: 21,
      GRADIENT_LINE_STYLE: 22,
    });
  });
});

describe("arc segments", () => {
  it("keeps every circle within the tolerance of its true curve", () => {
    for (const r of [1, 3, 10, 40, 100, 300, 1000]) {
      const n = arcSegments(r);
      const sagitta = r * (1 - Math.cos(Math.PI / n));
      if (n < 100) expect(sagitta).toBeLessThanOrEqual(ARC_TOLERANCE + 1e-9);
      expect(n).toBeGreaterThanOrEqual(12);
      expect(n).toBeLessThanOrEqual(100);
    }
    // A spark is a dozen segments, not Phaser's hundred.
    expect(arcSegments(3)).toBe(12);
    expect(arcSegments(100)).toBeLessThan(50);
  });
});

describe("convex paths", () => {
  const circle = (n: number) =>
    pts(
      Array.from({ length: n }, (_, i) => [
        Math.cos((i / n) * Math.PI * 2) * 50,
        Math.sin((i / n) * Math.PI * 2) * 50,
      ]),
    );
  it("finds circles, ellipses and boxes convex, either way round", () => {
    expect(convexPath(circle(24), 24)).toBe(true);
    const back = circle(24).reverse();
    expect(convexPath(back, 24)).toBe(true);
    expect(
      convexPath(
        pts([
          [0, 0],
          [10, 0],
          [10, 5],
          [0, 5],
        ]),
        4,
      ),
    ).toBe(true);
  });
  it("allows a closing point, repeats and straight runs", () => {
    const closed = pts([
      [0, 0],
      [5, 0],
      [10, 0],
      [10, 5],
      [10, 5],
      [0, 5],
      [0, 0],
    ]);
    expect(convexPath(closed, closed.length)).toBe(true);
  });
  it("sends concave, self-crossing and degenerate paths to earcut", () => {
    const l = pts([
      [0, 0],
      [10, 0],
      [10, 4],
      [4, 4],
      [4, 10],
      [0, 10],
    ]);
    expect(convexPath(l, l.length)).toBe(false);
    const star = pts(
      Array.from({ length: 5 }, (_, i) => [
        Math.cos((i * 4 * Math.PI) / 5) * 10,
        Math.sin((i * 4 * Math.PI) / 5) * 10,
      ]),
    );
    expect(convexPath(star, 5)).toBe(false);
    const bowtie = pts([
      [0, 0],
      [10, 10],
      [10, 0],
      [0, 10],
    ]);
    expect(convexPath(bowtie, 4)).toBe(false);
    expect(
      convexPath(
        pts([
          [0, 0],
          [5, 0],
          [10, 0],
        ]),
        3,
      ),
    ).toBe(false);
    expect(
      convexPath(
        pts([
          [1, 1],
          [1, 1],
          [1, 1],
        ]),
        3,
      ),
    ).toBe(false);
  });
});

describe("rendering", () => {
  /** A pipeline that records what it was asked to draw. */
  function pipeline() {
    const tris: number[][] = [];
    const filled: number[][][] = [];
    const stroked: number[][][] = [];
    return {
      tris,
      filled,
      stroked,
      renderer: { pipelines: { set() {} } },
      fillTint: { TL: 0, TR: 0, BL: 0, BR: 0 },
      strokeTint: { TL: 0, TR: 0, BL: 0, BR: 0 },
      calcMatrix: new Matrix(),
      batchTri(_: unknown, ...v: number[]) {
        tris.push(v.slice(0, 6));
      },
      batchFillPath(path: { x: number; y: number }[]) {
        filled.push(path.map((p) => [p.x, p.y]));
      },
      batchStrokePath(path: { x: number; y: number }[]) {
        stroked.push(path.map((p) => [p.x, p.y]));
      },
    };
  }
  function draw(commands: number[], scale = 1) {
    installGraphicsRenderer();
    calc = new Matrix(scale, 0, 0, scale, 0, 0);
    const p = pipeline();
    const renderer = {
      pipelines: { set: () => p, preBatch() {}, postBatch() {} },
    };
    const camera = { alpha: 1, addToRenderList() {} };
    renderGraphics(
      renderer as any,
      { commandBuffer: commands, alpha: 1, pipeline: p } as any,
      camera as any,
    );
    return p;
  }
  const area = (tris: number[][]) =>
    tris.reduce(
      (sum, [x0, y0, x1, y1, x2, y2]) =>
        sum + Math.abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) / 2,
      0,
    );

  it("fills a circle as a fan as large as the circle, sized to the screen", () => {
    // fillCircle(100, 100, 40): BEGIN_PATH, ARC, FILL_PATH.
    const circle = [1, 0, 100, 100, 40, 0, Math.PI * 2, 0, 0, 8];
    const small = draw(circle);
    expect(small.filled).toHaveLength(0);
    const n = arcSegments(40);
    expect(small.tris).toHaveLength(n - 1);
    expect(area(small.tris)).toBeCloseTo(Math.PI * 40 * 40, -2);
    expect(area(small.tris) / (Math.PI * 1600)).toBeGreaterThan(0.99);
    // Drawn three times larger on screen, it gets more segments.
    const large = draw(circle, 3);
    expect(large.tris.length).toBe(arcSegments(120) - 1);
    expect(large.tris.length).toBeGreaterThan(small.tris.length);
    // Never more than Phaser's 100.
    expect(draw(circle, 100).tris.length).toBeLessThanOrEqual(100);
  });

  it("keeps a slice's centre and an arc's start and end exactly", () => {
    // slice(0, 0, 10, 0, PI/2): MOVE_TO centre, ARC, CLOSE_PATH, then stroke.
    const p = draw([1, 5, 0, 0, 0, 0, 0, 10, 0, Math.PI / 2, 0, 0, 2, 9]);
    const path = p.stroked[0];
    expect(path[0]).toEqual([0, 0]);
    expect(path[1][0]).toBeCloseTo(10);
    expect(path[1][1]).toBeCloseTo(0);
    expect(path.at(-2)![0]).toBeCloseTo(0);
    expect(path.at(-2)![1]).toBeCloseTo(10);
    expect(path.at(-1)).toEqual([0, 0]);
    for (const [x, y] of path.slice(1, -1))
      expect(Math.hypot(x, y)).toBeCloseTo(10, 6);
  });

  it("still fills a concave shape with Phaser's earcut", () => {
    const l = [1, 5, 0, 0, 4, 10, 0, 4, 10, 4, 4, 4, 4, 4, 4, 10, 4, 0, 10, 8];
    const p = draw(l);
    expect(p.tris).toHaveLength(0);
    expect(p.filled).toEqual([
      [
        [0, 0],
        [10, 0],
        [10, 4],
        [4, 4],
        [4, 10],
        [0, 10],
      ],
    ]);
  });

  it("draws ellipses with the same commands as Phaser's fillEllipse", () => {
    installGraphicsRenderer();
    const g = { commandBuffer: [] as number[] };
    Phaser.GameObjects.Graphics.prototype.fillEllipse.call(
      g,
      10,
      20,
      40,
      20,
      4,
    );
    // Phaser: getPoints(4) round the ellipse, then fillPoints(points, true).
    const c = (a: number) => Math.cos(a),
      s = (a: number) => Math.sin(a);
    const expected = [1, 5, 30, 20];
    for (let i = 1; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      expected.push(4, 10 + 20 * c(a), 20 + 10 * s(a));
    }
    expected.push(4, 30, 20, 8);
    expect(g.commandBuffer).toEqual(expected);
  });
});
